import { HttpService, SendHandle } from '../../services/HttpService';
import { RequestDeadline, RequestTimeoutError } from '../../services/RequestDeadline';
import { getSseSnapshot, SseStreamUpdate } from '../../services/SseStream';
import { VariableService } from '../../services/VariableService';
import { PathVariableService } from '../../services/PathVariableService';
import {
  CollectionItem,
  KeyValue,
  MessageType,
  Request,
  Response,
} from '../../models/types';
import { AuthService } from '../../services/AuthService';
import { RequestBodyService } from '../../services/RequestBodyService';
import { ScriptRunner } from '../../services/ScriptRunner';
import { LocalizationService } from '../../services/LocalizationService';
import { ExecutionContext, hasEnvironmentChanges } from './executionContext';
import { SecretRedactor } from '../../services/secretVariables';
import { SecretExecutionHost, requestVariableTexts, secretDiagnostic, createSecretHistorySnapshot, reprotectScriptVariables } from './secretExecution';
import {
  buildUrl,
  cloneAllKeyValues,
  cloneFormDataFields,
  cloneKeyValues,
  coalesceQueryParams,
  createCancelableDelay,
  createHistoryRequestSnapshot,
  createRequestTiming,
  createScriptableRequest,
  createUnresolvedVariableError,
  findPayloadUnresolvedVariables,
  findUnresolvedVariables,
  isScriptExecutionBlocked,
  normalizeBodyType,
  normalizeMethod,
  normalizeRequestSettings,
  normalizeScripts,
  RequestTiming,
  shouldRetryResponse,
} from './requestUtils';

export interface CollectionRunnerHost extends SecretExecutionHost {
  captureExecutionContext(): ExecutionContext;
  isExecutionContextCurrent(context: ExecutionContext): boolean;
  postMessage(message: unknown): void;
  getActiveVariables(): KeyValue[];
  getDefaultHeaders(): KeyValue[];
  getAllowInsecureCertificates(): boolean;
  getScriptTimeoutMs(): number;
  showInformationMessage?(message: string): void;
  saveEnvironmentChanges(context: ExecutionContext, before: KeyValue[], after: KeyValue[], redactor?: SecretRedactor): void;
  saveToHistory(
    request: Request,
    response: { status: number; statusText: string; time: number } | null,
    timing: RequestTiming | undefined,
    context: ExecutionContext
  ): void;
  refreshHistory(): void;
}

export interface CollectionRunnerOptions {
  delayMs?: number;
  iterations?: number;
  stopOnFailure?: boolean;
  /** Per-run selection of CollectionItem.id values. Omit to run every flattened request. */
  selectedRequestIds?: string[];
}

export interface NormalizedCollectionRunnerOptions {
  delayMs: number;
  iterations: number;
  stopOnFailure: boolean;
}

export interface CollectionRunListEntry {
  id: string;
  name: string;
  method: string;
  folderPath: string;
  request: Request;
}

export interface CollectionRunSelectionTotals {
  collectionTotal: number;
  selectedTotal: number;
}

interface CollectionRequestRunResult {
  name: string;
  method: Request['method'];
  url: string;
  status: number;
  statusText: string;
  time: number;
  error: string | null;
  response: Response | null;
  failed: boolean;
}

export const DEFAULT_COLLECTION_RUNNER_OPTIONS: NormalizedCollectionRunnerOptions = {
  delayMs: 0,
  iterations: 1,
  stopOnFailure: false,
};

export const MAX_COLLECTION_RUNNER_DELAY_MS = 60000;
export const MAX_COLLECTION_RUNNER_ITERATIONS = 100;

export function normalizeCollectionRunnerOptions(options: CollectionRunnerOptions = {}): NormalizedCollectionRunnerOptions {
  return {
    delayMs: normalizeRunnerInteger(options.delayMs, DEFAULT_COLLECTION_RUNNER_OPTIONS.delayMs, 0, MAX_COLLECTION_RUNNER_DELAY_MS),
    iterations: normalizeRunnerInteger(options.iterations, DEFAULT_COLLECTION_RUNNER_OPTIONS.iterations, 1, MAX_COLLECTION_RUNNER_ITERATIONS),
    stopOnFailure: options.stopOnFailure === true,
  };
}

function normalizeRunnerInteger(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) { return fallback; }
  return Math.min(max, Math.max(min, Math.floor(numeric)));
}

function isWebSocketCollectionRequest(request: Pick<Request, 'requestType' | 'url'>): boolean {
  return request.requestType === 'websocket' || /^wss?:\/\//i.test(request.url || '');
}

export function getCollectionRunMethodLabel(request: Pick<Request, 'requestType' | 'method' | 'url'>): string {
  if (isWebSocketCollectionRequest(request)) {
    return 'WS';
  }
  return String(request.method || 'GET').toUpperCase();
}

/** Flatten nested folders in collection-tree order. Identity is CollectionItem.id. */
export function flattenCollectionRunEntries(items: CollectionItem[]): CollectionRunListEntry[] {
  const requests: CollectionRunListEntry[] = [];
  const collect = (list: CollectionItem[], folderPath: string): void => {
    for (const item of list) {
      if (item.type === 'request' && item.request) {
        requests.push({
          id: item.id,
          name: item.name,
          method: getCollectionRunMethodLabel(item.request),
          folderPath,
          request: item.request,
        });
      } else if (item.type === 'folder' && item.children) {
        const nextPath = folderPath ? `${folderPath} / ${item.name}` : item.name;
        collect(item.children, nextPath);
      }
    }
  };
  collect(items, '');
  return requests;
}

/** Keep original flatten order; unknown ids are ignored. */
export function filterCollectionRunEntriesBySelection(
  entries: CollectionRunListEntry[],
  selectedRequestIds?: string[] | null
): CollectionRunListEntry[] {
  if (selectedRequestIds == null) {
    return entries.slice();
  }
  const selected = new Set(
    selectedRequestIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
  );
  return entries.filter((entry) => selected.has(entry.id));
}

export class CollectionRunner {
  private collectionRunAbort = false;
  private activeRunId = 0;
  private stoppedRunIds = new Set<number>();
  private currentCollectionRequest: SendHandle | null = null;
  private currentCollectionDelayCancel: (() => void) | null = null;
  private lastCollectionRunRequests: Array<{ name: string; request: Request }> = [];
  private lastCollectionRunName: string | null = null;
  private lastCollectionRunBaseName: string | null = null;
  private lastCollectionRunOptions: NormalizedCollectionRunnerOptions = { ...DEFAULT_COLLECTION_RUNNER_OPTIONS };

  constructor(
    private readonly httpService: HttpService,
    private readonly host: CollectionRunnerHost
  ) {}

  async runCollection(name: string, items: CollectionItem[], options: CollectionRunnerOptions = {}): Promise<void> {
    const allEntries = flattenCollectionRunEntries(items);
    const selectedEntries = filterCollectionRunEntriesBySelection(allEntries, options.selectedRequestIds);
    if (selectedEntries.length === 0) {
      this.host.showInformationMessage?.(LocalizationService.t('info.noRequestsToRun'));
      return;
    }
    this.lastCollectionRunBaseName = name;
    await this.runCollectionRequests(
      name,
      selectedEntries.map((entry) => ({ name: entry.name, request: entry.request })),
      options,
      {
        collectionTotal: allEntries.length,
        selectedTotal: selectedEntries.length,
      }
    );
  }

  async rerunFailed(failedIndices: number[]): Promise<void> {
    const validIndices = Array.from(new Set(failedIndices.filter((index) => Number.isInteger(index) && index >= 0)));
    if (validIndices.length === 0 || this.lastCollectionRunRequests.length === 0) {
      return;
    }

    const requests = validIndices
      .map((index) => this.lastCollectionRunRequests[index])
      .filter((entry): entry is { name: string; request: Request } => !!entry);

    if (requests.length === 0) {
      return;
    }

    const baseName = this.lastCollectionRunBaseName ?? this.lastCollectionRunName ?? LocalizationService.t('panel.collectionRun');
    const runName = LocalizationService.t('panel.rerunFailedCollectionLabel', {
      name: baseName,
    });
    await this.runCollectionRequests(runName, requests, {
      ...this.lastCollectionRunOptions,
      iterations: 1,
    });
    this.lastCollectionRunBaseName = baseName;
  }

  stop(): void {
    this.collectionRunAbort = true;
    this.stoppedRunIds.add(this.activeRunId);
    this.currentCollectionRequest?.abort();
    this.currentCollectionDelayCancel?.();
    this.currentCollectionDelayCancel = null;
  }

  reset(): void {
    this.stop();
    ++this.activeRunId;
    this.stoppedRunIds.clear();
    this.lastCollectionRunRequests = [];
    this.lastCollectionRunName = null;
    this.lastCollectionRunBaseName = null;
  }

  private async runCollectionRequests(
    name: string,
    requests: Array<{ name: string; request: Request }>,
    rawOptions: CollectionRunnerOptions = {},
    selectionTotals?: CollectionRunSelectionTotals
  ): Promise<void> {
    this.stop();
    const runId = ++this.activeRunId;
    const context = this.host.captureExecutionContext();
    if (!this.host.isExecutionContextCurrent(context)) { return; }
    this.stoppedRunIds.clear();
    this.collectionRunAbort = false;
    this.currentCollectionRequest = null;
    this.currentCollectionDelayCancel = null;
    const options = normalizeCollectionRunnerOptions(rawOptions);
    this.lastCollectionRunOptions = options;
    this.lastCollectionRunName = name;
    this.lastCollectionRunRequests = requests.map(({ name: requestName, request }) => ({
      name: requestName,
      request: {
        ...request,
        headers: cloneKeyValues(request.headers ?? []),
        params: cloneAllKeyValues(request.params ?? []),
        formData: cloneFormDataFields(request.formData ?? []),
        auth: JSON.parse(JSON.stringify(request.auth ?? { type: 'none' })),
        scripts: request.scripts ? { ...request.scripts } : undefined,
      },
    }));
    const collectionTotal = selectionTotals?.collectionTotal ?? requests.length;
    const selectedTotal = selectionTotals?.selectedTotal ?? requests.length;
    this.host.postMessage({
      type: MessageType.RunCollectionStart,
      runId,
      name,
      total: requests.length,
      collectionTotal,
      selectedTotal,
      totalRuns: requests.length * options.iterations,
      iterations: options.iterations,
      delayMs: options.delayMs,
      stopOnFailure: options.stopOnFailure,
    });

    let vars = this.host.getActiveVariables();
    const startTime = Date.now();
    let passed = 0;
    let failed = 0;
    let skipped = 0;
    let completedRuns = 0;
    let stoppedOnFailure = false;
    const totalRuns = requests.length * options.iterations;

    runLoop:
    for (let iterationIndex = 0; iterationIndex < options.iterations; iterationIndex++) {
      for (let requestIndex = 0; requestIndex < requests.length; requestIndex++) {
        if (this.isRunStopped(runId) || !this.host.isExecutionContextCurrent(context)) { break runLoop; }

        const runIndex = completedRuns;
        const result = await this.executeCollectionRequest({
          runId,
          runIndex,
          requestIndex,
          totalRequests: requests.length,
          totalRuns,
          iteration: iterationIndex + 1,
          totalIterations: options.iterations,
          entry: requests[requestIndex],
          vars,
          context,
        });
        if (!result || this.isRunStopped(runId) || !this.host.isExecutionContextCurrent(context)) { break runLoop; }
        vars = result.vars;
        completedRuns++;
        if (result.result.failed) { failed++; } else { passed++; }

        this.host.postMessage({
          type: MessageType.RunCollectionProgress,
          index: runIndex,
          requestIndex,
          total: requests.length,
          totalRuns,
          iteration: iterationIndex + 1,
          totalIterations: options.iterations,
          name: result.result.name,
          method: result.result.method,
          url: result.result.url,
          status: result.result.status,
          statusText: result.result.statusText,
          time: result.result.time,
          error: result.result.error,
          response: result.result.response,
          passed,
          failed,
          skipped,
        });

        if (result.result.failed && options.stopOnFailure) {
          stoppedOnFailure = true;
          skipped = totalRuns - completedRuns;
          break runLoop;
        }

        if (completedRuns < totalRuns && options.delayMs > 0) {
          this.host.postMessage({
            type: 'runCollectionStatus',
            phase: 'delay',
            index: runIndex,
            requestIndex,
            total: requests.length,
            totalRuns,
            iteration: iterationIndex + 1,
            totalIterations: options.iterations,
            name: result.result.name,
            method: result.result.method,
            delayMs: options.delayMs,
          });
          try {
            await this.waitForCollectionRunnerDelay(options.delayMs, runId);
          } catch (err: unknown) {
            if (this.isRunStopped(runId)) { break runLoop; }
            throw err;
          }
        }
      }
    }

    if (runId === this.activeRunId && this.host.isExecutionContextCurrent(context)) {
      this.host.postMessage({
        type: MessageType.RunCollectionDone,
        total: requests.length,
        collectionTotal,
        selectedTotal,
        totalRuns,
        passed,
        failed,
        skipped,
        time: Date.now() - startTime,
        stopped: this.stoppedRunIds.has(runId),
        stoppedOnFailure,
        iterations: options.iterations,
        delayMs: options.delayMs,
        stopOnFailure: options.stopOnFailure,
      });
      this.stoppedRunIds.delete(runId);
      this.collectionRunAbort = false;
    }
  }

  private async executeCollectionRequest(input: {
    runId: number;
    runIndex: number;
    requestIndex: number;
    totalRequests: number;
    totalRuns: number;
    iteration: number;
    totalIterations: number;
    entry: { name: string; request: Request };
    vars: KeyValue[];
    context: ExecutionContext;
  }): Promise<{ result: CollectionRequestRunResult; vars: KeyValue[] } | null> {
    let vars = input.vars;
    const sourceVariables = vars.map((variable) => ({ ...variable }));
    let redactor = new SecretRedactor([]);
    const { name: reqName, request: req } = input.entry;
    const settings = normalizeRequestSettings(req);
    const scripts = normalizeScripts(req.scripts);
    const sourceDefaults = settings.skipDefaultHeaders ? [] : this.host.getDefaultHeaders().map((header) => ({ ...header }));
    const initialMethod = normalizeMethod(req.method);
    const initialBodyType = normalizeBodyType(req.bodyType);
    const requestStartedAt = Date.now();
    let progressMethod = initialMethod;
    let progressUrl = req.url;
    let historyRequest: Request | null = null;
    let requestState = createScriptableRequest({
      method: initialMethod,
      url: req.url,
      headers: req.headers ?? [],
      params: req.params ?? [],
      body: req.body ?? '',
      bodyType: initialBodyType,
      formData: req.formData ?? [],
      binaryFilePath: req.binaryFilePath ?? '',
      auth: req.auth ?? { type: 'none' },
    });

    let response: Response | null = null;
    let error: string | null = null;
    let status = 0;
    let statusText = '';
    let time = 0;
    const isStopped = () => this.isRunStopped(input.runId) || !this.host.isExecutionContextCurrent(input.context);

    try {
      if (isStopped()) { return null; }
      if (isWebSocketCollectionRequest(req)) {
        throw new Error(LocalizationService.t('panel.runnerWebSocketUnsupported'));
      }
      if (isScriptExecutionBlocked(scripts, settings)) {
        throw new Error(LocalizationService.t('panel.importedScriptsBlocked'));
      }
      if (this.host.resolveSecretVariables) {
        const resolved = await this.host.resolveSecretVariables(input.context, sourceVariables,
          requestVariableTexts({ ...requestState, pathVariableOverrides: req.pathVariableOverrides }, sourceDefaults),
          !settings.disableScripts && !!(scripts.preRequest.trim() || scripts.test.trim()));
        if (isStopped()) { return null; }
        vars = resolved.variables;
        redactor = resolved.redactor;
      }
      if (!settings.disableScripts) {
        const preRequestResult = ScriptRunner.runPreRequest(scripts, requestState, vars, this.host.getScriptTimeoutMs());
        requestState = preRequestResult.request;
        if (hasEnvironmentChanges(vars, preRequestResult.envVariables)) {
          this.host.saveEnvironmentChanges(input.context, vars, preRequestResult.envVariables, redactor);
        }
        vars = preRequestResult.envVariables;
      }

      const method = normalizeMethod(requestState.method, initialMethod);
      const bodyType = normalizeBodyType(requestState.bodyType);
      requestState.method = method;
      requestState.bodyType = bodyType;

      const pathVariableOverrides = PathVariableService.pruneOverrides(
        requestState.url,
        req.pathVariableOverrides
      );
      const resolvedUrl = PathVariableService.resolveUrl(requestState.url, pathVariableOverrides, vars);
      if (/^wss?:\/\//i.test(resolvedUrl)) {
        throw new Error(LocalizationService.t('panel.runnerWebSocketUnsupported'));
      }
      const resolvedHeaders = VariableService.resolveKeyValues(requestState.headers, vars);
      const resolvedParams = VariableService.resolveKeyValues(requestState.params, vars);
      const resolvedBody = VariableService.resolve(requestState.body ?? '', vars);
      const resolvedFormData = cloneFormDataFields(requestState.formData ?? []).map((field) => ({
        ...field,
        key: VariableService.resolve(field.key, vars),
        value: VariableService.resolve(field.value, vars),
      }));
      const resolvedBinaryFilePath = VariableService.resolve(requestState.binaryFilePath ?? '', vars);
      const defaultHeaders = VariableService.resolveKeyValues(sourceDefaults, vars);
      const requestKeySet = new Set(
        resolvedHeaders.filter((header) => header.enabled && header.key).map((header) => header.key.toLowerCase())
      );
      const mergedDefaults = defaultHeaders.filter(
        (header) => header.enabled && header.key && !requestKeySet.has(header.key.toLowerCase())
      );
      const finalHeaders = [...mergedDefaults, ...resolvedHeaders];
      const finalParams = coalesceQueryParams(resolvedUrl, resolvedParams);
      const unresolvedVariables = findUnresolvedVariables(
        resolvedUrl,
        finalHeaders,
        finalParams,
        resolvedBody,
        requestState.auth,
        vars
      );
      unresolvedVariables.push(...findPayloadUnresolvedVariables(resolvedFormData, resolvedBinaryFilePath, vars));
      if (unresolvedVariables.length > 0) {
        throw new Error(createUnresolvedVariableError(unresolvedVariables));
      }

      AuthService.applyAuth(requestState.auth, finalHeaders, finalParams, vars);
      const url = buildUrl(resolvedUrl, finalParams);
      progressMethod = method;
      progressUrl = redactor.mask(url);
      const preparedBody = await RequestBodyService.prepare({
        bodyType,
        body: requestState.body ?? '',
        formData: requestState.formData ?? [],
        binaryFilePath: requestState.binaryFilePath ?? '',
        headers: finalHeaders,
        vars,
      });
      if (isStopped()) { return null; }
      const executedRequest = createScriptableRequest({
        method,
        url,
        headers: preparedBody.headers,
        params: finalParams,
        body: preparedBody.resolvedBody,
        bodyType,
        formData: preparedBody.resolvedFormData,
        binaryFilePath: preparedBody.resolvedBinaryFilePath,
        auth: { type: 'none' },
      });
      historyRequest = redactor.hasSecrets
        ? createSecretHistorySnapshot({ ...requestState, method, bodyType, pathVariableOverrides }, sourceDefaults, settings, redactor)
        : createHistoryRequestSnapshot(
        method,
        url,
        preparedBody.headers,
        preparedBody.resolvedBody,
        bodyType,
        preparedBody.resolvedFormData,
        preparedBody.resolvedBinaryFilePath,
        settings
      );

      const totalAttempts = Math.max(1, settings.retryCount + 1);
      const deadline = new RequestDeadline(settings.timeout);
      let sseStarted = false;
      const publishSseUpdate = (update: SseStreamUpdate) => {
        if (update.phase === 'started') { sseStarted = true; }
        const current = input.runId === this.activeRunId && this.host.isExecutionContextCurrent(input.context);
        if (!current || (update.phase !== 'ended' && isStopped())) { return; }
        this.host.postMessage({
          type: MessageType.RunCollectionSseUpdate,
          runId: input.runId,
          index: input.runIndex,
          requestIndex: input.requestIndex,
          iteration: input.iteration,
          name: redactor.mask(reqName),
          update,
        });
      };
      for (let attempt = 0; attempt <= settings.retryCount; attempt++) {
        if (isStopped()) {
          throw new Error('Request was canceled');
        }
        deadline.throwIfExpired();

        this.host.postMessage({
          type: 'runCollectionStatus',
          phase: 'sending',
          index: input.runIndex,
          requestIndex: input.requestIndex,
          total: input.totalRequests,
          totalRuns: input.totalRuns,
          iteration: input.iteration,
          totalIterations: input.totalIterations,
          name: reqName,
          method,
          attempt: attempt + 1,
          totalAttempts,
        });

        const handle = this.httpService.send(
          method,
          url,
          preparedBody.headers,
          preparedBody.data,
          {
            timeoutSec: settings.timeout,
            deadline,
            allowInsecureHttps: this.resolveAllowInsecureHttps(settings.tlsValidation),
            followRedirects: settings.followRedirects,
            maxResponseSizeBytes: settings.maxResponseSizeKb > 0 ? settings.maxResponseSizeKb * 1024 : 0,
            stopAfterHeaders: settings.stopAfterHeaders,
            onSseUpdate: publishSseUpdate,
          }
        );
        this.currentCollectionRequest = handle;
        if (isStopped()) { handle.abort(); }

        try {
          response = await handle.promise;
          if (this.currentCollectionRequest === handle) { this.currentCollectionRequest = null; }
        } catch (err: unknown) {
          if (this.currentCollectionRequest === handle) { this.currentCollectionRequest = null; }
          if (isStopped() || sseStarted || getSseSnapshot(err) || err instanceof RequestTimeoutError || attempt >= settings.retryCount) {
            throw err;
          }
          this.host.postMessage({
            type: 'runCollectionStatus',
            phase: 'retry',
            index: input.runIndex,
            requestIndex: input.requestIndex,
            total: input.totalRequests,
            totalRuns: input.totalRuns,
            iteration: input.iteration,
            totalIterations: input.totalIterations,
            name: reqName,
            method,
            attempt: attempt + 2,
            totalAttempts,
            retryDelayMs: settings.retryDelayMs,
          });
          await this.waitForCollectionRetryDelay(settings.retryDelayMs, input.runId, deadline);
          continue;
        }

        if (isStopped()) { return null; }

        if (response && !sseStarted && !getSseSnapshot(response) && attempt < settings.retryCount && shouldRetryResponse(response.status)) {
          this.host.postMessage({
            type: 'runCollectionStatus',
            phase: 'retry',
            index: input.runIndex,
            requestIndex: input.requestIndex,
            total: input.totalRequests,
            totalRuns: input.totalRuns,
            iteration: input.iteration,
            totalIterations: input.totalIterations,
            name: reqName,
            method,
            attempt: attempt + 2,
            totalAttempts,
            retryDelayMs: settings.retryDelayMs,
          });
          await this.waitForCollectionRetryDelay(settings.retryDelayMs, input.runId, deadline);
          response = null;
          continue;
        }

        break;
      }

      if (!response) {
        throw new Error('Request did not produce a response.');
      }
      if (isStopped()) { return null; }
      deadline.throwIfExpired();
      status = response.status;
      statusText = response.statusText;
      time = response.time;

      if (!settings.disableScripts) {
        const testResult = ScriptRunner.runTests(scripts, executedRequest, response, vars, this.host.getScriptTimeoutMs());
        if (hasEnvironmentChanges(vars, testResult.envVariables)) {
          this.host.saveEnvironmentChanges(input.context, vars, testResult.envVariables, redactor);
        }
        vars = testResult.envVariables;
        const failedTests = testResult.result.tests.filter((test) => !test.passed).length;
        if (failedTests > 0) {
          error = `Tests failed: ${failedTests}`;
        }
      }
    } catch (err: unknown) {
      if (isStopped()) { return null; }
      const partial = getSseSnapshot(err);
      if (partial) {
        response = {
          status: partial.status,
          statusText: partial.statusText,
          headers: partial.headers,
          body: partial.rawBody,
          bodyBase64: partial.rawBodyBase64,
          size: partial.decodedBytes,
          time: partial.time,
          sse: partial,
        };
        status = partial.status;
        statusText = partial.statusText;
        time = partial.time;
      } else if (err instanceof RequestTimeoutError) { response = null; }
      error = secretDiagnostic(err, redactor);
    } finally {
      if (input.runId === this.activeRunId) { this.currentCollectionRequest = null; }
      if (!isStopped() && settings.saveToHistory && historyRequest) {
        this.host.saveToHistory(
          historyRequest,
          response && (!getSseSnapshot(response) || getSseSnapshot(response)!.state === 'completed')
            ? { status: response.status, statusText: response.statusText, time: response.time } : null,
          createRequestTiming(requestStartedAt),
          input.context
        );
        this.host.refreshHistory();
      }
    }

    return {
      vars: this.host.resolveSecretVariables ? reprotectScriptVariables(vars, sourceVariables, redactor) : vars,
      result: {
        name: reqName,
        method: progressMethod,
        url: progressUrl,
        status,
        statusText,
        time,
        error,
        response,
        failed: status >= 400 || !!error,
      },
    };
  }

  private async waitForCollectionRetryDelay(ms: number, runId: number, deadline: RequestDeadline): Promise<void> {
    deadline.throwIfExpired();
    // Node 타이머는 소수를 절삭하므로 남은 예산까지 기다릴 때는 올림한다.
    await this.waitForCancelableDelay(Math.ceil(Math.min(ms, deadline.remainingMs())), runId);
    deadline.throwIfExpired();
  }

  private async waitForCollectionRunnerDelay(ms: number, runId: number): Promise<void> {
    await this.waitForCancelableDelay(ms, runId);
  }

  private async waitForCancelableDelay(ms: number, runId: number): Promise<void> {
    if (ms <= 0) { return; }

    let delayCancel: (() => void) | null = null;
    try {
      await createCancelableDelay(ms, (cancel) => {
        if (cancel) {
          delayCancel = cancel;
          this.currentCollectionDelayCancel = cancel;
        } else if (this.currentCollectionDelayCancel === delayCancel) {
          this.currentCollectionDelayCancel = null;
        }
      });
    } finally {
      if (this.currentCollectionDelayCancel === delayCancel) {
        this.currentCollectionDelayCancel = null;
      }
    }

    if (this.isRunStopped(runId)) {
      throw new Error('Request was canceled');
    }
  }

  private isRunStopped(runId: number): boolean {
    return runId !== this.activeRunId || this.stoppedRunIds.has(runId);
  }

  private resolveAllowInsecureHttps(tlsValidation: Request['tlsValidation']): boolean {
    if (tlsValidation === 'insecure') { return true; }
    if (tlsValidation === 'strict') { return false; }
    return this.host.getAllowInsecureCertificates();
  }
}

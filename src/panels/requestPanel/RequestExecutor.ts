import { HttpService, SendHandle } from '../../services/HttpService';
import { VariableService } from '../../services/VariableService';
import {
  KeyValue,
  MessageType,
  Request,
  Response,
  ScriptExecutionResult,
  SendRequestMessage,
} from '../../models/types';
import { AuthService } from '../../services/AuthService';
import { RequestBodyService } from '../../services/RequestBodyService';
import { ScriptRunner } from '../../services/ScriptRunner';
import { LocalizationService } from '../../services/LocalizationService';
import {
  buildUrl,
  cloneFormDataFields,
  createCancelableDelay,
  createHistoryRequestSnapshot,
  createRequestTiming,
  createScriptableRequest,
  createUnresolvedVariableError,
  findPayloadUnresolvedVariables,
  findUnresolvedVariables,
  isScriptExecutionBlocked,
  normalizeBodyType,
  normalizeEpochMs,
  normalizeMethod,
  normalizeRequestSettings,
  normalizeScripts,
  RequestTiming,
  shouldRetryResponse,
} from './requestUtils';

export interface RequestExecutorHost {
  postMessage(message: unknown): void;
  getActiveVariables(): KeyValue[];
  getDefaultHeaders(): KeyValue[];
  getAllowInsecureCertificates(): boolean;
  saveActiveEnvironmentVariables(variables: KeyValue[]): void;
  saveToHistory(
    request: Request,
    response: { status: number; statusText: string; time: number } | null,
    timing?: RequestTiming
  ): void;
  refreshHistory(): void;
}

export class RequestExecutor {
  private nextRunId = 1;
  private readonly canceledRequestRuns = new Set<string>();
  private readonly activeRequests = new Map<string, { runId: number; abort: () => void }>();

  constructor(
    private readonly httpService: HttpService,
    private readonly host: RequestExecutorHost
  ) {}

  cancel(tabId: string): void {
    const handle = this.activeRequests.get(tabId);
    if (!handle) { return; }
    this.canceledRequestRuns.add(this.getRunKey(tabId, handle.runId));
    handle.abort();
  }

  async execute(message: SendRequestMessage): Promise<void> {
    const tabId = message.tabId;
    const runId = this.nextRunId++;
    const runKey = this.getRunKey(tabId, runId);
    const requestStartedAt = normalizeEpochMs(message.requestStartedAt) ?? Date.now();
    const initialMethod = normalizeMethod(message.method);
    const initialBodyType = normalizeBodyType(message.bodyType);
    const settings = normalizeRequestSettings(message);
    const scripts = normalizeScripts(message.scripts);
    let vars = this.host.getActiveVariables();
    let requestState = createScriptableRequest({
      method: initialMethod,
      url: message.url,
      headers: message.headers ?? [],
      params: message.params ?? [],
      body: message.body ?? '',
      bodyType: initialBodyType,
      formData: message.formData ?? [],
      binaryFilePath: message.binaryFilePath ?? '',
      auth: message.auth ?? { type: 'none' },
    });

    if (isScriptExecutionBlocked(scripts, settings)) {
      this.postTimedResponseError(tabId, LocalizationService.t('panel.importedScriptsBlocked'), requestStartedAt);
      return;
    }

    if (!settings.disableScripts) {
      try {
        const preRequestResult = ScriptRunner.runPreRequest(scripts, requestState, vars);
        requestState = preRequestResult.request;
        vars = preRequestResult.envVariables;
        this.host.saveActiveEnvironmentVariables(vars);
      } catch (err: unknown) {
        this.postTimedResponseError(tabId, err instanceof Error ? err.message : String(err), requestStartedAt);
        return;
      }
    }

    const method = normalizeMethod(requestState.method, initialMethod);
    const bodyType = normalizeBodyType(requestState.bodyType);
    requestState.method = method;
    requestState.bodyType = bodyType;

    const resolvedUrl = VariableService.resolve(requestState.url, vars);
    const resolvedHeaders = VariableService.resolveKeyValues(requestState.headers, vars);
    const resolvedParams = VariableService.resolveKeyValues(requestState.params, vars);
    const resolvedBody = VariableService.resolve(requestState.body ?? '', vars);
    const resolvedFormData = cloneFormDataFields(requestState.formData ?? []).map((field) => ({
      ...field,
      key: VariableService.resolve(field.key, vars),
      value: VariableService.resolve(field.value, vars),
    }));
    const resolvedBinaryFilePath = VariableService.resolve(requestState.binaryFilePath ?? '', vars);

    const defaultHeaders = settings.skipDefaultHeaders
      ? []
      : VariableService.resolveKeyValues(this.host.getDefaultHeaders(), vars);
    const requestKeySet = new Set(
      resolvedHeaders.filter((header) => header.enabled && header.key).map((header) => header.key.toLowerCase())
    );
    const mergedDefaults = defaultHeaders.filter(
      (header) => header.enabled && header.key && !requestKeySet.has(header.key.toLowerCase())
    );
    const finalHeaders = [...mergedDefaults, ...resolvedHeaders];
    const finalParams = [...resolvedParams];
    const unresolvedVariables = findUnresolvedVariables(
      resolvedUrl,
      finalHeaders,
      finalParams,
      resolvedBody,
      requestState.auth,
      vars
    );
    unresolvedVariables.push(...findPayloadUnresolvedVariables(resolvedFormData, resolvedBinaryFilePath));
    if (unresolvedVariables.length > 0) {
      this.postTimedResponseError(tabId, createUnresolvedVariableError(unresolvedVariables), requestStartedAt);
      return;
    }

    AuthService.applyAuth(requestState.auth, finalHeaders, finalParams, vars);

    let url: string;
    try {
      url = buildUrl(resolvedUrl, finalParams);
    } catch {
      this.postTimedResponseError(tabId, `Invalid URL: ${resolvedUrl}`, requestStartedAt);
      return;
    }

    let preparedBody: Awaited<ReturnType<typeof RequestBodyService.prepare>>;
    try {
      preparedBody = await RequestBodyService.prepare({
        bodyType,
        body: requestState.body ?? '',
        formData: requestState.formData ?? [],
        binaryFilePath: requestState.binaryFilePath ?? '',
        headers: finalHeaders,
        vars,
      });
    } catch (err: unknown) {
      this.postTimedResponseError(tabId, err instanceof Error ? err.message : String(err), requestStartedAt);
      return;
    }

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

    let currentHandle: SendHandle | null = null;
    let cancelDelay: (() => void) | null = null;
    this.activeRequests.set(tabId, {
      runId,
      abort: () => {
        currentHandle?.abort();
        cancelDelay?.();
      },
    });

    try {
      let response: Response | null = null;
      for (let attempt = 0; attempt <= settings.retryCount; attempt++) {
        currentHandle = this.httpService.send(
          method,
          url,
          preparedBody.headers,
          preparedBody.data,
          {
            timeoutSec: settings.timeout,
            allowInsecureHttps: this.resolveAllowInsecureHttps(settings.tlsValidation),
            followRedirects: settings.followRedirects,
            maxResponseSizeBytes: settings.maxResponseSizeKb > 0 ? settings.maxResponseSizeKb * 1024 : 0,
            stopAfterHeaders: settings.stopAfterHeaders,
          }
        );

        try {
          response = await currentHandle.promise;
          currentHandle = null;
        } catch (err: unknown) {
          currentHandle = null;
          if (this.canceledRequestRuns.has(runKey) || attempt >= settings.retryCount) {
            throw err;
          }
          await createCancelableDelay(settings.retryDelayMs, (cancel) => {
            cancelDelay = cancel;
          });
          cancelDelay = null;
          continue;
        }

        if (response && attempt < settings.retryCount && shouldRetryResponse(response.status)) {
          await createCancelableDelay(settings.retryDelayMs, (cancel) => {
            cancelDelay = cancel;
          });
          cancelDelay = null;
          response = null;
          continue;
        }

        if (response) {
          break;
        }
      }

      if (this.canceledRequestRuns.delete(runKey)) {
        if (this.isCurrentRun(tabId, runId)) {
          this.host.postMessage({
            type: MessageType.RequestCanceled,
            tabId,
            ...createRequestTiming(requestStartedAt),
          });
        }
        return;
      }
      if (!response) {
        throw new Error('Request did not produce a response.');
      }
      if (!this.isCurrentRun(tabId, runId)) { return; }

      const responseTiming = createRequestTiming(requestStartedAt);
      let scriptResults: ScriptExecutionResult | undefined;
      if (!settings.disableScripts) {
        try {
          const testResult = ScriptRunner.runTests(scripts, executedRequest, response, vars);
          vars = testResult.envVariables;
          this.host.saveActiveEnvironmentVariables(vars);
          scriptResults = testResult.result;
        } catch (err: unknown) {
          scriptResults = {
            logs: [],
            tests: [{
              name: LocalizationService.t('webview.testScript'),
              passed: false,
              error: err instanceof Error ? err.message : String(err),
            }],
          };
        }
      }

      if (settings.saveToHistory) {
        this.host.saveToHistory(
          createHistoryRequestSnapshot(
            method,
            url,
            preparedBody.headers,
            preparedBody.resolvedBody,
            bodyType,
            preparedBody.resolvedFormData,
            preparedBody.resolvedBinaryFilePath,
            settings
          ),
          { status: response.status, statusText: response.statusText, time: response.time },
          responseTiming
        );
        this.host.refreshHistory();
      }

      const resolvedHeaderPairs = preparedBody.headers
        .filter((header) => header.enabled && header.key)
        .map((header) => ({ key: header.key, value: header.value }));

      this.host.postMessage({
        type: MessageType.ReceiveResponse,
        tabId,
        response,
        resolvedUrl: url,
        resolvedHeaders: resolvedHeaderPairs,
        scriptResults,
        ...responseTiming,
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const wasCanceled = this.canceledRequestRuns.delete(runKey);
      const errorTiming = createRequestTiming(requestStartedAt);

      if (wasCanceled) {
        if (this.isCurrentRun(tabId, runId)) {
          this.host.postMessage({
            type: MessageType.RequestCanceled,
            tabId,
            ...errorTiming,
          });
        }
        return;
      }

      if (!this.isCurrentRun(tabId, runId)) { return; }

      if (settings.saveToHistory) {
        this.host.saveToHistory(
          createHistoryRequestSnapshot(
            method,
            url,
            preparedBody.headers,
            preparedBody.resolvedBody,
            bodyType,
            preparedBody.resolvedFormData,
            preparedBody.resolvedBinaryFilePath,
            settings
          ),
          null,
          errorTiming
        );
        this.host.refreshHistory();
      }

      this.host.postMessage({
        type: MessageType.ResponseError,
        tabId,
        error: errorMsg,
        ...errorTiming,
      });
    } finally {
      cancelDelay = null;
      if (this.isCurrentRun(tabId, runId)) {
        this.activeRequests.delete(tabId);
      }
    }
  }

  private getRunKey(tabId: string, runId: number): string {
    return `${tabId}:${runId}`;
  }

  private isCurrentRun(tabId: string, runId: number): boolean {
    return this.activeRequests.get(tabId)?.runId === runId;
  }

  private postTimedResponseError(tabId: string, error: string, startedAt?: number): void {
    this.host.postMessage({
      type: MessageType.ResponseError,
      tabId,
      error,
      ...createRequestTiming(startedAt),
    });
  }

  private resolveAllowInsecureHttps(tlsValidation: Request['tlsValidation']): boolean {
    if (tlsValidation === 'insecure') { return true; }
    if (tlsValidation === 'strict') { return false; }
    return this.host.getAllowInsecureCertificates();
  }
}

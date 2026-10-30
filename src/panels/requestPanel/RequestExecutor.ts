import { HttpService, SendHandle } from '../../services/HttpService';
import { RequestDeadline, RequestTimeoutError } from '../../services/RequestDeadline';
import { getSseSnapshot, SseStreamUpdate } from '../../services/SseStream';
import { VariableService } from '../../services/VariableService';
import { PathVariableService } from '../../services/PathVariableService';
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
import { ExecutionContext, hasEnvironmentChanges } from './executionContext';
import { SecretRedactor } from '../../services/secretVariables';
import { SecretExecutionHost, requestVariableTexts, secretDiagnostic, createSecretHistorySnapshot } from './secretExecution';
import {
  buildUrl,
  cloneFormDataFields,
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
  normalizeEpochMs,
  normalizeMethod,
  normalizeRequestSettings,
  normalizeScripts,
  RequestTiming,
  shouldRetryResponse,
} from './requestUtils';

export interface RequestExecutorHost extends SecretExecutionHost {
  captureExecutionContext(): ExecutionContext;
  isExecutionContextCurrent(context: ExecutionContext): boolean;
  postMessage(message: unknown): void;
  getActiveVariables(): KeyValue[];
  getDefaultHeaders(): KeyValue[];
  getAllowInsecureCertificates(): boolean;
  getScriptTimeoutMs(): number;
  saveEnvironmentChanges(context: ExecutionContext, before: KeyValue[], after: KeyValue[], redactor?: SecretRedactor): void;
  saveToHistory(
    request: Request,
    response: { status: number; statusText: string; time: number } | null,
    timing: RequestTiming | undefined,
    context: ExecutionContext
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

  cancelAll(): void {
    for (const tabId of this.activeRequests.keys()) { this.cancel(tabId); }
    this.activeRequests.clear();
    this.canceledRequestRuns.clear();
  }

  async execute(message: SendRequestMessage): Promise<void> {
    const tabId = message.tabId;
    this.cancel(tabId);
    const runId = this.nextRunId++;
    const runKey = this.getRunKey(tabId, runId);
    const context = this.host.captureExecutionContext();
    const requestStartedAt = normalizeEpochMs(message.requestStartedAt) ?? Date.now();
    let currentHandle: SendHandle | null = null;
    let cancelDelay: (() => void) | null = null;
    this.activeRequests.set(tabId, {
      runId,
      abort: () => { currentHandle?.abort(); cancelDelay?.(); },
    });
    const canPublish = () => this.isCurrentRun(tabId, runId) && this.host.isExecutionContextCurrent(context);
    const wasCanceled = () => this.canceledRequestRuns.has(runKey) || !canPublish();
    const publishCancellation = () => {
      if (canPublish()) {
        this.host.postMessage({ type: MessageType.RequestCanceled, tabId, ...createRequestTiming(requestStartedAt) });
      }
    };
    let redactor = new SecretRedactor([]);
    try {
      if (!canPublish()) { return; }
      const initialMethod = normalizeMethod(message.method);
      const initialBodyType = normalizeBodyType(message.bodyType);
      const settings = normalizeRequestSettings(message);
      const scripts = normalizeScripts(message.scripts);
      let vars = this.host.getActiveVariables();
      const sourceVariables = vars.map((variable) => ({ ...variable }));
      const sourceDefaults = settings.skipDefaultHeaders ? [] : this.host.getDefaultHeaders().map((header) => ({ ...header }));
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

      if (this.host.resolveSecretVariables) {
        const resolved = await this.host.resolveSecretVariables(context, sourceVariables,
          requestVariableTexts({ ...requestState, pathVariableOverrides: message.pathVariableOverrides }, sourceDefaults),
          !settings.disableScripts && !!(scripts.preRequest.trim() || scripts.test.trim()));
        if (wasCanceled()) { publishCancellation(); return; }
        vars = resolved.variables;
        redactor = resolved.redactor;
      }

      if (!settings.disableScripts) {
        try {
          const preRequestResult = ScriptRunner.runPreRequest(scripts, requestState, vars, this.host.getScriptTimeoutMs());
          requestState = preRequestResult.request;
          if (hasEnvironmentChanges(vars, preRequestResult.envVariables)) {
            this.host.saveEnvironmentChanges(context, vars, preRequestResult.envVariables, redactor);
          }
          vars = preRequestResult.envVariables;
        } catch (err: unknown) {
          this.postTimedResponseError(tabId, secretDiagnostic(err, redactor), requestStartedAt);
          return;
        }
      }

      const method = normalizeMethod(requestState.method, initialMethod);
      const bodyType = normalizeBodyType(requestState.bodyType);
      requestState.method = method;
      requestState.bodyType = bodyType;

      const pathVariableOverrides = PathVariableService.pruneOverrides(
        requestState.url,
        message.pathVariableOverrides
      );
      const resolvedUrl = PathVariableService.resolveUrl(requestState.url, pathVariableOverrides, vars);
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
        this.postTimedResponseError(tabId, createUnresolvedVariableError(unresolvedVariables), requestStartedAt);
        return;
      }

      const credentialHeaderNames = AuthService.applyAuth(requestState.auth, finalHeaders, finalParams, vars);

      let url: string;
      try {
        url = buildUrl(resolvedUrl, finalParams);
      } catch {
        this.postTimedResponseError(tabId, redactor.mask(`Invalid URL: ${resolvedUrl}`), requestStartedAt);
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
        if (wasCanceled()) { publishCancellation(); return; }
        this.postTimedResponseError(tabId, secretDiagnostic(err, redactor), requestStartedAt);
        return;
      }

      if (wasCanceled()) { publishCancellation(); return; }

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
      const historySnapshot = redactor.hasSecrets
        ? createSecretHistorySnapshot({ ...requestState, method, bodyType, pathVariableOverrides }, sourceDefaults, settings, redactor)
        : createHistoryRequestSnapshot(method, url, preparedBody.headers, preparedBody.resolvedBody, bodyType,
          preparedBody.resolvedFormData, preparedBody.resolvedBinaryFilePath, settings);

      try {
        let response: Response | null = null;
        let sseStarted = false;
        const publishSseUpdate = (update: SseStreamUpdate) => {
          if (update.phase === 'started') { sseStarted = true; }
          // Stop의 terminal partial은 같은 실행에 전달하고, 이전 세대/새 실행에는 버린다.
          if (!canPublish() || (update.phase !== 'ended' && wasCanceled())) { return; }
          this.host.postMessage({
            type: MessageType.ReceiveSseUpdate,
            tabId,
            runId,
            requestStartedAt,
            update,
          });
        };
        const deadline = new RequestDeadline(settings.timeout);
        const waitForRetryDelay = async () => {
          deadline.throwIfExpired();
          try {
            // Node 타이머의 소수 절삭으로 예산 만료 직전에 다음 시도가 시작되지 않게 한다.
            await createCancelableDelay(Math.ceil(Math.min(settings.retryDelayMs, deadline.remainingMs())), (cancel) => {
              cancelDelay = cancel;
            });
          } finally {
            cancelDelay = null;
          }
          if (wasCanceled()) { throw new Error('Request was canceled'); }
          deadline.throwIfExpired();
        };
        for (let attempt = 0; attempt <= settings.retryCount; attempt++) {
          if (wasCanceled()) { publishCancellation(); return; }
          deadline.throwIfExpired();
          currentHandle = this.httpService.send(
            method,
            url,
            preparedBody.headers,
            preparedBody.data,
            {
              timeoutSec: settings.timeout,
              deadline,
              allowInsecureHttps: this.resolveAllowInsecureHttps(settings.tlsValidation),
              followRedirects: settings.followRedirects,
              credentialHeaderNames,
              maxResponseSizeBytes: settings.maxResponseSizeKb > 0 ? settings.maxResponseSizeKb * 1024 : 0,
              stopAfterHeaders: settings.stopAfterHeaders,
              onSseUpdate: publishSseUpdate,
            }
          );
          if (wasCanceled()) { currentHandle.abort(); }

          try {
            response = await currentHandle.promise;
            currentHandle = null;
          } catch (err: unknown) {
            currentHandle = null;
            if (wasCanceled() || sseStarted || getSseSnapshot(err) || err instanceof RequestTimeoutError || attempt >= settings.retryCount) {
              throw err;
            }
            await waitForRetryDelay();
            continue;
          }

          if (wasCanceled()) { publishCancellation(); return; }

          if (response && !sseStarted && !getSseSnapshot(response) && attempt < settings.retryCount && shouldRetryResponse(response.status)) {
            await waitForRetryDelay();
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
        if (!canPublish()) { return; }
        deadline.throwIfExpired();

        const responseTiming = createRequestTiming(requestStartedAt);
        let scriptResults: ScriptExecutionResult | undefined;
        if (!settings.disableScripts) {
          try {
            const testResult = ScriptRunner.runTests(scripts, executedRequest, response, vars, this.host.getScriptTimeoutMs());
            if (hasEnvironmentChanges(vars, testResult.envVariables)) {
              this.host.saveEnvironmentChanges(context, vars, testResult.envVariables, redactor);
            }
            vars = testResult.envVariables;
            scriptResults = testResult.result;
          } catch (err: unknown) {
            scriptResults = {
              logs: [],
              tests: [{
                name: LocalizationService.t('webview.testScript'),
                passed: false,
                error: secretDiagnostic(err, redactor),
              }],
            };
          }
        }

        if (settings.saveToHistory) {
          this.host.saveToHistory(
            historySnapshot,
            { status: response.status, statusText: response.statusText, time: response.time },
            responseTiming,
            context
          );
          this.host.refreshHistory();
        }

        const resolvedHeaderPairs = preparedBody.headers
          .filter((header) => header.enabled && header.key)
          .map((header) => ({
            key: header.key,
            // Basic의 username:password 결합 인코딩은 개별 비밀값의 인코딩과 다르다.
            value: redactor.hasSecrets && header.key.toLowerCase() === 'authorization' && /^Basic\s/i.test(header.value)
              ? 'Basic [secret]' : header.value,
          }));

        this.host.postMessage({
          type: MessageType.ReceiveResponse,
          tabId,
          response,
          resolvedUrl: redactor.mask(url),
          resolvedHeaders: redactor.map(resolvedHeaderPairs),
          scriptResults: redactor.map(scriptResults),
          ...responseTiming,
        });
      } catch (err: unknown) {
        const errorMsg = secretDiagnostic(err, redactor);
        const wasCanceled = this.canceledRequestRuns.delete(runKey);
        const errorTiming = createRequestTiming(requestStartedAt);

        if (wasCanceled) {
          if (canPublish()) {
            this.host.postMessage({
              type: MessageType.RequestCanceled,
              tabId,
              ...errorTiming,
            });
          }
          return;
        }

        if (!canPublish()) { return; }

        if (settings.saveToHistory) {
          this.host.saveToHistory(
            historySnapshot,
            null,
            errorTiming,
            context
          );
          this.host.refreshHistory();
        }

        this.host.postMessage({
          type: MessageType.ResponseError,
          tabId,
          error: errorMsg,
          ...errorTiming,
        });
      }
    } catch (error: unknown) {
      if (wasCanceled()) { publishCancellation(); return; }
      this.postTimedResponseError(tabId, secretDiagnostic(error, redactor), requestStartedAt);
    } finally {
      cancelDelay = null;
      this.canceledRequestRuns.delete(runKey);
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

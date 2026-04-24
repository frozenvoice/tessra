import * as vscode from 'vscode';
import { HttpService, SendHandle } from '../../services/HttpService';
import { VariableService } from '../../services/VariableService';
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
import {
  buildUrl,
  cloneFormDataFields,
  cloneKeyValues,
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

export interface CollectionRunnerHost {
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

export class CollectionRunner {
  private collectionRunAbort = false;
  private currentCollectionRequest: SendHandle | null = null;
  private currentCollectionDelayCancel: (() => void) | null = null;
  private lastCollectionRunRequests: Array<{ name: string; request: Request }> = [];
  private lastCollectionRunName: string | null = null;
  private lastCollectionRunBaseName: string | null = null;

  constructor(
    private readonly httpService: HttpService,
    private readonly host: CollectionRunnerHost
  ) {}

  async runCollection(name: string, items: CollectionItem[]): Promise<void> {
    const requests = this.flattenCollectionRequests(items);
    if (requests.length === 0) {
      vscode.window.showInformationMessage(LocalizationService.t('info.noRequestsToRun'));
      return;
    }
    this.lastCollectionRunBaseName = name;
    await this.runCollectionRequests(name, requests);
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
    await this.runCollectionRequests(runName, requests);
    this.lastCollectionRunBaseName = baseName;
  }

  stop(): void {
    this.collectionRunAbort = true;
    this.currentCollectionRequest?.abort();
    this.currentCollectionDelayCancel?.();
    this.currentCollectionDelayCancel = null;
  }

  private flattenCollectionRequests(items: CollectionItem[]): Array<{ name: string; request: Request }> {
    const requests: { name: string; request: Request }[] = [];
    const collect = (list: CollectionItem[]) => {
      for (const item of list) {
        if (item.type === 'request' && item.request) {
          requests.push({ name: item.name, request: item.request });
        } else if (item.type === 'folder' && item.children) {
          collect(item.children);
        }
      }
    };
    collect(items);
    return requests;
  }

  private async runCollectionRequests(name: string, requests: Array<{ name: string; request: Request }>): Promise<void> {
    this.collectionRunAbort = false;
    this.currentCollectionRequest = null;
    this.lastCollectionRunName = name;
    this.lastCollectionRunRequests = requests.map(({ name: requestName, request }) => ({
      name: requestName,
      request: {
        ...request,
        headers: cloneKeyValues(request.headers ?? []),
        params: cloneKeyValues(request.params ?? []),
        formData: cloneFormDataFields(request.formData ?? []),
        auth: JSON.parse(JSON.stringify(request.auth ?? { type: 'none' })),
        scripts: request.scripts ? { ...request.scripts } : undefined,
      },
    }));
    this.host.postMessage({
      type: MessageType.RunCollectionStart,
      name,
      total: requests.length,
    });

    let vars = this.host.getActiveVariables();
    const startTime = Date.now();
    let passed = 0;
    let failed = 0;

    for (let i = 0; i < requests.length; i++) {
      if (this.collectionRunAbort) { break; }

      const { name: reqName, request: req } = requests[i];
      const settings = normalizeRequestSettings(req);
      const scripts = normalizeScripts(req.scripts);
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

      try {
        if (isScriptExecutionBlocked(scripts, settings)) {
          throw new Error(LocalizationService.t('panel.importedScriptsBlocked'));
        }
        if (!settings.disableScripts) {
          const preRequestResult = ScriptRunner.runPreRequest(scripts, requestState, vars);
          requestState = preRequestResult.request;
          vars = preRequestResult.envVariables;
          this.host.saveActiveEnvironmentVariables(vars);
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
          throw new Error(createUnresolvedVariableError(unresolvedVariables));
        }

        AuthService.applyAuth(requestState.auth, finalHeaders, finalParams, vars);
        const url = buildUrl(resolvedUrl, finalParams);
        progressMethod = method;
        progressUrl = url;
        const preparedBody = await RequestBodyService.prepare({
          bodyType,
          body: requestState.body ?? '',
          formData: requestState.formData ?? [],
          binaryFilePath: requestState.binaryFilePath ?? '',
          headers: finalHeaders,
          vars,
        });
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
        historyRequest = createHistoryRequestSnapshot(
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
        for (let attempt = 0; attempt <= settings.retryCount; attempt++) {
          if (this.collectionRunAbort) {
            throw new Error('Request was canceled');
          }

          this.host.postMessage({
            type: 'runCollectionStatus',
            phase: 'sending',
            index: i,
            total: requests.length,
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
              allowInsecureHttps: this.resolveAllowInsecureHttps(settings.tlsValidation),
              followRedirects: settings.followRedirects,
              maxResponseSizeBytes: settings.maxResponseSizeKb > 0 ? settings.maxResponseSizeKb * 1024 : 0,
              stopAfterHeaders: settings.stopAfterHeaders,
            }
          );
          this.currentCollectionRequest = handle;

          try {
            response = await handle.promise;
            this.currentCollectionRequest = null;
          } catch (err: unknown) {
            this.currentCollectionRequest = null;
            if (this.collectionRunAbort || attempt >= settings.retryCount) {
              throw err;
            }
            this.host.postMessage({
              type: 'runCollectionStatus',
              phase: 'retry',
              index: i,
              total: requests.length,
              name: reqName,
              method,
              attempt: attempt + 2,
              totalAttempts,
              retryDelayMs: settings.retryDelayMs,
            });
            await this.waitForCollectionRetryDelay(settings.retryDelayMs);
            continue;
          }

          if (response && attempt < settings.retryCount && shouldRetryResponse(response.status)) {
            this.host.postMessage({
              type: 'runCollectionStatus',
              phase: 'retry',
              index: i,
              total: requests.length,
              name: reqName,
              method,
              attempt: attempt + 2,
              totalAttempts,
              retryDelayMs: settings.retryDelayMs,
            });
            await this.waitForCollectionRetryDelay(settings.retryDelayMs);
            response = null;
            continue;
          }

          break;
        }

        if (!response) {
          throw new Error('Request did not produce a response.');
        }
        status = response.status;
        statusText = response.statusText;
        time = response.time;

        if (!settings.disableScripts) {
          const testResult = ScriptRunner.runTests(scripts, executedRequest, response, vars);
          vars = testResult.envVariables;
          this.host.saveActiveEnvironmentVariables(vars);
          const failedTests = testResult.result.tests.filter((test) => !test.passed).length;
          if (failedTests > 0) {
            error = `Tests failed: ${failedTests}`;
          }
        }

        if (status >= 400 || error) { failed++; } else { passed++; }
      } catch (err: unknown) {
        if (this.collectionRunAbort) { break; }
        error = err instanceof Error ? err.message : String(err);
        failed++;
      } finally {
        this.currentCollectionRequest = null;
        if (!this.collectionRunAbort && settings.saveToHistory && historyRequest) {
          this.host.saveToHistory(
            historyRequest,
            response ? { status: response.status, statusText: response.statusText, time: response.time } : null,
            createRequestTiming(requestStartedAt)
          );
          this.host.refreshHistory();
        }
      }

      this.host.postMessage({
        type: MessageType.RunCollectionProgress,
        index: i,
        total: requests.length,
        name: reqName,
        method: progressMethod,
        url: progressUrl,
        status,
        statusText,
        time,
        error,
        response,
        passed,
        failed,
      });
    }

    this.host.postMessage({
      type: MessageType.RunCollectionDone,
      total: requests.length,
      passed,
      failed,
      time: Date.now() - startTime,
      stopped: this.collectionRunAbort,
    });
  }

  private async waitForCollectionRetryDelay(ms: number): Promise<void> {
    if (ms <= 0) { return; }

    try {
      await createCancelableDelay(ms, (cancel) => {
        this.currentCollectionDelayCancel = cancel;
      });
    } finally {
      this.currentCollectionDelayCancel = null;
    }
  }

  private resolveAllowInsecureHttps(tlsValidation: Request['tlsValidation']): boolean {
    if (tlsValidation === 'insecure') { return true; }
    if (tlsValidation === 'strict') { return false; }
    return this.host.getAllowInsecureCertificates();
  }
}

import * as vm from 'vm';
import { randomUUID } from 'crypto';
import {
  AuthConfig,
  FormDataField,
  HttpMethod,
  KeyValue,
  RequestBodyType,
  RequestScripts,
  Response,
  ScriptExecutionResult,
  ScriptLogEntry,
} from '../models/types';
import { createScriptRealmBootstrap } from './scriptRealmBootstrap';

export interface ScriptableRequest {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: RequestBodyType;
  formData: FormDataField[];
  binaryFilePath: string;
  auth: AuthConfig;
}

interface ScriptRunState {
  logs: ScriptLogEntry[];
  tests: ScriptExecutionResult['tests'];
}

interface ScriptRealmSnapshot {
  request: ScriptableRequest;
  envVariables: KeyValue[];
  state: ScriptRunState;
}

interface ScriptRealmExecutionState {
  state: 'idle' | 'running' | 'capturing' | 'captured' | 'awaiting';
  message: string;
}

// pre-request/test 스크립트 실행기
export class ScriptRunner {
  static readonly DEFAULT_TIMEOUT_MS = 3000;
  static readonly MIN_TIMEOUT_MS = 100;
  static readonly MAX_TIMEOUT_MS = 30000;
  static readonly UUID_POOL_SIZE = 256;

  static normalizeTimeoutMs(value: unknown): number {
    const numeric = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numeric)) { return ScriptRunner.DEFAULT_TIMEOUT_MS; }
    return Math.min(
      ScriptRunner.MAX_TIMEOUT_MS,
      Math.max(ScriptRunner.MIN_TIMEOUT_MS, Math.floor(numeric))
    );
  }

  static runPreRequest(
    scripts: RequestScripts,
    request: ScriptableRequest,
    envVariables: KeyValue[],
    timeoutMs = ScriptRunner.DEFAULT_TIMEOUT_MS
  ): { request: ScriptableRequest; envVariables: KeyValue[]; result: ScriptExecutionResult } {
    const script = scripts.preRequest?.trim();
    const clonedRequest = this.cloneRequest(request);
    const clonedEnvVariables = this.cloneEnvVariables(envVariables);

    if (!script) {
      return { request: clonedRequest, envVariables: clonedEnvVariables, result: { logs: [], tests: [] } };
    }

    const snapshot = this.execute(script, {
      request: clonedRequest,
      envVariables: clonedEnvVariables,
      response: undefined,
    }, timeoutMs);

    return { request: snapshot.request, envVariables: snapshot.envVariables, result: snapshot.state };
  }

  static runTests(
    scripts: RequestScripts,
    request: ScriptableRequest,
    response: Response,
    envVariables: KeyValue[],
    timeoutMs = ScriptRunner.DEFAULT_TIMEOUT_MS
  ): { envVariables: KeyValue[]; result: ScriptExecutionResult } {
    const script = scripts.test?.trim();
    const clonedEnvVariables = this.cloneEnvVariables(envVariables);

    if (!script) {
      return { envVariables: clonedEnvVariables, result: { logs: [], tests: [] } };
    }

    const snapshot = this.execute(script, {
      request: this.cloneRequest(request),
      envVariables: clonedEnvVariables,
      response,
    }, timeoutMs);

    return { envVariables: snapshot.envVariables, result: snapshot.state };
  }

  private static execute(
    source: string,
    contextData: {
      request: ScriptableRequest;
      envVariables: KeyValue[];
      response?: Response;
    },
    timeoutMs: number
  ): ScriptRealmSnapshot {
    const normalizedTimeoutMs = ScriptRunner.normalizeTimeoutMs(timeoutMs);
    const serializedInput = JSON.stringify({
      request: this.cloneRequest(contextData.request),
      envVariables: this.cloneEnvVariables(contextData.envVariables),
      response: contextData.response ? this.cloneResponse(contextData.response) : undefined,
      uuidPool: Array.from({ length: ScriptRunner.UUID_POOL_SIZE }, () => randomUUID()),
    });
    const context = vm.createContext(Object.create(null) as Record<string, unknown>, {
      codeGeneration: { strings: false, wasm: false },
      microtaskMode: 'afterEvaluate',
    });

    try {
      new vm.Script(createScriptRealmBootstrap(serializedInput)).runInContext(context, {
        timeout: normalizedTimeoutMs,
      });
    } catch {
      throw new Error('Script execution failed: Script runtime initialization failed.');
    }

    const wrappedSource = [
      '__tessraMarkExecutionStarted();',
      'try {',
      source,
      '} catch (__tessraCaughtError) {',
      '  __tessraCaptureExecutionError(__tessraCaughtError);',
      '}',
      '__tessraMarkAwaitingMicrotasks();',
    ].join('\n');

    let compiledScript: vm.Script;
    try {
      compiledScript = new vm.Script(wrappedSource);
    } catch (error: unknown) {
      // 컴파일 단계에는 사용자 코드가 실행되지 않아 호스트의 구문 오류만 읽는다.
      const message = error instanceof Error ? error.message : 'Invalid JavaScript syntax.';
      throw new Error(`Script execution failed: ${message}`);
    }

    try {
      compiledScript.runInContext(context, {
        timeout: normalizedTimeoutMs,
      });
    } catch {
      // 사용자 예외는 realm 안에서 잡는다. 평가와 microtask 배수가 중단되면 결과를 다시 평가하지 않는다.
      throw new Error(`Script execution timed out after ${normalizedTimeoutMs} ms`);
    }

    const executionState = this.readScriptRealmExecutionState(context, normalizedTimeoutMs);
    if (executionState?.state === 'captured') {
      throw new Error(`Script execution failed: ${executionState.message || 'Unknown script error'}`);
    }
    if (executionState?.state !== 'awaiting') {
      throw new Error('Script execution failed: Script did not complete.');
    }

    try {
      const serializedOutput = new vm.Script('__tessraSnapshot()').runInContext(context, {
        timeout: normalizedTimeoutMs,
      });
      if (typeof serializedOutput !== 'string') {
        throw new Error('Script returned an invalid execution result.');
      }
      const parsed: unknown = JSON.parse(serializedOutput);
      if (!this.isScriptRealmSnapshot(parsed)) {
        throw new Error('Script returned an invalid execution result.');
      }
      return parsed;
    } catch {
      throw new Error('Script execution failed: Script result serialization failed.');
    }
  }

  private static readScriptRealmExecutionState(
    context: vm.Context,
    timeoutMs: number
  ): ScriptRealmExecutionState | undefined {
    try {
      const serialized = new vm.Script('__tessraReadExecutionState()').runInContext(context, {
        timeout: timeoutMs,
      });
      if (typeof serialized !== 'string') { return undefined; }
      const parsed: unknown = JSON.parse(serialized);
      if (!parsed || typeof parsed !== 'object') { return undefined; }
      const state = parsed as Partial<ScriptRealmExecutionState>;
      if (typeof state.state !== 'string' || typeof state.message !== 'string') { return undefined; }
      if (!['idle', 'running', 'capturing', 'captured', 'awaiting'].includes(state.state)) {
        return undefined;
      }
      return { state: state.state as ScriptRealmExecutionState['state'], message: state.message };
    } catch {
      return undefined;
    }
  }

  private static isScriptRealmSnapshot(value: unknown): value is ScriptRealmSnapshot {
    if (!value || typeof value !== 'object') { return false; }
    const snapshot = value as Partial<ScriptRealmSnapshot>;
    return Boolean(
      snapshot.request && typeof snapshot.request === 'object' &&
      Array.isArray(snapshot.envVariables) &&
      snapshot.state && typeof snapshot.state === 'object' &&
      Array.isArray(snapshot.state.logs) && Array.isArray(snapshot.state.tests)
    );
  }

  private static cloneEnvVariables(envVariables: KeyValue[]): KeyValue[] {
    return envVariables.map((variable) => ({ ...variable }));
  }

  private static cloneResponse(response: Response): Response {
    return {
      status: response.status,
      statusText: response.statusText,
      headers: { ...response.headers },
      rawSetCookies: response.rawSetCookies ? [...response.rawSetCookies] : undefined,
      body: response.body,
      bodyBase64: response.bodyBase64,
      time: response.time,
      size: response.size,
    };
  }

  private static cloneRequest(request: ScriptableRequest): ScriptableRequest {
    return {
      method: request.method,
      url: request.url,
      headers: request.headers.map((header) => ({ ...header })),
      params: request.params.map((param) => ({ ...param })),
      body: request.body,
      bodyType: request.bodyType,
      formData: request.formData.map((field) => ({ ...field })),
      binaryFilePath: request.binaryFilePath,
      auth: JSON.parse(JSON.stringify(request.auth)),
    };
  }
}

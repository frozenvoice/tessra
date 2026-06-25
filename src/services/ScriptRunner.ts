import * as assert from 'assert';
import * as vm from 'vm';
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

interface MutableEnvApi {
  get(name: string): string | undefined;
  set(name: string, value: unknown): void;
  unset(name: string): void;
  toObject(): Record<string, string>;
}

interface ScriptRunState {
  logs: ScriptLogEntry[];
  tests: ScriptExecutionResult['tests'];
}

// pre-request/test 스크립트 실행기
export class ScriptRunner {
  static readonly DEFAULT_TIMEOUT_MS = 3000;
  static readonly MIN_TIMEOUT_MS = 100;
  static readonly MAX_TIMEOUT_MS = 30000;

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
    const env = this.createEnvStore(envVariables);
    const state: ScriptRunState = { logs: [], tests: [] };

    if (!script) {
      return { request: clonedRequest, envVariables: env.toList(), result: state };
    }

    this.execute(script, {
      request: clonedRequest,
      env,
      response: undefined,
      state,
    }, timeoutMs);

    return { request: clonedRequest, envVariables: env.toList(), result: state };
  }

  static runTests(
    scripts: RequestScripts,
    request: ScriptableRequest,
    response: Response,
    envVariables: KeyValue[],
    timeoutMs = ScriptRunner.DEFAULT_TIMEOUT_MS
  ): { envVariables: KeyValue[]; result: ScriptExecutionResult } {
    const script = scripts.test?.trim();
    const env = this.createEnvStore(envVariables);
    const state: ScriptRunState = { logs: [], tests: [] };

    if (!script) {
      return { envVariables: env.toList(), result: state };
    }

    this.execute(script, {
      request: this.cloneRequest(request),
      env,
      response,
      state,
    }, timeoutMs);

    return { envVariables: env.toList(), result: state };
  }

  private static execute(
    source: string,
    contextData: {
      request: ScriptableRequest;
      env: ReturnType<typeof ScriptRunner.createEnvStore>;
      response?: Response;
      state: ScriptRunState;
    },
    timeoutMs: number
  ): void {
    const sandbox = this.createSandbox(contextData);
    const context = vm.createContext(sandbox);
    const normalizedTimeoutMs = ScriptRunner.normalizeTimeoutMs(timeoutMs);

    try {
      new vm.Script(source).runInContext(context, { timeout: normalizedTimeoutMs });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (/Script execution timed out/i.test(message)) {
        throw new Error(`Script execution timed out after ${normalizedTimeoutMs} ms`);
      }
      throw new Error(`Script execution failed: ${message}`);
    }
  }

  private static createSandbox(contextData: {
    request: ScriptableRequest;
    env: ReturnType<typeof ScriptRunner.createEnvStore>;
    response?: Response;
    state: ScriptRunState;
  }): Record<string, unknown> {
    const { request, env, response, state } = contextData;
    const logger = this.createLogger(state.logs);
    const expect = (actual: unknown) => this.createExpectation(actual);
    const pmResponse = response
      ? {
          code: response.status,
          status: response.statusText,
          headers: {
            get(name: string): string | undefined {
              const lookup = name.toLowerCase();
              return Object.entries(response.headers).find(([key]) => key.toLowerCase() === lookup)?.[1];
            },
          },
          text(): string {
            return response.body;
          },
          json(): unknown {
            return JSON.parse(response.body);
          },
          to: {
            have: {
              status(expectedStatus: number): void {
                if (response.status !== expectedStatus) {
                  throw new Error(`Expected response status ${expectedStatus}, received ${response.status}.`);
                }
              },
            },
          },
        }
      : undefined;

    const test = (name: string, fn: () => void): void => {
      try {
        fn();
        state.tests.push({ name, passed: true });
      } catch (error: unknown) {
        state.tests.push({
          name,
          passed: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    return {
      console: logger,
      request,
      response: response
        ? {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
            body: response.body,
            json(): unknown {
              return JSON.parse(response.body);
            },
          }
        : undefined,
      env: {
        get: (name: string) => env.api.get(name),
        set: (name: string, value: unknown) => env.api.set(name, value),
        unset: (name: string) => env.api.unset(name),
        toObject: () => env.api.toObject(),
      },
      test,
      expect,
      assert: (condition: unknown, message?: string) => {
        if (!condition) {
          throw new Error(message ?? 'Assertion failed');
        }
      },
      pm: {
        request,
        response: pmResponse,
        environment: env.api,
        variables: env.api,
        test,
        expect,
      },
    };
  }

  private static createLogger(target: ScriptLogEntry[]) {
    const push = (level: ScriptLogEntry['level'], values: unknown[]): void => {
      const message = values.map((value) => this.stringifyLogValue(value)).join(' ');
      target.push({ level, message });
    };

    return {
      log: (...values: unknown[]) => push('log', values),
      warn: (...values: unknown[]) => push('warn', values),
      error: (...values: unknown[]) => push('error', values),
    };
  }

  private static stringifyLogValue(value: unknown): string {
    if (typeof value === 'string') { return value; }
    if (value instanceof Error) { return value.message; }
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  private static createEnvStore(envVariables: KeyValue[]) {
    const map = new Map<string, KeyValue>();
    for (const variable of envVariables) {
      if (!variable.key) { continue; }
      map.set(variable.key, { ...variable });
    }

    const api: MutableEnvApi = {
      get(name: string): string | undefined {
        return map.get(name)?.value;
      },
      set(name: string, value: unknown): void {
        const current = map.get(name);
        map.set(name, {
          key: name,
          value: typeof value === 'string' ? value : JSON.stringify(value),
          enabled: current?.enabled ?? true,
        });
      },
      unset(name: string): void {
        map.delete(name);
      },
      toObject(): Record<string, string> {
        return [...map.values()].reduce<Record<string, string>>((acc, variable) => {
          acc[variable.key] = variable.value;
          return acc;
        }, {});
      },
    };

    return {
      api,
      toList(): KeyValue[] {
        return [...map.values()];
      },
    };
  }

  private static createExpectation(actual: unknown): Record<string, unknown> {
    const api: Record<string, unknown> = {};
    const to: Record<string, unknown> = {};
    const be: Record<string, unknown> = {};
    const have: Record<string, unknown> = {};

    const assertInclude = (expected: unknown): void => {
      if (typeof actual === 'string') {
        if (!actual.includes(String(expected))) {
          throw new Error(`"${String(actual)}" does not include "${String(expected)}".`);
        }
        return;
      }

      if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new Error('The array does not contain the expected value.');
        }
        return;
      }

      throw new Error('The include assertion only supports strings or arrays.');
    };

    Object.assign(to, {
      equal(expected: unknown): void {
        assert.strictEqual(actual, expected);
      },
      eql(expected: unknown): void {
        assert.deepStrictEqual(actual, expected);
      },
      include(expected: unknown): void {
        assertInclude(expected);
      },
      match(pattern: RegExp): void {
        if (typeof actual !== 'string' || !pattern.test(actual)) {
          throw new Error(`"${String(actual)}" does not match ${pattern.toString()}.`);
        }
      },
      have,
      be,
    });

    Object.assign(have, {
      property(name: string, expectedValue?: unknown): void {
        if (actual === null || typeof actual !== 'object' || !(name in (actual as Record<string, unknown>))) {
          throw new Error(`Property "${name}" does not exist.`);
        }
        if (arguments.length >= 2) {
          assert.deepStrictEqual((actual as Record<string, unknown>)[name], expectedValue);
        }
      },
    });

    Object.defineProperty(be, 'true', {
      get() {
        assert.strictEqual(actual, true);
        return api;
      },
    });
    Object.defineProperty(be, 'false', {
      get() {
        assert.strictEqual(actual, false);
        return api;
      },
    });
    Object.defineProperty(be, 'ok', {
      get() {
        if (!actual) {
          throw new Error('The value is not truthy.');
        }
        return api;
      },
    });

    api.to = to;
    return api;
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

import { AuthConfig, FormDataField, HttpMethod, KeyValue, PathVariableOverride, RequestBodyType } from '../models/types';
import { PathVariableService } from './PathVariableService';
import { VariableService } from './VariableService';

export interface ExportableRequest {
  method: HttpMethod;
  url: string;
  headers?: KeyValue[];
  params?: KeyValue[];
  pathVariableOverrides?: PathVariableOverride[];
  body?: string;
  bodyType?: RequestBodyType;
  formData?: FormDataField[];
  binaryFilePath?: string;
  auth?: AuthConfig;
}

export interface ResolvedExportRequest {
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

export interface RequestExportOptions {
  defaultHeaders?: KeyValue[];
  skipDefaultHeaders?: boolean;
}

export class RequestExportService {
  public static resolve(
    request: ExportableRequest,
    variables: KeyValue[],
    options?: RequestExportOptions
  ): ResolvedExportRequest {
    const resolvedHeaders = VariableService.resolveKeyValues(request.headers ?? [], variables);
    const resolvedParams = VariableService.resolveKeyValues(request.params ?? [], variables);
    const defaultHeaders = options?.skipDefaultHeaders
      ? []
      : VariableService.resolveKeyValues(options?.defaultHeaders ?? [], variables);

    return {
      method: request.method,
      url: PathVariableService.resolveUrl(
        request.url ?? '',
        PathVariableService.pruneOverrides(request.url ?? '', request.pathVariableOverrides),
        variables
      ),
      headers: this.mergeDefaultHeaders(defaultHeaders, resolvedHeaders),
      params: resolvedParams,
      body: VariableService.resolve(request.body ?? '', variables),
      bodyType: request.bodyType ?? 'none',
      formData: (request.formData ?? []).map((field) => ({
        ...field,
        key: VariableService.resolve(field.key, variables),
        value: VariableService.resolve(field.value, variables),
      })),
      binaryFilePath: VariableService.resolve(request.binaryFilePath ?? '', variables),
      auth: RequestExportService.resolveAuth(request.auth, variables),
    };
  }

  private static mergeDefaultHeaders(defaultHeaders: KeyValue[], requestHeaders: KeyValue[]): KeyValue[] {
    const requestHeaderKeys = new Set(
      requestHeaders
        .filter((header) => header.enabled !== false && header.key)
        .map((header) => header.key.toLowerCase())
    );

    const mergedDefaults = defaultHeaders.filter(
      (header) => header.enabled !== false && header.key && !requestHeaderKeys.has(header.key.toLowerCase())
    );

    return [...mergedDefaults, ...requestHeaders];
  }

  private static resolveAuth(auth: AuthConfig | undefined, variables: KeyValue[]): AuthConfig {
    if (!auth || auth.type === 'none') {
      return { type: 'none' };
    }

    if (auth.type === 'basic') {
      return {
        type: 'basic',
        basic: {
          username: VariableService.resolve(auth.basic?.username ?? '', variables),
          password: VariableService.resolve(auth.basic?.password ?? '', variables),
        },
      };
    }

    if (auth.type === 'bearer') {
      return {
        type: 'bearer',
        bearer: {
          token: VariableService.resolve(auth.bearer?.token ?? '', variables),
        },
      };
    }

    return {
      type: 'apikey',
      apikey: {
        key: VariableService.resolve(auth.apikey?.key ?? '', variables),
        value: VariableService.resolve(auth.apikey?.value ?? '', variables),
        addTo: auth.apikey?.addTo === 'query' ? 'query' : 'header',
      },
    };
  }
}

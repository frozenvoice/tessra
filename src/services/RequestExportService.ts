import { AuthConfig, FormDataField, HttpMethod, KeyValue, RequestBodyType } from '../models/types';
import { VariableService } from './VariableService';

export interface ExportableRequest {
  method: HttpMethod;
  url: string;
  headers?: KeyValue[];
  params?: KeyValue[];
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

export class RequestExportService {
  public static resolve(request: ExportableRequest, variables: KeyValue[]): ResolvedExportRequest {
    return {
      method: request.method,
      url: VariableService.resolve(request.url ?? '', variables),
      headers: VariableService.resolveKeyValues(request.headers ?? [], variables),
      params: VariableService.resolveKeyValues(request.params ?? [], variables),
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

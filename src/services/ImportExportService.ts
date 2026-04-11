import {
  AuthConfig,
  Collection,
  CollectionItem,
  Environment,
  FormDataField,
  HttpMethod,
  KeyValue,
  Request,
  RequestBodyType,
  RequestScripts,
} from '../models/types';

interface PostmanAuthAttribute {
  key?: string;
  value?: string;
}

type PostmanValue = Record<string, unknown>;

export interface PostmanImportResult {
  collections: Collection[];
  environments: Environment[];
}

// Postman import/export 서비스
export class ImportExportService {
  static importDocuments(documents: unknown[]): PostmanImportResult {
    const result: PostmanImportResult = {
      collections: [],
      environments: [],
    };

    for (const document of documents) {
      if (!document || typeof document !== 'object') { continue; }
      if (this.looksLikePostmanCollection(document)) {
        const collection = this.importCollection(document as PostmanValue);
        if (collection) {
          result.collections.push(collection);
        }
      } else if (this.looksLikePostmanEnvironment(document)) {
        const environment = this.importEnvironment(document as PostmanValue);
        if (environment) {
          result.environments.push(environment);
        }
      }
    }

    return result;
  }

  static exportCollection(collection: Collection): PostmanValue {
    return {
      info: {
        _postman_id: collection.id,
        name: collection.name,
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: collection.items.map((item) => this.exportCollectionItem(item)),
    };
  }

  static exportEnvironment(environment: Environment): PostmanValue {
    return {
      id: environment.id,
      name: environment.name,
      values: environment.variables.map((variable) => ({
        key: variable.key,
        value: variable.value,
        enabled: variable.enabled !== false,
        type: 'text',
      })),
      _postman_variable_scope: 'environment',
    };
  }

  private static looksLikePostmanCollection(value: object): boolean {
    const document = value as PostmanValue;
    return Array.isArray(document.item) && typeof document.info === 'object';
  }

  private static looksLikePostmanEnvironment(value: object): boolean {
    const document = value as PostmanValue;
    return Array.isArray(document.values) && typeof document.name === 'string';
  }

  private static importCollection(document: PostmanValue): Collection | null {
    const info = this.asObject(document.info);
    const items = Array.isArray(document.item) ? document.item : [];
    if (!info || typeof info.name !== 'string') { return null; }

    return {
      id: typeof info._postman_id === 'string' && info._postman_id ? info._postman_id : this.generateId(),
      name: info.name,
      items: items
        .map((item) => this.importCollectionItem(item))
        .filter((item): item is CollectionItem => item !== null),
    };
  }

  private static importEnvironment(document: PostmanValue): Environment | null {
    if (typeof document.name !== 'string' || !Array.isArray(document.values)) { return null; }

    return {
      id: typeof document.id === 'string' && document.id ? document.id : this.generateId(),
      name: document.name,
      variables: document.values
        .map((value) => this.importKeyValue(value))
        .filter((value): value is KeyValue => value !== null),
    };
  }

  private static importCollectionItem(value: unknown): CollectionItem | null {
    const item = this.asObject(value);
    if (!item) { return null; }

    if (Array.isArray(item.item)) {
      return {
        id: typeof item.id === 'string' && item.id ? item.id : this.generateId(),
        type: 'folder',
        name: typeof item.name === 'string' && item.name ? item.name : 'Imported Folder',
        children: item.item
          .map((child) => this.importCollectionItem(child))
          .filter((child): child is CollectionItem => child !== null),
      };
    }

    const request = this.importRequest(item.request, typeof item.name === 'string' ? item.name : 'Imported Request');
    if (!request) { return null; }

    return {
      id: typeof item.id === 'string' && item.id ? item.id : this.generateId(),
      type: 'request',
      name: request.name,
      request,
    };
  }

  private static importRequest(value: unknown, fallbackName: string): Request | null {
    const request = this.asObject(value);
    if (!request) { return null; }

    const { url, params } = this.importUrl(request.url);
    const body = this.importBody(this.asObject(request.body));
    const scripts = this.importScripts(request);

    return {
      id: this.generateId(),
      name: fallbackName,
      method: this.normalizeMethod(request.method),
      url,
      headers: Array.isArray(request.header)
        ? request.header.map((header) => this.importKeyValue(header)).filter((header): header is KeyValue => header !== null)
        : [],
      params,
      body: body.body,
      bodyType: body.bodyType,
      formData: body.formData,
      binaryFilePath: body.binaryFilePath,
      auth: this.importAuth(this.asObject(request.auth)),
      scripts,
    };
  }

  private static importUrl(value: unknown): { url: string; params: KeyValue[] } {
    if (typeof value === 'string') {
      try {
        const parsed = new URL(value);
        const params: KeyValue[] = [];
        parsed.searchParams.forEach((paramValue, key) => {
          params.push({ key, value: paramValue, enabled: true });
        });
        parsed.search = '';
        return { url: parsed.toString(), params };
      } catch {
        return { url: value, params: [] };
      }
    }

    const url = this.asObject(value);
    if (!url) { return { url: '', params: [] }; }

    const raw = typeof url.raw === 'string' ? url.raw : '';
    const params = Array.isArray(url.query)
      ? url.query.map((query) => this.importKeyValue(query)).filter((query): query is KeyValue => query !== null)
      : [];

    if (raw) {
      try {
        const parsed = new URL(raw);
        if (params.length === 0) {
          parsed.searchParams.forEach((paramValue, key) => {
            params.push({ key, value: paramValue, enabled: true });
          });
        }
        parsed.search = '';
        return { url: parsed.toString(), params };
      } catch {
        return { url: raw, params };
      }
    }

    const protocol = typeof url.protocol === 'string' ? `${url.protocol}://` : '';
    const host = Array.isArray(url.host) ? url.host.join('.') : '';
    const path = Array.isArray(url.path) ? `/${url.path.join('/')}` : '';
    return { url: `${protocol}${host}${path}`, params };
  }

  private static importAuth(auth: PostmanValue | null): AuthConfig {
    if (!auth || typeof auth.type !== 'string') {
      return { type: 'none' };
    }

    switch (auth.type) {
      case 'basic': {
        const basic = this.readAuthAttributes(auth.basic);
        return {
          type: 'basic',
          basic: {
            username: basic.username ?? '',
            password: basic.password ?? '',
          },
        };
      }
      case 'bearer': {
        const bearer = this.readAuthAttributes(auth.bearer);
        return {
          type: 'bearer',
          bearer: { token: bearer.token ?? '' },
        };
      }
      case 'apikey': {
        const apikey = this.readAuthAttributes(auth.apikey);
        return {
          type: 'apikey',
          apikey: {
            key: apikey.key ?? '',
            value: apikey.value ?? '',
            addTo: apikey.in === 'query' ? 'query' : 'header',
          },
        };
      }
      default:
        return { type: 'none' };
    }
  }

  private static importBody(body: PostmanValue | null): {
    body: string;
    bodyType: RequestBodyType;
    formData: FormDataField[];
    binaryFilePath: string;
  } {
    if (!body || typeof body.mode !== 'string') {
      return { body: '', bodyType: 'none', formData: [], binaryFilePath: '' };
    }

    switch (body.mode) {
      case 'raw':
        return {
          body: typeof body.raw === 'string' ? body.raw : '',
          bodyType: this.inferRawBodyType(body),
          formData: [],
          binaryFilePath: '',
        };
      case 'urlencoded': {
        const parts = Array.isArray(body.urlencoded)
          ? body.urlencoded
              .map((entry) => this.importKeyValue(entry))
              .filter((entry): entry is KeyValue => entry !== null && entry.enabled !== false)
              .map((entry) => `${encodeURIComponent(entry.key)}=${encodeURIComponent(entry.value)}`)
          : [];
        return {
          body: parts.join('&'),
          bodyType: 'form',
          formData: [],
          binaryFilePath: '',
        };
      }
      case 'formdata':
        return {
          body: '',
          bodyType: 'formdata',
          formData: Array.isArray(body.formdata)
            ? body.formdata
                .map((entry) => this.importFormDataField(entry))
                .filter((entry): entry is FormDataField => entry !== null)
            : [],
          binaryFilePath: '',
        };
      case 'file': {
        const file = this.asObject(body.file);
        return {
          body: '',
          bodyType: 'binary',
          formData: [],
          binaryFilePath: typeof file?.src === 'string'
            ? file.src
            : Array.isArray(file?.src) && typeof file.src[0] === 'string'
              ? file.src[0]
              : '',
        };
      }
      default:
        return { body: '', bodyType: 'none', formData: [], binaryFilePath: '' };
    }
  }

  private static importScripts(request: PostmanValue): RequestScripts {
    const events = Array.isArray(request.event) ? request.event : [];
    const scripts: RequestScripts = { preRequest: '', test: '' };

    for (const event of events) {
      const postmanEvent = this.asObject(event);
      const script = this.asObject(postmanEvent?.script);
      const listen = typeof postmanEvent?.listen === 'string' ? postmanEvent.listen : '';
      const source = Array.isArray(script?.exec)
        ? script.exec.filter((line): line is string => typeof line === 'string').join('\n')
        : typeof script?.exec === 'string'
          ? script.exec
          : '';
      if (!source) { continue; }
      if (listen === 'prerequest') {
        scripts.preRequest = source;
      } else if (listen === 'test') {
        scripts.test = source;
      }
    }

    return scripts;
  }

  private static importFormDataField(value: unknown): FormDataField | null {
    const field = this.asObject(value);
    if (!field || typeof field.key !== 'string' || !field.key) { return null; }

    const src = typeof field.src === 'string'
      ? field.src
      : Array.isArray(field.src) && typeof field.src[0] === 'string'
        ? field.src[0]
        : '';

    return {
      id: this.generateId(),
      key: field.key,
      value: field.type === 'file' ? src : typeof field.value === 'string' ? field.value : '',
      enabled: field.disabled !== true,
      type: field.type === 'file' ? 'file' : 'text',
    };
  }

  private static importKeyValue(value: unknown): KeyValue | null {
    const entry = this.asObject(value);
    if (!entry || typeof entry.key !== 'string') { return null; }
    return {
      key: entry.key,
      value: typeof entry.value === 'string' ? entry.value : '',
      enabled: entry.disabled !== true,
    };
  }

  private static inferRawBodyType(body: PostmanValue): RequestBodyType {
    const options = this.asObject(body.options);
    const raw = this.asObject(options?.raw);
    const language = typeof raw?.language === 'string' ? raw.language.toLowerCase() : '';

    if (language === 'json') { return 'json'; }
    if (language === 'xml') { return 'xml'; }
    if (language === 'text') { return 'raw'; }
    return 'raw';
  }

  private static exportCollectionItem(item: CollectionItem): PostmanValue {
    if (item.type === 'folder') {
      return {
        id: item.id,
        name: item.name,
        item: (item.children ?? []).map((child) => this.exportCollectionItem(child)),
      };
    }

    const request = item.request!;
    const body = this.exportBody(request);
    const event = this.exportScripts(request.scripts ?? { preRequest: '', test: '' });

    return {
      id: item.id,
      name: item.name,
      request: {
        method: request.method,
        header: request.headers.map((header) => ({
          key: header.key,
          value: header.value,
          disabled: header.enabled === false,
        })),
        url: {
          raw: this.exportRawUrl(request.url, request.params),
          query: request.params.map((param) => ({
            key: param.key,
            value: param.value,
            disabled: param.enabled === false,
          })),
        },
        auth: this.exportAuth(request.auth),
        body,
        event,
      },
      event,
    };
  }

  private static exportBody(request: Request): PostmanValue | undefined {
    switch (request.bodyType) {
      case 'json':
      case 'xml':
      case 'raw':
        return {
          mode: 'raw',
          raw: request.body,
          options: {
            raw: {
              language: request.bodyType === 'json' ? 'json' : request.bodyType === 'xml' ? 'xml' : 'text',
            },
          },
        };
      case 'form':
        return {
          mode: 'urlencoded',
          urlencoded: this.parseUrlEncodedBody(request.body).map((entry) => ({
            key: entry.key,
            value: entry.value,
            disabled: entry.enabled === false,
          })),
        };
      case 'formdata':
        return {
          mode: 'formdata',
          formdata: (request.formData ?? []).map((field) => ({
            key: field.key,
            value: field.type === 'text' ? field.value : undefined,
            src: field.type === 'file' ? field.value : undefined,
            type: field.type,
            disabled: field.enabled === false,
          })),
        };
      case 'binary':
        return {
          mode: 'file',
          file: {
            src: request.binaryFilePath,
          },
        };
      default:
        return undefined;
    }
  }

  private static exportAuth(auth: AuthConfig): PostmanValue | undefined {
    switch (auth.type) {
      case 'basic':
        return {
          type: 'basic',
          basic: [
            { key: 'username', value: auth.basic?.username ?? '' },
            { key: 'password', value: auth.basic?.password ?? '' },
          ],
        };
      case 'bearer':
        return {
          type: 'bearer',
          bearer: [
            { key: 'token', value: auth.bearer?.token ?? '' },
          ],
        };
      case 'apikey':
        return {
          type: 'apikey',
          apikey: [
            { key: 'key', value: auth.apikey?.key ?? '' },
            { key: 'value', value: auth.apikey?.value ?? '' },
            { key: 'in', value: auth.apikey?.addTo === 'query' ? 'query' : 'header' },
          ],
        };
      default:
        return undefined;
    }
  }

  private static exportScripts(scripts: RequestScripts): PostmanValue[] {
    const events: PostmanValue[] = [];
    if (scripts.preRequest?.trim()) {
      events.push({
        listen: 'prerequest',
        script: {
          type: 'text/javascript',
          exec: scripts.preRequest.split(/\r?\n/),
        },
      });
    }
    if (scripts.test?.trim()) {
      events.push({
        listen: 'test',
        script: {
          type: 'text/javascript',
          exec: scripts.test.split(/\r?\n/),
        },
      });
    }
    return events;
  }

  private static exportRawUrl(baseUrl: string, params: KeyValue[]): string {
    const activeParams = params.filter((param) => param.enabled !== false && param.key);
    if (activeParams.length === 0) { return baseUrl; }

    try {
      const url = new URL(baseUrl);
      for (const param of activeParams) {
        url.searchParams.append(param.key, param.value);
      }
      return url.toString();
    } catch {
      const separator = baseUrl.includes('?') ? '&' : '?';
      const query = activeParams
        .map((param) => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`)
        .join('&');
      return `${baseUrl}${separator}${query}`;
    }
  }

  private static parseUrlEncodedBody(body: string): KeyValue[] {
    if (!body) { return []; }
    return body.split('&').map((entry) => {
      const [rawKey, rawValue = ''] = entry.split('=');
      return {
        key: decodeURIComponent(rawKey ?? ''),
        value: decodeURIComponent(rawValue),
        enabled: true,
      };
    });
  }

  private static readAuthAttributes(value: unknown): Record<string, string> {
    const result: Record<string, string> = {};
    if (!Array.isArray(value)) { return result; }

    for (const entry of value) {
      const attribute = entry as PostmanAuthAttribute;
      if (typeof attribute.key === 'string' && typeof attribute.value === 'string') {
        result[attribute.key] = attribute.value;
      }
    }

    return result;
  }

  private static normalizeMethod(value: unknown): HttpMethod {
    const method = typeof value === 'string' ? value.toUpperCase() : 'GET';
    const methods: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
    return methods.includes(method as HttpMethod) ? method as HttpMethod : 'GET';
  }

  private static asObject(value: unknown): PostmanValue | null {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as PostmanValue : null;
  }

  private static generateId(): string {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }
}

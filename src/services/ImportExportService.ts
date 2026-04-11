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
  static isPostmanDocument(value: unknown): boolean {
    if (!value || typeof value !== 'object') { return false; }
    return this.looksLikePostmanCollection(value as object) || this.looksLikePostmanEnvironment(value as object);
  }

  static isOpenApiDocument(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) { return false; }
    const document = value as PostmanValue;
    return typeof document.paths === 'object'
      && document.paths !== null
      && (typeof document.openapi === 'string' || typeof document.swagger === 'string');
  }

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

  static importOpenApiDocuments(documents: unknown[]): PostmanImportResult {
    const result: PostmanImportResult = {
      collections: [],
      environments: [],
    };

    for (const document of documents) {
      if (!this.isOpenApiDocument(document)) { continue; }
      const imported = this.importOpenApiDocument(document as PostmanValue);
      if (!imported) { continue; }
      result.collections.push(imported.collection);
      if (imported.environment) {
        result.environments.push(imported.environment);
      }
    }

    return result;
  }

  private static importOpenApiDocument(document: PostmanValue): { collection: Collection; environment?: Environment } | null {
    const paths = this.asObject(document.paths);
    if (!paths) { return null; }

    const collectionName = this.extractOpenApiCollectionName(document);
    const baseUrl = this.extractOpenApiBaseUrl(document);
    const rootItems: CollectionItem[] = [];
    const groupedItems = new Map<string, CollectionItem[]>();
    const methodKeys = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

    for (const [routePath, rawPathItem] of Object.entries(paths)) {
      const pathItem = this.asObject(this.resolveMaybeRef(document, rawPathItem));
      if (!pathItem) { continue; }
      const sharedParameters = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

      for (const methodKey of methodKeys) {
        const operation = this.asObject(this.resolveMaybeRef(document, pathItem[methodKey]));
        if (!operation) { continue; }

        const method = methodKey.toUpperCase() as HttpMethod;
        const request = this.buildOpenApiRequest(document, routePath, method, sharedParameters, operation, baseUrl);
        const item: CollectionItem = {
          id: this.generateId(),
          type: 'request',
          name: request.name,
          request,
        };
        const groupName = this.chooseOpenApiGroupName(operation, routePath);
        if (!groupName) {
          rootItems.push(item);
          continue;
        }

        const bucket = groupedItems.get(groupName) ?? [];
        bucket.push(item);
        groupedItems.set(groupName, bucket);
      }
    }

    const groupedFolders: CollectionItem[] = Array.from(groupedItems.entries()).map(([name, children]) => ({
      id: this.generateId(),
      type: 'folder',
      name,
      children,
    }));

    let items: CollectionItem[] = [];
    if (rootItems.length > 0) {
      items = [...rootItems, ...groupedFolders];
    } else if (groupedFolders.length === 1) {
      items = groupedFolders[0].children ?? [];
    } else {
      items = groupedFolders;
    }

    if (items.length === 0) { return null; }

    return {
      collection: {
        id: this.generateId(),
        name: collectionName,
        items,
      },
      environment: baseUrl
        ? {
            id: this.generateId(),
            name: `${collectionName} Environment`,
            variables: [{ key: 'baseUrl', value: baseUrl, enabled: true }],
          }
        : undefined,
    };
  }

  private static extractOpenApiCollectionName(document: PostmanValue): string {
    const info = this.asObject(document.info);
    if (typeof info?.title === 'string' && info.title.trim()) {
      return info.title.trim();
    }
    return typeof document.openapi === 'string'
      ? 'Imported OpenAPI'
      : 'Imported Swagger';
  }

  private static extractOpenApiBaseUrl(document: PostmanValue): string {
    if (Array.isArray(document.servers)) {
      for (const serverValue of document.servers) {
        const server = this.asObject(serverValue);
        const resolved = this.resolveOpenApiServerUrl(server);
        if (resolved) { return resolved; }
      }
    }

    const host = typeof document.host === 'string' ? document.host.trim() : '';
    if (!host) { return ''; }
    const schemes = Array.isArray(document.schemes)
      ? document.schemes.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : [];
    const scheme = schemes[0] || 'https';
    const basePath = typeof document.basePath === 'string' ? document.basePath.trim() : '';
    return `${scheme}://${host}${basePath}`;
  }

  private static resolveOpenApiServerUrl(server: PostmanValue | null): string {
    if (!server || typeof server.url !== 'string' || !server.url.trim()) { return ''; }
    let url = server.url.trim();
    const variables = this.asObject(server.variables);
    if (!variables) { return url; }
    url = url.replace(/\{([^}]+)\}/g, (_, name: string) => {
      const variable = this.asObject(variables[name]);
      if (!variable) { return ''; }
      if (typeof variable.default === 'string' || typeof variable.default === 'number' || typeof variable.default === 'boolean') {
        return String(variable.default);
      }
      if (Array.isArray(variable.enum) && variable.enum.length > 0) {
        return String(variable.enum[0]);
      }
      return '';
    });
    return url;
  }

  private static chooseOpenApiGroupName(operation: PostmanValue, routePath: string): string | null {
    if (Array.isArray(operation.tags)) {
      const firstTag = operation.tags.find((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
      if (firstTag) { return firstTag.trim(); }
    }

    const firstSegment = routePath.split('/').filter(Boolean)[0];
    return firstSegment ? this.humanizeOpenApiSegment(firstSegment) : null;
  }

  private static humanizeOpenApiSegment(value: string): string {
    return value
      .replace(/[{}]/g, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private static buildOpenApiRequest(
    document: PostmanValue,
    routePath: string,
    method: HttpMethod,
    sharedParameters: unknown[],
    operation: PostmanValue,
    baseUrl: string
  ): Request {
    const parameters = this.mergeOpenApiParameters(document, sharedParameters, Array.isArray(operation.parameters) ? operation.parameters : []);
    const body = this.buildOpenApiBody(document, parameters, operation);

    return {
      id: this.generateId(),
      name: this.extractOpenApiRequestName(operation, method, routePath),
      method,
      url: this.buildOpenApiRequestUrl(routePath, baseUrl),
      headers: parameters
        .filter((parameter) => String(parameter.in || '').toLowerCase() === 'header')
        .map((parameter) => this.toOpenApiKeyValue(document, parameter))
        .filter((value): value is KeyValue => value !== null),
      params: parameters
        .filter((parameter) => String(parameter.in || '').toLowerCase() === 'query')
        .map((parameter) => this.toOpenApiKeyValue(document, parameter))
        .filter((value): value is KeyValue => value !== null),
      body: body.body,
      bodyType: body.bodyType,
      formData: body.formData,
      binaryFilePath: '',
      auth: this.inferOpenApiAuth(document, operation),
      scripts: { preRequest: '', test: '' },
    };
  }

  private static extractOpenApiRequestName(operation: PostmanValue, method: HttpMethod, routePath: string): string {
    if (typeof operation.summary === 'string' && operation.summary.trim()) {
      return operation.summary.trim();
    }
    if (typeof operation.operationId === 'string' && operation.operationId.trim()) {
      return operation.operationId.trim();
    }
    return `${method} ${routePath}`;
  }

  private static buildOpenApiRequestUrl(routePath: string, baseUrl: string): string {
    const normalizedPath = routePath.startsWith('/') ? routePath : `/${routePath}`;
    if (!baseUrl) { return normalizedPath; }
    return `{{baseUrl}}${normalizedPath}`;
  }

  private static mergeOpenApiParameters(document: PostmanValue, ...sources: unknown[][]): PostmanValue[] {
    const merged = new Map<string, PostmanValue>();

    for (const source of sources) {
      for (const value of source) {
        const parameter = this.asObject(this.resolveMaybeRef(document, value));
        if (!parameter || typeof parameter.name !== 'string') { continue; }
        const location = typeof parameter.in === 'string' ? parameter.in : 'query';
        merged.set(`${location}:${parameter.name}`, parameter);
      }
    }

    return Array.from(merged.values());
  }

  private static toOpenApiKeyValue(document: PostmanValue, parameter: PostmanValue): KeyValue | null {
    if (typeof parameter.name !== 'string' || !parameter.name) { return null; }
    const example = this.readOpenApiExample(document, parameter);
    return {
      key: parameter.name,
      value: example === undefined ? '' : this.stringifyExampleValue(example),
      enabled: true,
    };
  }

  private static buildOpenApiBody(
    document: PostmanValue,
    parameters: PostmanValue[],
    operation: PostmanValue
  ): { body: string; bodyType: RequestBodyType; formData: FormDataField[] } {
    const requestBody = this.asObject(this.resolveMaybeRef(document, operation.requestBody));
    if (requestBody) {
      const content = this.asObject(requestBody.content);
      if (content) {
        const mediaType = this.pickOpenApiMediaType(Object.keys(content));
        const media = this.asObject(this.resolveMaybeRef(document, content[mediaType]));
        const schema = this.asObject(this.resolveMaybeRef(document, media?.schema));
        const example = this.readMediaTypeExample(document, media, schema);
        return this.materializeBodyFromMediaType(mediaType, schema, example);
      }
    }

    const consumes = this.readSwaggerConsumes(document, operation);
    const formParameters = parameters.filter((parameter) => String(parameter.in || '').toLowerCase() === 'formdata');
    if (formParameters.length > 0) {
      const wantsMultipart = consumes.some((value) => value.includes('multipart/'));
      if (wantsMultipart || formParameters.some((parameter) => parameter.type === 'file')) {
        return {
          body: '',
          bodyType: 'formdata',
          formData: formParameters.map((parameter) => ({
            id: this.generateId(),
            key: typeof parameter.name === 'string' ? parameter.name : '',
            value: '',
            enabled: true,
            type: parameter.type === 'file' ? 'file' : 'text',
          })),
        };
      }

      const formBody = formParameters.map((parameter) => {
        const key = typeof parameter.name === 'string' ? parameter.name : '';
        const value = this.stringifyExampleValue(this.readOpenApiExample(document, parameter) ?? '');
        return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
      }).join('&');
      return { body: formBody, bodyType: 'form', formData: [] };
    }

    const bodyParameter = parameters.find((parameter) => String(parameter.in || '').toLowerCase() === 'body');
    if (bodyParameter) {
      const schema = this.asObject(this.resolveMaybeRef(document, bodyParameter.schema));
      const example = this.readOpenApiExample(document, bodyParameter) ?? this.buildExampleFromSchema(schema);
      const mediaType = consumes.find((value) => value.includes('json') || value.includes('xml')) || consumes[0] || 'application/json';
      return this.materializeBodyFromMediaType(mediaType, schema, example);
    }

    return { body: '', bodyType: 'none', formData: [] };
  }

  private static pickOpenApiMediaType(mediaTypes: string[]): string {
    const priorities = [
      'application/json',
      'application/xml',
      'text/xml',
      'application/x-www-form-urlencoded',
      'multipart/form-data',
      'application/octet-stream',
      'text/plain',
    ];

    for (const priority of priorities) {
      const match = mediaTypes.find((mediaType) => mediaType.toLowerCase() === priority);
      if (match) { return match; }
    }

    return mediaTypes[0];
  }

  private static materializeBodyFromMediaType(
    mediaType: string,
    schema: PostmanValue | null,
    example: unknown
  ): { body: string; bodyType: RequestBodyType; formData: FormDataField[] } {
    const normalized = mediaType.toLowerCase();
    if (normalized.includes('json')) {
      return {
        body: this.stringifyStructuredExample(example, '{}'),
        bodyType: 'json',
        formData: [],
      };
    }
    if (normalized.includes('xml')) {
      const xmlValue = typeof example === 'string'
        ? example
        : this.buildXmlFromExample(example, schema?.xml && typeof schema.xml === 'object' && schema.xml && typeof (schema.xml as PostmanValue).name === 'string'
          ? String((schema.xml as PostmanValue).name)
          : 'root');
      return { body: xmlValue, bodyType: 'xml', formData: [] };
    }
    if (normalized.includes('x-www-form-urlencoded')) {
      return {
        body: this.buildFormEncodedBody(example, schema),
        bodyType: 'form',
        formData: [],
      };
    }
    if (normalized.includes('multipart/form-data')) {
      return {
        body: '',
        bodyType: 'formdata',
        formData: this.buildFormDataFields(schema, example),
      };
    }
    if (normalized.includes('octet-stream') || this.isBinarySchema(schema)) {
      return {
        body: '',
        bodyType: 'binary',
        formData: [],
      };
    }
    return {
      body: typeof example === 'string' ? example : this.stringifyStructuredExample(example, ''),
      bodyType: 'raw',
      formData: [],
    };
  }

  private static readSwaggerConsumes(document: PostmanValue, operation: PostmanValue): string[] {
    const operationConsumes = Array.isArray(operation.consumes) ? operation.consumes : [];
    const documentConsumes = Array.isArray(document.consumes) ? document.consumes : [];
    return [...operationConsumes, ...documentConsumes]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.toLowerCase());
  }

  private static inferOpenApiAuth(document: PostmanValue, operation: PostmanValue): AuthConfig {
    const security = Array.isArray(operation.security)
      ? operation.security
      : Array.isArray(document.security)
        ? document.security
        : [];
    if (!security.length) { return { type: 'none' }; }

    const firstRequirement = this.asObject(security[0]);
    if (!firstRequirement) { return { type: 'none' }; }

    const schemeName = Object.keys(firstRequirement)[0];
    if (!schemeName) { return { type: 'none' }; }

    const schemesRoot = this.asObject(document.components)?.securitySchemes;
    const schemes = this.asObject(schemesRoot) ?? this.asObject(document.securityDefinitions);
    const scheme = this.asObject(this.resolveMaybeRef(document, schemes?.[schemeName]));
    if (!scheme) { return { type: 'none' }; }

    const schemeType = typeof scheme.type === 'string' ? scheme.type.toLowerCase() : '';
    if (schemeType === 'http') {
      const httpScheme = typeof scheme.scheme === 'string' ? scheme.scheme.toLowerCase() : '';
      if (httpScheme === 'basic') {
        return { type: 'basic', basic: { username: '', password: '' } };
      }
      if (httpScheme === 'bearer') {
        return { type: 'bearer', bearer: { token: '' } };
      }
    }
    if (schemeType === 'apikey') {
      return {
        type: 'apikey',
        apikey: {
          key: typeof scheme.name === 'string' ? scheme.name : '',
          value: '',
          addTo: scheme.in === 'query' ? 'query' : 'header',
        },
      };
    }
    if (schemeType === 'basic') {
      return { type: 'basic', basic: { username: '', password: '' } };
    }
    return { type: 'none' };
  }

  private static readMediaTypeExample(document: PostmanValue, media: PostmanValue | null, schema: PostmanValue | null): unknown {
    if (media && Object.prototype.hasOwnProperty.call(media, 'example')) {
      return media.example;
    }

    const examples = this.asObject(media?.examples);
    if (examples) {
      for (const value of Object.values(examples)) {
        const example = this.asObject(this.resolveMaybeRef(document, value));
        if (example && Object.prototype.hasOwnProperty.call(example, 'value')) {
          return example.value;
        }
      }
    }

    if (schema && Object.prototype.hasOwnProperty.call(schema, 'example')) {
      return schema.example;
    }

    return this.buildExampleFromSchema(schema);
  }

  private static readOpenApiExample(document: PostmanValue, parameter: PostmanValue): unknown {
    if (Object.prototype.hasOwnProperty.call(parameter, 'example')) {
      return parameter.example;
    }

    const schema = this.asObject(this.resolveMaybeRef(document, parameter.schema));
    if (schema && Object.prototype.hasOwnProperty.call(schema, 'example')) {
      return schema.example;
    }
    if (schema && Object.prototype.hasOwnProperty.call(schema, 'default')) {
      return schema.default;
    }
    if (Object.prototype.hasOwnProperty.call(parameter, 'default')) {
      return parameter.default;
    }

    return this.buildExampleFromSchema(schema);
  }

  private static buildExampleFromSchema(schema: PostmanValue | null, depth = 0): unknown {
    if (!schema || depth > 3) { return ''; }
    if (Object.prototype.hasOwnProperty.call(schema, 'example')) { return schema.example; }
    if (Object.prototype.hasOwnProperty.call(schema, 'default')) { return schema.default; }

    if (Array.isArray(schema.enum) && schema.enum.length > 0) {
      return schema.enum[0];
    }

    const schemaType = typeof schema.type === 'string' ? schema.type.toLowerCase() : '';
    if (schemaType === 'object' || (!schemaType && this.asObject(schema.properties))) {
      const properties = this.asObject(schema.properties);
      const result: Record<string, unknown> = {};
      if (properties) {
        for (const [key, propertyValue] of Object.entries(properties)) {
          result[key] = this.buildExampleFromSchema(this.asObject(propertyValue), depth + 1);
        }
      }
      return result;
    }

    if (schemaType === 'array') {
      const itemSchema = this.asObject(schema.items);
      return [this.buildExampleFromSchema(itemSchema, depth + 1)];
    }

    if (schemaType === 'integer' || schemaType === 'number') { return 0; }
    if (schemaType === 'boolean') { return true; }
    return '';
  }

  private static buildFormEncodedBody(example: unknown, schema: PostmanValue | null): string {
    const value = this.asObject(example) ?? this.asObject(this.buildExampleFromSchema(schema));
    if (!value) { return ''; }
    return Object.entries(value)
      .map(([key, entry]) => `${encodeURIComponent(key)}=${encodeURIComponent(this.stringifyExampleValue(entry))}`)
      .join('&');
  }

  private static buildFormDataFields(schema: PostmanValue | null, example: unknown): FormDataField[] {
    const exampleObject = this.asObject(example);
    const properties = this.asObject(schema?.properties);
    const fieldNames = new Set<string>([
      ...Object.keys(properties ?? {}),
      ...Object.keys(exampleObject ?? {}),
    ]);

    return Array.from(fieldNames).map((key) => {
      const propertySchema = this.asObject(properties?.[key]);
      const fieldValue = exampleObject && Object.prototype.hasOwnProperty.call(exampleObject, key)
        ? exampleObject[key]
        : this.buildExampleFromSchema(propertySchema);
      const isFile = this.isBinarySchema(propertySchema);
      return {
        id: this.generateId(),
        key,
        value: isFile ? '' : this.stringifyExampleValue(fieldValue),
        enabled: true,
        type: isFile ? 'file' : 'text',
      };
    });
  }

  private static buildXmlFromExample(example: unknown, rootName: string): string {
    const xmlBody = this.stringifyXmlNode(rootName || 'root', example);
    return `<?xml version="1.0" encoding="UTF-8"?>\n${xmlBody}`;
  }

  private static stringifyXmlNode(nodeName: string, value: unknown): string {
    if (Array.isArray(value)) {
      return value.map((entry) => this.stringifyXmlNode(nodeName, entry)).join('');
    }

    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      const children = entries.length === 0
        ? ''
        : entries.map(([key, entry]) => this.stringifyXmlNode(key, entry)).join('');
      return `<${nodeName}>${children}</${nodeName}>`;
    }

    return `<${nodeName}>${this.escapeXml(String(value ?? ''))}</${nodeName}>`;
  }

  private static stringifyStructuredExample(example: unknown, fallback: string): string {
    if (example === undefined) { return fallback; }
    if (typeof example === 'string') { return example; }
    try {
      return JSON.stringify(example ?? {}, null, 2);
    } catch {
      return fallback;
    }
  }

  private static stringifyExampleValue(value: unknown): string {
    if (value === undefined || value === null) { return ''; }
    if (typeof value === 'string') { return value; }
    if (typeof value === 'number' || typeof value === 'boolean') { return String(value); }
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  private static isBinarySchema(schema: PostmanValue | null): boolean {
    if (!schema) { return false; }
    const schemaType = typeof schema.type === 'string' ? schema.type.toLowerCase() : '';
    const format = typeof schema.format === 'string' ? schema.format.toLowerCase() : '';
    return schemaType === 'string' && (format === 'binary' || format === 'base64');
  }

  private static resolveMaybeRef(document: PostmanValue, value: unknown): unknown {
    const current = this.asObject(value);
    if (!current || typeof current.$ref !== 'string' || !current.$ref.startsWith('#/')) {
      return value;
    }

    const segments = current.$ref.slice(2).split('/');
    let cursor: unknown = document;
    for (const segment of segments) {
      const decoded = segment.replace(/~1/g, '/').replace(/~0/g, '~');
      if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor)) {
        return value;
      }
      cursor = (cursor as PostmanValue)[decoded];
    }

    if (cursor && typeof cursor === 'object' && !Array.isArray(cursor)) {
      return cursor;
    }
    return value;
  }

  private static escapeXml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
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

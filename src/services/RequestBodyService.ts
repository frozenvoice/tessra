import * as fs from 'fs/promises';
import * as path from 'path';
import { FormDataField, KeyValue, RequestBodyType } from '../models/types';
import { VariableService } from './VariableService';

export interface PreparedRequestBody {
  data: string | Buffer;
  headers: KeyValue[];
  resolvedBody: string;
  resolvedFormData: FormDataField[];
  resolvedBinaryFilePath: string;
}

// 요청 바디를 실제 전송 가능한 형태로 준비
export class RequestBodyService {
  static async prepare(options: {
    bodyType: RequestBodyType;
    body: string;
    formData: FormDataField[];
    binaryFilePath: string;
    headers: KeyValue[];
    vars: KeyValue[];
  }): Promise<PreparedRequestBody> {
    const headers = options.headers.map((header) => ({ ...header }));
    const body = VariableService.resolve(options.body ?? '', options.vars);
    const formData = (options.formData ?? [])
      .filter((field) => field.enabled !== false && field.key)
      .map((field) => ({
        ...field,
        key: VariableService.resolve(field.key, options.vars),
        value: VariableService.resolve(field.value, options.vars),
      }));
    const binaryFilePath = VariableService.resolve(options.binaryFilePath ?? '', options.vars).trim();

    switch (options.bodyType) {
      case 'formdata':
        return this.prepareMultipartBody(headers, formData);
      case 'binary':
        return this.prepareBinaryBody(headers, binaryFilePath);
      default:
        return {
          data: body,
          headers,
          resolvedBody: body,
          resolvedFormData: formData,
          resolvedBinaryFilePath: binaryFilePath,
        };
    }
  }

  private static async prepareBinaryBody(
    headers: KeyValue[],
    binaryFilePath: string
  ): Promise<PreparedRequestBody> {
    if (!binaryFilePath) {
      throw new Error('Binary body file path is empty.');
    }

    const data = await fs.readFile(binaryFilePath);
    this.removeHeader(headers, 'content-length');
    if (!this.hasHeader(headers, 'content-type')) {
      headers.push({ key: 'Content-Type', value: 'application/octet-stream', enabled: true });
    }

    return {
      data,
      headers,
      resolvedBody: '',
      resolvedFormData: [],
      resolvedBinaryFilePath: binaryFilePath,
    };
  }

  private static async prepareMultipartBody(
    headers: KeyValue[],
    formData: FormDataField[]
  ): Promise<PreparedRequestBody> {
    const boundary = `----TessraClient${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
    const parts: Buffer[] = [];

    for (const field of formData) {
      if (field.type === 'file') {
        if (!field.value) {
          throw new Error(`Form-data file path is empty. (${field.key})`);
        }

        const fileBuffer = await fs.readFile(field.value);
        const filename = path.basename(field.value);
        const mimeType = this.inferMimeType(filename);

        parts.push(Buffer.from(`--${boundary}\r\n`, 'utf-8'));
        parts.push(
          Buffer.from(
            `Content-Disposition: form-data; name="${this.escapeQuotes(field.key)}"; filename="${this.escapeQuotes(filename)}"\r\n`,
            'utf-8'
          )
        );
        parts.push(Buffer.from(`Content-Type: ${mimeType}\r\n\r\n`, 'utf-8'));
        parts.push(fileBuffer);
        parts.push(Buffer.from('\r\n', 'utf-8'));
      } else {
        parts.push(Buffer.from(`--${boundary}\r\n`, 'utf-8'));
        parts.push(
          Buffer.from(
            `Content-Disposition: form-data; name="${this.escapeQuotes(field.key)}"\r\n\r\n${field.value}\r\n`,
            'utf-8'
          )
        );
      }
    }

    parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));

    this.removeHeader(headers, 'content-type');
    this.removeHeader(headers, 'content-length');
    headers.push({
      key: 'Content-Type',
      value: `multipart/form-data; boundary=${boundary}`,
      enabled: true,
    });

    return {
      data: Buffer.concat(parts),
      headers,
      resolvedBody: '',
      resolvedFormData: formData,
      resolvedBinaryFilePath: '',
    };
  }

  private static hasHeader(headers: KeyValue[], key: string): boolean {
    const lowerKey = key.toLowerCase();
    return headers.some((header) => header.enabled !== false && header.key.toLowerCase() === lowerKey);
  }

  private static removeHeader(headers: KeyValue[], key: string): void {
    const lowerKey = key.toLowerCase();
    for (let index = headers.length - 1; index >= 0; index--) {
      if (headers[index].key.toLowerCase() === lowerKey) {
        headers.splice(index, 1);
      }
    }
  }

  private static inferMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
      case '.json':
        return 'application/json';
      case '.xml':
        return 'application/xml';
      case '.txt':
        return 'text/plain';
      case '.csv':
        return 'text/csv';
      case '.png':
        return 'image/png';
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.gif':
        return 'image/gif';
      case '.pdf':
        return 'application/pdf';
      default:
        return 'application/octet-stream';
    }
  }

  private static escapeQuotes(value: string): string {
    return value.replace(/"/g, '\\"');
  }
}

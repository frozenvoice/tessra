import { AuthConfig, CodegenTarget, FormDataField, KeyValue, RequestBodyType } from '../models/types';
import { AuthService } from './AuthService';

export interface CodegenRequest {
  method: string;
  url: string;
  headers: KeyValue[];
  params: KeyValue[];
  body: string;
  bodyType: RequestBodyType;
  formData: FormDataField[];
  binaryFilePath: string;
  auth: AuthConfig;
}

// cURL 외 코드 생성기
export class CodegenService {
  static generate(target: CodegenTarget, request: CodegenRequest): string {
    switch (target) {
      case 'fetch':
        return this.generateFetch(request);
      case 'axios':
        return this.generateAxios(request);
      case 'java':
        return this.generateJava(request);
      case 'curl':
      default:
        throw new Error('Unsupported code generation target.');
    }
  }

  private static generateFetch(request: CodegenRequest): string {
    const prepared = this.prepareRequest(request);
    const lines: string[] = [];
    const hasFormData = prepared.bodyType === 'formdata';
    const hasBinary = prepared.bodyType === 'binary';

    if (hasBinary) {
      lines.push(`const fs = require('fs');`);
      lines.push(``);
    }

    if (hasFormData) {
      lines.push(`const fs = require('fs');`);
      lines.push(`const path = require('path');`);
      lines.push(``);
      lines.push(`const form = new FormData();`);
      for (const field of prepared.formData) {
        if (field.type === 'file') {
          lines.push(
            `form.append(${JSON.stringify(field.key)}, new Blob([fs.readFileSync(${JSON.stringify(field.value)})]), path.basename(${JSON.stringify(field.value)}));`
          );
        } else {
          lines.push(`form.append(${JSON.stringify(field.key)}, ${JSON.stringify(field.value)});`);
        }
      }
      lines.push(``);
    }

    lines.push(`fetch(${JSON.stringify(prepared.url)}, {`);
    lines.push(`  method: ${JSON.stringify(prepared.method)},`);
    if (prepared.headers.length > 0 && !hasFormData) {
      lines.push(`  headers: ${JSON.stringify(this.toHeaderObject(prepared.headers), null, 2).replace(/\n/g, '\n  ')},`);
    }
    if (prepared.bodyType !== 'none') {
      if (hasFormData) {
        lines.push(`  body: form,`);
      } else if (hasBinary) {
        lines.push(`  body: fs.readFileSync(${JSON.stringify(prepared.binaryFilePath)}),`);
      } else {
        lines.push(`  body: ${JSON.stringify(prepared.body)},`);
      }
    }
    lines.push(`})`);
    lines.push(`  .then(async (response) => ({`);
    lines.push(`    status: response.status,`);
    lines.push(`    headers: Object.fromEntries(response.headers.entries()),`);
    lines.push(`    body: await response.text(),`);
    lines.push(`  }))`);
    lines.push(`  .then(console.log)`);
    lines.push(`  .catch(console.error);`);
    return lines.join('\n');
  }

  private static generateAxios(request: CodegenRequest): string {
    const prepared = this.prepareRequest(request);
    const lines: string[] = [`const axios = require('axios');`];
    const hasFormData = prepared.bodyType === 'formdata';
    const hasBinary = prepared.bodyType === 'binary';

    if (hasFormData) {
      lines.push(`const FormData = require('form-data');`);
      lines.push(`const fs = require('fs');`);
      lines.push(``);
      lines.push(`const form = new FormData();`);
      for (const field of prepared.formData) {
        if (field.type === 'file') {
          lines.push(`form.append(${JSON.stringify(field.key)}, fs.createReadStream(${JSON.stringify(field.value)}));`);
        } else {
          lines.push(`form.append(${JSON.stringify(field.key)}, ${JSON.stringify(field.value)});`);
        }
      }
    } else if (hasBinary) {
      lines.push(`const fs = require('fs');`);
    }

    lines.push(``);
    lines.push(`axios({`);
    lines.push(`  method: ${JSON.stringify(prepared.method.toLowerCase())},`);
    lines.push(`  url: ${JSON.stringify(prepared.url)},`);
    if (hasFormData) {
      lines.push(`  headers: {`);
      lines.push(`    ...form.getHeaders(),`);
      for (const [key, value] of Object.entries(this.toHeaderObject(prepared.headers))) {
        lines.push(`    ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
      }
      lines.push(`  },`);
      lines.push(`  data: form,`);
    } else {
      if (prepared.headers.length > 0) {
        lines.push(`  headers: ${JSON.stringify(this.toHeaderObject(prepared.headers), null, 2).replace(/\n/g, '\n  ')},`);
      }
      if (prepared.bodyType !== 'none') {
        if (hasBinary) {
          lines.push(`  data: fs.readFileSync(${JSON.stringify(prepared.binaryFilePath)}),`);
        } else {
          lines.push(`  data: ${JSON.stringify(prepared.body)},`);
        }
      }
    }
    lines.push(`})`);
    lines.push(`  .then((response) => console.log(response.status, response.data))`);
    lines.push(`  .catch((error) => console.error(error.response?.status, error.response?.data ?? error.message));`);
    return lines.join('\n');
  }

  private static generateJava(request: CodegenRequest): string {
    const prepared = this.prepareRequest(request);
    const headerLines = prepared.headers
      .map((header) => `        connection.setRequestProperty(${JSON.stringify(header.key)}, ${JSON.stringify(header.value)});`)
      .join('\n');
    const bodyWrite = this.generateJavaBodyWriter(prepared);

    return [
      `import java.io.BufferedReader;`,
      `import java.io.InputStream;`,
      `import java.io.InputStreamReader;`,
      `import java.io.OutputStream;`,
      `import java.net.HttpURLConnection;`,
      `import java.net.URL;`,
      prepared.bodyType === 'binary' || prepared.bodyType === 'formdata' ? `import java.nio.file.Files;` : ``,
      prepared.bodyType === 'binary' || prepared.bodyType === 'formdata' ? `import java.nio.file.Path;` : ``,
      `import java.nio.charset.StandardCharsets;`,
      ``,
      `public class TessraClientExample {`,
      `    public static void main(String[] args) throws Exception {`,
      `        URL url = new URL(${JSON.stringify(prepared.url)});`,
      `        HttpURLConnection connection = (HttpURLConnection) url.openConnection();`,
      `        connection.setRequestMethod(${JSON.stringify(prepared.method)});`,
      headerLines,
      prepared.bodyType !== 'none' ? `        connection.setDoOutput(true);` : ``,
      bodyWrite,
      `        int status = connection.getResponseCode();`,
      `        InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();`,
      `        BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8));`,
      `        StringBuilder body = new StringBuilder();`,
      `        String line;`,
      `        while ((line = reader.readLine()) != null) {`,
      `            body.append(line).append("\\n");`,
      `        }`,
      `        reader.close();`,
      `        System.out.println(status);`,
      `        System.out.println(body.toString());`,
      `    }`,
      `}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private static generateJavaBodyWriter(request: ReturnType<typeof CodegenService.prepareRequest>): string {
    if (request.bodyType === 'none') {
      return '';
    }

    if (request.bodyType === 'binary') {
      return [
        `        byte[] bodyBytes = Files.readAllBytes(Path.of(${JSON.stringify(request.binaryFilePath)}));`,
        `        try (OutputStream os = connection.getOutputStream()) {`,
        `            os.write(bodyBytes);`,
        `        }`,
      ].join('\n');
    }

    if (request.bodyType === 'formdata') {
      const boundary = '----TessraClientBoundary';
      const lines: string[] = [
        `        String boundary = ${JSON.stringify(boundary)};`,
        `        connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);`,
        `        try (OutputStream os = connection.getOutputStream()) {`,
      ];
      for (const field of request.formData) {
        if (field.type === 'file') {
          lines.push(
            `            os.write(("--" + boundary + "\\r\\nContent-Disposition: form-data; name=\\"" + ${JSON.stringify(field.key)} + "\\"; filename=\\"" + Path.of(${JSON.stringify(field.value)}).getFileName().toString() + "\\"\\r\\n\\r\\n").getBytes(StandardCharsets.UTF_8));`
          );
          lines.push(`            os.write(Files.readAllBytes(Path.of(${JSON.stringify(field.value)})));`);
          lines.push(`            os.write("\\r\\n".getBytes(StandardCharsets.UTF_8));`);
        } else {
          lines.push(
            `            os.write(("--" + boundary + "\\r\\nContent-Disposition: form-data; name=\\"" + ${JSON.stringify(field.key)} + "\\"\\r\\n\\r\\n" + ${JSON.stringify(field.value)} + "\\r\\n").getBytes(StandardCharsets.UTF_8));`
          );
        }
      }
      lines.push(`            os.write(("--" + boundary + "--\\r\\n").getBytes(StandardCharsets.UTF_8));`);
      lines.push(`        }`);
      return lines.join('\n');
    }

    return [
      `        byte[] bodyBytes = ${JSON.stringify(request.body)}.getBytes(StandardCharsets.UTF_8);`,
      `        try (OutputStream os = connection.getOutputStream()) {`,
      `            os.write(bodyBytes);`,
      `        }`,
    ].join('\n');
  }

  private static prepareRequest(request: CodegenRequest) {
    const headers = request.headers.filter((header) => header.enabled !== false && header.key).map((header) => ({ ...header }));
    const params = request.params
      .filter((param) => param.enabled !== false && param.key)
      .map((param) => ({ ...param }));
    const formData = request.formData.filter((field) => field.enabled !== false && field.key).map((field) => ({ ...field }));
    AuthService.applyAuth(request.auth, headers, params, []);

    return {
      method: request.method,
      url: this.buildUrl(request.url, params),
      headers,
      body: request.body ?? '',
      bodyType: request.bodyType,
      formData,
      binaryFilePath: request.binaryFilePath ?? '',
    };
  }

  private static toHeaderObject(headers: KeyValue[]): Record<string, string> {
    return headers.reduce<Record<string, string>>((acc, header) => {
      acc[header.key] = header.value;
      return acc;
    }, {});
  }

  private static buildUrl(baseUrl: string, params: KeyValue[]): string {
    if (params.length === 0) { return baseUrl; }
    try {
      const url = new URL(baseUrl);
      for (const param of params) {
        url.searchParams.append(param.key, param.value);
      }
      return url.toString();
    } catch {
      const separator = baseUrl.includes('?') ? '&' : '?';
      const query = params
        .map((param) => `${encodeURIComponent(param.key)}=${encodeURIComponent(param.value)}`)
        .join('&');
      return `${baseUrl}${separator}${query}`;
    }
  }

}

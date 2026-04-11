import { AuthConfig, KeyValue } from '../models/types';
import { VariableService } from './VariableService';

// 인증 헤더/파라미터를 적용하되 동일 키 중복 전송은 방지
export class AuthService {
  static applyAuth(auth: AuthConfig, headers: KeyValue[], params: KeyValue[], vars: KeyValue[]): void {
    switch (auth.type) {
      case 'basic':
        if (auth.basic) {
          const u = VariableService.resolve(auth.basic.username, vars);
          const p = VariableService.resolve(auth.basic.password, vars);
          this.removeHeader(headers, 'Authorization');
          headers.push({
            key: 'Authorization',
            value: `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}`,
            enabled: true,
          });
        }
        break;
      case 'bearer':
        if (auth.bearer) {
          const t = VariableService.resolve(auth.bearer.token, vars);
          this.removeHeader(headers, 'Authorization');
          headers.push({
            key: 'Authorization',
            value: `Bearer ${t}`,
            enabled: true,
          });
        }
        break;
      case 'apikey':
        if (auth.apikey) {
          const key = VariableService.resolve(auth.apikey.key, vars);
          const value = VariableService.resolve(auth.apikey.value, vars);
          if (!key) { break; }
          if (auth.apikey.addTo === 'query') {
            this.removeParam(params, key);
            params.push({ key, value, enabled: true });
          } else {
            this.removeHeader(headers, key);
            headers.push({ key, value, enabled: true });
          }
        }
        break;
    }
  }

  private static removeHeader(headers: KeyValue[], key: string): void {
    const target = key.toLowerCase();
    for (let i = headers.length - 1; i >= 0; i--) {
      if (headers[i].key.toLowerCase() === target) {
        headers.splice(i, 1);
      }
    }
  }

  private static removeParam(params: KeyValue[], key: string): void {
    for (let i = params.length - 1; i >= 0; i--) {
      if (params[i].key === key) {
        params.splice(i, 1);
      }
    }
  }
}

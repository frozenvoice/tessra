import * as fs from 'fs';
import * as path from 'path';

export interface SeedOptions {
  userDataDir: string;
  baseUrl: string;
  extensionStorageId?: string;
  userSettings?: Record<string, unknown>;
}

function kv(key: string, value: string) {
  return { key, value, enabled: true };
}

function httpRequest(id: string, name: string, method: string, url: string, extra?: Record<string, unknown>) {
  return {
    id,
    type: 'request' as const,
    name,
    request: {
      id,
      name,
      method,
      url,
      headers: [],
      params: [],
      body: '',
      bodyType: 'none',
      auth: { type: 'none' },
      ...(extra || {}),
    },
  };
}

export function seedTessraStorage(options: SeedOptions): string {
  const storageId = options.extensionStorageId || 'frozenvoice.tessra';
  const storageRoot = path.join(options.userDataDir, 'User', 'globalStorage', storageId);
  fs.mkdirSync(storageRoot, { recursive: true });

  const envId = 'env-e2e';
  const environments = [
    {
      id: envId,
      name: 'Tessra E2E Environment',
      variables: [
        kv('baseUrl', options.baseUrl),
        kv('token', 'e2e-token'),
        kv('envName', 'e2e'),
        kv('customerId', '9000'),
      ],
    },
    { id: 'env-execution-b', name: 'Execution B', variables: [kv('envName', 'preserved-b')] },
  ];

  const runnerRequests = [
    httpRequest('req-users', 'GET Users', 'GET', '{{baseUrl}}/users'),
    httpRequest('req-users-query', 'GET Users With Query', 'GET', '{{baseUrl}}/users?_limit=2'),
    httpRequest('req-echo', 'POST Echo', 'POST', '{{baseUrl}}/echo', {
      bodyType: 'json',
      body: '{"ping":true}',
      headers: [kv('Content-Type', 'application/json')],
    }),
    httpRequest('req-html', 'GET HTML', 'GET', '{{baseUrl}}/html'),
    httpRequest('req-slow', 'GET Slow', 'GET', '{{baseUrl}}/slow'),
  ];

  const collections = [
    {
      id: 'col-e2e-basics',
      name: 'E2E Basics',
      items: runnerRequests.slice(0, 2),
    },
    {
      id: 'col-e2e-runner',
      name: 'E2E Runner',
      items: runnerRequests,
    },
  ];

  fs.writeFileSync(path.join(storageRoot, 'environments.json'), JSON.stringify(environments, null, 2), 'utf8');
  fs.writeFileSync(path.join(storageRoot, 'active-environment.json'), JSON.stringify(envId), 'utf8');
  fs.writeFileSync(path.join(storageRoot, 'collections.json'), JSON.stringify(collections, null, 2), 'utf8');
  fs.writeFileSync(path.join(storageRoot, 'history.json'), JSON.stringify([], null, 2), 'utf8');
  fs.writeFileSync(path.join(storageRoot, 'default-headers.json'), JSON.stringify([], null, 2), 'utf8');
  fs.writeFileSync(path.join(storageRoot, 'variables.json'), JSON.stringify([], null, 2), 'utf8');

  const settingsDir = path.join(options.userDataDir, 'User');
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(
    path.join(settingsDir, 'settings.json'),
    JSON.stringify(
      {
        'tessra.displayLanguage': 'en',
        'window.restoreWindows': 'none',
        'telemetry.telemetryLevel': 'off',
        'extensions.autoUpdate': false,
        'extensions.autoCheckUpdates': false,
        'update.mode': 'none',
        'workbench.startupEditor': 'none',
        ...options.userSettings,
      },
      null,
      2
    ),
    'utf8'
  );

  return storageRoot;
}

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { downloadAndUnzipVSCode, resolveCliArgsFromVSCodeExecutablePath } from '@vscode/test-electron';
import { _electron as electron, type CDPSession, type ElectronApplication, type Page } from '@playwright/test';
import { REPO_ROOT, VSCODE_E2E_VERSION } from '../../../e2e/helpers/paths';
import { startDemoServer, type DemoServer } from './demoServer';

export const WINDOW = { width: 1600, height: 900 };
export const CAPTURE_DIR = path.join(__dirname, '..', '.capture');

export interface PromoHarness {
  app: ElectronApplication;
  page: Page;
  local: DemoServer;
  staging: DemoServer;
  dispose: () => Promise<void>;
}

const kv = (key: string, value: string) => ({ key, value, enabled: true });

function request(id: string, name: string, method: string, url: string, extra?: Record<string, unknown>) {
  return {
    id,
    type: 'request' as const,
    name,
    request: {
      id,
      name,
      method,
      url,
      headers: [kv('Accept', 'application/json')],
      params: [],
      body: '',
      bodyType: 'none',
      auth: { type: 'bearer', token: '{{token}}' },
      ...(extra || {}),
    },
  };
}

function seed(userDataDir: string, localUrl: string, stagingUrl: string): void {
  const root = path.join(userDataDir, 'User', 'globalStorage', 'frozenvoice.tessra');
  fs.mkdirSync(root, { recursive: true });
  const environments = [
    { id: 'env-local', name: 'local', variables: [kv('baseUrl', localUrl), kv('token', 'dev-token-local'), kv('userId', '42')] },
    { id: 'env-staging', name: 'staging', variables: [kv('baseUrl', stagingUrl), kv('token', 'dev-token-staging'), kv('userId', '42')] },
  ];
  const collections = [
    {
      id: 'col-demo',
      name: 'Demo API',
      items: [
        request('req-list', 'List users', 'GET', '{{baseUrl}}/users'),
        request('req-create', 'Create user', 'POST', '{{baseUrl}}/users', {
          bodyType: 'json',
          body: '{\n  "name": "Mary Jackson",\n  "role": "editor"\n}',
          headers: [kv('Accept', 'application/json'), kv('Content-Type', 'application/json')],
        }),
        request('req-get', 'Get user', 'GET', '{{baseUrl}}/users/{{userId}}'),
        request('req-delete', 'Remove user', 'DELETE', '{{baseUrl}}/users/7'),
      ],
    },
  ];
  const write = (name: string, value: unknown) =>
    fs.writeFileSync(path.join(root, name), JSON.stringify(value, null, 2), 'utf8');
  write('environments.json', environments);
  write('active-environment.json', 'env-local');
  write('collections.json', collections);
  write('history.json', []);
  write('default-headers.json', []);
  write('variables.json', []);

  fs.writeFileSync(
    path.join(userDataDir, 'User', 'settings.json'),
    JSON.stringify(
      {
        'tessra.displayLanguage': 'en',
        'window.restoreWindows': 'none',
        'window.commandCenter': false,
        'workbench.startupEditor': 'none',
        'workbench.tips.enabled': false,
        'workbench.layoutControl.enabled': false,
        'chat.commandCenter.enabled': false,
        'telemetry.telemetryLevel': 'off',
        'extensions.autoUpdate': false,
        'extensions.autoCheckUpdates': false,
        'update.mode': 'none',
        'window.zoomLevel': Number(process.env.PROMO_ZOOM ?? 0),
      },
      null,
      2
    ),
    'utf8'
  );
}

/**
 * Packages the repo as a VSIX so the capture shows Tessra the way users install it
 * (a development host would prefix the title bar with [Extension Development Host]).
 */
function packageVsix(): string {
  // 통합 검증에서 만든 동일 VSIX를 재사용해 캡처 중 재빌드를 피한다.
  if (process.env.PROMO_VSIX) {
    const existing = path.resolve(process.env.PROMO_VSIX);
    if (path.extname(existing).toLowerCase() !== '.vsix' || !fs.existsSync(existing) || !fs.statSync(existing).isFile()) {
      throw new Error(`PROMO_VSIX must point to an existing VSIX file: ${existing}`);
    }
    return existing;
  }
  const out = path.join(CAPTURE_DIR, 'tessra-promo.vsix');
  fs.mkdirSync(CAPTURE_DIR, { recursive: true });
  const res = spawnSync('npx', ['@vscode/vsce', 'package', '--no-rewrite-relative-links', '-o', out], {
    cwd: REPO_ROOT,
    shell: true,
    stdio: 'inherit',
  });
  if (res.status !== 0) throw new Error('vsce package failed');
  return out;
}

function installVsix(executablePath: string, vsix: string, userDataDir: string, extensionsDir: string): void {
  const [cli, ...defaults] = resolveCliArgsFromVSCodeExecutablePath(executablePath);
  const cliArgs = defaults.filter((a) => !a.startsWith('--user-data-dir') && !a.startsWith('--extensions-dir'));
  const res = spawnSync(cli, [...cliArgs, '--install-extension', vsix, '--force', `--user-data-dir=${userDataDir}`, `--extensions-dir=${extensionsDir}`], {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });
  if (res.status !== 0) throw new Error('VSIX install failed');
}

export async function launchPromoHarness(): Promise<PromoHarness> {
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tessra-promo-'));
  const userDataDir = path.join(runRoot, 'user-data');
  const extensionsDir = path.join(runRoot, 'extensions');
  const workspaceDir = path.join(runRoot, 'demo-api');
  for (const dir of [userDataDir, extensionsDir, workspaceDir]) fs.mkdirSync(dir, { recursive: true });

  const local = await startDemoServer('local', 4010);
  const staging = await startDemoServer('staging', 4020);
  seed(userDataDir, local.baseUrl, staging.baseUrl);

  const executablePath = await downloadAndUnzipVSCode(VSCODE_E2E_VERSION);
  installVsix(executablePath, packageVsix(), userDataDir, extensionsDir);
  const app = await electron.launch({
    executablePath,
    args: [
      workspaceDir,
      `--user-data-dir=${userDataDir}`,
      `--extensions-dir=${extensionsDir}`,
      '--disable-workspace-trust',
      '--skip-welcome',
      '--skip-release-notes',
      '--disable-telemetry',
      '--disable-updates',
      '--no-sandbox',
      '--locale=en',
      '--new-window',
      `--window-size=${WINDOW.width},${WINDOW.height}`,
      `--force-device-scale-factor=${process.env.PROMO_DSF ?? '1.5'}`,
    ],
    env: { ...process.env, LANG: 'en_US.UTF-8', LC_ALL: 'en_US.UTF-8' },
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.locator('.monaco-workbench').waitFor({ state: 'visible', timeout: 60000 });
  await page
    .locator('.activitybar [aria-label*="Tessra"]')
    .first()
    .waitFor({ state: 'visible', timeout: 90000 });
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    win.setContentSize(size.width, size.height);
    win.center();
  }, WINDOW);

  return {
    app,
    page,
    local,
    staging,
    dispose: async () => {
      await app.close().catch(() => undefined);
      await local.close().catch(() => undefined);
      await staging.close().catch(() => undefined);
      await new Promise((r) => setTimeout(r, 750));
      fs.rmSync(runRoot, { recursive: true, force: true });
    },
  };
}

/** Records the window via CDP screencast into a constant-frame-rate JPEG sequence. */
export class ScreenRecorder {
  private frames: Array<{ t: number; data: Buffer }> = [];
  private session?: CDPSession;
  private marks: Record<string, { t: number; x?: number; y?: number }> = {};
  private regions: Record<string, { t: number; x: number; y: number; width: number; height: number }> = {};
  private keys: number[] = [];
  private startedAt = 0;

  constructor(private readonly page: Page) {}

  async start(): Promise<void> {
    this.session = await this.page.context().newCDPSession(this.page);
    this.session.on('Page.screencastFrame', (ev: { data: string; sessionId: number; metadata: { timestamp?: number } }) => {
      const t = ev.metadata.timestamp ?? Date.now() / 1000;
      this.frames.push({ t, data: Buffer.from(ev.data, 'base64') });
      void this.session?.send('Page.screencastFrameAck', { sessionId: ev.sessionId }).catch(() => undefined);
    });
    this.startedAt = Date.now() / 1000;
    await this.session.send('Page.startScreencast', {
      format: 'jpeg',
      quality: 95,
      maxWidth: WINDOW.width * 2,
      maxHeight: WINDOW.height * 2,
      everyNthFrame: 1,
    });
  }

  /** Named timestamps (seconds from start) so the composition can line captions up with the action. */
  mark(name: string, at?: { x: number; y: number }): void {
    this.marks[name] = { t: Date.now() / 1000 - this.startedAt, ...(at || {}) };
  }

  /** 실제 UI의 표시 영역을 보관해 렌더링된 카메라의 잘림을 측정한다. */
  region(name: string, rect: { x: number; y: number; width: number; height: number }): void {
    this.regions[name] = { t: Date.now() / 1000 - this.startedAt, ...rect };
  }

  /** Keystroke times, used by the soundtrack for typing ticks. */
  key(): void {
    this.keys.push(Date.now() / 1000 - this.startedAt);
  }

  async stop(name: string, fps = 30): Promise<string> {
    await this.session?.send('Page.stopScreencast').catch(() => undefined);
    const end = Date.now() / 1000;
    const dir = path.join(CAPTURE_DIR, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const frames = this.frames.sort((a, b) => a.t - b.t);
    if (!frames.length) throw new Error('no screencast frames captured');
    const t0 = this.startedAt;
    const total = Math.floor((end - t0) * fps);
    let src = 0;
    for (let i = 0; i < total; i += 1) {
      const t = t0 + i / fps;
      while (src + 1 < frames.length && frames[src + 1].t <= t) src += 1;
      fs.writeFileSync(path.join(dir, `${String(i).padStart(5, '0')}.jpg`), frames[src].data);
    }
    const meta = JSON.stringify({ fps, frames: total, window: WINDOW, marks: this.marks, regions: this.regions, keys: this.keys }, null, 2);
    fs.writeFileSync(path.join(dir, 'clip.json'), meta, 'utf8');
    // Script form so the composition can load it from file:// without fetch.
    fs.writeFileSync(path.join(dir, 'clip.js'), `window.CLIP = ${meta};\n`, 'utf8');
    return dir;
  }
}

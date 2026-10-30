import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { downloadAndUnzipVSCode, runVSCodeCommand } from '@vscode/test-electron';
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { ARTIFACTS_DIR, REPO_ROOT, VSCODE_E2E_VERSION } from './paths';
import { seedTessraStorage } from '../fixtures/seed';
import { startFixtureServer, type FixtureServer } from '../fixtures/server';

export interface TessraHarness {
  app: ElectronApplication;
  page: Page;
  server: FixtureServer;
  baseUrl: string;
  userDataDir: string;
  extensionsDir: string;
  workspaceDir: string;
  dispose: () => Promise<void>;
}

function rmrf(target: string): void {
  fs.rmSync(target, { recursive: true, force: true });
}

// 진행 중 상태 캡처용. Windows에서 page.screenshot(CDP) 이후 webview로 마우스 입력이
// 전달되지 않아 이어지는 Stop 등 클릭이 조용히 유실되므로 Electron capturePage를 사용한다.
export async function captureWindow(app: ElectronApplication, filePath: string): Promise<void> {
  const png = await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows().find((item: { isVisible(): boolean }) => item.isVisible());
    if (!win) { throw new Error('No visible VS Code window to capture'); }
    return (await win.webContents.capturePage()).toPNG().toString('base64');
  });
  fs.writeFileSync(filePath, Buffer.from(png, 'base64'));
}

export async function launchTessraHarness(testId: string, options: { userSettings?: Record<string, unknown> } = {}): Promise<TessraHarness> {
  const vsixPath = process.env.TESSRA_E2E_VSIX ? path.resolve(process.env.TESSRA_E2E_VSIX) : undefined;
  if (vsixPath && (!vsixPath.toLowerCase().endsWith('.vsix') || !fs.statSync(vsixPath).isFile())) {
    throw new Error(`TESSRA_E2E_VSIX must point to a local VSIX file: ${vsixPath}`);
  }
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), `tessra-e2e-${testId}-`));
  const userDataDir = path.join(runRoot, 'user-data');
  const extensionsDir = path.join(runRoot, 'extensions');
  const workspaceDir = path.join(runRoot, 'workspace');
  fs.mkdirSync(userDataDir, { recursive: true });
  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.mkdirSync(workspaceDir, { recursive: true });
  fs.writeFileSync(path.join(workspaceDir, 'README.md'), '# Tessra E2E workspace\n', 'utf8');

  const server = await startFixtureServer({ slowMs: 3000 });
  seedTessraStorage({ userDataDir, baseUrl: server.baseUrl, userSettings: options.userSettings });

  const executablePath = await downloadAndUnzipVSCode(VSCODE_E2E_VERSION);
  if (vsixPath) {
    try {
      // 설치 검증도 사용자 프로필 대신 매 테스트의 격리 디렉터리만 사용한다.
      await runVSCodeCommand([
        '--install-extension', vsixPath,
        `--user-data-dir=${userDataDir}`,
        `--extensions-dir=${extensionsDir}`,
      ], { version: VSCODE_E2E_VERSION, spawn: { windowsHide: true } });
    } catch (error) {
      await server.close();
      rmrf(runRoot);
      throw error;
    }
  }
  const args = [
    workspaceDir,
    ...(vsixPath ? [] : [`--extensionDevelopmentPath=${REPO_ROOT}`, '--disable-extensions']),
    `--user-data-dir=${userDataDir}`,
    `--extensions-dir=${extensionsDir}`,
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-telemetry',
    '--disable-updates',
    '--disable-gpu',
    '--no-sandbox',
    '--locale=en',
    '--new-window',
    '--window-size=1600,1000',
    // xvfb CI에는 OS 키체인이 없어 SecretStorage 쓰기가 실패한다. 격리 프로필의 synthetic 값만 쓰므로 basic 저장소를 쓴다.
    ...(process.platform === 'linux' ? ['--password-store=basic'] : []),
  ];

  const app = await electron.launch({
    executablePath,
    args,
    env: {
      ...process.env,
      TESSRA_E2E: '1',
      TESSRA_E2E_BASE_URL: server.baseUrl,
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
    },
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  // Wait until workbench shell is interactive.
  await page.locator('.monaco-workbench').waitFor({ state: 'visible', timeout: 60000 });
  // Tessra activity-bar contribution proves package.json contributes finished loading
  // (Linux CI otherwise races Command Palette before the extension host is ready).
  await page
    .locator('.activitybar [aria-label*="Tessra"], .activitybar .codicon[aria-label*="Tessra"], .activitybar .action-label[aria-label*="Tessra"]')
    .first()
    .waitFor({ state: 'visible', timeout: 90000 });
  try {
    const [width, height] = [1600, 1000];
    await page.setViewportSize({ width, height });
  } catch {
    /* Electron may ignore viewport; window-size arg still helps */
  }

  return {
    app,
    page,
    server,
    baseUrl: server.baseUrl,
    userDataDir,
    extensionsDir,
    workspaceDir,
    dispose: async () => {
      try {
        await app.close();
      } catch {
        /* ignore close races */
      }
      try {
        await server.close();
      } catch {
        /* ignore */
      }
      // Give Windows a moment to release Electron process handles before the next launch.
      await new Promise((resolve) => setTimeout(resolve, 750));
      rmrf(runRoot);
    },
  };
}

export async function captureFailureArtifacts(
  harness: TessraHarness,
  testName: string
): Promise<void> {
  const safe = testName.replace(/[^\w.-]+/g, '_').slice(0, 120);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = path.join(ARTIFACTS_DIR, `${safe}-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  try {
    await harness.page.screenshot({ path: path.join(dir, 'window.png'), fullPage: true });
  } catch {
    /* ignore */
  }
  try {
    const title = await harness.page.title();
    fs.writeFileSync(
      path.join(dir, 'meta.json'),
      JSON.stringify(
        {
          title,
          vscodeVersion: VSCODE_E2E_VERSION,
          baseUrl: harness.baseUrl,
          requestLog: harness.server.requests,
        },
        null,
        2
      ),
      'utf8'
    );
  } catch {
    /* ignore */
  }
}

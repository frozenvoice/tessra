import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { downloadAndUnzipVSCode } from '@vscode/test-electron';
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

export async function launchTessraHarness(testId: string): Promise<TessraHarness> {
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
  seedTessraStorage({ userDataDir, baseUrl: server.baseUrl });

  const executablePath = await downloadAndUnzipVSCode(VSCODE_E2E_VERSION);
  const args = [
    workspaceDir,
    `--extensionDevelopmentPath=${REPO_ROOT}`,
    `--user-data-dir=${userDataDir}`,
    `--extensions-dir=${extensionsDir}`,
    '--disable-extensions',
    '--disable-workspace-trust',
    '--skip-welcome',
    '--skip-release-notes',
    '--disable-telemetry',
    '--disable-updates',
    '--disable-gpu',
    '--no-sandbox',
    '--new-window',
    '--window-size=1600,1000',
  ];

  const app = await electron.launch({
    executablePath,
    args,
    env: {
      ...process.env,
      TESSRA_E2E: '1',
      TESSRA_E2E_BASE_URL: server.baseUrl,
    },
  });

  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  // Wait until workbench shell is interactive.
  await page.locator('.monaco-workbench').waitFor({ state: 'visible', timeout: 60000 });
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

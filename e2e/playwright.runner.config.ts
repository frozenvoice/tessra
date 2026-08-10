import { defineConfig } from '@playwright/test';
import * as path from 'path';

const artifacts = path.join(__dirname, '.artifacts');

/** Collection Runner UI specs — opt-in via `npm run test:e2e:runner` (flaky context-menu path). */
export default defineConfig({
  testDir: path.join(__dirname, 'specs', 'runner'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 20_000 },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(artifacts, 'playwright-report-runner'), open: 'never' }],
  ],
  outputDir: path.join(artifacts, 'test-results-runner'),
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});

import { defineConfig } from '@playwright/test';
import * as path from 'path';

const artifacts = path.join(__dirname, '.artifacts');

export default defineConfig({
  testDir: path.join(__dirname, 'specs'),
  testIgnore: ['**/runner/**'],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 180_000,
  expect: {
    timeout: 20_000,
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(artifacts, 'playwright-report'), open: 'never' }],
  ],
  outputDir: path.join(artifacts, 'test-results'),
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});

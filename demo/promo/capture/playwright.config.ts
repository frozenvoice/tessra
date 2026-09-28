import { defineConfig } from '@playwright/test';
import * as path from 'path';

// Not part of the e2e suite: drives the real extension to record promo footage.
export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.capture\.ts$/,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 20_000 },
  reporter: [['list']],
  outputDir: path.join(__dirname, '..', '.capture', 'test-results'),
});

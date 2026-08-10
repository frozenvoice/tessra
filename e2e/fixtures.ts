import { test as base, expect } from '@playwright/test';
import { captureFailureArtifacts, launchTessraHarness, type TessraHarness } from './helpers/vscode';

type TessraFixtures = {
  tessra: TessraHarness;
};

export const test = base.extend<TessraFixtures>({
  tessra: async ({}, use, testInfo) => {
    const harness = await launchTessraHarness(`${testInfo.parallelIndex}`);
    await use(harness);
    if (testInfo.status !== testInfo.expectedStatus) {
      await captureFailureArtifacts(harness, testInfo.title);
    }
    await harness.dispose();
  },
});

export { expect };

import { test as base, expect } from '@playwright/test';
import { captureFailureArtifacts, launchTessraHarness, type TessraHarness } from './helpers/vscode';

type TessraFixtures = {
  tessra: TessraHarness;
  userSettings: Record<string, unknown>;
};

export const test = base.extend<TessraFixtures>({
  userSettings: [{}, { option: true }],
  tessra: async ({ userSettings }, use, testInfo) => {
    const harness = await launchTessraHarness(`${testInfo.parallelIndex}`, { userSettings });
    await use(harness);
    if (testInfo.status !== testInfo.expectedStatus) {
      await captureFailureArtifacts(harness, testInfo.title);
    }
    await harness.dispose();
  },
});

export { expect };

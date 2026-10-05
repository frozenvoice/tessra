import * as fs from 'fs';
import * as path from 'path';
import type { FrameLocator, Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { openNewRequestPanel, fillUrl, openHeadersTab, clickSend, waitForResponseStatus, runCommand } from '../helpers/webview';

const SECRET = 'synthetic-secret-ui-9348-LOCAL-FIXTURE';
const REPLACEMENT = 'synthetic-secret-rotated-9348-LOCAL-FIXTURE';

function environmentVariables(userDataDir: string): Array<Record<string, any>> {
  const file = path.join(userDataDir, 'User/globalStorage/frozenvoice.tessra/environments.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')).find((env: { id: string }) => env.id === 'env-e2e').variables;
}

async function variableRow(frame: FrameLocator, key: string) {
  const rows = frame.locator('[data-testid="environment-var-rows"] .env-variable-row');
  for (let index = 0; index < await rows.count(); index++) {
    if (await rows.nth(index).locator('.js-env-key').inputValue() === key) return rows.nth(index);
  }
  throw new Error('Synthetic variable row is missing: ' + key);
}

async function saveCustomVSCodeDialog(page: Page, destination: string): Promise<void> {
  // files.simpleDialog.enable routes the production save dialog through VS Code's native quick input.
  const input = page.locator('.quick-input-widget .input');
  await expect(input).toBeVisible();
  await input.fill(destination);
  await input.press('Enter');
  await expect.poll(() => fs.existsSync(destination), { timeout: 20000 }).toBe(true);
}

function readJsonArtifacts(directory: string): string[] {
  const artifacts: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) artifacts.push(...readJsonArtifacts(target));
    else if (entry.name.endsWith('.json')) artifacts.push(fs.readFileSync(target, 'utf8'));
  }
  return artifacts;
}

test.describe('E2E #29 Explicit secret variables', () => {
  test.use({ userSettings: { 'window.dialogStyle': 'custom', 'files.simpleDialog.enable': true } });
  test('protects and rotates via keychain, masks messages/export, preserves reference IDs and sends real fixture bytes', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    await frame.locator('[data-testid="status-environment"]').click();
    await expect(frame.locator('[data-testid="environment-disclosure"]')).toBeVisible();
    let token = await variableRow(frame, 'token');
    await token.locator('.js-env-value').fill(SECRET);
    await token.locator('.js-env-value').blur();
    await expect.poll(() => environmentVariables(tessra.userDataDir).find(v => v.key === 'token')?.value).toBe(SECRET);
    await token.locator('[data-secret-action="protect"]').click();
    await expect.poll(() => !!environmentVariables(tessra.userDataDir).find(v => v.key === 'token')?.secretRef).toBe(true);
    const protectedVariable = environmentVariables(tessra.userDataDir).find(v => v.key === 'token')!;
    expect(protectedVariable.value).toBeUndefined();
    expect(protectedVariable.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(protectedVariable.secretPendingRef).toBeUndefined();
    token = await variableRow(frame, 'token');
    await expect(token.locator('.js-env-value')).toHaveValue('');
    await expect(token.locator('.js-env-value')).toHaveAttribute('readonly', '');
    await expect(token.locator('.secret-state')).toContainText(/protected/i);

    // Observe the real inbound Webview channel without exposing production internals.
    await frame.locator('body').evaluate(() => {
      const messages: unknown[] = [];
      (document.body as any).__observedSecretMessages = messages;
      window.addEventListener('message', event => messages.push(event.data));
    });
    await frame.locator('[data-testid="environment-disclosure-close"]').click();
    await frame.locator('[data-testid="status-environment"]').click();
    token = await variableRow(frame, 'token');
    await expect(token.locator('.js-env-value')).toHaveValue('');
    await token.locator('[data-secret-action="set"]').click();
    const password = tessra.page.locator('.quick-input-widget input[type="password"]');
    await expect(password).toBeVisible();
    await password.fill(REPLACEMENT);
    await password.press('Enter');
    await expect(password).not.toBeVisible();
    await expect.poll(() => environmentVariables(tessra.userDataDir).find(v => v.key === 'token')?.secretRef?.id).not.toBe(protectedVariable.secretRef.id);
    const replacementVariable = environmentVariables(tessra.userDataDir).find(v => v.key === 'token')!;
    expect(replacementVariable.id).toBe(protectedVariable.id);
    // Disk commit and Webview metadata delivery are separate asynchronous boundaries.
    // Wait for the production row to receive the rotated reference before another edit.
    await expect.poll(async () => {
      const current = await variableRow(frame, 'token');
      return current.evaluate(element => {
        const row = element as HTMLElement & { _variableMetadata?: { secretRef?: { id: string } }; _secretState?: string };
        return { id: row._variableMetadata?.secretRef?.id, state: row._secretState };
      });
    }).toEqual({ id: replacementVariable.secretRef.id, state: 'set' });
    token = await variableRow(frame, 'token');
    await expect(token.locator('[data-secret-action="set"]')).toBeEnabled();
    await expect(token.locator('.js-env-value')).toHaveValue('');
    await token.locator('.js-env-key').fill('fixtureSecret');
    await token.locator('.js-env-key').blur();
    await expect.poll(() => environmentVariables(tessra.userDataDir).find(v => v.key === 'fixtureSecret')?.id).toBe(protectedVariable.id);
    expect(environmentVariables(tessra.userDataDir).find(v => v.key === 'fixtureSecret')!.secretRef.id).toBe(replacementVariable.secretRef.id);
    const defaultMessages = await frame.locator('body').evaluate(() => JSON.stringify((document.body as any).__observedSecretMessages));
    expect(defaultMessages).not.toContain(SECRET);
    expect(defaultMessages).not.toContain(REPLACEMENT);
    await frame.locator('[data-testid="environment-disclosure-close"]').click();

    await fillUrl(frame, '{{baseUrl}}/users');
    await openHeadersTab(frame);
    await frame.locator('.js-add-header').click();
    const header = frame.locator('[data-testid="request-headers"] .kv-row').last();
    await header.locator('input[type="text"]').first().fill('X-Synthetic-Secret');
    await header.locator('.js-kv-value').fill('{{fixtureSecret}}');
    await clickSend(frame);
    await waitForResponseStatus(frame, '200');
    const request = await tessra.server.waitForRequest(req => req.pathname === '/users');
    expect(request.headers['x-synthetic-secret']).toBe(REPLACEMENT);
    const storageRoot = path.join(tessra.userDataDir, 'User/globalStorage/frozenvoice.tessra');
    await expect.poll(() => JSON.parse(fs.readFileSync(path.join(storageRoot, 'history.json'), 'utf8')).length).toBe(1);
    const disk = readJsonArtifacts(storageRoot).join('\n');
    expect(disk).not.toContain(SECRET);
    expect(disk).not.toContain(REPLACEMENT);
    expect(disk).toContain('{{fixtureSecret}}');
    await frame.locator('[data-testid="request-overflow"]').click();
    await frame.locator('.js-copy-curl').click();
    const curl = await tessra.app.evaluate(({ clipboard }) => clipboard.readText());
    expect(curl).not.toContain(REPLACEMENT);
    expect(curl).not.toContain(SECRET);
    const backupPath = path.join(tessra.workspaceDir, 'synthetic-secret-backup.json');
    await runCommand(tessra.page, 'Tessra: Export Workspace Backup');
    await saveCustomVSCodeDialog(tessra.page, backupPath);
    const backupText = fs.readFileSync(backupPath, 'utf8');
    expect(backupText).not.toContain(SECRET);
    expect(backupText).not.toContain(REPLACEMENT);
    const backup = JSON.parse(backupText);
    const exportedVariable = backup.data.environments.find((env: { id: string }) => env.id === 'env-e2e').variables.find((v: { key: string }) => v.key === 'fixtureSecret');
    expect(exportedVariable.value).toBeUndefined();
    expect(exportedVariable.id).toBe(protectedVariable.id);
    expect(exportedVariable.secretRef.id).toBe(replacementVariable.secretRef.id);

    await frame.locator('[data-testid="status-environment"]').click();
    token = await variableRow(frame, 'fixtureSecret');
    await token.locator('[data-secret-action="reveal"]').click();
    await expect(token.locator('.js-env-value')).toHaveValue(REPLACEMENT);
    await expect(token.locator('.js-env-value')).toHaveAttribute('type', 'text');
    await frame.locator('[data-testid="environment-disclosure-close"]').click();
    await expect(token.locator('.js-env-value')).toHaveValue('');
    expect(readJsonArtifacts(storageRoot).join('\n')).not.toContain(REPLACEMENT);
    await runCommand(tessra.page, 'Tessra: Edit Workspace Variables');
    await expect(frame.locator('#workspaceVariablesNote')).toBeVisible();
    await expect(frame.locator('#workspaceVariablesNote')).toContainText(/backup|not.*request/i);
    await expect(frame.locator('[data-testid="environment-add-variable"]')).toBeEnabled();
    const dir = path.resolve('e2e/.artifacts/secret-variables');
    fs.mkdirSync(dir, { recursive: true });
    await tessra.page.screenshot({ path: path.join(dir, 'workspace-variables.png') });
  });
});

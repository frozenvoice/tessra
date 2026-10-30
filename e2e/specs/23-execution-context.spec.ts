import * as fs from 'fs';
import * as path from 'path';
import { test, expect } from '../fixtures';
import { clickSend, fillUrl, getRequestWebview, openNewRequestPanel, runCommand, waitForResponseStatus } from '../helpers/webview';

test.describe('E2E #23 실행 중 환경과 프로필 전환', () => {
  test('늦은 응답이 전환한 환경과 새 프로필을 오염시키지 않는다', async ({ tessra }) => {
    let frame = await openNewRequestPanel(tessra.page);
    const storageRoot = path.join(tessra.userDataDir, 'User', 'globalStorage', 'frozenvoice.tessra');
    const readJson = (file: string, fallback: unknown) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
    await fillUrl(frame, `${tessra.baseUrl}/held`);
    await clickSend(frame);
    await tessra.server.waitForRequest(request => request.pathname === '/held');

    await runCommand(tessra.page, 'Tessra: Switch Environment');
    await tessra.page.locator('.quick-input-list .monaco-list-row').filter({ hasText: 'Execution B' }).click();
    await expect(frame.locator('[data-testid="status-environment"]')).toContainText('Execution B');
    tessra.server.releaseHeldRequests();
    await waitForResponseStatus(frame, /200/);
    const environments = readJson(path.join(storageRoot, 'environments.json'), []);
    expect(environments.find((env: { id: string }) => env.id === 'env-execution-b').variables)
      .toMatchObject([{ key: 'envName', value: 'preserved-b', enabled: true }]);
    expect(environments.find((env: { id: string }) => env.id === 'env-execution-b').variables[0].id).toMatch(/^[0-9a-f-]{36}$/i);

    tessra.server.clearRequests();
    await fillUrl(frame, `${tessra.baseUrl}/held`);
    await clickSend(frame);
    await tessra.server.waitForRequest(request => request.pathname === '/held');
    await runCommand(tessra.page, 'Tessra: Change Workspace Profile');
    await tessra.page.locator('.quick-input-list .monaco-list-row').filter({ hasText: 'Create New Profile' }).click();
    const profileInput = tessra.page.locator('.quick-input-widget .input');
    await profileInput.fill('execution-isolation');
    await profileInput.press('Enter');
    frame = getRequestWebview(tessra.page);
    await expect(frame.locator('[data-testid="request-url"]')).toHaveValue('');
    tessra.server.releaseHeldRequests();

    // 새 프로필의 정상 요청까지 완료시켜 응답/저장 경로를 확인한다.
    await fillUrl(frame, `${tessra.baseUrl}/users`);
    await clickSend(frame);
    await waitForResponseStatus(frame, /200/);
    const profileDir = path.join(storageRoot, 'profiles', `profile-${Buffer.from('execution-isolation').toString('base64url')}`);
    await expect.poll(() => (readJson(path.join(profileDir, 'history.json'), []) as unknown[]).length).toBe(1);
    const history = readJson(path.join(profileDir, 'history.json'), []);
    expect(history[0].request.url).toBe(`${tessra.baseUrl}/users`);
    expect(readJson(path.join(profileDir, 'environments.json'), [])).toEqual([]);
  });
});

import { test, expect } from '../fixtures';
import {
  clickSend,
  fillUrl,
  openNewRequestPanel,
  openScriptsTab,
  setScriptEditors,
  waitForResponseStatus,
  waitForPassedTest,
} from '../helpers/webview';

const ABC_SHA256 = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

test.describe('E2E #10 Script utilities', () => {
  test('pre-request HMAC + test assertions for SHA/Base64', async ({ tessra }) => {
    const frame = await openNewRequestPanel(tessra.page);
    await fillUrl(frame, `${tessra.baseUrl}/users`);

    await openScriptsTab(frame);
    await setScriptEditors(frame, {
      preRequest: `
pm.environment.set(
  "signature",
  pm.crypto.hmacSha256("payload", "secret")
);
`.trim(),
      test: `
pm.test("script utilities work", function () {
  pm.expect(pm.crypto.sha256("abc")).to.equal("${ABC_SHA256}");
  pm.expect(pm.encoding.base64Decode(pm.encoding.base64Encode("Tessra"))).to.equal("Tessra");
  pm.expect(pm.environment.get("signature")).to.match(/^[0-9a-f]{64}$/);
});
`.trim(),
    });

    await clickSend(frame);
    await tessra.server.waitForRequest((r) => r.pathname === '/users' && r.method === 'GET');
    await waitForResponseStatus(frame, /200/);
    await waitForPassedTest(frame, 'script utilities work');
  });
});

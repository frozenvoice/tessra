import * as http from 'http';
import type { AddressInfo } from 'net';
import { test, expect } from '../fixtures';
import { clickSend, fillUrl, openNewRequestPanel, waitForResponseStatus } from '../helpers/webview';

test.describe('E2E #24 Offline HTML preview', () => {
  test('sanitizes hostile responses while preserving static content and local links under nonce CSP', async ({ tessra }) => {
    const requestedPaths: string[] = [];
    const attack = 'document.body.setAttribute("data-preview-attack", "executed")';
    let sourceUrl = '';
    const server = http.createServer((request, response) => {
      requestedPaths.push(request.url || '/');
      if (request.url !== '/preview') {
        response.writeHead(204);
        response.end();
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      response.end(`<!doctype html><html lang="en"><head>
        <title>Offline fixture preview</title><meta name="description" content="Useful local snapshot">
        <script src="${sourceUrl}/blocked/script"></script><script>${attack}</script>
        <style>@import url('${sourceUrl}/blocked/style');</style>
        <link rel="stylesheet" href="${sourceUrl}/blocked/stylesheet">
        <base href="${sourceUrl}/blocked/base">
        <meta http-equiv="refresh" content="0;url=${sourceUrl}/blocked/refresh">
      </head><body>
        <h2>Useful static response content</h2>
        <p id="preview-event-target" onclick='${attack}' onmouseover='${attack}' onfocus='${attack}'
          style="background:url('${sourceUrl}/blocked/inline-style')">A normal paragraph remains readable after sanitization.</p>
        <a id="preview-local-link" href="#preview-local-section" ping="${sourceUrl}/blocked/ping">Jump to local section</a>
        <a id="preview-external-link" href="${sourceUrl}/blocked/html-link">External link text remains</a>
        <a id="preview-script-link" href="javascript:alert(1)">Script link text remains</a>
        <svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
          <a id="preview-svg-external" xlink:href="${sourceUrl}/blocked/svg-link"><text y="20">External SVG link text</text></a>
          <a id="preview-svg-local" xlink:href="#preview-local-section"><text y="40">Local SVG link</text></a>
          <a id="preview-svg-animated" href="#preview-local-section"><text y="60">Animated SVG link</text>
            <set attributeName="href" to="${sourceUrl}/blocked/smil-set" begin="0s"></set>
          </a>
          <a id="preview-svg-animate" href="#preview-local-section"><text y="80">Second animated SVG link</text>
            <animate attributeName="href" values="#preview-local-section;${sourceUrl}/blocked/smil-animate"
              calcMode="discrete" dur="0.01s" fill="freeze"></animate>
          </a>
          <image xlink:href="${sourceUrl}/blocked/svg-image" width="10" height="10"></image>
        </svg>
        <img id="preview-external-image" src="${sourceUrl}/blocked/image" srcset="${sourceUrl}/blocked/image-2x 2x"
          onerror='${attack}' onload='${attack}' alt="Blocked remote image">
        <img id="preview-data-image" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Embedded image">
        <table background="${sourceUrl}/blocked/background"><tbody><tr><td>Static table cell</td></tr></tbody></table>
        <form action="${sourceUrl}/blocked/form"><button formaction="${sourceUrl}/blocked/button">Static button</button></form>
        <iframe src="${sourceUrl}/blocked/iframe"></iframe><object data="${sourceUrl}/blocked/object"></object>
        <embed src="${sourceUrl}/blocked/embed"><audio src="${sourceUrl}/blocked/audio"></audio>
        <video poster="${sourceUrl}/blocked/poster"><source src="${sourceUrl}/blocked/video"><track src="${sourceUrl}/blocked/track"></video>
        <noscript>Unsafe fallback omitted</noscript><p id="preview-local-section">Local section remains accessible.</p>
      </body></html>`);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    sourceUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    try {
      const frame = await openNewRequestPanel(tessra.page);
      await fillUrl(frame, `${sourceUrl}/preview`);
      await clickSend(frame);
      await waitForResponseStatus(frame, /^200/);
      const preview = frame.locator('#responsePreviewPanel');
      const snapshot = preview.locator('.preview-snapshot');
      const previewScript = frame.locator('script[src*="/dist/htmlPreview.js"]');
      await expect(previewScript).toHaveCount(1);
      const previewAsset = await previewScript.evaluate((element) => {
        const script = element as HTMLScriptElement;
        const policy = script.ownerDocument.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') || '';
        return { url: script.src, nonce: script.nonce, policy };
      });
      expect(previewAsset.url).toMatch(/^https:\/\/[^/]+\.vscode-cdn\.net\//);
      expect(previewAsset.url).toContain('/dist/htmlPreview.js');
      expect(previewAsset.nonce).toBeTruthy();
      expect(previewAsset.policy).toContain(`'nonce-${previewAsset.nonce}'`);
      await expect(preview).toBeVisible();
      await expect(frame.locator('[data-tab="resPreview"]')).toHaveAttribute('aria-selected', 'true');
      await expect(preview.locator('.preview-title')).toHaveText('Offline fixture preview');
      await expect(preview.getByTestId('preview-blocked-assets')).toHaveText('19');
      await expect(snapshot.locator('h2')).toHaveText('Useful static response content');
      await expect(snapshot.locator('td')).toHaveText('Static table cell');
      await expect(snapshot.locator('#preview-local-link')).toHaveAttribute('href', '#preview-local-section');
      await expect(snapshot.locator('#preview-svg-local')).toHaveAttribute('xlink:href', '#preview-local-section');
      await expect.poll(async () => ({
        set: await snapshot.locator('#preview-svg-animated').evaluate((node) => (node as SVGAnchorElement).href.animVal),
        animate: await snapshot.locator('#preview-svg-animate').evaluate((node) => (node as SVGAnchorElement).href.animVal),
      })).toEqual({ set: '#preview-local-section', animate: '#preview-local-section' });
      await expect(snapshot.locator('#preview-data-image')).toHaveAttribute('src', /^data:image\/gif;base64,/);
      await expect.poll(() => snapshot.locator('#preview-data-image').evaluate((node) => {
        const image = node as HTMLImageElement;
        return image.complete && image.naturalWidth > 0;
      })).toBe(true);
      await expect(snapshot.locator('#preview-external-link')).toHaveText('External link text remains');
      await expect(snapshot.locator('script,style,noscript,iframe,object,embed,link,source,audio,video,track,base,set,animate,meta')).toHaveCount(0);

      const unsafeAttributes = await snapshot.evaluate((element) => Array.from(element.querySelectorAll('*')).flatMap((node) =>
        Array.from(node.attributes).filter((attribute) => attribute.name.startsWith('on')
          || ['style', 'srcset', 'ping', 'background', 'action', 'formaction'].includes(attribute.name)
          || (['src', 'href', 'xlink:href', 'poster'].includes(attribute.name)
            && !attribute.value.startsWith('#') && !attribute.value.startsWith('data:')))
          .map((attribute) => `${node.tagName}:${attribute.name}`)));
      expect(unsafeAttributes).toEqual([]);
      await snapshot.locator('#preview-event-target').click();
      await snapshot.locator('#preview-local-link').click();
      await expect(frame.locator('body')).not.toHaveAttribute('data-preview-attack', 'executed');
      await expect(frame.locator('[data-testid="request-url"]')).toHaveValue(`${sourceUrl}/preview`);

      // 기존 nonce 정책이 실제로 무nonce 스크립트 실행을 막는지 확인한다.
      const policy = await frame.locator('body').evaluate(async (body) => {
        const doc = body.ownerDocument;
        const csp = doc.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') || '';
        // VS Code는 CSP 앞에 자체 API bootstrap을 주입한다. 확장 소유 스크립트의 nonce를 확인한다.
        const nonces = Array.from(doc.scripts).filter((script) => script.id !== '_vscodeApiScript').map((script) => script.nonce);
        const blocked = await new Promise<boolean>((resolve) => {
          const script = doc.createElement('script');
          const listener = (event: SecurityPolicyViolationEvent) => {
            if (!event.violatedDirective.startsWith('script-src') || event.blockedURI !== 'inline') return;
            doc.removeEventListener('securitypolicyviolation', listener);
            script.remove();
            resolve(true);
          };
          doc.addEventListener('securitypolicyviolation', listener);
          script.textContent = 'document.body.setAttribute("data-preview-csp-bypass", "executed")';
          body.appendChild(script);
          setTimeout(() => {
            doc.removeEventListener('securitypolicyviolation', listener);
            script.remove();
            resolve(false);
          }, 500);
        });
        return { csp, nonces, blocked, executed: body.getAttribute('data-preview-csp-bypass') };
      });
      expect(policy.csp).toContain("default-src 'none'");
      const scriptPolicy = policy.csp.split(';').find((directive) => directive.trim().startsWith('script-src')) || '';
      expect(scriptPolicy).not.toContain("'unsafe-inline'");
      const nonce = scriptPolicy.match(/'nonce-([^']+)'/)?.[1];
      expect(nonce).toBeTruthy();
      expect(policy.nonces.length).toBeGreaterThan(0);
      expect(policy.nonces.every((value) => value === nonce)).toBe(true);
      expect(policy.blocked).toBe(true);
      expect(policy.executed).toBeNull();
      expect(requestedPaths).toEqual(['/preview']);
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
});

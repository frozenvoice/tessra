// 실제 캡처의 UI 영역을 렌더링 좌표로 투영해 대표 프레임의 viewport 잘림을 검사한다.
// Usage: node demo/promo/check-camera.cjs [--source path/to/composition.html] [--out report.json] [--stills-dir path]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const args = process.argv.slice(2);
const opt = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const output = path.resolve(opt('--out', path.join(__dirname, '.capture/preview/camera-geometry.json')));
const stillsDir = path.resolve(opt('--stills-dir', path.join(path.dirname(output), 'stills')));

(async () => {
  const clip = JSON.parse(fs.readFileSync(path.join(__dirname, '.capture/session/clip.json'), 'utf8'));
  if (!clip.regions || !['Help', 'Run: Demo API', 'Total'].every(name => clip.regions[name])) {
    throw new Error('Capture regions missing — record a new session before checking camera geometry');
  }
  const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' })).catch(() => chromium.launch({ channel: 'msedge' }));
  try {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.mkdirSync(stillsDir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    let composition = path.join(__dirname, 'tessra-promo.html');
    if (args.includes('--source')) {
      const source = fs.readFileSync(path.resolve(opt('--source')), 'utf8');
      composition = path.join(stillsDir, 'composition.html');
      fs.writeFileSync(composition, source.replace('<head>', `<head><base href="${pathToFileURL(__dirname + path.sep).href}">`));
    }
    await page.goto(pathToFileURL(composition).href);
    await page.evaluate(() => document.fonts.ready);
    const regions = [];
    for (const [name, rect] of Object.entries(clip.regions)) {
      const time = await page.evaluate(t => videoAt(t), rect.t);
      await page.evaluate(t => window.seek(t), time);
      const geometry = await page.evaluate(({ rect, size }) => {
        const frame = document.getElementById('frame').getBoundingClientRect();
        const shot = document.getElementById('shot');
        const box = shot.getBoundingClientRect();
        const outerScale = box.width / shot.offsetWidth;
        const viewport = { left: box.left + shot.clientLeft * outerScale, top: box.top + shot.clientTop * outerScale,
          right: box.left + (shot.clientLeft + shot.clientWidth) * outerScale, bottom: box.top + (shot.clientTop + shot.clientHeight) * outerScale };
        const projected = { left: frame.left + rect.x * frame.width / size.width, top: frame.top + rect.y * frame.height / size.height,
          right: frame.left + (rect.x + rect.width) * frame.width / size.width, bottom: frame.top + (rect.y + rect.height) * frame.height / size.height };
        return { viewport, projected, marginLeft: projected.left - viewport.left, marginTop: projected.top - viewport.top,
          clippedLeft: Math.max(0, viewport.left - projected.left), clippedRight: Math.max(0, projected.right - viewport.right),
          clippedTop: Math.max(0, viewport.top - projected.top), clippedBottom: Math.max(0, projected.bottom - viewport.bottom) };
      }, { rect, size: clip.window });
      const screenshot = path.join(stillsDir, name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/-$/, '') + '.png');
      await page.screenshot({ path: screenshot });
      regions.push({ name, time, source: rect, ...geometry, screenshot });
    }
    fs.writeFileSync(output, JSON.stringify({ viewport: { width: 1920, height: 1080 }, duration: await page.evaluate(() => window.DURATION), regions }, null, 2) + '\n');
    console.log(JSON.stringify({ output, regions: regions.map(({ name, time, marginLeft, clippedLeft, clippedRight, clippedTop, clippedBottom }) => ({ name, time, marginLeft, clippedLeft, clippedRight, clippedTop, clippedBottom })) }, null, 2));
    if (regions.some(r => Math.max(r.clippedLeft, r.clippedRight, r.clippedTop, r.clippedBottom) > 0.5)) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

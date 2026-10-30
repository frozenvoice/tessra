// 실제 캡처의 UI 영역이 카메라 프레임 안에 들어오는지 검사하고 대표 프레임을 저장한다.
// Each camera target recorded by capture/record.capture.ts is projected through the composition's camera at the
// moment it is framed (in the shot's own plane, so the 3D tilt does not matter) and must stay inside the viewport.
// Usage: node demo/promo/check-camera.cjs [--out report.json] [--stills-dir path]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const args = process.argv.slice(2);
const opt = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const output = path.resolve(opt('--out', path.join(__dirname, '.capture/preview/camera-geometry.json')));
const stillsDir = path.resolve(opt('--stills-dir', path.join(path.dirname(output), 'stills')));
// Region name → the clip moment its camera keyframe is fully settled.
const TARGETS = { 'request-bar': 'type-end', 'response-1': 'response-1', palette: 'pick-staging', env: 'env-switched', 'response-2': 'response-2', runner: 'runner-done', sse: 'sse-done' };

(async () => {
  const clip = JSON.parse(fs.readFileSync(path.join(__dirname, '.capture/session/clip.json'), 'utf8'));
  const missing = Object.keys(TARGETS).filter((name) => !clip.regions || !clip.regions[name]);
  if (missing.length) throw new Error(`Capture regions missing (${missing.join(', ')}) — record a new session first`);
  const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' })).catch(() => chromium.launch({ channel: 'msedge' }));
  try {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.mkdirSync(stillsDir, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(path.join(__dirname, 'tessra-promo.html')).href);
    await page.evaluate(() => document.fonts.ready);
    const regions = [];
    for (const [name, markName] of Object.entries(TARGETS)) {
      const rect = clip.regions[name];
      const settle = name.startsWith('response') || name === 'env' ? 0.45 : name === 'runner' ? 0.3 : 0.15;
      const result = await page.evaluate(({ rect, mark, settle }) => {
        const time = videoAt(clip(mark) + settle);
        if (time === null) return { time: null };
        const [cx, cy, s] = camAt(clipAt(time), beatAt(time));
        const shot = document.getElementById('shot');
        const k = shot.offsetWidth / 1600 * s, ox = cx - 800 / s, oy = cy - 450 / s;
        const left = (rect.x - ox) * k, top = (rect.y - oy) * k;
        const right = (rect.x + rect.width - ox) * k, bottom = (rect.y + rect.height - oy) * k;
        return { time, camera: [cx, cy, s], projected: { left, top, right, bottom },
          clippedLeft: Math.max(0, -left), clippedTop: Math.max(0, -top),
          clippedRight: Math.max(0, right - shot.offsetWidth), clippedBottom: Math.max(0, bottom - shot.offsetHeight) };
        function clip(n) { return window.CLIP.marks[n].t; }
      }, { rect, mark: markName, settle });
      if (result.time === null) throw new Error(`${name}: ${markName} is cut out of the edit`);
      await page.evaluate((t) => window.seek(t), result.time);
      const screenshot = path.join(stillsDir, `camera-${name}.png`);
      await page.screenshot({ path: screenshot });
      regions.push({ name, source: rect, ...result, screenshot });
    }
    fs.writeFileSync(output, JSON.stringify({ duration: await page.evaluate(() => window.DURATION), regions }, null, 2) + '\n');
    console.log(JSON.stringify(regions.map(({ name, time, camera, clippedLeft, clippedRight, clippedTop, clippedBottom }) =>
      ({ name, time: +time.toFixed(2), scale: +camera[2].toFixed(2), clippedLeft, clippedRight, clippedTop, clippedBottom })), null, 2));
    if (regions.some((r) => Math.max(r.clippedLeft, r.clippedRight, r.clippedTop, r.clippedBottom) > 0.5)) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

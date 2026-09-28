// Renders tessra-promo.html frame-by-frame, synthesizes the soundtrack, and muxes both into an MP4.
// Usage: node demo/promo/render.cjs [--fps 30] [--out demo/promo/tessra-promo.mp4] [--stills 1,8,12.8] [--audio-only]
//   --audio-only  reuse the last rendered picture (.capture/video.mp4) and only rebuild the audio.
// Needs demo/promo/.capture/session from the capture step (see README.md) and ffmpeg with libx264 on PATH.
const { chromium } = require('playwright');
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { renderSoundtrack } = require('./soundtrack.cjs');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const fps = Number(opt('--fps', 30));
const out = path.resolve(opt('--out', path.join(__dirname, 'tessra-promo.mp4')));
const stills = opt('--stills', null);
const audioOnly = args.includes('--audio-only');
const work = path.join(__dirname, '.capture');
const videoOnly = path.join(work, 'video.mp4');
const wav = path.join(work, 'soundtrack.wav');

(async () => {
  // Fall back to installed Chrome/Edge when Playwright's bundled Chromium isn't downloaded.
  const browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' })).catch(() => chromium.launch({ channel: 'msedge' }));
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto(require('url').pathToFileURL(path.join(__dirname, 'tessra-promo.html')).href);
  await page.evaluate(() => document.fonts.ready);

  if (stills) {
    for (const t of stills.split(',').map(Number)) {
      await page.evaluate((t) => window.seek(t), t);
      await page.screenshot({ path: path.join(process.cwd(), `still-${t}.png`) });
    }
    await browser.close();
    return;
  }

  const timeline = await page.evaluate(() => window.TIMELINE);
  fs.writeFileSync(path.join(work, 'timeline.json'), JSON.stringify(timeline, null, 2));

  if (!audioOnly) {
    const total = Math.round(timeline.duration * fps);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', videoOnly],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = 0; f < total; f++) {
      await page.evaluate((t) => window.seek(t), f / fps);
      const buf = await page.screenshot({ type: 'png' });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      if (f % (fps * 4) === 0) process.stdout.write(`frame ${f}/${total}\n`);
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
  }
  await browser.close();

  renderSoundtrack(timeline, wav);
  // Normalize to streaming loudness (-14 LUFS, -1 dBTP) and mux.
  const mux = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', videoOnly, '-i', wav,
    '-af', 'highpass=f=25,loudnorm=I=-14:TP=-1.0:LRA=11', '-ar', '48000',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' });
  if (mux.status !== 0) throw new Error('ffmpeg mux failed');
  console.log('wrote', out);
})();

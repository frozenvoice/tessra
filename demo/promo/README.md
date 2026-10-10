# Tessra promo video

A 20-second highlight cut: 2560×1440, 60fps, H.264 + AAC stereo (−14 LUFS).

- `tessra-promo.mp4` / `tessra-promo-poster.jpg`: the rendered video and its poster frame (the settled end card). `render.cjs` writes both.
- `tessra-promo.html`: the composition, cut on a 120 BPM grid. Intro (0–2s), four footage beats (2–16s: compose & send, switch environments, run the collection and rerun failures, stream server-sent events), manifesto (16–18s), end card (18–20s). The beats are **real footage** of the extension recorded in VS Code. Open with `?play` to preview in a browser, or `?t=12.5` to view one moment (needs the capture below).
- `capture/`: Playwright script that packages this repo as a VSIX, installs it into a clean VS Code 1.99.3 (so the title bar reads like a normal install, not a development host), seeds a demo collection plus `local` / `staging` environments, runs two tiny local APIs (`capture/demoServer.ts`, including a finite `GET /events` SSE feed), and records the window with a CDP screencast. Besides timing marks it records the on-screen boxes of the request bar, responses, Command Palette, runner and SSE pane; the composition frames its camera from those boxes.
- `render.cjs`: renders the HTML frame by frame (Playwright + ffmpeg), then muxes the soundtrack. Output above the 1920×1080 layout size renders at a higher device scale factor rather than upscaling. `--audio-only` reuses the last picture and rebuilds only the sound.
- `check-camera.cjs`: projects each recorded camera target through the composition's camera at the moment it is framed, saves those frames, and fails if a target crosses the footage viewport.
- `soundtrack.cjs`: synthesizes the music and UI sound effects in code from the video's cue sheet (`window.TIMELINE`). There are no third-party audio assets, so there are no licensing concerns. The drop lands on the first footage frame, every cut gets a fill and crash, and key ticks, clicks and success/failure chimes follow the recorded events that stay in the edit.

## Rebuild

```bash
npm run build
npx playwright test -c demo/promo/capture/playwright.config.ts
node demo/promo/check-camera.cjs
node demo/promo/render.cjs
```

The capture writes a JPEG frame sequence plus timing marks to `demo/promo/.capture/session/` (git-ignored; the previous 44s capture was about 170MB). The composition reads those marks from `clip.js`, so captions, camera, the pointer and key hints stay in sync after a re-record. A full render takes a while: 1,200 frames at 2560×1440. `ffmpeg` needs libx264 (`scoop install ffmpeg` on Windows).

## Local preview and camera checks

Keep unpublished media under the ignored `.capture/preview/` directory.

To reuse an already validated VSIX without invoking package/build again (PowerShell):

```powershell
$env:PROMO_VSIX = (Resolve-Path 'tmp/tessra-validated.vsix').Path
npx playwright test -c demo/promo/capture/playwright.config.ts
Remove-Item Env:PROMO_VSIX
node demo/promo/check-camera.cjs
node demo/promo/render.cjs --preview
```

`PROMO_VSIX` must name an existing `.vsix` file; an invalid value fails instead of falling back to a rebuild. Without it, the original packaging workflow still applies.

`--preview` writes `demo/promo/.capture/preview/tessra-promo-preview.mp4` at 1280×720 / 15fps with the full timeline and soundtrack. Use `--fps 30 --width 1920` for a sharper preview. `--stills 2.5,7,11,14.5` writes PNGs under `.capture/preview/stills/`; override with `--stills-dir` if needed. Review the geometry JSON and the camera frames before separately deploying media and changing public README links.

## What is real, what is added

- Everything inside the VS Code frame is the running extension: the `{{variable}}` autocomplete, the responses, the environment switch from the Command Palette, Collection Runner → Rerun Failed, and the SSE event list. Status codes and results are the real ones.
- The demo APIs are local. `DELETE /users/7` returns 503 on its first call so the runner has a failure to rerun. `GET /events` sends ten events about 190ms apart and closes.
- Added in post: the soundtrack, captions, the 3D tilt and light sweeps, camera zoom and pan, a pointer drawn at the recorded click positions (the screencast doesn't capture the OS cursor), and key hints. Typing and waiting are sped up (up to about 2–3×) with eased speed ramps; results play near real time. Nothing is reordered, and steps between beats (opening the SSE tab) are cut.

Claims are limited to what `PRODUCT.md` confirms. `demo/**` is excluded by `.vscodeignore`, so none of this ships in the VSIX.

## Marketplace embed

The Marketplace keeps `<video>` with an absolute https `src`, but its sanitizer strips `muted`, `playsinline`, and `controls` (only `src`, `poster`, `autoplay`, `loop`, and `width` survive). Chrome and Edge only autoplay muted media, and a video without an audio track still needs `muted`, so a README video can never autoplay there. Relative paths are not rewritten either (microsoft/vsmarketplace#494), and GitHub `user-attachments` URLs only play for signed-in GitHub users.

So the README uses two pieces, both hosted in `frozenvoice/frozenvoice-assets` under `tessra/video/` and served through jsDelivr for correct content types:

- `tessra-demo.webp`: an animated WebP at the top, encoded from the MP4 by `encode-webp.py`. Images animate without a click everywhere, including VS Code's extension page and GitHub. It links to the MP4.
- `tessra-demo.mp4` with `tessra-demo-poster.jpg`: the full video with sound, as a `<video controls>` in the Screenshots section.

Rebuild the WebP after a new render:

```bash
python3 demo/promo/encode-webp.py demo/promo/tessra-promo.mp4 tessra-demo.webp
```

Do not use ffmpeg's `libwebp_anim` for this. It writes one keyframe and then only lossy sub-frame deltas, so errors build up across the loop: earlier text ghosts behind later panels and the dark gradients turn into blocks. `encode-webp.py` uses Pillow's WebPAnimEncoder and forces a keyframe every 10–20 frames (`--kmin` / `--kmax`). Its defaults are 1280px, 20fps and quality 82. It needs `ffmpeg`, plus Pillow with WebP support and numpy (`pip install pillow numpy`). Encoding takes several minutes. The Marketplace listing only changes when a new VSIX is published, because it renders the README packaged in the VSIX.

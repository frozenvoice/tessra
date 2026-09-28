# Tessra promo video

- `tessra-promo.mp4`: 44s, 1920×1080, 30fps, H.264 + AAC stereo (−14 LUFS)
- `tessra-promo-poster.jpg`: poster frame for web embeds
- `tessra-promo.html`: the composition. Intro, manifesto, feature grid and end card are HTML animation. The middle section is **real footage** of the extension recorded in a VS Code Extension Development Host. Open with `?play` to preview in a browser, or `?t=12.5` to view one moment (needs the capture below).
- `capture/`: Playwright script that packages this repo as a VSIX, installs it into a clean VS Code 1.99.3 (so the title bar reads like a normal install, not a development host), seeds a demo collection plus `local` / `staging` environments, runs two tiny local APIs (`capture/demoServer.ts`), and records the window with a CDP screencast.
- `render.cjs`: renders the HTML frame by frame (Playwright + ffmpeg), then muxes the soundtrack. `--audio-only` reuses the last picture and rebuilds only the sound.
- `soundtrack.cjs`: synthesizes the music and UI sound effects in code from the video's cue sheet (`window.TIMELINE`). There are no third-party audio assets, so there are no licensing concerns. The drop lands on the first footage frame; key ticks, clicks and success/failure chimes follow the recorded events.

## Rebuild

```bash
npm run build
npx playwright test -c demo/promo/capture/playwright.config.ts
node demo/promo/render.cjs --stills 12.5,16.5,24.5,31
node demo/promo/render.cjs
```

The capture writes a JPEG frame sequence plus timing marks to `demo/promo/.capture/session/` (git-ignored, about 170MB). The composition reads those marks from `clip.js`, so captions, camera zoom, the pointer and key hints stay in sync after a re-record. `ffmpeg` needs libx264 (`scoop install ffmpeg` on Windows).

## What is real, what is added

- Everything inside the VS Code frame is the running extension: the `{{variable}}` autocomplete, the response, the environment switch from the Command Palette, and Collection Runner → Rerun Failed. Timings and status codes are the real ones.
- The demo API is local. `DELETE /users/7` returns 503 on its first call so the runner has a failure to rerun.
- Added in post: the soundtrack, captions, camera zoom and pan, a pointer drawn at the recorded click positions (the screencast doesn't capture the OS cursor), key hints, and 1.2× speed on the environment and runner segments to cut waiting time.

Claims are limited to what `PRODUCT.md` confirms. `demo/**` is excluded by `.vscodeignore`, so none of this ships in the VSIX.

## Marketplace embed

The Marketplace keeps `<video>` with an absolute https `src`, but its sanitizer strips `muted`, `playsinline`, and `controls` (only `src`, `poster`, `autoplay`, `loop`, and `width` survive). Chrome and Edge only autoplay muted media, and a video without an audio track still needs `muted`, so a README video can never autoplay there. Relative paths are not rewritten either (microsoft/vsmarketplace#494), and GitHub `user-attachments` URLs only play for signed-in GitHub users.

So the README uses two pieces, both hosted in `frozenvoice/frozenvoice-assets` under `tessra/video/` and served through jsDelivr for correct content types:

- `tessra-demo.webp`: an animated WebP at the top (1280px, 15fps, about 3.3MB). Images animate without a click everywhere, including VS Code's extension page and GitHub. It links to the MP4.
- `tessra-demo.mp4` with `tessra-demo-poster.jpg`: the full video with sound, as a `<video controls>` in the Screenshots section.

Rebuild the WebP after a new render:

```bash
ffmpeg -i demo/promo/tessra-promo.mp4 -vf "fps=15,scale=1280:-1:flags=lanczos" -an -c:v libwebp_anim -lossless 0 -q:v 70 -compression_level 6 -loop 0 tessra-demo.webp
```

Encoding takes several minutes at `-compression_level 6`. The Marketplace listing only changes when a new VSIX is published, because it renders the README packaged in the VSIX.

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

The Marketplace renders `<video>` in the README only with an **absolute https** `src`. Relative paths are not rewritten (microsoft/vsmarketplace#494), and GitHub `user-attachments` URLs only play for signed-in GitHub users. Host the MP4 and poster next to the existing screenshots in `frozenvoice/frozenvoice-assets`, and serve them through jsDelivr so the MP4 gets a `video/mp4` content type:

```html
<video src="https://cdn.jsdelivr.net/gh/frozenvoice/frozenvoice-assets@main/tessra/video/tessra-promo.mp4"
       poster="https://cdn.jsdelivr.net/gh/frozenvoice/frozenvoice-assets@main/tessra/video/tessra-promo-poster.jpg"
       autoplay muted loop playsinline controls width="100%">
  <a href="https://cdn.jsdelivr.net/gh/frozenvoice/frozenvoice-assets@main/tessra/video/tessra-promo.mp4">
    <img src="https://raw.githubusercontent.com/frozenvoice/frozenvoice-assets/main/tessra/video/tessra-promo-poster.jpg" alt="Tessra demo video">
  </a>
</video>
```

The inner link and image are the fallback where `<video>` is stripped (GitHub's README renderer): the poster shows and links to the MP4. The Marketplace listing only changes when a new VSIX is published, because it renders the README packaged in the VSIX.

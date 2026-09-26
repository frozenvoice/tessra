# Tessra promo video

- `tessra-promo.mp4` — 32s, 1920×1080, 30fps, H.264, no audio
- `tessra-promo.html` — source animation. Open with `?play` to preview in a browser, or `?t=12.5` to view one moment.
- `render.cjs` — renders the HTML frame by frame (Playwright + ffmpeg) into the MP4.

```bash
NODE_PATH=$(npm root -g) node demo/promo/render.cjs            # full render
NODE_PATH=$(npm root -g) node demo/promo/render.cjs --stills 3,13.5,31   # preview stills
```

Scenes: intro (rotating tesseract) → "No login / No cloud sync / No paywalled core workflows" → request compose & send → environment switch → collection runner with rerun-failed → feature grid → local-first message → end card.

All UI in the video is a mock recreated in HTML; claims are limited to what `PRODUCT.md` confirms. `demo/**` is already excluded by `.vscodeignore`, so none of this ships in the VSIX.

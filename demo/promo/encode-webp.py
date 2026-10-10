"""Encode the promo MP4 into the README's animated WebP.

ffmpeg's libwebp_anim never inserts keyframes after the first frame, so lossy
sub-frame deltas drift for the whole loop: old text ghosts behind new panels and
the dark gradients break into blocks. Pillow drives libwebp's WebPAnimEncoder
directly, which lets us force a keyframe at least every `--kmax` frames.

usage: python3 demo/promo/encode-webp.py demo/promo/tessra-promo.mp4 tessra-demo.webp
Needs ffmpeg on PATH and Pillow built with WebP (pip install pillow numpy).
"""
import argparse
import os
import subprocess
import time

import numpy as np
from PIL import Image

p = argparse.ArgumentParser()
p.add_argument('src')
p.add_argument('out')
p.add_argument('--width', type=int, default=1280)
p.add_argument('--fps', type=float, default=20)
p.add_argument('--quality', type=float, default=82)
p.add_argument('--kmin', type=int, default=10)
p.add_argument('--kmax', type=int, default=20)
a = p.parse_args()

w = a.width
h = round(w * 9 / 16 / 2) * 2
raw = subprocess.run(
    ['ffmpeg', '-v', 'error', '-i', a.src, '-vf', f'fps={a.fps},scale={w}:{h}:flags=lanczos',
     '-pix_fmt', 'rgb24', '-f', 'rawvideo', '-'],
    check=True, capture_output=True).stdout
size = w * h * 3
frames = [Image.frombuffer('RGB', (w, h), raw[i * size:(i + 1) * size], 'raw', 'RGB', 0, 1)
          for i in range(len(raw) // size)]
step = 1000 / a.fps
durations = [round((i + 1) * step) - round(i * step) for i in range(len(frames))]

t0 = time.time()
frames[0].save(a.out, 'WEBP', save_all=True, append_images=frames[1:], duration=durations, loop=0,
               quality=a.quality, method=6, kmin=a.kmin, kmax=a.kmax)
print(f'{a.out}: {len(frames)} frames {w}x{h} @{a.fps}fps, '
      f'{os.path.getsize(a.out) / 1e6:.2f}MB in {time.time() - t0:.0f}s')

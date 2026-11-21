"""Pixel-art versions of the rotating heads for the character select screen.

python3 scripts/game/heads.py   (reads public/images/heads/<name>.webp, writes public/game/heads/<name>.png)
Each PNG is a horizontal strip of SIZE x SIZE frames; frame 0 is the front-facing still.
"""
import os, json
import numpy as np
from PIL import Image, ImageSequence

SRC, OUT, SIZE = 'public/images/heads', 'public/game/heads', 64
os.makedirs(OUT, exist_ok=True)
meta = {}
for name in ['sam', 'yorick', 'corentin', 'hans', 'tijl', 'wim', 'simon', 'tomas']:
    frames = []
    for fr in ImageSequence.Iterator(Image.open(f'{SRC}/{name}.webp')):
        im = fr.convert('RGBA').resize((SIZE, SIZE), Image.LANCZOS)
        a = np.asarray(im).astype(np.float32)
        al = (a[..., 3] > 120)
        rgb = np.clip((a[..., :3] - 128) * 1.15 + 134, 0, 255).astype(np.uint8)
        q = np.asarray(Image.fromarray(rgb).quantize(20, method=Image.Quantize.MEDIANCUT).convert('RGB'))
        frames.append(np.dstack([q, al * 255]).astype(np.uint8))
    strip = np.concatenate(frames, axis=1)
    Image.fromarray(strip, 'RGBA').save(f'{OUT}/{name}.png', optimize=True)
    meta[name] = len(frames)
json.dump({'size': SIZE, 'frames': meta}, open(f'{OUT}/heads.json', 'w'))
print(meta)

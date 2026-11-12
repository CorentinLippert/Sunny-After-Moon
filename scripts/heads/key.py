import sys, glob, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC, OUT = sys.argv[1], sys.argv[2]
LO, HI = 18, 60


def key(path):
    im = Image.open(path).reduce(4)
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    s = g - np.maximum(r, b)
    # background = green-ish pixels connected to the frame border (keeps the green collar)
    cand = s > LO
    lab, n = ndi.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = ndi.sum(np.ones_like(s), lab, range(n + 1))
    keep = np.zeros(n + 1, bool)
    for i in border:
        keep[i] = True
    # small enclosed gaps (between hair strands) are background too
    keep[(sizes < 400)] = True
    keep[0] = False
    bgzone = keep[lab]
    alpha = 1 - np.clip((s - LO) / (HI - LO), 0, 1)
    alpha = np.where(bgzone, alpha, 1.0)
    # clean speckles: remove tiny foreground islands
    fg = alpha > 0.5
    lab2, n2 = ndi.label(fg)
    if n2:
        sz = ndi.sum(fg, lab2, range(1, n2 + 1))
        big = np.argmax(sz) + 1
        alpha = np.where((lab2 != big) & (lab2 > 0), 0, alpha)
    # soften edge a touch, then choke by ~1px
    alpha = ndi.gaussian_filter(alpha, 0.8)
    alpha = np.clip((alpha - 0.15) / 0.85, 0, 1)

    # unmix background colour from semi-transparent edge pixels
    bgc = np.median(a[alpha < 0.02], axis=0)
    am = np.maximum(alpha, 0.05)[..., None]
    fgc = (a - (1 - am) * bgc) / am
    fgc = np.where(alpha[..., None] > 0.98, a, fgc)
    fgc = np.clip(fgc, 0, 255)
    # despill: green never above max(red, blue), except on the collar (outside the edge zone)
    r, g, b = fgc[..., 0], fgc[..., 1], fgc[..., 2]
    lim = np.maximum(r, b)
    collar = (~bgzone) & (s > LO)
    # only clothing (well below the top of the head) keeps its green; reflections on glasses etc. are despilled
    top = int(np.where((~bgzone).sum(1) > 6)[0][0])
    collar[:top + 380] = False
    collar = ndi.binary_erosion(collar, iterations=2)
    g2 = np.where(collar, g, np.minimum(g, lim * 1.0 + 4))
    fgc[..., 1] = g2
    return fgc, alpha


def grade(c):
    x = c / 255.0
    # warm
    x[..., 0] *= 1.05
    x[..., 1] *= 1.0
    x[..., 2] *= 0.95
    x = np.clip(x, 0, 1)
    # contrast S-curve
    x = x + 0.18 * (x - 0.5) * (1 - np.abs(2 * x - 1)) * 2
    x = np.clip(x, 0, 1)
    # saturation +12%
    l = x.mean(axis=2, keepdims=True)
    x = np.clip(l + (x - l) * 1.04, 0, 1)
    return x * 255


if __name__ == '__main__':
    import os
    os.makedirs(OUT, exist_ok=True)
    info = {}
    for p in sorted(glob.glob(SRC + '/*.JPG')):
        name = os.path.basename(p)[:-4]
        c, al = key(p)
        c = grade(c)
        rgba = np.dstack([c, al * 255]).astype(np.uint8)
        Image.fromarray(rgba).save(f'{OUT}/{name}.png')
        rows = np.where(al.sum(1) > 6)[0]
        y0 = int(rows[0])
        band = al[y0:y0 + 220]
        xs = np.arange(al.shape[1])
        cx = float((band.sum(0) * xs).sum() / band.sum())
        info[name] = dict(y0=y0, cx=cx)
        print(name, y0, round(cx))
    json.dump(info, open(f'{OUT}/info.json', 'w'))

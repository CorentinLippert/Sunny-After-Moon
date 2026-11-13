import sys, glob, json
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

SRC, OUT = sys.argv[1], sys.argv[2]
import os
# KEY_LO/KEY_HI: green-dominance range from opaque to fully keyed.
# KEEP_GREEN: for green clothing that touches the photo edge (e.g. a green T-shirt), pixels below the
# head with green dominance above this value keep their colour instead of being despilled.
LO, HI = float(os.environ.get('KEY_LO', 18)), float(os.environ.get('KEY_HI', 60))
KEEP = os.environ.get('KEEP_GREEN')
# SHIRT=1: the musician wears a green/teal top that touches the photo edge. It is found by its bluer hue
# (blue/green ratio above the screen's) and kept opaque with its own colour.
SHIRT = os.environ.get('SHIRT') == '1'


def shirt_mask(a, s):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    q = ndi.gaussian_filter((b + 1) / (g + 1), 4)
    border = np.concatenate([q[:40].ravel(), q[:, :40].ravel(), q[:, -40:].ravel()])
    t = np.median(border) + 0.08
    m = (q > t) & (s > 10)
    lab, n = ndi.label(m)
    out = np.zeros_like(m)
    for i in set(np.unique(lab[-1])) - {0}:
        comp = lab == i
        if comp.sum() > 5000:
            out |= comp
    out = ndi.binary_closing(out, iterations=4)
    out = ndi.binary_fill_holes(out)
    return out


def key(path):
    im = Image.open(path).reduce(4)
    a = np.asarray(im).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    s = g - np.maximum(r, b)
    # background = green-ish pixels connected to the frame border (keeps the green collar)
    cand = s > LO
    shirt = shirt_mask(a, s) if SHIRT else np.zeros(s.shape, bool)
    cand &= ~shirt
    lab, n = ndi.label(cand)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    sizes = ndi.sum(np.ones_like(s), lab, range(n + 1))
    keep = np.zeros(n + 1, bool)
    for i in border:
        keep[i] = True
    # small enclosed gaps (between hair strands) are background too
    keep[(sizes < int(os.environ.get('HOLE', 400)))] = True
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
    if SHIRT:
        alpha = np.maximum(alpha, np.clip(ndi.gaussian_filter(shirt.astype(np.float32), 1.2) * 1.4 - 0.2, 0, 1))
    # drop faint smudges that are not attached to the person
    body = ndi.binary_dilation(alpha > 0.5, iterations=3)
    lab3, n3 = ndi.label(body)
    if n3:
        sz3 = ndi.sum(body, lab3, range(1, n3 + 1))
        alpha = alpha * (lab3 == np.argmax(sz3) + 1)

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
    if SHIRT:
        collar |= ndi.binary_erosion(shirt, iterations=3)
    if KEEP is not None:
        collar |= (alpha > 0.9) & (s > float(KEEP))
    collar[:top + 380] = False
    collar = ndi.binary_erosion(collar, iterations=2)
    g2 = np.where(collar, g, np.minimum(g, lim * 1.0 + 4))
    fgc[..., 1] = g2
    if SHIRT or os.environ.get('EDGE') == '1':
        # a teal screen leaves a blue-green cast on hair edges: pull edge pixels of the head back to neutral
        edge = ndi.binary_dilation((alpha > 0.02) & (alpha < 0.98), iterations=2) & ~collar
        rr_, gg_, bb_ = fgc[..., 0], fgc[..., 1], fgc[..., 2]
        fgc[..., 1] = np.where(edge, np.minimum(gg_, rr_ * 1.02 + 3), gg_)
        fgc[..., 2] = np.where(edge, np.minimum(bb_, rr_ * 0.95 + 3), bb_)
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
        # neck = narrowest row of the silhouette below the head: a steadier vertical anchor than the
        # top of the hair when hairstyles stick up differently from one angle to the next
        w = ndi.uniform_filter1d((al > 0.5).sum(1).astype(float), 15)
        lo, hi = y0 + 250, min(y0 + 700, al.shape[0] - 1)
        neck = int(lo + np.argmin(w[lo:hi]))
        info[name] = dict(y0=y0, cx=cx, neck=neck)
        print(name, y0, round(cx), neck)
    json.dump(info, open(f'{OUT}/info.json', 'w'))

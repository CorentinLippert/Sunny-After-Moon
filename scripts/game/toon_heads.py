"""South Park style heads for the stage level, from the band-page photo heads.
  python3 scripts/game/toon_heads.py public/images/heads public/game/toon
Each photo becomes a few flat color areas (hair, skin, beard, shirt) with smooth shapes, one even ink line
around every area (clear line), and big round South Park eyes + a simple mouth at hand-placed positions.
"""
import sys, os
import numpy as np, cv2

# cut under the chin / collar (fraction of the photo height from the top of the hair)
CUT = {'sam': 0.7, 'yorick': 0.86, 'corentin': 0.84, 'hans': 0.86, 'tijl': 0.84, 'wim': 0.84, 'simon': 0.78, 'tomas': 0.84}
# eyes (left x, right x, y) and mouth (y, kind) in units of the crop width (crop = 300 px wide)
FACE = {
    'sam': (0.40, 0.57, 0.31, 0.45, 'smile'),
    'yorick': (0.36, 0.65, 0.69, 1.05, 'grin'),
    'corentin': (0.36, 0.66, 0.61, 0.86, 'smile'),
    'hans': (0.32, 0.66, 0.91, 1.28, 'flat'),
    'tijl': (0.36, 0.62, 0.65, 0.86, 'smile'),
    'wim': (0.30, 0.63, 0.57, 0.80, 'smile'),
    'simon': (0.43, 0.67, 0.39, 0.58, 'flat'),
    'tomas': (0.25, 0.61, 0.55, 0.84, 'flat'),
}
INK = (12, 20, 58)  # BGR of #3a140c
WIDTH = 300


def crop(path, frac):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    a = im[:, :, 3]
    rows = np.where(a.max(1) > 128)[0]
    top, bot = rows[0], rows[-1]
    cut = top + int((bot - top) * frac)
    cols = np.where(a[top:cut].max(0) > 128)[0]
    x0, x1 = max(0, cols[0] - 10), min(im.shape[1], cols[-1] + 10)
    im = im[max(0, top - 10):cut, x0:x1]
    return cv2.resize(im, (WIDTH, int(WIDTH * im.shape[0] / im.shape[1])), interpolation=cv2.INTER_CUBIC)


def smooth_label(L, mask, K, sigma):
    layers = np.stack([cv2.GaussianBlur((L == k).astype(np.float32), (0, 0), sigma) for k in range(K)])
    out = layers.argmax(0); out[~mask] = -1
    return out


def drop_small(L, mask, K, min_area):
    # small islands take the label around them
    for k in range(K):
        n, cc, st, _ = cv2.connectedComponentsWithStats((L == k).astype(np.uint8), 8)
        for i in range(1, n):
            if st[i, cv2.CC_STAT_AREA] < min_area:
                isl = cc == i
                ring = cv2.dilate(isl.astype(np.uint8), np.ones((5, 5), np.uint8)).astype(bool) & ~isl & mask
                vals = L[ring]; vals = vals[(vals >= 0) & (vals != k)]
                if len(vals): L[isl] = np.bincount(vals).argmax()
    return L


def stylize(c, toward=None, f=0.0):
    c = np.array(c, np.float32)
    if toward is not None: c = c * (1 - f) + np.array(toward, np.float32) * f
    hsv = cv2.cvtColor(np.uint8([[c]]), cv2.COLOR_BGR2HSV)[0, 0].astype(np.float32)
    hsv[1] = min(255, hsv[1] * 1.25 + 10); hsv[2] = min(255, hsv[2] * 1.1 + 8)
    return cv2.cvtColor(np.uint8([[hsv]]), cv2.COLOR_HSV2BGR)[0, 0]


def flat_regions(bgr, mask, K):
    sm = bgr.copy()
    for _ in range(6): sm = cv2.bilateralFilter(sm, 9, 60, 9)
    sm = cv2.medianBlur(sm, 9)
    lab = cv2.cvtColor(sm, cv2.COLOR_BGR2LAB).astype(np.float32)
    h, w = mask.shape
    # 1) skin: the brightest warm cluster, as one clean shape
    px = lab[mask].reshape(-1, 3)
    _, lbl, cen = cv2.kmeans(px, 4, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 4, cv2.KMEANS_PP_CENTERS)
    sk = int(np.argmax(cen[:, 0] + 1.5 * (cen[:, 1] - 128)))
    L0 = np.full(mask.shape, -1, np.int32); L0[mask] = lbl.flatten()
    skin = cv2.GaussianBlur((L0 == sk).astype(np.float32), (0, 0), 6) > 0.5
    skin = cv2.morphologyEx(skin.astype(np.uint8), cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (25, 25))).astype(bool) & mask
    n, cc, st, _ = cv2.connectedComponentsWithStats(skin.astype(np.uint8), 8)
    if n > 1: skin = cc == (1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])))
    # fill holes inside the face (nose, eyes, shadows)
    inv = (~skin).astype(np.uint8); n, cc, st, _ = cv2.connectedComponentsWithStats(inv, 4)
    for i in range(1, n):
        if st[i, cv2.CC_STAT_AREA] < 0.04 * h * w: skin[cc == i] = True
    skin &= mask
    # 2) the rest: hair/beard vs shirt/light hair, two flat areas
    rest = mask & ~skin
    px2 = lab[rest].reshape(-1, 3)
    _, lbl2, cen2 = cv2.kmeans(px2, 2, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5), 4, cv2.KMEANS_PP_CENTERS)
    L = np.full(mask.shape, -1, np.int32); L[skin] = 0; L[rest] = 1 + lbl2.flatten()
    L = smooth_label(L, mask, 3, 11)
    L = drop_small(L, mask, 3, int(0.03 * h * w))
    sk_bgr = cv2.cvtColor(np.uint8([[cen[sk]]]), cv2.COLOR_LAB2BGR)[0, 0]
    colors = [stylize(sk_bgr, (160, 201, 242), 0.45)]
    for k in range(2): colors.append(stylize(cv2.cvtColor(np.uint8([[cen2[k]]]), cv2.COLOR_LAB2BGR)[0, 0]))
    return L, colors


def toon(path, out, name):
    im = crop(path, CUT[name])
    h, w = im.shape[:2]
    bgr = im[:, :, :3]
    mask = cv2.morphologyEx((im[:, :, 3] > 110).astype(np.uint8), cv2.MORPH_OPEN, np.ones((7, 7), np.uint8))
    mask = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 4) > 0.5
    L, colors = flat_regions(bgr, mask, 3)
    res = np.zeros((h, w, 4), np.uint8)
    for k, c in enumerate(colors): res[L == k, :3] = c
    res[mask, 3] = 255
    # clear line: even ink lines between areas and a thicker one around the head
    edge = np.zeros((h, w), np.uint8)
    edge[:, 1:][L[:, 1:] != L[:, :-1]] = 255; edge[1:, :][L[1:, :] != L[:-1, :]] = 255
    edge[~mask] = 0
    edge = cv2.dilate(edge, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (4, 4)))
    res[edge > 0, :3] = INK
    out_m = cv2.dilate(mask.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11)))
    pad = (out_m > 0) & ~mask
    res[pad] = (*INK, 255)
    # South Park eyes: two big white ovals that touch, small black pupils; a simple mouth
    lx, rx, ey, my, kind = FACE[name]
    s = w
    ew = (rx - lx) * s * 0.74
    for cx in (lx * s, rx * s):
        cx2 = int(cx + (1 if cx < (lx + rx) / 2 * s else -1) * ew * 0.12)
        cv2.ellipse(res, (cx2, int(ey * s)), (int(ew * 0.52), int(ew * 0.62)), 0, 0, 360, (255, 255, 255, 255), -1, cv2.LINE_AA)
        cv2.ellipse(res, (cx2, int(ey * s)), (int(ew * 0.52), int(ew * 0.62)), 0, 0, 360, (*INK, 255), 3, cv2.LINE_AA)
        cv2.circle(res, (int(cx2 + (lx + rx) / 2 * s - cx) // 1 if False else cx2 + int(((lx + rx) / 2 * s - cx) * 0.12), int(ey * s + ew * 0.05)), max(3, int(ew * 0.1)), (*INK, 255), -1, cv2.LINE_AA)
    mx, mw = int((lx + rx) / 2 * s), int((rx - lx) * s * 0.45)
    if kind == 'grin':
        pts = cv2.ellipse2Poly((mx, int(my * s) - 6), (mw, int(mw * 0.6)), 0, 0, 180, 10)
        cv2.fillPoly(res, [pts], (255, 255, 255, 255), cv2.LINE_AA); cv2.polylines(res, [pts], True, (*INK, 255), 3, cv2.LINE_AA)
    elif kind == 'smile':
        cv2.ellipse(res, (mx, int(my * s) - 8), (int(mw * 0.8), int(mw * 0.35)), 0, 20, 160, (*INK, 255), 3, cv2.LINE_AA)
    else:
        cv2.line(res, (mx - int(mw * 0.6), int(my * s)), (mx + int(mw * 0.6), int(my * s)), (*INK, 255), 3, cv2.LINE_AA)
    res = cv2.resize(res, (w // 3 * 2, h // 3 * 2), interpolation=cv2.INTER_AREA)
    cv2.imwrite(out, res, [cv2.IMWRITE_WEBP_QUALITY, 90])


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    for n in FACE:
        toon(f'{src}/{n}-still.webp', f'{dst}/{n}.webp', n)
        print(n)

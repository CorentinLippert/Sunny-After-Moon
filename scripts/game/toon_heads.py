"""Cartoon caricature heads for the stage level, from the band-page photo heads.
  python3 scripts/game/toon_heads.py public/images/heads public/game/toon
Steps: cut the head off at the shoulders, bulge the face (caricature), flatten colors (bilateral + k-means),
draw ink lines on the edges and a thick ink outline around the silhouette, so the heads match the paper bodies.
"""
import sys, os
import numpy as np, cv2

IDS = ['sam', 'yorick', 'corentin', 'hans', 'tijl', 'wim', 'simon', 'tomas']
INK = (12, 20, 58)  # BGR of #3a140c


# where to cut each head (fraction of the photo height, from the top of the hair): just under the chin / collar
CUT = {'sam': 0.7, 'yorick': 0.86, 'corentin': 0.84, 'hans': 0.86, 'tijl': 0.84, 'wim': 0.84, 'simon': 0.78, 'tomas': 0.84}


def cut_shoulders(a, frac):
    rows = np.where(a.max(1) > 128)[0]
    top, bot = rows[0], rows[-1]
    return top, top + int((bot - top) * frac)


def bulge(img, cx, cy, r, k):
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx, dy = xx - cx, yy - cy
    d = np.sqrt(dx * dx + dy * dy) / r
    f = np.where(d < 1, (1 - k * (1 - d) ** 2), 1.0).astype(np.float32)
    return cv2.remap(img, cx + dx * f, cy + dy * f, cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)


def toon(path, out, frac):
    im = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if im.shape[2] == 3: im = np.dstack([im, np.full(im.shape[:2], 255, np.uint8)])
    a = im[:, :, 3]
    top, cut = cut_shoulders(a, frac)
    cols = np.where(a[top:cut].max(0) > 128)[0]
    x0, x1 = max(0, cols[0] - 10), min(im.shape[1], cols[-1] + 10)
    im = im[max(0, top - 10):cut, x0:x1].copy()
    im = cv2.resize(im, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    h, w = im.shape[:2]
    # caricature: bulge the middle of the face (eyes, nose), a bit bigger head on top
    im = bulge(im, w * 0.5, h * 0.5, min(w, h) * 0.42, 0.32)
    bgr, a = im[:, :, :3], im[:, :, 3]
    a = np.where(a > 110, 255, 0).astype(np.uint8)
    a = cv2.morphologyEx(a, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    # flatten colors
    sm = bgr.copy()
    for _ in range(4): sm = cv2.bilateralFilter(sm, 9, 40, 9)
    px = sm[a > 0].reshape(-1, 3).astype(np.float32)
    K = 9
    _, lab, cen = cv2.kmeans(px, K, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0), 3, cv2.KMEANS_PP_CENTERS)
    cen = np.clip(cen * 1.08 + 6, 0, 255)  # a little brighter, more cartoon
    flat = sm.copy(); flat[a > 0] = cen[lab.flatten()].astype(np.uint8)
    flat = cv2.medianBlur(flat, 5)
    # boost saturation slightly
    hsv = cv2.cvtColor(flat, cv2.COLOR_BGR2HSV).astype(np.float32); hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 1.25, 0, 255)
    flat = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)
    # ink lines from the photo's edges
    gray = cv2.medianBlur(cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY), 7)
    edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 13, 8)
    lines = (edges == 0) & (a > 0)
    n, lab2, st, _ = cv2.connectedComponentsWithStats(lines.astype(np.uint8), 8)
    lines = np.isin(lab2, np.where(st[:, cv2.CC_STAT_AREA] >= 40)[0][1:])  # drop specks
    flat[lines] = INK
    # thick ink outline around the whole head
    big = cv2.dilate(a, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    outl = (big > 0) & (a == 0)
    res = np.dstack([flat, a])
    res[outl] = (*INK, 255)
    res = cv2.resize(res, (int(w * 0.5), int(h * 0.5)), interpolation=cv2.INTER_AREA)
    cv2.imwrite(out, res, [cv2.IMWRITE_WEBP_QUALITY, 88])


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    os.makedirs(dst, exist_ok=True)
    for i in IDS:
        toon(f'{src}/{i}-still.webp', f'{dst}/{i}.webp', CUT[i])
        print(i)

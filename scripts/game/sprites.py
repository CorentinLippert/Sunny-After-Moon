"""Turn green-screen pose photos into pixel-art sprite sheets for the game.

python3 scripts/game/sprites.py "<folder with the D18_*.JPG photos>" public/game/sprites
Each character gets one PNG strip: run A, run B, jump, glide, action (same order as POSES).
"""
import sys, os, json
import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage as ndi

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
# frames: run A, run B, jump, glide, action
POSES = {
    'sam':      ['0262', '0266', '0254', '0242', '0250'],
    'yorick':   ['0342', '0354', '0334', '0314', '0338'],
    'corentin': ['0210', '0214', '0230', '0222', '0226'],
    'hans':     ['0274', '0290', '0278', '0466', '0298'],
    'tijl':     ['0434', '0442', '0454', '0438', '0450'],
    'wim':      ['0202', '0206', '0206', '0194', '0198'],
    'simon':    ['0366', '0378', '0402', '0390', '0382'],
    'tomas':    ['0422', '0426', '0430', '0410', '0418'],
}
# photos mirrored so the musician faces right (the way the level scrolls)
FLIP = {'0222', '0226', '0230', '0366', '0378', '0402', '0390', '0382', '0410', '0418'}
SCALE = 1 / 16  # photo px (after /4 reduce) -> game px, same for everyone so sizes stay comparable
CELL = 64       # sprite cell size in game px


def cutout(path):
    im = ImageOps.exif_transpose(Image.open(path)).reduce(4)
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    # hue-based key: the screen goes from bright green to dark teal depending on the light
    mx, mn = a.max(-1), a.min(-1)
    sat = (mx - mn) / (mx + 1)
    hsv = np.asarray(im.convert('RGB').convert('HSV')).astype(np.float32)
    hue = hsv[..., 0] * 360 / 255
    greenish = (hue > 70) & (hue < 192) & (sat > 0.2) & (g - r > 15)
    s = g - np.maximum(r, b)
    fg = ~greenish
    # the room around the screen: keep only what lies inside the (closed, hole-filled) screen area
    gl, gn = ndi.label(greenish)
    gs = ndi.sum(greenish, gl, range(1, gn + 1))
    screen = gl == (np.argmax(gs) + 1)
    small = screen[::4, ::4]
    small = ndi.binary_closing(np.pad(small, 20), iterations=18)[20:-20, 20:-20]
    small = ndi.binary_fill_holes(small)
    area = np.kron(small, np.ones((4, 4), bool))[:screen.shape[0], :screen.shape[1]]
    fg &= area
    fg = ndi.binary_opening(fg, iterations=2)
    lab, n = ndi.label(fg)
    H, W = s.shape
    best, bscore = 0, -1
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(ys) < 2000:
            continue
        # skip the room around the screen: components touching left/right/top borders
        score = len(ys)
        if score > bscore:
            best, bscore = i, score
    assert best, path
    m = lab == best
    # attach nearby pieces (arms, instrument) that the key split off
    near = ndi.binary_dilation(m, iterations=12)
    for i in range(1, n + 1):
        if i == best:
            continue
        comp = lab == i
        ys, xs = np.nonzero(comp)
        if len(ys) > 150 and (comp & near).any() :
            m |= comp
    m = ndi.binary_closing(m, iterations=2)
    holes = ndi.binary_fill_holes(m) & ~m
    hl, hn = ndi.label(holes)
    if hn:
        hs = ndi.sum(holes, hl, range(1, hn + 1))
        m |= np.isin(hl, 1 + np.nonzero(hs < 300)[0])
    # despill
    out = a.copy()
    lim = np.maximum(r, b)
    out[..., 1] = np.minimum(g, lim + 6)
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.dstack([out, m * 255.0])[y0:y1, x0:x1]
    return Image.fromarray(rgba.astype(np.uint8), 'RGBA')


def pixelate(img):
    w, h = img.size
    tw, th = max(1, round(w * SCALE)), max(1, round(h * SCALE))
    if max(tw, th) > CELL - 2:
        f = (CELL - 2) / max(tw, th)
        tw, th = max(1, round(tw * f)), max(1, round(th * f))
    small = img.resize((tw, th), Image.LANCZOS)
    a = np.asarray(small).astype(np.float32)
    al = (a[..., 3] > 110) * 255
    rgb = a[..., :3]
    # punchier colours, then a posterised palette for the retro look
    rgb = np.clip((rgb - 128) * 1.18 + 136, 0, 255)
    q = Image.fromarray(rgb.astype(np.uint8), 'RGB').quantize(24, method=Image.Quantize.MEDIANCUT).convert('RGB')
    a2 = np.dstack([np.asarray(q), al]).astype(np.uint8)
    # dark 1px outline
    m = al > 0
    ring = ndi.binary_dilation(m) & ~m
    a2[ring] = [43, 16, 10, 255]
    return Image.fromarray(a2, 'RGBA')


meta = {}
for name, frames in POSES.items():
    sheet = Image.new('RGBA', (CELL * len(frames), CELL), (0, 0, 0, 0))
    sizes = []
    for i, f in enumerate(frames):
        p = pixelate(cutout(os.path.join(SRC, f'D18_{f}.JPG')))
        if f in FLIP:
            p = ImageOps.mirror(p)
        w, h = p.size
        # feet on the bottom of the cell, centred
        sheet.paste(p, (i * CELL + (CELL - w) // 2, CELL - h - 1), p)
        sizes.append([w, h])
    sheet.save(os.path.join(OUT, f'{name}.png'), optimize=True)
    meta[name] = sizes
    print(name, sizes)
json.dump({'cell': CELL, 'frames': meta}, open(os.path.join(OUT, 'sprites.json'), 'w'))

// Title screen drawn as a movie poster: the eight South Park style band heads in a row under a setting sun,
// thug life glasses dropping onto every face, big title, and a billing block like on a film poster.
import { PAL } from './art';

type Ctx = CanvasRenderingContext2D;
type TextFn = (s: string, x: number, y: number, size?: number, color?: string, align?: CanvasTextAlign, outline?: boolean) => void;

// eyes (left x, right x, y) in units of the head image width; same values as scripts/game/toon_heads.py FACE
const FACE: Record<string, [number, number, number]> = {
  sam: [0.38, 0.6, 0.46],
  yorick: [0.36, 0.65, 0.69],
  corentin: [0.36, 0.66, 0.61],
  hans: [0.32, 0.66, 0.91],
  tijl: [0.36, 0.62, 0.65],
  wim: [0.3, 0.63, 0.57],
  simon: [0.43, 0.67, 0.39],
  tomas: [0.25, 0.61, 0.55],
};
// stage plan order, alternating high (back) and low (front)
const ORDER = ['sam', 'yorick', 'corentin', 'hans', 'tijl', 'wim', 'simon', 'tomas'];

const SHIRT = [PAL.teal, PAL.maroon, PAL.lime, PAL.orange, PAL.teal, PAL.maroon, PAL.lime, PAL.orange];

// thug life glasses, 24x5 bitmap (1 = black, 2 = white shine)
const GLASSES = [
  '111111111111111111111111',
  '011221111110011221111110',
  '001211111100001211111100',
  '000111111000000111111000',
  '000011110000000011110000',
];
function glasses(c: Ctx, x: number, y: number, w: number) {
  const px = w / 24, py = px * 2;
  for (let r = 0; r < GLASSES.length; r++)
    for (let k = 0; k < 24; k++) {
      const v = GLASSES[r][k];
      if (v === '0') continue;
      c.fillStyle = v === '2' ? '#ffffff' : '#000000';
      c.fillRect(Math.round(x + k * px), Math.round(y + r * py), Math.ceil(px), Math.ceil(py));
    }
}

export function createPoster() {
  const heads: Record<string, HTMLImageElement> = {};
  for (const id of ORDER) {
    const im = new Image();
    im.src = `/game/toon/${id}.webp`;
    heads[id] = im;
  }

  return function draw(c: Ctx, W: number, H: number, t: number, text: TextFn, T: (k: string) => string, best: number) {
    // sky: night at the top, sunset at the horizon
    const sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, PAL.night); sky.addColorStop(0.45, PAL.maroon); sky.addColorStop(0.62, PAL.orange); sky.addColorStop(1, PAL.night);
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    for (let k = 0; k < 26; k++) {
      const sx = (k * 97) % W, sy = (k * 53) % 70;
      c.fillStyle = Math.sin(t * 3 + k) > 0.2 ? PAL.cream : 'rgba(255,243,196,0.4)';
      c.fillRect(sx, sy, 1, 1);
    }
    // the moon rises top right
    c.save(); c.beginPath(); c.arc(430, 30, 13, 0, Math.PI * 2); c.clip();
    c.fillStyle = PAL.cream; c.beginPath(); c.arc(430, 30, 13, 0, Math.PI * 2); c.arc(437, 25, 11, 0, Math.PI * 2); c.fill('evenodd');
    c.restore();
    // big setting sun with slow rays behind the band
    c.save(); c.translate(W / 2, 150); c.rotate(t * 0.08);
    c.fillStyle = 'rgba(252,196,0,0.22)';
    for (let k = 0; k < 18; k++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 330, (k * Math.PI) / 9, (k * Math.PI) / 9 + Math.PI / 18); c.closePath(); c.fill(); }
    c.restore();
    c.fillStyle = PAL.gold; c.beginPath(); c.arc(W / 2, 150, 96, 0, Math.PI * 2); c.fill();
    c.fillStyle = PAL.yellow; c.beginPath(); c.arc(W / 2, 150, 84, 0, Math.PI * 2); c.fill();

    text(T('poster.tag'), W / 2, 14, 10, PAL.cream);

    // the band: back row first, then the front row on top
    const hw = 62, step = 52, x0 = W / 2 - step * 3.5;
    const smooth = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = true;
    for (const pass of [0, 1]) {
      ORDER.forEach((id, i) => {
        if (i % 2 !== pass) return;
        const im = heads[id];
        if (!im.complete || !im.naturalWidth) return;
        const [lx, rx, ey] = FACE[id];
        const w = pass ? hw : hw * 0.9, h = (w * im.naturalHeight) / im.naturalWidth;
        const cx = x0 + i * step, eyeY = (pass ? 108 : 84) + Math.sin(t * 2 + i) * 1.2;
        // a simple body under the head, so nobody is a floating head
        const top = eyeY - ey * w;
        c.fillStyle = SHIRT[i]; c.strokeStyle = PAL.ink; c.lineWidth = 2;
        const ny = top + h - 6, sw = w * 0.5;
        c.beginPath(); c.moveTo(cx - sw, H); c.lineTo(cx - sw, ny + 14); c.quadraticCurveTo(cx - sw, ny, cx - sw * 0.55, ny);
        c.lineTo(cx + sw * 0.55, ny); c.quadraticCurveTo(cx + sw, ny, cx + sw, ny + 14); c.lineTo(cx + sw, H); c.closePath(); c.fill(); c.stroke();
        c.drawImage(im, cx - w / 2, top, w, h);
        // glasses drop in one after the other, then stay
        const d = Math.min(1, Math.max(0, (t - 0.4 - i * 0.22) / 0.5));
        const gw = (rx - lx) * w * 2.2;
        const gx = cx - w / 2 + ((lx + rx) / 2) * w - gw / 2;
        const gy = eyeY - gw * 0.22;
        c.imageSmoothingEnabled = false;
        if (d > 0) glasses(c, gx, -20 + (gy + 20) * (1 - Math.pow(1 - d, 3)), gw);
        c.imageSmoothingEnabled = true;
      });
    }
    c.imageSmoothingEnabled = smooth;

    // dark band at the bottom that cuts off the necks, like a poster title block
    const band = c.createLinearGradient(0, 150, 0, 176);
    band.addColorStop(0, 'rgba(15,42,38,0)'); band.addColorStop(1, PAL.night);
    c.fillStyle = band; c.fillRect(0, 150, W, 26);
    c.fillStyle = PAL.night; c.fillRect(0, 176, W, H - 176);

    text('SUNNY AFTER MOON', W / 2, 186, 32, PAL.yellow);
    text(T('game.subtitle').toUpperCase(), W / 2, 210, 11, PAL.cream);
    // billing block
    text(ORDER.map((n) => n.toUpperCase()).join('  ·  '), W / 2, 227, 7, 'rgba(255,243,196,0.75)', 'center', false);
    text(T('poster.billing'), W / 2, 238, 7, 'rgba(255,243,196,0.75)', 'center', false);
    if (Math.floor(t * 2) % 2 === 0) text(T('pressStart'), W / 2, 254, 11, PAL.yellow);
    if (best) text(`${T('best')}: ${best}`, W - 6, 263, 8, 'rgba(255,243,196,0.75)', 'right', false);
  };
}

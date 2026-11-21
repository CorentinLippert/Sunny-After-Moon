// Pixel-art drawing helpers for the game: babushkas, jellies, trampolines, background, thug-life glasses.
// Everything is drawn on a 480x270 canvas that CSS scales up with crisp pixels.

export const PAL = {
  yellow: '#ffec00',
  gold: '#fcc400',
  teal: '#6cbc92',
  orange: '#ce460a',
  lime: '#b2cc3c',
  maroon: '#96261b',
  ink: '#2b100a',
  cream: '#fff3c4',
  night: '#0f2a26',
};

type Ctx = CanvasRenderingContext2D;

export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
}

function disc(c: Ctx, x: number, y: number, r: number, fill: string) {
  c.fillStyle = fill;
  c.beginPath();
  c.arc(Math.round(x), Math.round(y), r, 0, Math.PI * 2);
  c.fill();
}

function ellipse(c: Ctx, x: number, y: number, rx: number, ry: number, fill: string) {
  c.fillStyle = fill;
  c.beginPath();
  c.ellipse(Math.round(x), Math.round(y), rx, ry, 0, 0, Math.PI * 2);
  c.fill();
}

// --- Babushka: headscarf, rosy cheeks and a very generous embroidered bosom. Cartoon, family friendly. ---
export function babushka(c: Ctx, x: number, footY: number, scale: number, hop: number, mood: 'dance' | 'sleep' | 'hit', t: number) {
  c.save();
  c.translate(Math.round(x), Math.round(footY - hop));
  if (mood === 'sleep') c.rotate(-Math.PI / 2), c.translate(-2, 10);
  c.scale(scale, scale);
  const dress = '#3f8f86', dressD = '#2c6a63', scarf = PAL.orange, skin = '#f3c79b';
  // feet
  c.fillStyle = PAL.ink;
  c.fillRect(-7, -3, 5, 3);
  c.fillRect(2, -3, 5, 3);
  // skirt
  c.fillStyle = dress;
  c.beginPath();
  c.moveTo(-12, -3); c.lineTo(12, -3); c.lineTo(8, -16); c.lineTo(-8, -16); c.closePath(); c.fill();
  c.fillStyle = PAL.gold;
  c.fillRect(-11, -7, 22, 2);
  c.fillStyle = PAL.orange;
  for (let i = -10; i < 11; i += 4) c.fillRect(i, -7, 2, 2);
  // apron
  c.fillStyle = PAL.cream;
  c.fillRect(-4, -16, 8, 11);
  // bosom: two big round pillows with embroidery
  const wob = Math.sin(t * 18) * (mood === 'dance' ? 0.6 : 0);
  disc(c, -5, -21 + wob, 7.5, dressD);
  disc(c, 5, -21 - wob, 7.5, dressD);
  disc(c, -5, -21.5 + wob, 6.5, dress);
  disc(c, 5, -21.5 - wob, 6.5, dress);
  c.fillStyle = PAL.gold;
  c.fillRect(-6, -23 + Math.round(wob), 2, 2);
  c.fillRect(4, -23 - Math.round(wob), 2, 2);
  c.fillStyle = PAL.orange;
  c.fillRect(-9, -20 + Math.round(wob), 2, 1);
  c.fillRect(7, -20 - Math.round(wob), 2, 1);
  // arms waving on the beat
  c.fillStyle = dress;
  const arm = mood === 'dance' ? Math.round(hop) : 0;
  c.fillRect(-15, -26 - arm, 4, 9);
  c.fillRect(11, -26 - arm, 4, 9);
  c.fillStyle = skin;
  c.fillRect(-15, -29 - arm, 4, 3);
  c.fillRect(11, -29 - arm, 4, 3);
  // head + scarf
  disc(c, 0, -33, 6, skin);
  c.fillStyle = scarf;
  c.beginPath();
  c.arc(0, -34, 7.5, Math.PI, 0);
  c.lineTo(5, -30); c.lineTo(-5, -30); c.closePath();
  c.fill();
  c.fillRect(-7, -34, 2, 5);
  c.fillRect(5, -34, 2, 5);
  c.fillRect(-2, -27, 4, 2); // knot
  c.fillStyle = PAL.yellow;
  c.fillRect(-4, -39, 1, 1); c.fillRect(1, -40, 1, 1); c.fillRect(4, -37, 1, 1); c.fillRect(-2, -36, 1, 1);
  // face
  c.fillStyle = PAL.ink;
  if (mood === 'sleep' || mood === 'hit') {
    c.fillRect(-3, -32, 2, 1); c.fillRect(1, -32, 2, 1);
  } else {
    c.fillRect(-3, -33, 1, 2); c.fillRect(2, -33, 1, 2);
  }
  c.fillStyle = '#e8746a';
  c.fillRect(-5, -31, 2, 1); c.fillRect(3, -31, 2, 1);
  c.fillStyle = PAL.maroon;
  c.fillRect(-1, -29, 2, 1);
  c.restore();
}

// --- Round jelly platform (one-way), wobbling on the beat ---
export function jelly(c: Ctx, x: number, top: number, w: number, squash: number, hue: number) {
  const cols = [
    ['#e8547a', '#ff9fb6', '#b3335a'],
    [PAL.lime, '#e2f08a', '#7f9426'],
    [PAL.teal, '#b8ecd0', '#3f8f6a'],
  ][hue % 3];
  const rx = w / 2 + squash * 3, ry = 9 - squash * 2;
  ellipse(c, x, top + ry, rx, ry, cols[2]);
  ellipse(c, x, top + ry - 1, rx - 1, ry - 1, cols[0]);
  ellipse(c, x - rx * 0.35, top + 3, rx * 0.25, 2, cols[1]);
  // drips
  c.fillStyle = cols[0];
  c.fillRect(Math.round(x - rx * 0.5), Math.round(top + ry * 2 - 2), 3, 4 + Math.round(squash * 2));
  c.fillRect(Math.round(x + rx * 0.3), Math.round(top + ry * 2 - 2), 3, 3);
}

// --- Trampoline: a big wobbly pudding with a cherry on top ---
export function tramp(c: Ctx, x: number, groundY: number, squash: number) {
  const ry = 11 - squash * 5, rx = 15 + squash * 4;
  ellipse(c, x, groundY - ry + 1, rx, ry, '#7a1c14');
  ellipse(c, x, groundY - ry, rx - 1, ry - 1, PAL.maroon);
  ellipse(c, x - 5, groundY - ry * 1.4, 4, 2, '#d0574a');
  // caramel top
  c.fillStyle = PAL.gold;
  c.beginPath();
  c.ellipse(Math.round(x), Math.round(groundY - ry * 1.8), rx * 0.55, 3, 0, Math.PI, 0);
  c.fill();
  disc(c, x, groundY - ry * 2 - 2, 3, '#e3222a');
  c.fillStyle = '#fff';
  c.fillRect(Math.round(x - 1), Math.round(groundY - ry * 2 - 4), 1, 1);
  c.fillStyle = PAL.lime;
  c.fillRect(Math.round(x), Math.round(groundY - ry * 2 - 8), 1, 4);
}

// --- Spinning sun-coin ---
export function coin(c: Ctx, x: number, y: number, t: number) {
  const k = Math.abs(Math.cos(t * 5));
  const rx = Math.max(1, 5 * k);
  ellipse(c, x, y, rx + 1, 6, PAL.maroon);
  ellipse(c, x, y, rx, 5, PAL.gold);
  if (rx > 2) ellipse(c, x - rx * 0.3, y - 2, rx * 0.4, 1.5, PAL.yellow);
}

// --- Thug life glasses, 24x5 pixel bitmap ---
const GLASSES = [
  '111111111111111111111111',
  '011221111110011221111110',
  '001211111100001211111100',
  '000111111000000111111000',
  '000011110000000011110000',
];
export function glasses(c: Ctx, x: number, y: number, w: number) {
  const px = w / 24;
  for (let r = 0; r < GLASSES.length; r++)
    for (let k = 0; k < 24; k++) {
      const v = GLASSES[r][k];
      if (v === '0') continue;
      c.fillStyle = v === '2' ? '#ffffff' : '#000000';
      c.fillRect(Math.round(x - w / 2 + k * px), Math.round(y + r * px), Math.ceil(px), Math.ceil(px));
    }
}

// --- Background: sky goes from day to night over the song (sun to moon), round twin hills, onion domes ---
export function sky(c: Ctx, W: number, H: number, p: number, camX: number, camY: number, pulse: number) {
  const stops = [
    ['#fff6a8', PAL.gold, '#f6a23a'],
    ['#ffd36a', '#f08a2c', PAL.orange],
    ['#b8473a', '#6a2a3a', '#2a2a48'],
    ['#14324a', '#0f2a36', PAL.night],
  ];
  const f = Math.min(stops.length - 1.001, p * (stops.length - 1));
  const i = Math.floor(f), t = f - i;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, mix(stops[i][0], stops[i + 1][0], t));
  g.addColorStop(0.55, mix(stops[i][1], stops[i + 1][1], t));
  g.addColorStop(1, mix(stops[i][2], stops[i + 1][2], t));
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  // stars at night
  if (p > 0.55) {
    c.fillStyle = `rgba(255,243,196,${Math.min(1, (p - 0.55) * 4)})`;
    for (let s = 0; s < 40; s++) {
      const sx = ((s * 97 - camX * 0.02) % W + W) % W, sy = (s * 53) % 140;
      c.fillRect(Math.round(sx), sy, 1, 1);
    }
  }
  // sun sets, moon rises
  const sunY = 40 + p * 260, moonY = 260 - p * 220;
  disc(c, 380, sunY, 24 + pulse * 2, 'rgba(255,236,0,0.35)');
  disc(c, 380, sunY, 18 + pulse, PAL.yellow);
  disc(c, 90, moonY, 14, '#fff3c4');
  disc(c, 96, moonY - 4, 12, mix(stops[i][0], stops[i + 1][0], t));
  // far hills: round twin domes (Balkan curves) with little onion-dome chapels
  const night = Math.max(0, p - 0.45) * 1.6;
  const hillA = mix('#7fcf9f', '#1c4a3c', Math.min(1, night));
  const hillB = mix(PAL.lime, '#2a5a2e', Math.min(1, night));
  const off1 = -(camX * 0.15) % 260;
  for (let k = -1; k < 4; k++) {
    const hx = off1 + k * 260, base = 236 - camY * 0.1;
    disc(c, hx + 60, base - 20, 62, hillA);
    disc(c, hx + 170, base - 16, 58, hillA);
    // chapel
    c.fillStyle = mix('#fff3c4', '#40525a', Math.min(1, night));
    c.fillRect(Math.round(hx + 166), Math.round(base - 86), 8, 12);
    disc(c, hx + 170, base - 88, 5, mix(PAL.orange, '#6a2a3a', Math.min(1, night)));
    c.fillRect(Math.round(hx + 169), Math.round(base - 99), 2, 6);
  }
  const off2 = -(camX * 0.4) % 180;
  for (let k = -1; k < 5; k++) {
    const hx = off2 + k * 180, base = 250 - camY * 0.3;
    disc(c, hx + 40, base, 34, hillB);
    disc(c, hx + 92, base + 4, 30, hillB);
  }
}

// Ground with a Balkan carpet border on top
export function groundSlab(c: Ctx, x0: number, x1: number, y: number, H: number, camX: number, night: number) {
  const a = Math.round(x0), b = Math.round(x1);
  if (b <= a) return;
  c.fillStyle = mix(PAL.maroon, '#3a140c', night);
  c.fillRect(a, y + 6, b - a, H - y);
  c.fillStyle = PAL.orange;
  c.fillRect(a, y, b - a, 6);
  c.fillStyle = PAL.gold;
  for (let k = Math.floor((a + camX) / 8) * 8 - camX; k < b; k += 8) {
    if (k < a) continue;
    c.fillRect(k, y + 1, 2, 2);
    c.fillRect(k + 2, y + 3, 2, 2);
    c.fillRect(k + 4, y + 1, 2, 2);
  }
  c.fillStyle = PAL.ink;
  c.fillRect(a, y + 6, b - a, 1);
  c.fillStyle = mix('#7a1c14', '#24100a', night);
  for (let k = Math.floor((a + camX) / 12) * 12 - camX; k < b; k += 12) {
    if (k < a) continue;
    c.fillRect(k + 4, y + 14, 3, 3);
    c.fillRect(k + 9, y + 24, 2, 2);
  }
  // rounded edges
  c.fillStyle = PAL.ink;
  c.fillRect(a, y, 1, H - y);
  c.fillRect(b - 1, y, 1, H - y);
}

export function heart(c: Ctx, x: number, y: number, full: boolean) {
  const rows = ['0110110', '1111111', '1111111', '0111110', '0011100', '0001000'];
  for (let r = 0; r < rows.length; r++)
    for (let k = 0; k < 7; k++)
      if (rows[r][k] === '1') {
        c.fillStyle = full ? (r === 1 && k === 1 ? '#ffffff' : '#e3222a') : 'rgba(43,16,10,0.45)';
        c.fillRect(x + k, y + r, 1, 1);
      }
}

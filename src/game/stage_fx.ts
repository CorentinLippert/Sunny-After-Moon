// Crazy happenings for the "Adulthood" stage level (Monia, 2026-11-26): the longer the song runs, the more absurd
// the festival gets. Things in the sky (UFOs, vimanas, birds, meteorites, a dragon, the cinema moon with the
// rocket in its eye, a dinosaur on the hills, Kilimanjaro), on stage (aliens, cows, gnomes, security chasing a fan
// who stage-dives just in time, smoke machines) and in the crowd (gorilla with a beach ball, a rabbit, a rasta man,
// the Red Cross, soap bubbles, 420 smoke plumes, bengal fires, confetti, lasers).
// Everything is drawn in the same flat paper-cut style with ink outlines, at 960x540.

type Ctx = CanvasRenderingContext2D;
const INK = '#3a140c', PAPER = '#fdf3e1';

function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;

export type FxKind = 'ufo' | 'vimana' | 'birds' | 'meteor' | 'dragon' | 'dino' | 'aliens' | 'cows' | 'gnomes' | 'security'
  | 'gorilla' | 'rabbit' | 'rasta' | 'redcross' | 'smoke';
interface Ev { kind: FxKind; t0: number; dur: number; seed: number }
interface Particle { x: number; y: number; vx: number; vy: number; t: number; life: number; col: string; kind: 'confetti' | 'bubble' | 'puff' | 'spark' }

const DUR: Record<FxKind, number> = {
  ufo: 9, vimana: 14, birds: 10, meteor: 3, dragon: 11, dino: 16, aliens: 12, cows: 12, gnomes: 13, security: 7,
  gorilla: 14, rabbit: 7, rasta: 16, redcross: 10, smoke: 8,
};
const KINDS = Object.keys(DUR) as FxKind[];

export function createFx(g: Ctx, text: (s: string, x: number, y: number, size?: number, color?: string) => void) {
  let events: Ev[] = [];
  let parts: Particle[] = [];
  let moonHit = 1e9; // song time when the rocket hits the moon
  let flash = 0;

  function ell(x: number, y: number, rx: number, ry: number, fill: string, lw = 2) {
    g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
    g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); }
  }
  function shape(pts: number[][], fill: string, lw = 2) {
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
    g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.lineJoin = 'round'; g.stroke(); }
  }
  function line(pts: number[][], col = INK, lw = 3) {
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  }
  function eyes(x: number, y: number, r: number, look = 0) {
    ell(x - r, y, r, r * 1.1, '#fff', 1.2); ell(x + r, y, r, r * 1.1, '#fff', 1.2);
    g.fillStyle = INK; g.beginPath(); g.arc(x - r + look, y, r * 0.35, 0, 7); g.arc(x + r + look, y, r * 0.35, 0, 7); g.fill();
  }
  // a little cartoon person, feet at (x, y)
  function person(x: number, y: number, s: number, o: { shirt: string; skin?: string; hat?: string; run?: number; arms?: number; label?: string }) {
    g.save(); g.translate(x, y); g.scale(s, s);
    const run = o.run ?? 0, lg = Math.sin(run) * 7;
    line([[-4, -16], [-4 + lg, 0]], INK, 4); line([[4, -16], [4 - lg, 0]], INK, 4);
    shape([[-11, -14], [11, -14], [9, -40], [-9, -40]], o.shirt, 1.8);
    const a = o.arms ?? 0;
    line([[-9, -36], [-17, a > 0 ? -58 : -22 + Math.sin(run) * 4]], INK, 4); line([[9, -36], [17, a > 0 ? -58 : -22 - Math.sin(run) * 4]], INK, 4);
    ell(0, -52, 13, 12, o.skin ?? '#f2c9a0', 1.8);
    if (o.hat) shape([[-13, -56], [13, -56], [10, -66], [-10, -66]], o.hat, 1.5);
    eyes(0, -54, 4.2, 1);
    if (o.label) { g.font = '7px "Lilita One", system-ui, sans-serif'; g.fillStyle = PAPER; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.label, 0, -28); }
    g.restore();
  }

  // ---------- schedule ----------
  function schedule(duration: number, start: number, seed: number) {
    const r = rng(seed);
    events = []; parts = []; flash = 0;
    let t = start + 2, i = 0;
    const order = [...KINDS].filter((k) => k !== 'smoke').sort(() => r() - 0.5);
    while (t < duration - 10) {
      const kind = order[i % order.length]; i++;
      events.push({ kind, t0: t, dur: DUR[kind], seed: Math.floor(r() * 1e6) });
      // the festival gets crazier: from one thing every ~9 s to one every ~3.5 s
      const k = (t - start) / (duration - start);
      t += lerp(9, 3.5, k) + r() * 2;
      if (i % order.length === 0) order.sort(() => r() - 0.5);
    }
    for (let s = start + 20; s < duration - 8; s += 34) events.push({ kind: 'smoke', t0: s, dur: DUR.smoke, seed: s });
    moonHit = duration * 0.72;
  }
  const active = (t: number, where: FxKind[]) => events.filter((e) => where.includes(e.kind) && t >= e.t0 && t < e.t0 + e.dur);

  // ---------- particles ----------
  function confetti(x: number, y: number, n: number, seed = 1) {
    const r = rng(seed + Math.floor(x * 7 + y));
    const cols = ['#ffec00', '#6cbc92', '#ce460a', '#fdf3e1', '#b2cc3c', '#fcc400', '#e2622a', '#ff7ac8'];
    for (let k = 0; k < n; k++) parts.push({ x, y, vx: (r() - 0.5) * 420, vy: -150 - r() * 320, t: 0, life: 2.5 + r() * 1.5, col: cols[k % cols.length], kind: 'confetti' });
  }
  function strobe() { flash = 1; }
  function stepParts(dt: number) {
    for (const p of parts) {
      p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'confetti') { p.vy += 380 * dt; p.vx *= 0.97; if (p.vy > 60) p.vy = 60; }
      else if (p.kind === 'bubble') { p.vx = Math.sin(p.t * 2 + p.life * 9) * 25; }
      else if (p.kind === 'puff') { p.vx *= 0.99; }
      else if (p.kind === 'spark') { p.vy += 300 * dt; }
    }
    parts = parts.filter((p) => p.t < p.life);
  }
  function drawParts(kinds: Particle['kind'][]) {
    for (const p of parts) {
      if (!kinds.includes(p.kind)) continue;
      const a = 1 - p.t / p.life;
      if (p.kind === 'confetti') { g.save(); g.translate(p.x, p.y); g.rotate(p.t * 9 + p.life * 3); g.fillStyle = p.col; g.fillRect(-4, -2.5, 8, 5); g.restore(); }
      else if (p.kind === 'bubble') {
        const r = 4 + p.life;
        g.globalAlpha = Math.min(1, a * 2) * 0.8; g.beginPath(); g.arc(p.x, p.y, r, 0, 7); g.strokeStyle = '#bfe8ff'; g.lineWidth = 1.6; g.stroke();
        g.fillStyle = 'rgba(255,255,255,.25)'; g.fill(); g.fillStyle = '#fff'; g.fillRect(p.x - r * 0.45, p.y - r * 0.5, 2, 2); g.globalAlpha = 1;
      } else if (p.kind === 'puff') {
        g.globalAlpha = a * 0.55; ell(p.x, p.y, 10 + p.t * 16, 8 + p.t * 12, p.col, 0); g.globalAlpha = 1;
      } else { g.fillStyle = p.col; g.globalAlpha = a; g.fillRect(p.x - 1.5, p.y - 1.5, 3, 3); g.globalAlpha = 1; }
    }
  }

  // ---------- sky ----------
  function kilimanjaro(night: number) {
    const rock = `rgb(${Math.round(lerp(132, 70, night))},${Math.round(lerp(112, 78, night))},${Math.round(lerp(120, 104, night))})`;
    shape([[520, 220], [640, 120], [690, 104], [730, 112], [770, 100], [900, 220]], rock, 0);
    shape([[628, 130], [640, 120], [690, 104], [730, 112], [770, 100], [786, 116], [764, 130], [742, 122], [716, 134], [690, 120], [664, 136]], '#fdf8ee', 0);
  }
  function sky(t: number, night: number) {
    kilimanjaro(night);
    for (const e of active(t, ['ufo', 'vimana', 'birds', 'meteor', 'dragon', 'dino'])) {
      const f = (t - e.t0) / e.dur, r = rng(e.seed);
      const dir = r() < 0.5 ? 1 : -1, x = dir > 0 ? lerp(-120, 1080, f) : lerp(1080, -120, f);
      if (e.kind === 'ufo') {
        const y = 80 + Math.sin(t * 2.5) * 30 + r() * 40;
        if (Math.sin(t * 1.3 + e.seed) > 0.4) { g.fillStyle = 'rgba(178,240,106,.25)'; g.beginPath(); g.moveTo(x - 14, y + 8); g.lineTo(x + 14, y + 8); g.lineTo(x + 60, 300); g.lineTo(x - 60, 300); g.closePath(); g.fill(); }
        ell(x, y - 8, 20, 16, '#bfe8ff', 2); ell(x, y, 48, 12, '#9aa6a3', 2);
        for (let k = -2; k <= 2; k++) ell(x + k * 17, y + 2, 3.5, 3.5, Math.sin(t * 12 + k) > 0 ? '#ffec00' : '#ce460a', 1);
      } else if (e.kind === 'vimana') {
        const y = 90 + Math.sin(t * 1.4) * 10;
        g.save(); g.translate(x, y); g.scale(dir, 1);
        shape([[-70, 6], [70, 6], [54, 22], [-54, 22]], '#fcc400');
        shape([[-46, 6], [46, 6], [36, -12], [-36, -12]], '#ce460a');
        shape([[-26, -12], [26, -12], [16, -34], [-16, -34]], '#fcc400');
        shape([[-8, -34], [8, -34], [0, -56]], '#ffec00');
        shape([[-60, 0], [-110, -18 + Math.sin(t * 9) * 10], [-70, 14]], '#fdf3e1');
        shape([[60, 0], [110, -18 + Math.sin(t * 9) * 10], [70, 14]], '#fdf3e1');
        for (let k = -3; k <= 3; k++) ell(k * 12, 0, 3, 4, '#3f8f86', 1);
        g.fillStyle = 'rgba(255,236,0,.5)'; g.beginPath(); g.moveTo(-50, 24); g.lineTo(50, 24); g.lineTo(30 + Math.sin(t * 20) * 6, 40); g.lineTo(-30, 40); g.closePath(); g.fill();
        g.restore();
      } else if (e.kind === 'birds') {
        for (let k = 0; k < 7; k++) {
          const bx = x - dir * (Math.abs(k - 3) * 26), by = 60 + r() * 20 + Math.abs(k - 3) * 14 + Math.sin(t * 3 + k) * 4, w = Math.sin(t * 14 + k) * 7;
          line([[bx - 12, by - w], [bx, by], [bx + 12, by - w]], INK, 3);
        }
      } else if (e.kind === 'meteor') {
        for (let k = 0; k < 3; k++) {
          const ff = clamp(f * 1.6 - k * 0.25), mx = lerp(200 + k * 260, -40 + k * 260, ff), my = lerp(-30, 250, ff);
          if (ff <= 0 || ff >= 1) continue;
          const gr = g.createLinearGradient(mx, my, mx + 120, my - 110); gr.addColorStop(0, 'rgba(255,236,0,.9)'); gr.addColorStop(1, 'rgba(206,70,10,0)');
          g.strokeStyle = gr; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(mx, my); g.lineTo(mx + 120, my - 110); g.stroke();
          ell(mx, my, 11, 10, '#8a5a3a', 2);
        }
      } else if (e.kind === 'dragon') {
        const y = 120;
        for (let k = 14; k >= 0; k--) {
          const sx = x - dir * k * 16, sy = y + Math.sin(t * 4 - k * 0.6) * 22;
          ell(sx, sy, 13 - k * 0.45, 12 - k * 0.45, k % 2 ? '#6cbc92' : '#4fa37e', 1.8);
          if (k % 3 === 0 && k > 0) shape([[sx - 5, sy - 10], [sx + 5, sy - 10], [sx, sy - 22]], '#ce460a', 1.4);
        }
        const hy = y + Math.sin(t * 4) * 22;
        g.save(); g.translate(x, hy); g.scale(dir, 1);
        shape([[-6, -12], [24, -6], [30, 4], [-6, 12]], '#6cbc92'); eyes(8, -4, 3.4, 1);
        line([[0, -12], [-10, -26]], '#ffec00', 3); line([[6, -12], [2, -28]], '#ffec00', 3);
        if (Math.sin(t * 2) > 0.3) { shape([[30, 2], [80, -14 + Math.sin(t * 30) * 4], [90, 6], [80, 20 + Math.sin(t * 27) * 4]], '#ffec00', 1.5); shape([[30, 2], [64, -4], [70, 6], [64, 14]], '#ce460a', 0); }
        g.restore();
      } else if (e.kind === 'dino') {
        // a dinosaur walks over the hills, behind the stage
        const y = 214, step = Math.sin(t * 5);
        g.save(); g.translate(x, y); g.scale(dir, 1);
        shape([[-70, -30], [-10, -46], [20, -40], [30, -30], [10, -10], [-40, -14]], '#b2cc3c');
        shape([[16, -42], [26, -86], [50, -96], [70, -88], [70, -76], [46, -72], [34, -40]], '#b2cc3c');
        line([[48, -78], [66, -78]], INK, 2); ell(52, -88, 3, 3, '#fff', 1);
        line([[-30, -14], [-30 + step * 10, 10]], '#8aa82a', 9); line([[0, -14], [0 - step * 10, 10]], '#8aa82a', 9);
        line([[30, -50], [40, -40]], '#8aa82a', 4);
        for (let k = 0; k < 5; k++) shape([[-50 + k * 14, -40 + k * -1], [-42 + k * 14, -40], [-46 + k * 14, -54]], '#ce460a', 1.2);
        g.restore();
      }
    }
  }
  // the cinema moon: once the rocket has hit, the moon has a face with the rocket stuck in its eye
  function moon(t: number, x: number, y: number) {
    if (t < moonHit - 2.4) return false;
    const fl = clamp((t - (moonHit - 2.4)) / 2.4), hit = t >= moonHit;
    const r = 36;
    ell(x, y, r, r, '#fdf3e1', 2.5);
    ell(x - 14, y + 12, 6, 5, '#e8dcc0', 0); ell(x + 18, y - 18, 5, 4, '#e8dcc0', 0);
    if (hit) {
      ell(x - 11, y - 6, 6, 4, '#fff', 1.5); g.fillStyle = INK; g.beginPath(); g.arc(x - 11, y - 6, 2, 0, 7); g.fill();
      line([[x - 14, y + 16], [x - 4, y + 12], [x + 8, y + 18]], INK, 2.5); // grimace
      line([[x + 4, y - 14], [x + 20, y - 10]], INK, 2);
    } else {
      eyes(x, y - 6, 6, 0);
      g.beginPath(); g.arc(x, y + 10, 10, 0.1 * Math.PI, 0.9 * Math.PI); g.strokeStyle = INK; g.lineWidth = 2.5; g.stroke();
    }
    // the rocket
    const rx = hit ? x + 11 : lerp(x - 420, x + 11, fl * fl), ry = hit ? y - 6 : lerp(y + 260, y - 6, fl * fl) + Math.sin(fl * 8) * 10 * (1 - fl);
    g.save(); g.translate(rx, ry); g.rotate(-0.55);
    shape([[-30, -7], [0, -7], [10, 0], [0, 7], [-30, 7]], '#9aa6a3', 1.8);
    shape([[-30, -7], [-38, -14], [-34, 0], [-38, 14], [-30, 7]], '#ce460a', 1.4);
    ell(-10, 0, 3.5, 3.5, '#bfe8ff', 1);
    if (!hit) shape([[-38, -4], [-56 - Math.sin(t * 30) * 6, 0], [-38, 4]], '#ffec00', 0);
    g.restore();
    if (hit && t < moonHit + 0.6) text('BAM!', x - 60, y + 40, 26, '#ffec00');
    return true;
  }

  // ---------- stage ----------
  function stage(t: number, ph: number) {
    for (const e of active(t, ['aliens', 'cows', 'gnomes', 'security', 'smoke'])) {
      const f = (t - e.t0) / e.dur, r = rng(e.seed);
      if (e.kind === 'aliens') {
        // a saucer beams three little aliens onto the stage, they dance, then get beamed up again
        const k = f < 0.15 ? f / 0.15 : f > 0.85 ? (1 - f) / 0.15 : 1;
        const ux = 480, uy = lerp(-40, 70, Math.min(1, k * 2));
        g.fillStyle = `rgba(178,240,106,${0.22 * k})`; g.beginPath(); g.moveTo(ux - 16, uy + 8); g.lineTo(ux + 16, uy + 8); g.lineTo(ux + 170, 400); g.lineTo(ux - 170, 400); g.closePath(); g.fill();
        ell(ux, uy - 8, 20, 16, '#bfe8ff', 2); ell(ux, uy, 50, 12, '#9aa6a3', 2);
        for (let a = 0; a < 3; a++) {
          const ax = 400 + a * 80, ay = 388 - (1 - k) * 160, jump = Math.abs(Math.sin(ph * Math.PI + a)) * 10;
          g.save(); g.translate(ax, ay - jump);
          line([[-5, -12], [-8, 0]], '#4fa37e', 4); line([[5, -12], [8, 0]], '#4fa37e', 4);
          ell(0, -18, 8, 10, '#b2f06a', 1.8);
          line([[-7, -22], [-16, -34 + Math.sin(t * 10 + a) * 6]], '#4fa37e', 3); line([[7, -22], [16, -34 - Math.sin(t * 10 + a) * 6]], '#4fa37e', 3);
          ell(0, -38, 13, 11, '#b2f06a', 1.8);
          ell(-5, -38, 4.5, 6, INK, 0); ell(5, -38, 4.5, 6, INK, 0);
          line([[-4, -48], [-8, -58]], INK, 1.5); line([[4, -48], [8, -58]], INK, 1.5); ell(-8, -59, 2.5, 2.5, '#ffec00', 1); ell(8, -59, 2.5, 2.5, '#ffec00', 1);
          g.restore();
        }
      } else if (e.kind === 'cows') {
        for (let c = 0; c < 3; c++) {
          const cx = lerp(-100 - c * 90, 1060 - c * 90, f), cy = 384 - c * 8, step = Math.sin(t * 6 + c);
          g.save(); g.translate(cx, cy);
          line([[-22, -16], [-22 + step * 6, 0]], INK, 4); line([[18, -16], [18 - step * 6, 0]], INK, 4);
          ell(0, -26, 30, 15, '#fdf3e1', 2);
          ell(-10, -30, 8, 6, INK, 0); ell(12, -22, 6, 5, INK, 0);
          ell(34, -36, 11, 10, '#fdf3e1', 2); ell(40, -32, 6, 5, '#f3a6b0', 1.2);
          shape([[28, -44], [24, -54], [32, -46]], '#fcc400', 1.2);
          ell(33, -39, 2, 2, INK, 0);
          if (Math.sin(t * 1.5 + c * 2) > 0.85) text('MOO!', 40, -64, 16, PAPER);
          g.restore();
        }
      } else if (e.kind === 'gnomes') {
        for (let n = 0; n < 4; n++) {
          const gx = lerp(1000 + n * 40, -60 + n * 40, f), gy = 392 - (n % 2) * 10, hop = Math.abs(Math.sin(t * 8 + n)) * 4;
          g.save(); g.translate(gx, gy - hop);
          line([[-3, -8], [-4, 0]], INK, 3); line([[3, -8], [4, 0]], INK, 3);
          shape([[-8, -6], [8, -6], [6, -20], [-6, -20]], '#3f8f86', 1.5);
          ell(0, -24, 7, 6, '#f2c9a0', 1.5);
          shape([[-7, -24], [7, -24], [0, -14]], '#fdf3e1', 1.2);
          shape([[-8, -27], [8, -27], [2, -46]], '#ce460a', 1.5);
          g.restore();
        }
      } else if (e.kind === 'security') {
        // a fan storms the stage, security chases him, and he stage-dives just in time
        const fx = f < 0.55 ? lerp(120, 560, f / 0.55) : 560, run = t * 14;
        if (f < 0.55) person(fx, 390, 0.9, { shirt: '#ff7ac8', run, arms: 1 });
        else {
          const k = clamp((f - 0.55) / 0.2), dx = lerp(560, 640, k), dy = 390 - Math.sin(k * Math.PI) * 120 + k * 80;
          if (k < 1) { g.save(); g.translate(dx, dy); g.rotate(k * 1.4); person(0, 0, 0.9, { shirt: '#ff7ac8', arms: 1 }); g.restore(); }
          else person(lerp(640, 760, clamp((f - 0.75) / 0.25)), 486 - Math.abs(Math.sin(t * 6)) * 6, 0.9, { shirt: '#ff7ac8', arms: 1 }); // crowd surfing
          if (k > 0.2 && k < 0.9) text('STAGEDIVE!', 620, 250, 22, '#ffec00');
        }
        const sx = f < 0.6 ? lerp(-20, 520, f / 0.6) : 520 + Math.sin(t * 6) * 4;
        person(sx, 392, 1.05, { shirt: '#141414', skin: '#b97a4e', run: f < 0.6 ? run + 1 : 0, arms: f > 0.6 ? 1 : 0, label: 'SECURITY' });
      } else if (e.kind === 'smoke') {
        // smoke machines on both sides of the stage
        if (f < 0.6 && r() < 0.9) for (const sx of [260, 700]) parts.push({ x: sx + (Math.random() - 0.5) * 20, y: 380, vx: (sx < 480 ? 1 : -1) * (60 + Math.random() * 60), vy: -8 - Math.random() * 10, t: 0, life: 3.2, col: '#e8eef0', kind: 'puff' });
      }
    }
    drawParts(['puff']);
  }

  // ---------- crowd ----------
  function crowd(t: number, dt: number, hype: number, night: number, ph: number) {
    // soap bubbles once the party is on
    if (t > 0 && Math.random() < dt * hype * 2.5) parts.push({ x: 40 + Math.random() * 880, y: 470, vx: 0, vy: -40 - Math.random() * 30, t: 0, life: 5 + Math.random() * 3, col: '#fff', kind: 'bubble' });
    // reggae smoke plumes (420) rising from a few spots in the crowd
    const plume = t > 30 && Math.sin(t * 0.21) > 0.55;
    if (plume && Math.random() < dt * 8) { const px = [180, 520, 820][Math.floor(Math.random() * 3)]; parts.push({ x: px, y: 440, vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 20, t: 0, life: 4, col: '#b8c8a8', kind: 'puff' }); }
    // bengal fires at night: red flares with sparks
    if (night > 0.3) {
      for (const bx of [90, 300, 640, 870]) {
        const by = 470 + (bx % 3) * 10;
        g.fillStyle = `rgba(255,60,40,${0.18 * night})`; g.beginPath(); g.arc(bx, by - 40, 60, 0, 7); g.fill();
        line([[bx, by], [bx, by - 34]], INK, 3);
        ell(bx, by - 38, 5 + Math.random() * 3, 5 + Math.random() * 3, Math.random() < 0.5 ? '#ff5a3c' : '#ffd0c0', 0);
        if (Math.random() < dt * 30) parts.push({ x: bx, y: by - 38, vx: (Math.random() - 0.5) * 120, vy: -80 - Math.random() * 80, t: 0, life: 0.7, col: '#ffd060', kind: 'spark' });
      }
    }
    // lasers from the truss at night when the crowd goes wild
    if (night > 0.4 && hype > 0.55) {
      g.globalAlpha = 0.55; g.lineWidth = 2;
      for (let k = 0; k < 6; k++) {
        const a = Math.sin(t * 1.7 + k * 1.1) * 0.9, sx = 300 + k * 72;
        g.strokeStyle = k % 2 ? '#b2f06a' : '#ff5ad0'; g.beginPath(); g.moveTo(sx, 56); g.lineTo(sx + Math.sin(a) * 700, 56 + Math.cos(a) * 700); g.stroke();
      }
      g.globalAlpha = 1;
    }
    for (const e of active(t, ['gorilla', 'rabbit', 'rasta', 'redcross'])) {
      const f = (t - e.t0) / e.dur;
      if (e.kind === 'gorilla') {
        const gx = lerp(-60, 1020, f), gy = 540, ballK = (t * 1.3) % 1, bx = gx + 40, by = gy - 120 - Math.sin(ballK * Math.PI) * 120;
        g.save(); g.translate(gx, gy + Math.abs(Math.sin(t * 6)) * -4);
        shape([[-30, 0], [30, 0], [36, -50], [24, -76], [-24, -76], [-36, -50]], '#3a3a3a');
        ell(0, -84, 20, 18, '#3a3a3a', 2); ell(0, -80, 13, 11, '#8a6a5a', 1.5); eyes(0, -88, 4, 1);
        line([[-30, -60], [-46, -110]], '#3a3a3a', 10); line([[30, -60], [40, -110]], '#3a3a3a', 10);
        g.restore();
        g.save(); g.translate(bx, by); g.rotate(t * 4);
        for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 18, (k * Math.PI) / 3, ((k + 1) * Math.PI) / 3); g.closePath(); g.fillStyle = ['#ce460a', '#fdf3e1', '#3f8f86', '#ffec00', '#fdf3e1', '#ff7ac8'][k]; g.fill(); }
        g.beginPath(); g.arc(0, 0, 18, 0, 7); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
        g.restore();
      } else if (e.kind === 'rabbit') {
        const rx = lerp(1000, -40, f), hop = Math.abs(Math.sin(t * 9)) * 26, ry = 528 - hop;
        g.save(); g.translate(rx, ry);
        ell(0, -12, 14, 11, '#fdf3e1', 1.8); ell(-12, -24, 9, 8, '#fdf3e1', 1.8);
        ell(-14, -42, 3.5, 11, '#fdf3e1', 1.5); ell(-7, -42, 3.5, 11, '#fdf3e1', 1.5);
        ell(-16, -26, 2, 2, INK, 0); ell(13, -10, 5, 5, '#fff', 1.2);
        g.restore();
      } else if (e.kind === 'rasta') {
        // a rasta man sways in the crowd, smoke rising
        const rx = 700, ry = 520, sway = Math.sin(t * 2) * 6;
        g.save(); g.translate(rx + sway, ry);
        shape([[-16, 0], [16, 0], [13, -38], [-13, -38]], '#fdf3e1', 1.8);
        for (let k = -3; k <= 3; k++) line([[k * 4.5, -60], [k * 6, -32 + Math.abs(k) * 2]], '#2a1a10', 4);
        ell(0, -54, 13, 13, '#7a4a2c', 1.8); eyes(0, -56, 3.8, 0);
        g.beginPath(); g.arc(0, -50, 5, 0.15 * Math.PI, 0.85 * Math.PI); g.strokeStyle = INK; g.lineWidth = 1.6; g.stroke();
        shape([[-18, -62], [18, -62], [14, -80], [-14, -80]], '#ce460a', 1.5);
        g.fillStyle = '#ffec00'; g.fillRect(-15, -71, 30, 4); g.fillStyle = '#4fa37e'; g.fillRect(-14, -66, 28, 4);
        line([[13, -30], [26, -48]], INK, 4); ell(28, -50, 3, 3, '#ff5a3c', 0);
        g.restore();
        if (Math.random() < dt * 6) parts.push({ x: rx + 28, y: ry - 54, vx: (Math.random() - 0.5) * 16, vy: -26, t: 0, life: 4, col: '#b8c8a8', kind: 'puff' });
        if (Math.sin(t * 3) > 0) text('420', rx + 50, ry - 110, 18, '#b2f06a');
      } else if (e.kind === 'redcross') {
        const cx = lerp(1040, -160, f), run = t * 10;
        g.save(); g.translate(cx, 0);
        person(-46, 536, 1, { shirt: '#fdf3e1', run, hat: '#ce460a' });
        person(46, 536, 1, { shirt: '#fdf3e1', run: run + 2, hat: '#ce460a' });
        shape([[-56, 506], [56, 506], [56, 498], [-56, 498]], '#e8dcc0', 1.8);
        person(0, 498, 0.7, { shirt: '#ffec00', arms: 1 }); // the happy patient
        g.fillStyle = '#e0242a'; g.fillRect(-49, 498 - 26 - 6, 6, 18); g.fillRect(-55, 498 - 26, 18, 6);
        g.restore();
      }
    }
    drawParts(['bubble', 'spark', 'confetti']);
    if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 0.5})`; g.fillRect(0, 0, 960, 540); flash = Math.max(0, flash - dt * 4); }
  }

  return { schedule, sky, moon, stage, crowd, confetti, strobe, stepParts, get parts() { return parts.length; } };
}

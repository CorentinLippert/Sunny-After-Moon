// Sunny After Moon: the game. A rhythm runner where the level scrolls with the song:
// the musician's x position is the song time multiplied by SPEED, so obstacles always meet you on the beat.
import * as art from './art';
import { PAL } from './art';

// --- physics, keep in sync with scripts/game/level_balkan_booby.py ---
const SPEED = 180;
const G = 1100;
const JUMP = -360;
const JUMP2 = -320;
const GLIDE_FALL = 70;
const TRAMP = -560;
const STOMP = -300;
const STEP = 1 / 240;

const W = 480, H = 270;
const PLAYER_SCREEN_X = 120;
const HIT_W = 16, HIT_H = 34;

export type Lang = 'en' | 'nl' | 'fr';
type Action = 'shoot' | 'hit';
interface Char { id: string; name: string; action: Action; proj?: string; eyes: [number, number, number]; front?: number; color: string }

export const CHARS: Char[] = [
  { id: 'sam', name: 'Sam', action: 'hit', eyes: [32, 16, 15], color: '#ffec00' },
  { id: 'yorick', name: 'Yorick', action: 'shoot', proj: 'voice', eyes: [29.5, 22.5, 22], color: '#6cbc92' },
  { id: 'corentin', name: 'Corentin', action: 'shoot', proj: 'sax', eyes: [32, 25.5, 23], color: '#fcc400' },
  { id: 'hans', name: 'Hans', action: 'hit', eyes: [32, 33, 18], color: '#4fa37e' },
  { id: 'tijl', name: 'Tijl', action: 'shoot', proj: 'keys', eyes: [32, 29.5, 20], color: '#3f8f86' },
  { id: 'wim', name: 'Wim', action: 'shoot', proj: 'stick', eyes: [32, 26, 23], front: 2, color: '#e2622a' },
  { id: 'simon', name: 'Simon', action: 'hit', eyes: [32, 18.5, 16], color: '#b2cc3c' },
  { id: 'tomas', name: 'Tomas', action: 'hit', eyes: [31.5, 24.5, 24], color: '#f39a1e' },
];

interface Level {
  title: string;
  song: { src: string; duration: number; bpm: number; beats: number[] };
  speed: number; ground: number;
  pits: [number, number][];
  jellies: { x: number; y: number; w: number }[];
  tramps: { x: number }[];
  babushkas: { x: number; kind: 'hop' | 'big' | 'sleep' }[];
  coins: [number, number][];
  checkpoints: { t: number; x: number; label: string }[];
  signs: { x: number; key: string }[];
  plan: [number, 'jump' | 'jump2' | 'release'][];
  finish: number;
}

interface Bab { x: number; kind: 'hop' | 'big' | 'sleep'; dead: boolean; vx: number; vy: number; dy: number; rot: number; hits: number; flash: number }
interface Float { x: number; y: number; text: string; t: number; color: string }
interface Proj { x: number; y: number; vx: number; t: number; kind: string }

// --- song clock on the Web Audio API ---
class Song {
  ctx: AudioContext | null = null;
  buf: AudioBuffer | null = null;
  src: AudioBufferSourceNode | null = null;
  gain: GainNode | null = null;
  startedAt = 0; offset = 0; playing = false; muted = false;
  virtual = false; vStart = 0; rate = 1;
  data: Promise<ArrayBuffer>;
  constructor(url: string, virtual: boolean, rate: number) {
    this.virtual = virtual;
    this.rate = rate;
    this.data = virtual ? Promise.resolve(new ArrayBuffer(0)) : fetch(url).then((r) => r.arrayBuffer());
  }
  private loading: Promise<void> | null = null;
  private ensureCtx() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.gain = this.ctx.createGain();
      this.gain.connect(this.ctx.destination);
      if (this.muted) this.gain.gain.value = 0;
    }
    return this.ctx;
  }
  // Must run inside a key/tap handler: browsers only let audio start from a user gesture.
  wake() {
    if (this.virtual) return;
    const ctx = this.ensureCtx();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  }
  // Decoding works while the context is still suspended, so it can start right away.
  load() {
    if (this.virtual) return Promise.resolve();
    if (!this.loading) {
      const ctx = this.ensureCtx();
      this.loading = this.data
        .then((d) => ctx.decodeAudioData(d.slice(0)))
        .then((b) => { this.buf = b; });
    }
    return this.loading;
  }
  play(from: number) {
    this.stop();
    this.offset = Math.max(0, from);
    this.playing = true;
    if (this.virtual || !this.ctx || !this.buf) { this.vStart = performance.now(); return; }
    this.src = this.ctx.createBufferSource();
    this.src.buffer = this.buf;
    this.src.connect(this.gain!);
    this.src.start(0, this.offset);
    this.startedAt = this.ctx.currentTime;
  }
  stop() {
    if (this.src) { try { this.src.stop(); } catch {} this.src.disconnect(); this.src = null; }
    if (this.playing) this.offset = this.time();
    this.playing = false;
  }
  time() {
    if (!this.playing) return this.offset;
    if (this.virtual || !this.ctx) return this.offset + ((performance.now() - this.vStart) / 1000) * this.rate;
    const lat = (this.ctx as any).outputLatency || this.ctx.baseLatency || 0;
    return this.offset + this.ctx.currentTime - this.startedAt - lat;
  }
  setMuted(m: boolean) { this.muted = m; if (this.gain) this.gain.gain.value = m ? 0 : 1; }
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = rej;
    im.src = src;
  });
}

export async function startGame(canvas: HTMLCanvasElement, texts: Record<string, string>, lang: Lang) {
  const c = canvas.getContext('2d')!;
  canvas.width = W; canvas.height = H;
  c.imageSmoothingEnabled = false;
  const T = (k: string) => texts[k] ?? k;
  const params = new URLSearchParams(location.search);
  const autoplay = params.has('autoplay');
  const virtual = params.has('nosound');
  const rate = Number(params.get('rate') || 1);

  const [level, spriteMeta, headMeta] = await Promise.all([
    fetch('/game/levels/balkan-booby.json').then((r) => r.json() as Promise<Level>),
    fetch('/game/sprites/sprites.json').then((r) => r.json()),
    fetch('/game/heads/heads.json').then((r) => r.json()),
  ]);
  const song = new Song(level.song.src, virtual, rate);
  song.load().catch(() => {}); // start decoding the song while the title screen shows
  const sprites: Record<string, HTMLImageElement> = {};
  const heads: Record<string, HTMLImageElement> = {};
  await Promise.all(CHARS.map(async (ch) => {
    sprites[ch.id] = await loadImage(`/game/sprites/${ch.id}.png`);
    heads[ch.id] = await loadImage(`/game/heads/${ch.id}.png`);
  }));
  const CELL: number = spriteMeta.cell;
  const HEAD: number = headMeta.size;
  const GROUND = level.ground;
  const beats = level.song.beats;
  const BEAT = 60 / level.song.bpm;

  // ---------------- input ----------------
  const keys = { jump: false, action: false };
  let jumpPressed = false, actionPressed = false, anyPressed = false;
  const nav = { left: false, right: false, up: false, down: false, confirm: false, back: false, menu: false };
  const JUMP_KEYS = ['Space', 'ArrowUp', 'KeyW', 'KeyZ'];
  const ACT_KEYS = ['KeyX', 'KeyJ', 'KeyK', 'Enter', 'ShiftLeft', 'ShiftRight', 'ControlLeft'];
  addEventListener('keydown', (e) => {
    if (!canvas.isConnected) return;
    const code = e.code;
    if ([...JUMP_KEYS, ...ACT_KEYS, 'ArrowLeft', 'ArrowRight', 'ArrowDown'].includes(code)) e.preventDefault();
    if (e.repeat) return;
    anyPressed = true;
    song.wake();
    if (JUMP_KEYS.includes(code)) { keys.jump = true; jumpPressed = true; }
    if (ACT_KEYS.includes(code)) { keys.action = true; actionPressed = true; }
    if (code === 'ArrowLeft' || code === 'KeyA' || code === 'KeyQ') nav.left = true;
    if (code === 'ArrowRight' || code === 'KeyD') nav.right = true;
    if (code === 'ArrowUp' || code === 'KeyW' || code === 'KeyZ') nav.up = true;
    if (code === 'ArrowDown' || code === 'KeyS') nav.down = true;
    if (code === 'Enter' || code === 'Space') nav.confirm = true;
    if (code === 'KeyP') nav.back = true;
    if (code === 'Escape') nav.menu = true;
    if (code === 'KeyM') song.setMuted(!song.muted);
  });
  addEventListener('keyup', (e) => {
    if (JUMP_KEYS.includes(e.code)) keys.jump = false;
    if (ACT_KEYS.includes(e.code)) keys.action = false;
  });
  // touch / mouse: left half jumps (hold to glide), right half is the action key; taps also pick a musician
  let pointer: { x: number; y: number } | null = null;
  const touchIds = new Map<number, 'jump' | 'action'>();
  const toCanvas = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    anyPressed = true;
    song.wake();
    const p = toCanvas(e);
    pointer = p;
    const side = p.x < W / 2 ? 'jump' : 'action';
    touchIds.set(e.pointerId, side);
    if (side === 'jump') { keys.jump = true; jumpPressed = true; } else { keys.action = true; actionPressed = true; }
  });
  const up = (e: PointerEvent) => {
    const side = touchIds.get(e.pointerId);
    touchIds.delete(e.pointerId);
    if (side === 'jump' && ![...touchIds.values()].includes('jump')) keys.jump = false;
    if (side === 'action' && ![...touchIds.values()].includes('action')) keys.action = false;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  // ---------------- state ----------------
  type Mode = 'title' | 'select' | 'chosen' | 'loading' | 'play' | 'dead' | 'paused' | 'win';
  let mode: Mode = 'title';
  let modeT = 0;
  let sel = 0;
  let char = CHARS[0];
  let loadingErr = '';

  let y = GROUND, vy = 0, onGround = true, used2 = false, coyote = 0, buffer = 0;
  let hearts = 3, invuln = 0, actT = 0, actCool = 0, hurtT = 0;
  let checkpoint = level.checkpoints[0];
  let score = 0, coinsGot = 0, babsBonked = 0, perfects = 0, combo = 0, deaths = 0, best = 0;
  let deathReason = '';
  let coinTaken = new Uint8Array(level.coins.length);
  let babs: Bab[] = [];
  const floats: Float[] = [];
  const projs: Proj[] = [];
  const trampSquash = new Float32Array(level.tramps.length);
  const jellySquash = new Float32Array(level.jellies.length);
  let camY = 0;
  let lastT = 0;
  let planIdx = 0, botHoldUntil = -1, jumpAt = 0;
  try { best = Number(localStorage.getItem('sam-game-best-balkan') || 0); } catch {}

  const xAt = (t: number) => SPEED * t;
  const inPit = (x: number) => level.pits.some(([a, b]) => x > a + 3 && x < b - 3);

  function resetBabs(fromX: number) {
    babs = level.babushkas.map((b) => ({ x: b.x, kind: b.kind, dead: false, vx: 0, vy: 0, dy: 0, rot: 0, hits: 0, flash: 0 }));
    // babushkas you already passed stay where they were (dead or alive does not matter behind you)
    for (const b of babs) if (b.x < fromX) b.dead = true;
  }

  function respawn(cp = checkpoint) {
    y = GROUND; vy = 0; onGround = true; used2 = false; hearts = 3; invuln = 1.2; camY = 0;
    projs.length = 0;
    // coins after the checkpoint come back, so the run is the same every time
    const tok = new Uint8Array(level.coins.length);
    level.coins.forEach(([cx], i) => { if (cx < cp.x) tok[i] = coinTaken[i]; });
    coinTaken = tok;
    coinsGot = tok.reduce((a, b) => a + b, 0);
    resetBabs(cp.x);
    planIdx = level.plan.findIndex((p) => p[0] >= cp.t - 0.01);
    if (planIdx < 0) planIdx = level.plan.length;
    song.play(cp.t);
    lastT = cp.t;
  }

  function startRun() {
    score = 0; coinsGot = 0; babsBonked = 0; perfects = 0; combo = 0; deaths = 0;
    coinTaken = new Uint8Array(level.coins.length);
    checkpoint = level.checkpoints[0];
    const from = Number(params.get('from') || 0);
    if (from) checkpoint = [...level.checkpoints].reverse().find((cp) => cp.t <= from) || checkpoint;
    respawn(checkpoint);
    mode = 'play';
  }

  function say(text: string, x: number, yy: number, color = PAL.yellow) {
    floats.push({ x, y: yy, text, t: 0, color });
  }

  function nearestBeatDist(t: number) {
    let lo = 0, hi = beats.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (beats[m] < t) lo = m; else hi = m; }
    return Math.min(Math.abs(beats[lo] - t), Math.abs(beats[hi] - t));
  }

  function beatPhase(t: number) {
    let lo = 0, hi = beats.length - 1;
    if (t < beats[0]) return 0;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (beats[m] <= t) lo = m; else hi = m; }
    const span = beats[hi] - beats[lo] || BEAT;
    return Math.max(0, Math.min(1, (t - beats[lo]) / span));
  }

  function die(reason: string) {
    if (mode !== 'play') return;
    deaths++;
    combo = 0;
    deathReason = reason;
    song.stop();
    mode = 'dead';
    modeT = 0;
  }

  function hurt(x: number) {
    if (invuln > 0) return;
    hearts--;
    combo = 0;
    invuln = 1.3;
    hurtT = 0.3;
    vy = Math.min(vy, -220);
    onGround = false;
    say(T('ouch'), x, y - 40, '#ff6b6b');
    if (hearts <= 0) die(T('deadBabushka'));
  }

  function doJump(t: number, x: number) {
    if (onGround || coyote > 0) {
      vy = JUMP; onGround = false; coyote = 0; used2 = false;
      const d = nearestBeatDist(t);
      if (d < 0.06) { perfects++; combo++; score += 10 * Math.min(combo, 8); say(combo > 2 ? `${T('perfect')} x${combo}` : T('perfect'), x, y - 46); }
      else if (d < 0.11) { combo++; score += 4; say(T('good'), x, y - 46, PAL.lime); }
      else combo = 0;
      return true;
    }
    // about to land? keep the press buffered so it becomes a normal jump on landing (rhythm patterns jump every 2 beats)
    if (vy > 0) {
      let below = inPit(x) ? Infinity : GROUND;
      for (const j of level.jellies) if (j.y >= y && Math.abs(x - j.x) < j.w / 2 + 4) below = Math.min(below, j.y);
      if (below - y < vy * 0.09) return false;
    }
    if (!used2) { vy = JUMP2; used2 = true; return true; }
    return false;
  }

  function doAction(x: number) {
    if (actCool > 0) return;
    actCool = 0.32; actT = 0.22;
    if (char.action === 'shoot') projs.push({ x: x + 14, y: y - 22, vx: 330, t: 0, kind: char.proj || 'note' });
    else {
      // melee: whatever is just in front gets bonked
      for (const b of babs) if (!b.dead && b.x - x > -10 && b.x - x < 52) bonk(b, x);
      say('!', x + 30, y - 30, PAL.orange);
    }
  }

  function bonk(b: Bab, x: number) {
    b.hits++;
    b.flash = 0.15;
    if (b.kind === 'big' && b.hits < 2) { say(T('oof'), b.x, GROUND - 56, PAL.orange); return; }
    b.dead = true; b.vx = 160 + Math.random() * 80; b.vy = -260; b.rot = 0;
    babsBonked++; score += 50;
    say(T('opa'), b.x, GROUND - 50, PAL.yellow);
  }

  // ---------------- simulation ----------------
  function update(t: number, dtReal: number) {
    const x = xAt(t);
    const prevX = xAt(lastT);
    let dt = Math.max(0, Math.min(0.25, t - lastT));
    lastT = t;

    // autopilot (used to test that the level can be finished)
    if (autoplay) {
      while (planIdx < level.plan.length && level.plan[planIdx][0] <= t) {
        const [pt, a] = level.plan[planIdx++];
        jumpAt = pt; // the bot presses at the exact planned moment, inside this frame
        if (a === 'jump') { jumpPressed = true; keys.jump = true; botHoldUntil = t + 0.08; }
        if (a === 'jump2') { jumpPressed = true; keys.jump = true; botHoldUntil = 1e9; }
        if (a === 'release') { keys.jump = false; botHoldUntil = -1; }
      }
      if (botHoldUntil >= 0 && t > botHoldUntil) { keys.jump = false; botHoldUntil = -1; }
    }

    if (jumpPressed) { buffer = 0.11; if (!autoplay) jumpAt = 0; }
    if (actionPressed) doAction(x);
    jumpPressed = false; actionPressed = false;

    invuln = Math.max(0, invuln - dtReal);
    hurtT = Math.max(0, hurtT - dtReal);
    actT = Math.max(0, actT - dtReal);
    actCool = Math.max(0, actCool - dtReal);

    // vertical physics in small fixed steps; x follows the song
    let tt = t - dt;
    while (dt > 1e-6) {
      const h = Math.min(STEP, dt);
      dt -= h; tt += h;
      const px = xAt(tt);
      if (buffer > 0 && tt >= jumpAt) { if (doJump(tt, px)) buffer = 0; else buffer -= h; }
      if (coyote > 0) coyote -= h;
      if (!onGround) {
        vy += G * h;
        if (used2 && keys.jump && vy > GLIDE_FALL) vy = GLIDE_FALL;
        const ny = y + vy * h;
        let landed = false;
        if (vy > 0) {
          // jellies (one-way)
          for (let i = 0; i < level.jellies.length; i++) {
            const j = level.jellies[i];
            if (Math.abs(px - j.x) < j.w / 2 + 4 && y <= j.y + 1 && ny >= j.y) {
              y = j.y; vy = 0; onGround = true; used2 = false; landed = true; jellySquash[i] = 1; break;
            }
          }
          // trampolines
          if (!landed) for (let i = 0; i < level.tramps.length; i++) {
            const tr = level.tramps[i];
            if (Math.abs(px - tr.x) < 16 && ny >= GROUND - 10 && y <= GROUND) {
              vy = TRAMP; used2 = false; trampSquash[i] = 1; landed = true; y = GROUND - 10;
              say(T('boing'), tr.x, GROUND - 40, '#ff9fb6');
              break;
            }
          }
          if (!landed && y <= GROUND && ny >= GROUND && !inPit(px)) { y = GROUND; vy = 0; onGround = true; used2 = false; landed = true; }
        }
        if (!landed) y = ny;
      } else {
        // walking: are we still on something?
        let support = false;
        if (Math.abs(y - GROUND) < 0.5) {
          support = !inPit(px);
          for (let i = 0; i < level.tramps.length; i++) {
            const tr = level.tramps[i];
            if (Math.abs(px - tr.x) < 14) { vy = TRAMP; used2 = false; onGround = false; trampSquash[i] = 1; say(T('boing'), tr.x, GROUND - 40, '#ff9fb6'); support = true; break; }
          }
        } else {
          for (const j of level.jellies) if (Math.abs(y - j.y) < 0.5 && Math.abs(px - j.x) < j.w / 2 + 4) support = true;
        }
        if (!support) { onGround = false; coyote = 0.07; }
      }
    }
    if (y > GROUND + 70) { die(T('deadPit')); return; }

    // babushkas
    const ph = beatPhase(t);
    for (const b of babs) {
      b.flash = Math.max(0, b.flash - dtReal);
      if (b.dead) {
        if (b.vy !== 0 || b.vx !== 0) { b.x += b.vx * dtReal; b.dy += b.vy * dtReal; b.vy += 700 * dtReal; b.rot += dtReal * 12; if (b.dy > 300) b.vx = b.vy = 0; }
        continue;
      }
      const s = b.kind === 'big' ? 1.3 : 1;
      const bh = b.kind === 'sleep' ? 14 : b.kind === 'big' ? 46 : 36;
      const bw = b.kind === 'sleep' ? 36 : 20 * s;
      b.dy = b.kind === 'sleep' ? 0 : -Math.abs(Math.sin(ph * Math.PI)) * 4;
      const left = x - HIT_W / 2, right = x + HIT_W / 2, top = y - HIT_H;
      if (right > b.x - bw / 2 && left < b.x + bw / 2 && y > GROUND - bh && top < GROUND) {
        if (vy > 0 && y - vy * 0.02 < GROUND - bh + 10) {
          vy = STOMP; used2 = false; onGround = false;
          bonk(b, x);
          if (b.kind === 'big' && !b.dead) invuln = Math.max(invuln, 0.3);
        } else hurt(x);
      }
    }
    // projectiles
    for (const p of projs) {
      p.x += p.vx * dtReal + (x - prevX) * 0; p.t += dtReal;
      for (const b of babs) if (!b.dead && Math.abs(p.x - b.x) < 14 && p.y > GROUND - 50) { bonk(b, x); p.t = 9; }
    }
    for (let i = projs.length - 1; i >= 0; i--) if (projs[i].t > 0.7) projs.splice(i, 1);

    // coins
    for (let i = 0; i < level.coins.length; i++) {
      if (coinTaken[i]) continue;
      const [cx, cy] = level.coins[i];
      if (cx < x - 30) continue;
      if (cx > x + 30) break;
      if (Math.abs(cx - x) < 12 && cy > y - HIT_H - 6 && cy < y + 6) { coinTaken[i] = 1; coinsGot++; score += 10; }
    }

    // checkpoints
    for (const cp of level.checkpoints) if (cp.t > checkpoint.t && t >= cp.t) { checkpoint = cp; say(T('checkpoint'), x + 40, GROUND - 70, PAL.cream); }

    for (let i = 0; i < trampSquash.length; i++) trampSquash[i] = Math.max(0, trampSquash[i] - dtReal * 4);
    for (let i = 0; i < jellySquash.length; i++) jellySquash[i] = Math.max(0, jellySquash[i] - dtReal * 4);

    // camera follows high jumps
    const want = Math.min(0, y - 90);
    camY += (want - camY) * Math.min(1, dtReal * 6);

    if (x >= level.finish) {
      song.stop();
      mode = 'win'; modeT = 0;
      score += coinsGot * 0 + Math.max(0, 500 - deaths * 50);
      if (score > best) { best = score; try { localStorage.setItem('sam-game-best-balkan', String(best)); } catch {} }
    }
  }

  // ---------------- drawing ----------------
  function text(s: string, x: number, yy: number, size = 10, color = PAL.cream, align: CanvasTextAlign = 'center', outline = true) {
    c.font = `${size}px "Lilita One", system-ui, sans-serif`;
    c.textAlign = align;
    c.textBaseline = 'middle';
    if (outline) {
      c.fillStyle = PAL.ink;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) c.fillText(s, Math.round(x) + dx, Math.round(yy) + dy);
    }
    c.fillStyle = color;
    c.fillText(s, Math.round(x), Math.round(yy));
  }

  function drawHead(ch: Char, x: number, yy: number, size: number, frame: number) {
    const n = headMeta.frames[ch.id] as number;
    const f = ((frame % n) + n) % n;
    c.drawImage(heads[ch.id], f * HEAD, 0, HEAD, HEAD, Math.round(x - size / 2), Math.round(yy - size / 2), size, size);
  }

  function drawPlayer(x: number, t: number) {
    // frame: 0/1 run (switch on every beat), 2 jump, 3 glide, 4 action
    let f = Math.floor(beats.findIndex((b) => b > t)) % 2;
    if (f < 0) f = 0;
    if (!onGround) f = used2 && keys.jump ? 3 : 2;
    if (actT > 0) f = 4;
    if (invuln > 0 && Math.floor(invuln * 16) % 2 === 0) return;
    const bob = onGround ? -Math.round(Math.abs(Math.sin(beatPhase(t) * Math.PI)) * 2) : 0;
    c.drawImage(sprites[char.id], f * CELL, 0, CELL, CELL, Math.round(x - CELL / 2), Math.round(y - CELL + 1 + bob), CELL, CELL);
    if (actT > 0 && char.action === 'hit') {
      c.strokeStyle = PAL.yellow; c.lineWidth = 2;
      c.beginPath(); c.arc(Math.round(x + 18), Math.round(y - 20), 22, -1.1, 1.1 - actT * 4); c.stroke();
    }
  }

  function drawProj(p: Proj, sx: number, sy: number, t: number) {
    c.save();
    c.translate(Math.round(sx), Math.round(sy));
    if (p.kind === 'stick') {
      c.rotate(p.t * 25);
      c.fillStyle = '#e8c48a'; c.fillRect(-7, -1, 14, 2); c.fillStyle = PAL.cream; c.fillRect(5, -1, 2, 2);
    } else if (p.kind === 'voice') {
      c.strokeStyle = PAL.yellow; c.lineWidth = 2;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(-k * 5, 0, 4 + k * 3 + p.t * 10, -0.9, 0.9); c.stroke(); }
    } else if (p.kind === 'keys') {
      c.fillStyle = '#fff'; c.fillRect(-6, -4, 12, 8); c.fillStyle = PAL.ink;
      c.fillRect(-6, -4, 12, 1); c.fillRect(-2, -4, 2, 5); c.fillRect(2, -4, 2, 5); c.fillRect(-6, 3, 12, 1);
    } else {
      // sax notes
      c.fillStyle = PAL.gold;
      c.fillRect(-4, 1, 4, 3); c.fillRect(-1, -6, 1, 8); c.fillRect(-1, -6, 4, 2);
      c.fillRect(4, -1, 3, 3); c.fillRect(6, -7, 1, 7);
    }
    c.restore();
  }

  function drawWorld(t: number, camX: number) {
    const p = Math.min(1, t / level.song.duration);
    const ph = beatPhase(t);
    const pulse = Math.max(0, 1 - ph * 3);
    art.sky(c, W, H, p, camX, camY, pulse);
    c.save();
    c.translate(0, -Math.round(camY));
    const night = Math.max(0, Math.min(1, (p - 0.5) * 2));
    // the abyss under the pits
    const ab = c.createLinearGradient(0, GROUND, 0, GROUND + 26);
    ab.addColorStop(0, 'rgba(43,16,10,0)');
    ab.addColorStop(1, PAL.ink);
    c.fillStyle = ab;
    c.fillRect(0, GROUND, W, 26);
    c.fillStyle = PAL.ink;
    c.fillRect(0, GROUND + 26, W, H);
    // ground slabs = everything minus pits
    let gx = camX - 10;
    const endX = camX + W + 10;
    for (const [a, b] of level.pits) {
      if (b < gx) continue;
      if (a > endX) break;
      art.groundSlab(c, gx - camX, a - camX, GROUND, H - camY + 10, camX, night);
      gx = b;
    }
    if (gx < endX) art.groundSlab(c, gx - camX, Math.min(endX, level.finish + 400) - camX, GROUND, H - camY + 10, camX, night);
    // finish line
    if (level.finish - camX < W + 40) {
      const fx = level.finish - camX;
      for (let k = 0; k < 10; k++) { c.fillStyle = k % 2 ? PAL.ink : PAL.cream; c.fillRect(Math.round(fx), GROUND - 60 + k * 6, 4, 6); c.fillStyle = k % 2 ? PAL.cream : PAL.ink; c.fillRect(Math.round(fx) + 4, GROUND - 60 + k * 6, 4, 6); }
      text(T('finish'), fx + 4, GROUND - 70, 10, PAL.yellow);
    }
    // checkpoints: little moon flags
    for (const cp of level.checkpoints) {
      const sx = cp.x - camX;
      if (sx < -20 || sx > W + 20 || cp.t === 0) continue;
      c.fillStyle = PAL.ink; c.fillRect(Math.round(sx), GROUND - 30, 2, 30);
      c.fillStyle = cp.t <= checkpoint.t ? PAL.yellow : PAL.teal;
      c.fillRect(Math.round(sx) + 2, GROUND - 30, 12, 8);
    }
    // signs
    for (const s of level.signs) {
      const sx = s.x - camX;
      if (sx < -150 || sx > W + 150) continue;
      text(T('sign.' + s.key), sx + 40, GROUND - 100, 11, PAL.cream);
    }
    level.jellies.forEach((j, i) => {
      const sx = j.x - camX;
      if (sx < -60 || sx > W + 60) return;
      art.jelly(c, sx, j.y, j.w, Math.max(jellySquash[i], pulse * 0.4), i);
    });
    level.tramps.forEach((tr, i) => {
      const sx = tr.x - camX;
      if (sx < -40 || sx > W + 40) return;
      art.tramp(c, sx, GROUND, Math.max(trampSquash[i], pulse * 0.25));
    });
    for (let i = 0; i < level.coins.length; i++) {
      const [cx, cy] = level.coins[i];
      if (cx < camX - 10) continue;
      if (cx > camX + W + 10) break;
      if (!coinTaken[i]) art.coin(c, cx - camX, cy, t + i * 0.13);
    }
    for (const b of babs) {
      const sx = b.x - camX;
      if (sx < -40 || sx > W + 40) continue;
      if (b.dead && b.vx === 0 && b.vy === 0) continue;
      c.save();
      if (b.dead) { c.translate(Math.round(sx), Math.round(GROUND + b.dy - 20)); c.rotate(b.rot); c.translate(-Math.round(sx), -Math.round(GROUND - 20)); }
      art.babushka(c, sx, GROUND, b.kind === 'big' ? 1.3 : 1, -b.dy, b.dead ? 'hit' : b.kind === 'sleep' ? 'sleep' : 'dance', t);
      c.restore();
      if (b.kind === 'sleep' && !b.dead) text('z', sx + 14, GROUND - 26 - ((t * 20) % 10), 8, PAL.cream);
      if (b.flash > 0 && !b.dead) text('!', sx, GROUND - 60, 12, PAL.orange);
    }
    for (const pr of projs) drawProj(pr, pr.x - camX, pr.y, t);
    drawPlayer(xAt(t) - camX, t);
    for (const f of floats) text(f.text, f.x - camX, f.y - f.t * 30, 10, f.color);
    c.restore();
  }

  function drawHud(t: number) {
    for (let i = 0; i < 3; i++) art.heart(c, 8 + i * 10, 8, i < hearts);
    art.coin(c, 46, 11, t);
    text(String(coinsGot), 54, 11, 10, PAL.cream, 'left');
    text(`${score}`, W - 8, 11, 10, PAL.yellow, 'right');
    // song progress with checkpoints
    const bw = 160, bx0 = W / 2 - bw / 2;
    c.fillStyle = 'rgba(43,16,10,0.55)'; c.fillRect(bx0, 7, bw, 5);
    c.fillStyle = PAL.yellow; c.fillRect(bx0, 7, Math.round((bw * xAt(t)) / level.finish), 5);
    for (const cp of level.checkpoints) { c.fillStyle = PAL.cream; c.fillRect(Math.round(bx0 + (bw * cp.x) / level.finish), 6, 1, 7); }
    // beat pulse sun
    const pulse = Math.max(0, 1 - beatPhase(t) * 3);
    c.fillStyle = PAL.gold;
    c.beginPath(); c.arc(bx0 + bw + 10, 9, 3 + pulse * 2, 0, Math.PI * 2); c.fill();
    if (combo > 2) text(`${T('combo')} ${combo}`, W - 8, 24, 9, PAL.lime, 'right');
    if (autoplay) text('AUTOPLAY', W / 2, 22, 8, PAL.lime);
    if (song.muted) text(T('muted'), 8, 24, 8, PAL.cream, 'left');
  }

  function drawSunRays(t: number, col1: string, col2: string) {
    c.fillStyle = col1; c.fillRect(0, 0, W, H);
    c.save(); c.translate(W / 2, H / 2 + 20); c.rotate(t * 0.15);
    c.fillStyle = col2;
    for (let k = 0; k < 16; k++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 400, (k * Math.PI) / 8, (k * Math.PI) / 8 + Math.PI / 16); c.closePath(); c.fill(); }
    c.restore();
  }

  const GRID = { cols: 4, w: 96, h: 92, x0: W / 2 - 192 + 48, y0: 92 };
  const cellPos = (i: number) => ({ x: GRID.x0 + (i % 4) * GRID.w, y: GRID.y0 + Math.floor(i / 4) * GRID.h });

  function drawTitle(t: number) {
    drawSunRays(t, PAL.gold, PAL.yellow);
    text('SUNNY AFTER MOON', W / 2, 62, 30, PAL.yellow);
    text(T('game.subtitle'), W / 2, 92, 14, PAL.cream);
    text(`« ${level.title} »`, W / 2, 118, 20, '#ff9fb6');
    art.babushka(c, 90, 230, 1.6, Math.abs(Math.sin(t * 6)) * 5, 'dance', t);
    art.babushka(c, 390, 230, 1.6, Math.abs(Math.cos(t * 6)) * 5, 'dance', t);
    art.jelly(c, 240, 214, 120, Math.abs(Math.sin(t * 6)) * 0.6, 0);
    if (Math.floor(t * 2) % 2 === 0) text(T('pressStart'), W / 2, 176, 13, PAL.cream);
    if (best) text(`${T('best')}: ${best}`, W / 2, 252, 9, PAL.ink, 'center', false);
  }

  function drawSelect(t: number) {
    drawSunRays(t, PAL.teal, '#7fcf9f');
    text(T('choose'), W / 2, 22, 16, PAL.yellow);
    CHARS.forEach((ch, i) => {
      const { x, y: yy } = cellPos(i);
      const on = i === sel;
      c.fillStyle = on ? PAL.yellow : 'rgba(255,243,196,0.35)';
      c.fillRect(x - 40, yy - 38, 80, 82);
      c.fillStyle = on ? ch.color : 'rgba(15,42,38,0.25)';
      c.fillRect(x - 37, yy - 35, 74, 76);
      const frame = Math.floor((t * 1000) / 180) + i * 3;
      drawHead(ch, x, yy - 2, on ? 70 : 60, frame);
      text(ch.name, x, yy + 34, 11, on ? PAL.cream : PAL.cream);
    });
    const ch = CHARS[sel];
    text(`${T('action')}: ${T('act.' + ch.id)}`, W / 2, H - 14, 10, PAL.cream);
  }

  function drawChosen(t: number) {
    drawSunRays(t, char.color, PAL.yellow);
    const size = 168;
    const cx = W / 2, cy = 116;
    drawHead(char, cx, cy, size, char.front ?? 0);
    const [ex, ey, ew] = char.eyes;
    const k = size / HEAD;
    const targetY = cy - size / 2 + ey * k - 1.2 * k;
    const p = Math.min(1, modeT / 0.9);
    const ease = 1 - Math.pow(1 - p, 3);
    const gy = -30 + (targetY + 30) * ease;
    art.glasses(c, cx - size / 2 + ex * k, gy, ew * k * 1.05);
    if (modeT > 1.0) text(T('dealWithIt'), W / 2, 228, 18, PAL.cream);
    if (modeT > 1.0) text(char.name.toUpperCase(), W / 2, 252, 12, PAL.ink, 'center', false);
  }

  function drawOverlay(title: string, lines: string[], color = PAL.yellow) {
    c.fillStyle = 'rgba(15,42,38,0.72)';
    c.fillRect(0, 0, W, H);
    text(title, W / 2, 80, 24, color);
    lines.forEach((l, i) => text(l, W / 2, 120 + i * 18, 11, PAL.cream));
  }

  // ---------------- main loop ----------------
  let prev = performance.now();
  let clock = 0;
  async function confirmChar() {
    char = CHARS[sel];
    mode = 'chosen'; modeT = 0;
    song.load().catch((e) => (loadingErr = String(e)));
  }

  function frame(now: number) {
    const dtReal = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    clock += dtReal;
    modeT += dtReal;
    for (const f of floats) f.t += dtReal;
    for (let i = floats.length - 1; i >= 0; i--) if (floats[i].t > 0.9) floats.splice(i, 1);

    if (mode === 'title') {
      drawTitle(clock);
      if (anyPressed || autoplay) { mode = 'select'; modeT = 0; song.load().catch((e) => (loadingErr = String(e))); }
    } else if (mode === 'select') {
      if (nav.left) sel = (sel + 7) % 8;
      if (nav.right) sel = (sel + 1) % 8;
      if (nav.up || nav.down) sel = (sel + 4) % 8;
      if (pointer && modeT > 0.2) {
        const hit = CHARS.findIndex((_, i) => { const p = cellPos(i); return Math.abs(pointer!.x - p.x) < 42 && Math.abs(pointer!.y - p.y) < 42; });
        if (hit >= 0) { if (hit === sel) confirmChar(); else sel = hit; }
      }
      if (autoplay) { const pick = CHARS.findIndex((ch) => ch.id === params.get('char')); sel = pick >= 0 ? pick : 3; confirmChar(); }
      else if (nav.confirm && modeT > 0.2) confirmChar();
      if (mode === 'select') drawSelect(clock);
    } else if (mode === 'chosen') {
      drawChosen(clock);
      if (modeT > 2.0 && (song.buf || virtual)) startRun();
      else if (modeT > 2.0) text(loadingErr ? loadingErr : T('loading'), W / 2, 200, 10, PAL.cream);
    } else if (nav.menu && (mode === 'play' || mode === 'paused' || mode === 'dead' || mode === 'win')) {
      // Esc: leave the level and go back to the character select
      song.stop();
      mode = 'select'; modeT = 0;
      floats.length = 0;
      drawSelect(clock);
    } else if (mode === 'play') {
      if (nav.back) { song.stop(); mode = 'paused'; }
      else {
        const t = song.time();
        update(t, dtReal);
        const tt = mode === 'play' ? t : lastT;
        drawWorld(tt, xAt(tt) - PLAYER_SCREEN_X);
        drawHud(tt);
      }
    } else if (mode === 'paused') {
      drawWorld(lastT, xAt(lastT) - PLAYER_SCREEN_X);
      drawOverlay(T('paused'), [T('resume'), T('controls')]);
      if (nav.confirm || nav.back || pointer) { mode = 'play'; song.play(lastT); }
    } else if (mode === 'dead') {
      drawWorld(lastT, xAt(lastT) - PLAYER_SCREEN_X);
      drawOverlay(T('dead'), [deathReason, T('retry')], '#ff9fb6');
      if (modeT > 1.2 || (modeT > 0.3 && (nav.confirm || pointer))) { mode = 'play'; respawn(); }
    } else if (mode === 'win') {
      drawSunRays(clock, PAL.night, '#173a34');
      drawHead(char, W / 2, 80, 96, char.front ?? 0);
      const [ex, ey, ew] = char.eyes; const k = 96 / HEAD;
      art.glasses(c, W / 2 - 48 + ex * k, 80 - 48 + ey * k - 1.2 * k, ew * k * 1.05);
      text(T('win'), W / 2, 148, 22, PAL.yellow);
      text(`${T('score')}: ${score}   ·   ${T('coins')}: ${coinsGot}/${level.coins.length}   ·   ${T('babushkas')}: ${babsBonked}`, W / 2, 178, 10, PAL.cream);
      text(`${T('perfects')}: ${perfects}   ·   ${T('deaths')}: ${deaths}   ·   ${T('best')}: ${best}`, W / 2, 196, 10, PAL.cream);
      text(T('again'), W / 2, 236, 11, PAL.lime);
      if (modeT > 1.5 && (nav.confirm || pointer)) { mode = 'select'; modeT = 0; }
      (window as any).__gameResult = { score, coins: coinsGot, deaths, babs: babsBonked };
    }
    (window as any).__game = { mode, t: lastT, deaths, hearts, y };
    pointer = null; anyPressed = false;
    nav.left = nav.right = nav.up = nav.down = nav.confirm = nav.back = nav.menu = false;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

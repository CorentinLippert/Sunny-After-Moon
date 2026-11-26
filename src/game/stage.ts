// Level 2, "Adulthood": the stage set-up puzzle.
// Phase 1: musicians come in one by one (random order), each carries only his own instrument from the stacked
// backline to his spot on the band's stage plan. An instrument is only heard once it is set up: the song is
// split in six stems (Demucs) and each stem opens when the musicians who play it are on stage.
// Phase 2: put the spotlight on the right musician at the right moment so he goes wild and the crowd parties.
// Drawn at 960x540 in a paper cut-out collage style (photo heads on paper bodies).
import { PAL } from './art';

const W = 960, H = 540;
const INK = '#3a140c', PAPER = '#fdf3e1';
const SOUNDCHECK = 20;

interface Mus { id: string; instr: string; stems: string[]; entry: number }
interface Cue { t: number; who: string; big: boolean; anim: string }
interface Dis { t: number; kind: 'cable' | 'fan'; who: string }
export interface StageLevel {
  title: string;
  song: { duration: number; bpm: number; beats: number[]; stems: Record<string, string> };
  musicians: Mus[];
  cues: Cue[];
  disasters: Dis[];
  statement: { t: number | null; text: string };
}

// spots on the band's stage plan (x 0..1000, y 0..560, audience at the bottom), see src/components/StagePlan.astro
const SPOT: Record<string, [number, number]> = {
  tomas: [175, 150], wim: [500, 140], tijl: [830, 150],
  simon: [300, 290], hans: [690, 290],
  corentin: [190, 430], yorick: [500, 430], sam: [810, 430],
};
const COLOR: Record<string, string> = {
  sam: '#ffec00', yorick: '#6cbc92', corentin: '#fcc400', hans: '#4fa37e',
  tijl: '#3f8f86', wim: '#e2622a', simon: '#b2cc3c', tomas: '#f39a1e',
};
const NAME: Record<string, string> = { sam: 'Sam', yorick: 'Yorick', corentin: 'Corentin', hans: 'Hans', tijl: 'Tijl', wim: 'Wim', simon: 'Simon', tomas: 'Tomas' };
const ROSTER = ['sam', 'yorick', 'corentin', 'hans', 'tijl', 'wim', 'simon', 'tomas'];
const HEAVY: Record<string, number> = { drums: 0.55, keys: 0.7, bass: 0.85, perc: 0.75 };
const INSTALL: Record<string, number> = { drums: 2.4, keys: 1.5, perc: 1.3, bass: 0.9, gtr1: 0.9, gtr2: 0.9, sax: 0.6, vox: 0.6 };

// stage floor (2.5D): plan coords -> screen
const BL = [262, 236], BR = [698, 236], FL = [150, 392], FR = [810, 392];
function floor(px: number, py: number): [number, number] {
  const u = clamp((px - 110) / 780), v = clamp((py - 110) / 340);
  const ax = BL[0] + (BR[0] - BL[0]) * u, bx = FL[0] + (FR[0] - FL[0]) * u;
  return [ax + (bx - ax) * v, BL[1] + (FL[1] - BL[1]) * v];
}
const depth = (y: number) => 0.72 + 0.34 * clamp((y - 236) / 156);
const DOOR: [number, number] = [906, 360];
const PILE_AT: [number, number] = [96, 392];
const STASH_AT: [number, number] = [176, 396];
const PILE_X = 62, STASH_X = [132, 180], CASE_TOP = 318;

function clamp(x: number, a = 0, b = 1) { return Math.min(b, Math.max(a, x)); }
const lerp = (a: number, b: number, f: number) => a + (b - a) * f;
function rng(seed: number) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const fmt = (t: number) => { const s = Math.max(0, Math.round(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ---------------- audio: six stems in sync ----------------
class Stems {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  gains: Record<string, GainNode> = {};
  bufs: Record<string, AudioBuffer> = {};
  srcs: AudioBufferSourceNode[] = [];
  startedAt = 0; offset = 0; playing = false; vStart = 0; muted = false;
  loaded = 0; total = 0; err = '';
  private loading: Promise<void> | null = null;
  constructor(public urls: Record<string, string>, public virtual: boolean, public rate: number) { this.total = Object.keys(urls).length; }
  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.master.gain.value = this.muted ? 0 : 1;
      for (const k of Object.keys(this.urls)) { const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.master); this.gains[k] = g; }
    }
    return this.ctx;
  }
  wake() { if (this.virtual) return; const c = this.ensure(); if (c.state !== 'running') c.resume().catch(() => {}); }
  load() {
    if (this.virtual) { this.loaded = this.total; return Promise.resolve(); }
    if (!this.loading) {
      const ctx = this.ensure();
      this.loading = Promise.all(Object.entries(this.urls).map(([k, u]) =>
        fetch(u).then((r) => r.arrayBuffer()).then((d) => ctx.decodeAudioData(d)).then((b) => { this.bufs[k] = b; this.loaded++; }),
      )).then(() => {}).catch((e) => { this.err = String(e); });
    }
    return this.loading;
  }
  get ready() { return this.loaded >= this.total; }
  play(from: number) {
    this.stop();
    this.offset = Math.max(0, from);
    this.playing = true;
    if (this.virtual || !this.ctx) { this.vStart = performance.now(); return; }
    const at = this.ctx.currentTime + 0.05;
    for (const [k, b] of Object.entries(this.bufs)) {
      const s = this.ctx.createBufferSource();
      s.buffer = b; s.connect(this.gains[k]); s.start(at, this.offset);
      this.srcs.push(s);
    }
    this.startedAt = at;
  }
  stop() {
    for (const s of this.srcs) { try { s.stop(); } catch {} s.disconnect(); }
    this.srcs = [];
    if (this.playing) this.offset = this.time();
    this.playing = false;
  }
  time() {
    if (!this.playing) return this.offset;
    if (this.virtual || !this.ctx) return this.offset + ((performance.now() - this.vStart) / 1000) * this.rate;
    const lat = (this.ctx as any).outputLatency || this.ctx.baseLatency || 0;
    return this.offset + this.ctx.currentTime - this.startedAt - lat;
  }
  setGain(k: string, v: number) {
    const g = this.gains[k];
    if (!g || !this.ctx) return;
    if (Math.abs(g.gain.value - v) < 0.01) return;
    g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.04);
  }
  setMuted(m: boolean) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 1; }
}

// ---------------- state types ----------------
type Job = { kind: 'pile' } | { kind: 'stash' } | { kind: 'spot' } | { kind: 'walk'; x: number; y: number } | null;
interface M {
  id: string; instr: string; entry: number; stems: string[];
  x: number; y: number; arriveAt: number; on: boolean;
  job: Job; tx: number; ty: number; walking: boolean; face: number;
  carry: boolean; busy: number; busyKind: '' | 'lift' | 'install' | 'drop';
  placed: boolean; placedAt: number; liveAt: number; cable: boolean;
  anim: { kind: string; t0: number; dur: number } | null;
  drinks: number; say: string; sayT: number; bob: number;
}
interface Fan { x: number; y: number; need: number; skin: string; shirt: string; hat: number; ph: number; order: number }
interface Float { x: number; y: number; text: string; t: number; color: string; size: number }
interface Drink { from: [number, number]; to: string; t: number; tea: boolean }

export function createStage(canvas: HTMLCanvasElement, T: (k: string) => string, opts: { autoplay: boolean; virtual: boolean; rate: number }) {
  const g = canvas.getContext('2d')!;
  let level: StageLevel | null = null;
  let stems: Stems | null = null;
  const heads: Record<string, HTMLCanvasElement> = {};
  let grainPat: CanvasPattern | null = null;

  // ---------- assets ----------
  const ready = (async () => {
    level = await fetch('/game/levels/adulthood.json').then((r) => r.json());
    stems = new Stems(level!.song.stems, opts.virtual, opts.rate);
    await Promise.all(ROSTER.map((id) => new Promise<void>((res) => {
      const im = new Image();
      im.onload = () => {
        // cartoon caricature heads (scripts/game/toon_heads.py), already outlined in ink
        const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
        c.getContext('2d')!.drawImage(im, 0, 0);
        heads[id] = c; res();
      };
      im.onerror = () => res();
      im.src = `/game/toon/${id}.webp`;
    })));
    const gr = document.createElement('canvas'); gr.width = 256; gr.height = 256;
    const q = gr.getContext('2d')!, r = rng(7);
    for (let i = 0; i < 5000; i++) { q.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '0,0,0'},${r() * 0.06})`; q.fillRect(r() * 256, r() * 256, 1 + r() * 2, 1 + r() * 2); }
    grainPat = g.createPattern(gr, 'repeat');
  })();

  // ---------- run state ----------
  type Mode = 'loading' | 'intro' | 'play' | 'end';
  let mode: Mode = 'loading';
  let modeT = 0;
  let preT = -SOUNDCHECK;
  let lastT = -SOUNDCHECK;
  let mus: M[] = [];
  let pile: string[] = [];
  let stash: (string | null)[] = [null, null];
  let sel: M | null = null;
  let score = 0, hype = 0.3, best = 0;
  let perfectPlace = 0, orderOk = 0, hits = 0, misses = 0, drinksGiven = 0, fixes = 0;
  let cueIdx = 0, cueDone = new Set<number>();
  let disIdx = 0;
  let cable: M | null = null;
  let fan: { x: number; y: number; vx: number; vy: number; t: number; out: number; look: Fan } | null = null;
  let mosh = 0;
  let drinks: Drink[] = [];
  let drinkCool = 12;
  let floats: Float[] = [];
  let spot: M | null = null;
  let paused = false;
  let hintT = 0;
  try { best = Number(localStorage.getItem('sam-game-best-adulthood') || 0); } catch {}

  const FANS: Fan[] = (() => {
    const r = rng(42), a: Fan[] = [];
    const skins = ['#f2c9a0', '#e0a878', '#b97a4e', '#7a4a2c', '#f6d7b6'];
    const shirts = ['#ce460a', '#6cbc92', '#ffec00', '#96261b', '#b2cc3c', '#3f8f86', '#fdf3e1', '#e2622a'];
    for (let k = 0; k < 84; k++) a.push({ x: 18 + r() * 924, y: 452 + r() * 80, need: r(), skin: skins[Math.floor(r() * 5)], shirt: shirts[Math.floor(r() * 8)], hat: r() < 0.35 ? Math.floor(r() * 3) : -1, ph: r() * 6, order: r() });
    return a.sort((p, q) => p.order - q.order);
  })();

  function reset() {
    const L = level!;
    const r = rng(opts.autoplay ? 1234 : Date.now());
    const order = [...L.musicians].sort(() => r() - 0.5);
    mus = L.musicians.map((m) => {
      const k = order.indexOf(m);
      return {
        id: m.id, instr: m.instr, entry: m.entry, stems: m.stems,
        x: DOOR[0], y: DOOR[1], arriveAt: -SOUNDCHECK + 1 + k * 2.4, on: false,
        job: null, tx: DOOR[0], ty: DOOR[1], walking: false, face: -1,
        carry: false, busy: 0, busyKind: '', placed: false, placedAt: 0, liveAt: 1e9, cable: false,
        anim: null, drinks: 0, say: '', sayT: 0, bob: r() * 6,
      };
    });
    pile = L.musicians.map((m) => m.instr).sort(() => r() - 0.5);
    stash = [null, null];
    sel = null; score = 0; hype = 0.3; perfectPlace = 0; orderOk = 0; hits = 0; misses = 0; drinksGiven = 0; fixes = 0;
    cueIdx = 0; cueDone = new Set(); disIdx = 0; cable = null; fan = null; mosh = 0; drinks = []; drinkCool = 12; floats = []; spot = null;
    preT = -SOUNDCHECK; lastT = preT; hintT = 0; paused = false;
    for (const k of Object.keys(L.song.stems)) stems!.setGain(k, 0);
  }

  // ---------- helpers ----------
  const byId = (id: string) => mus.find((m) => m.id === id)!;
  const instrOwner = (instr: string) => mus.find((m) => m.instr === instr)!;
  const spotXY = (m: M): [number, number] => { const [x, y] = floor(...SPOT[m.id]); return [x - 14, y - (m.id === 'wim' ? 16 : 0)]; };
  const instrXY = (m: M): [number, number] => { const [x, y] = floor(...SPOT[m.id]); return [x + (m.id === 'wim' ? 0 : 16 * depth(y)), y - (m.id === 'wim' ? 16 : 0) + 2]; };
  function say(m: M, s: string) { m.say = s; m.sayT = 1.8; }
  function float(text: string, x: number, y: number, color = PAL.yellow, size = 20) { floats.push({ x, y, text, t: 0, color, size }); }
  const nextBar = (t: number) => {
    const b = level!.song.beats;
    for (let i = 0; i < b.length; i += 1) if (b[i] >= t && i % 4 === 0) return b[i];
    return t;
  };
  const audible = (m: M, t: number) => m.placed && t >= m.liveAt && !m.cable;

  function completeness(t: number) {
    const exp = mus.filter((m) => t >= m.entry);
    if (!exp.length) return 1;
    return exp.filter((m) => audible(m, t)).length / exp.length;
  }
  const crowdCount = (t: number) => Math.round(6 + 72 * clamp((t + SOUNDCHECK) / 180));
  const mood = (t: number) => (t < 0 ? 0.45 : completeness(t) * (0.45 + 0.55 * hype));

  function updateGains(t: number) {
    const L = level!;
    for (const k of Object.keys(L.song.stems)) {
      const owners = mus.filter((m) => m.stems.includes(k));
      const playing = owners.filter((m) => t >= m.entry - 0.5);
      const list = playing.length ? playing : owners;
      const v = list.filter((m) => audible(m, Math.max(t, m.entry))).length / list.length;
      stems!.setGain(k, v);
    }
  }

  // ---------- commands ----------
  function command(m: M, job: Job) {
    if (!m.on || m.placed || m.busy > 0) return;
    m.job = job;
    let tx = m.x, ty = m.y;
    if (!job) return;
    if (job.kind === 'pile') [tx, ty] = PILE_AT;
    else if (job.kind === 'stash') [tx, ty] = STASH_AT;
    else if (job.kind === 'spot') [tx, ty] = spotXY(m);
    else { tx = job.x; ty = job.y; }
    m.tx = tx; m.ty = ty; m.walking = true;
  }

  function arrive(m: M, t: number) {
    const job = m.job; m.job = null;
    if (!job) return;
    if (job.kind === 'pile') {
      if (m.carry) { say(m, T('st.handsFull')); return; }
      const top = pile[pile.length - 1];
      if (top === m.instr) { m.busy = 0.45; m.busyKind = 'lift'; return; }
      if (stash.includes(m.instr)) { say(m, T('st.onSide')); return; }
      say(m, top ? `${T('st.notMine')} (${NAME[instrOwner(top).id]})` : T('st.empty'));
    } else if (job.kind === 'stash') {
      if (m.carry) {
        const i = stash.indexOf(null);
        if (i < 0) { say(m, T('st.sideFull')); return; }
        m.busy = 0.35; m.busyKind = 'drop';
      } else if (stash.includes(m.instr)) { m.busy = 0.4; m.busyKind = 'lift'; }
      else say(m, T('st.notThere'));
    } else if (job.kind === 'spot') {
      if (!m.carry) { say(m, T('st.noInstr')); return; }
      m.busy = INSTALL[m.instr] ?? 1; m.busyKind = 'install';
    }
  }

  function finishBusy(m: M, t: number) {
    const kind = m.busyKind; m.busyKind = '';
    if (kind === 'lift') {
      if (pile[pile.length - 1] === m.instr) pile.pop();
      else { const i = stash.indexOf(m.instr); if (i >= 0) stash[i] = null; else return; }
      m.carry = true;
      if (opts.autoplay || sel === m) command(m, { kind: 'spot' });
    } else if (kind === 'drop') {
      const i = stash.indexOf(null);
      if (i >= 0) { stash[i] = m.instr; m.carry = false; }
    } else if (kind === 'install') {
      m.carry = false; m.placed = true; m.placedAt = t;
      m.liveAt = t < m.entry ? m.entry : nextBar(t);
      const [x, y] = spotXY(m);
      const late = Math.max(0, t - m.entry);
      const firstOpen = mus.filter((o) => !o.placed && o !== m).every((o) => o.entry >= m.entry);
      let pts = late <= 0 ? 1000 : Math.max(100, Math.round(1000 - late * 40));
      if (late <= 0) perfectPlace++;
      float(late <= 0 ? T('st.onTime') : `${T('st.late')} ${Math.round(late)}s`, x, y - 120, late <= 0 ? PAL.yellow : '#ff9f7a', 18);
      if (firstOpen) { orderOk++; pts += 300; float(T('st.order'), x, y - 98, PAL.lime, 14); }
      score += pts;
      if (sel === m) sel = null;
      hype = Math.min(1, hype + 0.04);
    }
  }

  function tryCue(m: M, t: number) {
    const L = level!;
    for (let i = 0; i < L.cues.length; i++) {
      const c = L.cues[i];
      if (cueDone.has(i) || c.who !== m.id) continue;
      const d = t - c.t;
      if (d < -0.6 || d > 0.6) continue;
      cueDone.add(i);
      const perfect = Math.abs(d) <= 0.25;
      hits++;
      const mult = c.big ? 3 : 1;
      score += (perfect ? 300 : 150) * mult;
      hype = Math.min(1, hype + (c.big ? 0.25 : perfect ? 0.1 : 0.06));
      m.anim = { kind: c.anim, t0: t, dur: c.big ? 6 : 2.6 };
      spot = m;
      if (c.anim === 'moshpit') mosh = 6;
      const [x, y] = [m.x, m.y];
      float(c.big ? T('anim.' + c.anim) : perfect ? T('st.perfect') : T('st.good'), x, y - 140, c.big ? PAL.yellow : perfect ? PAL.yellow : PAL.lime, c.big ? 30 : 20);
      return true;
    }
    return false;
  }

  function fixCable(t: number) {
    if (!cable) return false;
    const [x, y] = instrXY(cable);
    cable.cable = false; float(T('st.fixed'), x, y - 80, PAL.lime, 18); score += 150; fixes++; cable = null;
    return true;
  }
  function kickFan() {
    if (!fan || fan.out) return false;
    fan.out = 1; float(T('st.fanOut'), fan.x, fan.y - 60, PAL.lime, 18); score += 150; fixes++;
    return true;
  }

  // ---------- pointer ----------
  function musAt(x: number, y: number) {
    let best: M | null = null, bd = 1e9;
    for (const m of mus) {
      if (!m.on) continue;
      const s = depth(m.y);
      const [mx, my] = drawPos(m, lastT);
      if (Math.abs(x - mx) < 30 * s && y < my + 8 && y > my - 120 * s) {
        const d = Math.abs(x - mx) + Math.abs(y - (my - 60 * s)) * 0.5;
        if (d < bd) { bd = d; best = m; }
      }
    }
    return best;
  }
  const onStageFloor = (x: number, y: number) => y > BL[1] - 20 && y < FL[1] + 10 && x > lerp(BL[0], FL[0], (y - BL[1]) / (FL[1] - BL[1])) - 10 && x < lerp(BR[0], FR[0], (y - BL[1]) / (FL[1] - BL[1])) + 10;

  function click(x: number, y: number, t: number) {
    if (fan && !fan.out && Math.hypot(x - fan.x, y - (fan.y - 40)) < 50) { kickFan(); return; }
    if (cable) {
      const [cx, cy] = instrXY(cable);
      if (Math.hypot(x - cx, y - (cy - 30)) < 50) { fixCable(t); return; }
    }
    const m = musAt(x, y);
    if (m) {
      if (m === cable) { fixCable(t); return; }
      if (m.placed) { if (!tryCue(m, t)) { say(m, T('st.playing')); } return; }
      sel = m; m.face = m.x > 480 ? -1 : 1;
      return;
    }
    if (!sel) { hintT = 2; return; }
    // pile + side table on the left wing
    if (x < 112 && y > 200 && y < 400) { command(sel, { kind: 'pile' }); return; }
    if (x >= 112 && x < 214 && y > 280 && y < 400) { command(sel, { kind: 'stash' }); return; }
    if (onStageFloor(x, y)) { command(sel, sel.carry ? { kind: 'spot' } : { kind: 'walk', x, y: clamp(y, BL[1] + 6, FL[1]) }); return; }
  }

  function key(code: string, t: number) {
    const n = Number(code.replace('Digit', '').replace('Numpad', ''));
    if (/^(Digit|Numpad)[1-8]$/.test(code)) {
      const m = byId(ROSTER[n - 1]);
      if (m.placed) tryCue(m, t);
      else if (m.on) sel = m;
      return;
    }
    if (!sel) return;
    if (code === 'KeyP' || code === 'ArrowLeft') command(sel, { kind: 'pile' });
    if (code === 'KeyZ' || code === 'KeyS' || code === 'ArrowDown') command(sel, { kind: 'stash' });
    if (code === 'Enter' || code === 'Space' || code === 'ArrowRight' || code === 'ArrowUp') command(sel, { kind: 'spot' });
  }

  // ---------- autoplay bot (tests that the level can be finished) ----------
  function bot(t: number) {
    for (const m of mus) {
      if (!m.on || m.placed || m.busy > 0 || m.walking) continue;
      if (m.carry) { command(m, { kind: 'spot' }); continue; }
      const top = pile[pile.length - 1];
      if (top === m.instr || stash.includes(m.instr)) { command(m, { kind: stash.includes(m.instr) ? 'stash' : 'pile' }); continue; }
      // if the top item's owner is not here yet, nothing to do: wait at the pile
    }
    const L = level!;
    for (let i = 0; i < L.cues.length; i++) if (!cueDone.has(i) && Math.abs(L.cues[i].t - t) < 0.05) { const m = byId(L.cues[i].who); if (m.placed) tryCue(m, t); }
    if (cable && t - lastDis > 1) fixCable(t);
    if (fan && !fan.out && fan.t > 1) kickFan();
  }
  let lastDis = 0;

  // ---------- simulation ----------
  function update(t: number, dt: number) {
    const L = level!;
    if (opts.autoplay) bot(t);
    for (const m of mus) {
      if (!m.on && t >= m.arriveAt) { m.on = true; m.x = DOOR[0]; m.y = DOOR[1]; const k = mus.filter((o) => o.on).length - 1; command(m, { kind: 'walk', x: 780 - k * 62, y: 366 + (k % 2) * 22 }); if (opts.autoplay) m.job = null; }
      if (!m.on) continue;
      m.sayT = Math.max(0, m.sayT - dt);
      if (m.busy > 0) { m.busy -= dt; if (m.busy <= 0) { m.busy = 0; finishBusy(m, t); } continue; }
      if (m.walking) {
        const sp = 190 * (m.carry ? (HEAVY[m.instr] ?? 1) : 1) * depth(m.y);
        const dx = m.tx - m.x, dy = m.ty - m.y, d = Math.hypot(dx, dy);
        if (d < sp * dt + 0.5) { m.x = m.tx; m.y = m.ty; m.walking = false; arrive(m, t); }
        else { m.x += (dx / d) * sp * dt; m.y += (dy / d) * sp * dt; m.face = dx < 0 ? -1 : 1; }
      }
      if (m.anim && t - m.anim.t0 > m.anim.dur) { m.anim = null; if (spot === m) spot = null; }
    }
    // missed cues
    for (let i = 0; i < L.cues.length; i++) {
      const c = L.cues[i];
      if (cueDone.has(i) || t < c.t + 0.6) continue;
      cueDone.add(i);
      if (byId(c.who).placed) { misses++; hype = Math.max(0, hype - 0.06); const m = byId(c.who); float(T('st.miss'), m.x, m.y - 130, '#ff9f7a', 16); }
    }
    // disasters
    while (disIdx < L.disasters.length && t >= L.disasters[disIdx].t) {
      const d = L.disasters[disIdx++];
      lastDis = t;
      if (d.kind === 'cable') {
        const placed = mus.filter((m) => m.placed && !m.cable);
        const m = placed.find((o) => o.id === d.who) || placed[0];
        if (m && !cable) { m.cable = true; cable = m; say(m, T('st.cable')); }
      } else if (!fan) {
        const look = FANS[Math.floor((t * 7) % FANS.length)];
        fan = { x: 300 + ((t * 37) % 360), y: 400, vx: 120, vy: -40, t: 0, out: 0, look };
      }
    }
    if (fan) {
      fan.t += dt;
      if (fan.out) { fan.out += dt; fan.y += 300 * dt; fan.x += 60 * dt; if (fan.out > 1.2) fan = null; }
      else {
        fan.x += fan.vx * dt; fan.y += fan.vy * dt;
        if (fan.x < 240 || fan.x > 720) fan.vx *= -1;
        if (fan.y < 270 || fan.y > 390) fan.vy *= -1;
        if (Math.random() < dt) fan.vy = (Math.random() - 0.5) * 160;
        hype = Math.max(0, hype - 0.012 * dt);
        if (fan.t > 10) { fan.out = 1; hype = Math.max(0, hype - 0.1); }
      }
    }
    if (cable) hype = Math.max(0, hype - 0.01 * dt);
    // hype settles slowly
    if (hype > 0.35) hype = Math.max(0.35, hype - 0.008 * dt);
    mosh = Math.max(0, mosh - dt);
    // the crowd: happy people score; when they are really into it, they bring the band a pint (Simon gets an ice tea)
    const md = mood(t);
    if (t > 0) {
      const n = crowdCount(t);
      let happy = 0;
      for (let i = 0; i < n; i++) if (FANS[i].need < md) happy++;
      score += happy * dt * 2;
    }
    drinkCool -= dt * (md > 0.6 ? 0.6 + md : 0);
    if (drinkCool <= 0 && t > 0) {
      drinkCool = 9;
      const placed = mus.filter((m) => m.placed && !m.anim);
      if (placed.length) {
        const m = placed[Math.floor((t * 13) % placed.length)];
        const f = FANS[Math.floor((t * 5) % crowdCount(t))];
        drinks.push({ from: [f.x, f.y - 50], to: m.id, t: 0, tea: m.id === 'simon' });
      }
    }
    for (const d of drinks) d.t += dt;
    for (const d of drinks) if (d.t >= 1 && d.t - dt < 1) {
      const m = byId(d.to); m.drinks++; drinksGiven++; score += 50;
      float(d.tea ? T('st.iceTea') : T('st.cheers'), m.x, m.y - 130, d.tea ? '#e9c440' : PAPER, 16);
    }
    drinks = drinks.filter((d) => d.t < 1.05);
    for (const f of floats) f.t += dt;
    floats = floats.filter((f) => f.t < 1.4);
    hintT = Math.max(0, hintT - dt);
    updateGains(t);
  }

  // ---------- drawing primitives (paper cut-out) ----------
  function torn(pts: number[][], seed: number, j = 2.2, step = 14) {
    const r = rng(seed), out: number[][] = [];
    for (let k = 0; k < pts.length; k++) {
      const [x1, y1] = pts[k], [x2, y2] = pts[(k + 1) % pts.length];
      const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / step));
      for (let i = 0; i < n; i++) { const f = i / n; out.push([x1 + (x2 - x1) * f + (r() - 0.5) * j, y1 + (y2 - y1) * f + (r() - 0.5) * j]); }
    }
    return out;
  }
  function poly(p: number[][]) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
  function paper(pts: number[][], fill: string, seed: number, o: { j?: number; lw?: number; stroke?: boolean; shadow?: boolean } = {}) {
    const p = torn(pts, seed, o.j ?? 2.2);
    if (o.shadow !== false) { g.save(); g.translate(3, 3); poly(p); g.fillStyle = 'rgba(10,20,18,.35)'; g.fill(); g.restore(); }
    poly(p); g.fillStyle = fill; g.fill();
    if (o.stroke !== false) { g.lineWidth = o.lw ?? 2; g.strokeStyle = INK; g.stroke(); }
  }
  function ell(x: number, y: number, rx: number, ry: number, fill: string, lw = 2) { g.beginPath(); g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); } }
  function rect(x: number, y: number, w: number, h: number, fill: string, seed = 1) { paper([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, seed, { j: 1.6 }); }
  function text(s: string, x: number, y: number, size = 16, color = PAPER, align: CanvasTextAlign = 'center', outline = true) {
    g.font = `${size}px "Lilita One", system-ui, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
    if (outline) { g.lineWidth = Math.max(3, size / 5); g.strokeStyle = INK; g.lineJoin = 'round'; g.strokeText(s, x, y); }
    g.fillStyle = color; g.fillText(s, x, y);
  }
  function label(s: string, x: number, y: number, bg = PAPER, fg = INK, size = 13) {
    g.font = `${size}px "Lilita One", system-ui, sans-serif`;
    const w = g.measureText(s).width + 12;
    g.fillStyle = bg; g.fillRect(x - w / 2, y - size + 2, w, size + 5); g.strokeStyle = INK; g.lineWidth = 1.5; g.strokeRect(x - w / 2, y - size + 2, w, size + 5);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillText(s, x, y);
  }

  function drawInstr(id: string, x: number, y: number, s: number, seed = 3, unplugged = false) {
    g.save(); g.translate(x, y); g.scale(s, s);
    switch (id) {
      case 'keys':
        g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(-26, 0); g.lineTo(22, -26); g.moveTo(26, 0); g.lineTo(-22, -26); g.stroke();
        rect(-40, -36, 80, 13, '#20302d', seed);
        for (let k = 0; k < 13; k++) { g.fillStyle = PAPER; g.fillRect(-37 + k * 5.7, -33, 4.6, 8); }
        for (const k of [0, 1, 3, 4, 5, 7, 8, 10, 11]) { g.fillStyle = INK; g.fillRect(-34 + k * 5.7, -33, 2.6, 5); }
        break;
      case 'sax':
        g.lineCap = 'round';
        g.strokeStyle = INK; g.lineWidth = 11; g.beginPath(); g.moveTo(-4, -40); g.lineTo(-2, -6); g.quadraticCurveTo(0, 6, 10, 2); g.lineTo(14, -12); g.stroke();
        g.strokeStyle = '#fcc400'; g.lineWidth = 7; g.stroke();
        ell(14, -15, 7, 4, '#fcc400');
        g.fillStyle = INK; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(-3, -30 + k * 7, 1.6, 0, 7); g.fill(); }
        break;
      case 'perc':
        paper([[-26, 0], [-30, -34], [-14, -34], [-16, 0]], '#c8742a', seed); ell(-22, -34, 9, 3.5, PAPER);
        paper([[-10, 0], [-13, -40], [3, -40], [1, 0]], '#e08a34', seed + 1); ell(-5, -40, 9, 3.5, PAPER);
        paper([[8, 0], [26, 0], [20, -14], [28, -30], [6, -30], [14, -14]], '#a8562a', seed + 2); ell(17, -30, 11, 3.5, PAPER);
        break;
      case 'gtr2': case 'gtr1': case 'bass': {
        const body = id === 'gtr2' ? '#b06a2c' : id === 'gtr1' ? '#4fa37e' : '#b2cc3c', neck = id === 'bass' ? 52 : 40;
        g.rotate(-0.5);
        paper([[-3, -18], [3, -18], [3, -18 - neck], [-3, -18 - neck]], '#6b3b1c', seed, { j: 0.8 });
        paper([[-5, -22 - neck], [5, -22 - neck], [4, -16 - neck], [-4, -16 - neck]], INK, seed + 2, { j: 0.5 });
        if (id === 'gtr2') { ell(0, -2, 13, 12, body); ell(0, -16, 10, 9, body); ell(0, -10, 4, 4, INK, 0); }
        else paper([[-12, 8], [12, 8], [14, -8], [7, -14], [9, -22], [2, -18], [-8, -20], [-14, -8]], body, seed + 4);
        break;
      }
      case 'drums':
        ell(0, -20, 22, 22, PAPER, 2.5); ell(0, -20, 15, 15, '#ffec00', 0);
        g.fillStyle = '#ce460a'; g.beginPath(); g.arc(0, -20, 15, Math.PI * 0.1, Math.PI * 0.9); g.fill();
        ell(-24, -46, 11, 6, '#e2622a'); ell(22, -44, 11, 6, '#e2622a'); ell(-34, -38, 15, 3, '#e9c440'); ell(36, -60, 15, 3, '#e9c440');
        g.strokeStyle = INK; g.lineWidth = 2; g.beginPath(); g.moveTo(-34, -38); g.lineTo(-34, 0); g.moveTo(36, -60); g.lineTo(36, 0); g.stroke();
        break;
      case 'vox':
        g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -52); g.lineTo(8, -60); g.stroke(); ell(10, -62, 5, 5, '#333');
        g.beginPath(); g.moveTo(-12, 0); g.lineTo(12, 0); g.stroke();
        break;
    }
    if (unplugged) {
      g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(20, -4); g.quadraticCurveTo(34, 6, 44, -2); g.stroke();
      ell(46, -2, 4, 3, '#20302d', 1.5);
    }
    g.restore();
  }

  // ---------- backdrop: the sun goes down, the moon comes up, more lights ----------
  function backdrop(t: number) {
    const L = level!;
    const p = clamp((t + SOUNDCHECK) / (L.song.duration + SOUNDCHECK));
    const day = [[126, 200, 216], [252, 196, 0]], dusk = [[243, 154, 30], [206, 70, 10]], night = [[18, 38, 64], [43, 79, 110]];
    const mixc = (a: number[], b: number[], f: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(',')})`;
    const top = p < 0.45 ? mixc(day[0], dusk[0], p / 0.45) : mixc(dusk[0], night[0], clamp((p - 0.45) / 0.3));
    const bot = p < 0.45 ? mixc(day[1], dusk[1], p / 0.45) : mixc(dusk[1], night[1], clamp((p - 0.45) / 0.3));
    const sky = g.createLinearGradient(0, 0, 0, 300); sky.addColorStop(0, top); sky.addColorStop(1, bot);
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    // stars
    const nightK = clamp((p - 0.55) / 0.25);
    if (nightK > 0) { const r = rng(9); for (let k = 0; k < 70; k++) { const x = r() * W, y = r() * 220, tw = 0.5 + 0.5 * Math.sin(t * 2 + k); g.fillStyle = `rgba(253,243,225,${nightK * tw})`; g.fillRect(x, y, 2, 2); } }
    // sun sets behind the hills on the left, the moon rises on the right
    const sunY = lerp(70, 300, clamp(p / 0.5));
    if (sunY < 300) { ell(110, sunY, 42, 42, 'rgba(255,236,0,.25)', 0); ell(110, sunY, 32, 32, '#ffec00', 0); }
    const moonY = lerp(320, 70, clamp((p - 0.35) / 0.35));
    if (p > 0.35) { ell(850, moonY, 30, 30, '#fdf3e1', 0); ell(838, moonY - 6, 26, 26, top, 0); }
    // torn paper hills
    paper([[0, 210], [140, 170], [300, 200], [470, 160], [650, 196], [820, 168], [960, 190], [960, 300], [0, 300]], mixc([108, 188, 146], [34, 70, 70], clamp((p - 0.4) / 0.4)), 21, { j: 4, stroke: false });
    paper([[0, 240], [200, 215], [420, 236], [640, 210], [960, 232], [960, 320], [0, 320]], mixc([63, 143, 134], [24, 52, 56], clamp((p - 0.4) / 0.4)), 22, { j: 4, stroke: false });
    g.fillStyle = mixc([79, 125, 54], [28, 52, 34], clamp((p - 0.4) / 0.4)); g.fillRect(0, 300, W, 240);
    // backdrop curtain with the logo
    rect(236, 58, 488, 182, '#96261b', 31);
    g.fillStyle = 'rgba(0,0,0,.12)'; for (let x = 250; x < 720; x += 30) g.fillRect(x, 62, 12, 174);
    const st = L.statement;
    const stK = st.t != null && t >= st.t ? clamp((t - st.t) / 0.8) : 0;
    const logoY = lerp(128, 102, stK);
    ell(480, logoY, 50 - stK * 14, 50 - stK * 14, '#ffec00', 3); ell(480, logoY, 36 - stK * 10, 36 - stK * 10, '#96261b', 0); ell(480, logoY, 30 - stK * 8, 30 - stK * 8, '#6cbc92', 0);
    g.fillStyle = '#ce460a'; g.beginPath(); g.arc(480, logoY, 30 - stK * 8, -0.4, Math.PI * 0.6); g.fill();
    if (stK > 0) {
      // "MAGIC AND WONDER": cut-out letters glued on the curtain, one by one, then they stay until the end
      const words = st.text;
      g.font = '34px "Lilita One", system-ui, sans-serif';
      let x = 480 - g.measureText(words).width / 2 - (words.length * 1.5);
      for (let i = 0; i < words.length; i++) {
        const ch = words[i]; const w = g.measureText(ch).width + 3;
        const k = clamp((t - st.t! - i * 0.06) / 0.25);
        if (ch !== ' ' && k > 0) {
          const r = rng(i * 31 + 5); const rot = (r() - 0.5) * 0.25; const col = ['#ffec00', '#fdf3e1', '#6cbc92', '#fcc400', '#b2cc3c'][i % 5];
          g.save(); g.translate(x + w / 2, 160 + (r() - 0.5) * 6); g.rotate(rot); g.scale(k, k);
          paper([[-w / 2 - 2, -20], [w / 2 + 2, -20], [w / 2 + 2, 18], [-w / 2 - 2, 18]], ['#20302d', '#3a140c', '#3f8f86'][i % 3], i * 7, { j: 2, lw: 1.5 });
          g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 0, 1);
          g.restore();
        }
        x += w;
      }
      g.font = '22px "Lilita One", system-ui, sans-serif';
      text('SUNNY AFTER MOON', 480, 214, 22, '#ffec00');
    } else text('SUNNY AFTER MOON', 480, 212, 30, '#ffec00');
    // truss
    g.fillStyle = '#20302d'; g.fillRect(226, 40, 508, 16); g.fillRect(226, 40, 14, 210); g.fillRect(720, 40, 14, 210);
    g.strokeStyle = '#4a5a56'; g.lineWidth = 1.5; for (let x = 232; x < 730; x += 16) { g.beginPath(); g.moveTo(x, 42); g.lineTo(x + 8, 54); g.stroke(); }
  }

  function lights(t: number) {
    // more lamps light up as the band is set up and the party grows; beams sweep on the beat
    const placed = mus.filter((m) => m.placed).length;
    const n = 2 + placed + Math.round(hype * 4);
    const lamps = 14;
    const ph = beatPhase(t);
    const night = clamp((t + SOUNDCHECK) / (level!.song.duration + SOUNDCHECK) * 2 - 0.6);
    for (let k = 0; k < lamps; k++) {
      const lx = 246 + k * 36;
      const on = k % 7 < n / 2 || (k >= 7 && k - 7 < n / 2 - 2);
      const col = ['#ffec00', '#6cbc92', '#ce460a', '#fdf3e1', '#b2cc3c', '#fcc400', '#e2622a'][k % 7];
      ell(lx, 60, 6, 5, on ? col : '#3a4a46', 1.5);
      if (on && t > -5) {
        const a = 0.06 + 0.08 * night + (spot ? 0 : 0.04 * (1 - ph));
        g.fillStyle = col; g.globalAlpha = a;
        const sw = Math.sin(t * 0.9 + k * 1.7) * (40 + hype * 90);
        g.beginPath(); g.moveTo(lx - 4, 62); g.lineTo(lx - 40 + sw, 400); g.lineTo(lx + 40 + sw, 400); g.closePath(); g.fill();
        g.globalAlpha = 1;
      }
    }
  }

  function stageFloor() {
    paper([BL, BR, FR, FL], '#c99a5b', 41, { j: 1.5 });
    g.save(); poly([BL, BR, FR, FL]); g.clip(); g.strokeStyle = 'rgba(58,20,12,.28)'; g.lineWidth = 1.3;
    for (let k = 1; k < 14; k++) { const f = k / 14; g.beginPath(); g.moveTo(lerp(BL[0], FL[0], f), lerp(BL[1], FL[1], f)); g.lineTo(lerp(BR[0], FR[0], f), lerp(BR[1], FR[1], f)); g.stroke(); }
    g.restore();
    paper([FL, FR, [810, 428], [150, 428]], '#96261b', 43, { j: 1.5 });
    g.fillStyle = 'rgba(0,0,0,.15)'; for (let x = 170; x < 800; x += 46) g.fillRect(x, 398, 2, 28);
    rect(112, 300, 40, 92, '#20302d', 51); ell(132, 330, 12, 12, '#3a4a46'); ell(132, 366, 14, 14, '#3a4a46');
    rect(808, 300, 40, 92, '#20302d', 52); ell(828, 330, 12, 12, '#3a4a46'); ell(828, 366, 14, 14, '#3a4a46');
    const r1 = floor(400, 105), r2 = floor(600, 105), r3 = floor(600, 200), r4 = floor(400, 200);
    paper([[r1[0], r1[1] - 16], [r2[0], r2[1] - 16], [r3[0], r3[1] - 16], [r4[0], r4[1] - 16]], '#e7c27a', 61, { j: 1 });
    paper([[r4[0], r4[1] - 16], [r3[0], r3[1] - 16], [r3[0], r3[1]], [r4[0], r4[1]]], '#a8772f', 62, { j: 1 });
    // wings: road case (pile + side table) left, backstage door right
    rect(14, CASE_TOP, 196, 58, '#20302d', 71); g.fillStyle = '#9aa6a2'; g.fillRect(20, 324, 10, 10); g.fillRect(194, 324, 10, 10);
    g.font = '11px "DM Sans", system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = PAPER; g.fillText('BACKLINE', PILE_X, 362); g.fillText(T('st.side').toUpperCase(), 156, 362);
    g.strokeStyle = 'rgba(253,243,225,.4)'; g.setLineDash([4, 4]); g.strokeRect(112, CASE_TOP + 4, 94, 50); g.setLineDash([]);
    paper([[868, 230], [946, 230], [946, 368], [868, 368]], '#20302d', 81, { j: 1.4 });
    paper([[876, 238], [938, 238], [938, 368], [876, 368]], '#ffe9a8', 82, { j: 1.2 });
    text('BACKSTAGE', 907, 222, 13, PAPER);
  }

  function spotMarks(t: number) {
    for (const m of mus) {
      if (m.placed) continue;
      const [x, y] = instrXY(m);
      const s = depth(y);
      g.save(); g.translate(x, y); g.scale(s, s);
      g.globalAlpha = sel === m ? 0.75 : 0.35; drawInstr(m.instr, 0, 0, 0.75, 5); g.globalAlpha = 1;
      g.strokeStyle = sel === m ? '#ffec00' : 'rgba(255,236,0,.6)'; g.lineWidth = sel === m ? 5 : 4;
      g.beginPath(); g.moveTo(-12, -4); g.lineTo(12, 4); g.moveTo(12, -4); g.lineTo(-12, 4); g.stroke();
      if (sel === m) { g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 30 + Math.sin(t * 6) * 3, 10, 0, 0, Math.PI * 2); g.stroke(); }
      g.restore();
    }
  }

  function pileDraw() {
    let y = CASE_TOP + 2;
    pile.forEach((id, i) => {
      const hgt = id === 'drums' ? 30 : id === 'keys' ? 18 : 14;
      g.save(); g.translate(PILE_X + ((i * 7) % 3 - 1) * 8, y); g.rotate(((i % 2) ? 1 : -1) * 0.12);
      drawInstr(id, 0, 0, id === 'drums' ? 0.6 : 0.52, 4 + i);
      g.restore();
      if (i === pile.length - 1) label(`▲ ${NAME[instrOwner(id).id]}`, PILE_X, y - hgt - 34, '#ffec00', INK, 12);
      y -= hgt;
    });
    stash.forEach((id, i) => { if (id) { drawInstr(id, STASH_X[i], CASE_TOP + 2, id === 'drums' ? 0.62 : 0.55, 9 + i); label(NAME[instrOwner(id).id], STASH_X[i], CASE_TOP - 44, PAPER, INK, 11); } });
  }

  function beatPhase(t: number) {
    const b = level!.song.beats; if (t < b[0]) return 0;
    let lo = 0, hi = b.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m] <= t) lo = m; else hi = m; }
    return clamp((t - b[lo]) / ((b[hi] - b[lo]) || 0.46));
  }

  // where a musician is drawn (animations move him around)
  function drawPos(m: M, t: number): [number, number, number, number] {
    let x = m.x, y = m.y, rot = 0, lift = 0;
    if (m.placed) [x, y] = spotXY(m);
    const a = m.anim;
    if (a) {
      const p = clamp((t - a.t0) / a.dur);
      const [sx, sy] = spotXY(m);
      switch (a.kind) {
        case 'jump': lift = Math.sin(p * Math.PI) * 130; rot = Math.sin(p * Math.PI * 2) * 0.2; break;
        case 'spin': lift = Math.sin(p * Math.PI) * 30; break;
        case 'slide': { const f = Math.sin(p * Math.PI); y = lerp(sy, 388, f); x = sx + f * 30; break; }
        case 'levitate': lift = Math.sin(Math.min(1, p * 2) * Math.PI / 2) * 70 * (p > 0.8 ? (1 - p) / 0.2 : 1); break;
        case 'stagedive': {
          if (p < 0.15) { const f = p / 0.15; x = lerp(sx, 480, f); y = lerp(sy, 395, f); }
          else if (p < 0.3) { const f = (p - 0.15) / 0.15; x = 480; y = lerp(395, 470, f); lift = Math.sin(f * Math.PI) * 90; rot = -f * 1.4; }
          else if (p < 0.8) { const f = (p - 0.3) / 0.5; x = 480 + Math.sin(f * Math.PI * 2) * 300; y = 470; lift = 20 + Math.abs(Math.sin(f * 20)) * 8; rot = -1.4; }
          else { const f = (p - 0.8) / 0.2; x = lerp(480, sx, f); y = lerp(470, sy, f); lift = Math.sin(f * Math.PI) * 160; rot = -1.4 * (1 - f); }
          break;
        }
        case 'moshpit': {
          if (p < 0.15) { const f = p / 0.15; x = lerp(sx, 480, f); y = lerp(sy, 470, f); lift = Math.sin(f * Math.PI) * 100; }
          else if (p < 0.85) { const f = (p - 0.15) / 0.7; x = 480 + Math.cos(f * 18) * 60; y = 480 + Math.sin(f * 18) * 18; lift = Math.abs(Math.sin(f * 40)) * 14; }
          else { const f = (p - 0.85) / 0.15; x = lerp(480, sx, f); y = lerp(480, sy, f); lift = Math.sin(f * Math.PI) * 140; }
          break;
        }
        case 'skydive': {
          if (p < 0.2) { lift = (p / 0.2) ** 2 * 700; }
          else if (p < 0.35) { lift = 700; }
          else { const f = (p - 0.35) / 0.65; lift = lerp(420, 0, f); x = sx + Math.sin(f * 9) * 50 * (1 - f); }
          break;
        }
      }
    }
    return [x, y, lift, rot];
  }

  function drawMusician(m: M, t: number) {
    if (!m.on) return;
    const [x, y, lift, rot] = drawPos(m, t);
    const s = depth(y) * 1.05;
    const a = m.anim;
    const p = a ? clamp((t - a.t0) / a.dur) : 0;
    const playing = m.placed && audible(m, t) && !a;
    const ph = beatPhase(t);
    const bob = m.walking ? Math.abs(Math.sin(t * 9 + m.bob)) * 4 : playing ? Math.abs(Math.sin(ph * Math.PI)) * 3 : 0;
    // shadow stays on the floor
    if (!(a && a.kind === 'skydive' && lift > 600)) ell(x, y + 1, 18 * s * clamp(1 - lift / 400, 0.3), 4 * s, 'rgba(0,0,0,.3)', 0);
    g.save(); g.translate(x, y - bob - lift); g.rotate(rot); g.scale(s, s);
    if (a && a.kind === 'spin') g.scale(Math.cos(p * Math.PI * 4), 1);
    if (a && a.kind === 'wiggle') g.scale(1 + Math.sin(t * 30) * 0.15, 1 - Math.sin(t * 30) * 0.1);
    const col = COLOR[m.id];
    // skydive parachute
    if (a && a.kind === 'skydive' && p > 0.35) {
      g.strokeStyle = INK; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-14, -40); g.lineTo(-50, -170); g.moveTo(14, -40); g.lineTo(50, -170); g.stroke();
      paper([[-62, -168], [-40, -200], [0, -212], [40, -200], [62, -168], [30, -175], [0, -172], [-30, -175]], col, 5, { j: 1.5 });
    }
    const split = a && (a.kind === 'jump' || a.kind === 'skydive') ? Math.sin(p * Math.PI) : 0;
    const leg = m.walking ? Math.sin(t * 9 + m.bob) * 5 : 0;
    g.fillStyle = INK;
    g.save(); g.translate(-5, -16); g.rotate(split * 0.9); g.fillRect(-3 + leg * 0.5, 0, 6, 16); ell(-1 + leg * 0.5, 16, 7, 3.5, '#20302d', 1.5); g.restore();
    g.save(); g.translate(5, -16); g.rotate(-split * 0.9); g.fillRect(-3 - leg * 0.5, 0, 6, 16); ell(1 - leg * 0.5, 16, 7, 3.5, '#20302d', 1.5); g.restore();
    paper([[-14, -14], [14, -14], [11, -46], [-11, -46]], col, 11 + m.id.length, { j: 1.4 });
    const up = m.carry || m.busyKind === 'lift' || (a && a.kind !== 'headbang') || (playing && hype > 0.75 && Math.sin(t * 3 + m.bob) > 0.6);
    paper(up ? [[-14, -42], [-24, -62], [-20, -64], [-11, -46]] : [[-12, -42], [-18, -22], [-14, -21], [-10, -36]], col, 3 + m.bob, { j: 1 });
    paper(up ? [[14, -42], [24, -62], [20, -64], [11, -46]] : [[12, -42], [18, -22], [14, -21], [10, -36]], col, 5 + m.bob, { j: 1 });
    // drinks in hand: pints (Simon: ice tea)
    if (m.drinks > 0 && !m.carry) {
      g.save(); g.translate(17, -26);
      paper([[-5, 0], [5, 0], [6, -14], [-6, -14]], m.id === 'simon' ? '#c98a2a' : '#f2b632', 2, { j: 0.6, lw: 1.5 });
      ell(0, -14, 6, 2.5, m.id === 'simon' ? '#e9c440' : '#fffdf6', 1);
      if (m.id === 'simon') ell(5, -14, 3, 3, '#b2cc3c', 1);
      g.restore();
      if (m.drinks > 1) text('x' + m.drinks, 30, -36, 11, PAPER);
    }
    const h = heads[m.id];
    if (h) {
      const hh = 66, hw = (hh * h.width) / h.height;
      const nod = a && a.kind === 'headbang' ? Math.sin(t * 28) * 0.35 : Math.sin(t * 3 + m.bob) * (m.walking ? 0.08 : 0.03) + (playing ? Math.sin(ph * Math.PI * 2) * 0.05 : 0);
      g.save(); g.translate(0, -42); g.rotate(nod); g.drawImage(h, -hw / 2, -hh + 8, hw, hh); g.restore();
    }
    if (m.carry || m.busyKind === 'lift') drawInstr(m.instr, 0, m.busyKind === 'lift' ? -10 : -14, m.instr === 'drums' ? 0.8 : 0.75, 9);
    g.restore();
    if (a && a.kind === 'levitate') for (let k = 0; k < 6; k++) { const ang = t * 3 + k; ell(x + Math.cos(ang) * 40, y - lift - 50 + Math.sin(ang) * 30, 3, 3, '#ffec00', 0); }
    // name tag: number key + name while he still has work to do
    if (!m.placed) {
      const ty = y - 118 * s - bob;
      label(`${ROSTER.indexOf(m.id) + 1} ${NAME[m.id]}`, x, ty, sel === m ? '#ffec00' : PAPER);
      if (sel === m) { g.strokeStyle = '#ffec00'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y + 1, 26 * s, 8 * s, 0, 0, Math.PI * 2); g.stroke(); }
      if (m.busy > 0 && m.busyKind === 'install') {
        const tot = INSTALL[m.instr] ?? 1, f = 1 - m.busy / tot;
        g.fillStyle = INK; g.fillRect(x - 22, ty + 8, 44, 7); g.fillStyle = PAL.lime; g.fillRect(x - 21, ty + 9, 42 * f, 5);
      }
    }
    if (m.sayT > 0) bubble(m.say, x, y - 128 * s - lift);
  }

  function bubble(s: string, x: number, y: number) {
    g.font = '14px "DM Sans", system-ui, sans-serif';
    const w = g.measureText(s).width + 18;
    const bx = clamp(x - w / 2, 6, W - w - 6);
    paper([[bx, y - 26], [bx + w, y - 26], [bx + w, y], [x + 8, y], [x, y + 9], [x - 2, y], [bx, y]], PAPER, 77, { j: 0.8, lw: 1.5 });
    g.fillStyle = INK; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(s, bx + 9, y - 13);
  }

  function placedInstruments(t: number) {
    for (const m of mus) {
      if (!m.placed) continue;
      const [x, y] = instrXY(m);
      drawInstr(m.instr, x, y, depth(y) * (m.instr === 'drums' ? 1 : 0.9), 6, m.cable);
      if (m.cable) { const k = Math.sin(t * 20) > 0; text(k ? '⚡' : '!', x, y - 70, 26, '#ffec00'); }
    }
  }

  function cueRings(t: number) {
    const L = level!;
    for (let i = 0; i < L.cues.length; i++) {
      const c = L.cues[i];
      if (cueDone.has(i) || t < c.t - 2.2 || t > c.t + 0.6) continue;
      const m = byId(c.who);
      if (!m.placed || m.anim) continue;
      const [x, y] = drawPos(m, t);
      const s = depth(y);
      const k = clamp((c.t - t) / 2.2);
      const r = 26 + k * 80;
      g.strokeStyle = c.big ? '#ffec00' : PAPER; g.lineWidth = c.big ? 5 : 3;
      g.beginPath(); g.ellipse(x, y - 55 * s, r, r * 1.1, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = 'rgba(255,236,0,.5)'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y - 55 * s, 26, 28, 0, 0, Math.PI * 2); g.stroke();
      text(c.big ? '★' : '!', x + 34 * s, y - 120 * s, c.big ? 30 : 24, c.big ? '#ffec00' : PAPER);
      text(String(ROSTER.indexOf(m.id) + 1), x - 34 * s, y - 120 * s, 16, PAPER);
    }
  }

  function spotlight(t: number) {
    if (!spot || !spot.anim) return;
    const [x, y, lift] = drawPos(spot, t);
    g.fillStyle = 'rgba(8,16,24,.35)'; g.fillRect(0, 0, W, H);
    const grd = g.createLinearGradient(480, 40, x, y);
    grd.addColorStop(0, 'rgba(255,250,210,.55)'); grd.addColorStop(1, 'rgba(255,250,210,.18)');
    g.fillStyle = grd; g.beginPath(); g.moveTo(470, 44); g.lineTo(490, 44); g.lineTo(x + 70, y - lift + 20); g.lineTo(x - 70, y - lift + 20); g.closePath(); g.fill();
    ell(x, y - lift + 6, 70, 18, 'rgba(255,250,210,.25)', 0);
  }

  function crowd(t: number) {
    const n = crowdCount(t), md = mood(t);
    const ph = beatPhase(t);
    const list = FANS.slice(0, n).map((f, i) => ({ f, i }));
    const pos = (f: Fan, i: number): [number, number] => {
      if (mosh > 0 && Math.abs(f.x - 480) < 170) {
        const ang = Math.atan2(f.y - 490, (f.x - 480) / 3) + (6 - mosh) * 2.2;
        const r = Math.hypot((f.x - 480) / 3, f.y - 490);
        return [480 + Math.cos(ang) * r * 3, 490 + Math.sin(ang) * r];
      }
      return [f.x, f.y];
    };
    list.sort((a, b) => pos(a.f, a.i)[1] - pos(b.f, b.i)[1]);
    for (const { f, i } of list) {
      const [fx, fy] = pos(f, i);
      const happy = t > 0 && f.need < md, sad = t > 0 && md < 0.6 && f.need > md + 0.25;
      const party = happy ? 0.5 + hype : 0.2;
      const jump = happy ? Math.abs(Math.sin(ph * Math.PI + f.ph)) * 10 * party : Math.abs(Math.sin(t * 2 + f.ph)) * 1.5;
      g.save(); g.translate(fx, fy - jump);
      paper([[-12, 0], [12, 0], [10, -22], [-10, -22]], f.shirt, 13 + f.ph * 10, { j: 1.2, lw: 1.6, shadow: false });
      if (happy) {
        const wave = Math.sin(t * 8 + f.ph) * 4;
        g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-9, -20); g.lineTo(-17 + wave, -40); g.moveTo(9, -20); g.lineTo(17 - wave, -40); g.stroke();
        g.strokeStyle = f.shirt; g.lineWidth = 2; g.stroke();
      }
      ell(0, -34, 15, 14, f.skin, 1.8);
      if (f.hat === 0) paper([[-15, -38], [15, -38], [12, -50], [-12, -50]], '#3f8f86', f.ph * 5, { j: 1, lw: 1.5, shadow: false });
      if (f.hat === 1) { g.fillStyle = '#96261b'; g.beginPath(); g.arc(0, -40, 13, Math.PI, 0); g.fill(); g.lineWidth = 1.5; g.strokeStyle = INK; g.stroke(); }
      ell(-5, -36, 5, 5.5, '#fff', 1); ell(5, -36, 5, 5.5, '#fff', 1);
      g.fillStyle = INK; g.beginPath(); g.arc(-4 + (happy ? 0 : -1), -35, 1.4, 0, 7); g.arc(4 + (happy ? 0 : -1), -35, 1.4, 0, 7); g.fill();
      g.strokeStyle = INK; g.lineWidth = 1.6; g.beginPath();
      if (happy) g.arc(0, -28, 4.5, 0.15 * Math.PI, 0.85 * Math.PI); else if (sad) g.arc(0, -23, 4, 1.2 * Math.PI, 1.8 * Math.PI); else { g.moveTo(-3, -27); g.lineTo(3, -27); }
      g.stroke();
      g.restore();
    }
  }

  function drawFan(t: number) {
    if (!fan) return;
    const f = fan.look;
    g.save(); g.translate(fan.x, fan.y - Math.abs(Math.sin(t * 12)) * 8); g.scale(1.2, 1.2);
    paper([[-12, 0], [12, 0], [10, -22], [-10, -22]], f.shirt, 3, { j: 1.2, lw: 1.6 });
    g.strokeStyle = INK; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-9, -20); g.lineTo(-20, -40); g.moveTo(9, -20); g.lineTo(20, -40); g.stroke();
    ell(0, -34, 15, 14, f.skin, 1.8); ell(-5, -36, 5, 5.5, '#fff', 1); ell(5, -36, 5, 5.5, '#fff', 1);
    g.fillStyle = INK; g.beginPath(); g.arc(-4, -36, 1.4, 0, 7); g.arc(6, -34, 1.4, 0, 7); g.fill();
    g.beginPath(); g.ellipse(0, -27, 5, 3, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    if (!fan.out) bubble(T('st.fanSay'), fan.x, fan.y - 64);
  }

  function drawDrinks() {
    for (const d of drinks) {
      const m = byId(d.to);
      const [tx, ty] = drawPos(m, lastT);
      const f = clamp(d.t);
      const x = lerp(d.from[0], tx + 17, f), y = lerp(d.from[1], ty - 50, f) - Math.sin(f * Math.PI) * 120;
      g.save(); g.translate(x, y); g.rotate(f * 6);
      paper([[-5, 0], [5, 0], [6, -14], [-6, -14]], d.tea ? '#c98a2a' : '#f2b632', 2, { j: 0.6, lw: 1.5 });
      ell(0, -14, 6, 2.5, d.tea ? '#e9c440' : '#fffdf6', 1);
      g.restore();
    }
  }

  function hud(t: number) {
    const L = level!;
    // mixer: what you hear, one channel per musician
    g.fillStyle = 'rgba(15,38,34,.85)'; g.beginPath(); g.roundRect(10, 8, 200, 78, 10); g.fill();
    g.font = '11px "DM Sans", system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.fillStyle = PAPER; g.fillText(T('st.mixer'), 20, 23);
    const ord = [...mus].sort((a, b) => a.entry - b.entry);
    ord.forEach((m, k) => {
      const x = 22 + k * 23, on = audible(m, t), waiting = m.placed && !on && !m.cable;
      g.fillStyle = '#0a1c19'; g.fillRect(x, 30, 13, 36);
      const lvl = on ? 0.55 + 0.4 * Math.abs(Math.sin(t * 7 + k)) : 0;
      g.fillStyle = COLOR[m.id]; g.fillRect(x, 66 - 36 * lvl, 13, 36 * lvl);
      ell(x + 6.5, 76, 4, 4, on ? '#b2f06a' : m.cable ? '#ff5a3c' : waiting ? '#ffec00' : t >= m.entry ? '#ff5a3c' : '#3a4a46', 1);
    });
    // song timeline with the entries
    const x0 = 250, x1 = 710, y = 22;
    const span = 50;
    const tx = (v: number) => (v <= span ? lerp(x0, x0 + (x1 - x0) * 0.55, (v + SOUNDCHECK) / (span + SOUNDCHECK)) : lerp(x0 + (x1 - x0) * 0.55, x1, (v - span) / (L.song.duration - span)));
    g.fillStyle = 'rgba(15,38,34,.85)'; g.beginPath(); g.roundRect(x0 - 14, 6, x1 - x0 + 28, 40, 10); g.fill();
    g.fillStyle = '#28574e'; g.fillRect(x0, y - 3, x1 - x0, 6); g.fillStyle = '#ffec00'; g.fillRect(x0, y - 3, Math.max(0, tx(Math.min(t, L.song.duration)) - x0), 6);
    g.fillStyle = PAPER; g.fillRect(tx(0) - 1, y - 8, 2, 16);
    for (const m of mus) { const x = tx(m.entry); ell(x, y, 6, 6, m.placed ? COLOR[m.id] : '#0f2622', 2); if (!m.placed) { g.strokeStyle = COLOR[m.id]; g.lineWidth = 2; g.beginPath(); g.arc(x, y, 3, 0, 7); g.stroke(); } }
    for (const c of L.cues) if (c.big) text('★', tx(c.t), y, 12, cueDone.has(L.cues.indexOf(c)) ? '#6b6b4a' : '#ffec00');
    g.font = '11px "DM Sans", system-ui, sans-serif'; g.fillStyle = PAPER; g.textAlign = 'left'; g.fillText('soundcheck', x0, 41);
    g.textAlign = 'right'; g.fillText(fmt(L.song.duration), x1, 41); g.textAlign = 'center'; g.fillText(fmt(Math.max(0, t)), tx(Math.max(0, Math.min(t, L.song.duration))), 41);
    ell(tx(Math.min(t, L.song.duration)), y, 5, 5, '#ffec00', 2);
    // score + party meter
    text(String(Math.round(score)).padStart(6, '0'), W - 14, 26, 26, '#ffec00', 'right');
    g.fillStyle = 'rgba(15,38,34,.85)'; g.fillRect(W - 174, 44, 160, 14);
    const hk = mood(t);
    g.fillStyle = hk > 0.66 ? '#b2f06a' : hk > 0.4 ? '#ffec00' : '#ff7a4a'; g.fillRect(W - 172, 46, 156 * hk, 10);
    g.font = '11px "DM Sans", system-ui, sans-serif'; g.textAlign = 'right'; g.fillStyle = PAPER; g.fillText(`${T('st.party')} · ${crowdCount(t)} ${T('st.people')}`, W - 14, 72);
    // what to do next
    let msg = '', bg = PAPER, fg = INK;
    const open = mus.filter((m) => !m.placed).sort((a, b) => a.entry - b.entry)[0];
    if (open) {
      const late = t >= open.entry;
      msg = late ? `${T('st.nowPlaying')}: ${T('instr.' + open.instr)} (${NAME[open.id]})!` : `${T('st.next')}: ${T('instr.' + open.instr)} (${NAME[open.id]}) ${T('st.before')} ${fmt(open.entry)}`;
      if (late) { bg = '#ce460a'; fg = PAPER; }
    } else if (t < L.song.duration) { msg = T('st.allSet'); bg = '#b2cc3c'; }
    if (cable) { msg = `${T('st.cableMsg')} (${NAME[cable.id]})`; bg = '#ce460a'; fg = PAPER; }
    if (fan && !fan.out) { msg = T('st.fanMsg'); bg = '#ce460a'; fg = PAPER; }
    if (msg) {
      g.font = '16px "Lilita One", system-ui, sans-serif'; const w = g.measureText(msg).width + 26;
      paper([[480 - w / 2, 62], [480 + w / 2, 62], [480 + w / 2, 88], [480 - w / 2, 88]], bg, 91, { j: 1.4 });
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(msg, 480, 76);
    }
    if (t < 0) text(`${T('st.soundcheck')} ${Math.ceil(-t)}`, 480, 290, 42, PAPER);
    if (t < -12 || hintT > 0) {
      const lines = [T('st.help1'), T('st.help2')];
      g.fillStyle = 'rgba(15,38,34,.82)'; g.beginPath(); g.roundRect(250, 312, 460, 54, 10); g.fill();
      lines.forEach((l, i) => { g.font = '14px "DM Sans", system-ui, sans-serif'; g.fillStyle = PAPER; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(l, 480, 330 + i * 20); });
    }
    if (stems?.muted) text(T('muted'), 16, 100, 12, PAPER, 'left');
    if (opts.autoplay) text('AUTOPLAY', 480, 104, 14, PAL.lime);
    for (const f of floats) text(f.text, f.x, f.y - f.t * 40, f.size, f.color);
  }

  function scene(t: number) {
    backdrop(t);
    lights(t);
    stageFloor();
    spotMarks(t);
    const items: { y: number; f: () => void }[] = [];
    items.push({ y: CASE_TOP + 10, f: pileDraw });
    for (const m of mus) if (m.placed) { const [, iy] = instrXY(m); items.push({ y: iy - 0.5, f: () => { const [x, y] = instrXY(m); drawInstr(m.instr, x, y, depth(y) * (m.instr === 'drums' ? 1 : 0.9), 6, m.cable); } }); }
    for (const m of mus) if (m.on) { const [, y] = drawPos(m, t); items.push({ y: m.anim && (m.anim.kind === 'stagedive' || m.anim.kind === 'moshpit') ? 1000 : y, f: () => drawMusician(m, t) }); }
    if (fan) items.push({ y: fan.y, f: () => drawFan(t) });
    items.sort((a, b) => a.y - b.y);
    const front = items.filter((i) => i.y >= 1000);
    items.filter((i) => i.y < 1000).forEach((i) => i.f());
    for (const m of mus) if (m.cable) { const [x, y] = instrXY(m); text(Math.sin(t * 20) > 0 ? '⚡' : '!', x, y - 70, 26, '#ffec00'); }
    spotlight(t);
    if (spot && spot.anim) drawMusician(spot, t);
    cueRings(t);
    crowd(t);
    front.forEach((i) => i.f());
    drawDrinks();
    if (grainPat) { g.fillStyle = grainPat; g.fillRect(0, 0, W, H); }
  }

  function intro(clk: number) {
    g.fillStyle = '#12302c'; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2 + 40); g.rotate(clk * 0.1);
    g.fillStyle = '#173a34'; for (let k = 0; k < 16; k++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 800, (k * Math.PI) / 8, (k * Math.PI) / 8 + Math.PI / 16); g.closePath(); g.fill(); }
    g.restore();
    text('ADULTHOOD', W / 2, 70, 54, '#ffec00');
    text(T('st.subtitle'), W / 2, 118, 22, PAPER);
    const lines = [T('st.rule1'), T('st.rule2'), T('st.rule3'), T('st.rule4')];
    g.fillStyle = 'rgba(15,38,34,.85)'; g.beginPath(); g.roundRect(150, 150, 660, 150, 14); g.fill();
    lines.forEach((l, i) => { g.font = '17px "DM Sans", system-ui, sans-serif'; g.fillStyle = PAPER; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(`${i + 1}.  ${l}`, 176, 178 + i * 32); });
    ROSTER.forEach((id, i) => { const h = heads[id]; if (h) { const x = 170 + i * 88, hh = 90, hw = (hh * h.width) / h.height; g.drawImage(h, x - hw / 2, 318, hw, hh); } });
    if (!stems!.ready) {
      const f = stems!.loaded / stems!.total;
      g.fillStyle = INK; g.fillRect(330, 470, 300, 14); g.fillStyle = '#ffec00'; g.fillRect(332, 472, 296 * f, 10);
      text(stems!.err ? stems!.err : T('loading'), W / 2, 500, 16, PAPER);
    } else if (Math.floor(clk * 2) % 2 === 0) text(T('st.start'), W / 2, 486, 22, PAPER);
    if (best) text(`${T('best')}: ${best}`, W / 2, 522, 13, '#b9d2c6', 'center', false);
  }

  function endScreen(clk: number) {
    scene(lastT);
    g.fillStyle = 'rgba(15,38,34,.8)'; g.fillRect(0, 0, W, H);
    text(T('st.endTitle'), W / 2, 110, 46, '#ffec00');
    const rows: [string, string][] = [
      [T('score'), String(Math.round(score))],
      [T('st.onTimeCount'), `${perfectPlace} / 8`],
      [T('st.orderCount'), `${orderOk} / 8`],
      [T('st.spotCount'), `${hits} / ${level!.cues.length}`],
      [T('st.drinks'), String(drinksGiven)],
      [T('st.fixes'), String(fixes)],
      [T('best'), String(best)],
    ];
    rows.forEach(([k, v], i) => { text(k, W / 2 - 20, 170 + i * 34, 20, PAPER, 'right'); text(v, W / 2 + 20, 170 + i * 34, 20, '#ffec00', 'left'); });
    if (clk > 1.5) text(T('st.again'), W / 2, 440, 18, PAL.lime);
  }

  // ---------- public frame ----------
  let clk = 0;
  return {
    wake() { stems?.wake(); },
    get muted() { return !!stems?.muted; },
    async enter() {
      mode = 'loading'; modeT = 0;
      await ready;
      stems!.load();
      mode = 'intro'; modeT = 0;
    },
    leave() { stems?.stop(); },
    frame(dtReal: number, pointer: { x: number; y: number } | null, codes: string[]): 'exit' | void {
      clk += dtReal; modeT += dtReal;
      g.imageSmoothingEnabled = true;
      if (codes.includes('Escape')) { stems?.stop(); return 'exit'; }
      if (codes.includes('KeyM') && stems) stems.setMuted(!stems.muted);
      if (mode === 'loading' || !level || !stems) { g.fillStyle = '#12302c'; g.fillRect(0, 0, W, H); text(T('loading'), W / 2, H / 2, 22, PAPER); return; }
      if (mode === 'intro') {
        intro(clk);
        if (stems.ready && (opts.autoplay || (modeT > 0.3 && (pointer || codes.some((c) => c === 'Space' || c === 'Enter'))))) { reset(); mode = 'play'; modeT = 0; }
        return;
      }
      if (mode === 'end') {
        endScreen(modeT);
        if (modeT > 1.5 && (pointer || codes.some((c) => c === 'Space' || c === 'Enter'))) { mode = 'intro'; modeT = 0; }
        (window as any).__stage = { mode, score: Math.round(score), hits, misses, placed: mus.filter((m) => m.placed).length, perfectPlace, drinksGiven, fixes };
        return;
      }
      // play
      if (codes.includes('KeyP') && !sel) paused = !paused;
      if (paused) { scene(lastT); hud(lastT); text(T('paused'), W / 2, H / 2, 40, '#ffec00'); if (pointer) paused = false; return; }
      let t: number;
      if (preT < 0) {
        preT += dtReal * (opts.autoplay ? opts.rate : 1);
        if (preT >= 0) { stems.play(0); t = 0; } else t = preT;
      } else t = stems.time();
      const dt = Math.max(0, Math.min(0.25, t - lastT));
      lastT = t;
      for (const c of codes) key(c, t);
      if (pointer) click(pointer.x, pointer.y, t);
      update(t, dt);
      scene(t);
      hud(t);
      (window as any).__stage = { mode, t, score: Math.round(score), hits, misses, placed: mus.filter((m) => m.placed).length, pile: pile.length, hype };
      if (t >= level.song.duration) {
        stems.stop();
        mode = 'end'; modeT = 0;
        if (score > best) { best = Math.round(score); try { localStorage.setItem('sam-game-best-adulthood', String(best)); } catch {} }
      }
    },
  };
}

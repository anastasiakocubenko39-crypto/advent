// Фонова мелодія «Щедрик» (М. Леонтович, суспільне надбання).
// Якщо в репозиторії є файл audio/shchedryk.mp3 — грає він (власний запис / вільна ліцензія).
// Якщо файлу немає — мелодія звучить у синтезованому оркестрі (струнні, віолончелі, флейта, дзвіночки) прямо в браузері, тож авторських прав на запис немає.

const KEY = 'advent-music';
const VOL = 0.7;

function getPref() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
function setPref(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {} }

// ── Партитура «Щедрика» (М. Леонтович, суспільне надбання) ──
// Соль-мінор, 3/4. Час і тривалості — у восьмих (1 такт = 6 восьмих).
// Головна тема — остинато: Сі♭ (чверть) · Ля · Сі♭ (восьмі) · Соль (чверть).
// Оркестровка (синтез у браузері): тема — струнні піцикато з дзвіночками;
// бас Соль–Фа–Мі♭–Ре — віолончелі; акорди — група струнних; друга партія
// терцією вище — флейта; кульмінація — низхідні секвенції у струнних.
// Цикл 32 такти, повторюється без пауз.
const M = { D3: 50, Eb3: 51, F3: 53, G3: 55, A3: 57, Bb3: 58, C4: 60, D4: 62, Eb4: 63, F4: 65, G4: 67, A4: 69, Bb4: 70, C5: 72, D5: 74, Eb5: 75, F5: 77, G5: 79 };
const BAR = 6;
const BASS = [M.G3, M.F3, M.Eb3, M.D3];
// Акорди струнних над басом: Gm · Gm/F · Eb · D (з затриманням)
const PAD = [[M.Bb3, M.D4], [M.Bb3, M.D4], [M.Bb3, M.Eb4], [M.A3, M.D4]];

function buildScore() {
  const ev = []; // [часВосьмих, midi, тривалістьВосьмих, гучність, інструмент]
  const motif = (bar, hi, mid, lo, vel, inst, bell) => {
    const t = bar * BAR;
    for (const [dt, m, d, k] of [[0, hi, 2, 1], [2, mid, 1, 0.8], [3, hi, 1, 0.85], [4, lo, 2, 0.9]]) {
      ev.push([t + dt, m, d, vel * k, inst]);
      if (bell) ev.push([t + dt, m + 12, d, vel * k * bell, 'bell']);
    }
  };
  const ost = (bar, vel, bell = 0.3) => motif(bar, M.Bb4, M.A4, M.G4, vel, 'pizz', bell);
  const ostHi = (bar, vel) => motif(bar, M.D5, M.C5, M.Bb4, vel, 'flute', 0);
  const bass = (bar, vel, pad = 0.32) => {
    ev.push([bar * BAR, BASS[bar % 4], 6, vel, 'cello']);
    if (pad) for (const m of PAD[bar % 4]) ev.push([bar * BAR, m, 6, pad, 'strings']);
  };
  const run = (bar, notes, vel) => notes.forEach((m, i) => {
    ev.push([bar * BAR + i, m, 1, vel * (i === 0 ? 1 : 0.85), 'strings']);
    if (i === 0) ev.push([bar * BAR, m + 12, 2, vel * 0.35, 'bell']);
  });

  // 1–4: тема — піцикато з дзвіночками, тихо
  for (let b = 0; b < 4; b++) ost(b, 0.45 + b * 0.05, 0.35);
  // 5–12: вступають віолончелі й струнні акорди
  for (let b = 4; b < 12; b++) { ost(b, 0.62, 0.25); bass(b, 0.5) }
  // 13–20: + флейта терцією вище
  for (let b = 12; b < 20; b++) { ost(b, 0.55, 0.2); ostHi(b, 0.5); bass(b, 0.55, 0.36) }
  // 21–24: кульмінація — низхідні секвенції у струнних
  run(20, [M.G5, M.G5, M.G5, M.G5, M.F5, M.Eb5], 0.6); bass(20, 0.6, 0.4);
  run(21, [M.D5, M.D5, M.D5, M.D5, M.C5, M.Bb4], 0.58); bass(21, 0.6, 0.4);
  run(22, [M.C5, M.C5, M.C5, M.C5, M.Bb4, M.A4], 0.56); bass(22, 0.6, 0.4);
  ev.push([23 * BAR, M.G4, 6, 0.55, 'strings'], [23 * BAR, M.G5, 4, 0.3, 'bell']); bass(23, 0.6, 0.42);
  // 25–28: тема знову, з флейтою
  for (let b = 24; b < 28; b++) { ost(b, 0.55, 0.25); ostHi(b, 0.42); bass(b, 0.48, 0.3) }
  // 29–32: затихає — лише піцикато й дзвіночки
  for (let b = 28; b < 32; b++) ost(b, 0.5 - (b - 28) * 0.08, 0.4);
  ev.sort((a, b) => a[0] - b[0]);
  return { events: ev, length: 32 * BAR };
}

// Імпульс «концертного залу» для реверберації: шум зі згасанням ~2.4 с.
function hallImpulse(ctx, seconds = 2.4) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
  }
  return buf;
}

class Synth {
  constructor() {
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
    this.bus = ctx.createGain();
    const rev = ctx.createConvolver(); rev.buffer = hallImpulse(ctx);
    const wet = ctx.createGain(); wet.gain.value = 0.32;
    const dry = ctx.createGain(); dry.gain.value = 0.85;
    this.bus.connect(dry); this.bus.connect(rev); rev.connect(wet);
    dry.connect(comp); wet.connect(comp); comp.connect(this.master); this.master.connect(ctx.destination);
    this.bpm = 112; // чвертей за хвилину — помірно, як у хорі
    this.score = buildScore();
    this.timer = null;
  }
  osc(type, freq, t, end, dest, amp = 1, detuneCents = 0) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detuneCents;
    const g = this.ctx.createGain(); g.gain.value = amp;
    o.connect(g); g.connect(dest); o.start(t); o.stop(end);
    return o;
  }
  env(t, peak, attack, hold, release) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + Math.max(attack, hold));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack, hold) + release);
    return g;
  }
  filter(type, freq, q = 0.7) { const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; return f; }
  vibrato(oscs, t, end, depth = 6, rate = 5.2) {
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = rate;
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(depth, t + 0.35);
    lfo.connect(g); oscs.forEach((o) => g.connect(o.detune)); lfo.start(t); lfo.stop(end);
  }
  note(midi, t, dur, vel, inst) {
    const f = 440 * 2 ** ((midi - 69) / 12);
    if (inst === 'pizz') {
      // струнне піцикато: щипок пилкоподібної хвилі через фільтр, що швидко закривається
      const g = this.env(t, vel * 0.42, 0.004, 0.01, 0.55);
      const lp = this.filter('lowpass', f * 6, 1.2);
      lp.frequency.setValueAtTime(f * 7, t); lp.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.25);
      lp.connect(g); g.connect(this.bus);
      this.osc('sawtooth', f, t, t + 0.7, lp, 0.7);
      this.osc('triangle', f, t, t + 0.7, lp, 0.5);
    } else if (inst === 'bell') {
      // дзвіночки / челеста: синус з неграмонійними обертонами
      const g = this.env(t, vel * 0.3, 0.002, 0.005, 1.6);
      g.connect(this.bus);
      this.osc('sine', f, t, t + 1.7, g, 1);
      this.osc('sine', f * 2.76, t, t + 1.0, g, 0.22);
      this.osc('sine', f * 5.4, t, t + 0.5, g, 0.08);
    } else if (inst === 'strings' || inst === 'cello') {
      // група струнних: кілька злегка розстроєних «смичків» + вібрато
      const cello = inst === 'cello';
      const g = this.env(t, vel * (cello ? 0.32 : 0.2), cello ? 0.18 : 0.22, dur, cello ? 0.7 : 0.9);
      const lp = this.filter('lowpass', cello ? 900 : 2300, 0.8);
      lp.connect(g); g.connect(this.bus);
      const end = t + dur + 1.2;
      const oscs = [-8, 0, 8].map((dc) => this.osc('sawtooth', f, t, end, lp, 0.33, dc));
      if (cello) oscs.push(this.osc('sawtooth', f / 2, t, end, lp, 0.25));
      this.vibrato(oscs, t, end, cello ? 5 : 7);
    } else if (inst === 'flute') {
      // флейта: мʼякий тон з легким «диханням» і вібрато
      const g = this.env(t, vel * 0.26, 0.06, dur * 0.85, 0.35);
      g.connect(this.bus);
      const end = t + dur + 0.6;
      const oscs = [this.osc('sine', f, t, end, g, 1), this.osc('triangle', f * 2, t, end, g, 0.12)];
      this.vibrato(oscs, t, end, 9, 5.6);
    }
  }
  // Планувальник із запасом наперед: ноти стоять рівно у своєму часі,
  // цикл переходить у наступний без жодної паузи.
  tick() {
    const eighth = 30 / this.bpm;
    const { events, length } = this.score;
    const horizon = this.ctx.currentTime + 1.2;
    while (true) {
      if (this.idx >= events.length) { this.idx = 0; this.loopT0 += length * eighth; }
      const [at, m, d, v, inst] = events[this.idx];
      const t = this.loopT0 + at * eighth;
      if (t > horizon) break;
      if (t >= this.ctx.currentTime - 0.02) this.note(m, Math.max(t, this.ctx.currentTime), d * eighth, v, inst);
      this.idx++;
    }
  }
  start() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.timer) return;
    this.loopT0 = this.ctx.currentTime + 0.15;
    this.idx = 0;
    this.tick();
    this.timer = setInterval(() => this.tick(), 250);
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setValueAtTime(0, this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(VOL, this.ctx.currentTime + 1.2);
  }
  fadeTo(v) { this.master.gain.cancelScheduledValues(this.ctx.currentTime); this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3); }
  pause() { this.fadeTo(0); setTimeout(() => { if (this.paused) this.ctx.suspend(); }, 900); this.paused = true; }
  resume() { this.paused = false; this.ctx.resume(); this.fadeTo(VOL); }
}

export function createMusic(button) {
  let on = getPref();
  let player = null; // {play(), pause()}
  let started = false;
  let held = false; // пауза через відео

  async function makePlayer() {
    try {
      const r = await fetch('audio/shchedryk.mp3', { method: 'HEAD' });
      if (r.ok) {
        const a = new Audio('audio/shchedryk.mp3'); a.loop = true; a.volume = 0.35;
        return { play: () => a.play().catch(() => {}), pause: () => a.pause() };
      }
    } catch {}
    const s = new Synth();
    let first = true;
    return { play: () => { if (first) { first = false; s.start(); } else s.resume(); }, pause: () => s.pause() };
  }

  function render() {
    button.textContent = on ? '🔊' : '🔇';
    button.setAttribute('aria-label', on ? 'Вимкнути музику' : 'Увімкнути музику');
    button.setAttribute('aria-pressed', String(on));
  }
  async function ensure() { if (!player) player = await makePlayer(); return player; }
  async function apply() {
    if (!started) return;
    const p = await ensure();
    if (on && !held) p.play(); else p.pause();
  }

  // Перший дотик до екрана запускає музику (правила браузерів)
  const firstGesture = () => {
    started = true; apply();
    window.removeEventListener('pointerdown', firstGesture, true);
    window.removeEventListener('keydown', firstGesture, true);
  };
  window.addEventListener('pointerdown', firstGesture, true);
  window.addEventListener('keydown', firstGesture, true);

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    on = !on; setPref(on); started = true; render(); apply();
  });
  render();

  return {
    hold() { held = true; apply(); },
    release() { held = false; apply(); },
  };
}

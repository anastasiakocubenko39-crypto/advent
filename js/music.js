// Фонова мелодія «Щедрик» (М. Леонтович, суспільне надбання).
// Якщо в репозиторії є файл audio/shchedryk.mp3 — грає він (власний запис / вільна ліцензія).
// Якщо файлу немає — мелодія синтезується в браузері (музична скринька), тож авторських прав на запис немає.

const KEY = 'advent-music';
const VOL = 0.18;

function getPref() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
function setPref(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch {} }

// Ноти: [MIDI, тривалість у чвертях]. 3/4, остинато Bb-A-Bb-G
const N = { G3: 55, A3: 57, Bb3: 58, C4: 60, D3: 50, Eb3: 51, F3: 53, D4: 62, Eb4: 63, F4: 65, G4: 67, A4: 69, Bb4: 70, C5: 72, D5: 74, Eb5: 75, F5: 77, G5: 79 };
const OST = [[N.Bb4, 1], [N.A4, .5], [N.Bb4, .5], [N.G4, 1]];
const OST_HI = [[N.D5, 1], [N.C5, .5], [N.D5, .5], [N.Bb4, 1]];
function bars(pattern, n) { const out = []; for (let i = 0; i < n; i++) out.push(...pattern); return out; }
// Плавна мелодія верхнього голосу (друга половина)
const MEL = [
  [N.G5, 1], [N.G5, .5], [N.F5, .5], [N.Eb5, 1], [N.D5, 1], [N.D5, .5], [N.C5, .5], [N.Bb4, 1],
  [N.C5, 1], [N.C5, .5], [N.Bb4, .5], [N.A4, 1], [N.G4, 3],
];
function score() {
  // голоси: {notes, vel, oct}
  const voices = [];
  voices.push({ notes: bars(OST, 16), vel: .55 });
  voices.push({ notes: [...Array(4).fill([null, 3]), ...bars(OST_HI, 4), ...Array(8).fill([null, 3])], vel: .32 });
  voices.push({ notes: [...Array(4).fill([null, 3]), [N.G3, 3], [N.F3, 3], [N.Eb3, 3], [N.D3, 3], [N.G3, 3], [N.F3, 3], [N.Eb3, 3], [N.D3, 3], ...Array(4).fill([null, 3])], vel: .35 });
  voices.push({ notes: [...Array(8).fill([null, 3]), ...MEL, [null, 3]], vel: .3 });
  return { voices, length: 16 * 3 };
}

class Synth {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain(); this.master.gain.value = 0;
    // проста «кімнатна» луна
    const delay = this.ctx.createDelay(); delay.delayTime.value = 0.23;
    const fb = this.ctx.createGain(); fb.gain.value = 0.28;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    this.bus = this.ctx.createGain();
    this.bus.connect(this.master); this.bus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.bpm = 138; this.timer = null; this.loopStart = 0;
  }
  note(midi, t, dur, vel) {
    const f = 440 * 2 ** ((midi - 69) / 12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel * 0.5, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0008, t + Math.max(1.2, dur * 2.2));
    g.connect(this.bus);
    for (const [mul, amp, type] of [[1, 1, 'sine'], [2, .28, 'sine'], [3, .08, 'triangle'], [4.2, .05, 'sine']]) {
      const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f * mul;
      const og = this.ctx.createGain(); og.gain.value = amp;
      o.connect(og); og.connect(g); o.start(t); o.stop(t + Math.max(1.3, dur * 2.3));
    }
  }
  scheduleLoop(t0) {
    const q = 60 / this.bpm; const { voices, length } = score();
    for (const v of voices) {
      let t = t0;
      for (const [m, d] of v.notes) { if (m) this.note(m, t, d * q, v.vel); t += d * q; }
    }
    return t0 + length * q;
  }
  start() {
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (this.timer) return;
    let next = this.ctx.currentTime + 0.1;
    next = this.scheduleLoop(next);
    this.timer = setInterval(() => {
      if (this.ctx.currentTime > next - 3) next = this.scheduleLoop(next + 0.4);
    }, 1000);
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(VOL, this.ctx.currentTime + 1.5);
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

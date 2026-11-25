// Сніг, блискітки-салют, зірочка зі шлейфом.
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Легкий сніг на canvas. Повертає {stop()} */
export function snow(canvas, { density = 1 } = {}) {
  const ctx = canvas.getContext('2d');
  let w, h, dpr, flakes = [], raf, running = true;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(120, (w * h) / 9000) * density * (reducedMotion() ? 0.3 : 1));
    flakes = Array.from({ length: n }, () => mk(true));
  }
  function mk(any) {
    const r = Math.random() ** 2 * 2.6 + 0.6;
    return { x: Math.random() * w, y: any ? Math.random() * h : -5, r, s: r * 0.35 + 0.25,
      a: Math.random() * Math.PI * 2, o: 0.45 + Math.random() * 0.5 };
  }
  let last = performance.now();
  function tick(t) {
    if (!running) return;
    const dt = Math.min(50, t - last) / 16.7; last = t;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fff';
    for (const f of flakes) {
      f.a += 0.012 * dt; f.y += f.s * dt; f.x += Math.sin(f.a) * 0.35 * dt;
      if (f.y > h + 5) Object.assign(f, mk(false));
      ctx.globalAlpha = f.o; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(tick);
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const vis = () => { if (document.hidden) { cancelAnimationFrame(raf); } else { last = performance.now(); raf = requestAnimationFrame(tick); } };
  document.addEventListener('visibilitychange', vis);
  raf = requestAnimationFrame(tick);
  return { stop() { running = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', vis); } };
}

/** Повноекранний тимчасовий canvas для ефектів */
function fxCanvas() {
  const c = document.createElement('canvas');
  c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60';
  document.body.appendChild(c);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { c, ctx };
}

/** Салют блискіток з точки (x,y у px вікна) */
export function sparkleBurst(x, y, { count = 60 } = {}) {
  if (typeof window.confetti !== 'function') return;
  const origin = { x: x / innerWidth, y: y / innerHeight };
  const colors = ['#ffd75a', '#fff3b0', '#e8c25a', '#f5f5f5', '#c9d6e3', '#ffe9a8'];
  const base = { origin, colors, disableForReducedMotion: true, zIndex: 70, ticks: 160, gravity: 0.7, scalar: 0.9 };
  window.confetti({ ...base, particleCount: Math.round(count * 0.6), spread: 360, startVelocity: 26, shapes: ['circle'] });
  window.confetti({ ...base, particleCount: Math.round(count * 0.4), spread: 360, startVelocity: 18, shapes: ['star'], scalar: 1.1 });
}

/** Зірочка, що пролітає дугою через екран зі шлейфом блискіток */
export function shootingStar(fromX, fromY, duration = 1300) {
  return new Promise((resolve) => {
    const { c, ctx } = fxCanvas();
    const W = innerWidth, H = innerHeight;
    const toRight = fromX < W / 2;
    const p0 = { x: fromX, y: fromY };
    const p2 = { x: toRight ? W + 40 : -40, y: H * 0.12 };
    const p1 = { x: (p0.x + p2.x) / 2, y: Math.min(p0.y, p2.y) - H * 0.35 };
    const parts = [];
    const t0 = performance.now();
    function star(x, y, r, rot) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 ? r * 0.45 : r; const a = i * Math.PI / 5 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill(); ctx.restore();
    }
    function frame(t) {
      const k = Math.min(1, (t - t0) / duration);
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      const x = (1 - e) ** 2 * p0.x + 2 * (1 - e) * e * p1.x + e * e * p2.x;
      const y = (1 - e) ** 2 * p0.y + 2 * (1 - e) * e * p1.y + e * e * p2.y;
      if (k < 1) for (let i = 0; i < 4; i++) parts.push({ x, y, vx: (Math.random() - .5) * 1.6, vy: (Math.random() - .2) * 1.6, l: 1, r: Math.random() * 2.2 + .8 });
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.l -= 0.018;
        if (p.l <= 0) continue;
        ctx.globalAlpha = p.l; ctx.fillStyle = Math.random() < .5 ? '#fff6c8' : '#ffd24a';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (k < 1) {
        ctx.shadowColor = '#ffd75a'; ctx.shadowBlur = 24; ctx.fillStyle = '#fff4b8';
        star(x, y, 16, k * 8); ctx.shadowBlur = 0;
      }
      if (k < 1 || parts.some(p => p.l > 0)) requestAnimationFrame(frame);
      else { c.remove(); }
      if (k >= 1 && !frame.done) { frame.done = true; resolve(); }
    }
    requestAnimationFrame(frame);
  });
}

/** Спалах світла в точці */
export function flash(x, y, size = 160) {
  const d = document.createElement('div');
  d.style.cssText = `position:fixed;left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;border-radius:50%;
    pointer-events:none;z-index:55;mix-blend-mode:screen;
    background:radial-gradient(circle,rgba(255,250,220,1),rgba(255,214,120,.6) 35%,rgba(255,200,80,0) 70%)`;
  document.body.appendChild(d);
  d.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.2)', opacity: 1, offset: .35 }, { transform: 'scale(1.8)', opacity: 0 }],
    { duration: 700, easing: 'ease-out' }).onfinish = () => d.remove();
}

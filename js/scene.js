// Побудова сцени календаря: дизайн «windows» (будиночок) або «tree» (ялинка).
// Використовується і на сторінці гостя, і в адмінці (mode: 'admin').
import { LAYOUT } from './layout.js';

const BASE = {
  windows: { bg: 'assets/img/bg-blue.webp', art: 'assets/img/house.webp' },
  tree: { bg: 'assets/img/bg-green.webp', art: 'assets/img/tree-empty.webp' },
};
export const CARD_BG = { windows: 'assets/img/bg-blue.webp', tree: 'assets/img/bg-green.webp' };

const pct = (v, total) => (v / total * 100).toFixed(3) + '%';
const rnd = (a, b) => a + Math.random() * (b - a);

/**
 * @param {object} o
 * @param {'windows'|'tree'} o.design
 * @param {Array<number>} o.numbers   які комірки показувати
 * @param {'guest'|'admin'} [o.mode]
 * @param {(n:number, el:HTMLElement)=>void} [o.onPick]
 */
export function buildScene({ design, numbers, mode = 'guest', onPick }) {
  const scene = document.createElement('div');
  scene.className = `scene ${design} ${mode}`;
  const bg = new Image(); bg.className = 'bg'; bg.alt = ''; bg.src = BASE[design].bg; bg.decoding = 'async';
  scene.appendChild(bg);

  const art = document.createElement('div'); art.className = 'art';
  const base = new Image(); base.className = 'base'; base.alt = ''; base.src = BASE[design].art;
  base.fetchPriority = 'high';
  art.appendChild(base);
  scene.appendChild(art);

  const L = LAYOUT[design === 'windows' ? 'house' : 'tree'];
  // вогники
  if (mode === 'guest') {
    for (const [x, y] of L.lights) {
      const d = document.createElement('i'); d.className = 'light';
      d.style.left = x + '%'; d.style.top = y + '%';
      d.style.setProperty('--d', rnd(1.6, 3.8).toFixed(2) + 's');
      d.style.setProperty('--dl', (-rnd(0, 4)).toFixed(2) + 's');
      art.appendChild(d);
    }
  }

  const items = new Map();
  const set = new Set(numbers);
  for (let n = 1; n <= 12; n++) {
    if (!set.has(n)) continue;
    const it = L.items[n];
    if (!it) continue;
    const el = document.createElement('button');
    el.type = 'button'; el.dataset.n = n;
    el.setAttribute('aria-label', `Комірка ${n}`);
    el.style.left = pct(it.x, L.w); el.style.top = pct(it.y, L.h);
    el.style.width = pct(it.w, L.w); el.style.height = pct(it.h, L.h);
    if (design === 'windows') {
      el.className = `win arch${it.arch}`;
      el.style.setProperty('--bd', rnd(2.6, 3.8).toFixed(2) + 's');
      el.style.setProperty('--bp', (-rnd(0, 3)).toFixed(2) + 's');
      el.innerHTML = `<span class="glow"></span><span class="leaf l">${it.arch === 2 ? '<i class="knob"></i>' : ''}</span>` +
        `<span class="leaf r"></span><span class="num">${n}</span>`;
    } else {
      el.className = `ball k-${it.kind}`;
      el.style.setProperty('--sd', rnd(3, 4.4).toFixed(2) + 's');
      el.style.setProperty('--sp', (-rnd(0, 4)).toFixed(2) + 's');
      el.style.setProperty('--gp', (-rnd(0, 4)).toFixed(2) + 's');
      // цифра приблизно по центру кулі (кулька — нижня частина спрайта)
      if (it.kind === 'ball') {
        const centerFromBottom = (it.y + it.h - it.cy) / it.h;
        el.style.setProperty('--nb', ((centerFromBottom * 100) - 9).toFixed(1) + '%');
      }
      el.innerHTML = `<img alt="" src="assets/balls/b${n}.webp" draggable="false"><span class="glint"></span>` +
        `<span class="num">${n}</span><span class="hang"><b>${n}</b></span>`;
    }
    if (onPick) el.addEventListener('click', (e) => { e.stopPropagation(); onPick(n, el); });
    art.appendChild(el);
    items.set(n, el);
  }

  return { scene, art, items, layout: L };
}

/** Позиція центру елемента відносно вікна */
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

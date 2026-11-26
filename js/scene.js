// Побудова сцени календаря: дизайн «windows» (будиночок) або «tree» (ялинка).
// Використовується і на сторінці гостя, і в адмінці (mode: 'admin').
import { LAYOUT } from './layout.js';

const BASE = {
  windows: { bg: 'assets/house2/bg.webp', art: 'assets/house2/bg.webp' },
  tree: { bg: 'assets/img/bg-green.webp', art: 'assets/img/tree-empty.webp' },
};
export const CARD_BG = { windows: 'assets/house2/bg.webp', tree: 'assets/img/bg-green.webp' };

// «Віконця»: картинка 1606×979 (будинок праворуч). Вікна 1–12 і двері (13) — у пікселях картинки.
export const HOUSE2 = {
  w: 1606, h: 979,
  focus: { x: 905, w: 600 },           // що має вміститися по ширині на телефоні (будинок)
  land: { x: 1215, y: 112, s: 0.42 },  // де санчата сідають на дах (центр, масштаб)
  items: {
    1: [930, 435, 972, 505], 2: [1024, 398, 1084, 466], 3: [1162, 390, 1228, 460], 4: [1310, 385, 1375, 460], 5: [1435, 410, 1473, 480],
    6: [932, 547, 973, 615], 7: [1024, 528, 1084, 600], 8: [1162, 523, 1228, 595], 9: [1312, 520, 1376, 595], 10: [1435, 530, 1476, 600],
    11: [1025, 715, 1072, 780], 12: [1338, 712, 1385, 780], 13: [1160, 705, 1245, 850],
  },
};

/** Розміщення картинки будинку у вікні: на телефоні — будинок на всю ширину, знизу; на ПК — уся картинка. */
export function layoutHouse(scene, viewX) {
  const art = scene.querySelector('.art'); if (!art) return null;
  const vw = scene.clientWidth, vh = scene.clientHeight;
  if (!vw || !vh) return null;
  const H = HOUSE2;
  const cover = Math.max(vw / H.w, vh / H.h);
  const fitFocus = vw / H.focus.w;
  const s = vw / vh >= 1.15 ? cover : Math.min(fitFocus, vh / H.h);
  const visW = vw / s;
  const focusX = Math.min(H.w - visW, Math.max(0, H.focus.x + H.focus.w / 2 - visW / 2 + (vw / vh >= 1.15 ? 0 : 0)));
  const startX = 0;
  const x = viewX == null ? focusX : viewX;
  const y = H.h - vh / s; // низ картинки — низ екрана (зверху, якщо треба, — небо)
  art.style.width = `${H.w * s}px`; art.style.height = `${H.h * s}px`;
  art.style.transform = `translate(${-x * s}px, ${-y * s}px)`;
  return { s, x, y, focusX, startX, visW };
}

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

  if (design === 'windows') return buildHouse2({ scene, art, numbers, mode, onPick });

  const L = LAYOUT.tree;
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

function buildHouse2({ scene, art, numbers, mode, onPick }) {
  scene.classList.add('house2');
  const H = HOUSE2;
  const items = new Map(); const set = new Set(numbers);
  for (let n = 1; n <= 13; n++) {
    if (!set.has(n)) continue;
    const [x0, y0, x1, y1] = H.items[n];
    const el = document.createElement('button');
    el.type = 'button'; el.dataset.n = n;
    el.setAttribute('aria-label', n === 13 ? 'Двері: лист' : `Віконце ${n}`);
    el.style.left = pct(x0, H.w); el.style.top = pct(y0, H.h);
    el.style.width = pct(x1 - x0, H.w); el.style.height = pct(y1 - y0, H.h);
    el.style.setProperty('--bd', rnd(2.6, 3.8).toFixed(2) + 's');
    el.style.setProperty('--bp', (-rnd(0, 3)).toFixed(2) + 's');
    if (n === 13) {
      el.className = 'win arch2 h2door';
      // стулка дверей — це шматок самої картинки (справжні двері з вінком)
      const bx = x0 / (H.w - (x1 - x0)) * 100, by = y0 / (H.h - (y1 - y0)) * 100;
      el.innerHTML = `<span class="glow"></span><span class="leaf l" style="background:url(${BASE.windows.bg}) ${bx.toFixed(3)}% ${by.toFixed(3)}%/${(H.w / (x1 - x0) * 100).toFixed(2)}% ${(H.h / (y1 - y0) * 100).toFixed(2)}% no-repeat"></span>` +
        `<span class="door-sign">З Новим<br>роком!</span>`;
    } else {
      el.className = `win arch1 h2win neon-${n % 2 ? 'y' : 'r'}`;
      el.innerHTML = `<span class="glow"></span><span class="leaf l"></span><span class="leaf r"></span><span class="num">${n}</span>`;
    }
    if (onPick) el.addEventListener('click', (e) => { e.stopPropagation(); onPick(n, el); });
    art.appendChild(el); items.set(n, el);
  }
  // санчата (летять у вступі, потім сидять на даху)
  const sleigh = new Image(); sleigh.className = 'h2-sleigh'; sleigh.alt = ''; sleigh.src = 'assets/house2/sleigh.webp'; sleigh.draggable = false;
  const sw = 422 * H.land.s, sh = 174 * H.land.s;
  Object.assign(sleigh.style, { left: pct(H.land.x - sw / 2, H.w), top: pct(H.land.y - sh / 2, H.h), width: pct(sw, H.w) });
  art.appendChild(sleigh);
  const relayout = () => layoutHouse(scene);
  new ResizeObserver(relayout).observe(scene);
  requestAnimationFrame(relayout);
  return { scene, art, items, layout: H, sleigh, relayout };
}

/** Позиція центру елемента відносно вікна */
export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
}

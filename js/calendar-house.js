// Сторінка отримувача для дизайну «Віконця» — 3D-будинок.
// Спершу санчата Діда Мороза летять і сідають на дах (розкадровка з редактора),
// лише потім видно весь будинок і можна відкривати віконця (1–12) та двері (лист).
import { snow, sparkleBurst, shootingStar, flash, reducedMotion } from './effects.js';
import { openCard } from './card.js';
import { createMusic } from './music.js';

const DOOR = 13;
const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const fmtDate = (iso) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };

export async function renderHouse({ app, data, code, rpc, owner }) {
  const { createHouse3D } = await import('./house3d.js');
  const cells = new Map((data.cells || []).filter((c) => c.number >= 1 && c.number <= 13).map((c) => [c.number, c]));
  document.title = data.title || 'Адвент-календар';
  document.querySelector('meta[name=theme-color]').content = '#0b1640';

  const scene = document.createElement('div');
  scene.className = 'scene page house3d';
  scene.innerHTML = `<img class="bg" src="assets/house3d/bg-night.webp" alt="">
    <div class="h3-host"></div><div class="h3-grain"></div><canvas class="snow"></canvas>`;
  const host = scene.querySelector('.h3-host');
  const houseState = new Map();
  for (const [n, c] of cells) houseState.set(n, { filled: true, opened: !!c.opened, locked: !!c.locked });

  let house;
  try {
    house = await createHouse3D(host, { mode: 'guest', cells: houseState, onPick });
  } catch (e) {
    scene.remove();
    throw e; // calendar.js покаже простішу версію
  }
  app.innerHTML = ''; app.appendChild(scene);
  snow(scene.querySelector('.snow'));

  if (data.title) { const h = document.createElement('h1'); h.className = 'cal-title'; h.textContent = data.title; scene.appendChild(h); }
  const mb = document.createElement('button'); mb.type = 'button'; mb.className = 'music-btn'; scene.appendChild(mb);
  const music = createMusic(mb);
  const dim = document.createElement('div'); dim.className = 'dim'; scene.appendChild(dim);
  if (owner) { const b = document.createElement('div'); b.className = 'owner-bar'; b.textContent = 'Перегляд власника: відкриття не зберігаються'; scene.appendChild(b); }

  // інтро: тап — пропустити
  const skip = document.createElement('div'); skip.className = 'skip-hint on'; skip.textContent = 'Торкніться, щоб пропустити'; scene.appendChild(skip);
  const onSkip = () => house.skipIntro();
  scene.addEventListener('pointerdown', onSkip);
  if (reducedMotion()) house.skipIntro();
  await house.ready;
  scene.removeEventListener('pointerdown', onSkip);
  skip.classList.remove('on');

  if (cells.size) {
    const tip = document.createElement('div'); tip.className = 'start-hint';
    tip.textContent = cells.has(DOOR) ? '👆 Натисни на віконце з цифрою або на двері' : '👆 Натисни на віконце з цифрою';
    scene.appendChild(tip);
    const hide = () => tip.classList.add('gone');
    setTimeout(hide, 6500); scene.addEventListener('pointerdown', hide, { once: true });
  } else {
    const p = document.createElement('div'); p.className = 'cal-empty'; p.textContent = 'Тут поки що порожньо ✨'; scene.appendChild(p);
  }

  let busy = false;
  function lockedTip(n, cell) {
    house.shake(n);
    const pos = house.screenPos(n) || { x: innerWidth / 2, y: innerHeight / 2 };
    const tip = document.createElement('div'); tip.className = 'locked-tip';
    tip.textContent = `Відкриється ${fmtDate(cell.open_at)}`;
    tip.style.position = 'fixed'; tip.style.top = `${pos.y - 20}px`;
    document.body.appendChild(tip);
    const half = tip.offsetWidth / 2 + 8;
    tip.style.left = `${Math.min(innerWidth - half, Math.max(half, pos.x))}px`;
    tip.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.85 }, { opacity: 0 }], { duration: 2200 }).onfinish = () => tip.remove();
  }

  async function onPick(n) {
    if (busy || !house?.introDone) return;
    const cell = cells.get(n);
    if (!cell) return;
    if (cell.locked) return lockedTip(n, cell);
    busy = true;
    if (!cell.opened && !owner) rpc('open_cell', { p_code: code, p_number: n }).catch(() => {});
    cell.opened = true;
    const pos = house.screenPos(n) || { x: innerWidth / 2, y: innerHeight / 2 };
    if (reducedMotion()) {
      await house.setOpened(n, true, false);
    } else {
      house.flash(n);
      flash(pos.x, pos.y, n === DOOR ? 220 : 140);
      await house.setOpened(n, true, true);
      // зірочки летять із вікна
      sparkleBurst(pos.x, pos.y, { count: 70 });
      shootingStar(pos.x, pos.y, 1100);
      await new Promise((r) => setTimeout(r, 650));
    }
    dim.classList.add('on');
    openCard({
      design: 'windows', cell: { ...cell, number: n, kind: n === DOOR ? 'letter' : cell.kind }, from: pos,
      onMedia: (p) => (p ? music.hold() : music.release()),
      onClose: () => { dim.classList.remove('on'); busy = false; },
    });
  }
}

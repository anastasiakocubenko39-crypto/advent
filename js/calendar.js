// Сторінка отримувача: /?c=<код>
import { buildScene, centerOf } from './scene.js';
import { snow, sparkleBurst, shootingStar, flash, reducedMotion } from './effects.js';
import { openCard } from './card.js';
import { createMusic } from './music.js';
import { Squirrel } from './squirrel.js';

const C = window.ADVENT_CONFIG;
const app = document.getElementById('app');
const code = new URLSearchParams(location.search).get('c') || '';

const MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
const fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]}`; };
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

function notFound(text = 'Такого календаря не існує') {
  document.title = 'Адвент-календар';
  app.innerHTML = `<div class="msg-page"><img class="bg" src="assets/img/bg-blue.webp" alt=""><canvas class="snow"></canvas>
    <div class="msg-box"><div class="msg-ico">❄</div><h1>${text}</h1><p>Перевірте посилання або QR-код.</p></div></div>`;
  snow(app.querySelector('.snow'));
}

async function rpc(fn, args) {
  const r = await fetch(`${C.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: C.SUPABASE_KEY, Authorization: `Bearer ${C.SUPABASE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`${fn}: ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function main() {
  if (!/^[A-Za-z0-9]{24}$/.test(code)) return notFound();
  let data;
  try { data = await rpc('open_calendar', { p_code: code, p_today: todayLocal() }); }
  catch (e) { console.error(e); return notFound('Не вдалося завантажити календар'); }
  if (!data) return notFound();
  render(data);
}

function render(data) {
  const design = data.design === 'tree' ? 'tree' : 'windows';
  const cells = new Map((data.cells || []).map((c) => [c.number, c]));
  document.title = data.title || 'Адвент-календар';
  document.querySelector('meta[name=theme-color]').content = design === 'tree' ? '#0e3b26' : '#0b2350';

  let busy = false;
  let current = null; // активна анімація (для пропуску)
  const { scene, art, items } = buildScene({ design, numbers: [...cells.keys()], mode: 'guest', onPick });
  scene.classList.add('page');
  const cv = document.createElement('canvas'); cv.className = 'snow'; scene.appendChild(cv);
  app.innerHTML = ''; app.appendChild(scene);
  snow(cv);

  if (data.title) {
    const h = document.createElement('h1'); h.className = 'cal-title'; h.textContent = data.title; scene.appendChild(h);
  }
  const mb = document.createElement('button'); mb.type = 'button'; mb.className = 'music-btn'; scene.appendChild(mb);
  const music = createMusic(mb);
  const dim = document.createElement('div'); dim.className = 'dim'; scene.appendChild(dim);
  const hint = document.createElement('div'); hint.className = 'skip-hint'; hint.textContent = 'Торкніться, щоб пропустити'; scene.appendChild(hint);

  // стан «вже відкрито»
  for (const [n, c] of cells) if (c.opened) markOpened(n, false);

  if (!cells.size) {
    const p = document.createElement('div'); p.className = 'cal-empty'; p.textContent = 'Тут поки що порожньо ✨'; scene.appendChild(p);
  }

  // пропуск анімації: тап по екрану
  scene.addEventListener('pointerdown', () => { if (busy && current) current.skip(); });

  function markOpened(n, animate = true) {
    const el = items.get(n); if (!el) return;
    el.classList.add('opened');
    if (design === 'windows') el.classList.add('open');
    else if (el.classList.contains('k-ball')) el.classList.add('taken');
  }

  function showCard(n, from) {
    const cell = cells.get(n);
    dim.classList.add('on');
    openCard({
      design, cell: { ...cell, number: n }, from,
      onMedia: (p) => (p ? music.hold() : music.release()),
      onClose: () => { dim.classList.remove('on'); art.classList.remove('focus'); busy = false; items.get(n)?.focus({ preventScroll: true }); },
    });
  }

  function lockedTip(el, cell) {
    el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
    setTimeout(() => el.classList.remove('shake'), 500);
    const c = centerOf(el);
    const tip = document.createElement('div'); tip.className = 'locked-tip';
    tip.textContent = `Відкриється ${fmtDate(cell.open_at)}`;
    tip.style.top = `${c.y - c.h / 2}px`; tip.style.position = 'fixed';
    document.body.appendChild(tip);
    const half = tip.offsetWidth / 2 + 8;
    tip.style.left = `${Math.min(innerWidth - half, Math.max(half, c.x))}px`;
    tip.animate([{ opacity: 0 }, { opacity: 1, offset: .15 }, { opacity: 1, offset: .85 }, { opacity: 0 }], { duration: 2200 }).onfinish = () => tip.remove();
  }

  function onPick(n, el) {
    if (busy) return;
    const cell = cells.get(n);
    if (!cell) return;
    if (cell.locked) return lockedTip(el, cell);
    const already = el.classList.contains('opened');
    busy = true;
    if (!already) rpc('open_cell', { p_code: code, p_number: n }).catch(() => {});
    if (already || reducedMotion()) {
      markOpened(n);
      const c = centerOf(el);
      return showCard(n, c);
    }
    current = design === 'windows' ? animWindow(n, el) : animBall(n, el);
  }

  // ---------- Дизайн А: віконце ----------
  function animWindow(n, el) {
    const g = window.gsap;
    const c = centerOf(el);
    const leaves = el.querySelectorAll('.leaf');
    const tl = g.timeline({ onComplete: done });
    let finished = false;
    function done() { if (finished) return; finished = true; hint.classList.remove('on'); showCard(n, c); }
    el.querySelectorAll('.leaf').forEach((l) => (l.style.animation = 'none'));
    tl.to(el, { filter: 'brightness(1.5) drop-shadow(0 0 10px #ffd75a)', duration: .1 })
      .to(el, { x: -3, duration: .04, repeat: 4, yoyo: true }, '<')
      .set(el, { x: 0 })
      .call(() => { el.classList.add('open', 'opened'); flash(c.x, c.y, Math.max(c.w, c.h) * 2.6); })
      .fromTo(leaves[0], { rotationY: 0 }, { rotationY: el.classList.contains('arch2') ? -96 : -104, duration: .6, ease: 'back.out(1.4)' })
      .fromTo(leaves[1], { rotationY: 0 }, { rotationY: 104, duration: .6, ease: 'back.out(1.4)' }, '<')
      .call(() => {
        if (Math.random() < .5) sparkleBurst(c.x, c.y, { count: 70 });
        else shootingStar(c.x, c.y, 1100);
      })
      .to(el, { filter: 'none', duration: .3 })
      .to({}, { duration: .55 })
      .call(() => dim.classList.add('on'));
    setTimeout(() => busy && !finished && hint.classList.add('on'), 600);
    return { skip() { tl.progress(1); leaves.forEach((l) => g.set(l, { clearProps: 'transform' })); } };
  }

  // ---------- Дизайн Б, комірка 12: подарунок відкривається на місці ----------
  function animGift(n, el) {
    const g = window.gsap;
    const r = el.getBoundingClientRect();
    const W = innerWidth, H = innerHeight;
    const img = el.querySelector('img');
    const cut = 36; // кришка з бантом — верхні 36% спрайта
    const mouth = { x: r.left + r.width / 2, y: r.top + r.height * (cut / 100) };

    el.style.animation = 'none';
    const fly = document.createElement('div'); fly.className = 'fly-ball';
    fly.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    fly.innerHTML = `<div class="beam"></div><img class="bot" src="${img.src}" style="clip-path:inset(${cut - 1}% 0 0 0)">
      <img class="top" src="${img.src}" style="clip-path:inset(0 0 ${100 - cut}% 0);transform-origin:50% ${cut}%">`;
    const beam = fly.querySelector('.beam'), lid = fly.querySelector('.top');
    beam.style.cssText = `position:absolute;left:10%;right:10%;bottom:${100 - cut}%;height:0;border-radius:50% 50% 0 0;
      background:linear-gradient(0deg,rgba(255,236,170,.95),rgba(255,214,110,.5) 50%,rgba(255,214,110,0));mix-blend-mode:screen;filter:blur(4px)`;

    const sqSize = Math.round(Math.min(Math.max(r.width * 0.75, 110), 170));
    const sq = new Squirrel(sqSize);
    const fromLeft = mouth.x >= W / 2 ? false : true;
    const side = fromLeft ? -1 : 1; // з якого боку від подарунка стоїть білочка
    sq.face(fromLeft ? 1 : -1);
    const groundY = Math.min(H - sqSize * 0.45, r.bottom - sqSize * 0.42);
    sq.place(fromLeft ? -sqSize : W + sqSize, groundY);
    const standX = Math.max(sqSize * 0.45, Math.min(W - sqSize * 0.45, mouth.x + side * (r.width * 0.5 + sqSize * 0.25)));

    let finished = false;
    const tl = g.timeline({ onComplete: done });
    function done() {
      if (finished) return; finished = true; hint.classList.remove('on');
      el.classList.add('opened'); el.style.visibility = ''; el.style.animation = '';
      g.set(el, { clearProps: 'filter,transform' });
      showCard(n, mouth);
      sq.wave();
      g.timeline()
        .to({}, { duration: .55 })
        .call(() => { sq.face(fromLeft ? -1 : 1); sq.run(); })
        .to(sq.el, { x: fromLeft ? -sqSize * 1.5 : W + sqSize, duration: .6, ease: 'power1.in' })
        .call(() => sq.remove());
      g.to(fly, { opacity: 0, duration: .4, onComplete: () => fly.remove() });
    }
    tl
      // 1. подарунок підстрибує і світиться
      .to(el, { filter: 'brightness(1.35) drop-shadow(0 0 14px #ffe28a)', duration: .15 })
      .call(() => { document.body.appendChild(fly); el.style.visibility = 'hidden'; })
      // 2. прибігає білочка
      .call(() => sq.run())
      .to(sq.el, { x: standX - sqSize / 2, duration: .7, ease: 'power2.out' })
      .call(() => { sq.face(-side); sq.hold(); })
      // 3. подарунок тремтить
      .to(fly, { rotation: -4, duration: .07, repeat: 5, yoyo: true, transformOrigin: '50% 100%' })
      .set(fly, { rotation: 0 })
      .to(fly, { y: -10, duration: .12, yoyo: true, repeat: 1, ease: 'power2.out' })
      // 4. кришка з бантом злітає, з коробки — світло й блискітки
      .to(lid, { y: -r.height * 0.9, x: -side * r.width * 0.25, rotation: -side * 28, duration: .55, ease: 'power2.out' })
      .to(lid, { opacity: 0, duration: .35 }, '-=.15')
      .to(beam, { height: Math.min(H * 0.5, r.height * 2.2), duration: .45, ease: 'power2.out' }, '<-.4')
      .call(() => { flash(mouth.x, mouth.y, r.width * 1.6); sparkleBurst(mouth.x, mouth.y, { count: 80 }); }, null, '<')
      .call(() => art.classList.add('focus'), null, '<.2')
      .to({}, { duration: .45 });
    setTimeout(() => busy && !finished && hint.classList.add('on'), 700);
    return { skip() { tl.progress(1); } };
  }

  // ---------- Дизайн Б: кулька + білочка ----------
  function animBall(n, el) {
    const g = window.gsap;
    if (el.classList.contains('k-gift')) return animGift(n, el);
    const r = el.getBoundingClientRect();
    const c = centerOf(el);
    const img = el.querySelector('img');
    const W = innerWidth, H = innerHeight;
    const isBall = el.classList.contains('k-ball');

    // «літаюча» копія кульки з двох половинок
    const fly = document.createElement('div'); fly.className = 'fly-ball';
    fly.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    const cut = isBall ? 52 : 40;
    fly.innerHTML = `<img class="bot" src="${img.src}" style="clip-path:inset(${cut}% 0 0 0)">
      <img class="top" src="${img.src}" style="clip-path:inset(0 0 ${100 - cut}% 0);transform-origin:8% ${cut}%">`;

    const sqSize = Math.round(Math.min(Math.max(r.width * 2.6, 110), 190));
    const sq = new Squirrel(sqSize);
    const fromLeft = c.x < W / 2;
    sq.face(fromLeft ? 1 : -1);
    const startX = fromLeft ? -sqSize : W + sqSize;
    sq.place(startX, Math.min(H - sqSize / 2, c.y + sqSize * .35));
    const paw = () => sq.pawOffset();

    const target = { x: W / 2, y: H * 0.42 };
    const scale = Math.min(2.4, (Math.min(W, H) * 0.34) / r.width);
    let finished = false;
    const tl = g.timeline({ onComplete: done });
    function done() {
      if (finished) return; finished = true; hint.classList.remove('on');
      const fc = centerOf(fly);
      showCard(n, fc);
      // білочка махає і тікає
      sq.wave();
      g.timeline()
        .to({}, { duration: .5 })
        .call(() => { sq.face(fromLeft ? -1 : 1); sq.run(); })
        .to(sq.el, { x: fromLeft ? -sqSize * 1.5 : W + sqSize, duration: .6, ease: 'power1.in' })
        .call(() => sq.remove());
      g.to(fly, { opacity: 0, scale: .6, duration: .35, onComplete: () => fly.remove() });
    }
    el.style.animation = 'none';
    tl
      // 1. кулька гойднулась і засвітилась
      .to(el, { rotation: 18, duration: .12, ease: 'power2.out' })
      .to(el, { rotation: -14, duration: .16 })
      .to(el, { rotation: 0, duration: .14, filter: 'brightness(1.5) drop-shadow(0 0 12px #ffe28a)' })
      // 2. білочка вибігає
      .call(() => sq.run(), null, '<')
      .to(sq.el, { x: c.x - paw().x - sqSize / 2, y: c.y - paw().y - sqSize / 2, duration: .75, ease: 'power2.out' }, '<')
      .call(() => {
        sq.hold();
        document.body.appendChild(fly);
        el.style.visibility = 'hidden';
        if (isBall) el.classList.add('taken', 'opened'); else el.classList.add('opened');
      })
      // 3. несе до центру, камера наближається, ялинка розмита
      .call(() => art.classList.add('focus'))
      .call(() => { sq.run(); sq.face(target.x >= c.x ? 1 : -1); })
      .to(fly, { left: target.x - r.width / 2, top: target.y - r.height / 2, scale, duration: .85, ease: 'power2.inOut' }, '>')
      .to(sq.el, {
        x: () => target.x - (target.x >= c.x ? 1 : -1) * r.width * scale * .62 - sqSize / 2,
        y: target.y + r.height * scale * .18 - sqSize / 2, duration: .85, ease: 'power2.inOut',
      }, '<')
      .call(() => { sq.face(1 * (target.x >= c.x ? 1 : -1)); sq.hold(); })
      // 4. відкриває: «кришечка» відкидається + спалах
      .to(fly.querySelector('.top'), { rotation: -125, x: -r.width * .25, y: -r.height * .35, duration: .5, ease: 'back.out(1.6)' }, '+=.15')
      .call(() => { const fc = centerOf(fly); flash(fc.x, fc.y, r.width * scale * 2); sparkleBurst(fc.x, fc.y, { count: 70 }); }, null, '<.1')
      .to({}, { duration: .35 })
      .call(() => { el.style.visibility = ''; g.set(el, { clearProps: 'filter,rotation,transform' }); el.style.animation = ''; });
    setTimeout(() => busy && !finished && hint.classList.add('on'), 700);
    return {
      skip() {
        tl.progress(1);
        el.style.visibility = ''; el.style.animation = '';
      },
    };
  }
}

main();

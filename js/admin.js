// Адмінка: вхід, список календарів, редактор, форма комірки, «Готово» (посилання, QR, PDF).
import { buildScene } from './scene.js';
import { openCard, publicUrl, qrSvg, qrCanvas } from './card.js';
import { sparkleBurst } from './effects.js';

const C = window.ADVENT_CONFIG;
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
const view = document.getElementById('view');
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const DESIGN_NAME = { windows: 'Віконця', tree: 'Ялинка' };
const KIND_NAME = { photo: 'Фото', video: 'Відео', qr: 'QR-код' };
const MB = 1024 * 1024;
let session = null;

// ---------- утиліти ----------
function toast(msg, type = '') {
  const t = $('#toast'); t.textContent = msg; t.className = `show ${type}`;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.className = ''), 3200);
}
function randomCode(len = 24) {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const a = new Uint32Array(len); crypto.getRandomValues(a);
  return Array.from(a, (x) => abc[x % abc.length]).join('');
}
const fmtSize = (b) => (b >= MB ? (b / MB).toFixed(1) + ' МБ' : Math.max(1, Math.round(b / 1024)) + ' КБ');
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
function guestLink(code) {
  const base = location.href.split('#')[0].split('?')[0].replace(/admin\.html$/, '');
  return `${base}?c=${code}`;
}
function errText(e) {
  const m = (e && (e.message || e.error_description || e.error)) || String(e);
  if (/Invalid login credentials/i.test(m)) return 'Невірний логін або пароль';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Немає зʼєднання з сервером';
  if (/exceeded the maximum allowed size|Payload too large|413/i.test(m)) return 'Файл завеликий для сховища';
  return m;
}
function confirmDlg(text, okText = 'Так', danger = false) {
  return new Promise((res) => {
    const d = document.createElement('div'); d.className = 'modal-wrap';
    d.innerHTML = `<div class="modal small" role="alertdialog" aria-modal="true"><p class="confirm-text">${esc(text)}</p>
      <div class="row end"><button type="button" class="btn ghost" data-a="no">Скасувати</button>
      <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-a="ok">${esc(okText)}</button></div></div>`;
    document.body.appendChild(d);
    const close = (v) => { d.remove(); res(v); };
    d.addEventListener('click', (e) => { const a = e.target.dataset.a; if (a) close(a === 'ok'); else if (e.target === d) close(false); });
    d.querySelector('[data-a=ok]').focus();
  });
}

// ---------- вхід ----------
async function init() {
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((_e, s) => { session = s; });
  window.addEventListener('hashchange', route);
  $('#logout').addEventListener('click', async () => { await sb.auth.signOut(); session = null; location.hash = '#/'; route(); });
  route();
}

function showWho() {
  const w = $('.who');
  if (session) { w.hidden = false; $('#who').textContent = (session.user.email || '').replace('@' + C.LOGIN_DOMAIN, ''); }
  else w.hidden = true;
}

function renderLogin() {
  showWho();
  view.innerHTML = `<form class="login card" autocomplete="on">
    <h1>Вхід</h1>
    <label>Логін<input name="login" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>
    <label>Пароль<input name="password" type="password" autocomplete="current-password" required></label>
    <p class="err" hidden></p>
    <button class="btn primary big" type="submit">Увійти</button>
  </form>`;
  const f = $('form', view);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const login = f.login.value.trim().toLowerCase(), pass = f.password.value;
    const btn = $('button', f); btn.disabled = true; btn.textContent = 'Вхід…';
    const { data, error } = await sb.auth.signInWithPassword({ email: login.includes('@') ? login : `${login}@${C.LOGIN_DOMAIN}`, password: pass });
    btn.disabled = false; btn.textContent = 'Увійти';
    if (error) { const p = $('.err', f); p.hidden = false; p.textContent = errText(error); return; }
    session = data.session; route();
  });
  f.login.focus();
}

// ---------- маршрути ----------
async function route() {
  if (!session) return renderLogin();
  showWho();
  const h = location.hash.replace(/^#/, '');
  const m = h.match(/^\/c\/([A-Za-z0-9]{24})(\/share)?$/);
  if (m) return renderEditor(m[1], !!m[2]);
  return renderList();
}

// ---------- список ----------
async function renderList() {
  view.innerHTML = `<div class="list-head"><h1>Мої календарі</h1><button type="button" class="btn primary" id="new">+ Новий календар</button></div>
    <div id="cals" class="cals"><div class="spinner"></div></div>`;
  $('#new').addEventListener('click', createCalendar);
  const { data, error } = await sb.from('calendars').select('code,name,title,design,status,views,created_at,ready_at,cells(number,kind,opened_at)').order('created_at', { ascending: false });
  const box = $('#cals');
  if (error) { box.innerHTML = `<p class="err">${esc(errText(error))}</p>`; return; }
  if (!data.length) { box.innerHTML = `<div class="empty card"><div style="font-size:42px">🎁</div><p>Ще немає жодного календаря.</p></div>`; return; }
  box.innerHTML = data.map((c) => {
    const filled = c.cells.length, opened = c.cells.filter((x) => x.opened_at).length;
    return `<article class="cal card" data-code="${c.code}">
      <div class="cal-prev ${c.design}"><img src="assets/img/${c.design === 'tree' ? 'tree' : 'house'}.webp" alt=""></div>
      <div class="cal-info">
        <h2>${esc(c.name || 'Без назви')}</h2>
        <div class="meta"><span class="pill">${DESIGN_NAME[c.design]}</span>
          <span class="pill ${filled === 12 ? 'ok' : ''}">${filled}/12</span>
          <span class="pill ${c.status === 'ready' ? 'ready' : 'draft'}">${c.status === 'ready' ? 'Готово' : 'Чернетка'}</span></div>
        ${c.status === 'ready' ? `<div class="stats">👁 ${c.views} · відкрито ${opened} з ${filled}</div>` : ''}
        <div class="row wrap">
          <a class="btn" href="#/c/${c.code}">Редагувати</a>
          ${c.status === 'ready' ? `<a class="btn" href="#/c/${c.code}/share">Посилання / QR</a>` : ''}
          <button type="button" class="btn ghost danger-t" data-del="${c.code}">Видалити</button>
        </div>
      </div></article>`;
  }).join('');
  box.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const card = b.closest('.cal'); const name = $('h2', card).textContent;
    if (!(await confirmDlg(`Видалити календар «${name}» разом з усіма фото й відео? Посилання перестане працювати.`, 'Видалити', true))) return;
    try { await deleteCalendar(b.dataset.del); card.remove(); toast('Календар видалено'); }
    catch (e) { toast(errText(e), 'bad'); }
  }));
}

async function createCalendar() {
  const code = randomCode();
  const { error } = await sb.from('calendars').insert({ code, name: 'Новий календар', design: 'windows', status: 'draft', owner_id: session.user.id });
  if (error) return toast(errText(error), 'bad');
  location.hash = `#/c/${code}`;
}

async function deleteCalendar(code) {
  const { data: cells } = await sb.from('cells').select('file_path').eq('calendar_code', code);
  const files = (cells || []).map((c) => c.file_path).filter(Boolean);
  if (files.length) await sb.storage.from(C.BUCKET).remove(files);
  const { error } = await sb.from('calendars').delete().eq('code', code);
  if (error) throw error;
}

// ---------- редактор ----------
async function renderEditor(code, openShareNow) {
  view.innerHTML = '<div class="spinner"></div>';
  const { data: cal, error } = await sb.from('calendars').select('*').eq('code', code).maybeSingle();
  if (error || !cal) { view.innerHTML = `<p class="err card">Календар не знайдено. <a href="#/">До списку</a></p>`; return; }
  const { data: cellRows } = await sb.from('cells').select('*').eq('calendar_code', code);
  const cells = new Map((cellRows || []).map((c) => [c.number, c]));
  const st = { cal, cells };

  view.innerHTML = `
    <div class="ed-head"><a class="btn ghost" href="#/">← Усі календарі</a><span class="saved" id="saved"></span></div>
    <div class="editor">
      <section class="card ed-side">
        <label>Назва календаря <small>(бачите тільки ви)</small><input id="f-name" maxlength="80" value="${esc(cal.name)}" placeholder="Для мами"></label>
        <label>Заголовок для отримувача <small>(необовʼязково)</small><input id="f-title" maxlength="80" value="${esc(cal.title || '')}" placeholder="З Новим роком, мамо!"></label>
        <div class="lbl">Дизайн</div>
        <div class="designs" role="radiogroup" aria-label="Дизайн">
          ${['windows', 'tree'].map((d) => `<button type="button" role="radio" class="design-card ${d}" data-d="${d}">
            <span class="dc-img"><img src="assets/img/${d === 'tree' ? 'bg-green' : 'bg-blue'}.webp" alt=""><img class="fg" src="assets/img/${d === 'tree' ? 'tree' : 'house'}.webp" alt=""></span>
            <span>${DESIGN_NAME[d]}</span></button>`).join('')}
        </div>
        <p class="hint" id="design-hint"></p>
        <div class="progress-line"><span id="filled"></span></div>
        <div id="stats" class="stats-box"></div>
        <button type="button" class="btn primary big" id="done"></button>
        <div id="ready-box"></div>
      </section>
      <section class="ed-grid">
        <p class="hint center">Натисніть на ${cal.design === 'tree' ? 'кульку' : 'віконце'}, щоб заповнити комірку</p>
        <div class="grid-box" id="grid"></div>
      </section>
    </div>`;

  // назва/заголовок — автозбереження
  let saveT;
  const saveFields = () => {
    clearTimeout(saveT);
    saveT = setTimeout(async () => {
      const patch = { name: $('#f-name').value.trim() || 'Без назви', title: $('#f-title').value.trim() || null };
      const { error } = await sb.from('calendars').update(patch).eq('code', code);
      if (error) return toast(errText(error), 'bad');
      Object.assign(st.cal, patch); flashSaved();
    }, 600);
  };
  $('#f-name').addEventListener('input', saveFields);
  $('#f-title').addEventListener('input', saveFields);

  view.querySelectorAll('.design-card').forEach((b) => b.addEventListener('click', async () => {
    if (st.cal.status === 'ready' || b.dataset.d === st.cal.design) return;
    const { error } = await sb.from('calendars').update({ design: b.dataset.d }).eq('code', code);
    if (error) return toast(errText(error), 'bad');
    st.cal.design = b.dataset.d; flashSaved(); refresh();
  }));
  $('#done').addEventListener('click', () => markReady(st, refresh));

  function refresh() {
    const ready = st.cal.status === 'ready';
    view.querySelectorAll('.design-card').forEach((b) => {
      const on = b.dataset.d === st.cal.design;
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on); b.disabled = ready && !on;
    });
    $('#design-hint').textContent = ready ? 'Дизайн зафіксовано після «Готово».' : 'Дизайн можна змінити до натискання «Готово».';
    $('.ed-grid .hint').textContent = `Натисніть на ${st.cal.design === 'tree' ? 'кульку' : 'віконце'}, щоб заповнити комірку`;
    const filled = st.cells.size;
    $('#filled').innerHTML = `Заповнено <b>${filled}</b> з 12<i style="width:${filled / 12 * 100}%"></i>`;
    const doneBtn = $('#done');
    doneBtn.hidden = ready; doneBtn.textContent = '✓ Готово'; doneBtn.disabled = filled === 0;
    doneBtn.title = filled === 0 ? 'Заповніть хоча б одну комірку' : '';
    // статистика
    const opened = [...st.cells.values()].filter((c) => c.opened_at).map((c) => c.number).sort((a, b) => a - b);
    $('#stats').innerHTML = ready ? `<div>👁 Календар відкривали: <b>${st.cal.views}</b> раз(и)</div>
      <div>🎁 Відкриті комірки: ${opened.length ? opened.map((n) => `<span class="pill ok">${n}</span>`).join(' ') : '<i>ще жодної</i>'}</div>` : '';
    $('#ready-box').innerHTML = ready ? readyBlockHTML(st.cal) : '';
    if (ready) bindReadyBlock(st.cal);
    // сітка у вигляді дизайну
    const grid = $('#grid'); grid.innerHTML = '';
    const { scene, items } = buildScene({ design: st.cal.design, numbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], mode: 'admin',
      onPick: (n) => openCellForm(st, n, refresh) });
    for (const [n, el] of items) {
      const c = st.cells.get(n);
      el.classList.toggle('empty', !c);
      const mk = document.createElement('span');
      if (!c) { mk.className = 'mark empty'; mk.textContent = '+'; }
      else { mk.className = 'mark done'; mk.textContent = c.opened_at ? '👁' : '✓'; }
      el.appendChild(mk);
      if (c) {
        if (c.kind === 'photo' && c.file_path) { const t = new Image(); t.className = 'thumb'; t.loading = 'lazy'; t.src = publicUrl(c.file_path); t.alt = ''; el.appendChild(t); }
        else { const t = document.createElement('span'); t.className = 'thumb ico'; t.textContent = c.kind === 'video' ? '🎬' : '▦'; el.appendChild(t); }
        if (c.open_at) { const d = document.createElement('span'); d.className = 'date-badge'; d.textContent = c.open_at.slice(8, 10) + '.' + c.open_at.slice(5, 7); el.appendChild(d); }
        el.setAttribute('aria-label', `Комірка ${n}: ${KIND_NAME[c.kind]}`);
      } else el.setAttribute('aria-label', `Комірка ${n}: порожня`);
    }
    grid.appendChild(scene);
  }
  refresh();
  if (openShareNow && st.cal.status === 'ready') setTimeout(() => $('#ready-box').scrollIntoView({ behavior: 'smooth', block: 'center' }), 200);
}

function flashSaved() { const s = $('#saved'); if (!s) return; s.textContent = 'Збережено ✓'; s.classList.add('on'); clearTimeout(flashSaved.t); flashSaved.t = setTimeout(() => s.classList.remove('on'), 1500); }

async function markReady(st, refresh) {
  const filled = st.cells.size;
  if (!filled) return;
  if (filled < 12 && !(await confirmDlg(`Заповнено ${filled} з 12, продовжити? Порожні комірки отримувач не побачить.`, 'Продовжити'))) return;
  const patch = { status: 'ready', ready_at: new Date().toISOString() };
  const { error } = await sb.from('calendars').update(patch).eq('code', st.cal.code);
  if (error) return toast(errText(error), 'bad');
  Object.assign(st.cal, patch);
  refresh();
  const b = $('#ready-box').getBoundingClientRect();
  sparkleBurst(b.left + b.width / 2, Math.min(innerHeight - 80, b.top + 60), { count: 80 });
  $('#ready-box').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function readyBlockHTML(cal) {
  const link = guestLink(cal.code);
  return `<div class="ready">
    <h3>🎉 Календар готовий</h3>
    <div class="lbl">Посилання для отримувача</div>
    <div class="copy-row"><input readonly id="link" value="${esc(link)}"><button type="button" class="btn primary" id="copy">Копіювати</button></div>
    <div class="qr-big" id="qr">${qrSvg(link)}</div>
    <div class="row wrap center">
      <button type="button" class="btn" id="dl-png">⬇ QR-код (PNG)</button>
      <button type="button" class="btn" id="dl-pdf">⬇ Листівка A5 (PDF)</button>
      <a class="btn ghost" href="${esc(link)}" target="_blank" rel="noopener">Відкрити ↗</a>
    </div>
    <p class="hint">Комірки можна редагувати й далі — посилання і QR не зміняться.</p></div>`;
}
function bindReadyBlock(cal) {
  const link = guestLink(cal.code);
  $('#copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); } catch { $('#link').select(); document.execCommand('copy'); }
    toast('Посилання скопійовано');
  });
  $('#dl-png').addEventListener('click', () => {
    const c = qrCanvas(link, 1200);
    c.toBlob((b) => saveBlob(b, `qr-${slug(cal.name)}.png`), 'image/png');
  });
  $('#dl-pdf').addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true; const t = btn.textContent; btn.textContent = 'Готую PDF…';
    try { await makePdf(cal, link); } catch (err) { console.error(err); toast('Не вдалося створити PDF', 'bad'); }
    btn.disabled = false; btn.textContent = t;
  });
}
const slug = (s) => (s || 'calendar').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'calendar';
function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

async function makePdf(cal, link) {
  // A5 при 300 dpi: 1748 × 2480 px — малюємо листівку на canvas, потім кладемо в PDF
  await Promise.all([document.fonts.load('700 120px Caveat'), document.fonts.load('600 40px Montserrat')]);
  const W = 1748, H = 2480;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const tree = cal.design === 'tree';
  const [bg, art] = await Promise.all([loadImg(`assets/img/${tree ? 'bg-green' : 'bg-blue'}.webp`), loadImg(`assets/img/${tree ? 'tree' : 'house'}.webp`)]);
  const s = Math.max(W / bg.width, H / bg.height);
  x.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
  x.fillStyle = 'rgba(0,0,0,.12)'; x.fillRect(0, 0, W, H);
  // заголовок
  x.textAlign = 'center'; x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 24;
  x.font = '700 150px Caveat'; x.fillText(cal.title || 'Адвент-календар', W / 2, 270, W - 160);
  x.font = '600 52px Montserrat'; x.fillText('Сюрпризи вже чекають на тебе', W / 2, 380, W - 160);
  x.shadowBlur = 0;
  // малюнок
  const aw = 900, ah = aw * art.height / art.width;
  x.drawImage(art, (W - aw) / 2, 450, aw, ah);
  // QR на білій плашці
  const q = 740, qx = (W - q) / 2, qy = 1500;
  x.fillStyle = '#fff'; x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 40;
  roundRect(x, qx - 50, qy - 50, q + 100, q + 100, 60); x.fill(); x.shadowBlur = 0;
  x.drawImage(qrCanvas(link, 1200), qx, qy, q, q);
  x.fillStyle = '#fff'; x.font = '600 50px Montserrat'; x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 16;
  x.fillText('Наведи камеру телефона на QR-код', W / 2, H - 70);
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a5' });
  pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 148, 210);
  pdf.save(`advent-${slug(cal.name)}.pdf`);
}
function roundRect(x, l, t, w, h, r) { x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }

// ---------- форма комірки ----------
function openCellForm(st, n, refresh) {
  const orig = st.cells.get(n) || null;
  const f = {
    kind: orig?.kind || 'photo',
    file: orig?.file_path ? { path: orig.file_path, mime: orig.mime, size: orig.size, duration: orig.duration, src: publicUrl(orig.file_path), uploaded: true, orig: true } : null,
    link_url: orig?.link_url || '', link_label: orig?.link_label || 'Відкрити подарунок',
    letter: orig?.letter || '', letter_from: orig?.letter_from || '', open_at: orig?.open_at || '',
  };
  const pendingUploads = new Set(); // шляхи, завантажені в цій формі
  let uploading = null;

  const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
  wrap.innerHTML = `<form class="modal cell-form" role="dialog" aria-modal="true" aria-label="Комірка ${n}" novalidate>
    <div class="mh"><h2>Комірка ${n}</h2><button type="button" class="x" data-act="cancel" aria-label="Закрити">✕</button></div>
    <div class="seg" role="tablist">
      ${['photo', 'video', 'qr'].map((k) => `<button type="button" role="tab" data-k="${k}">${KIND_NAME[k]}${k === 'qr' ? ' за посиланням' : ''}</button>`).join('')}
    </div>
    <div class="pane pane-file">
      <label class="drop" tabindex="0"><input type="file" hidden>
        <div class="drop-preview"></div>
        <div class="drop-text"></div>
      </label>
      <div class="up-progress" hidden><i></i><span></span></div>
      <p class="hint file-hint"></p>
    </div>
    <div class="pane pane-qr">
      <label>Посилання<input name="link_url" type="url" inputmode="url" placeholder="https://…" value="${esc(f.link_url)}"></label>
      <label>Текст кнопки<input name="link_label" maxlength="40" value="${esc(f.link_label)}"></label>
      <div class="qr-prev"></div>
    </div>
    <label>Підпис-лист <span class="cnt"></span>
      <textarea name="letter" rows="5" maxlength="1000" placeholder="Дорога мамо, …">${esc(f.letter)}</textarea></label>
    <label>Від кого <small>(необовʼязково)</small><input name="letter_from" maxlength="120" value="${esc(f.letter_from)}" placeholder="Твоя донечка"></label>
    <label>Дата відкриття <small>(порожньо — відкривається одразу)</small>
      <span class="row"><input name="open_at" type="date" value="${esc(f.open_at)}"><button type="button" class="btn ghost sm" data-act="nodate">Без дати</button></span></label>
    <p class="err" hidden></p>
    <div class="mf">
      ${orig ? '<button type="button" class="btn ghost danger-t" data-act="clear">Очистити комірку</button>' : '<span></span>'}
      <div class="row wrap end">
        <button type="button" class="btn" data-act="preview">👁 Попередній перегляд</button>
        <button type="submit" class="btn primary">Зберегти</button>
      </div>
    </div>
  </form>`;
  document.body.appendChild(wrap);
  document.documentElement.classList.add('no-scroll');
  const form = $('form', wrap);
  const fileInput = $('input[type=file]', form);

  function err(msg) { const p = $('.err', form); p.hidden = !msg; p.textContent = msg || ''; }
  function setKind(k) {
    f.kind = k;
    form.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-selected', b.dataset.k === k));
    $('.pane-file', form).hidden = k === 'qr'; $('.pane-qr', form).hidden = k !== 'qr';
    fileInput.accept = k === 'photo' ? 'image/jpeg,image/png,image/webp,image/gif' : 'video/*';
    // файл не того типу — не показуємо
    if (f.file && k !== 'qr' && !(f.file.mime || '').startsWith(k === 'photo' ? 'image' : 'video')) f.fileHiddenForKind = true;
    renderFile(); renderQr();
  }
  function curFile() { return f.file && (f.file.mime || '').startsWith(f.kind === 'photo' ? 'image' : 'video') ? f.file : null; }
  function renderFile() {
    if (f.kind === 'qr') return;
    const file = curFile();
    const pv = $('.drop-preview', form), tx = $('.drop-text', form);
    if (file) {
      pv.innerHTML = f.kind === 'photo' ? `<img src="${esc(file.src)}" alt="">` : `<video src="${esc(file.src)}" muted playsinline preload="metadata" controls></video>`;
      tx.innerHTML = `<b>Замінити файл</b> · ${fmtSize(file.size || 0)}${file.duration ? ' · ' + fmtDur(file.duration) : ''}`;
    } else {
      pv.innerHTML = `<div class="drop-ico">${f.kind === 'photo' ? '🖼' : '🎬'}</div>`;
      tx.innerHTML = `<b>Оберіть ${f.kind === 'photo' ? 'фото' : 'відео'}</b> або перетягніть сюди`;
    }
    $('.file-hint', form).textContent = f.kind === 'photo'
      ? 'JPG, PNG, WebP. HEIC з iPhone не підходить — на iPhone «Налаштування → Камера → Формати → Найсумісніший», або надішліть фото собі в месенджер і збережіть.'
      : `MP4 або MOV з iPhone, до ${C.MAX_VIDEO_MIN} хв і до ${C.MAX_FILE_MB} МБ.`;
  }
  function renderQr() {
    if (f.kind !== 'qr') return;
    const url = form.link_url.value.trim();
    $('.qr-prev', form).innerHTML = /^https?:\/\/\S+\.\S+/.test(url) ? qrSvg(url) : '<span class="hint">Тут зʼявиться QR-код</span>';
  }
  const cnt = () => ($('.cnt', form).textContent = `${form.letter.value.length}/1000`);
  cnt();

  form.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setKind(b.dataset.k)));
  form.link_url.addEventListener('input', renderQr);
  form.letter.addEventListener('input', cnt);
  fileInput.addEventListener('change', () => fileInput.files[0] && handleFile(fileInput.files[0]));
  const drop = $('.drop', form);
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); const fl = e.dataTransfer.files[0]; if (fl) handleFile(fl); });

  async function handleFile(file) {
    err('');
    if (uploading) return err('Зачекайте, поки завантажиться попередній файл');
    const isHeic = /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
    if (isHeic) return err('Формат HEIC не підтримується (Android його не покаже). Оберіть JPG або PNG.');
    let blob = file, mime = file.type, duration = null, ext;
    if (f.kind === 'photo') {
      if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) return err('Оберіть фото у форматі JPG, PNG, WebP або GIF.');
      if (mime !== 'image/gif') {
        try { const r = await compressImage(file); if (r) { blob = r; mime = r.type; } } catch {}
      }
      ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }[mime];
    } else {
      const isVid = /^video\//.test(mime) || /\.(mp4|mov|m4v|webm)$/i.test(file.name);
      if (!isVid) return err('Оберіть відеофайл (MP4 або MOV).');
      duration = await videoDuration(file);
      if (duration && duration > C.MAX_VIDEO_MIN * 60 + 1) return err(`Відео задовге: ${fmtDur(duration)}. Максимум ${C.MAX_VIDEO_MIN} хв.`);
      if (/webm/i.test(mime) || /\.webm$/i.test(file.name)) { mime = 'video/webm'; ext = 'webm'; }
      else { mime = 'video/mp4'; ext = 'mp4'; } // .mov з iPhone зберігаємо як video/mp4 — грає і на Android
    }
    if (blob.size > C.MAX_FILE_MB * MB) return err(`Файл ${fmtSize(blob.size)} — більше за ліміт ${C.MAX_FILE_MB} МБ. ${f.kind === 'video' ? 'Обріжте або стисніть відео.' : ''}`);
    // ліміт сховища проєкту
    try {
      const { data: used } = await sb.rpc('advent_storage_used');
      const quota = C.PROJECT_QUOTA_MB * MB;
      if (used != null && used + blob.size > quota) return err(`Недостатньо місця у сховищі: зайнято ${fmtSize(used)} з ${C.PROJECT_QUOTA_MB} МБ. Видаліть старі календарі або візьміть менший файл.`);
      if (used != null && used + blob.size > quota * 0.85 &&
        !(await confirmDlg(`Сховище майже заповнене: після завантаження буде ${fmtSize(used + blob.size)} з ${C.PROJECT_QUOTA_MB} МБ. Продовжити?`, 'Завантажити'))) return;
    } catch {}
    const path = `${session.user.id}/${randomCode(32)}.${ext}`;
    const prog = $('.up-progress', form); prog.hidden = false;
    const bar = $('i', prog), lab = $('span', prog);
    form.querySelector('[type=submit]').disabled = true;
    try {
      uploading = uploadWithProgress(path, blob, mime, (p) => { bar.style.width = (p * 100).toFixed(0) + '%'; lab.textContent = `Завантаження… ${(p * 100).toFixed(0)}%`; });
      await uploading.promise;
      pendingUploads.add(path);
      if (f.file && !f.file.orig && f.file.path) { removeFiles([f.file.path]); pendingUploads.delete(f.file.path); }
      if (f.file?.src?.startsWith('blob:')) URL.revokeObjectURL(f.file.src);
      f.file = { path, mime, size: blob.size, duration, src: URL.createObjectURL(blob), uploaded: true };
      lab.textContent = 'Завантажено ✓';
      setTimeout(() => (prog.hidden = true), 1200);
    } catch (e) {
      lab.textContent = ''; prog.hidden = true;
      if (e.name !== 'AbortError') err('Помилка завантаження: ' + errText(e));
    } finally { uploading = null; form.querySelector('[type=submit]').disabled = false; fileInput.value = ''; }
    renderFile();
  }

  function collect() {
    const kind = f.kind;
    const row = {
      calendar_code: st.cal.code, number: n, kind,
      letter: form.letter.value.trim() || null, letter_from: form.letter_from.value.trim() || null,
      open_at: form.open_at.value || null,
      file_path: null, mime: null, size: null, duration: null, link_url: null, link_label: null, updated_at: new Date().toISOString(),
    };
    if (kind === 'qr') {
      row.link_url = form.link_url.value.trim(); row.link_label = form.link_label.value.trim() || 'Відкрити подарунок';
    } else {
      const file = curFile();
      if (file) Object.assign(row, { file_path: file.path, mime: file.mime, size: file.size || null, duration: file.duration || null });
    }
    return row;
  }
  function validate(row) {
    if (row.kind === 'qr') {
      if (!/^https?:\/\/[^\s]+\.[^\s]+$/i.test(row.link_url)) return 'Вкажіть коректне посилання, що починається з https://';
    } else if (!row.file_path) return `Завантажте ${row.kind === 'photo' ? 'фото' : 'відео'}`;
    return '';
  }

  async function close(saved) {
    if (uploading) { uploading.abort(); }
    // прибрати непотрібні файли
    const keep = saved ? saved.file_path : orig?.file_path;
    const trash = [...pendingUploads].filter((p) => p !== keep);
    if (saved && orig?.file_path && orig.file_path !== saved.file_path) trash.push(orig.file_path);
    if (trash.length) removeFiles(trash);
    if (f.file?.src?.startsWith('blob:')) URL.revokeObjectURL(f.file.src);
    wrap.remove(); document.documentElement.classList.remove('no-scroll'); document.removeEventListener('keydown', onKey);
  }
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.card-view')) close(null); };
  document.addEventListener('keydown', onKey);

  form.addEventListener('click', async (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act === 'cancel') close(null);
    if (act === 'nodate') form.open_at.value = '';
    if (act === 'preview') {
      const row = collect(); const v = validate(row);
      if (v) return err(v);
      err('');
      const file = curFile();
      openCard({ design: st.cal.design, cell: { ...row, src: file?.src } });
    }
    if (act === 'clear') {
      if (!(await confirmDlg(`Очистити комірку ${n}? Вміст і лист буде видалено.`, 'Очистити', true))) return;
      const { error } = await sb.from('cells').delete().eq('calendar_code', st.cal.code).eq('number', n);
      if (error) return err(errText(error));
      if (orig?.file_path) removeFiles([orig.file_path]);
      st.cells.delete(n);
      await close(null); refresh(); toast(`Комірку ${n} очищено`);
    }
  });
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close(null); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (uploading) return err('Зачекайте завершення завантаження');
    const row = collect(); const v = validate(row);
    if (v) return err(v);
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Збереження…';
    if (orig) { row.opened_at = orig.opened_at; }
    const { data, error } = await sb.from('cells').upsert(row, { onConflict: 'calendar_code,number' }).select().single();
    btn.disabled = false; btn.textContent = 'Зберегти';
    if (error) return err(errText(error));
    st.cells.set(n, data);
    await close(data); refresh(); flashSaved(); toast(`Комірку ${n} збережено`);
  });

  setKind(f.kind);
  $('.seg [aria-selected=true]', form)?.focus();
}

function removeFiles(paths) { if (paths.length) sb.storage.from(C.BUCKET).remove(paths).catch(() => {}); }

function uploadWithProgress(path, blob, mime, onProgress) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    const url = `${C.SUPABASE_URL}/storage/v1/object/${C.BUCKET}/${path}`;
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('apikey', C.SUPABASE_KEY);
    xhr.setRequestHeader('Content-Type', mime);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.setRequestHeader('cache-control', 'max-age=31536000');
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let m = `HTTP ${xhr.status}`; try { const j = JSON.parse(xhr.responseText); m = j.message || j.error || m; } catch {}
      reject(new Error(m));
    };
    xhr.onerror = () => reject(new Error('Failed to fetch'));
    xhr.onabort = () => { const e = new Error('aborted'); e.name = 'AbortError'; reject(e); };
    xhr.send(blob);
  });
  return { promise, abort: () => xhr.abort() };
}

function videoDuration(file) {
  return new Promise((res) => {
    const v = document.createElement('video'); v.preload = 'metadata'; v.muted = true;
    const url = URL.createObjectURL(file);
    const done = (d) => { URL.revokeObjectURL(url); res(Number.isFinite(d) ? d : null); };
    v.onloadedmetadata = () => done(v.duration);
    v.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    v.src = url;
  });
}

async function compressImage(file, max = 2560) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bmp) return null;
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (k === 1 && file.size < 1.5 * MB) { bmp.close?.(); return null; }
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
  const type = file.type === 'image/png' ? 'image/webp' : 'image/jpeg';
  const out = await new Promise((r) => c.toBlob(r, type, 0.86));
  return out && out.size < file.size ? out : null;
}

init();

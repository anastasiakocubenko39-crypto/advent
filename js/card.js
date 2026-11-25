// Відкрита комірка: зимовий фон + вміст у рамці + лист. Спільне для гостя й прев'ю в адмінці.
import { CARD_BG } from './scene.js';
import { snow } from './effects.js';

export function publicUrl(path) {
  const C = window.ADVENT_CONFIG;
  if (!path) return '';
  if (/^(blob:|data:|https?:)/.test(path)) return path;
  return `${C.SUPABASE_URL}/storage/v1/object/public/${C.BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export function qrSvg(text, { margin = 2 } = {}) {
  const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
  return qr.createSvgTag({ cellSize: 8, margin: margin * 8, scalable: true });
}
export function qrCanvas(text, px = 1024) {
  const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
  const n = qr.getModuleCount(), m = 4, cell = Math.floor(px / (n + m * 2));
  const size = cell * (n + m * 2);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); ctx.fillStyle = '#000';
  for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) ctx.fillRect((k + m) * cell, (r + m) * cell, cell, cell);
  return c;
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

/**
 * Відкрити картку.
 * @param {object} o
 * @param {'windows'|'tree'} o.design
 * @param {object} o.cell  {kind,file_path|src,mime,link_url,link_label,letter,letter_from,number}
 * @param {()=>void} [o.onClose]
 * @param {(playing:boolean)=>void} [o.onMedia]  відео грає / зупинилось (для музики)
 * @param {{x:number,y:number}} [o.from] точка, з якої «виростає» картка
 */
export function openCard({ design, cell, onClose, onMedia, from }) {
  const root = document.createElement('div');
  root.className = `card-view ${design}`;
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-label', `Комірка ${cell.number}`);
  const src = cell.src || publicUrl(cell.file_path);
  let media = '';
  if (cell.kind === 'photo') {
    media = `<img class="cv-photo" src="${esc(src)}" alt="Фото-сюрприз">`;
  } else if (cell.kind === 'video') {
    // #t=0.1 — iPhone одразу показує перший кадр замість порожньої рамки
    media = `<video class="cv-video" src="${esc(src)}#t=0.1" controls playsinline preload="metadata"></video>`;
  } else if (cell.kind === 'qr') {
    const url = cell.link_url || '';
    media = `<div class="cv-qr"><div class="cv-qr-plate">${url ? qrSvg(url) : ''}</div>
      <a class="cv-btn cv-go" href="${esc(url)}" target="_blank" rel="noopener">${esc(cell.link_label || 'Перейти')}</a></div>`;
  }
  const hasLetter = (cell.letter && cell.letter.trim()) || (cell.letter_from && cell.letter_from.trim());
  const canSave = cell.kind === 'photo' || cell.kind === 'video';
  root.innerHTML = `
    <img class="cv-bg" src="${CARD_BG[design]}" alt="">
    <canvas class="cv-snow"></canvas>
    <div class="cv-layout">
      <div class="cv-frame k-${cell.kind}">${media}</div>
      ${hasLetter ? `<div class="cv-letter"><div class="cv-paper"><div class="cv-text">${esc(cell.letter || '')}</div>
        ${cell.letter_from ? `<div class="cv-from">${esc(cell.letter_from)}</div>` : ''}</div></div>` : ''}
      <div class="cv-actions">
        ${canSave ? `<button type="button" class="cv-btn cv-save">⬇ Зберегти</button>` : ''}
        <button type="button" class="cv-btn cv-close">✕ До календаря</button>
      </div>
    </div>`;
  document.body.appendChild(root);
  document.documentElement.classList.add('no-scroll');
  const sn = snow(root.querySelector('.cv-snow'), { density: .6 });

  // поява
  const ox = from ? from.x : innerWidth / 2, oy = from ? from.y : innerHeight / 2;
  root.style.transformOrigin = `${ox}px ${oy}px`;
  root.animate([{ opacity: 0, transform: 'scale(.15)' }, { opacity: 1, transform: 'scale(1)' }],
    { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 520, easing: 'cubic-bezier(.2,.9,.3,1.1)' });
  const letter = root.querySelector('.cv-paper');
  if (letter) letter.animate([{ transform: 'perspective(600px) rotateX(-85deg)', opacity: 0 }, { transform: 'perspective(600px) rotateX(0)', opacity: 1 }],
    { duration: 700, delay: 380, easing: 'cubic-bezier(.2,.8,.3,1.15)', fill: 'backwards' });

  const video = root.querySelector('video');
  if (video) {
    video.addEventListener('play', () => onMedia && onMedia(true));
    video.addEventListener('pause', () => onMedia && onMedia(false));
    video.addEventListener('ended', () => onMedia && onMedia(false));
  }
  const photo = root.querySelector('.cv-photo');
  if (photo) photo.addEventListener('click', () => {
    const fs = document.createElement('div'); fs.className = 'cv-full';
    fs.innerHTML = `<img src="${esc(src)}" alt=""><button type="button" class="cv-full-x" aria-label="Закрити">✕</button>`;
    fs.addEventListener('click', () => fs.remove());
    root.appendChild(fs);
  });

  let closed = false;
  function close() {
    if (closed) return; closed = true;
    if (video) { video.pause(); onMedia && onMedia(false); }
    root.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(30px) scale(.97)' }], { duration: 260, easing: 'ease-in' })
      .onfinish = () => { sn.stop(); root.remove(); document.documentElement.classList.remove('no-scroll'); onClose && onClose(); };
    document.removeEventListener('keydown', onKey);
  }
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  root.querySelector('.cv-close').addEventListener('click', close);
  const saveBtn = root.querySelector('.cv-save');
  if (saveBtn) saveBtn.addEventListener('click', () => download(src, cell, saveBtn));

  // свайп вниз закриває (не з листа і не з відео)
  let sy = null, sx = null;
  root.addEventListener('touchstart', (e) => {
    if (e.target.closest('.cv-text, video, .cv-full')) { sy = null; return; }
    sy = e.touches[0].clientY; sx = e.touches[0].clientX;
  }, { passive: true });
  root.addEventListener('touchend', (e) => {
    if (sy == null) return;
    const dy = e.changedTouches[0].clientY - sy, dx = Math.abs(e.changedTouches[0].clientX - sx);
    if (dy > 90 && dx < 70) close();
    sy = null;
  });
  root.querySelector('.cv-close').focus({ preventScroll: true });
  return { close, root };
}

async function download(src, cell, btn) {
  const ext = cell.kind === 'video' ? 'mp4' : ((cell.mime || '').split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const name = `advent-${cell.number}.${ext}`;
  const old = btn.textContent; btn.textContent = '⏳ Завантаження…'; btn.disabled = true;
  try {
    const r = await fetch(src); if (!r.ok) throw new Error(r.status);
    const blob = await r.blob();
    const file = new File([blob], name, { type: blob.type });
    // На iPhone «Поділитися → Зберегти фото/відео» — найзручніше
    if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch {
    window.open(src, '_blank', 'noopener');
  } finally { btn.textContent = old; btn.disabled = false; }
}

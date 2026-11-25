// Білочка (SVG з частинами тіла) + пози: біг, тримає, махає. Дивиться праворуч; для руху вліво — scaleX(-1).
const SVG = `
<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="sqFur" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#f2a04c"/><stop offset="1" stop-color="#c0611f"/></radialGradient>
    <linearGradient id="sqTail" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e98d3a"/><stop offset="1" stop-color="#b4561a"/></linearGradient>
  </defs>
  <g class="sq-all">
    <g class="sq-tail">
      <path d="M86 150 C 30 156, 10 104, 34 70 C 54 40, 96 48, 88 82 C 84 98, 64 96, 66 82" fill="none" stroke="url(#sqTail)" stroke-width="40" stroke-linecap="round"/>
      <path d="M84 146 C 38 150, 22 106, 42 76 C 58 54, 86 58, 82 80" fill="none" stroke="#f6b46a" stroke-width="14" stroke-linecap="round" opacity=".7"/>
      <path d="M30 96 l-8 -4 M28 116 l-9 1 M42 62 l-5 -7 M62 48 l0 -8" stroke="#b4561a" stroke-width="3" stroke-linecap="round"/>
    </g>
    <g class="sq-legb"><ellipse cx="98" cy="166" rx="24" ry="16" fill="url(#sqFur)"/><ellipse cx="112" cy="182" rx="18" ry="6.5" fill="#a9521a"/></g>
    <g class="sq-armb"><path d="M120 122 Q 134 130 150 126" stroke="#a9521a" stroke-width="10" stroke-linecap="round" fill="none"/></g>
    <g class="sq-body">
      <ellipse cx="114" cy="136" rx="32" ry="40" fill="url(#sqFur)" transform="rotate(-14 114 136)"/>
      <ellipse cx="126" cy="142" rx="16" ry="28" fill="#f8e0b8" transform="rotate(-14 126 142)"/>
    </g>
    <g class="sq-legf"><ellipse cx="138" cy="180" rx="13" ry="6" fill="#a9521a"/></g>
    <g class="sq-head">
      <path d="M124 70 L 122 44 Q 128 40 132 46 L 140 66 Z" fill="#c0611f"/>
      <path d="M122 44 q -2 -8 4 -12 q 0 7 6 14 Z" fill="#8a3f12"/>
      <path d="M127 66 L 126 52 L 134 64 Z" fill="#f5b7a0"/>
      <circle cx="138" cy="90" r="28" fill="url(#sqFur)"/>
      <ellipse cx="160" cy="98" rx="16" ry="12" fill="#f8e0b8"/>
      <ellipse cx="150" cy="104" rx="7" ry="4.5" fill="#f3a39a" opacity=".7"/>
      <g class="sq-eye"><ellipse cx="149" cy="84" rx="5.2" ry="6.2" fill="#2a160b"/><circle cx="151" cy="81.5" r="1.8" fill="#fff"/></g>
      <ellipse cx="174" cy="94" rx="4.4" ry="3.6" fill="#3a1d0e"/>
      <path d="M166 104 q 4 3 8 0" stroke="#3a1d0e" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      <path d="M172 98 l 14 -4 M172 100 l 14 2" stroke="#7a4a2a" stroke-width="1" opacity=".6"/>
    </g>
    <g class="sq-armf"><path d="M128 124 Q 142 134 158 130" stroke="#c0611f" stroke-width="11" stroke-linecap="round" fill="none"/><circle class="sq-paw" cx="159" cy="130" r="6.5" fill="#a9521a"/></g>
  </g>
</svg>`;

export class Squirrel {
  constructor(size) {
    this.el = document.createElement('div');
    this.el.className = 'squirrel';
    this.el.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;z-index:65;pointer-events:none;will-change:transform`;
    this.el.innerHTML = `<div class="sq-flip" style="width:100%;height:100%">${SVG}</div>`;
    document.body.appendChild(this.el);
    this.size = size;
    const q = (s) => this.el.querySelector(s);
    this.p = { all: q('.sq-all'), tail: q('.sq-tail'), head: q('.sq-head'), armf: q('.sq-armf'), armb: q('.sq-armb'),
      legf: q('.sq-legf'), legb: q('.sq-legb'), body: q('.sq-body'), flip: q('.sq-flip'), eye: q('.sq-eye') };
    const g = window.gsap;
    g.set(this.p.armf, { svgOrigin: '128 124' }); g.set(this.p.armb, { svgOrigin: '120 122' });
    g.set(this.p.tail, { svgOrigin: '86 150' }); g.set(this.p.head, { svgOrigin: '130 112' });
    g.set(this.p.legf, { svgOrigin: '130 178' }); g.set(this.p.legb, { svgOrigin: '98 166' });
    this.loops = [];
    this.idle();
  }
  // позиція: (x,y) — центр білочки у px вікна
  place(x, y) { window.gsap.set(this.el, { x: x - this.size / 2, y: y - this.size / 2 }); }
  face(dir) { this.p.flip.style.transform = dir < 0 ? 'scaleX(-1)' : ''; this.dir = dir; }
  stop() { this.loops.forEach((t) => t.kill()); this.loops = []; }
  idle() {
    this.stop(); const g = window.gsap;
    this.loops.push(g.to(this.p.tail, { rotation: 6, duration: .7, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    this.loops.push(g.to(this.p.eye, { scaleY: .1, transformOrigin: '50% 50%', duration: .08, yoyo: true, repeat: -1, repeatDelay: 2.2 }));
  }
  run() {
    this.stop(); const g = window.gsap;
    g.set([this.p.armf, this.p.armb], { rotation: 0 });
    this.loops.push(g.to(this.p.all, { y: -10, duration: .13, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
    this.loops.push(g.fromTo(this.p.legf, { rotation: -25 }, { rotation: 25, duration: .13, yoyo: true, repeat: -1 }));
    this.loops.push(g.fromTo(this.p.legb, { rotation: 20 }, { rotation: -20, duration: .13, yoyo: true, repeat: -1 }));
    this.loops.push(g.fromTo(this.p.tail, { rotation: -8 }, { rotation: 10, duration: .26, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
  }
  hold() {
    this.stop(); const g = window.gsap;
    g.to(this.p.all, { y: 0, duration: .15 });
    g.to([this.p.legf, this.p.legb], { rotation: 0, duration: .15 });
    g.to(this.p.armf, { rotation: -28, duration: .2 }); g.to(this.p.armb, { rotation: -22, duration: .2 });
    this.loops.push(g.to(this.p.tail, { rotation: 5, duration: .5, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
  }
  /** точка «лап» відносно центру білочки (px) */
  pawOffset() { const s = this.size / 200; return { x: (160 - 100) * s * (this.dir < 0 ? -1 : 1), y: (112 - 100) * s }; }
  wave() {
    this.stop(); const g = window.gsap;
    g.to(this.p.armb, { rotation: 0, duration: .2 });
    g.to(this.p.head, { rotation: -8, duration: .25, yoyo: true, repeat: 1 });
    this.loops.push(g.fromTo(this.p.armf, { rotation: -80 }, { rotation: -120, duration: .18, yoyo: true, repeat: -1, ease: 'sine.inOut' }));
  }
  remove() { this.stop(); this.el.remove(); }
}

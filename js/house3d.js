// 3D-будинок (дизайн «Віконця»): модель і розкадровка з редактора Designlab
// (assets/house3d/scene.json), перемальовані в «живописному» стилі:
// пастельний персиковий будинок, контур, мазки, зелень із вогниками, неонові цифри.
//
// Семантика сцени та ж, що в редакторі: свої форми (extrude/lathe), примітиви,
// точка опори (pivot), прикріплення (parentId), обертання в градусах, ключові кадри.
import * as THREE from 'three';
import { mergeVertices } from '../lib/BufferGeometryUtils.js';

const DEG = THREE.MathUtils.degToRad;
const DOOR = 13; // «комірка» дверей — лист без фото

// ---------- геометрія як у редакторі ----------
const PRIMS = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  sphere: () => new THREE.SphereGeometry(0.65, 28, 18),
  cone: () => new THREE.ConeGeometry(0.65, 1.3, 28),
  cylinder: () => new THREE.CylinderGeometry(0.6, 0.6, 1.2, 24),
  torus: () => new THREE.TorusGeometry(0.55, 0.22, 16, 40),
  capsule: () => new THREE.CapsuleGeometry(0.42, 0.75, 4, 14),
};
function customGeometry(p) {
  if (p.mode === 'extrude') {
    const depth = p.depth || 0.6;
    const bevel = p.bevel ? Math.min(0.12, depth / 3) : 0;
    const g = new THREE.ExtrudeGeometry(new THREE.Shape(p.points.extrude.map((v) => new THREE.Vector2(v.x, v.y))),
      { depth, curveSegments: 1, bevelEnabled: !!p.bevel, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3 });
    g.translate(0, 0, -depth / 2);
    return g;
  }
  return new THREE.LatheGeometry(p.points.lathe.map((v) => new THREE.Vector2(Math.max(0, v.x), v.y)), Math.max(3, Math.min(64, p.segments || 40)));
}
const EASE = { linear: (t) => t, easeIn: (t) => t * t, easeOut: (t) => 1 - (1 - t) * (1 - t), easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2) };
function poseAt(o, t) {
  const k = o.keyframes || [];
  if (!k.length) return o;
  if (t <= k[0].time) return k[0];
  if (t >= k[k.length - 1].time) return k[k.length - 1];
  for (let i = 0; i < k.length - 1; i++) {
    const a = k[i], b = k[i + 1];
    if (t >= a.time && t <= b.time) {
      const f = (EASE[b.easing] || EASE.linear)((t - a.time) / (b.time - a.time || 1));
      const L = (p, q) => ({ x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, z: p.z + (q.z - p.z) * f });
      return { position: L(a.position, b.position), rotation: L(a.rotation, b.rotation), scale: L(a.scale, b.scale) };
    }
  }
  return k[k.length - 1];
}
function applyPose(node, p) {
  node.position.set(p.position.x, p.position.y, p.position.z);
  node.rotation.set(DEG(p.rotation.x), DEG(p.rotation.y), DEG(p.rotation.z));
  node.scale.set(p.scale.x, p.scale.y, p.scale.z);
}

// ---------- «живописні» матеріали ----------
function brushTexture(seed = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  let s = seed * 9301;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const l = 205 + rnd() * 50;
    x.strokeStyle = `rgba(${l},${l - 6},${l - 14},${0.16 + rnd() * 0.22})`;
    x.lineWidth = 2 + rnd() * 9; x.lineCap = 'round';
    const px = rnd() * 256, py = rnd() * 256, a = -0.6 + rnd() * 0.5, len = 12 + rnd() * 42;
    x.beginPath(); x.moveTo(px, py);
    x.quadraticCurveTo(px + Math.cos(a) * len * 0.5, py + Math.sin(a) * len * 0.5 + (rnd() - 0.5) * 8, px + Math.cos(a) * len, py + Math.sin(a) * len);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const TOON = (() => {
  const d = new Uint8Array([90, 160, 225, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.needsUpdate = true; return t;
})();
let BRUSH = null, BRUSH_FINE = null;
function paintMat(color, o = {}) {
  BRUSH ||= brushTexture(3);
  return new THREE.MeshToonMaterial({ color, map: o.fine ? BRUSH_FINE : BRUSH, gradientMap: TOON, ...o.extra });
}
const OUTLINE_COLOR = 0x2a1810;
function outlineFor(mesh, thickness) {
  let g = mesh.geometry.clone();
  g.deleteAttribute('uv'); g.deleteAttribute('normal');
  g = mergeVertices(g, 1e-3); g.computeVertexNormals();
  const m = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uT = { value: thickness };
    sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normalize(normal) * uT;');
  };
  const o = new THREE.Mesh(g, m); o.raycast = () => {}; o.userData.outline = true;
  return o;
}

// ---------- текстури цифр і напису ----------
function neonTexture(text, color, { w = 256, h = 256, font = 170 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `800 ${font}px Montserrat, system-ui, sans-serif`;
  for (const [blur, alpha] of [[38, 0.9], [18, 1], [6, 1]]) {
    x.shadowColor = color; x.shadowBlur = blur; x.globalAlpha = alpha;
    x.fillStyle = color; x.fillText(text, w / 2, h / 2 + font * 0.04);
  }
  x.shadowBlur = 0; x.globalAlpha = 1;
  x.fillStyle = '#fffbe8'; x.font = `800 ${font * 0.96}px Montserrat, system-ui, sans-serif`;
  x.globalAlpha = 0.85; x.fillText(text, w / 2, h / 2 + font * 0.04);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,230,160,1)'); g.addColorStop(0.3, 'rgba(255,200,90,.45)'); g.addColorStop(1, 'rgba(255,180,60,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------- кольори ----------
const COL = {
  wall: 0xe5ad8f, wallTop: 0xd49a80, cream: 0xf7e7d4, shutter: 0x7b4430, doorWood: 0xa63a2c,
  interior: 0x3a2214, warm: 0xffcf73, green: 0x2f6b3a, greenDark: 0x1f4d2a, snow: 0xf4f8f6, ground: 0xb9cfbb,
};
const NEON = ['#ffe14d', '#ff4057'];

/**
 * @param {HTMLElement} host
 * @param {object} o
 * @param {'guest'|'admin'} o.mode
 * @param {Map<number,{filled:boolean, opened?:boolean, locked?:boolean}>} o.cells
 * @param {(n:number)=>void} [o.onPick]
 */
export async function createHouse3D(host, { mode = 'guest', cells = new Map(), onPick, sceneUrl = 'assets/house3d/scene.json' } = {}) {
  const data = await (await fetch(sceneUrl)).json();
  try { await document.fonts.load('800 100px Montserrat'); } catch {}
  BRUSH_FINE ||= (() => { const t = brushTexture(7); t.repeat.set(1, 1); return t; })();

  const canvas = document.createElement('canvas');
  canvas.className = 'h3-canvas';
  host.appendChild(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 60);

  scene.add(new THREE.HemisphereLight(0xd8e4ff, 0x5a4a6a, 1.25));
  const moon = new THREE.DirectionalLight(0xe6ecff, 1.5); moon.position.set(-3, 4, 3); scene.add(moon);
  const warmLight = new THREE.PointLight(0xffb66b, 1.2, 4, 1.4); warmLight.position.set(0, 0.6, 1.2); scene.add(warmLight);

  const root = new THREE.Group(); scene.add(root);
  const byId = new Map(), nodes = new Map();
  const glow = glowTexture();
  const pickables = [];
  const animated = []; // обʼєкти з розкадровкою (санчата)

  // --- побудова з файлу ---
  for (const o of data.objects) {
    byId.set(o.id, o);
    if (o.type === 'pointLight' || o.type === 'spotLight') continue;
    const geo = o.type === 'custom' ? customGeometry(o.profile) : (PRIMS[o.type] || PRIMS.box)();
    if (o.pivot && (o.pivot.x || o.pivot.y || o.pivot.z)) geo.translate(-o.pivot.x, -o.pivot.y, -o.pivot.z);
    const role = roleOf(o);
    const mesh = new THREE.Mesh(geo, materialFor(o, role));
    mesh.userData = { obj: o, role };
    applyPose(mesh, poseAt(o, 0));
    nodes.set(o.id, mesh);
    if (o.keyframes?.length && role === 'sleigh') animated.push(mesh);
  }
  for (const o of data.objects) {
    const n = nodes.get(o.id); if (!n) continue;
    (o.parentId && nodes.get(o.parentId) ? nodes.get(o.parentId) : root).add(n);
  }
  // контури (після ієрархії, щоб знати світовий масштаб)
  root.updateMatrixWorld(true);
  const ws = new THREE.Vector3();
  for (const mesh of nodes.values()) {
    const r = mesh.userData.role;
    if (r === 'eye' || r === 'rein' || r === 'windowPlate') continue;
    mesh.getWorldScale(ws);
    const avg = (Math.abs(ws.x) + Math.abs(ws.y) + Math.abs(ws.z)) / 3 || 1;
    const t = (r === 'house' ? 0.012 : 0.006) / avg;
    mesh.add(outlineFor(mesh, t));
  }

  function roleOf(o) {
    const name = (o.name || '').toLowerCase();
    if (name === 'дім') return 'house';
    if (/^\d+$/.test(name)) return 'windowPlate';
    if (name.startsWith('фіранка')) return 'shutter';
    if (name.startsWith('двері')) return 'door';
    if (name === 'намальована форма') return 'doorFrame';
    if (name === 'око') return 'eye';
    if (name === 'віжки') return 'rein';
    if (o.parentId || name === 'санчата') return 'sleigh';
    return 'other';
  }
  function materialFor(o, role) {
    const c = o.material?.color || '#ffffff';
    if (role === 'house') return paintMat(COL.wall);
    if (role === 'windowPlate') return new THREE.MeshToonMaterial({ color: COL.interior, emissive: new THREE.Color(COL.warm), emissiveIntensity: 0.0, gradientMap: TOON });
    if (role === 'shutter') return paintMat(COL.shutter, { fine: true });
    if (role === 'door') return paintMat(COL.doorWood, { fine: true });
    if (role === 'doorFrame') return new THREE.MeshToonMaterial({ color: COL.interior, emissive: new THREE.Color(COL.warm), emissiveIntensity: 0.15, gradientMap: TOON });
    if (role === 'eye' || role === 'rein') return new THREE.MeshBasicMaterial({ color: c });
    return paintMat(c, { fine: true });
  }

  // --- вікна: віконниці, цифри, світло ---
  const win = new Map(); // n → {plate, left, right, num, glowSprite, closedL, closedR, opened}
  for (const mesh of nodes.values()) {
    const { obj, role } = mesh.userData;
    if (role === 'windowPlate') {
      const n = Number(obj.name);
      const w = win.get(n) || {}; w.plate = mesh; win.set(n, w);
      mesh.position.z -= 0.012; // скло трохи глибше за віконниці
    } else if (role === 'shutter') {
      const m = obj.name.match(/(ліва|права)\s*(\d+)/);
      if (!m) continue;
      const n = Number(m[2]); const w = win.get(n) || {}; win.set(n, w);
      // зачинений стан — рівно (0°), розкадровка вікна №1 тепер для всіх вікон
      mesh.rotation.set(0, 0, 0); mesh.position.z = 0.5 + 0.006;
      if (m[1] === 'ліва') w.left = mesh; else w.right = mesh;
    }
  }
  const OPEN_L = -128, OPEN_R = 128;
  for (const [n, w] of win) {
    if (!w.plate) continue;
    const info = cells.get(n);
    const p = w.plate.position;
    w.home = new THREE.Vector3(p.x, p.y + 0.012, 0.56);
    const visible = mode === 'admin' || (info && info.filled);
    // світіння у вікні (видно, коли відчинено)
    w.glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffd38a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    w.glowSprite.scale.set(0.34, 0.34, 1); w.glowSprite.position.set(p.x, p.y + 0.01, 0.53); root.add(w.glowSprite);
    if (visible) {
      const tex = neonTexture(String(n), NEON[(n + 1) % 2]);
      w.num = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      w.num.position.copy(w.home); root.add(w.num);
      w.num.userData.cell = n;
      for (const part of [w.plate, w.left, w.right, w.num]) if (part) { part.userData.cell = n; pickables.push(part); }
    }
    w.opened = false;
  }

  // --- двері: «З Новим роком!» прямо на дверях, світло з-за дверей ---
  let doorSign = null;
  const doorMeshes = [...nodes.values()].filter((m) => m.userData.role === 'door');
  const doorFrame = [...nodes.values()].find((m) => m.userData.role === 'doorFrame');
  const doorInfo = cells.get(DOOR);
  const doorVisible = mode === 'admin' || (doorInfo && doorInfo.filled);
  const doors = doorMeshes.map((m) => ({ mesh: m, left: m.position.x < (doorFrame ? doorFrame.position.x : 0) }));
  for (const d of doors) d.mesh.rotation.set(0, 0, 0);
  if (doorFrame) { doorFrame.position.z -= 0.02; }
  {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 256; const x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '700 120px Caveat, cursive';
    for (const [b, a] of [[30, 0.9], [12, 1]]) { x.shadowColor = '#ffe14d'; x.shadowBlur = b; x.globalAlpha = a; x.fillStyle = '#ffe14d'; x.fillText('З Новим роком!', 512, 132); }
    x.shadowBlur = 0; x.globalAlpha = 1; x.fillStyle = '#fffbe6'; x.fillText('З Новим роком!', 512, 132);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.115), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    const fx = doorFrame ? doorFrame.position.x : 0;
    sign.position.set(fx, 0.1, 0.6); root.add(sign); doorSign = sign;
    sign.userData.cell = DOOR;
    if (doorVisible) { pickables.push(sign); for (const d of doors) { d.mesh.userData.cell = DOOR; pickables.push(d.mesh); } if (doorFrame) { doorFrame.userData.cell = DOOR; pickables.push(doorFrame); } }
  }
  const doorGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffc56b, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
  doorGlow.scale.set(0.7, 0.6, 1); doorGlow.position.set(doorFrame ? doorFrame.position.x : 0, 0.05, 0.5); root.add(doorGlow);

  // --- прикраси: сніг, зелень з ягодами й вогниками ---
  const H = nodes.get(data.objects.find((o) => (o.name || '') === 'дім')?.id);
  const hy = H ? H.position.y : 0.65;
  const snowMat = paintMat(COL.snow, { fine: true });
  const addSnow = (w, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), snowMat); m.position.set(x, y, z); root.add(m); m.add(outlineFor(m, 0.008)); };
  addSnow(1.6, 1.0, 0, hy + 0.5, 0);
  addSnow(1.06, 0.86, 0, hy + 0.745, 0);
  const greenMat = paintMat(COL.green, { fine: true });
  const bulbs = [];
  function garland(x0, x1, y, z, sag, swags) {
    const pts = [];
    for (let i = 0; i <= swags * 8; i++) {
      const t = i / (swags * 8), x = x0 + (x1 - x0) * t;
      pts.push(new THREE.Vector3(x, y - Math.abs(Math.sin(t * swags * Math.PI)) * sag, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, swags * 24, 0.036, 8, false), greenMat);
    root.add(tube); tube.add(outlineFor(tube, 0.006));
    // «гілочки» — кульки хвої вздовж
    const needle = new THREE.SphereGeometry(0.042, 8, 6);
    const darkGreen = paintMat(COL.greenDark, { fine: true });
    for (let i = 0; i <= swags * 10; i++) {
      const p = curve.getPoint(i / (swags * 10));
      const m = new THREE.Mesh(needle, i % 2 ? greenMat : darkGreen);
      m.position.set(p.x + (Math.random() - 0.5) * 0.02, p.y + (Math.random() - 0.5) * 0.02, p.z + 0.01);
      m.scale.setScalar(0.8 + Math.random() * 0.6); root.add(m);
    }
    const berry = new THREE.SphereGeometry(0.014, 8, 6);
    const bulbCols = [0xffd36a, 0xff5a4a, 0x8fd3ff, 0xfff2c0];
    for (let i = 0; i < swags * 6; i++) {
      const p = curve.getPoint((i + 0.5) / (swags * 6));
      if (i % 3 === 0) {
        const b = new THREE.Mesh(berry, new THREE.MeshBasicMaterial({ color: 0xc8102e })); b.position.set(p.x, p.y - 0.01, p.z + 0.03); root.add(b);
      } else {
        const col = bulbCols[i % 4];
        const b = new THREE.Mesh(berry, new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); b.position.set(p.x, p.y - 0.02, p.z + 0.03); root.add(b);
        const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
        g.scale.set(0.09, 0.09, 1); g.position.copy(b.position); root.add(g); bulbs.push({ g, ph: Math.random() * 6.28 });
      }
    }
  }
  // зелень на даху: по краю карниза й по верху надбудови
  garland(-0.78, 0.78, hy + 0.5, 0.53, 0.06, 4);
  garland(-0.52, 0.52, hy + 0.74, 0.47, 0.035, 3);
  // гірлянда над дверима
  if (doorFrame) garland(doorFrame.position.x - 0.18, doorFrame.position.x + 0.18, 0.3, 0.56, 0.03, 2);
  // сніжний замет під будинком — у колір снігу на фоні
  const groundTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
    const g = x.createRadialGradient(128, 128, 30, 128, 128, 128); g.addColorStop(0, 'rgba(206,224,208,1)'); g.addColorStop(0.65, 'rgba(190,212,194,.85)'); g.addColorStop(1, 'rgba(185,207,187,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1.6, 48), new THREE.MeshBasicMaterial({ map: groundTex, transparent: true, depthWrite: false }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.055; ground.scale.set(1.3, 0.75, 1); root.add(ground);

  // санчата: рука, що махає
  const santaArm = [...nodes.values()].find((m) => /махає/.test(m.userData.obj?.name || ''));
  const armBase = santaArm ? santaArm.rotation.clone() : null;
  const sleighRoot = animated[0] || null;
  const sleighEnd = sleighRoot ? sleighRoot.userData.obj.keyframes.at(-1).time : 0;

  // ---------- камера ----------
  const VIEW_DIR = new THREE.Vector3(-0.22, 0.22, 1).normalize();
  const houseTarget = new THREE.Vector3(0, 0.72, 0);
  let introT = mode === 'admin' ? Infinity : 0;
  let introDone = mode === 'admin';
  let introResolve; const introPromise = new Promise((r) => (introResolve = r));
  if (introDone) introResolve();
  let pullBack = mode === 'admin' ? 1 : 0; // 0 — слідкуємо за санчатами, 1 — видно весь будинок
  const camFrom = new THREE.Vector3(), camTo = new THREE.Vector3(), lookFrom = new THREE.Vector3();
  function fullDistance() {
    const vt = Math.tan(DEG(camera.fov / 2)), ht = vt * camera.aspect;
    const needW = 1.95, needH = 2.2;
    return Math.max(needW / 2 / ht, needH / 2 / vt);
  }
  function framing() {
    const d = fullDistance();
    const shiftY = camera.aspect < 0.8 ? 0.18 : 0.08; // будинок трохи нижче центру — стоїть на снігу фону
    const look = houseTarget.clone().add(new THREE.Vector3(0, shiftY, 0));
    return { pos: look.clone().addScaledVector(VIEW_DIR, d), look };
  }
  function resize() {
    const w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(host);

  // ---------- твіни ----------
  const tweens = [];
  function tween(dur, fn, ease = EASE.easeInOut) {
    return new Promise((res) => tweens.push({ t0: performance.now(), dur: dur * 1000, fn, ease, res }));
  }
  function stepTweens(now) {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]; const k = Math.min(1, (now - tw.t0) / tw.dur);
      tw.fn(tw.ease(k)); if (k >= 1) { tweens.splice(i, 1); tw.res(); }
    }
  }

  // ---------- кадр ----------
  const clock = new THREE.Clock();
  let raf, alive = true;
  const tmp = new THREE.Vector3();
  function frame(now) {
    if (!alive) return;
    const dt = Math.min(0.05, clock.getDelta()), t = clock.elapsedTime;
    stepTweens(now);
    // розкадровка санчат
    if (sleighRoot) {
      const st = introDone ? sleighEnd : Math.min(introT, sleighEnd);
      applyPose(sleighRoot, poseAt(sleighRoot.userData.obj, st));
      if (introDone) sleighRoot.position.y += Math.sin(t * 1.6) * 0.004;
    }
    if (santaArm && armBase) santaArm.rotation.set(armBase.x + DEG(-150 + Math.sin(t * 7) * 22), armBase.y, armBase.z + DEG(10));
    // камера
    const full = framing();
    if (!introDone) {
      introT += dt;
      sleighRoot?.getWorldPosition(tmp);
      // камера тримає в кадрі санчата, але й трохи будинок; ближче до даху — ширше
      const look = tmp.clone().lerp(houseTarget, 0.35);
      const follow = { pos: look.clone().addScaledVector(VIEW_DIR, 4.4), look };
      if (introT > sleighEnd + 0.5 && pullBack === 0) {
        pullBack = 0.0001;
        camFrom.copy(camera.position); lookFrom.copy(follow.look);
        tween(1.6, (k) => (pullBack = Math.max(0.0001, k))).then(() => { introDone = true; introResolve(); });
      }
      if (pullBack > 0) {
        camera.position.lerpVectors(camFrom, full.pos, pullBack);
        camera.lookAt(camTo.lerpVectors(lookFrom, full.look, pullBack));
      } else {
        camera.position.lerp(follow.pos, introT < 0.05 ? 1 : 0.08);
        camera.lookAt(follow.look);
      }
    } else {
      const sway = mode === 'admin' ? 0 : 1;
      camera.position.copy(full.pos).add(new THREE.Vector3(Math.sin(t * 0.25) * 0.06 * sway, Math.sin(t * 0.33) * 0.03 * sway, 0));
      camera.lookAt(full.look);
    }
    for (const b of bulbs) b.g.material.opacity = 0.45 + 0.45 * Math.max(0, Math.sin(t * 2.4 + b.ph * 3));
    for (const [n, w] of win) if (w.num && !w.opened) w.num.material.opacity = 0.85 + 0.15 * Math.sin(t * 3 + n);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); else { clock.getDelta(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVis);

  // ---------- вибір кліком ----------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pickAt(clientX, clientY) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(pickables, false)[0];
    return hit ? hit.object.userData.cell : null;
  }
  canvas.addEventListener('click', (e) => {
    if (!introDone) return;
    const n = pickAt(e.clientX, e.clientY);
    if (n != null && onPick) onPick(n);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!introDone || e.pointerType !== 'mouse') return;
    canvas.style.cursor = pickAt(e.clientX, e.clientY) != null ? 'pointer' : '';
  });

  // ---------- дії ----------
  function setOpened(n, open = true, animate = false) {
    if (n === DOOR) return setDoor(open, animate);
    const w = win.get(n); if (!w || !w.plate) return Promise.resolve();
    w.opened = open;
    const target = open ? 1 : 0;
    const from = w.k ?? 0;
    const apply = (k) => {
      w.k = k;
      if (w.left) w.left.rotation.y = DEG(OPEN_L * k);
      if (w.right) w.right.rotation.y = DEG(OPEN_R * k);
      w.plate.material.emissiveIntensity = 0.95 * k;
      w.glowSprite.material.opacity = 0.75 * k;
      if (w.num) {
        // відчинене вікно: цифра лишається, менша, під вікном (на підвіконні)
        w.num.position.set(w.home.x, w.home.y - 0.118 * k, w.home.z + 0.01 * k);
        w.num.scale.setScalar(1 - 0.42 * k);
      }
    };
    if (!animate) { apply(target); return Promise.resolve(); }
    return tween(0.9, (k) => apply(from + (target - from) * k), EASE.easeOut);
  }
  let doorK = 0;
  function setDoor(open, animate) {
    const target = open ? 1 : 0, from = doorK;
    const apply = (k) => {
      doorK = k;
      for (const d of doors) d.mesh.rotation.y = DEG((d.left ? -118 : 118) * k);
      doorGlow.material.opacity = 0.9 * k;
      if (doorSign) { doorSign.position.y = 0.1 + 0.2 * k; doorSign.scale.setScalar(1 - 0.25 * k); }
      if (doorFrame) doorFrame.material.emissiveIntensity = 0.15 + 0.85 * k;
    };
    if (!animate) { apply(target); return Promise.resolve(); }
    return tween(1.1, (k) => apply(from + (target - from) * k), EASE.easeOut);
  }
  function screenPos(n) {
    const v = new THREE.Vector3();
    if (n === DOOR) v.set(doorFrame ? doorFrame.position.x : 0, 0.1, 0.55);
    else { const w = win.get(n); if (!w || !w.plate) return null; v.copy(w.home); }
    v.project(camera);
    const r = canvas.getBoundingClientRect();
    return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height };
  }
  async function shake(n) {
    const parts = n === DOOR ? doors.map((d) => d.mesh) : [win.get(n)?.left, win.get(n)?.right, win.get(n)?.num].filter(Boolean);
    const base = parts.map((p) => p.position.x);
    await tween(0.45, (k) => parts.forEach((p, i) => (p.position.x = base[i] + Math.sin(k * Math.PI * 8) * 0.008 * (1 - k))), EASE.linear);
  }
  async function flash(n) {
    const g = n === DOOR ? doorGlow : win.get(n)?.glowSprite; if (!g) return;
    const s0 = g.scale.x;
    await tween(0.5, (k) => { g.material.opacity = Math.max(g.material.opacity, Math.sin(k * Math.PI)); g.scale.setScalar(s0 * (1 + Math.sin(k * Math.PI) * 0.8)); });
    g.scale.setScalar(s0);
  }
  function skipIntro() { if (!introDone) { introT = sleighEnd + 0.5; } }

  // початковий стан відкритих
  for (const [n, info] of cells) if (info.opened) setOpened(n, true, false);

  return {
    ready: introPromise, skipIntro, setOpened, shake, flash, screenPos, pickAt,
    get introDone() { return introDone; },
    dispose() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); renderer.dispose(); canvas.remove(); },
  };
}

export { DOOR };

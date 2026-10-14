/* Dżentelmeni – sceny 3D (three.js): szklany słupek barberski w hero i cylinder (top hat) na końcu strony */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const GOLD = 0xcfae72, WINE = 0x5b323a, CREAM = '#F3ECE2', RED = '#B5363E', BLUE = '#2F4C7E';

function makeRenderer(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

function envFor(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return tex;
}

/* runs a render loop only while the canvas is on screen */
function loopWhenVisible(el, tick) {
  let on = false, raf = 0, last = performance.now();
  const frame = (now) => { if (!on) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; tick(dt, now / 1000); raf = requestAnimationFrame(frame); };
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !on) { on = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    else if (!e.isIntersecting && on) { on = false; cancelAnimationFrame(raf); }
  }, { rootMargin: '120px' }).observe(el);
}

function fit(renderer, camera, canvas) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ======================= BARBER POLE ======================= */
function stripeTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = CREAM; g.fillRect(0, 0, 512, 512);
  const band = 512 / 4; // red, cream, blue, cream
  g.save(); g.translate(256, 256); g.rotate(-Math.PI / 4.2); g.translate(-512, -512);
  for (let y = -512; y < 1536; y += band * 4) {
    g.fillStyle = RED; g.fillRect(0, y, 1024, band);
    g.fillStyle = BLUE; g.fillRect(0, y + band * 2, 1024, band);
  }
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 2.2);
  t.anisotropy = 4;
  return t;
}

function initPole() {
  const canvas = document.getElementById('pole');
  if (!canvas) return;
  const renderer = makeRenderer(canvas);
  if (!renderer) { canvas.remove(); return; }
  const scene = new THREE.Scene();
  scene.environment = envFor(renderer);
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
  camera.position.set(0, 0.15, 10.5);

  const gold = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.22 });
  const map = stripeTexture();
  const pole = new THREE.Group();
  const spin = new THREE.Group();
  pole.add(spin);

  const H = 3.4;
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, H, 96, 1, true), new THREE.MeshStandardMaterial({ map, roughness: 0.38, metalness: 0 }));
  spin.add(inner);
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, H, 96, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.35, ior: 1.45, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 1, side: THREE.DoubleSide })
  );
  pole.add(glass);

  const cap = (y, flip) => {
    const g = new THREE.Group();
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.66, 0.3, 64), gold); g.add(collar);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.055, 16, 64), gold); ring.rotation.x = Math.PI / 2; ring.position.y = flip * -0.17; g.add(ring);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.56, 64, 32, 0, Math.PI * 2, 0, Math.PI / 2), gold); dome.scale.y = 0.62; dome.position.y = 0.14; if (flip < 0) { dome.rotation.x = Math.PI; dome.position.y = -0.14; } g.add(dome);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.15, 32, 16), gold); knob.position.y = flip * 0.58; g.add(knob);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.22, 24), gold); neck.position.y = flip * 0.44; g.add(neck);
    g.position.y = y;
    return g;
  };
  pole.add(cap(H / 2 + 0.15, 1));
  pole.add(cap(-H / 2 - 0.15, -1));
  pole.rotation.z = -0.08;
  scene.add(pole);

  const key = new THREE.DirectionalLight(0xffe2bf, 2.2); key.position.set(3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xb5363e, 1.4); rim.position.set(-4, 1, -3); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x6b4a50, 0.6));

  const resize = () => fit(renderer, camera, canvas);
  resize();
  new ResizeObserver(resize).observe(canvas);

  /* interaction: cursor tilts it, drag spins it, scrolling speeds the stripes */
  const tgt = { x: 0, y: 0 };
  let dragV = 0, dragging = false, lastX = 0, lastScroll = scrollY, scrollBoost = 0;
  const onMove = (e) => { tgt.y = (e.clientX / innerWidth - 0.5) * 0.7; tgt.x = (e.clientY / innerHeight - 0.5) * 0.35; };
  if (finePointer) addEventListener('pointermove', onMove, { passive: true });
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!dragging) return; dragV = (e.clientX - lastX) * 0.012; lastX = e.clientX; spin.rotation.y += dragV; });
  const up = () => { dragging = false; };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

  /* entrance: drops in and spins up */
  pole.scale.setScalar(0.001);
  let t0 = null;
  const ease = (x) => 1 - Math.pow(1 - x, 4);

  const tick = (dt, t) => {
    if (t0 === null) t0 = t;
    const k = Math.min(1, (t - t0) / 1.6);
    const s = reduce ? 1 : 0.6 + ease(k) * 0.4;
    pole.scale.setScalar(k === 0 && !reduce ? 0.001 : s);
    const ds = Math.abs(scrollY - lastScroll); lastScroll = scrollY;
    scrollBoost = Math.min(6, scrollBoost * 0.92 + ds * 0.02);
    map.offset.y -= dt * (0.22 + scrollBoost * 0.25);
    if (!dragging) { dragV *= 0.95; spin.rotation.y += dragV; }
    spin.rotation.y += dt * (0.35 + (1 - ease(k)) * 6);
    pole.rotation.x += ((reduce ? 0 : tgt.x) - pole.rotation.x) * 0.06;
    pole.rotation.y += ((reduce ? 0 : tgt.y) - pole.rotation.y) * 0.06;
    pole.position.y = Math.sin(t * 1.1) * 0.08;
    renderer.render(scene, camera);
  };
  if (reduce) { tick(0, 10); return; }
  loopWhenVisible(canvas, tick);
}

/* ======================= TOP HAT ======================= */
function initHat() {
  const canvas = document.getElementById('hat');
  if (!canvas) return;
  let started = false;
  const start = () => {
    if (started) return; started = true;
    const renderer = makeRenderer(canvas);
    if (!renderer) { canvas.parentElement.remove(); return; }
    const scene = new THREE.Scene();
    scene.environment = envFor(renderer);
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 1.6, 6.4);
    camera.lookAt(0, 0.45, 0);

    const felt = new THREE.MeshPhysicalMaterial({ color: 0x0f0d0e, roughness: 0.88, metalness: 0, sheen: 0.7, sheenColor: new THREE.Color(0x5a4850), sheenRoughness: 0.5 });
    const band = new THREE.MeshStandardMaterial({ color: WINE, roughness: 0.45, metalness: 0.1 });
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.25 });

    const hat = new THREE.Group();
    const pts = [[0, 1.3], [0.5, 1.3], [0.6, 1.28], [0.635, 1.22], [0.6, 0.7], [0.57, 0.22], [0.58, 0.04]].map(([x, y]) => new THREE.Vector2(x, y));
    const crown = new THREE.Mesh(new THREE.LatheGeometry(pts, 96), felt);
    hat.add(crown);
    const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.586, 0.592, 0.26, 96, 1, true), band); ribbon.position.y = 0.2; hat.add(ribbon);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.04), gold); buckle.position.set(0, 0.2, 0.6); hat.add(buckle);
    const brimPts = [[0.58, 0.04], [0.85, 0.0], [1.05, 0.03], [1.16, 0.1], [1.19, 0.15], [1.15, 0.12], [1.03, 0.05], [0.85, 0.035], [0.58, 0.06]].map(([x, y]) => new THREE.Vector2(x, y));
    const brim = new THREE.Mesh(new THREE.LatheGeometry(brimPts, 128), felt);
    brim.scale.z = 0.82;
    hat.add(brim);
    hat.rotation.x = 0.12;
    const holder = new THREE.Group();
    holder.add(hat);
    scene.add(holder);

    const key = new THREE.DirectionalLight(0xffe2bf, 2.4); key.position.set(3, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfae72, 2.2); rim.position.set(-3, 2, -4); scene.add(rim);
    scene.add(new THREE.AmbientLight(0x5b323a, 0.8));

    const resize = () => fit(renderer, camera, canvas);
    resize();
    new ResizeObserver(resize).observe(canvas);

    const tgt = { x: 0, y: 0 };
    if (finePointer) addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      tgt.y = Math.max(-0.9, Math.min(0.9, ((e.clientX - (r.left + r.width / 2)) / innerWidth) * 1.8));
      tgt.x = Math.max(-0.35, Math.min(0.35, ((e.clientY - (r.top + r.height / 2)) / innerHeight) * 0.8));
    }, { passive: true });

    /* the tip of the hat: lift, tilt, settle */
    let tip = 0, tipT = -1;
    const doTip = () => { if (tipT < 0) tipT = 0; };
    canvas.addEventListener('click', doTip);
    new IntersectionObserver(([e], o) => { if (e.isIntersecting) { setTimeout(doTip, 500); o.disconnect(); } }, { threshold: 0.6 }).observe(canvas);

    const tick = (dt, t) => {
      if (tipT >= 0) { tipT += dt; const p = tipT / 1.4; tip = p < 1 ? Math.sin(p * Math.PI) : 0; if (p >= 1) tipT = -1; }
      holder.position.y = 0.05 + Math.sin(t * 1.2) * 0.06 + tip * 0.75;
      holder.rotation.z = -tip * 0.42;
      holder.rotation.x += (tgt.x - holder.rotation.x) * 0.05;
      hat.rotation.y += dt * 0.25;
      holder.rotation.y += (tgt.y - holder.rotation.y) * 0.05;
      renderer.render(scene, camera);
    };
    if (reduce) { tick(0, 0); return; }
    loopWhenVisible(canvas, tick);
  };
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { start(); o.disconnect(); } }, { rootMargin: '600px' }).observe(canvas);
}

initPole();
initHat();

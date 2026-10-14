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

/* ======================= THE GENTLEMAN =======================
   The headless gentleman from the logo: black tailcoat, white shirt, bow tie, top hat floating above the collar.
   Right hand lifts the hat for a bow, left hand holds barber scissors that snip. Says "Zapraszamy!". */
function initGentleman() {
  const canvas = document.getElementById('gent');
  if (!canvas) return;
  const bubble = document.getElementById('bubble');
  let started = false;
  const start = () => {
    if (started) return; started = true;
    const renderer = makeRenderer(canvas);
    if (!renderer) { canvas.parentElement.classList.add('no-webgl'); return; }
    const scene = new THREE.Scene();
    scene.environment = envFor(renderer);
    const camera = new THREE.PerspectiveCamera(27, 1, 0.1, 100);
    camera.position.set(1.9, 2.05, 7.1);
    camera.lookAt(0, 1.6, 0);

    const black = new THREE.MeshPhysicalMaterial({ color: 0x141113, roughness: 0.62, sheen: 0.6, sheenColor: new THREE.Color(0x4d3d44), sheenRoughness: 0.5 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x1a1618, roughness: 0.7 });
    const white = new THREE.MeshStandardMaterial({ color: 0xf3ece2, roughness: 0.55 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0x0c0a0b, roughness: 0.25, metalness: 0.2 });
    const wine = new THREE.MeshStandardMaterial({ color: WINE, roughness: 0.45 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xdfe3e8, metalness: 1, roughness: 0.18 });
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.25 });
    const cap = (r, len, m) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 24), m);

    const man = new THREE.Group();
    scene.add(man);

    /* legs + shoes */
    [-1, 1].forEach((s) => {
      const leg = cap(0.15, 1.0, trousers); leg.position.set(0.18 * s, 0.72, 0); man.add(leg);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.13, 0.44), shoe); sh.position.set(0.18 * s, 0.07, 0.08); man.add(sh);
    });

    /* torso pivots at the hips so he can bow */
    const torso = new THREE.Group(); torso.position.y = 1.3; man.add(torso);
    const jacketPts = [[0.001, -0.02], [0.3, -0.02], [0.32, 0.2], [0.33, 0.5], [0.42, 0.88], [0.49, 1.0], [0.47, 1.09], [0.3, 1.15], [0.13, 1.19], [0.001, 1.2]].map(([x, y]) => new THREE.Vector2(x, y));
    const jacket = new THREE.Mesh(new THREE.LatheGeometry(jacketPts, 64), black); jacket.scale.z = 0.66; torso.add(jacket);
    const tails = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.75, 0.05), black); tails.position.set(0, -0.3, -0.19); tails.rotation.x = 0.12; torso.add(tails);
    const shirtShape = new THREE.Shape(); shirtShape.moveTo(-0.17, 0.46); shirtShape.lineTo(0.17, 0.46); shirtShape.lineTo(0.03, -0.12); shirtShape.lineTo(-0.03, -0.12); shirtShape.closePath();
    const shirt = new THREE.Mesh(new THREE.ShapeGeometry(shirtShape), white); shirt.position.set(0, 0.68, 0.262); shirt.rotation.x = -0.18; torso.add(shirt);
    const satin = new THREE.MeshPhysicalMaterial({ color: 0x0d0b0c, roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.3 });
    [-1, 1].forEach((s) => {
      const lap = new THREE.Shape(); lap.moveTo(0.17 * s, 0.46); lap.lineTo(0.29 * s, 0.4); lap.lineTo(0.06 * s, -0.18); lap.lineTo(0.03 * s, -0.12); lap.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(lap), satin); m.position.set(0, 0.68, 0.266); m.rotation.x = -0.18; torso.add(m);
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), black); sp.position.set(0.45 * s, 1.0, 0); sp.scale.set(1, 0.8, 0.9); torso.add(sp);
    });
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), gold); btn.position.set(0, 0.5, 0.25); torso.add(btn);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.12, 32), white); collar.position.y = 1.2; torso.add(collar);
    const bow = new THREE.Group(); bow.position.set(0, 1.12, 0.17);
    [-1, 1].forEach((s) => { const w = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 4), black); w.rotation.z = s * Math.PI / 2; w.position.x = s * 0.07; bow.add(w); });
    bow.add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), black));
    torso.add(bow);

    /* the top hat floats where the head would be */
    const hat = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.22, 0.46, 48), black); crown.position.y = 0.26; hat.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.226, 0.226, 0.08, 48, 1, true), wine); band.position.y = 0.08; hat.add(band);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.025, 64), black); brim.scale.z = 0.86; hat.add(brim);
    const brimEdge = new THREE.Mesh(new THREE.TorusGeometry(0.41, 0.022, 10, 64), black); brimEdge.rotation.x = Math.PI / 2; brimEdge.scale.y = 0.86; hat.add(brimEdge);
    const HAT_REST = { x: 0, y: 1.56, z: 0, rx: -0.05, rz: 0.04 };
    torso.add(hat);

    /* arms: shoulder -> elbow -> hand */
    const arm = (side) => {
      const shoulder = new THREE.Group(); shoulder.position.set(0.47 * side, 1.02, 0);
      const upper = cap(0.1, 0.48, black); upper.position.y = -0.3; shoulder.add(upper);
      const elbow = new THREE.Group(); elbow.position.y = -0.6; shoulder.add(elbow);
      const fore = cap(0.09, 0.42, black); fore.position.y = -0.27; elbow.add(fore);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.07, 24), white); cuff.position.y = -0.53; elbow.add(cuff);
      const hand = new THREE.Group(); hand.position.y = -0.64; elbow.add(hand);
      const glove = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 16), white); glove.scale.set(0.9, 1.15, 0.8); hand.add(glove);
      torso.add(shoulder);
      return { shoulder, elbow, hand };
    };
    const R = arm(1), L = arm(-1);

    /* barber scissors in the left hand */
    const scissors = new THREE.Group();
    const blades = [];
    [-1, 1].forEach((s) => {
      const b = new THREE.Group();
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.42, 0.012), steel); blade.position.y = 0.23; b.add(blade);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.08, 4), steel); tip.position.y = 0.48; b.add(tip);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.013, 10, 28), gold); ring.position.set(0.05 * s, -0.08, 0); b.add(ring);
      b.rotation.z = s * 0.18; scissors.add(b); blades.push(b);
    });
    scissors.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), gold));
    scissors.position.set(0, -0.05, 0.06); scissors.rotation.set(0.2, 0, 0.5); scissors.scale.setScalar(1.45);
    L.hand.add(scissors);

    /* resting pose */
    const REST = { rUx: 0.05, rUz: 0.14, rE: -0.12, lUx: -0.35, lUz: -0.22, lE: -1.25 };
    const pose = { bow: 0, ...REST };
    const hp = { ...HAT_REST };
    const applyPose = () => {
      torso.rotation.x = pose.bow;
      R.shoulder.rotation.set(pose.rUx, 0, pose.rUz); R.elbow.rotation.x = pose.rE;
      L.shoulder.rotation.set(pose.lUx, 0, pose.lUz); L.elbow.rotation.x = pose.lE;
      hat.position.set(hp.x, hp.y, hp.z); hat.rotation.set(hp.rx, 0, hp.rz);
    };
    applyPose();

    /* soft floor shadow */
    const sc = document.createElement('canvas'); sc.width = sc.height = 128;
    const sg = sc.getContext('2d'); const grd = sg.createRadialGradient(64, 64, 4, 64, 64, 62); grd.addColorStop(0, 'rgba(0,0,0,.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = grd; sg.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.005; scene.add(shadow);

    const key = new THREE.DirectionalLight(0xffe2bf, 2.6); key.position.set(3, 6, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xcfae72, 2.6); rim.position.set(-4, 3, -4); scene.add(rim);
    const fillL = new THREE.DirectionalLight(0xb5363e, 0.8); fillL.position.set(-5, 1, 3); scene.add(fillL);
    scene.add(new THREE.AmbientLight(0x5b323a, 0.9));

    const resize = () => fit(renderer, camera, canvas);
    resize();
    new ResizeObserver(resize).observe(canvas);

    /* the greeting: lift the hat, sweep it to the chest, bow, say "Zapraszamy!", stand up */
    let busy = false;
    const greet = () => {
      if (!window.gsap || busy) return;
      busy = true;
      const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onComplete: () => { busy = false; } });
      tl.to(pose, { rUx: -2.75, rUz: 0.32, rE: -0.35, duration: 0.55 }, 0)
        .to(hp, { y: 1.95, x: 0.2, z: 0.1, rz: -0.35, duration: 0.55 }, 0.12)
        .to(pose, { rUx: -1.15, rUz: 0.18, rE: -1.55, bow: 0.5, duration: 0.75, ease: 'power3.inOut' }, 0.6)
        .to(hp, { x: 0.22, y: 0.95, z: 0.62, rx: 1.35, rz: -0.1, duration: 0.75, ease: 'power3.inOut' }, 0.6)
        .to(pose, { lUx: -0.1, lUz: -0.55, lE: -0.6, duration: 0.6 }, 0.65)
        .add(() => { if (bubble) gsap.to(bubble, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' }); }, 0.9)
        .to({}, { duration: 0.9 })
        .to(pose, { bow: 0, duration: 0.7 }, '>')
        .to(pose, { rUx: -2.75, rUz: 0.32, rE: -0.35, duration: 0.55 }, '<0.1')
        .to(hp, { x: 0.2, y: 1.95, z: 0.1, rx: -0.05, rz: -0.35, duration: 0.55 }, '<')
        .to(hp, { x: HAT_REST.x, y: HAT_REST.y, z: HAT_REST.z, rz: HAT_REST.rz, duration: 0.45 }, '>')
        .to(pose, { ...REST, duration: 0.6 }, '<')
        .add(() => { if (bubble) gsap.to(bubble, { scale: 0, opacity: 0, duration: 0.35, delay: 1.2 }); }, '>');
    };
    canvas.addEventListener('click', greet);
    canvas.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') greet(); });
    new IntersectionObserver(([e]) => { if (e.isIntersecting) setTimeout(greet, 350); }, { threshold: 0.55 }).observe(canvas);

    const tgt = { y: 0 };
    if (finePointer) addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      tgt.y = Math.max(-0.6, Math.min(0.6, ((e.clientX - (r.left + r.width / 2)) / innerWidth) * 1.4));
    }, { passive: true });

    const tick = (dt, t) => {
      const snip = Math.max(0, Math.sin(t * 7)) * 0.28;
      blades[0].rotation.z = -0.06 - snip; blades[1].rotation.z = 0.06 + snip;
      man.rotation.y += (-0.35 + tgt.y - man.rotation.y) * 0.05;
      torso.position.y = 1.3 + Math.sin(t * 1.6) * 0.012;
      applyPose();
      renderer.render(scene, camera);
    };
    if (reduce) { man.rotation.y = -0.35; tick(0, 0); if (bubble) { bubble.style.transform = 'none'; bubble.style.opacity = 1; } return; }
    loopWhenVisible(canvas, tick);
  };
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { start(); o.disconnect(); } }, { rootMargin: '600px' }).observe(canvas);
}

initPole();
initGentleman();

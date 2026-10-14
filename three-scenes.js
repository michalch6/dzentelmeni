/* Dżentelmeni – sceny 3D (three.js): szklany słupek barberski w hero i dżentelmen (model z kośćmi) na końcu strony */
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

/* ======================= GENTLEMAN =======================
   A rigged mannequin (X Bot by Mixamo, as shipped with the three.js examples; slimmed to the idle clip)
   dressed in a frock coat with a painted shirt front,
   gloves and satin lapels. Right hand lifts the top hat and holds it to the chest for a bow,
   left hand shows barber scissors that snip. A speech bubble says "Zapraszamy!". */
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp1 = (v) => Math.min(1, Math.max(-1, v));

function makeTopHat() {
  const felt = new THREE.MeshPhysicalMaterial({ color: 0x0d0b0c, roughness: 0.62, sheen: 1, sheenColor: new THREE.Color(0x5a4a52), sheenRoughness: 0.42, side: THREE.DoubleSide });
  const silk = new THREE.MeshPhysicalMaterial({ color: WINE, roughness: 0.3, sheen: 1, sheenColor: new THREE.Color(0xd68f9a), sheenRoughness: 0.3, clearcoat: 0.35, clearcoatRoughness: 0.35 });
  const pts = (a) => a.map(([x, y]) => new THREE.Vector2(x, y));
  const inner = new THREE.Group();
  inner.add(new THREE.Mesh(new THREE.LatheGeometry(pts([[0.0985, 0], [0.0962, 0.035], [0.0952, 0.08], [0.0975, 0.13], [0.1015, 0.168], [0.1005, 0.177], [0.095, 0.181], [0.0005, 0.181]]), 72), felt));
  inner.add(new THREE.Mesh(new THREE.LatheGeometry(pts([[0.1004, 0.004], [0.0985, 0.03], [0.0978, 0.045]]), 72), silk));
  const brim = new THREE.LatheGeometry(pts([[0.093, 0.007], [0.093, -0.002], [0.156, -0.002], [0.162, 0.002], [0.158, 0.007], [0.093, 0.007]]), 120);
  const p = brim.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) || 1;
    const k = Math.max(0, (r - 0.093) / 0.069), side = (x / r) ** 2;
    p.setY(i, p.getY(i) + 0.034 * k * k * side - 0.007 * k * (1 - side));
  }
  brim.computeVertexNormals();
  inner.add(new THREE.Mesh(brim, felt));
  inner.scale.set(1, 1, 1.12);
  const root = new THREE.Group();
  root.add(inner);
  return root;
}

function makeBowTie(mat) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.009);
  s.bezierCurveTo(0.018, 0.014, 0.038, 0.031, 0.052, 0.027);
  s.quadraticCurveTo(0.061, 0, 0.052, -0.027);
  s.bezierCurveTo(0.038, -0.031, 0.018, -0.014, 0, -0.009);
  s.bezierCurveTo(-0.018, -0.014, -0.038, -0.031, -0.052, -0.027);
  s.quadraticCurveTo(-0.061, 0, -0.052, 0.027);
  s.bezierCurveTo(-0.038, 0.031, -0.018, 0.014, 0, 0.009);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.004, bevelSegments: 4, curveSegments: 20 });
  g.translate(0, 0, -0.005);
  const bow = new THREE.Group();
  bow.add(new THREE.Mesh(g, mat));
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 20, 14), mat);
  knot.scale.set(1, 1.3, 1); knot.position.z = 0.009; bow.add(knot);
  return bow;
}

function makeScissors(steel, gold) {
  const g = new THREE.Group(), blades = [];
  [1, -1].forEach((s) => {
    const b = new THREE.Group(), z = s * 0.0017;
    const sh = new THREE.Shape();
    sh.moveTo(0, -0.014);
    sh.lineTo(0, 0.152);
    sh.quadraticCurveTo(0.003 * s, 0.132, 0.0085 * s, 0.07);
    sh.quadraticCurveTo(0.0112 * s, 0.02, 0.009 * s, -0.004);
    sh.lineTo(0.006 * s, -0.014);
    sh.closePath();
    const bg = new THREE.ExtrudeGeometry(sh, { depth: 0.0018, bevelEnabled: true, bevelThickness: 0.0007, bevelSize: 0.0007, bevelSegments: 2, curveSegments: 14 });
    bg.translate(0, 0, z - 0.0009);
    b.add(new THREE.Mesh(bg, steel));
    const curve = new THREE.CatmullRomCurve3([V3(0.003 * s, -0.008, z), V3(0.011 * s, -0.034, z), V3(0.02 * s, -0.056, z)]);
    b.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.0033, 10), steel));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0165, 0.0036, 12, 40), gold);
    ring.position.set(0.027 * s, -0.071, z); ring.scale.set(1, 0.86, 1); b.add(ring);
    if (s < 0) {
      const tang = new THREE.CatmullRomCurve3([V3(-0.036, -0.083, z), V3(-0.046, -0.094, z), V3(-0.047, -0.108, z), V3(-0.04, -0.114, z)]);
      b.add(new THREE.Mesh(new THREE.TubeGeometry(tang, 16, 0.0028, 8), gold));
    }
    g.add(b); blades.push(b);
  });
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0048, 0.0095, 20), gold);
  screw.rotation.x = Math.PI / 2; g.add(screw);
  return { g, blades };
}

/* frock-coat skirt in rest-pose space: closed at the waist, opening towards the knees */
function makeCoatSkirt() {
  const prof = [[0.13, 1.24], [0.137, 1.16], [0.156, 1.05], [0.168, 0.95], [0.177, 0.8], [0.185, 0.64], [0.193, 0.5]];
  const curve = new THREE.SplineCurve(prof.map(([r, y]) => new THREE.Vector2(r, y)));
  const U = 72, VN = 36, pos = [], idx = [];
  for (let j = 0; j <= VN; j++) {
    const v = j / VN, pr = curve.getPoint(v);
    const gap = 0.05 + 0.4 * Math.pow(v, 1.25);
    for (let i = 0; i <= U; i++) {
      const phi = gap + (Math.PI * 2 - 2 * gap) * (i / U);
      const fold = 1 + 0.018 * v * Math.sin(phi * 9 + 0.6);
      pos.push(Math.sin(phi) * pr.x * 1.3 * fold, pr.y, Math.cos(phi) * pr.x * (1 + 0.04 * v) * fold);
    }
  }
  for (let j = 0; j < VN; j++) for (let i = 0; i < U; i++) {
    const a = j * (U + 1) + i, b = a + 1, c = a + U + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function makePocketSquare(mat) {
  const s = new THREE.Shape();
  s.moveTo(-0.028, 0); s.lineTo(-0.02, 0.022); s.lineTo(-0.008, 0.01); s.lineTo(0.004, 0.028); s.lineTo(0.016, 0.012); s.lineTo(0.026, 0.02); s.lineTo(0.028, 0); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 2 });
  return new THREE.Mesh(g, mat);
}

/* paints the suit onto the mannequin from its skin weights and rest-pose shape:
   r = white (gloves, collar, shirt front), g = satin (lapels, trouser stripe), b = patent leather (shoes) */
function paintSuit(mesh) {
  const geo = mesh.geometry, names = mesh.skeleton.bones.map((b) => b.name);
  const pick = (re) => names.map((n) => re.test(n));
  const isHand = pick(/Hand/), isNeck = pick(/Neck$/), isFoot = pick(/Foot$|Toe/), isLeg = pick(/UpLeg$|Leg$/);
  const P = geo.attributes.position, N = geo.attributes.normal, SI = geo.attributes.skinIndex, SW = geo.attributes.skinWeight;
  const out = new Float32Array(P.count * 4);
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let i = 0; i < P.count; i++) {
    let wh = 0, wn = 0, wf = 0, wl = 0;
    for (let k = 0; k < 4; k++) {
      const j = SI.getComponent(i, k), w = SW.getComponent(i, k);
      if (isHand[j]) wh += w; if (isNeck[j]) wn += w; if (isFoot[j]) wf += w; if (isLeg[j]) wl += w;
    }
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), nx = N.getX(i), nz = N.getZ(i), ax = Math.abs(x);
    let white = Math.max(ss(0.3, 0.6, wh), ss(0.45, 0.75, wn) * (y < 1.53 ? 1 : 0));
    let satin = 0;
    if (z > 0.02 && nz > 0.15 && y > 1.2 && y < 1.5) {
      const t = Math.max(0, (y - 1.245) / (1.48 - 1.245));
      const edge = 0.006 + 0.07 * t;
      if (y > 1.245) white = Math.max(white, ss(edge + 0.003, edge - 0.003, ax));
      satin = ss(edge - 0.003, edge + 0.002, ax) * ss(edge + 0.05, edge + 0.043, ax) * ss(1.21, 1.235, y);
    }
    if (wl > 0.5 && Math.sign(x) * nx > 0.85) satin = 1;
    out[i * 4] = white; out[i * 4 + 1] = satin; out[i * 4 + 2] = ss(0.45, 0.75, wf);
  }
  geo.setAttribute('aPaint', new THREE.BufferAttribute(out, 4));
}

function suitMaterial() {
  const m = new THREE.MeshPhysicalMaterial({ color: 0x100e11, roughness: 0.48, sheen: 0.8, sheenColor: new THREE.Color(0x5e4b55), sheenRoughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.45 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aPaint;\nvarying vec4 vPaint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaint = aPaint;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vPaint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.80, 0.76, 0.70), vPaint.r);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.012, 0.010, 0.012), vPaint.b);')
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.62, vPaint.r);\nroughnessFactor = mix(roughnessFactor, 0.2, vPaint.g);\nroughnessFactor = mix(roughnessFactor, 0.12, vPaint.b);')
      .replace('#include <lights_physical_fragment>', '#include <lights_physical_fragment>\n#ifdef USE_CLEARCOAT\nmaterial.clearcoat = mix(material.clearcoat, 1.0, max(vPaint.g * 0.7, vPaint.b));\n#endif\n#ifdef USE_SHEEN\nmaterial.sheenColor *= (1.0 - max(vPaint.r, vPaint.b));\n#endif');
  };
  return m;
}

function initGentleman() {
  const canvas = document.getElementById('gent');
  if (!canvas) return;
  const box = canvas.parentElement;
  const bubble = document.getElementById('bubble');
  let started = false;
  const start = async () => {
    if (started) return; started = true;
    const renderer = makeRenderer(canvas);
    if (!renderer) { box.classList.add('no-webgl'); return; }
    let gltf;
    try {
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
      gltf = await new GLTFLoader().loadAsync('models/gentleman.glb');
    } catch (e) { box.classList.add('no-webgl'); return; }

    const scene = new THREE.Scene();
    scene.environment = envFor(renderer);
    scene.environmentIntensity = 0.5;
    const camera = new THREE.PerspectiveCamera(25, 1, 0.1, 50);

    const suit = suitMaterial();
    const plain = new THREE.MeshPhysicalMaterial({ color: 0x100e11, roughness: 0.48, sheen: 0.8, sheenColor: new THREE.Color(0x5e4b55), sheenRoughness: 0.5, clearcoat: 0.2, clearcoatRoughness: 0.45, side: THREE.DoubleSide });
    const gold = new THREE.MeshStandardMaterial({ color: GOLD, metalness: 1, roughness: 0.26 });
    const steel = new THREE.MeshStandardMaterial({ color: 0xe6e9ee, metalness: 1, roughness: 0.14 });
    const silk = new THREE.MeshPhysicalMaterial({ color: WINE, roughness: 0.32, sheen: 1, sheenColor: new THREE.Color(0xd68f9a), sheenRoughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.3 });
    const linen = new THREE.MeshStandardMaterial({ color: 0xefe8de, roughness: 0.7 });

    const model = gltf.scene;
    const meshes = [];
    model.traverse((o) => { if (o.isSkinnedMesh) { o.frustumCulled = false; paintSuit(o); o.material = suit; meshes.push(o); } });
    if (!meshes.length) { box.classList.add('no-webgl'); return; }
    const skel = meshes[0].skeleton;
    const rig = new THREE.Group();
    rig.add(model); scene.add(rig);

    const J = {};
    ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand',
      'RightArm', 'RightForeArm', 'RightHand', 'RightHandMiddle1'].forEach((n) => { J[n] = skel.bones.find((b) => b.name.replace(':', '') === 'mixamorig' + n); });
    if (Object.values(J).some((b) => !b)) { box.classList.add('no-webgl'); return; }

    const mixer = new THREE.AnimationMixer(model);
    const clip = gltf.animations.find((a) => a.name === 'idle') || gltf.animations[0];
    if (clip) mixer.clipAction(clip).play();

    /* ---- accessories ride on the bones through the same matrices as the skin ---- */
    const X = V3(1, 0, 0), Z = V3(0, 0, 1);
    const _M = new THREE.Matrix4();
    const skinM = (b, out) => out.multiplyMatrices(b.matrixWorld, skel.boneInverses[b.userData.i]);
    skel.bones.forEach((b, i) => { b.userData.i = i; });
    const probe = (x, y, r = 0.012) => {
      let best = null;
      for (const me of meshes) {
        const P = me.geometry.attributes.position, N = me.geometry.attributes.normal, SI = me.geometry.attributes.skinIndex, SW = me.geometry.attributes.skinWeight;
        for (let i = 0; i < P.count; i++) {
          if (Math.abs(P.getX(i) - x) > r || Math.abs(P.getY(i) - y) > r) continue;
          const z = P.getZ(i);
          if (best && z <= best.p.z) continue;
          let bw = -1, bj = 0;
          for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w > bw) { bw = w; bj = SI.getComponent(i, k); } }
          best = { p: V3(P.getX(i), P.getY(i), z), n: V3(N.getX(i), N.getY(i), N.getZ(i)).normalize(), bone: skel.bones[bj] };
        }
      }
      return best;
    };
    const att = [];
    const attach = (obj, bone, pos, quat = new THREE.Quaternion(), scl = 1) => {
      obj.matrixAutoUpdate = false; scene.add(obj);
      att.push({ obj, bone, local: new THREE.Matrix4().compose(pos, quat, V3(scl, scl, scl)) });
    };
    const onSurface = (obj, x, y, lift, spin = 0) => {
      const s = probe(x, y); if (!s) return;
      const q = new THREE.Quaternion().setFromUnitVectors(Z, s.n).multiply(new THREE.Quaternion().setFromAxisAngle(Z, spin));
      attach(obj, s.bone, s.p.clone().addScaledVector(s.n, lift), q);
    };

    const bow = makeBowTie(silk);
    attach(bow, J.Neck, V3(0, 1.487, 0.037), new THREE.Quaternion().setFromAxisAngle(X, -0.12));
    onSurface(makePocketSquare(linen), 0.088, 1.385, -0.002, 0.08);
    attach(new THREE.Mesh(makeCoatSkirt(), plain), J.Hips, V3(0, 0, 0));
    const btn = new THREE.Mesh(new THREE.SphereGeometry(0.012, 20, 12), gold); btn.scale.z = 0.5;
    attach(btn, J.Hips, V3(0, 1.215, 0.133));
    /* scissors: blades along the thumb, rings in the palm */
    const sc = makeScissors(steel, gold);
    attach(sc.g, J.LeftHand, V3(0.79, 1.4, 0.05), new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V3(1, 0, 0), V3(0, 0, 1), V3(0, -1, 0))), 1.6);
    const hat = makeTopHat(); scene.add(hat);

    /* soft floor shadow */
    const shc = document.createElement('canvas'); shc.width = shc.height = 128;
    const sg = shc.getContext('2d'); const grd = sg.createRadialGradient(64, 64, 2, 64, 64, 62);
    grd.addColorStop(0, 'rgba(0,0,0,.7)'); grd.addColorStop(1, 'rgba(0,0,0,0)'); sg.fillStyle = grd; sg.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shc), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.003; scene.add(shadow);

    const key = new THREE.DirectionalLight(0xffe6c8, 2.6); key.position.set(2.5, 3.5, 4); scene.add(key);
    const rimL = new THREE.DirectionalLight(0xe4cb95, 6); rimL.position.set(-3.5, 2.6, -2.5); scene.add(rimL);
    const rimR = new THREE.DirectionalLight(0xd07a88, 4); rimR.position.set(3.5, 2.2, -3); scene.add(rimR);
    scene.add(new THREE.HemisphereLight(0x6b4a52, 0x0a0809, 0.8));

    /* ---- pose helpers (world space) ---- */
    const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _m = new THREE.Quaternion();
    const rotWorld = (b, axis, ang) => {
      if (!ang || !isFinite(ang)) return;
      b.parent.getWorldQuaternion(_pq);
      _q.setFromAxisAngle(axis, ang);
      _m.copy(_pq).invert().multiply(_q).multiply(_pq);
      b.quaternion.premultiply(_m);
      b.updateMatrixWorld(true);
    };
    const wp = (b, v) => b.getWorldPosition(v);
    const A = V3(), B = V3(), C = V3(), t1 = V3(), t2 = V3(), t3 = V3(), nn = V3();

    /* two-bone IK: bend the elbow to the right length, aim at the target, swing the elbow toward the pole */
    const ik = (up, lo, end, target, pole) => {
      wp(up, A); wp(lo, B); wp(end, C);
      const lab = A.distanceTo(B), lbc = B.distanceTo(C);
      const lat = Math.min(Math.max(A.distanceTo(target), 0.05), lab + lbc - 0.003);
      t1.subVectors(A, B).normalize(); t2.subVectors(C, B).normalize();
      const cur = Math.acos(clamp1(t1.dot(t2)));
      const want = Math.acos(clamp1((lab * lab + lbc * lbc - lat * lat) / (2 * lab * lbc)));
      nn.crossVectors(t1, t2);
      if (nn.lengthSq() < 1e-8) nn.subVectors(pole, B).cross(t1);
      rotWorld(lo, nn.normalize(), want - cur);
      wp(end, C);
      t1.subVectors(C, A).normalize(); t2.subVectors(target, A).normalize();
      nn.crossVectors(t1, t2);
      if (nn.lengthSq() > 1e-10) rotWorld(up, nn.normalize(), Math.acos(clamp1(t1.dot(t2))));
      wp(lo, B);
      t1.subVectors(B, A); t1.addScaledVector(t2, -t1.dot(t2));
      t3.subVectors(pole, A); t3.addScaledVector(t2, -t3.dot(t2));
      if (t1.lengthSq() > 1e-8 && t3.lengthSq() > 1e-8) {
        t1.normalize(); t3.normalize();
        let a = Math.acos(clamp1(t1.dot(t3)));
        if (nn.crossVectors(t1, t3).dot(t2) < 0) a = -a;
        rotWorld(up, t2, a);
      }
    };

    /* everything the greeting animates */
    const P = { reach: 0, lift: 0, sweep: 0, bow: 0, out: 0 };
    const CFG = {
      hatOn: [0, 1.70, -0.004], hatTilt: [-0.05, 0, 0.07], lift: [0, 0.17, 0.05], tip: 0.3,
      hatChest: [0.05, 1.3, 0.27], chestTilt: [1.45, 0, 0.1],
      grip: [-0.075, 0.006, 0.15],
      bowAng: [0.3, 0.26, 0.2, 0.06, 0.16],
      lIdle: [0.27, 1.25, 0.26], lOut: [0.5, 1.12, 0.38],
      rPole: [-0.8, -0.9, -0.5], rPoleUp: [-1, 0.1, 0.4], lPole: [0.8, -0.9, -0.6],
      yaw: 0.62, cam: [0.6, 1.3, 4.1], look: [0.05, 1.24, 0], fov: 25,
    };
    const fromRig = (out, a) => out.set(a[0], a[1], a[2]).applyMatrix4(rig.matrixWorld);
    const placeCamera = () => { camera.fov = CFG.fov; camera.position.set(...CFG.cam); camera.lookAt(...CFG.look); camera.updateProjectionMatrix(); };
    const resize = () => { fit(renderer, camera, canvas); placeCamera(); };
    resize();
    new ResizeObserver(resize).observe(canvas);

    const mOn = new THREE.Matrix4(), mCh = new THREE.Matrix4(), mL = new THREE.Matrix4();
    const pa = V3(), pb = V3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), sv = V3(), eu = new THREE.Euler();
    const grip = V3(), handRest = V3(), tgt = V3(), pole = V3(), lRest = V3(), bowAxis = V3();
    let look = 0;

    const pose = (dt) => {
      mixer.update(dt);
      rig.rotation.y = CFG.yaw + look;
      rig.updateMatrixWorld(true);

      /* the bow: curl the spine forward */
      bowAxis.set(1, 0, 0).applyQuaternion(rig.quaternion);
      if (P.bow > 0.001) ['Spine', 'Spine1', 'Spine2', 'Neck', 'Head'].forEach((n, i) => rotWorld(J[n], bowAxis, P.bow * CFG.bowAng[i]));

      /* the hat: on the head (raised and tipped by "lift"), blending to held over the heart */
      eu.set(CFG.hatTilt[0] + P.lift * CFG.tip, 0, CFG.hatTilt[2] * (1 - P.lift));
      mL.compose(sv.set(CFG.hatOn[0] + CFG.lift[0] * P.lift, CFG.hatOn[1] + CFG.lift[1] * P.lift, CFG.hatOn[2] + CFG.lift[2] * P.lift), qa.setFromEuler(eu), V3(1, 1, 1));
      mOn.multiplyMatrices(skinM(J.Head, _M), mL);
      mL.compose(sv.set(...CFG.hatChest), qa.setFromEuler(eu.set(...CFG.chestTilt)), V3(1, 1, 1));
      mCh.multiplyMatrices(skinM(J.Spine2, _M), mL);
      mOn.decompose(pa, qa, sv); mCh.decompose(pb, qb, sv);
      hat.position.lerpVectors(pa, pb, P.sweep);
      hat.quaternion.slerpQuaternions(qa, qb, P.sweep);
      hat.updateMatrixWorld(true);

      /* right hand reaches for the brim and carries the hat */
      if (P.reach > 0.001) {
        wp(J.RightHand, handRest);
        grip.set(...CFG.grip).applyMatrix4(hat.matrixWorld);
        wp(J.RightHandMiddle1, t3).sub(handRest);
        grip.addScaledVector(t3, -0.8);
        tgt.lerpVectors(handRest, grip, P.reach);
        wp(J.RightArm, A);
        const k = Math.max(P.lift, P.reach * 0.6) * (1 - P.sweep);
        pole.set(
          CFG.rPole[0] + (CFG.rPoleUp[0] - CFG.rPole[0]) * k,
          CFG.rPole[1] + (CFG.rPoleUp[1] - CFG.rPole[1]) * k,
          CFG.rPole[2] + (CFG.rPoleUp[2] - CFG.rPole[2]) * k
        ).applyQuaternion(rig.quaternion).add(A);
        ik(J.RightArm, J.RightForeArm, J.RightHand, tgt, pole);
      }

      /* left hand shows the scissors, then opens out to the side during the bow */
      fromRig(lRest, CFG.lIdle);
      fromRig(tgt, CFG.lOut);
      tgt.lerpVectors(lRest, tgt, P.out);
      wp(J.LeftArm, A);
      pole.set(...CFG.lPole).applyQuaternion(rig.quaternion).add(A);
      ik(J.LeftArm, J.LeftForeArm, J.LeftHand, tgt, pole);

      att.forEach((a) => a.obj.matrix.multiplyMatrices(skinM(a.bone, _M), a.local));
    };

    /* the greeting: lift the hat, sweep it to the chest, bow, "Zapraszamy!", stand up, hat back on */
    let tl = null;
    const greet = () => {
      if (!window.gsap || (tl && tl.isActive())) return;
      tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
      tl.to(P, { reach: 1, duration: 0.5 }, 0)
        .to(P, { lift: 1, duration: 0.45 }, 0.42)
        .to(P, { sweep: 1, duration: 0.85, ease: 'power3.inOut' }, 0.95)
        .to(P, { bow: 1, duration: 0.9, ease: 'power3.inOut' }, 1.0)
        .to(P, { out: 1, duration: 0.8 }, 1.05)
        .add(() => { if (bubble) gsap.to(bubble, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)' }); }, 1.45)
        .to(P, { bow: 0, out: 0, duration: 0.8 }, 2.9)
        .to(P, { sweep: 0, duration: 0.75 }, 2.9)
        .to(P, { lift: 0, duration: 0.4 }, 3.62)
        .to(P, { reach: 0, duration: 0.55 }, 3.95)
        .add(() => { if (bubble) gsap.to(bubble, { scale: 0, opacity: 0, duration: 0.35, delay: 1 }); }, 4.2);
    };
    canvas.addEventListener('click', greet);
    canvas.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') greet(); });

    let lookT = 0;
    if (finePointer) addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      lookT = Math.max(-0.5, Math.min(0.5, ((e.clientX - (r.left + r.width / 2)) / innerWidth) * 1.2));
    }, { passive: true });

    const render = (dt, t) => {
      const ph = t % 2.8;
      const open = ph < 0.72 ? Math.abs(Math.sin((ph / 0.72) * Math.PI * 2)) * 0.34 + 0.02 : 0.02;
      sc.blades[0].rotation.z = -open; sc.blades[1].rotation.z = open;
      look += (lookT - look) * 0.06;
      pose(dt);
      renderer.render(scene, camera);
    };
    window.__gent = { P, CFG, render, greet, placeCamera, get tl() { return tl; }, camera, rig, J };

    canvas.style.opacity = 1;
    if (reduce) { render(0, 0); if (bubble) { bubble.style.transform = 'none'; bubble.style.opacity = 1; } return; }
    loopWhenVisible(canvas, render);
    new IntersectionObserver(([e]) => { if (e.isIntersecting) setTimeout(greet, 300); }, { threshold: 0.6 }).observe(canvas);
  };
  new IntersectionObserver(([e], o) => { if (e.isIntersecting) { start(); o.disconnect(); } }, { rootMargin: '900px' }).observe(canvas);
}

initPole();
initGentleman();

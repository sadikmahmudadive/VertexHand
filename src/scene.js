/* The 3D diorama — one fixed canvas behind the hero and the pinned process.

   A pale "clay" tech city (data centre, towers, phone monolith, cell tower…)
   plus a tile plaza. Scrolling does two things:
     · the hero scrolls away while the camera glides from the city overview to
       the first process station;
     · inside the pinned process, a 0..5 "step position" drives everything —
       radar pulse, tile light-wave, tiles growing into a skyline, three light
       beams, an orbit ring — and moves the camera to a viewpoint per step.
   All of it is a pure function of scroll, so it scrubs both ways.
   Only renders while the hero/process are on screen. */

import * as THREE from "three";

const canvas = document.getElementById("scene");
const section = document.getElementById("process");
const stepEls = [...document.querySelectorAll(".pstep")];
const loader = document.getElementById("loader");
const loadbar = document.getElementById("loadbar");

if (canvas && section && stepEls.length) init();

function init() {
  const STEPS = stepEls.length;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const narrow = () => innerWidth < 860;
  const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rnd = mulberry32(31);

  const BG = 0xd8e3ef, ACCENT = 0x3b4be0;

  /* ── renderer / scene ── */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, narrow() ? 1.25 : 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.toneMapping = THREE.NeutralToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.fog = new THREE.Fog(BG, 90, 175);
  const camera = new THREE.PerspectiveCamera(24, 1, 1, 420);

  scene.add(new THREE.HemisphereLight(0xeef4ff, 0x9fb2cc, 1.25));
  const sun = new THREE.DirectionalLight(0xfff0dc, 2.5);
  sun.position.set(-4, 40, 26);
  sun.target.position.set(14, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(narrow() ? 1024 : 2048, narrow() ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -54, right: 54, top: 54, bottom: -54, near: 1, far: 130 });
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.ShadowMaterial({ color: 0x3d5170, opacity: 0.2 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ── materials ── */
  function windowTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d");
    g.fillStyle = "#f3f7fb";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#c9d6e6";
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) g.fillRect(7 + x * 30, 9 + y * 30, 18, 17);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  }
  const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra });
  const M = {
    wall: std(0xf3f7fb), roof: std(0xe2eaf3), win: std(0xffffff, { map: windowTexture() }),
    foliage: std(0xdfe9f3), trunk: std(0xc4d1df), dark: std(0x232a44, { roughness: 0.5 }),
    accent: std(ACCENT, { roughness: 0.5, emissive: ACCENT, emissiveIntensity: 0.25 }),
    beacon: std(ACCENT, { roughness: 0.4, emissive: ACCENT, emissiveIntensity: 1.2 }),
  };

  /* ── tiny modelling helpers ── */
  const mk = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; };
  const bx = (w, h, d, mat, x, y, z) => mk(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), mat, x, y, z);
  const cy = (rt, rb, h, mat, x, y, z, seg = 20) => mk(new THREE.CylinderGeometry(rt, rb, h, seg).translate(0, h / 2, 0), mat, x, y, z);
  function wbox(w, h, d, x = 0, y = 0, z = 0) {
    const g = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0);
    const uv = g.attributes.uv, S = 2.6;
    const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * sizes[f][0]) / S, (uv.getY(i) * sizes[f][1]) / S);
    }
    const m = new THREE.Mesh(g, [M.win, M.win, M.roof, M.roof, M.win, M.win]);
    m.position.set(x, y, z);
    return m;
  }

  /* ── the city ── */
  const city = new THREE.Group();
  scene.add(city);
  const solids = []; // [x, z, r] — keeps trees out of buildings
  const at = (obj, x, z, ry = 0, r = 0) => { obj.position.set(x, 0, z); obj.rotation.y = ry; city.add(obj); if (r) solids.push([x, z, r]); return obj; };

  function stepped(x, z, tiers, ry = 0) {
    const g = new THREE.Group();
    let y = 0;
    for (const [w, h, d] of tiers) { g.add(wbox(w, h, d, 0, y, 0)); y += h; }
    g.add(cy(0.07, 0.07, 1.6, M.wall, 0, y, 0, 6));
    return at(g, x, z, ry, tiers[0][0] * 0.8);
  }
  function dataCentre(x, z) {
    const g = new THREE.Group();
    g.add(bx(8, 2.4, 3.8, M.wall, 0, 0, 0));
    for (let i = 0; i < 4; i++) g.add(bx(1.3, 0.55, 1.3, M.roof, -2.9 + i * 1.95, 2.4, 0.5));
    g.add(bx(8.04, 0.2, 0.06, M.accent, 0, 1.15, 1.9));
    g.add(bx(1.4, 1.5, 0.08, M.dark, 2.6, 0, 1.93));
    for (const dx of [-1.2, 0.6]) g.add(cy(0.55, 0.55, 0.5, M.roof, dx, 2.4, -1.2));
    return at(g, x, z, 0.2, 5);
  }
  function racks(x, z) {
    const g = new THREE.Group();
    for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) {
      g.add(bx(1.1, 1.7, 0.85, M.wall, c * 1.35, 0, r * 1.15));
      g.add(bx(0.8, 0.07, 0.3, M.accent, c * 1.35, 1.7, r * 1.15));
    }
    return at(g, x, z, 0, 2.6);
  }
  function tank(x, z, r, h) {
    const g = new THREE.Group();
    g.add(cy(r, r, h, M.wall, 0, 0, 0, 28));
    g.add(cy(r * 0.96, r * 0.96, 0.12, M.roof, 0, h, 0, 28));
    g.add(cy(0.12, 0.12, 0.9, M.wall, r * 0.3, h, 0, 8));
    return at(g, x, z, 0, r + 0.3);
  }
  function shed(x, z, w, d, ry) {
    const wallH = 1.3, roofH = 0.9;
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, wallH); s.lineTo(0, wallH + roofH); s.lineTo(-w / 2, wallH); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }).translate(0, 0, -d / 2);
    const grp = new THREE.Group();
    grp.add(mk(g, M.wall));
    grp.add(bx(1.2, 0.9, 0.08, M.dark, w * 0.2, 0, d / 2 + 0.01));
    return at(grp, x, z, ry, Math.max(w, d) * 0.55);
  }
  let beacon = null;
  function cellTower(x, z) {
    const g = new THREE.Group();
    g.add(mk(new THREE.CylinderGeometry(0.08, 0.34, 10.5, 8).translate(0, 5.25, 0), M.wall));
    for (const h of [4.2, 6.6, 9]) {
      g.add(cy(0.95, 0.95, 0.08, M.roof, 0, h, 0, 20));
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI * 2;
        g.add(bx(0.18, 0.7, 0.4, M.wall, Math.cos(a) * 0.9, h + 0.1, Math.sin(a) * 0.9));
      }
    }
    beacon = mk(new THREE.SphereGeometry(0.2, 12, 10), M.beacon, 0, 10.7, 0);
    g.add(beacon);
    return at(g, x, z, 0, 1.2);
  }
  let dish = null;
  function dishAt(x, z) {
    const g = new THREE.Group();
    g.add(cy(0.09, 0.14, 1.5, M.wall, 0, 0, 0, 8));
    dish = new THREE.Group();
    const bowl = mk(new THREE.SphereGeometry(1.1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.7), M.wall);
    bowl.rotation.x = Math.PI - 0.5;
    bowl.scale.set(1, 1, 1);
    dish.add(bowl);
    dish.add(cy(0.04, 0.04, 0.9, M.dark, 0, 0, 0.0, 6).translateY(-0.1));
    dish.position.y = 1.9;
    g.add(dish);
    return at(g, x, z, 0.6, 1.2);
  }
  function phoneMonolith(x, z) {
    const g = new THREE.Group();
    g.add(bx(2.5, 6.6, 0.85, M.wall, 0, 0, 0));
    g.add(bx(2.15, 6.0, 0.06, M.dark, 0, 0.3, 0.44));
    g.add(mk(new THREE.SphereGeometry(0.07, 8, 6), M.dark, 0, 6.35, 0.44));
    // a little UI on the screen
    g.add(bx(1.7, 0.7, 0.05, M.accent, 0, 4.6, 0.48));
    for (let i = 0; i < 3; i++) g.add(bx(1.7, 0.42, 0.05, M.roof, 0, 3.55 - i * 0.62, 0.48));
    g.add(bx(0.7, 0.7, 0.05, M.roof, -0.5, 1.2, 0.48));
    g.add(bx(0.7, 0.7, 0.05, M.roof, 0.5, 1.2, 0.48));
    return at(g, x, z, 0.5, 1.8);
  }
  function tree(x, z, s = 1) {
    const g = new THREE.Group();
    g.add(cy(0.05 * s, 0.08 * s, 0.75 * s, M.trunk, 0, 0, 0, 6));
    g.add(mk(new THREE.ConeGeometry(0.5 * s, 1.4 * s, 9).translate(0, 0.7 * s, 0), M.foliage, 0, 0.7 * s, 0));
    return at(g, x, z);
  }

  stepped(4, -2, [[3.8, 4.4, 3.8], [2.9, 3.4, 2.9], [1.9, 3.0, 1.9]]);
  stepped(-2.5, -6, [[3.2, 5.2, 3.2], [2.3, 3.2, 2.3]], 0.1);
  stepped(9.5, 3, [[4, 4.2, 4], [2.8, 2.2, 2.8]], -0.15);
  stepped(-8, -1.5, [[3, 8.2, 3]]);
  stepped(11, -6.5, [[3.4, 2.8, 3.4], [2.4, 2.4, 2.4]]);
  stepped(-5, 8.5, [[3.4, 3.4, 3.4], [2.4, 2.2, 2.4]], 0.2);
  dataCentre(-14, 3);
  racks(0.8, 6.6);
  tank(-11, -6, 1.6, 3.2);
  tank(-8, -7.8, 1.15, 2.3);
  shed(13.5, -1, 5.4, 2.8, 0.1);
  shed(-1, 11.5, 5, 2.6, 0.05);
  shed(6, -10, 5.4, 2.8, -0.08);
  cellTower(7, -7);
  dishAt(-4.5, 2.2);
  phoneMonolith(1.2, 0.6);
  // trees fill the gaps
  let placed = 0, guard = 0;
  while (placed < 20 && guard++ < 400) {
    const x = (rnd() - 0.5) * 36, z = (rnd() - 0.5) * 26;
    if (solids.some(([sx, sz, r]) => Math.hypot(sx - x, sz - z) < r + 1.0)) continue;
    tree(x, z, 0.8 + rnd() * 0.6);
    placed++;
  }
  city.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const introKids = city.children.map((o) => ({ o, d: 0.05 + (Math.hypot(o.position.x + 2, o.position.z) / 36) * 0.5 + rnd() * 0.12, sy: o.scale.y }));
  introKids.forEach((k) => { k.o.visible = false; });
  const easeOutBack = (x) => { const c1 = 1.35, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
  const easeOutCubic = (x) => 1 - Math.pow(1 - x, 3);
  const inOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

  /* ── dot fields (radar rings run through them) ── */
  function dotField(cx, cz, radius, spacing) {
    const pos = [], rr = [];
    const n = Math.ceil((radius * 2) / spacing);
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
      const x = -radius + i * spacing, z = -radius + j * spacing;
      if (Math.hypot(x, z) > radius) continue;
      pos.push(x, 0, z); rr.push(rnd());
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("aRand", new THREE.Float32BufferAttribute(rr, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uPR: { value: renderer.getPixelRatio() }, uR1: { value: 0 }, uR2: { value: 0 }, uK: { value: 0 }, uBase: { value: 0 }, uRad: { value: radius } },
      vertexShader: /* glsl */ `
        uniform float uTime, uPR, uR1, uR2, uK, uBase, uRad;
        attribute float aRand;
        varying float vA;
        void main() {
          float d = length(position.xz);
          float a = (d - uR1) * 1.1, b = (d - uR2) * 1.1;
          float ring = exp(-a * a) + 0.6 * exp(-b * b);
          vec3 p = position;
          p.y += ring * uK * 0.4;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float base = (0.3 + 0.15 * sin(uTime * 0.9 + aRand * 6.283)) * uBase;
          vA = (base + ring * uK * 0.95) * (1.0 - smoothstep(uRad * 0.5, uRad, d));
          gl_PointSize = (2.4 + 5.0 * ring * uK) * uPR * (34.0 / -mv.z);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          gl_FragColor = vec4(vec3(0.23, 0.29, 0.88), clamp(vA, 0.0, 1.0) * (1.0 - d * 2.0));
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    pts.position.set(cx, 0.05, cz);
    pts.frustumCulled = false;
    pts.renderOrder = 2;
    scene.add(pts);
    return mat;
  }

  const DC = new THREE.Vector3(-14, 0, 3);      // radar site (discover)
  const PL = new THREE.Vector3(33, 0, -4);      // plaza (design → support)
  const radarMat = dotField(DC.x, DC.z, 10, 0.55);
  const plazaMat = dotField(PL.x, PL.z, 14, 0.62);

  // nodes that wake as a ring passes
  const NODES = 12;
  const nodes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 10), M.accent, NODES);
  nodes.frustumCulled = false;
  nodes.castShadow = false;
  const nodePos = [];
  for (let i = 0; i < NODES; i++) {
    const a = (i / NODES) * Math.PI * 2 + rnd() * 0.4, r = 5.8 + rnd() * 3.4;
    nodePos.push([DC.x + Math.cos(a) * r, DC.z + Math.sin(a) * r, r]);
  }
  scene.add(nodes);

  /* ── beams & cables (shared shader) ── */
  function beamMaterial() {
    const u = { uHead: { value: 0 }, uOp: { value: 0 }, uTime: { value: 0 } };
    const m = new THREE.ShaderMaterial({
      uniforms: u,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: /* glsl */ `
        uniform float uHead, uOp, uTime; varying vec2 vUv;
        void main() {
          float behind = uHead - vUv.x;
          float inside = step(0.0, behind);
          float trail = exp(-behind * 3.4) * inside;
          float tip = exp(-behind * 30.0) * inside;
          float flow = 0.5 + 0.5 * sin(vUv.x * 70.0 - uTime * 9.0);
          vec3 col = mix(vec3(0.23, 0.29, 0.88), vec3(0.45, 0.55, 1.0), trail) + vec3(0.91, 0.69, 0.22) * tip * 0.9;
          float a = (0.22 * inside + trail * (0.55 + 0.45 * flow) + tip) * uOp;
          gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
          #include <colorspace_fragment>
        }`,
      transparent: true, depthWrite: false,
    });
    return { m, u };
  }
  function cable(points, radius, offsets, segs = 90) {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = new THREE.TubeGeometry(curve, segs, radius, 5, false);
    const { m, u } = beamMaterial();
    const grp = new THREE.Group();
    offsets.forEach(([ox, oy, oz]) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(ox, oy, oz);
      mesh.frustumCulled = false;
      mesh.renderOrder = 3;
      grp.add(mesh);
    });
    return { grp, u, curve };
  }

  // ground cables from the data centre into the city (visible in discover, subtle in the hero)
  const cab = cable(
    [[-9.6, 3], [-6.8, 3], [-5.4, 1.6], [-5.2, -1], [-4.4, -3.6], [-1.6, -3.9]].map(([x, z]) => new THREE.Vector3(x, 0.1, z)),
    0.055, [[0, 0, 0], [0.17, 0, 0.17], [-0.17, 0, -0.17]],
  );
  scene.add(cab.grp);

  /* ── plaza: tiles → skyline ── */
  const plaza = new THREE.Group();
  plaza.position.copy(PL);
  scene.add(plaza);

  const G = 9, GAP = 1.2, N = G * G;
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.98, 1, 0.98).translate(0, 0.5, 0), std(0xffffff), N);
  tiles.frustumCulled = false;
  tiles.castShadow = tiles.receiveShadow = true;
  plaza.add(tiles);

  const gx = new Float32Array(N), gz = new Float32Array(N), gd = new Float32Array(N);
  const hSky = new Float32Array(N), hCur = new Float32Array(N).fill(0.08), rr = new Float32Array(N);
  let heroIdx = 0;
  for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
    const k = i * G + j;
    gx[k] = (i - (G - 1) / 2) * GAP;
    gz[k] = (j - (G - 1) / 2) * GAP;
    gd[k] = Math.hypot(gx[k], gz[k]);
    rr[k] = rnd();
    const fall = Math.pow(clamp01(1 - gd[k] / 7.0), 1.4);
    hSky[k] = 0.35 + 5.2 * fall * (0.5 + 0.5 * rr[k]);
    if (i === 5 && j === 5) heroIdx = k;
  }
  const tallest = hSky.indexOf(Math.max(...hSky));
  const towerTop = new THREE.Vector3(gx[tallest], hSky[tallest], gz[tallest]);
  const dummy = new THREE.Object3D();
  const tmpC = new THREE.Color();
  tiles.setColorAt(0, tmpC.setRGB(1, 1, 1));

  // the indigo cap tile with an icon on top
  function iconTexture() {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#3b4be0";
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = "#fff";
    g.lineWidth = 16; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(98, 84); g.lineTo(52, 128); g.lineTo(98, 172); g.moveTo(158, 84); g.lineTo(204, 128); g.lineTo(158, 172); g.moveTo(138, 70); g.lineTo(118, 186); g.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const cap = new THREE.Group();
  const capBody = bx(0.98, 1, 0.98, std(ACCENT, { roughness: 0.55, emissive: ACCENT, emissiveIntensity: 0.18 }), 0, 0, 0);
  capBody.castShadow = capBody.receiveShadow = true;
  capBody.scale.y = 0.18;
  cap.add(capBody);
  const capIcon = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: iconTexture() }));
  capIcon.rotation.x = -Math.PI / 2;
  capIcon.position.y = 0.185;
  cap.add(capIcon);
  plaza.add(cap);

  // launch: three beams out of the tallest tower, charge rings, a chevron
  const bCurve = [
    towerTop.clone().add(new THREE.Vector3(0, 0.15, 0)),
    new THREE.Vector3(towerTop.x + 1.2, towerTop.y + 2.0, towerTop.z - 2.4),
    new THREE.Vector3(towerTop.x + 4.0, towerTop.y + 3.4, towerTop.z - 7.5),
    new THREE.Vector3(towerTop.x + 9.5, towerTop.y + 4.2, towerTop.z - 16),
    new THREE.Vector3(towerTop.x + 18, towerTop.y + 4.6, towerTop.z - 30),
  ];
  const beams = cable(bCurve, 0.05, [[-0.2, 0, 0], [0, 0.07, 0], [0.2, 0, 0]], 100);
  plaza.add(beams.grp);

  const ringMat = (c) => new THREE.LineBasicMaterial({ color: c, transparent: true, opacity: 0 });
  const circle = (rad, n = 120) => new THREE.BufferGeometry().setFromPoints(Array.from({ length: n }, (_, i) => new THREE.Vector3(Math.cos((i / n) * Math.PI * 2) * rad, 0, Math.sin((i / n) * Math.PI * 2) * rad)));
  const charge = [1.05, 1.55].map((r, i) => {
    const l = new THREE.LineLoop(circle(r), ringMat(i ? 0x3b4be0 : 0xe9af39));
    l.position.copy(towerTop);
    plaza.add(l);
    return l;
  });

  const chevron = new THREE.Group();
  {
    const s = new THREE.Shape();
    s.moveTo(0, 0); s.lineTo(1.3, 0); s.lineTo(3.4, 2.6); s.lineTo(1.3, 5.2); s.lineTo(0, 5.2); s.lineTo(2.1, 2.6); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false });
    g.translate(-1.7, -2.6, 0);
    const m = new THREE.Mesh(g, M.accent);
    m.rotation.x = -Math.PI / 2;
    m.castShadow = true;
    chevron.add(m);
    for (const [dx, dz, sc] of [[3.4, -3.2, 0.9], [4.8, 0.2, 1.1], [3.4, 3.4, 0.9], [-3.4, -3.6, 0.7]]) {
      const d = bx(1, 0.5, 1, M.accent, dx, 0, dz);
      d.rotation.y = Math.PI / 4; d.scale.setScalar(sc); d.castShadow = true;
      chevron.add(d);
    }
  }
  chevron.position.set(-9, 0.02, 9);
  chevron.rotation.y = -0.6;
  plaza.add(chevron);

  // support: an orbit ring with satellites
  const orbit = new THREE.Group();
  const orbitLine = new THREE.LineLoop(circle(6.4, 160), ringMat(0x3b4be0));
  orbit.add(orbitLine);
  const sats = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), std(0xffffff, { roughness: 0.4 }));
    m.castShadow = false;
    orbit.add(m);
    return m;
  });
  orbit.rotation.set(0.45, 0, 0.2);
  orbit.position.y = 2.6;
  plaza.add(orbit);

  /* ── camera stations: [hero, discover, design, build, launch, support] ── */
  const STATION = [
    { look: [0, 1.5, 0], dist: 56, dir: [0.7, 0.72, 1] },
    { look: [DC.x + 1, 0.5, DC.z - 1], dist: 30, dir: [0.65, 0.7, 1] },
    { look: [PL.x, 0, PL.z], dist: 34, dir: [0.7, 0.8, 1] },
    { look: [PL.x, 1.8, PL.z], dist: 33, dir: [0.8, 0.5, 1] },
    { look: [PL.x + 5, 1.2, PL.z - 6], dist: 36, dir: [-0.9, 0.55, 0.8] },
    { look: [PL.x, 1.4, PL.z], dist: 48, dir: [0.7, 0.8, 1] },
  ];
  const SP = STATION.map(() => new THREE.Vector3()), SL = STATION.map(() => new THREE.Vector3());
  let curveP = null, curveL = null;
  function placeStations() {
    const fit = narrow() ? Math.min(2.4, 1.0 / camera.aspect) : 1;
    STATION.forEach((s, i) => {
      SL[i].fromArray(s.look);
      SP[i].fromArray(s.dir).normalize().multiplyScalar(s.dist * fit).add(SL[i]);
    });
    curveP = new THREE.CatmullRomCurve3(SP.map((v) => v.clone()), false, "centripetal");
    curveL = new THREE.CatmullRomCurve3(SL.map((v) => v.clone()), false, "centripetal");
  }

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = narrow() ? 28 : 24;
    placeStations();
  }
  addEventListener("resize", resize);
  resize();

  /* ── scroll → UI ── */
  stepEls.forEach((el, i) =>
    el.addEventListener("click", () => {
      const top = section.getBoundingClientRect().top + scrollY;
      const len = section.offsetHeight - innerHeight;
      const y = top + len * ((i + 0.5) / STEPS);
      window.__lenis ? window.__lenis.scrollTo(y, { duration: 1.4 }) : scrollTo({ top: y, behavior: "smooth" });
    }),
  );
  let shownStep = -1;
  function updateUI(p) {
    const f = p * STEPS, idx = Math.min(Math.floor(f), STEPS - 1);
    if (idx !== shownStep) {
      shownStep = idx;
      stepEls.forEach((el, i) => el.classList.toggle("on", i === idx));
    }
    stepEls[idx].style.setProperty("--p", clamp01(f - idx).toFixed(3));
  }

  /* ── frame ── */
  const w = new Float32Array(STEPS);
  const camP = new THREE.Vector3(), camL = new THREE.Vector3(), tmp = new THREE.Vector3();
  let fs = 0, last = performance.now(), mx = 0, my = 0, tmx = 0, tmy = 0, rendered = false;
  let introStart = null, introDone = false, shadowDirty = true, prevLift = 0, prevChev = 0;
  function startIntro() {
    if (introStart !== null) return;
    introStart = performance.now();
    document.body.classList.add("ready");
  }
  addEventListener("pointermove", (e) => { tmx = e.clientX / innerWidth - 0.5; tmy = e.clientY / innerHeight - 0.5; });

  function render(now, snap = false) {
    const dt = Math.min((now - last) / 1000, 0.1) || 0.016;
    last = now;
    const t = reduce ? 0 : now / 1000;
    const introT = snap || reduce ? 1 : introStart === null ? 0 : clamp01((now - introStart) / 2800);
    const introK = 1 - easeOutCubic(introT);
    let shadowMoved = !introDone || shadowDirty;

    const rect = section.getBoundingClientRect();
    const vh = innerHeight;
    const u = clamp01(1 - rect.top / vh);                                 // hero → process hand-off
    const p = clamp01(-rect.top / Math.max(rect.height - vh, 1));          // progress through the pinned process
    updateUI(p);

    fs += (p * STEPS - fs) * (snap || reduce ? 1 : 1 - Math.exp(-dt * 7));
    let sum = 0;
    for (let s = 0; s < STEPS; s++) { w[s] = clamp01(1 - Math.abs(fs - (s + 0.5)) / 0.62); sum += w[s]; }
    for (let s = 0; s < STEPS; s++) w[s] = sum > 0 ? w[s] / sum : s === 0 ? 1 : 0;
    const built = smooth(2.0, 2.95, fs);                    // how far the skyline has grown
    const launched = clamp01((fs - 3.0) / 0.85) * 1.15;     // beam head position along its path
    const w0 = w[0], w1 = w[1], w3 = w[3], w4 = w[4] ?? 0;

    /* camera: hero overview → step viewpoints */
    // position along the station curve: ease hero -> step 1, then HOLD on each step and move decisively to the next
    const hb = smooth(0, 1, u);
    const xs = Math.min(Math.max(fs - 0.5, 0), STEPS - 1);
    const ks = Math.min(Math.floor(xs), STEPS - 2), fr = xs - ks;
    const cStep = 1 + ks + inOutCubic(smooth(0.2, 0.8, fr));
    const cc = (u < 1 ? hb : cStep) / STEPS;
    curveP.getPoint(Math.min(cc, 1), camP);
    curveL.getPoint(Math.min(cc, 1), camL);
    // opening dolly: starts further out and higher, settles on the hero shot
    if (introK > 0) { camP.x += 11 * introK * (1 - hb); camP.y += 9 * introK * (1 - hb); camP.z += 11 * introK * (1 - hb); }
    mx += (tmx - mx) * (1 - Math.exp(-dt * 3));
    my += (tmy - my) * (1 - Math.exp(-dt * 3));
    if (!reduce) { camP.x += mx * 1.6 + Math.sin(t * 0.17) * 0.5; camP.y -= my * 0.9; }
    camera.position.copy(camP);
    camera.lookAt(camL);
    // hero: park the city in the lower half (headline above); process: centred / upper on phones
    const offY = narrow() ? lerp(-0.1, 0.16, hb) : lerp(-0.23, 0, hb);
    const offX = narrow() ? 0 : lerp(0, -0.09, hb);                       // nudge the scene right, clear of the step text
    camera.setViewOffset(innerWidth, vh, offX * innerWidth, offY * vh, innerWidth, vh);
    camera.updateProjectionMatrix();

    /* intro: buildings grow out of the ground */
    if (!introDone) {
      for (const k of introKids) {
        const e = easeOutBack(clamp01((introT - k.d) / 0.36));
        k.o.visible = e > 0.001;
        k.o.scale.y = Math.max(e, 0.0001) * k.sy;
      }
      if (introT >= 1) introDone = true;
    }

    /* city life */
    if (dish) dish.rotation.y = t * 0.35;
    if (beacon) beacon.material.emissiveIntensity = 0.5 + 0.9 * (0.5 + 0.5 * Math.sin(t * 3));

    /* radar (discover; echoes in support) */
    const r1 = (t * 2.6) % 15, r2 = (t * 2.6 + 7.5) % 15;
    radarMat.uniforms.uTime.value = t; radarMat.uniforms.uR1.value = r1; radarMat.uniforms.uR2.value = r2;
    radarMat.uniforms.uK.value = 0.2 + 0.8 * w0; radarMat.uniforms.uBase.value = 0.35 + 0.65 * w0;
    plazaMat.uniforms.uTime.value = t; plazaMat.uniforms.uR1.value = r1; plazaMat.uniforms.uR2.value = r2;
    plazaMat.uniforms.uK.value = 0.55 * (w1 + w4); plazaMat.uniforms.uBase.value = 0.25 + 0.75 * clamp01(w1 + w[2] + w3 + w4);

    for (let i = 0; i < NODES; i++) {
      const [nx, nz, nr] = nodePos[i];
      const a = (nr - r1) * 1.0, b = (nr - r2) * 1.0;
      const s = (0.12 + 0.88 * Math.max(Math.exp(-a * a), Math.exp(-b * b))) * (0.05 + 0.2 * w0);
      dummy.position.set(nx, 0.25 + s, nz);
      dummy.scale.setScalar(Math.max(s, 0.0001));
      dummy.updateMatrix();
      nodes.setMatrixAt(i, dummy.matrix);
    }
    nodes.instanceMatrix.needsUpdate = true;

    /* cables (discover) */
    cab.u.uHead.value = reduce ? 1.2 : ((t * 0.28) % 1.5);
    cab.u.uOp.value = 0.3 + 0.7 * w0;
    cab.u.uTime.value = t;

    /* tiles */
    for (let k = 0; k < N; k++) {
      const d = gd[k];
      const flat = 0.08 + 0.1 * w1;
      const grow = smooth(0, 1, built * 1.7 - (d / 7.2) * 0.8);
      const hT = flat + (hSky[k] - flat) * grow;
      if (Math.abs(hT - hCur[k]) > 0.004) shadowMoved = true;
      hCur[k] += (hT - hCur[k]) * (snap ? 1 : 1 - Math.exp(-dt * 6));
      let g = 0;
      g += w1 * Math.pow(0.5 + 0.5 * Math.sin(d * 1.4 - t * 2.4), 3) * 0.95;
      g += built * 0.06 + built * 0.1 * (hCur[k] / 5);
      g += w3 * Math.exp(-d * 0.3) * 0.55 * (0.7 + 0.3 * Math.sin(t * 5));
      g += w4 * 0.2 * (0.5 + 0.5 * Math.sin(t * 2 + gx[k] * 0.8 + gz[k] * 0.6));
      g = clamp01(g);
      dummy.position.set(gx[k], 0, gz[k]);
      dummy.scale.set(1, Math.max(hCur[k], 0.03), 1);
      dummy.updateMatrix();
      tiles.setMatrixAt(k, dummy.matrix);
      tiles.setColorAt(k, tmpC.setRGB(0.95 - g * 0.55, 0.96 - g * 0.4, 0.98 - g * 0.08));
    }
    tiles.instanceMatrix.needsUpdate = true;
    tiles.instanceColor.needsUpdate = true;

    // indigo cap tile: lifts during design, then crowns its tower
    const lift = 0.9 * w1;
    if (Math.abs(lift - prevLift) > 0.003) shadowMoved = true;
    prevLift = lift;
    cap.position.set(gx[heroIdx], hCur[heroIdx] + lift, gz[heroIdx]);

    /* launch */
    const beamOn = smooth(2.85, 3.2, fs);
    for (const g of beams.grp.children) g.visible = beamOn > 0.01;
    beams.u.uHead.value = launched;
    beams.u.uOp.value = beamOn * (0.6 + 0.4 * w3 + 0.25 * w4);
    beams.u.uTime.value = t;
    charge.forEach((c, i) => {
      c.material.opacity = (w3 * 0.95 + w4 * 0.3) * (i ? 0.7 : 1);
      c.position.y = towerTop.y + 0.3 + (reduce ? 0 : Math.sin(t * 2 + i) * 0.08);
      c.rotation.y = t * (i ? -0.8 : 0.9);
    });
    const chev = smooth(2.9, 3.4, fs);
    chevron.scale.setScalar(Math.max(chev, 0.001));
    chevron.position.y = 0.02 + (1 - chev) * 1.5;
    if (Math.abs(chev - prevChev) > 0.002) shadowMoved = true;
    prevChev = chev;

    /* support */
    const oo = smooth(3.7, 4.3, fs);
    orbitLine.material.opacity = oo * 0.75;
    orbit.rotation.y = t * 0.25;
    sats.forEach((s, i) => {
      const a = t * 0.9 + (i * Math.PI * 2) / 3;
      s.position.set(Math.cos(a) * 6.4, 0, Math.sin(a) * 6.4);
      s.scale.setScalar(Math.max(oo, 0.001));
    });

    if (shadowMoved) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    renderer.render(scene, camera);

    if (!rendered) {
      rendered = true;
      loadbar.style.width = "100%";
      document.fonts.ready.then(() => setTimeout(() => { loader.classList.add("done"); startIntro(); }, 350));
    }
  }

  /* quality governor: if the machine can't hold ~42fps, step down (pixel ratio → shadows → lower pixel ratio) */
  const gov = { avg: 1 / 60, frames: 0, tier: 0 };
  function setPR(pr) {
    renderer.setPixelRatio(pr);
    radarMat.uniforms.uPR.value = plazaMat.uniforms.uPR.value = pr;
    resize();
  }
  function govern(dtRaw) {
    gov.frames++;
    if (gov.frames < 90 || dtRaw > 0.25) return;
    gov.avg += (dtRaw - gov.avg) * 0.06;
    if (gov.frames % 45 || gov.avg < 1 / 42 || gov.tier >= 3) return;
    gov.tier++;
    gov.avg = 1 / 60;
    gov.frames = 30;
    if (gov.tier === 1 && renderer.getPixelRatio() > 1) setPR(1);
    else if (gov.tier <= 2 && renderer.shadowMap.enabled) {
      renderer.shadowMap.enabled = false;
      sun.castShadow = false;
      scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
    } else setPR(Math.max(0.75, renderer.getPixelRatio() * 0.8));
  }

  let active = true;
  new IntersectionObserver(([e]) => (active = e.isIntersecting), { rootMargin: "10% 0px" }).observe(section);
  const heroEl = document.getElementById("hero");
  if (heroEl) new IntersectionObserver(([e]) => { if (e.isIntersecting) active = true; }, { rootMargin: "10% 0px" }).observe(heroEl);

  let lastNow = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    const dtRaw = (now - lastNow) / 1000;
    lastNow = now;
    if (!active && rendered) return;
    render(now);
    govern(dtRaw);
  }
  requestAnimationFrame(tick);
  setTimeout(() => { loader.classList.add("done"); startIntro(); }, 4500); // never leave the loader stuck

  // verification hook: hidden preview tabs suspend rAF
  window.__scene = {
    render: () => render(performance.now(), true), renderer, scene, camera,
    // test hook: replay the opening sequence
    replayIntro() {
      introDone = false; introStart = null; shadowDirty = true;
      document.body.classList.remove("ready");
      requestAnimationFrame(() => startIntro());
    },
    introInfo: () => ({ visible: introKids.filter((k) => k.o.visible).length, total: introKids.length, camZ: +camera.position.z.toFixed(1), y: +camera.position.y.toFixed(1) }),
  };
}

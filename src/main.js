/* VertexHand — scroll flight.
   One continuous 3D universe. Every chapter is a particle object parked
   further down the Z axis; scrolling flies the camera into the current one,
   through its core, out through a portal ring and on towards the next.
   After the film the same flight carries on under the brand page (see
   brand.js: every block dives in from the deep and out past the viewer). */

import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildShapes, mulberry32 } from "./shapes.js";
import "./style.css";
import { diveUpdate, diveMeasure } from "./brand.js";

const canvas = document.getElementById("scene");
const track = document.getElementById("track");
const loader = document.getElementById("loader");
const loadbar = document.getElementById("loadbar");
const scrollCue = document.getElementById("scroll-cue");
const labelLayer = document.getElementById("labels");
const rail = [...document.querySelectorAll("#rail li")];
const captions = [...document.querySelectorAll(".caption")];

const narrow = () => innerWidth < 760;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const N = narrow() ? 5600 : 9000;

// chapter rest positions along the film (0..1); captions sit on these
const KEYS = [0, 0.135, 0.275, 0.415, 0.555, 0.695, 0.835, 0.985];
const HOLD = 0.03;
const GAP = 18;            // world units between chapter objects
const PAGE_SPEED = 0.011;  // world units flown per px scrolled after the film
const STAR_L = 160;        // length of the wrapping star tube

const clamp01 = (x) => Math.min(Math.max(x, 0), 1);
const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

/* ── renderer ──────────────────────────────────────────── */

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(devicePixelRatio, narrow() ? 1.5 : 1.75));
renderer.setClearColor(0x000000, 1); // pure black: survives the composer's colour-space round-trip unchanged

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 520);

/* ── chapter objects ───────────────────────────────────── */

const shapes = buildShapes(N);
const r = mulberry32(99);
const rand = new Float32Array(N);
for (let i = 0; i < N; i++) rand[i] = r();
const randAttr = new THREE.BufferAttribute(rand, 1);

const objVert = /* glsl */ `
  uniform float uTime, uSize, uPR;
  uniform vec3 uCam;          // camera position in this object's local space
  uniform vec3 uA, uB;
  attribute float aRand;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    float ph = aRand * 6.2831;
    p += vec3(sin(uTime * 0.9 + ph * 7.0), cos(uTime * 0.7 + ph * 5.0), sin(uTime * 1.1 + ph * 3.0)) * 0.012;

    // the cloud parts around the camera as it flies through the core
    vec3 away = p - uCam;
    float push = 1.0 - smoothstep(0.0, 2.8, length(away));
    p += normalize(away + vec3(0.0001)) * push * push * 1.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    float size = uSize * (0.55 + aRand * aRand * 1.4) * (1.0 + push * 1.3);
    gl_PointSize = clamp(size * uPR * (10.0 / max(depth, 0.5)), 1.5 * uPR, 26.0 * uPR);

    float far = (1.0 - 0.94 * smoothstep(14.0, 34.0, depth)) * (1.0 - smoothstep(60.0, 85.0, depth));
    float near = smoothstep(0.2, 1.3, depth);
    vAlpha = (0.6 + 0.4 * sin(uTime * 1.7 + ph * 11.0)) * far * near;
    vColor = mix(uA, uB, smoothstep(0.76, 0.98, aRand));
  }
`;
const objFrag = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = pow(1.0 - d * 2.0, 1.6);
    gl_FragColor = vec4(vColor, a * vAlpha * uOpacity);
    #include <colorspace_fragment>
  }
`;

function objMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: narrow() ? 3.4 : 2.2 },
      uPR: { value: renderer.getPixelRatio() },
      uCam: { value: new THREE.Vector3(0, 0, 99) },
      uOpacity: { value: narrow() ? 1.0 : 0.85 }, // phones get no bloom, so brighter points
      uA: { value: new THREE.Color("#3d8bff") },
      uB: { value: new THREE.Color("#e6f0ff") },
    },
    vertexShader: objVert,
    fragmentShader: objFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

const holders = shapes.map((s) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(s.positions, 3));
  geo.setAttribute("aRand", randAttr);
  const pts = new THREE.Points(geo, objMaterial());
  pts.frustumCulled = false;
  const holder = new THREE.Group();
  holder.add(pts);
  let wire = null;
  if (s.edges) {
    wire = new THREE.LineSegments(
      s.edges,
      new THREE.LineBasicMaterial({ color: 0x3d8bff, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    holder.add(wire);
  }
  scene.add(holder);
  return { holder, mat: pts.material, wire };
});

/* ── the universe: wrapping stars, warp streaks, nebulae ── */

const starVert = /* glsl */ `
  uniform float uCamZ, uL, uPR, uStreak, uBright;
  attribute float aRand;
  attribute float aEnd;
  varying float vA;
  varying vec3 vC;
  void main() {
    float top = uCamZ + 12.0;
    float wz = top - mod(top - position.z, uL);   // endless: re-use stars as the camera passes
    float dist = uCamZ - wz;
    wz -= uStreak * aEnd;                         // streak trails back along the flight line
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, wz, 1.0);
    gl_PointSize = (1.2 + aRand * 2.2) * uPR;
    vA = uBright * (0.3 + 0.7 * aRand) * (1.0 - smoothstep(uL - 70.0, uL - 14.0, dist)) * (1.0 - aEnd * 0.92);
    vC = mix(vec3(0.62, 0.78, 1.0), vec3(0.86, 0.74, 1.0), step(0.8, fract(aRand * 7.31)));
  }
`;
const starPointFrag = /* glsl */ `
  varying float vA; varying vec3 vC;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    gl_FragColor = vec4(vC, vA * (1.0 - d * 2.0));
    #include <colorspace_fragment>
  }
`;
const starLineFrag = /* glsl */ `
  varying float vA; varying vec3 vC;
  void main() {
    gl_FragColor = vec4(vC, vA);
    #include <colorspace_fragment>
  }
`;
function starMaterial(frag, bright) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCamZ: { value: 0 }, uL: { value: STAR_L }, uPR: { value: renderer.getPixelRatio() },
      uStreak: { value: 0 }, uBright: { value: bright },
    },
    vertexShader: starVert,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

const S_COUNT = narrow() ? 1800 : 3800;
const sPos = new Float32Array(S_COUNT * 3), sRand = new Float32Array(S_COUNT);
for (let i = 0; i < S_COUNT; i++) {
  const a = r() * Math.PI * 2, rad = 4.5 + Math.pow(r(), 0.6) * 48;  // hollow core: the flight line stays clear
  sPos.set([Math.cos(a) * rad, Math.sin(a) * rad * 0.7, r() * STAR_L], i * 3);
  sRand[i] = r();
}
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
starGeo.setAttribute("aRand", new THREE.BufferAttribute(sRand, 1));
const starMat = starMaterial(starPointFrag, 0.7);
const stars = new THREE.Points(starGeo, starMat);
stars.frustumCulled = false;
scene.add(stars);

// streaks: a subset of stars drawn as 2-vertex lines
const T_COUNT = narrow() ? 500 : 1300;
const tPos = new Float32Array(T_COUNT * 6), tEnd = new Float32Array(T_COUNT * 2), tRand = new Float32Array(T_COUNT * 2);
for (let i = 0; i < T_COUNT; i++) {
  const a = r() * Math.PI * 2, rad = 3.2 + Math.pow(r(), 0.7) * 30, z = r() * STAR_L, rr = r();
  for (let v = 0; v < 2; v++) {
    tPos.set([Math.cos(a) * rad, Math.sin(a) * rad * 0.72, z], (i * 2 + v) * 3);
    tEnd[i * 2 + v] = v;
    tRand[i * 2 + v] = rr;
  }
}
const streakGeo = new THREE.BufferGeometry();
streakGeo.setAttribute("position", new THREE.BufferAttribute(tPos, 3));
streakGeo.setAttribute("aEnd", new THREE.BufferAttribute(tEnd, 1));
streakGeo.setAttribute("aRand", new THREE.BufferAttribute(tRand, 1));
const streakMat = starMaterial(starLineFrag, 0.6);
const streaks = new THREE.LineSegments(streakGeo, streakMat);
streaks.frustumCulled = false;
scene.add(streaks);

// soft nebula clouds drifting along the whole route
function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
const glowTex = glowTexture();
const NEB = ["#2f6bff", "#6a3dff", "#1fb6c9", "#3d8bff"];
for (let i = 0; i < 22; i++) {
  const m = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: NEB[i % NEB.length], transparent: true, opacity: 0.018 + r() * 0.022,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  const a = r() * Math.PI * 2, rad = 14 + r() * 24;
  m.position.set(Math.cos(a) * rad, Math.sin(a) * rad * 0.6, 8 - i * 15 - r() * 6);
  m.scale.setScalar(26 + r() * 28);
  scene.add(m);
}

/* ── portal rings the camera flies through between chapters ── */

const portals = [];
for (let j = 0; j < shapes.length - 1; j++) {
  const grp = new THREE.Group();
  const rings = [3.1, 4.3, 5.8].map((rad, n) => {
    const pts = [];
    for (let i = 0; i < 128; i++) { const a = (i / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, -n * 1.4)); }
    const ring = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: n === 0 ? 0x8ec0ff : 0x3d8bff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    grp.add(ring);
    return ring;
  });
  scene.add(grp);
  portals.push({ grp, rings });
}

/* ── bloom (skipped on phones — fill-rate) ──────────────── */

let composer = null, bloom = null;
if (!narrow()) {
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.55, 0.35, 0.18);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}

/* ── labels projected from 3D anchors ──────────────────── */

const labels = [];
shapes.forEach((s, si) =>
  s.labels.forEach((l) => {
    const el = document.createElement("span");
    el.className = "lbl";
    el.textContent = l.text;
    labelLayer.appendChild(el);
    labels.push({ el, si, local: new THREE.Vector3(...l.pos), w: null });
  }),
);

/* ── flight path ───────────────────────────────────────── */

let D = 9.3;            // resting distance in front of a chapter object
let path = null, maxF = 1, lastRest = new THREE.Vector3();

function buildPath() {
  const pts = [];
  shapes.forEach((s, i) => {
    const z = -i * GAP;
    const ox = narrow() ? 0 : s.offset[0];
    const oy = narrow() ? 1.35 : s.offset[1];
    holders[i].holder.position.set(ox, oy, z);
    pts.push(new THREE.Vector3(0, 0, z + D));                          // rest: object framed beside the caption
    if (i < shapes.length - 1) {
      pts.push(new THREE.Vector3(ox, oy, z));                          // dive: the heart of the object
      const out = new THREE.Vector3(ox * 0.3, oy * 0.3, z - 4.5);      // exit: through the portal ring
      pts.push(out);
      portals[i].grp.position.copy(out);
    }
  });
  lastRest.copy(pts[pts.length - 1]);
  path = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  maxF = pts.length - 1;
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const halfTan = Math.tan(THREE.MathUtils.degToRad(17.5));
  const needHalfW = narrow() ? 2.75 : 4.7;
  D = Math.max(2.85 / halfTan, needHalfW / (halfTan * camera.aspect));
  camera.updateProjectionMatrix();
  if (composer) {
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }
  buildPath();
  diveMeasure();
}
addEventListener("resize", resize);
resize();

/* ── scroll state ──────────────────────────────────────── */

const state = { S: 0, k: 0, v: 0, prevZ: null, fov: 35, mx: 0, my: 0, tmx: 0, tmy: 0 };

function chapterAt(s) {
  for (let k = 0; k < KEYS.length - 1; k++) {
    if (s < KEYS[k + 1]) {
      const span = KEYS[k + 1] - KEYS[k] - 2 * HOLD;
      return { k, t: ease(clamp01((s - KEYS[k] - HOLD) / span)) };
    }
  }
  return { k: KEYS.length - 2, t: 1 };
}

addEventListener("pointermove", (e) => {
  state.tmx = (e.clientX / innerWidth) * 2 - 1;
  state.tmy = (e.clientY / innerHeight) * 2 - 1;
});

/* ── captions (data-in / data-hold / data-out scroll windows) ── */

function transformBase(el) {
  if (narrow() || el.classList.contains("cap-bottom")) return "translateX(-50%)";
  if (el.classList.contains("cap-center")) return "translate(-50%, -50%)";
  return "translateY(-50%)";
}

function updateCaptions(p) {
  for (const el of captions) {
    const tIn = +el.dataset.in, tHold = +el.dataset.hold, tOut = +el.dataset.out;
    const rise = Math.max((tHold - tIn) * 0.4, 0.008);
    const fall = Math.max((tOut - tHold) * 0.6, 0.008);
    let o = 0;
    if (p >= tIn && p <= tOut) o = clamp01(Math.min((p - tIn) / rise, 1) * Math.min((tOut - p) / fall, 1));
    el.style.opacity = o.toFixed(3);
    el.style.pointerEvents = o > 0.6 ? "auto" : "none";
    // captions are objects in the same space: they swell towards the viewer as they leave
    const lv = clamp01((p - tHold) / Math.max(tOut - tHold, 0.01));
    const sc = 1 + lv * lv * 0.35;
    el.style.transform = `${transformBase(el)} scale(${sc.toFixed(3)})`;
  }
  scrollCue.style.opacity = p < 0.015 ? 1 : 0;
}

/* ── frame ─────────────────────────────────────────────── */

const clock = new THREE.Clock();
const tmp = new THREE.Vector3(), look = new THREE.Vector3(), ahead = new THREE.Vector3(), base = new THREE.Vector3();
let rendered = false;

function frame(snap = false) {
  const dt = Math.min(clock.getDelta(), 0.1) || 0.016;
  const time = clock.elapsedTime;

  const target = scrollY;
  state.S += (target - state.S) * (1 - Math.exp(-dt * 6));
  if (snap || reduceMotion || Math.abs(target - state.S) < 0.3) state.S = target;
  const S = state.S;

  const filmMax = Math.max(track.offsetHeight - innerHeight, 1);
  const s = clamp01(S / filmMax);
  const q = Math.max(S - filmMax, 0);
  const { k, t } = chapterAt(s);
  const dw = Math.sin(Math.PI * t); // 0 resting, 1 mid-dive

  /* camera rig */
  const f = k * 3 + t * 3;
  const pos = path.getPoint(Math.min(f / maxF, 1));
  if (q > 0) {
    // past the film: keep diving — straight through the vertex mark and on, forever
    const hp = holders[holders.length - 1].holder.position;
    const aim = smooth(0, innerHeight * 0.7, q);
    pos.copy(lastRest);
    pos.x += (hp.x - pos.x) * aim;
    pos.y += (hp.y - pos.y) * aim;
    pos.z -= q * PAGE_SPEED;
    look.set(pos.x, pos.y, pos.z - 10);
  } else {
    path.getPoint(Math.min((f + 0.7) / maxF, 1), ahead);
    base.set(pos.x, pos.y, pos.z - 10);
    look.copy(base).lerp(ahead, dw);
  }

  state.mx += (state.tmx - state.mx) * (1 - Math.exp(-dt * 3));
  state.my += (state.tmy - state.my) * (1 - Math.exp(-dt * 3));
  const calm = reduceMotion ? 0 : 1 - dw;
  camera.position.set(pos.x + state.mx * 0.3 * calm, pos.y - state.my * 0.18 * calm, pos.z);
  camera.lookAt(look);
  camera.rotateZ(reduceMotion ? 0 : dw * 0.07 * (holders[k].holder.position.x >= 0 ? -1 : 1) + Math.sin(time * 0.3) * 0.004);

  // flight speed drives streak length + a little field-of-view kick
  if (snap || state.prevZ === null) state.v = 0;
  else state.v += ((state.prevZ - camera.position.z) / dt - state.v) * (1 - Math.exp(-dt * 8));
  state.prevZ = camera.position.z;
  if (state.forceV != null) state.v = state.forceV; // debug: preview a given flight speed
  const kick = reduceMotion ? 0 : clamp(Math.abs(state.v) * 0.25, 0, 14);
  const fov = 35 + kick;
  if (Math.abs(fov - state.fov) > 0.05) {
    state.fov = fov;
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  const streak = reduceMotion ? 0 : clamp(state.v * 0.045, -4, 4);

  /* universe */
  starMat.uniforms.uCamZ.value = streakMat.uniforms.uCamZ.value = camera.position.z;
  streakMat.uniforms.uStreak.value = streak;
  // pages dim the stars so text stays readable
  const dim = 1 - 0.45 * smooth(0, innerHeight, q);
  starMat.uniforms.uBright.value = 0.7 * dim;
  streakMat.uniforms.uBright.value = 0.6 * dim;

  /* chapter objects */
  holders.forEach((h, i) => {
    const sp = shapes[i].spin;
    h.holder.rotation.y = reduceMotion ? 0 : time * 0.25 * sp + Math.sin(time * 0.4 + i) * 0.08 + state.mx * 0.22;
    h.holder.rotation.x = reduceMotion ? 0 : state.my * 0.12 + Math.sin(time * 0.3 + i) * 0.04;
    h.holder.updateMatrixWorld(true);
    h.mat.uniforms.uTime.value = time;
    h.holder.worldToLocal(tmp.copy(camera.position));
    h.mat.uniforms.uCam.value.copy(tmp);
    if (h.wire) {
      const d = camera.position.distanceTo(h.holder.position);
      h.wire.material.opacity = 0.16 * (1 - smooth(30, 52, d));
    }
  });

  portals.forEach((p, j) => {
    const dz = Math.abs(camera.position.z - p.grp.position.z);
    const o = 0.7 * (1 - smooth(3, 40, dz)) * (j === k || j === k - 1 || dz < 30 ? 1 : 0);
    p.rings.forEach((ring, n) => {
      ring.material.opacity = o * (1 - n * 0.28);
      ring.rotation.z = time * 0.18 * (n % 2 ? 1 : -1) * (j % 2 ? 1 : -1);
    });
  });

  /* labels (only on a resting chapter) */
  const restA = clamp01(1 - t * 3), restB = clamp01((t - 0.67) * 3);
  const afterFilm = 1 - clamp01(q / 260);
  const w = innerWidth, h = innerHeight;
  for (const L of labels) {
    const holder = holders[L.si].holder;
    const weight = (L.si === k ? restA : L.si === k + 1 ? restB : 0) * (L.si === shapes.length - 1 ? afterFilm : 1);
    if (weight <= 0.001) {
      if (L.el.style.opacity !== "0") L.el.style.opacity = "0";
      continue;
    }
    tmp.copy(L.local).applyMatrix4(holder.matrixWorld);
    const front = clamp01((tmp.z - holder.position.z) * 0.6 + 0.75);
    tmp.project(camera);
    L.w ??= L.el.offsetWidth; // measured once — avoids a layout read every frame
    const lx = Math.min((tmp.x * 0.5 + 0.5) * w, w - L.w - 16);
    L.el.style.transform = `translate(${lx.toFixed(1)}px, ${((-tmp.y * 0.5 + 0.5) * h).toFixed(1)}px)`;
    L.el.style.opacity = (weight * Math.max(front, 0.15)).toFixed(3);
  }

  /* chapter rail */
  let near = 0;
  KEYS.forEach((key, i) => { if (Math.abs(s - key) < Math.abs(s - KEYS[near])) near = i; });
  rail.forEach((li, i) => li.classList.toggle("on", i === near));

  updateCaptions(s);
  diveUpdate(snap);

  state.k = k;
  if (composer) composer.render();
  else renderer.render(scene, camera);

  if (!rendered) {
    rendered = true;
    loadbar.style.width = "100%";
    document.fonts.ready.then(() => { diveMeasure(); setTimeout(() => loader.classList.add("done"), 350); });
  }
}

function tick() {
  frame();
  requestAnimationFrame(tick);
}

// verification hook: hidden preview tabs suspend rAF, so render on demand
window.__vh = {
  bloom: () => bloom,
  scene,
  renderer,
  at(p) {
    scrollTo(0, p * Math.max(track.offsetHeight - innerHeight, 1));
    frame(true);
    return { k: state.k, z: +camera.position.z.toFixed(2) };
  },
  fly(v) { state.forceV = v; },
  atPx(y) {
    scrollTo(0, y);
    frame(true);
    return { z: +camera.position.z.toFixed(2), scrollY };
  },
};

loadbar.style.width = "60%";
requestAnimationFrame(tick);
// rAF never fires in hidden tabs — never leave the loader stuck
setTimeout(() => loader.classList.add("done"), 4000);

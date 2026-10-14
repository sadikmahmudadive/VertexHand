/* VertexHand — chapter shapes.
   Every chapter is a cloud of exactly N points. The film morphs point i of
   one shape into point i of the next, so each builder shuffles its output
   (random pairing = the "explode and reassemble" look). */

import * as THREE from "three";

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;

function gauss(r) {
  return Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(TAU * r());
}

/* ── 2D helpers (u, v) ─────────────────────────────────── */

function roundRect(cx, cy, w, h, rad, steps = 5) {
  const pts = [];
  const corners = [
    [cx + w / 2 - rad, cy + h / 2 - rad, 0],
    [cx - w / 2 + rad, cy + h / 2 - rad, 90],
    [cx - w / 2 + rad, cy - h / 2 + rad, 180],
    [cx + w / 2 - rad, cy - h / 2 + rad, 270],
  ];
  for (const [x, y, a0] of corners)
    for (let i = 0; i <= steps; i++) {
      const a = ((a0 + (90 * i) / steps) * Math.PI) / 180;
      pts.push([x + Math.cos(a) * rad, y + Math.sin(a) * rad]);
    }
  return pts;
}

function circle(cx, cy, rad, steps = 28) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * TAU;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return pts;
}

/* polyline of 3D points → segment list */
function poly(pts, closed = true) {
  const s = [];
  for (let i = 0; i < pts.length - 1; i++) s.push([pts[i], pts[i + 1]]);
  if (closed) s.push([pts[pts.length - 1], pts[0]]);
  return s;
}

const onXY = (z) => ([u, v]) => [u, v, z];
const onXZ = (y) => ([u, v]) => [u, y, v];

/* ── samplers ──────────────────────────────────────────── */

function lines(segs, jitter = 0.008) {
  const cum = [];
  let total = 0;
  for (const [a, b] of segs) {
    total += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    cum.push(total);
  }
  return (r) => {
    const x = r() * total;
    let j = 0;
    while (j < cum.length - 1 && cum[j] < x) j++;
    const [a, b] = segs[j];
    const t = r();
    return [
      a[0] + (b[0] - a[0]) * t + (r() - 0.5) * jitter,
      a[1] + (b[1] - a[1]) * t + (r() - 0.5) * jitter,
      a[2] + (b[2] - a[2]) * t + (r() - 0.5) * jitter,
    ];
  };
}

function blobs(centers, sigma) {
  return (r) => {
    const c = centers[Math.floor(r() * centers.length)];
    return [c[0] + gauss(r) * sigma, c[1] + gauss(r) * sigma, c[2] + gauss(r) * sigma];
  };
}

/* filled boxes: [x0, x1, y0, y1, z0, z1] */
function boxes(list) {
  const vols = list.map(([x0, x1, y0, y1]) => Math.abs((x1 - x0) * (y1 - y0)) + 1e-4);
  const total = vols.reduce((a, b) => a + b, 0);
  return (r) => {
    let x = r() * total, j = 0;
    while (j < vols.length - 1 && x > vols[j]) x -= vols[j++];
    const [x0, x1, y0, y1, z0, z1] = list[j];
    return [x0 + (x1 - x0) * r(), y0 + (y1 - y0) * r(), z0 + (z1 - z0) * r()];
  };
}

/* ── assembly ──────────────────────────────────────────── */

function build(N, r, parts) {
  const total = parts.reduce((s, p) => s + p[0], 0);
  const out = new Float32Array(N * 3);
  let i = 0;
  parts.forEach(([w, sample], pi) => {
    const n = pi === parts.length - 1 ? N - i : Math.round((N * w) / total);
    for (let k = 0; k < n && i < N; k++, i++) out.set(sample(r), i * 3);
  });
  for (let a = N - 1; a > 0; a--) {
    const b = Math.floor(r() * (a + 1));
    for (let c = 0; c < 3; c++) {
      const t = out[a * 3 + c];
      out[a * 3 + c] = out[b * 3 + c];
      out[b * 3 + c] = t;
    }
  }
  return out;
}

function bake(positions, labels, euler, scale = 1) {
  const m = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...euler));
  m.multiply(new THREE.Matrix4().makeScale(scale, scale, scale));
  const v = new THREE.Vector3();
  for (let i = 0; i < positions.length; i += 3) {
    v.fromArray(positions, i).applyMatrix4(m).toArray(positions, i);
  }
  for (const l of labels) l.pos = v.fromArray(l.pos).applyMatrix4(m).toArray();
}

/* ── shapes ────────────────────────────────────────────── */

function vertexMark(N, r) {
  const geo = new THREE.IcosahedronGeometry(2.05, 1);
  const edges = new THREE.EdgesGeometry(geo, 1);
  const e = edges.attributes.position.array;
  const segs = [];
  for (let i = 0; i < e.length; i += 6) segs.push([[e[i], e[i + 1], e[i + 2]], [e[i + 3], e[i + 4], e[i + 5]]]);
  const seen = new Map();
  for (let i = 0; i < e.length; i += 3) {
    const key = `${e[i].toFixed(3)},${e[i + 1].toFixed(3)},${e[i + 2].toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, [e[i], e[i + 1], e[i + 2]]);
  }
  const verts = [...seen.values()];
  const positions = build(N, r, [
    [0.7, lines(segs, 0.012)],
    [0.3, blobs(verts, 0.05)],
  ]);
  return { positions, labels: [], edges };
}

function phone(N, r) {
  const body = roundRect(0, 0, 1.9, 3.9, 0.32, 6);
  const icons = [];
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 4; col++) icons.push([-0.6 + col * 0.4, 1.02 - row * 0.44]);
  [-0.6, -0.2, 0.2, 0.6].forEach((x) => icons.push([x, -1.45]));
  const s = 0.13;
  const positions = build(N, r, [
    [0.24, lines([...poly(body.map(onXY(0.09))), ...poly(body.map(onXY(-0.09)))])],
    [0.07, lines(poly(roundRect(0, 0, 1.68, 3.62, 0.22, 6).map(onXY(0.09))))],
    [0.44, boxes(icons.map(([x, y]) => [x - s, x + s, y - s, y + s, 0.09, 0.11]))],
    [0.05, lines(poly(roundRect(0, 1.66, 0.46, 0.12, 0.06, 4).map(onXY(0.1))))],
    [0.04, lines([[[-0.66, 1.42, 0.1], [-0.25, 1.42, 0.1]], [[0.35, 1.42, 0.1], [0.66, 1.42, 0.1]]])],
    [0.06, lines(poly(roundRect(0, -1.45, 1.52, 0.4, 0.16, 4).map(onXY(0.1))))],
    [0.04, lines([[[0.96, 0.95, 0], [0.96, 0.45, 0]], [[-0.96, 1.0, 0], [-0.96, 0.75, 0]]])],
  ]);
  const labels = [];
  bake(positions, labels, [0.04, -0.32, 0.02]);
  return { positions, labels };
}

function browser(N, r) {
  const frame = roundRect(0, 0, 4.4, 2.9, 0.12, 4);
  const cards = [-1.4, 0, 1.4];
  const cardOutlines = cards.flatMap((x) => poly(roundRect(x, -0.78, 1.2, 1.0, 0.06, 3).map(onXY(0))));
  const positions = build(N, r, [
    [0.17, lines(poly(frame.map(onXY(0))))],
    [0.03, lines([[[-2.2, 1.05, 0], [2.2, 1.05, 0]]])],
    [0.03, blobs([[-1.98, 1.25, 0], [-1.83, 1.25, 0], [-1.68, 1.25, 0]], 0.022)],
    [0.04, lines(poly(roundRect(0.15, 1.25, 2.3, 0.16, 0.08, 4).map(onXY(0))))],
    [0.07, boxes([[-1.95, -0.35, 0.64, 0.82, 0, 0.02]])],
    [0.04, lines([[[-1.95, 0.45, 0], [-0.55, 0.45, 0]], [[-1.95, 0.3, 0], [-0.85, 0.3, 0]]])],
    [0.05, boxes([[-1.95, -1.3, -0.04, 0.12, 0, 0.02]])],
    [0.04, lines(poly(roundRect(1.02, 0.45, 1.85, 0.95, 0.05, 3).map(onXY(0))))],
    [0.1, boxes([[0.15, 1.9, 0.02, 0.88, -0.01, 0.01]])],
    [0.15, lines(cardOutlines)],
    [0.14, boxes(cards.map((x) => [x - 0.55, x + 0.55, -0.72, -0.33, -0.01, 0.01]))],
    [0.06, lines(cards.flatMap((x) => [[[x - 0.5, -0.95, 0], [x + 0.05, -0.95, 0]], [[x - 0.5, -1.12, 0], [x - 0.15, -1.12, 0]]]))],
  ]);
  const labels = [];
  bake(positions, labels, [0.02, 0.3, 0]);
  return { positions, labels };
}

function systems(N, r) {
  const ys = [1.5, 0.75, 0, -0.75, -1.5];
  const names = ["ERP", "CRM", "POS", "HRM", "Management"];
  const plane = roundRect(0, 0, 3.0, 1.9, 0.08, 3);
  const outlines = ys.flatMap((y) => poly(plane.map(onXZ(y))));
  const lattice = [];
  ys.forEach((y) => {
    for (let ix = 0; ix <= 10; ix++)
      for (let iz = 0; iz <= 6; iz++) lattice.push([-1.35 + ix * 0.27, y, -0.81 + iz * 0.27]);
  });
  // one distinct block per plane so the layers read as different screens
  const blocks = [
    [-1.3, -0.2, 1.5, 1.52, -0.75, -0.1],
    [0.2, 1.3, 0.75, 0.77, 0.1, 0.75],
    [-1.3, 0.0, 0, 0.02, 0.2, 0.75],
    [0.4, 1.3, -0.75, -0.73, -0.75, 0.2],
    [-0.6, 0.6, -1.5, -1.48, -0.75, -0.2],
  ];
  // data spine through the stack, plus short drops between neighbours
  const posts = [[[0, -1.5, 0], [0, 1.5, 0]]];
  ys.slice(1).forEach((y, i) => posts.push([[-0.9, y, -0.4], [-0.9, ys[i], -0.4]], [[0.9, y, 0.4], [0.9, ys[i], 0.4]]));
  const positions = build(N, r, [
    [0.3, lines(outlines)],
    [0.27, blobs(lattice, 0.012)],
    [0.16, boxes(blocks)],
    [0.1, lines(posts, 0.01)],
    [0.12, blobs(ys.map((y) => [0, y, 0]), 0.05)],
  ]);
  const labels = names.map((text, i) => ({ text, pos: [1.62, ys[i], 0.98] }));
  bake(positions, labels, [0.62, -0.55, 0], 0.95);
  return { positions, labels };
}

function chip(N, r) {
  const pkg = roundRect(0, 0, 1.7, 1.7, 0.08, 3);
  const pkgSegs = [...poly(pkg.map(onXZ(0))), ...poly(pkg.map(onXZ(0.14)))];
  [[0.85, 0.85], [-0.85, 0.85], [0.85, -0.85], [-0.85, -0.85]].forEach(([x, z]) =>
    pkgSegs.push([[x, 0, z], [x, 0.14, z]]),
  );
  const die = [];
  for (let ix = 0; ix <= 10; ix++) for (let iz = 0; iz <= 10; iz++) die.push([-0.45 + ix * 0.09, 0.15, -0.45 + iz * 0.09]);

  // build pins/traces on the +x side, then rotate copies to the other sides
  const rot = (k) => ([x, y, z]) => {
    const a = (k * Math.PI) / 2, c = Math.cos(a), s = Math.sin(a);
    return [x * c - z * s, y, x * s + z * c];
  };
  const pins = [], traces = [], ends = [];
  for (let k = 0; k < 4; k++) {
    const R = rot(k);
    for (let i = -3; i <= 3; i++) {
      const p = i * 0.2;
      pins.push([R([0.85, 0.05, p]), R([1.08, 0.05, p])]);
      if (i % 2 === 0) continue;
      const bend = 1.3 + 0.12 * Math.abs(i);
      const path = [[1.08, 0.05, p], [bend, 0.05, p], [bend + 0.25, 0.05, p * 2.1], [2.15, 0.05, p * 2.1]].map(R);
      traces.push(...poly(path, false));
      ends.push(R([2.24, 0.05, p * 2.1]));
    }
  }
  const nodeRings = ends.flatMap(([x, y, z]) => poly(circle(x, z, 0.09, 14).map(([u, v]) => [u, y, v])));
  const positions = build(N, r, [
    [0.16, lines(pkgSegs)],
    [0.16, blobs(die, 0.01)],
    [0.04, lines(poly(roundRect(0, 0, 1.0, 1.0, 0.04, 2).map(onXZ(0.15))))],
    [0.1, lines(pins)],
    [0.3, lines(traces)],
    [0.16, lines(nodeRings)],
    [0.08, blobs(ends, 0.025)],
  ]);
  const pick = [ends[1], ends[4], ends[7], ends[10]];
  const labels = ["Sensors", "Firmware", "Gateway", "Dashboard"].map((text, i) => ({
    text,
    pos: [pick[i][0], pick[i][1] + 0.15, pick[i][2]],
  }));
  bake(positions, labels, [0.62, 0.35, 0], 0.92);
  return { positions, labels };
}

function stack(N, r) {
  const radii = [1.25, 1.8, 2.35];
  const tilts = [[1.25, 0, 0.3], [1.05, 0, -0.55], [1.45, 0.4, 0.95]].map((e) => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...e)));
  const v = new THREE.Vector3();
  const ringPoint = (j, a) => v.set(Math.cos(a) * radii[j], 0, Math.sin(a) * radii[j]).applyMatrix4(tilts[j]).toArray();
  const ringSegs = [];
  radii.forEach((_, j) => {
    const pts = [];
    for (let i = 0; i < 72; i++) pts.push(ringPoint(j, (i / 72) * TAU));
    ringSegs.push(...poly(pts));
  });
  const names = ["Python", "Java", "Flutter", "Firebase", "Cloudflare", "Node.js", "React", "Next.js", "Vite"];
  const nodes = names.map((_, n) => {
    const j = n % 3;
    return ringPoint(j, Math.floor(n / 3) * 2.1 + j * 0.9 + 0.4);
  });
  const halos = nodes.flatMap(([x, y, z]) => poly(circle(x, y, 0.15, 16).map(([u, w]) => [u, w, z])));
  const spokes = nodes.map(([x, y, z]) => {
    const l = Math.hypot(x, y, z);
    return [[(x / l) * 0.6, (y / l) * 0.6, (z / l) * 0.6], [x, y, z]];
  });
  const positions = build(N, r, [
    [0.14, (rr) => {
      const p = v.set(gauss(rr), gauss(rr), gauss(rr)).normalize().multiplyScalar(0.55);
      return p.toArray();
    }],
    [0.36, lines(ringSegs)],
    [0.2, blobs(nodes, 0.06)],
    [0.16, lines(halos)],
    [0.06, lines(spokes, 0.004)],
    [0.08, (rr) => v.set(gauss(rr), gauss(rr), gauss(rr)).multiplyScalar(0.35).toArray()],
  ]);
  const labels = names.map((text, i) => ({ text, pos: nodes[i] }));
  return { positions, labels };
}

function globe(N, r) {
  const R = 1.85;
  const M = 1100, fib = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < M; i++) {
    const y = 1 - (i / (M - 1)) * 2, rad = Math.sqrt(1 - y * y), th = ga * i;
    fib.push([Math.cos(th) * rad * R, y * R, Math.sin(th) * rad * R]);
  }
  const ll = (lat, lon, rr = R) => {
    const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
    return [Math.cos(a) * Math.cos(b) * rr, Math.sin(a) * rr, Math.cos(a) * Math.sin(b) * rr];
  };
  const latSegs = [];
  [-60, -30, 0, 30, 60].forEach((lat) => {
    const pts = [];
    for (let i = 0; i < 64; i++) pts.push(ll(lat, (i / 64) * 360));
    latSegs.push(...poly(pts));
  });
  const merSegs = [];
  for (let m = 0; m < 6; m++) {
    const pts = [];
    for (let i = 0; i < 64; i++) pts.push(ll(-90 + (i / 64) * 360, m * 30));
    merSegs.push(...poly(pts));
  }
  const sites = [[51, -10], [40, -80], [1, 104], [35, 139], [-33, 151], [-23, -46], [25, 55], [19, 73], [6, 80]];
  const pairs = [[0, 1], [0, 6], [6, 7], [7, 8], [8, 2], [2, 3], [2, 4], [1, 5], [0, 7]];
  const arcSegs = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), q = new THREE.Vector3();
  for (const [i, j] of pairs) {
    a.fromArray(ll(...sites[i])).normalize();
    b.fromArray(ll(...sites[j])).normalize();
    const ang = a.angleTo(b), pts = [];
    for (let k = 0; k <= 32; k++) {
      const t = k / 32;
      q.copy(a).multiplyScalar(Math.sin((1 - t) * ang)).addScaledVector(b, Math.sin(t * ang)).divideScalar(Math.sin(ang));
      pts.push(q.multiplyScalar(R * (1 + 0.22 * Math.sin(Math.PI * t))).toArray());
    }
    arcSegs.push(...poly(pts, false));
  }
  const ring = [];
  for (let i = 0; i < 90; i++) {
    const t = (i / 90) * TAU;
    ring.push([Math.cos(t) * 2.55, Math.sin(t) * 0.35, Math.sin(t) * 2.55]);
  }
  const ends = sites.map((s) => ll(...s));
  const positions = build(N, r, [
    [0.36, blobs(fib, 0.008)],
    [0.12, lines(latSegs)],
    [0.09, lines(merSegs)],
    [0.24, lines(arcSegs, 0.006)],
    [0.11, blobs(ends, 0.04)],
    [0.08, lines(poly(ring))],
  ]);
  const labels = [".com", "SSL", "DNS", "CDN", "Backups"].map((text, i) => ({
    text,
    pos: ll(...sites[[0, 2, 7, 1, 3][i]], R * 1.12),
  }));
  bake(positions, labels, [0.28, -0.4, 0.22]);
  return { positions, labels };
}

/* Order = film order. offset: where the object sits on desktop (captions
   take the other side); spin: how much it idles around its own axis. */
export function buildShapes(N, seed = 7) {
  const r = mulberry32(seed);
  const mark = vertexMark(N, r);
  return [
    { id: "vertex", ...mark, offset: [0, 0.7], spin: 0.5 },
    { id: "mobile", ...phone(N, r), offset: [1.95, 0], spin: 0 },
    { id: "web", ...browser(N, r), offset: [-1.75, 0], spin: 0 },
    { id: "systems", ...systems(N, r), offset: [1.85, 0], spin: 0.25 },
    { id: "iot", ...chip(N, r), offset: [-1.85, -0.1], spin: 0.15 },
    { id: "stack", ...stack(N, r), offset: [1.85, 0], spin: 0.6 },
    { id: "hosting", ...globe(N, r), offset: [-1.85, 0], spin: 0.5 },
    { id: "vertex-end", ...mark, offset: [0, 0.55], spin: 0.5 },
  ];
}

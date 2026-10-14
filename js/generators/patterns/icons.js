// icons.js
// Motivos "memorables" para el muestrario: imágenes reconocibles (estrella, luna,
// sol, mariposa, peces, hongos, paraguas, loto, gato, corazones dobles, pluma)
// en lugar de texturas. Se dibujan con formas CERRADAS y de buen tamaño para que
// se puedan colorear; los detalles pequeños (ojos, manchas) solo se rellenan de
// negro con cfg.solids. Misma firma que motifs.js: (rng, r, cfg) → capas.
import { rFloat, rInt } from "../../core/prng.js";
import { mk, ink, sideOf, centerOf, pitch, lattice, emit, TAU, W, HEART } from "./motifs.js";

// Transformación local (unidades del icono → página) con giro opcional.
const tfFor = (cx, cy, s, rot = 0) => {
  const c = Math.cos(rot), n = Math.sin(rot);
  return (x, y) => [cx + (x * c - y * n) * s, cy + (x * n + y * c) * s];
};

function star(b, cx, cy, ro, ri, rot) {
  for (let k = 0; k < 10; k++) {
    const a = rot - Math.PI / 2 + (k * Math.PI) / 5, rad = k % 2 ? ri : ro;
    const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
    if (k) b.lineTo(x, y); else b.moveTo(x, y);
  }
  b.close();
}

function starfield(rng, r, cfg) {
  const p = pitch(rng, r, cfg, 2, 3, 5.5);
  const b = mk(rng, cfg), core = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, p, p * 0.95, { stagger: true, jitter: 0.03, over: 0.2 })) {
    const rot = rFloat(rng, -0.25, 0.25), ro = p * 0.4;
    star(b, q.x, q.y, ro, ro * 0.45, rot);
    star(core, q.x, q.y, ro * 0.5, ro * 0.22, rot);
  }
  return [{ d: b.d, fill: "none" }, { d: core.d, fill: ink(cfg) }];
}

// Luna creciente (dos arcos) con estrellas; en tinta la luna va rellena.
function moonStars(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, s = R * 0.78, rot = rFloat(rng, -0.4, 0.1);
  const T = tfFor(cx - R * 0.12, cy, s, rot);
  const r2 = 0.8, d = 0.5;
  const x = (d * d + 1 - r2 * r2) / (2 * d), y = Math.sqrt(1 - x * x);
  const moon = mk(rng, cfg);
  const [x1, y1] = T(x, -y), [x2, y2] = T(x, y);
  moon.moveTo(x1, y1).arcTo(s, s, 0, 1, 0, x2, y2).arcTo(s * r2, s * r2, 0, x > d ? 1 : 0, 1, x1, y1).close();
  const stars = mk(rng, cfg);
  const ro = R * 0.17;
  for (const [u, v, k] of [[0.95, -0.55, 1], [1.05, 0.2, 0.75], [0.7, 0.72, 0.9]]) {
    const [sx, sy] = T(u, v);
    star(stars, sx, sy, ro * k, ro * k * 0.46, rFloat(rng, -0.3, 0.3));
  }
  return [{ d: moon.d, fill: ink(cfg) }, { d: stars.d, fill: "none" }];
}

function sun(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2;
  const n = rInt(rng, 10, 14), a0 = rFloat(rng, 0, TAU);
  const b = mk(rng, cfg), core = mk(rng, cfg);
  b.circle(cx, cy, R * 0.5);
  b.circle(cx, cy, R * 0.34);
  core.circle(cx, cy, R * 0.13);
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * TAU, half = (Math.PI / n) * 0.72;
    const tip = R * (k % 2 ? 0.74 : 0.9);
    b.moveTo(cx + Math.cos(a - half) * R * 0.54, cy + Math.sin(a - half) * R * 0.54)
      .lineTo(cx + Math.cos(a) * tip, cy + Math.sin(a) * tip)
      .lineTo(cx + Math.cos(a + half) * R * 0.54, cy + Math.sin(a + half) * R * 0.54)
      .close();
  }
  return [{ d: b.d, fill: "none" }, { d: core.d, fill: ink(cfg) }];
}

const UW = [["M", 0.06, -0.08], ["C", 0.3, -0.98, 1.0, -0.92, 0.95, -0.4], ["C", 0.92, -0.08, 0.5, 0, 0.06, 0.04], ["Z"]];
const LW = [["M", 0.06, 0.1], ["C", 0.5, 0.02, 0.9, 0.2, 0.78, 0.58], ["C", 0.68, 0.92, 0.3, 0.82, 0.06, 0.2], ["Z"]];
const BODY = [["M", 0, -0.4], ["Q", 0.18, 0.1, 0, 0.72], ["Q", -0.18, 0.1, 0, -0.4], ["Z"]];

function butterfly(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, s = R * 0.8, rot = rFloat(rng, -0.35, 0.35);
  const T = tfFor(cx, cy, s, rot);
  const b = mk(rng, cfg), dots = mk(rng, cfg), body = mk(rng, cfg);
  for (const m of [1, -1]) {
    emit(b, UW, cx, cy, s * m, s, rot);
    emit(b, LW, cx, cy, s * m, s, rot);
    for (const [u, v, rr] of [[0.6, -0.5, 0.2], [0.5, 0.45, 0.13]]) {
      const [x, y] = T(u * m, v);
      b.circle(x, y, rr * s);
    }
    const [ax, ay] = T(0, -0.4), [qx, qy] = T(0.1 * m, -0.7), [ex, ey] = T(0.32 * m, -0.84);
    b.moveTo(ax, ay).quadTo(qx, qy, ex, ey);
    dots.circle(ex, ey, s * 0.05);
  }
  emit(body, BODY, cx, cy, s, s, rot);
  return [{ d: b.d, fill: "none" }, { d: body.d, fill: ink(cfg) }, { d: dots.d, fill: ink(cfg) }];
}

const FISH = [["M", 1, 0], ["C", 0.75, -0.5, 0.15, -0.5, -0.35, 0], ["C", 0.15, 0.5, 0.75, 0.5, 1, 0], ["Z"],
  ["M", -0.3, 0], ["L", -0.95, -0.45], ["Q", -0.72, 0, -0.95, 0.45], ["Z"],
  ["M", 0.38, -0.24], ["Q", 0.22, 0, 0.38, 0.24]];

function fishSchool(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, hw = R * 0.5;
  const b = mk(rng, cfg), eyes = mk(rng, cfg), bub = mk(rng, cfg);
  const flip = rng() < 0.5 ? 1 : -1;
  [[-0.58, -0.1], [0, 0.12], [0.58, -0.1]].forEach(([dy, dx], k) => {
    const dir = (k & 1 ? -1 : 1) * flip, x = cx + dx * R, y = cy + dy * R;
    emit(b, FISH, x, y, hw * dir, hw);
    eyes.circle(x + dir * hw * 0.64, y - hw * 0.1, hw * 0.12);
    bub.circle(x + dir * hw * 1.18, y - hw * 0.5, R * 0.07);
  });
  return [{ d: b.d, fill: "none" }, { d: bub.d, fill: "none" }, { d: eyes.d, fill: ink(cfg) }];
}

const CAP = [["M", -1, 0], ["C", -1, -1.05, 1, -1.05, 1, 0], ["Z"]];
const STEM = [["M", -0.38, 0], ["L", -0.3, 0.85], ["Q", 0, 1.0, 0.3, 0.85], ["L", 0.38, 0], ["Z"]];

function mushrooms(rng, r, cfg) {
  const px = Math.max(sideOf(r) / rFloat(rng, 2.0, 2.4), cfg.minGapMm * 9);
  const b = mk(rng, cfg), spots = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, px, px * 0.95, { stagger: true, jitter: 0.03, over: 0.02 })) {
    const u = px * 0.42, cy = q.y - u * 0.05, tilt = rFloat(rng, -0.12, 0.12);
    const T = tfFor(q.x, cy, u, tilt);
    emit(b, STEM, q.x, cy, u, u, tilt);
    emit(b, CAP, q.x, cy, u, u, tilt);
    for (const [a, c, rr] of [[-0.5, -0.32, 0.17], [0.05, -0.62, 0.2], [0.55, -0.3, 0.14]]) {
      const [x, y] = T(a, c);
      spots.circle(x, y, rr * u);
    }
  }
  return [{ d: b.d, fill: "none" }, { d: spots.d, fill: ink(cfg) }];
}

const CANOPY = [["M", -1, 0], ["C", -1, -1.05, 1, -1.05, 1, 0], ["Q", 0.75, 0.28, 0.5, 0], ["Q", 0.25, 0.28, 0, 0],
  ["Q", -0.25, 0.28, -0.5, 0], ["Q", -0.75, 0.28, -1, 0], ["Z"]];
const RIBS = [["M", 0, -0.82], ["L", 0.5, 0], ["M", 0, -0.82], ["L", 0, 0], ["M", 0, -0.82], ["L", -0.5, 0]];
const HANDLE = [["M", 0, 0.02], ["L", 0, 0.85], ["Q", 0, 1.0, -0.17, 1.0], ["Q", -0.32, 1.0, -0.32, 0.85]];

function umbrella(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, s = R * 0.74, rot = rFloat(rng, -0.2, 0.2);
  const T = tfFor(cx, cy, s, rot);
  const b = mk(rng, cfg), drops = mk(rng, cfg);
  emit(b, CANOPY, cx, cy - s * 0.05, s, s, rot);
  emit(b, RIBS, cx, cy - s * 0.05, s, s, rot);
  emit(b, HANDLE, cx, cy - s * 0.05, s, s, rot);
  for (const [u, v, k] of [[-0.95, 0.5, 1], [0.98, 0.58, 0.85], [0.55, 0.95, 0.75]]) {
    const [x, y] = T(u, v);
    emit(drops, [["M", 0, -1], ["C", 0.15, -0.55, 0.78, -0.05, 0.78, 0.42], ["C", 0.78, 0.8, 0.42, 1, 0, 1],
      ["C", -0.42, 1, -0.78, 0.8, -0.78, 0.42], ["C", -0.78, -0.05, -0.15, -0.55, 0, -1], ["Z"]], x, y, R * 0.1 * k, R * 0.15 * k);
  }
  return [{ d: b.d, fill: "none" }, { d: drops.d, fill: ink(cfg) }];
}

const PET = [["M", 0, 0], ["Q", 0.9, -0.5, 0, -1], ["Q", -0.9, -0.5, 0, 0], ["Z"]];

// Flor de loto: tres pares de pétalos que se tapan entre sí + agua.
function lotus(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2;
  const bx = cx, by = cy + R * 0.42;
  const layers = [];
  for (const [angs, L, w] of [[[-1.15, 1.15], R * 0.78, 0.62], [[-0.6, 0.6], R * 0.9, 0.55], [[0], R * 0.98, 0.5]]) {
    const b = mk(rng, cfg);
    for (const a of angs) emit(b, PET, bx, by, L * w, L, a);
    layers.push({ d: b.d, fill: W });
  }
  const water = mk(rng, cfg);
  for (const [dy, half] of [[0.62, 0.78], [0.84, 0.55]]) {
    const y = cy + R * dy;
    water.moveTo(cx - R * half, y);
    water.cubicTo(cx - R * half * 0.5, y - R * 0.1, cx - R * half * 0.2, y + R * 0.1, cx, y)
      .cubicTo(cx + R * half * 0.2, y - R * 0.1, cx + R * half * 0.5, y + R * 0.1, cx + R * half, y);
  }
  layers.push({ d: water.d, fill: "none" });
  return layers;
}

function cat(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, s = R * 0.72;
  const T = tfFor(cx, cy + R * 0.05, s);
  const ears = mk(rng, cfg), head = mk(rng, cfg), inner = mk(rng, cfg), feat = mk(rng, cfg), eyes = mk(rng, cfg), nose = mk(rng, cfg);
  for (const m of [1, -1]) {
    const e = [[0.8 * m, -0.15], [0.76 * m, -0.98], [0.2 * m, -0.7]].map(([u, v]) => T(u, v));
    ears.moveTo(...e[0]).lineTo(...e[1]).lineTo(...e[2]).close();
    const i = [[0.66 * m, -0.34], [0.67 * m, -0.78], [0.38 * m, -0.62]].map(([u, v]) => T(u, v));
    inner.moveTo(...i[0]).lineTo(...i[1]).lineTo(...i[2]).close();
    const [ex, ey] = T(0.34 * m, -0.05);
    eyes.circle(ex, ey, s * 0.13);
    const [m1x, m1y] = T(0, 0.44), [m2x, m2y] = T(0.13 * m, 0.56), [m3x, m3y] = T(0.27 * m, 0.46);
    feat.moveTo(m1x, m1y).quadTo(m2x, m2y, m3x, m3y);
    for (const [v0, v1] of [[0.24, 0.1], [0.34, 0.36], [0.44, 0.62]]) {
      const [wx0, wy0] = T(0.5 * m, v0), [wx1, wy1] = T(1.12 * m, v1);
      feat.moveTo(wx0, wy0).lineTo(wx1, wy1);
    }
  }
  const [hx, hy] = T(0, 0.1);
  head.circle(hx, hy, s * 0.86);
  const n = [[-0.11, 0.2], [0.11, 0.2], [0, 0.34]].map(([u, v]) => T(u, v));
  nose.moveTo(...n[0]).lineTo(...n[1]).lineTo(...n[2]).close();
  const [t1x, t1y] = T(0, 0.34), [t2x, t2y] = T(0, 0.44);
  feat.moveTo(t1x, t1y).lineTo(t2x, t2y);
  return [{ d: ears.d, fill: W }, { d: head.d, fill: W }, { d: inner.d, fill: "none" }, { d: feat.d, fill: "none" },
    { d: eyes.d, fill: ink(cfg) }, { d: nose.d, fill: ink(cfg) }];
}

// Corazones anidados: en tinta, corazón negro con otro blanco dentro.
function doubleHearts(rng, r, cfg) {
  const p = pitch(rng, r, cfg, 2, 3, 6);
  const outer = mk(rng, cfg), inner = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, p, p * 0.92, { stagger: true, jitter: 0.03, over: 0.2 })) {
    const tilt = rFloat(rng, -0.25, 0.25), hs = p * 0.44;
    emit(outer, HEART, q.x, q.y, hs, hs, tilt);
    const T = tfFor(q.x, q.y, hs, tilt);
    const [ix, iy] = T(0, 0.14);
    emit(inner, HEART, ix, iy, hs * 0.42, hs * 0.42, tilt);
  }
  return [{ d: outer.d, fill: ink(cfg) }, { d: inner.d, fill: W }];
}

// Pluma: silueta ancha arriba que se afina hacia el cañón, barbas oblicuas.
function feather(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, s = R * 0.86, rot = rFloat(rng, 0.35, 0.7) * (rng() < 0.5 ? 1 : -1);
  const b = mk(rng, cfg);
  emit(b, [["M", 0, 0.85], ["C", 0.3, 0.5, 0.8, 0.1, 0.64, -0.45], ["C", 0.52, -0.85, 0.18, -1, 0, -1],
    ["C", -0.18, -1, -0.52, -0.85, -0.64, -0.45], ["C", -0.8, 0.1, -0.3, 0.5, 0, 0.85], ["Z"],
    ["M", 0, -0.92], ["L", 0, 1.12]], cx, cy, s, s, rot);
  const T = tfFor(cx, cy, s, rot);
  // Semiancho aproximado del contorno; las barbas terminan 14 % dentro.
  const half = (y) => (y < -0.45
    ? 0.64 * Math.sqrt(Math.max(0, 1 - Math.pow((y + 0.45) / 0.55, 2)))
    : 0.64 * (1 - Math.pow(Math.min(1, (y + 0.45) / 1.3), 1.6))) * 0.86;
  for (let k = 0; k < 6; k++) {
    const y = -0.62 + k * 0.2, y1 = y - 0.18;
    for (const m of [1, -1]) {
      const [x0, y0] = T(0, y + 0.12), [x1, yy1] = T(half(y1) * m, y1);
      b.moveTo(x0, y0).lineTo(x1, yy1);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

export const ICONS = [
  { id: "starfield", fn: starfield },
  { id: "moonStars", fn: moonStars, heavy: true },
  { id: "sun", fn: sun },
  { id: "butterfly", fn: butterfly },
  { id: "fishSchool", fn: fishSchool },
  { id: "mushrooms", fn: mushrooms },
  { id: "umbrella", fn: umbrella },
  { id: "lotus", fn: lotus },
  { id: "cat", fn: cat },
  { id: "doubleHearts", fn: doubleHearts, heavy: true },
  { id: "feather", fn: feather },
];

// icons.js
// Motivos "memorables" para el muestrario: imágenes reconocibles (estrella, luna,
// sol, mariposa, peces, hongos, paraguas, loto, gato, corazones dobles, pluma)
// en lugar de texturas. Se dibujan con formas CERRADAS y de buen tamaño para que
// se puedan colorear; los detalles pequeños (ojos, manchas) solo se rellenan de
// negro con cfg.solids. Misma firma que motifs.js: (rng, r, cfg) → capas.
import { PathBuilder } from "../../core/pathBuilder.js";
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

// Estrella central doble (eco) rodeada de seis estrellas; en tinta las pequeñas
// van negras. Composición fija: una retícula al azar dejaba a veces una sola.
function starfield(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, a0 = rFloat(rng, 0, TAU);
  const b = mk(rng, cfg), core = mk(rng, cfg), small = mk(rng, cfg);
  const ro = R * 0.34, rot = rFloat(rng, -0.2, 0.2);
  star(b, cx, cy, ro, ro * 0.45, rot);
  star(core, cx, cy, ro * 0.5, ro * 0.22, rot);
  for (let k = 0; k < 6; k++) {
    const a = a0 + (k / 6) * TAU;
    star(small, cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72, R * 0.19, R * 0.19 * 0.46, a + Math.PI / 2);
  }
  return [{ d: b.d, fill: "none" }, { d: small.d, fill: ink(cfg) }, { d: core.d, fill: ink(cfg) }];
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

const CAP = [["M", -1, 0], ["C", -1, -1.05, 1, -1.05, 1, 0], ["Z"]];
const STEM = [["M", -0.38, 0], ["L", -0.3, 0.85], ["Q", 0, 1.0, 0.3, 0.85], ["L", 0.38, 0], ["Z"]];

function mushrooms(rng, r, cfg) {
  // Tres hongos de distinto tamaño; el sombrero grande lleva un tangle.
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2;
  const b = mk(rng, cfg), spots = mk(rng, cfg), layers = [];
  [[-0.38, 0.12, 0.42], [0.48, 0.34, 0.3], [0.34, -0.36, 0.24]].forEach(([dx, dy, k], idx) => {
    const u = R * k, x = cx + dx * R, y = cy + dy * R, tilt = rFloat(rng, -0.1, 0.1);
    const T = tfFor(x, y, u, tilt);
    emit(b, STEM, x, y, u, u, tilt);
    emit(b, CAP, x, y, u, u, tilt);
    if (idx === 0) {
      const box = { x0: x - u, y0: y - u, x1: x + u, y1: y + u };
      layers.push(...zen(pickKinds(rng, 1, ["dots", "hatch", "scallops"])[0], rng, box, cfg, gFor(cfg, u, 0.3), shapeD(CAP, x, y, u, u, tilt), 0.8));
      return;
    }
    if (!cfg.solids) return; // en contorno, manchas de ~1.5 mm no admiten un marcador
    for (const [a, c, rr] of [[-0.5, -0.32, 0.17], [0.05, -0.62, 0.2], [0.55, -0.3, 0.14]]) {
      const [sx, sy] = T(a, c);
      spots.circle(sx, sy, rr * u);
    }
  });
  return [...layers, { d: b.d, fill: "none" }, { d: spots.d, fill: ink(cfg) }];
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

/* ============ Relleno zentangle recortado ============ */
// Contorno como path sin temblor (sirve de recorte exacto del relleno).
const shapeD = (cmds, cx, cy, sx, sy = sx, rot = 0) => {
  const c = new PathBuilder({ sketchy: 0 });
  emit(c, cmds, cx, cy, sx, sy, rot);
  return c.d;
};

// "cross" (rombos) queda fuera del sorteo: deja cuñas pequeñas; se pide a mano.
const KINDS = ["hatch", "waves", "scallops", "dots", "zigzag"];
// n elementos distintos de `list`, en orden aleatorio (copia: no muta la lista).
function pickFrom(rng, list, n) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}
const pickKinds = (rng, n, extra = []) => pickFrom(rng, [...extra, ...KINDS], n);

// Tangle `kind` sobre el recuadro r, recortado a clipD. g = paso entre líneas.
// kinds: hatch (rayado), cross (rombos/cuadrícula), waves, scallops (escamas),
// zigzag, dots (círculos que se rellenan de negro solo con solids).
function zen(kind, rng, r, cfg, g, clipD, ang = 0.6) {
  const b = mk(rng, cfg), dots = mk(rng, cfg);
  const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2, D = Math.hypot(r.x1 - r.x0, r.y1 - r.y0) * 1.05;
  const frame = (a) => {
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    return (t, u) => [cx + dx * t + nx * u, cy + dy * t + ny * u];
  };
  const lines = (a, step) => {
    const P = frame(a);
    for (let u = -D / 2; u <= D / 2; u += step) b.moveTo(...P(-D / 2, u)).lineTo(...P(D / 2, u));
  };
  const P = frame(ang);
  if (kind === "hatch") lines(ang, g);
  else if (kind === "cross") { lines(ang, g * 1.3); lines(ang + Math.PI / 2, g * 1.3); }
  else if (kind === "waves" || kind === "zigzag") {
    const wave = kind === "waves", lam = g * (wave ? 2.4 : 1.8), amp = g * (wave ? 0.34 : 0.4);
    for (let u = -D / 2; u <= D / 2; u += g) {
      b.moveTo(...P(-D / 2, u));
      let up = 1;
      for (let t = -D / 2; t < D / 2; t += lam / 2, up = -up) {
        if (wave) b.quadTo(...P(t + lam / 4, u + up * amp * 2), ...P(t + lam / 2, u));
        else b.lineTo(...P(t + lam / 2, u + up * amp));
      }
    }
  } else if (kind === "scallops") {
    const w = g * 2.6, h = g * 1.1;
    let row = 0;
    for (let u = -D / 2; u <= D / 2 + h; u += h, row++) {
      for (let t = -D / 2 - w + (row & 1) * (w / 2); t < D / 2; t += w) b.moveTo(...P(t, u)).arcTo(w / 2, w / 2, 0, 0, 1, ...P(t + w, u));
    }
  } else if (kind === "dots") {
    // Círculos de >= 1.8 mm de radio: más chicos no admiten la punta de un marcador.
    const rad = Math.max(1.8, g * 0.5), gd = rad * 2.7;
    let row = 0;
    for (let u = -D / 2; u <= D / 2; u += gd * 0.9, row++) {
      for (let t = -D / 2 + (row & 1) * (gd / 2); t < D / 2; t += gd) dots.circle(...P(t, u), rad);
    }
  }
  const layers = [];
  if (b.d) layers.push({ d: b.d, fill: "none", clipD, w: 0.8 });
  if (dots.d) layers.push({ d: dots.d, fill: ink(cfg), clipD, w: 0.8 });
  return layers;
}

const gFor = (cfg, size, f = 0.15) => Math.max(cfg.minGapMm * 1.4, size * f);

/* ============ Iconos zentangle ============ */

// Tres corazones en contorno; cada uno lleva un tangle distinto (o "eco" concéntrico).
function zenHearts(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, hs = R * 0.4;
  const kinds = pickKinds(rng, 3, ["echo"]);
  const layers = [], outline = mk(rng, cfg), echo = mk(rng, cfg);
  [[-0.5, -0.3, -0.15], [0.5, -0.3, 0.15], [0, 0.46, 0]].forEach(([dx, dy, tilt], n) => {
    const x = cx + dx * R, y = cy + dy * R, kind = kinds[n];
    emit(outline, HEART, x, y, hs, hs, tilt);
    if (kind === "echo") {
      for (const f of [0.7, 0.42]) emit(echo, HEART, x, y + hs * 0.05, hs * f, hs * f, tilt);
      return;
    }
    const box = { x0: x - hs, y0: y - hs, x1: x + hs, y1: y + hs };
    layers.push(...zen(kind, rng, box, cfg, gFor(cfg, hs, 0.34), shapeD(HEART, x, y, hs, hs, tilt), rFloat(rng, 0.3, 1.2)));
  });
  layers.push({ d: echo.d, fill: "none" }, { d: outline.d, fill: "none" });
  return layers;
}

// Luna creciente llena de tangle + estrellas.
function moonStars(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, s = R * 0.78, rot = rFloat(rng, -0.4, 0.1);
  const T = tfFor(cx - R * 0.12, cy, s, rot);
  const r2 = 0.8, d = 0.5;
  const x = (d * d + 1 - r2 * r2) / (2 * d), y = Math.sqrt(1 - x * x);
  const [x1, y1] = T(x, -y), [x2, y2] = T(x, y);
  const trace = (b) => b.moveTo(x1, y1).arcTo(s, s, 0, 1, 0, x2, y2).arcTo(s * r2, s * r2, 0, x > d ? 1 : 0, 1, x1, y1).close();
  const moon = trace(mk(rng, cfg)), clip = trace(new PathBuilder({ sketchy: 0 }));
  const kind = pickKinds(rng, 1, ["waves", "scallops"])[0];
  const layers = zen(kind, rng, { x0: cx - R, y0: cy - R, x1: cx + R, y1: cy + R }, cfg, gFor(cfg, s, 0.17), clip.d, rot + 1.1);
  const stars = mk(rng, cfg), ro = R * 0.17;
  for (const [u, v, k] of [[0.95, -0.55, 1], [1.05, 0.2, 0.75], [0.7, 0.72, 0.9]]) {
    const [sx, sy] = T(u, v);
    star(stars, sx, sy, ro * k, ro * k * 0.46, rFloat(rng, -0.3, 0.3));
  }
  layers.push({ d: moon.d, fill: "none" }, { d: stars.d, fill: "none" });
  return layers;
}

// Mariposa: cada ala con su tangle (simétrica), ojos en las alas.
function butterfly(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, s = R * 0.8, rot = rFloat(rng, -0.3, 0.3);
  const T = tfFor(cx, cy, s, rot);
  // Alas superiores con líneas largas, inferiores con motivos; un ojo grande por
  // ala (sin anillo interior: dejaba una corona de <1 mm).
  const kUp = pickFrom(rng, ["hatch", "waves"], 1)[0], kLow = pickFrom(rng, ["scallops", "dots", "zigzag"], 1)[0];
  const box = { x0: cx - s, y0: cy - s, x1: cx + s, y1: cy + s };
  const g = gFor(cfg, s, 0.17);
  const layers = [], b = mk(rng, cfg), eyes = mk(rng, cfg), dots = mk(rng, cfg), body = mk(rng, cfg);
  for (const m of [1, -1]) {
    layers.push(...zen(kUp, rng, box, cfg, g, shapeD(UW, cx, cy, s * m, s, rot), 0.5 * m));
    layers.push(...zen(kLow, rng, box, cfg, g, shapeD(LW, cx, cy, s * m, s, rot), -0.7 * m));
    emit(b, UW, cx, cy, s * m, s, rot);
    emit(b, LW, cx, cy, s * m, s, rot);
    const [ex, ey] = T(0.6 * m, -0.5);
    eyes.circle(ex, ey, 0.22 * s);
    if (cfg.solids) dots.circle(ex, ey, 0.22 * s * 0.4);
    const [ax, ay] = T(0, -0.4), [qx, qy] = T(0.1 * m, -0.7), [fx, fy] = T(0.32 * m, -0.84);
    b.moveTo(ax, ay).quadTo(qx, qy, fx, fy);
    dots.circle(fx, fy, s * 0.05);
  }
  emit(body, BODY, cx, cy, s, s, rot);
  layers.push({ d: b.d, fill: "none" }, { d: eyes.d, fill: W }, { d: dots.d, fill: ink(cfg) }, { d: body.d, fill: ink(cfg) });
  return layers;
}

const FISH_BODY = [["M", 1, 0], ["C", 0.75, -0.5, 0.15, -0.5, -0.35, 0], ["C", 0.15, 0.5, 0.75, 0.5, 1, 0], ["Z"]];
const FISH_TAIL = [["M", -0.3, 0], ["L", -0.95, -0.45], ["Q", -0.72, 0, -0.95, 0.45], ["Z"]];
const GILL = [["M", 0.38, -0.24], ["Q", 0.22, 0, 0.38, 0.24]];

// Dos peces grandes: cuerpo de escamas, cola rayada.
function fishSchool(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, hw = R * 0.62, flip = rng() < 0.5 ? 1 : -1;
  const layers = [], b = mk(rng, cfg), eye = mk(rng, cfg), dot = mk(rng, cfg), bub = mk(rng, cfg);
  const kBody = "scallops", kTail = "hatch"; // el zigzag en la cola dejaba cuñas de ~1 mm
  [[-0.45, -0.1, 1], [0.45, 0.1, -1]].forEach(([dy, dx, dir0]) => {
    const dir = dir0 * flip, x = cx + dx * R, y = cy + dy * R;
    const box = { x0: x - hw, y0: y - hw, x1: x + hw, y1: y + hw };
    const g = gFor(cfg, hw, 0.2);
    layers.push(...zen(kBody, rng, box, cfg, g, shapeD(FISH_BODY, x, y, hw * dir, hw), dir > 0 ? Math.PI : 0));
    layers.push(...zen(kTail, rng, box, cfg, g, shapeD(FISH_TAIL, x, y, hw * dir, hw), Math.PI / 2));
    emit(b, FISH_BODY, x, y, hw * dir, hw);
    emit(b, FISH_TAIL, x, y, hw * dir, hw);
    emit(b, GILL, x, y, hw * dir, hw);
    eye.circle(x + dir * hw * 0.66, y - hw * 0.08, hw * 0.13);
    if (cfg.solids) dot.circle(x + dir * hw * 0.66, y - hw * 0.08, hw * 0.05);
    bub.circle(x + dir * hw * 1.22, y - hw * 0.55, R * 0.06);
  });
  layers.push({ d: b.d, fill: "none" }, { d: eye.d, fill: W }, { d: dot.d, fill: ink(cfg) }, { d: bub.d, fill: "none" });
  return layers;
}

const ELL = [["M", 1, 0], ["C", 1, 0.5523, 0.5523, 1, 0, 1], ["C", -0.5523, 1, -1, 0.5523, -1, 0], ["C", -1, -0.5523, -0.5523, -1, 0, -1], ["C", 0.5523, -1, 1, -0.5523, 1, 0], ["Z"]];
const EGG = [["M", 0, -0.82], ["C", 0.62, -0.82, 0.88, -0.35, 0.82, 0.25], ["C", 0.76, 0.78, 0.4, 0.98, 0, 0.98],
  ["C", -0.4, 0.98, -0.76, 0.78, -0.82, 0.25], ["C", -0.88, -0.35, -0.62, -0.82, 0, -0.82], ["Z"]];
const WINGS = [["M", 0, -1], ["C", 0.75, -0.5, 0.75, 0.5, 0, 1], ["C", -0.75, 0.5, -0.75, -0.5, 0, -1], ["Z"]];

// Búho: plumas de escamas en el vientre, alas rayadas, ojos con anillos.
function owl(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, s = R * 0.8;
  const T = tfFor(cx, cy + R * 0.02, s);
  const g = gFor(cfg, s, 0.25);
  const box = { x0: cx - s, y0: cy - s, x1: cx + s, y1: cy + s };
  const layers = [], ears = mk(rng, cfg), body = mk(rng, cfg), belly = mk(rng, cfg), wings = mk(rng, cfg);
  const eyes = mk(rng, cfg), rings = mk(rng, cfg), pupils = mk(rng, cfg), beak = mk(rng, cfg);
  const [kWing, kBelly] = [pickKinds(rng, 1, ["hatch", "zigzag"])[0], "scallops"];
  for (const m of [1, -1]) {
    const e = [[0.62 * m, -0.6], [0.74 * m, -1.0], [0.26 * m, -0.78]].map(([u, v]) => T(u, v));
    ears.moveTo(...e[0]).lineTo(...e[1]).lineTo(...e[2]).close();
  }
  const [bx, by] = T(0, 0);
  emit(body, EGG, bx, by, s, s);
  layers.push({ d: ears.d, fill: W }, { d: body.d, fill: W });
  const [lx, ly] = T(0, 0.4);
  layers.push(...zen(kBelly, rng, box, cfg, g, shapeD(ELL, lx, ly, s * 0.42, s * 0.56), 0));
  emit(belly, ELL, lx, ly, s * 0.42, s * 0.56);
  for (const m of [1, -1]) {
    const [wx, wy] = T(0.66 * m, 0.22);
    layers.push(...zen(kWing, rng, box, cfg, g, shapeD(WINGS, wx, wy, s * 0.2, s * 0.58, -0.1 * m), 1.2 * m));
    emit(wings, WINGS, wx, wy, s * 0.2, s * 0.58, -0.1 * m);
    const [ex, ey] = T(0.31 * m, -0.34);
    eyes.circle(ex, ey, s * 0.27);
    rings.circle(ex, ey, s * 0.15);
    pupils.circle(ex, ey, s * 0.055);
  }
  const bk = [[-0.09, -0.12], [0.09, -0.12], [0, 0.12]].map(([u, v]) => T(u, v));
  beak.moveTo(...bk[0]).lineTo(...bk[1]).lineTo(...bk[2]).close();
  layers.push({ d: belly.d, fill: "none" }, { d: wings.d, fill: "none" }, { d: eyes.d, fill: W }, { d: rings.d, fill: "none" },
    { d: pupils.d, fill: ink(cfg) }, { d: beak.d, fill: ink(cfg) });
  return layers;
}

const TULIP_KINDS = ["hatch", "waves", "scallops"];
const T_CENTER = [["M", 0, -1], ["C", 0.36, -0.62, 0.34, -0.05, 0, 0.25], ["C", -0.34, -0.05, -0.36, -0.62, 0, -1], ["Z"]];
const T_SIDE = [["M", 0.04, 0.25], ["C", 0.5, 0.2, 0.62, -0.4, 0.46, -0.82], ["C", 0.28, -0.6, 0.12, -0.42, 0.04, 0.25], ["Z"]];
const T_LEAF = [["M", 0, 0], ["C", 0.5, -0.3, 0.55, -0.9, 0.3, -1.3], ["C", -0.1, -1, -0.2, -0.45, 0, 0], ["Z"]];

// Tres tulipanes: cada pétalo con su tangle.
function tulips(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2;
  const layers = [], stems = mk(rng, cfg), leaves = mk(rng, cfg);
  const specs = [[0, -0.02, 0.78, 0], [-0.6, 0.22, 0.54, -0.2], [0.6, 0.22, 0.54, 0.2]];
  specs.forEach(([dx, dy, k, tilt], idx) => {
    const s = R * k, x = cx + dx * R, y = cy + dy * R;
    const T = tfFor(x, y, s, tilt);
    const g = gFor(cfg, s, 0.32);
    const box = { x0: x - s, y0: y - s, x1: x + s, y1: y + s };
    const [kc, ks] = pickFrom(rng, TULIP_KINDS, 2);
    const sides = mk(rng, cfg), center = mk(rng, cfg);
    for (const m of [1, -1]) emit(sides, T_SIDE, x, y, s * m, s, tilt);
    emit(center, T_CENTER, x, y, s, s, tilt);
    layers.push({ d: sides.d, fill: W });
    // Tulipanes chicos: pétalos laterales lisos (con tangle quedaban cuñas en la punta).
    if (k >= 0.7) for (const m of [1, -1]) layers.push(...zen(ks, rng, box, cfg, g, shapeD(T_SIDE, x, y, s * m, s, tilt), 0.9 * m));
    layers.push({ d: center.d, fill: W });
    layers.push(...zen(kc, rng, box, cfg, g, shapeD(T_CENTER, x, y, s, s, tilt), Math.PI / 2 + tilt));
    const [sx0, sy0] = T(0, 0.25), [sx1, sy1] = T(0, 1.25);
    stems.moveTo(sx0, sy0).lineTo(sx1, sy1);
    const [l1x, l1y] = T(0, 0.95);
    emit(leaves, T_LEAF, l1x, l1y, s * 0.55 * (idx === 2 ? -1 : 1), s * 0.6, tilt);
  });
  return [{ d: stems.d, fill: "none" }, { d: leaves.d, fill: W }, ...layers];
}

const POT = [["M", -0.46, 0.58], ["L", 0.46, 0.58], ["L", 0.36, 1.0], ["L", -0.36, 1.0], ["Z"]];
const RIM = [["M", -0.52, 0.46], ["L", 0.52, 0.46], ["L", 0.52, 0.6], ["L", -0.52, 0.6], ["Z"]];
const COLUMN = [["M", -0.21, 0.5], ["L", -0.21, -0.55], ["Q", -0.21, -0.82, 0, -0.82], ["Q", 0.21, -0.82, 0.21, -0.55], ["L", 0.21, 0.5], ["Z"]];
const ARM = [["M", -0.2, 0.17], ["L", -0.42, 0.17], ["Q", -0.64, 0.17, -0.64, -0.05], ["L", -0.64, -0.42], ["Q", -0.64, -0.55, -0.53, -0.55],
  ["Q", -0.42, -0.55, -0.42, -0.42], ["L", -0.42, -0.07], ["L", -0.2, -0.07], ["Z"]];

// Cactus: columna acanalada, maceta de rombos, brazos lisos (anchos para colorear).
function cactus(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, s = R * 0.84;
  const g = gFor(cfg, s, 0.26);
  const box = { x0: cx - s, y0: cy - s, x1: cx + s, y1: cy + s };
  const layers = [], arms = mk(rng, cfg), col = mk(rng, cfg), pot = mk(rng, cfg), rim = mk(rng, cfg), fl = mk(rng, cfg);
  const [kc, kp] = pickKinds(rng, 2, ["hatch", "cross"]);
  const oy = -s * 0.04;
  for (const m of [1, -1]) emit(arms, ARM, cx, cy + oy, s * m, s);
  emit(col, COLUMN, cx, cy + oy, s, s);
  emit(pot, POT, cx, cy + oy, s, s);
  emit(rim, RIM, cx, cy + oy, s, s);
  layers.push({ d: arms.d, fill: W }, { d: col.d, fill: W });
  layers.push(...zen("hatch", rng, box, cfg, g, shapeD(COLUMN, cx, cy + oy, s, s), Math.PI / 2));
  layers.push({ d: pot.d, fill: W });
  layers.push(...zen(kp === "hatch" ? "cross" : kp, rng, box, cfg, g, shapeD(POT, cx, cy + oy, s, s), Math.PI / 4));
  layers.push({ d: rim.d, fill: W });
  const fy = cy + oy - s * 0.8;
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    emit(fl, [["M", 0, 0], ["Q", 0.9, -0.5, 0, -1], ["Q", -0.9, -0.5, 0, 0], ["Z"]], cx + Math.sin(a) * s * 0.05, fy - Math.cos(a) * s * 0.05, s * 0.17, s * 0.26, a);
  }
  layers.push({ d: fl.d, fill: "none" });
  return layers;
}

export const ICONS = [
  { id: "starfield", fn: starfield },
  { id: "moonStars", fn: moonStars },
  { id: "sun", fn: sun },
  { id: "butterfly", fn: butterfly },
  { id: "fishSchool", fn: fishSchool },
  { id: "mushrooms", fn: mushrooms },
  { id: "umbrella", fn: umbrella },
  { id: "lotus", fn: lotus },
  { id: "cat", fn: cat },
  { id: "zenHearts", fn: zenHearts },
  { id: "feather", fn: feather },
  { id: "owl", fn: owl },
  { id: "tulips", fn: tulips },
  { id: "cactus", fn: cactus },
];

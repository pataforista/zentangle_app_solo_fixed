// figure.js
// «Figura zentangle»: la composición típica de los libros de zentangle más
// vendidos. Una figura grande y reconocible (búho, gato, pez, mariposa,
// corazón, tortuga, flor, hoja, elefante, caracol, pájaro, ballena,
// libélula, hongo, árbol, luna) ocupa la página; su interior se divide con
// strings curvos en secciones y cada sección lleva un tangle clásico denso.
// La rodean auras (contornos de eco) y un fondo de secciones más ligeras.
//
// Todo es contorno sobre blanco (apto para colorear). Las secciones se
// recortan con clipPath anidados: figura ∩ franja A ∩ franja B, así cada
// tangle termina exactamente en su string sin cálculo de polígonos.
import { createRNG, hash, rFloat, rInt } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";
import { CLASSIC_TANGLES, smoothPath } from "./patterns/classicTangles.js";
import { fillCadent, fillFlorz, fillCrescentMoon } from "./patterns/tangles.js";
import { fillScallops } from "./patterns/organic.js";

const TAU = Math.PI * 2;
const W = "#fff";
const fmt = (n) => (Math.round(Number(n) * 1000) / 1000).toString();
const clampN = (v, lo, hi, fb) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);

/* ============================ Tangles ============================ */

// Rellenos del motor de celdas (devuelven un único `d`) adaptados al formato
// de capas.
// cellMul fija el tamaño de la repetición (en huecos): sin él, cadent o florz
// escalan con la caja y en una sección grande quedaban gigantes y vacíos.
const legacy = (id, f, gapMul = 1, cellMul = 0) => ({
  id,
  fn: (rng, r, cfg) => {
    const d = f(rng, r, { minGapMm: cfg.gap * gapMul, patternStrokeMm: cfg.stroke, sketchy: cfg.sketchy, cellMm: cellMul ? cfg.gap * cellMul : 0 });
    return d ? [{ d, fill: "none" }] : [];
  },
});

const POOL = [
  ...CLASSIC_TANGLES,
  legacy("cadent", fillCadent, 0.95, 4.2),
  legacy("florz", fillFlorz, 0.95, 4.6),
  legacy("crescent", fillCrescentMoon, 0.9, 6.5),
  legacy("scallops", fillScallops, 1.1),
];
// Fondo: tangles amplios y tranquilos, para que la figura destaque.
const BG_POOL = ["tipple", "purk", "printemps", "beadlines", "static", "nzeppel", "scallops", "cubine", "keeko"];
// Rellenos de detalle (alas, cola, aletas): de grano fino y direccional.
const DETAIL_POOL = ["static", "keeko", "scallops", "beadlines", "nzeppel", "cubine", "tipple"];
const byId = new Map(POOL.map((t) => [t.id, t]));
// Para la guía de tangles del libro (bookExtras.js).
export const FIGURE_TANGLES = POOL;
// Tangles de trazo exigente (muchas líneas cortas o cruces): van al final de
// un libro con dificultad progresiva.
const HARD = new Set(["paradox", "hollibaugh", "bales", "cubine", "cadent", "florz", "printemps", "keeko"]);
// El fondo usa una escala más abierta que la figura: así la figura destaca.
const BG_GAP = 1.7;

/* ======================= Geometría de formas ======================= */

// Formas como comandos [["M",x,y],["C",...],["Q",...],["L",...],["Z"]] en
// unidades de la figura (y hacia abajo). tf(u,v) → [x,y] de página.
function emitPath(b, cmds, tf) {
  for (const c of cmds) {
    const [op, ...a] = c;
    if (op === "M") b.moveTo(...tf(a[0], a[1]));
    else if (op === "L") b.lineTo(...tf(a[0], a[1]));
    else if (op === "Q") b.quadTo(...tf(a[0], a[1]), ...tf(a[2], a[3]));
    else if (op === "C") b.cubicTo(...tf(a[0], a[1]), ...tf(a[2], a[3]), ...tf(a[4], a[5]));
    else if (op === "Z") b.close();
  }
  return b;
}

// Aplana a anillos de puntos (para pertenencia y extensión).
function flatten(cmds, tf) {
  const rings = [];
  let cur = null, px = 0, py = 0, sx = 0, sy = 0;
  const push = (x, y) => { cur.push({ x, y }); px = x; py = y; };
  for (const c of cmds) {
    const [op, ...a] = c;
    if (op === "M") { cur = []; rings.push(cur); const [x, y] = tf(a[0], a[1]); push(x, y); sx = x; sy = y; }
    else if (op === "L") { const [x, y] = tf(a[0], a[1]); push(x, y); }
    else if (op === "Q") {
      const [qx, qy] = tf(a[0], a[1]), [x, y] = tf(a[2], a[3]), x0 = px, y0 = py;
      for (let s = 1; s <= 12; s++) { const t = s / 12, m = 1 - t; push(m * m * x0 + 2 * m * t * qx + t * t * x, m * m * y0 + 2 * m * t * qy + t * t * y); }
    } else if (op === "C") {
      const [c1x, c1y] = tf(a[0], a[1]), [c2x, c2y] = tf(a[2], a[3]), [x, y] = tf(a[4], a[5]), x0 = px, y0 = py;
      for (let s = 1; s <= 18; s++) {
        const t = s / 18, m = 1 - t;
        push(m * m * m * x0 + 3 * m * m * t * c1x + 3 * m * t * t * c2x + t * t * t * x, m * m * m * y0 + 3 * m * m * t * c1y + 3 * m * t * t * c2y + t * t * t * y);
      }
    } else if (op === "Z" && cur) { push(sx, sy); }
  }
  return rings.filter((r) => r.length > 2);
}

function inside(rings, x, y) {
  let c = false;
  for (const p of rings) for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

function bboxOf(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of rings) for (const q of p) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
  return { x0, y0, x1, y1 };
}

// Recorta un polígono (cóncavo o no) a un rectángulo (Sutherland–Hodgman).
// El fondo se recorta así, en geometría: resvg pierde contenido cuando un
// clipPath de marco envuelve otros recortes con contenido girado.
function clipToRect(poly, r) {
  const edges = [
    [(p) => p.x >= r.x0, (a, b) => ({ x: r.x0, y: a.y + ((b.y - a.y) * (r.x0 - a.x)) / (b.x - a.x) })],
    [(p) => p.x <= r.x1, (a, b) => ({ x: r.x1, y: a.y + ((b.y - a.y) * (r.x1 - a.x)) / (b.x - a.x) })],
    [(p) => p.y >= r.y0, (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y0 - a.y)) / (b.y - a.y), y: r.y0 })],
    [(p) => p.y <= r.y1, (a, b) => ({ x: a.x + ((b.x - a.x) * (r.y1 - a.y)) / (b.y - a.y), y: r.y1 })],
  ];
  let out = poly;
  for (const [ins, cut] of edges) {
    const src = out; out = [];
    for (let i = 0; i < src.length; i++) {
      const a = src[(i + src.length - 1) % src.length], b = src[i];
      if (ins(b)) { if (!ins(a)) out.push(cut(a, b)); out.push(b); } else if (ins(a)) out.push(cut(a, b));
    }
    if (!out.length) break;
  }
  return out;
}

const polyD = (pts) => `M ${pts.map((p) => `${fmt(p.x)} ${fmt(p.y)}`).join(" L ")} Z`;

// Elipse/círculo como comandos (unidades de figura).
const ell = (cx, cy, rx, ry = rx) => {
  const k = 0.5523;
  return [["M", cx + rx, cy], ["C", cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry], ["C", cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy],
    ["C", cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry], ["C", cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy], ["Z"]];
};
// Gira y traslada comandos (unidades de figura).
const xform = (cmds, ox, oy, rot = 0, sx = 1, sy = sx) => {
  const c = Math.cos(rot), s = Math.sin(rot);
  const P = (x, y) => [ox + (x * sx) * c - (y * sy) * s, oy + (x * sx) * s + (y * sy) * c];
  return cmds.map(([op, ...a]) => {
    const out = [op];
    for (let i = 0; i < a.length; i += 2) out.push(...P(a[i], a[i + 1]));
    return out;
  });
};

/* ============================ Figuras ============================ */
// parts: regiones grandes que se subdividen con strings (spec: ángulo de los
//   strings, nº de cortes en cada familia, forma de la familia B).
// back / front: piezas con un tangle propio (sin subdividir) por detrás o por
//   delante de las partes. deco: detalles de línea (ojos, pico, bigotes...).
// silhouette: piezas que forman el contorno exterior (para las auras).

const OWL_BODY = [["M", 0, 0.95], ["C", 0.45, 0.95, 0.78, 0.62, 0.78, 0.15], ["C", 0.78, -0.25, 0.7, -0.5, 0.66, -0.62], ["L", 0.76, -1.0],
  ["C", 0.5, -0.84, 0.25, -0.76, 0, -0.76], ["C", -0.25, -0.76, -0.5, -0.84, -0.76, -1.0], ["L", -0.66, -0.62],
  ["C", -0.7, -0.5, -0.78, -0.25, -0.78, 0.15], ["C", -0.78, 0.62, -0.45, 0.95, 0, 0.95], ["Z"]];
const OWL_WING = [["M", 0.5, -0.12], ["C", 0.98, 0.06, 0.98, 0.56, 0.56, 0.86], ["C", 0.44, 0.56, 0.4, 0.2, 0.5, -0.12], ["Z"]];

const CAT_BODY = [["M", 0, -0.46], ["C", 0.1, -0.47, 0.16, -0.48, 0.22, -0.52], ["L", 0.38, -0.86], ["L", 0.45, -0.42],
  ["C", 0.55, -0.3, 0.55, -0.12, 0.42, -0.02], ["C", 0.7, 0.18, 0.78, 0.6, 0.66, 0.92], ["C", 0.45, 1.0, -0.45, 1.0, -0.66, 0.92],
  ["C", -0.78, 0.6, -0.7, 0.18, -0.42, -0.02], ["C", -0.55, -0.12, -0.55, -0.3, -0.45, -0.42], ["L", -0.38, -0.86], ["L", -0.22, -0.52],
  ["C", -0.16, -0.48, -0.1, -0.47, 0, -0.46], ["Z"]];
const CAT_TAIL = [["M", 0.5, 0.95], ["C", 0.95, 0.98, 1.08, 0.62, 0.98, 0.32], ["C", 0.94, 0.16, 0.8, 0.14, 0.8, 0.28],
  ["C", 0.86, 0.5, 0.86, 0.74, 0.5, 0.8], ["Z"]];
const CAT_FACE = ell(0, -0.22, 0.4, 0.27);

const FISH_BODY = [["M", 0.78, 0], ["C", 0.62, -0.44, -0.1, -0.52, -0.46, -0.08], ["L", -0.46, 0.08], ["C", -0.1, 0.52, 0.62, 0.44, 0.78, 0], ["Z"]];
const FISH_TAIL = [["M", -0.4, -0.1], ["L", -0.92, -0.5], ["C", -0.78, -0.18, -0.78, 0.18, -0.92, 0.5], ["L", -0.4, 0.1], ["Z"]];
const FISH_DORSAL = [["M", -0.12, -0.36], ["C", -0.05, -0.72, 0.28, -0.74, 0.38, -0.3], ["Z"]];
const FISH_BUBBLES = [ell(0.98, -0.3, 0.06), ell(1.06, -0.48, 0.045), ell(0.97, -0.64, 0.035)];
const FISH_VENTRAL = [["M", 0.0, 0.36], ["C", 0.04, 0.6, 0.22, 0.62, 0.28, 0.32], ["Z"]];

const BF_UP = [["M", 0.05, -0.08], ["C", 0.25, -0.88, 0.98, -0.98, 0.98, -0.46], ["C", 0.98, -0.14, 0.62, 0.02, 0.05, 0.02], ["Z"]];
const BF_LOW = [["M", 0.05, 0.06], ["C", 0.46, 0.04, 0.82, 0.26, 0.72, 0.62], ["C", 0.62, 0.94, 0.26, 0.82, 0.05, 0.22], ["Z"]];
const BF_BODY = ell(0, 0.08, 0.065, 0.5);

const HEART = [["M", 0, 0.92], ["C", -0.15, 0.78, -1, 0.22, -1, -0.35], ["C", -1, -0.8, -0.66, -1, -0.4, -1],
  ["C", -0.2, -1, -0.05, -0.88, 0, -0.68], ["C", 0.05, -0.88, 0.2, -1, 0.4, -1], ["C", 0.66, -1, 1, -0.8, 1, -0.35],
  ["C", 1, 0.22, 0.15, 0.78, 0, 0.92], ["Z"]];

const TURTLE_SHELL = ell(0, 0.06, 0.6, 0.7);
const TURTLE_HEAD = [["M", -0.14, -0.58], ["C", -0.2, -1.0, 0.2, -1.0, 0.14, -0.58], ["Z"]];
const FLIPPER = [["M", 0, 0], ["C", 0.2, -0.12, 0.42, -0.06, 0.48, 0.06], ["C", 0.36, 0.16, 0.16, 0.16, 0, 0.1], ["Z"]];

const PETAL = [["M", 0, -0.16], ["C", 0.24, -0.38, 0.27, -0.8, 0, -1], ["C", -0.27, -0.8, -0.24, -0.38, 0, -0.16], ["Z"]];

// Hoja con punta aguda arriba y base redondeada (el tallo sale de la base).
const LEAF = [["M", 0, 0.82], ["C", 0.25, 0.86, 0.64, 0.62, 0.64, 0.15], ["C", 0.64, -0.35, 0.3, -0.7, 0, -1],
  ["C", -0.3, -0.7, -0.64, -0.35, -0.64, 0.15], ["C", -0.64, 0.62, -0.25, 0.86, 0, 0.82], ["Z"]];

// Ojo zentangle: anillos + corona de pétalos + brillo (todo contorno).
function eyeDeco(u, v, r, petals = 12) {
  const out = [{ cmds: ell(u, v, r), fill: W }];
  const pet = [];
  for (let k = 0; k < petals; k++) {
    const a = (k / petals) * TAU, a1 = a + TAU / petals;
    const p0 = [u + Math.cos(a) * r * 0.7, v + Math.sin(a) * r * 0.7], p1 = [u + Math.cos(a1) * r * 0.7, v + Math.sin(a1) * r * 0.7];
    const am = (a + a1) / 2;
    pet.push(["M", ...p0], ["Q", u + Math.cos(am) * r * 1.02, v + Math.sin(am) * r * 1.02, ...p1]);
  }
  out.push({ cmds: pet, fill: "none" }, { cmds: ell(u, v, r * 0.7), fill: "none" }, { cmds: ell(u, v, r * 0.4), fill: W },
    { cmds: ell(u + r * 0.13, v - r * 0.13, r * 0.12), fill: W });
  return out;
}


/* ---- Figuras añadidas: elefante, caracol, pájaro, ballena, libélula,
   hongo, árbol y luna ---- */

// Arco de circunferencia como cúbicas (tramos de ≤ 90°), sin el "M" inicial.
function arcCmds(cx, cy, r, a0, a1) {
  const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 2)));
  const da = (a1 - a0) / n, k = (4 / 3) * Math.tan(da / 4);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t0 = a0 + i * da, t1 = t0 + da;
    const [x0, y0] = [cx + r * Math.cos(t0), cy + r * Math.sin(t0)], [x1, y1] = [cx + r * Math.cos(t1), cy + r * Math.sin(t1)];
    out.push(["C", x0 - k * r * Math.sin(t0), y0 + k * r * Math.cos(t0), x1 + k * r * Math.sin(t1), y1 - k * r * Math.cos(t1), x1, y1]);
  }
  return out;
}
// Estrella de cinco puntas (contorno).
const starCmds = (cx, cy, ro, ri = ro * 0.45, rot = 0) => {
  const out = [];
  for (let k = 0; k < 10; k++) {
    const a = rot - Math.PI / 2 + (k * Math.PI) / 5, rad = k % 2 ? ri : ro;
    out.push([k ? "L" : "M", cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return [...out, ["Z"]];
};

// Elefante de perfil (mira a la derecha): cuerpo, cabeza, trompa y patas en
// un solo contorno; la oreja va delante con su propio tangle.
const ELE_BODY = [["M", -0.55, -0.45], ["C", -0.2, -0.75, 0.35, -0.72, 0.52, -0.48], ["C", 0.74, -0.36, 0.8, -0.06, 0.82, 0.2],
  ["C", 0.84, 0.48, 0.92, 0.64, 1.04, 0.62], ["C", 1.08, 0.7, 1.02, 0.8, 0.92, 0.79], ["C", 0.74, 0.74, 0.68, 0.52, 0.66, 0.32],
  ["C", 0.62, 0.28, 0.56, 0.3, 0.5, 0.34], ["L", 0.5, 0.9], ["L", 0.25, 0.9], ["L", 0.25, 0.5],
  ["C", 0.06, 0.56, -0.12, 0.55, -0.3, 0.48], ["L", -0.3, 0.9], ["L", -0.58, 0.9], ["L", -0.6, 0.42],
  ["C", -0.82, 0.2, -0.82, -0.24, -0.55, -0.45], ["Z"]];
const ELE_EAR = [["M", 0.26, -0.46], ["C", 0.0, -0.56, -0.18, -0.26, -0.12, 0.02], ["C", -0.06, 0.24, 0.16, 0.32, 0.34, 0.22],
  ["C", 0.44, 0.04, 0.44, -0.3, 0.26, -0.46], ["Z"]];

// Caracol: concha de círculos tangentes que giran (se lee como espiral) y pie.
const SNAIL_SHELL = [[-0.22, -0.12, 0.62]];
{
  let [x, y, r] = SNAIL_SHELL[0], a = 0.6;
  for (const k of [0.68, 0.64, 0.56]) { const r2 = r * k; x += Math.cos(a) * (r - r2); y += Math.sin(a) * (r - r2); r = r2; SNAIL_SHELL.push([x, y, r]); a += Math.PI / 2; }
}
const SNAIL_BODY = [["M", -0.88, 0.56], ["C", -0.6, 0.46, 0.3, 0.5, 0.52, 0.3], ["C", 0.6, 0.02, 0.7, -0.18, 0.84, -0.2],
  ["C", 0.98, -0.2, 1.02, -0.02, 0.96, 0.14], ["C", 0.9, 0.36, 0.86, 0.62, 0.6, 0.68], ["L", -0.72, 0.7],
  ["C", -0.86, 0.7, -0.96, 0.62, -0.88, 0.56], ["Z"]];

// Pájaro cantor posado (mira a la derecha).
const BIRD_BODY = [["M", 0.55, -0.55], ["C", 0.78, -0.55, 0.92, -0.4, 0.9, -0.22], ["C", 0.88, -0.05, 0.76, 0.08, 0.72, 0.18],
  ["C", 0.68, 0.52, 0.4, 0.8, 0, 0.8], ["C", -0.35, 0.8, -0.62, 0.6, -0.66, 0.35], ["C", -0.6, 0, -0.2, -0.28, 0.2, -0.32],
  ["C", 0.32, -0.48, 0.42, -0.55, 0.55, -0.55], ["Z"]];
const BIRD_TAIL = [["M", -0.55, 0.3], ["L", -1.06, 0.6], ["C", -1.1, 0.72, -1.02, 0.82, -0.92, 0.8], ["L", -0.42, 0.62], ["Z"]];
const BIRD_WING = [["M", 0.26, -0.1], ["C", -0.05, -0.16, -0.46, 0.04, -0.64, 0.42], ["C", -0.3, 0.56, 0.1, 0.46, 0.3, 0.2],
  ["C", 0.38, 0.08, 0.37, -0.05, 0.26, -0.1], ["Z"]];
const BIRD_BEAK = [["M", 0.88, -0.33], ["L", 1.08, -0.23], ["L", 0.87, -0.13], ["Z"]];

// Ballena (mira a la derecha) con aleta caudal levantada y chorro.
const WHALE_BODY = [["M", 0.95, 0.05], ["C", 0.95, -0.36, 0.55, -0.5, 0, -0.45], ["C", -0.4, -0.42, -0.62, -0.26, -0.74, -0.08],
  ["C", -0.8, 0.02, -0.78, 0.1, -0.7, 0.13], ["C", -0.48, 0.32, -0.1, 0.42, 0.35, 0.38], ["C", 0.7, 0.35, 0.95, 0.3, 0.95, 0.05], ["Z"]];
const WHALE_FLUKE = [["M", -0.7, 0.02], ["C", -0.84, -0.16, -0.98, -0.4, -1.08, -0.58], ["C", -0.96, -0.56, -0.88, -0.48, -0.83, -0.4],
  ["C", -0.8, -0.56, -0.7, -0.68, -0.54, -0.74], ["C", -0.6, -0.5, -0.6, -0.24, -0.62, 0.04], ["Z"]];
const WHALE_FIN = [["M", 0.3, 0.22], ["C", 0.2, 0.42, 0, 0.56, -0.2, 0.56], ["C", -0.08, 0.42, 0.04, 0.3, 0.12, 0.2], ["Z"]];
// Chorro: salpicadura cerrada en forma de Y (sin tangle detrás).
const WHALE_SPOUT = [["M", 0.52, -0.46], ["C", 0.5, -0.6, 0.42, -0.72, 0.26, -0.78], ["C", 0.36, -0.88, 0.5, -0.82, 0.56, -0.7],
  ["C", 0.62, -0.82, 0.76, -0.88, 0.86, -0.78], ["C", 0.7, -0.72, 0.62, -0.6, 0.6, -0.46], ["Z"]];

// Libélula (simétrica): dos alas largas por lado.
// Alas estrechadas (×0.78 en x): así la figura llena la página en alto.
const DF_UP = xform([["M", 0.06, -0.42], ["C", 0.3, -0.7, 0.9, -0.8, 1.02, -0.56], ["C", 1.08, -0.38, 0.62, -0.28, 0.06, -0.32], ["Z"]], 0, 0, 0, 0.78, 1);
const DF_LOW = xform([["M", 0.06, -0.26], ["C", 0.42, -0.22, 0.98, -0.18, 0.98, 0.04], ["C", 0.94, 0.2, 0.46, 0.06, 0.06, -0.17], ["Z"]], 0, 0, 0, 0.78, 1);
const DF_TAIL = [["M", 0, -0.22], ["C", 0.07, -0.1, 0.06, 0.6, 0, 0.98], ["C", -0.06, 0.6, -0.07, -0.1, 0, -0.22], ["Z"]];

// Hongo: sombrero con manchas lisas, pie y un hongo pequeño al lado.
const MUSH_CAP = [["M", -1, 0], ["C", -1, -0.75, -0.5, -0.95, 0, -0.95], ["C", 0.5, -0.95, 1, -0.75, 1, 0], ["C", 0.6, 0.12, -0.6, 0.12, -1, 0], ["Z"]];
const MUSH_STEM = [["M", -0.3, 0.06], ["C", -0.35, 0.4, -0.38, 0.7, -0.42, 0.9], ["C", -0.15, 0.98, 0.15, 0.98, 0.42, 0.9],
  ["C", 0.38, 0.7, 0.35, 0.4, 0.3, 0.06], ["Z"]];
const MUSH_SMALL = [["M", 0.56, 0.52], ["C", 0.56, 0.24, 0.98, 0.24, 0.98, 0.52], ["C", 0.86, 0.56, 0.68, 0.56, 0.56, 0.52], ["Z"]];
const MUSH_SMALL_STEM = [["M", 0.69, 0.53], ["L", 0.67, 0.92], ["L", 0.87, 0.92], ["L", 0.85, 0.53], ["Z"]];

// Árbol: copa ondulada (8 lóbulos) y tronco con corteza en V.
const TREE_CROWN = (() => {
  const cx = 0, cy = -0.28, n = 8, out = [];
  const P = (a, r) => [cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 0.9];
  for (let k = 0; k <= n; k++) {
    const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
    if (!k) { out.push(["M", ...P(a, 0.66)]); continue; }
    out.push(["Q", ...P(a - Math.PI / n, 0.95), ...P(a, 0.66)]);
  }
  return [...out, ["Z"]];
})();
const TREE_TRUNK = [["M", -0.13, 0.22], ["C", -0.13, 0.55, -0.2, 0.8, -0.36, 0.95], ["L", 0.36, 0.95], ["C", 0.2, 0.8, 0.13, 0.55, 0.13, 0.22], ["Z"]];

// Luna creciente y estrellas.
const MOON = (() => {
  const R = 0.9, cx2 = 0.4, cy2 = -0.2, r2 = 0.74;
  // Intersecciones de las dos circunferencias.
  const d = Math.hypot(cx2, cy2), a = (R * R - r2 * r2 + d * d) / (2 * d), h = Math.sqrt(R * R - a * a);
  const ux = cx2 / d, uy = cy2 / d, mx = ux * a, my = uy * a;
  const p1 = [mx - uy * h, my + ux * h], p2 = [mx + uy * h, my - ux * h];
  let o0 = Math.atan2(p1[1], p1[0]), o1 = Math.atan2(p2[1], p2[0]);
  while (o1 <= o0) o1 += Math.PI * 2; // arco exterior largo, por la izquierda
  let i0 = Math.atan2(p2[1] - cy2, p2[0] - cx2), i1 = Math.atan2(p1[1] - cy2, p1[0] - cx2);
  while (i1 >= i0) i1 -= Math.PI * 2; // arco interior, de vuelta
  return [["M", ...p1], ...arcCmds(0, 0, R, o0, o1), ...arcCmds(cx2, cy2, r2, i0, i1), ["Z"]];
})();
const MOON_STARS = [starCmds(0.62, 0.22, 0.2, 0.09, 0.1), starCmds(0.66, -0.6, 0.12, 0.055, -0.2), starCmds(1.02, -0.12, 0.1, 0.045, 0.3)];

// Animales tiernos de frente: oso, conejo, pingüino y zorro (formas
// redondas y grandes, cómodas también en facetado y vitral).
const BEAR_HEAD = ell(0, -0.45, 0.42, 0.38);
const BEAR_BODY = ell(0, 0.36, 0.6, 0.56);
const BEAR_EARS = [ell(0.32, -0.78, 0.15), ell(-0.32, -0.78, 0.15)];
const BEAR_ARMS = [xform(ell(0, 0, 0.13, 0.28), 0.52, 0.16, -0.5), xform(ell(0, 0, 0.13, 0.28), -0.52, 0.16, 0.5)];
const BEAR_FEET = [ell(0.3, 0.88, 0.2, 0.12), ell(-0.3, 0.88, 0.2, 0.12)];

const RAB_HEAD = ell(0, -0.12, 0.38, 0.34);
const RAB_BODY = ell(0, 0.52, 0.5, 0.44);
const RAB_EARS = [xform(ell(0, 0, 0.12, 0.4), 0.18, -0.74, 0.14), xform(ell(0, 0, 0.12, 0.4), -0.18, -0.74, -0.14)];
const RAB_FEET = [ell(0.26, 0.94, 0.2, 0.09), ell(-0.26, 0.94, 0.2, 0.09)];

const PENG_BODY = [["M", 0, -0.95], ["C", 0.4, -0.95, 0.56, -0.5, 0.58, 0], ["C", 0.6, 0.5, 0.42, 0.88, 0, 0.88], ["C", -0.42, 0.88, -0.6, 0.5, -0.58, 0],
  ["C", -0.56, -0.5, -0.4, -0.95, 0, -0.95], ["Z"]];
const PENG_BELLY = [["M", 0, -0.62], ["C", 0.18, -0.62, 0.22, -0.48, 0.3, -0.4], ["C", 0.44, -0.2, 0.44, 0.5, 0.3, 0.7], ["C", 0.18, 0.82, -0.18, 0.82, -0.3, 0.7],
  ["C", -0.44, 0.5, -0.44, -0.2, -0.3, -0.4], ["C", -0.22, -0.48, -0.18, -0.62, 0, -0.62], ["Z"]];
const PENG_WINGS = [[["M", 0.52, -0.25], ["C", 0.8, -0.05, 0.86, 0.3, 0.8, 0.5], ["C", 0.7, 0.4, 0.6, 0.2, 0.56, 0.1], ["Z"]],
  [["M", -0.52, -0.25], ["C", -0.8, -0.05, -0.86, 0.3, -0.8, 0.5], ["C", -0.7, 0.4, -0.6, 0.2, -0.56, 0.1], ["Z"]]];
const PENG_FEET = [ell(0.2, 0.9, 0.16, 0.07), ell(-0.2, 0.9, 0.16, 0.07)];

const FOX_HEAD = [["M", -0.6, -0.86], ["L", -0.3, -0.5], ["C", -0.15, -0.56, 0.15, -0.56, 0.3, -0.5], ["L", 0.6, -0.86], ["L", 0.56, -0.36],
  ["C", 0.52, -0.16, 0.2, 0.0, 0, 0.08], ["C", -0.2, 0.0, -0.52, -0.16, -0.56, -0.36], ["Z"]];
const FOX_BODY = [["M", -0.26, -0.08], ["C", -0.56, 0.2, -0.52, 0.74, -0.42, 0.92], ["L", 0.42, 0.92], ["C", 0.52, 0.74, 0.56, 0.2, 0.26, -0.08], ["Z"]];
const FOX_TAIL = [["M", 0.36, 0.9], ["C", 0.9, 0.96, 1.06, 0.48, 0.9, 0.16], ["C", 0.8, -0.02, 0.62, 0.04, 0.68, 0.26], ["C", 0.78, 0.52, 0.62, 0.74, 0.4, 0.76], ["Z"]];
const FOX_BIB = [["M", -0.22, 0.06], ["C", -0.1, 0.3, 0.1, 0.3, 0.22, 0.06], ["C", 0.12, 0.5, 0.08, 0.66, 0, 0.72], ["C", -0.08, 0.66, -0.12, 0.5, -0.22, 0.06], ["Z"]];

/* ---- Figuras para adultos (sin caritas) y composiciones abstractas ---- */

// Polígono suave a partir de puntos (comandos L; el muestreo es fino).
const polyCmds = (pts) => [["M", ...pts[0]], ...pts.slice(1).map((p) => ["L", ...p]), ["Z"]];

// Koi en S: cuerpo, cola en abanico y aletas largas.
const KOI_RAW = [["M", 0.42, -0.92], ["C", 0.64, -0.88, 0.68, -0.6, 0.56, -0.34], ["C", 0.44, -0.06, 0.14, 0.12, 0.06, 0.36],
  ["C", 0.03, 0.46, 0.0, 0.53, -0.02, 0.58], ["L", -0.15, 0.56], ["C", -0.2, 0.3, -0.12, 0.0, 0.08, -0.25], ["C", 0.2, -0.42, 0.22, -0.72, 0.42, -0.92], ["Z"]];
// Cuerpo más lleno: ensanchado ×1.45 alrededor de su eje.
const KOI_BODY = xform(xform(KOI_RAW, -0.25, 0, 0), 0.25, 0, 0, 1.45, 1);
const KOI_TAIL = [["M", -0.02, 0.55], ["C", 0.26, 0.6, 0.48, 0.8, 0.44, 1.0], ["C", 0.26, 0.9, 0.1, 0.86, -0.08, 0.9], ["C", -0.26, 0.95, -0.44, 0.98, -0.58, 0.9],
  ["C", -0.46, 0.74, -0.3, 0.6, -0.15, 0.54], ["Z"]];
const KOI_FIN_R = [["M", 0.52, -0.38], ["C", 0.78, -0.34, 0.94, -0.12, 0.88, 0.04], ["C", 0.72, -0.08, 0.62, -0.18, 0.46, -0.24], ["Z"]];
const KOI_FIN_L = [["M", 0.14, -0.32], ["C", -0.14, -0.34, -0.36, -0.16, -0.36, 0.02], ["C", -0.2, -0.05, -0.04, -0.12, 0.08, -0.16], ["Z"]];

// Colibrí en vuelo (mira a la izquierda): ala alzada con plumas en V.
const HUM_BODY = [["M", -0.56, -0.45], ["C", -0.56, -0.62, -0.3, -0.67, -0.22, -0.5], ["C", -0.12, -0.36, 0.1, -0.28, 0.26, -0.1],
  ["C", 0.39, 0.05, 0.46, 0.22, 0.43, 0.38], ["L", 0.3, 0.42], ["C", 0.18, 0.25, 0, 0.12, -0.18, 0], ["C", -0.4, -0.12, -0.56, -0.28, -0.56, -0.45], ["Z"]];
const HUM_WING = [["M", -0.12, -0.36], ["C", -0.02, -0.82, 0.4, -1.02, 0.88, -0.96], ["C", 0.72, -0.74, 0.46, -0.48, 0.16, -0.22], ["Z"]];
const HUM_WING2 = [["M", 0.02, -0.28], ["C", 0.22, -0.6, 0.62, -0.72, 0.98, -0.56], ["C", 0.78, -0.4, 0.48, -0.24, 0.22, -0.13], ["Z"]];
const HUM_TAIL = [["M", 0.32, 0.36], ["L", 0.52, 0.88], ["L", 0.47, 0.56], ["L", 0.76, 0.82], ["L", 0.46, 0.34], ["Z"]];
const HUM_BEAK = [["M", -0.53, -0.48], ["L", -1.06, -0.62], ["L", -0.55, -0.4], ["Z"]];

// Pluma grande: vano con barbas en V y un corte; cañón abajo.
const FEATHER = [["M", 0, -1], ["C", 0.3, -0.8, 0.38, -0.2, 0.26, 0.4], ["C", 0.2, 0.62, 0.09, 0.75, 0.03, 0.8], ["L", -0.03, 0.8],
  ["C", -0.14, 0.7, -0.27, 0.5, -0.31, 0.22], ["L", -0.2, 0.12], ["L", -0.34, 0.02], ["C", -0.38, -0.36, -0.26, -0.8, 0, -1], ["Z"]];
const FEATHER_QUILL = [["M", -0.025, 0.78], ["L", 0.025, 0.78], ["L", 0.012, 1.08], ["L", -0.012, 1.08], ["Z"]];

// Nautilus: espiral logarítmica (crece ×3 por vuelta) dividida en cámaras
// con tabiques curvos. Vuelta exterior: 9 cámaras; interior: 7.
const NAUT = (() => {
  const b = Math.log(3) / (2 * Math.PI), r = (t) => Math.exp(b * t);
  const P = (t, rad) => [Math.cos(t) * rad, Math.sin(t) * rad];
  const sept = (t0, steps = 8) => Array.from({ length: steps + 1 }, (_, i) => { const f = i / steps, t = t0 + 0.3 * f; return P(t, r(t - 2 * Math.PI) + f * (r(t) - r(t - 2 * Math.PI))); });
  const chamber = (ta, tb) => {
    const outer = [], inner = [];
    for (let i = 0; i <= 10; i++) { const t = ta + 0.3 + ((tb - ta) * i) / 10; outer.push(P(t, r(t))); }
    for (let i = 0; i <= 10; i++) { const t = tb - ((tb - ta) * i) / 10; inner.push(P(t, r(t - 2 * Math.PI))); }
    return polyCmds([...outer, ...sept(tb).reverse().slice(1), ...inner.slice(1), ...sept(ta).slice(1)]);
  };
  const cut = (t0, t1, n) => Array.from({ length: n }, (_, k) => chamber(t0 + ((t1 - t0) * k) / n, t0 + ((t1 - t0) * (k + 1)) / n));
  const outerCh = cut(-2 * Math.PI - 0.3, -0.3, 9), innerCh = cut(-4 * Math.PI - 0.3, -2 * Math.PI - 0.3, 7);
  const shell = [];
  for (let i = 0; i <= 120; i++) { const t = -2 * Math.PI + (2 * Math.PI * i) / 120; shell.push(P(t, r(t))); }
  return { outerCh, innerCh, shell: polyCmds(shell), core: ell(0, 0, r(-4 * Math.PI) * 1.1) };
})();

// Polilla luna (simétrica): alas falcadas y colas largas.
const MOTH_UP = [["M", 0.05, -0.15], ["C", 0.3, -0.7, 0.86, -0.78, 0.92, -0.42], ["C", 0.94, -0.2, 0.6, -0.04, 0.05, 0.0], ["Z"]];
const MOTH_LOW = [["M", 0.05, 0.05], ["C", 0.46, 0.0, 0.66, 0.2, 0.56, 0.46], ["C", 0.49, 0.62, 0.43, 0.8, 0.4, 1.0], ["C", 0.31, 0.85, 0.22, 0.65, 0.05, 0.36], ["Z"]];
const MOTH_BODY = ell(0, 0.1, 0.07, 0.4);

// Mano hamsa (simétrica; mitad derecha con medio dedo central).
const HAMSA = [["M", 0, -0.96], ["C", 0.08, -0.98, 0.13, -0.93, 0.13, -0.8], ["L", 0.13, -0.3], ["L", 0.18, -0.3], ["L", 0.18, -0.74],
  ["C", 0.18, -0.88, 0.37, -0.88, 0.37, -0.74], ["L", 0.37, -0.28], ["L", 0.41, -0.28], ["C", 0.48, -0.4, 0.55, -0.5, 0.62, -0.56],
  ["C", 0.73, -0.62, 0.8, -0.5, 0.73, -0.4], ["C", 0.63, -0.25, 0.56, -0.05, 0.56, 0.15], ["C", 0.56, 0.55, 0.3, 0.86, 0, 0.9], ["Z"]];

// Ánfora (simétrica) con asas.
const VASE = [["M", 0, -0.95], ["L", 0.24, -0.95], ["C", 0.21, -0.86, 0.15, -0.8, 0.15, -0.68], ["C", 0.15, -0.5, 0.6, -0.4, 0.62, 0.05],
  ["C", 0.64, 0.45, 0.36, 0.7, 0.2, 0.78], ["L", 0.25, 0.94], ["L", 0, 0.94], ["Z"]];
const VASE_HANDLE = [["M", 0.15, -0.62], ["C", 0.46, -0.78, 0.66, -0.56, 0.52, -0.3], ["L", 0.43, -0.35], ["C", 0.53, -0.53, 0.42, -0.64, 0.17, -0.52], ["Z"]];

// Cintas: tres bandas en S que se cruzan (abstracto).
const RIBBONS = (() => {
  const band = (p0, c1, c2, p1, w0, w1) => {
    const B = (t) => { const m = 1 - t; return [m * m * m * p0[0] + 3 * m * m * t * c1[0] + 3 * m * t * t * c2[0] + t * t * t * p1[0], m * m * m * p0[1] + 3 * m * m * t * c1[1] + 3 * m * t * t * c2[1] + t * t * t * p1[1]]; };
    const L = [], R = [];
    for (let i = 0; i <= 40; i++) {
      const t = i / 40, [x, y] = B(t), [x2, y2] = B(Math.min(1, t + 0.01)), [x1, y1] = B(Math.max(0, t - 0.01));
      const dx = x2 - x1, dy = y2 - y1, d = Math.hypot(dx, dy) || 1, w = (w0 + (w1 - w0) * t) * Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.88)) + 0.03;
      L.push([x - (dy / d) * w, y + (dx / d) * w]); R.push([x + (dy / d) * w, y - (dx / d) * w]);
    }
    return polyCmds([...L, ...R.reverse()]);
  };
  return [band([-0.95, -0.7], [0.2, -1.1], [-0.4, 0.6], [0.9, 0.85], 0.2, 0.26),
    band([-0.9, 0.75], [-0.2, 0.2], [0.5, -0.1], [0.75, -0.95], 0.24, 0.16),
    band([-0.7, -0.05], [-0.2, -0.5], [0.4, 0.5], [0.95, 0.05], 0.15, 0.2)];
})();

// Gotas y orbes (abstracto, piezas que se solapan).
const DROP = [["M", 0, -1], ["C", 0.15, -0.55, 0.78, -0.05, 0.78, 0.42], ["C", 0.78, 0.8, 0.42, 1, 0, 1], ["C", -0.42, 1, -0.78, 0.8, -0.78, 0.42], ["C", -0.78, -0.05, -0.15, -0.55, 0, -1], ["Z"]];
const DROPS = [xform(DROP, -0.2, 0.15, -0.35, 0.62), xform(DROP, 0.5, -0.45, 0.5, 0.34), xform(DROP, 0.45, 0.62, 0.15, 0.26)];
const ORBS = [ell(-0.3, -0.35, 0.55), ell(0.45, 0.15, 0.42), ell(-0.15, 0.55, 0.36), ell(0.52, -0.62, 0.22), ell(-0.72, 0.28, 0.18)];

// Cristales: tres gemas alargadas de distinta altura.
const GEM = [["M", 0, -1], ["L", 0.42, -0.6], ["L", 0.48, 0.45], ["L", 0, 1], ["L", -0.48, 0.45], ["L", -0.42, -0.6], ["Z"]];
const GEM_TABLE = [["M", 0, -0.6], ["L", 0.2, -0.25], ["L", 0, 0.55], ["L", -0.2, -0.25], ["Z"]];
const GEMS = [[0, 0, 0, 0.6], [-0.55, 0.3, -0.35, 0.42], [0.58, 0.35, 0.3, 0.38]];

/* ---- Ciencia: biología ---- */

// Rama ahusada a lo largo de una polilínea (ancho w0 → w1), como polígono.
function taper(pts, w0, w1) {
  const L = [], R = [];
  pts.forEach(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)], [bx, by] = pts[Math.min(pts.length - 1, i + 1)];
    const dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy) || 1, w = w0 + (w1 - w0) * (i / (pts.length - 1));
    L.push([x - (dy / d) * w, y + (dx / d) * w]); R.push([x + (dy / d) * w, y - (dx / d) * w]);
  });
  return polyCmds([...L, ...R.reverse()]);
}
// Curva cuadrática muestreada (para ramas suaves).
const qpts = (p0, c, p1, n = 10) => Array.from({ length: n + 1 }, (_, i) => { const t = i / n, m = 1 - t; return [m * m * p0[0] + 2 * m * t * c[0] + t * t * p1[0], m * m * p0[1] + 2 * m * t * c[1] + t * t * p1[1]]; });

// Neurona: soma con núcleo, dendritas ramificadas, axón con vainas de
// mielina y terminales con botones sinápticos.
const NEURON = (() => {
  const soma = [["M", -0.38, 0], ["C", -0.38, -0.2, -0.52, -0.3, -0.62, -0.26], ["C", -0.78, -0.24, -0.86, -0.1, -0.82, 0.04],
    ["C", -0.8, 0.2, -0.66, 0.3, -0.52, 0.26], ["C", -0.42, 0.22, -0.38, 0.12, -0.38, 0], ["Z"]];
  const dends = [
    taper(qpts([-0.7, -0.2], [-0.8, -0.5], [-0.98, -0.72]), 0.05, 0.012), taper(qpts([-0.86, -0.62], [-0.82, -0.8], [-0.72, -0.95]), 0.022, 0.01),
    taper(qpts([-0.55, -0.25], [-0.45, -0.55], [-0.5, -0.88]), 0.045, 0.012), taper(qpts([-0.47, -0.6], [-0.3, -0.7], [-0.24, -0.86]), 0.022, 0.01),
    taper(qpts([-0.8, 0.02], [-0.95, 0.02], [-1.06, -0.2]), 0.045, 0.012),
    taper(qpts([-0.75, 0.2], [-0.9, 0.5], [-1.0, 0.7]), 0.05, 0.012), taper(qpts([-0.9, 0.48], [-0.78, 0.66], [-0.8, 0.86]), 0.022, 0.01),
    taper(qpts([-0.55, 0.25], [-0.5, 0.55], [-0.6, 0.9]), 0.045, 0.012),
  ];
  const axonPts = qpts([-0.4, 0.02], [0.15, -0.2], [0.72, 0.1], 24);
  const axon = taper(axonPts, 0.035, 0.03);
  const sheaths = [5, 9, 13, 17].map((i) => {
    const [x, y] = axonPts[i], [x2, y2] = axonPts[i + 2], ang = Math.atan2(y2 - y, x2 - x);
    return xform(ell(0, 0, 0.12, 0.065), (x + x2) / 2, (y + y2) / 2, ang);
  });
  const terms = [taper(qpts([0.7, 0.1], [0.85, -0.05], [0.95, -0.3]), 0.025, 0.012), taper(qpts([0.7, 0.1], [0.9, 0.12], [1.02, 0.02]), 0.025, 0.012),
    taper(qpts([0.7, 0.1], [0.82, 0.3], [0.9, 0.45]), 0.025, 0.012)];
  const buttons = [ell(0.95, -0.33, 0.05), ell(1.04, 0.0, 0.05), ell(0.9, 0.49, 0.05)];
  return { soma, dends, axon, sheaths, terms, buttons };
})();

// Cerebro (vista lateral, mira a la izquierda): hemisferio con circunvoluciones
// (strings), lóbulo temporal, cerebelo y tronco.
const BRAIN = [["M", -0.92, 0.05], ["C", -1.0, -0.42, -0.68, -0.82, -0.18, -0.86], ["C", 0.32, -0.9, 0.86, -0.62, 0.94, -0.12], ["C", 0.98, 0.18, 0.86, 0.36, 0.62, 0.38],
  ["C", 0.42, 0.4, 0.3, 0.3, 0.1, 0.36], ["C", -0.2, 0.46, -0.5, 0.42, -0.7, 0.32], ["C", -0.86, 0.24, -0.9, 0.15, -0.92, 0.05], ["Z"]];
const BRAIN_TEMPORAL = [["M", -0.6, 0.18], ["C", -0.4, 0.06, 0.05, 0.06, 0.28, 0.18], ["C", 0.36, 0.3, 0.3, 0.42, 0.1, 0.46], ["C", -0.2, 0.52, -0.5, 0.46, -0.62, 0.34], ["C", -0.7, 0.28, -0.68, 0.22, -0.6, 0.18], ["Z"]];
const CEREBELLUM = [["M", 0.35, 0.42], ["C", 0.5, 0.3, 0.9, 0.32, 0.92, 0.52], ["C", 0.92, 0.7, 0.6, 0.76, 0.42, 0.66], ["C", 0.3, 0.6, 0.28, 0.5, 0.35, 0.42], ["Z"]];
const BRAINSTEM = [["M", 0.16, 0.4], ["L", 0.36, 0.42], ["C", 0.36, 0.6, 0.32, 0.8, 0.3, 0.98], ["L", 0.14, 0.98], ["C", 0.16, 0.8, 0.16, 0.6, 0.16, 0.4], ["Z"]];

// Doble hélice de ADN: dos hebras que se cruzan y peldaños (pares de bases).
const DNA = (() => {
  const strand = (ph) => {
    const pts = Array.from({ length: 61 }, (_, i) => { const y = -1 + (2 * i) / 60; return [0.38 * Math.sin(Math.PI * 1.25 * y + ph), y]; });
    return taper(pts, 0.075, 0.075);
  };
  const rungs = [];
  for (let k = 0; k < 14; k++) {
    const y = -0.93 + k * 0.143, xa = 0.38 * Math.sin(Math.PI * 1.25 * y), xb = -xa;
    if (Math.abs(xa - xb) < 0.24) continue;
    const x0 = Math.min(xa, xb) + 0.05, x1 = Math.max(xa, xb) - 0.05;
    rungs.push([["M", x0, y - 0.03], ["L", x1, y - 0.03], ["L", x1, y + 0.03], ["L", x0, y + 0.03], ["Z"]]);
  }
  return { a: strand(0), b: strand(Math.PI), rungs };
})();

// Célula vegetal: pared poligonal, citoplasma, vacuola, núcleo, cloroplastos.
const PCELL_WALL = [["M", -0.5, -0.95], ["L", 0.52, -0.92], ["L", 0.95, -0.2], ["L", 0.9, 0.62], ["L", 0.42, 0.98], ["L", -0.55, 0.95], ["L", -0.95, 0.3], ["L", -0.9, -0.5], ["Z"]];
const PCELL_IN = xform(PCELL_WALL, 0, 0, 0, 0.88);
const PCELL_VAC = [["M", -0.1, -0.35], ["C", 0.3, -0.5, 0.65, -0.3, 0.62, 0.1], ["C", 0.6, 0.5, 0.25, 0.7, -0.05, 0.55], ["C", -0.35, 0.4, -0.4, -0.2, -0.1, -0.35], ["Z"]];
const PCELL_NUC = ell(-0.48, -0.42, 0.2);
const PCELL_CHL = [[-0.62, 0.18, 0.4], [-0.45, 0.6, -0.3], [0.1, 0.78, 0.1], [0.66, 0.5, 1.1], [0.7, -0.45, 0.8], [0.15, -0.68, 0.0]].map(([x, y, r]) => xform(ell(0, 0, 0.14, 0.075), x, y, r));

// Célula animal: membrana, núcleo con nucléolo, mitocondrias, Golgi, vesículas.
const ACELL = [["M", 0, -0.92], ["C", 0.55, -0.95, 0.95, -0.55, 0.92, -0.02], ["C", 0.9, 0.5, 0.52, 0.92, 0, 0.9], ["C", -0.55, 0.88, -0.95, 0.5, -0.92, 0], ["C", -0.9, -0.55, -0.5, -0.9, 0, -0.92], ["Z"]];
const ACELL_IN = xform(ACELL, 0, 0, 0, 0.9);
const ACELL_NUC = ell(-0.08, -0.05, 0.32, 0.28);
const ACELL_MITO = [[0.5, -0.45, 0.6], [-0.55, 0.4, -0.4], [0.45, 0.5, 2.4]].map(([x, y, r]) => xform(ell(0, 0, 0.17, 0.08), x, y, r));
const ACELL_GOLGI = [0.0, 0.07, 0.14].map((d) => taper(qpts([-0.62, -0.42 + d], [-0.45, -0.62 + d], [-0.22, -0.6 + d]), 0.025, 0.025));
const ACELL_VES = [ell(-0.2, 0.62, 0.05), ell(0.12, 0.68, 0.045), ell(0.62, 0.05, 0.05)];

// Mitocondria: membrana externa y crestas (membrana interna plegada).
const MITO = [["M", -0.95, 0], ["C", -0.95, -0.42, -0.6, -0.5, 0, -0.5], ["C", 0.6, -0.5, 0.95, -0.42, 0.95, 0], ["C", 0.95, 0.42, 0.6, 0.5, 0, 0.5], ["C", -0.6, 0.5, -0.95, 0.42, -0.95, 0], ["Z"]];
const CRISTAE = (() => {
  const top = [], bot = [];
  const n = 6;
  for (let k = 0; k <= 40; k++) {
    const x = -0.82 + (1.64 * k) / 40, f = (k / 40) * n * 2 * Math.PI;
    const base = 0.36 * Math.sqrt(Math.max(0, 1 - (x / 0.86) ** 2));
    top.push([x, -base + (Math.sin(f) > 0.3 ? 0.24 : 0)]);
    bot.push([x, base - (Math.sin(f + Math.PI) > 0.3 ? 0.24 : 0)]);
  }
  return polyCmds([...top, ...bot.reverse()]);
})();

// Virus: cápside icosaédrica (hexágono con caras), espículas y cola.
const VIRUS_HEAD = [["M", 0, -0.72], ["L", 0.5, -0.45], ["L", 0.5, 0.1], ["L", 0, 0.37], ["L", -0.5, 0.1], ["L", -0.5, -0.45], ["Z"]];
const VIRUS_TAIL = [["M", -0.08, 0.37], ["L", 0.08, 0.37], ["L", 0.08, 0.72], ["L", -0.08, 0.72], ["Z"]];
const VIRUS_LEGS = [-1, 1].flatMap((m) => [taper([[0.06 * m, 0.72], [0.4 * m, 0.82], [0.55 * m, 1.0]], 0.025, 0.02), taper([[0.04 * m, 0.72], [0.2 * m, 0.86], [0.25 * m, 1.02]], 0.025, 0.02)]);
const VIRUS_FACES = [[["M", 0, -0.72], ["L", 0, -0.18], ["L", 0.5, -0.45], ["Z"]], [["M", 0, -0.18], ["L", 0.5, 0.1], ["L", 0, 0.37], ["Z"]], [["M", 0, -0.18], ["L", -0.5, -0.45], ["L", -0.5, 0.1], ["Z"]]];

// Cromosoma: dos cromátidas en X con bandas y centrómero.
const CHROMATID = [["M", -0.12, -0.05], ["C", -0.3, -0.4, -0.55, -0.75, -0.62, -0.88], ["C", -0.66, -0.98, -0.5, -1.02, -0.42, -0.94], ["C", -0.3, -0.75, -0.08, -0.4, 0.02, -0.1],
  ["C", 0.12, 0.25, 0.32, 0.7, 0.42, 0.9], ["C", 0.46, 1.0, 0.32, 1.04, 0.26, 0.96], ["C", 0.14, 0.75, -0.02, 0.35, -0.12, -0.05], ["Z"]];
const CHROMO = [xform(CHROMATID, 0, 0, 0, 1.25, 1), xform(CHROMATID, 0, 0, 0, -1.25, 1)];

/* ---- Ciencia: dinosaurios (de perfil, miran a la derecha) ---- */

// Terópodo bípedo: cuerpo común y cabeza intercambiable.
const theropod = (head) => [["M", -1.0, 0.05], ["C", -0.7, -0.05, -0.4, -0.25, -0.1, -0.3], ["C", 0.15, -0.35, 0.3, -0.45, 0.42, -0.6], ...head,
  ["C", 0.48, -0.1, 0.36, 0.08, 0.24, 0.16], ["L", 0.26, 0.55], ["L", 0.34, 0.9], ["L", 0.1, 0.9], ["L", 0.08, 0.55],
  ["C", 0.0, 0.35, -0.12, 0.25, -0.22, 0.2], ["C", -0.45, 0.15, -0.7, 0.12, -1.0, 0.05], ["Z"]];
const TREX = theropod([["C", 0.5, -0.72, 0.62, -0.78, 0.8, -0.74], ["C", 0.95, -0.7, 1.02, -0.62, 1.0, -0.55], ["L", 0.82, -0.52], ["L", 0.98, -0.48],
  ["C", 0.9, -0.4, 0.7, -0.38, 0.6, -0.42], ["C", 0.54, -0.38, 0.5, -0.34, 0.5, -0.3]]);
const SPINO = theropod([["C", 0.52, -0.72, 0.62, -0.74, 0.75, -0.7], ["L", 1.06, -0.6], ["L", 1.06, -0.54], ["L", 0.7, -0.5], ["C", 0.6, -0.48, 0.52, -0.4, 0.5, -0.3]]);
const PARA = theropod([["C", 0.5, -0.72, 0.58, -0.76, 0.7, -0.74], ["C", 0.82, -0.72, 0.92, -0.64, 0.98, -0.58], ["C", 0.98, -0.52, 0.9, -0.5, 0.8, -0.5],
  ["C", 0.65, -0.48, 0.55, -0.42, 0.5, -0.3]]);
const DINO_FAR_LEG = [["M", -0.02, 0.32], ["L", 0.02, 0.9], ["L", -0.2, 0.9], ["L", -0.18, 0.5], ["Z"]];
const DINO_THIGH = ell(0.08, 0.22, 0.19, 0.28);
const DINO_ARM = [["M", 0.4, -0.15], ["L", 0.57, -0.02], ["L", 0.54, 0.04], ["L", 0.37, -0.07], ["Z"]];
const SPINO_SAIL = [["M", -0.38, -0.27], ["C", -0.25, -0.78, 0.15, -0.84, 0.34, -0.56], ["L", 0.27, -0.42], ["C", 0.05, -0.38, -0.15, -0.32, -0.38, -0.27], ["Z"]];
const PARA_CREST = taper(qpts([0.72, -0.73], [0.55, -0.98], [0.22, -0.95]), 0.05, 0.03);

// Cuadrúpedos.
const STEGO = [["M", -1.0, 0.2], ["C", -0.7, 0.1, -0.5, -0.15, -0.1, -0.25], ["C", 0.3, -0.3, 0.55, -0.1, 0.7, 0.05], ["C", 0.8, 0.1, 0.9, 0.12, 0.98, 0.15],
  ["C", 1.0, 0.22, 0.92, 0.26, 0.82, 0.24], ["C", 0.7, 0.22, 0.6, 0.25, 0.5, 0.3], ["L", 0.48, 0.66], ["L", 0.3, 0.66], ["L", 0.3, 0.38],
  ["C", 0.1, 0.42, -0.15, 0.42, -0.3, 0.38], ["L", -0.3, 0.66], ["L", -0.5, 0.66], ["L", -0.52, 0.32], ["C", -0.7, 0.3, -0.85, 0.25, -1.0, 0.2], ["Z"]];
const STEGO_PLATE = [["M", -0.1, 0.06], ["L", -0.1, -0.08], ["L", 0, -0.22], ["L", 0.1, -0.08], ["L", 0.1, 0.06], ["Z"]];
const STEGO_PLATES = [[-0.58, -0.04, 0.65, -0.35], [-0.38, -0.16, 0.85, -0.2], [-0.14, -0.24, 1.05, -0.05], [0.12, -0.26, 1.05, 0.1], [0.34, -0.19, 0.85, 0.3], [0.53, -0.08, 0.65, 0.5]]
  .map(([u, v, k, r]) => xform(STEGO_PLATE, u, v, r, k));
const STEGO_SPIKES = [[-0.9, 0.15, -0.6], [-0.82, 0.13, -0.3]].map(([u, v, r]) => xform([["M", -0.03, 0], ["L", 0, -0.22], ["L", 0.03, 0], ["Z"]], u, v, r));

const TRIKE = [["M", -0.95, 0.2], ["C", -0.7, 0.05, -0.4, -0.18, 0, -0.2], ["C", 0.25, -0.2, 0.4, -0.12, 0.48, -0.02], ["L", 0.5, 0.32], ["C", 0.5, 0.4, 0.48, 0.45, 0.46, 0.48],
  ["L", 0.46, 0.75], ["L", 0.3, 0.75], ["L", 0.3, 0.45], ["C", 0.1, 0.48, -0.15, 0.48, -0.3, 0.42], ["L", -0.3, 0.75], ["L", -0.46, 0.75], ["L", -0.48, 0.36],
  ["C", -0.65, 0.32, -0.8, 0.27, -0.95, 0.2], ["Z"]];
const TRIKE_FRILL = [["M", 0.4, 0.1], ["C", 0.28, -0.26, 0.5, -0.52, 0.7, -0.44], ["C", 0.86, -0.36, 0.84, -0.05, 0.74, 0.15], ["C", 0.62, 0.26, 0.48, 0.23, 0.4, 0.1], ["Z"]];
const TRIKE_FACE = [["M", 0.6, -0.05], ["C", 0.75, -0.12, 0.92, 0, 1.0, 0.18], ["C", 1.02, 0.26, 0.95, 0.3, 0.85, 0.3], ["C", 0.72, 0.3, 0.62, 0.25, 0.56, 0.15], ["Z"]];
const TRIKE_HORNS = [taper([[0.72, -0.04], [0.86, -0.24], [1.02, -0.4]], 0.03, 0.006), taper([[0.66, -0.02], [0.76, -0.22], [0.86, -0.36]], 0.026, 0.006), taper([[0.92, 0.07], [0.96, -0.04]], 0.024, 0.006)];

const BRACHIO = [["M", -1.0, 0.3], ["C", -0.6, 0.25, -0.4, 0, -0.1, -0.05], ["C", 0.15, -0.08, 0.3, -0.2, 0.38, -0.5], ["C", 0.45, -0.8, 0.5, -0.92, 0.62, -0.95],
  ["C", 0.75, -0.97, 0.82, -0.9, 0.78, -0.84], ["C", 0.68, -0.82, 0.6, -0.8, 0.57, -0.7], ["C", 0.52, -0.4, 0.5, -0.15, 0.52, 0.05], ["L", 0.55, 0.72], ["L", 0.37, 0.72],
  ["L", 0.36, 0.35], ["C", 0.1, 0.4, -0.15, 0.4, -0.3, 0.35], ["L", -0.3, 0.72], ["L", -0.48, 0.72], ["L", -0.5, 0.32], ["C", -0.7, 0.34, -0.85, 0.33, -1.0, 0.3], ["Z"]];

const ANKY = [["M", -0.55, 0.1], ["C", -0.5, -0.25, 0.1, -0.4, 0.5, -0.2], ["C", 0.65, -0.12, 0.75, -0.02, 0.8, 0.05], ["C", 0.95, 0.05, 1.0, 0.15, 0.95, 0.25],
  ["C", 0.85, 0.3, 0.7, 0.28, 0.62, 0.25], ["L", 0.6, 0.55], ["L", 0.44, 0.55], ["L", 0.43, 0.32], ["C", 0.2, 0.36, -0.1, 0.36, -0.3, 0.32], ["L", -0.3, 0.55],
  ["L", -0.46, 0.55], ["L", -0.48, 0.26], ["C", -0.65, 0.26, -0.8, 0.24, -0.9, 0.24], ["L", -0.9, 0.15], ["C", -0.78, 0.13, -0.66, 0.12, -0.55, 0.1], ["Z"]];
const ANKY_CLUB = ell(-0.97, 0.195, 0.11, 0.09);

// Pterosaurio en vuelo (visto desde abajo, simétrico).
const PTERO_WING = [["M", 0.05, -0.18], ["C", 0.4, -0.4, 0.8, -0.46, 1.02, -0.36], ["C", 0.78, -0.18, 0.5, 0.04, 0.05, 0.16], ["Z"]];
const PTERO_BODY = ell(0, 0.02, 0.09, 0.32);
const PTERO_HEAD = [["M", -0.07, -0.28], ["L", 0, -0.82], ["L", 0.07, -0.28], ["Z"]];
const PTERO_LEGS = [taper([[0.04, 0.3], [0.12, 0.5], [0.16, 0.62]], 0.025, 0.015), taper([[-0.04, 0.3], [-0.12, 0.5], [-0.16, 0.62]], 0.025, 0.015)];

/* ---- Más prehistoria ---- */
const ALLO = theropod([["C", 0.5, -0.74, 0.6, -0.8, 0.72, -0.78], ["L", 0.76, -0.86], ["L", 0.8, -0.77], ["C", 0.92, -0.74, 1.0, -0.66, 0.98, -0.58], ["L", 0.82, -0.54], ["L", 0.95, -0.48],
  ["C", 0.86, -0.42, 0.68, -0.4, 0.58, -0.42], ["C", 0.53, -0.38, 0.5, -0.34, 0.5, -0.3]]);
const RAPTOR = theropod([["C", 0.5, -0.7, 0.6, -0.72, 0.74, -0.68], ["L", 1.0, -0.58], ["L", 0.98, -0.52], ["L", 0.7, -0.5], ["C", 0.6, -0.48, 0.52, -0.4, 0.5, -0.3]]);
const RAPTOR_CLAW = taper(qpts([0.3, 0.86], [0.42, 0.78], [0.44, 0.68]), 0.02, 0.006);
const PACHY = theropod([["C", 0.46, -0.78, 0.6, -0.92, 0.74, -0.88], ["C", 0.9, -0.84, 0.98, -0.7, 0.96, -0.6], ["C", 0.92, -0.52, 0.82, -0.5, 0.72, -0.5],
  ["C", 0.6, -0.48, 0.52, -0.4, 0.5, -0.3]]);
const PACHY_DOME = [["M", 0.5, -0.76], ["C", 0.56, -0.98, 0.86, -1.02, 0.94, -0.78], ["C", 0.84, -0.84, 0.64, -0.84, 0.5, -0.76], ["Z"]];
const IGUANO = theropod([["C", 0.48, -0.74, 0.56, -0.8, 0.68, -0.8], ["C", 0.84, -0.8, 0.96, -0.7, 0.98, -0.62], ["C", 0.96, -0.56, 0.86, -0.54, 0.76, -0.54],
  ["C", 0.64, -0.52, 0.54, -0.42, 0.5, -0.3]]);
const IGUANO_THUMB = taper([[0.54, 0.0], [0.6, -0.08], [0.64, -0.16]], 0.025, 0.006);

const DIPLO = [["M", -1.0, 0.0], ["C", -0.7, 0.05, -0.45, -0.1, -0.2, -0.15], ["C", 0.05, -0.2, 0.2, -0.2, 0.35, -0.25], ["C", 0.6, -0.35, 0.8, -0.5, 0.92, -0.52],
  ["C", 1.0, -0.53, 1.04, -0.47, 0.98, -0.44], ["C", 0.85, -0.4, 0.7, -0.28, 0.45, -0.08], ["L", 0.42, 0.42], ["L", 0.27, 0.42], ["L", 0.26, 0.12],
  ["C", 0.05, 0.16, -0.12, 0.16, -0.22, 0.12], ["L", -0.24, 0.42], ["L", -0.39, 0.42], ["L", -0.4, 0.08], ["C", -0.6, 0.06, -0.8, 0.04, -1.0, 0.0], ["Z"]];
const DIMETRO = [["M", -1.0, 0.25], ["C", -0.7, 0.2, -0.4, 0.05, -0.1, 0.02], ["C", 0.3, -0.02, 0.6, 0.02, 0.82, 0.1], ["C", 0.96, 0.15, 1.0, 0.24, 0.92, 0.3],
  ["C", 0.8, 0.34, 0.66, 0.3, 0.55, 0.3], ["L", 0.55, 0.52], ["L", 0.42, 0.52], ["L", 0.4, 0.34], ["C", 0.1, 0.36, -0.15, 0.36, -0.3, 0.34], ["L", -0.32, 0.52],
  ["L", -0.45, 0.52], ["L", -0.46, 0.3], ["C", -0.7, 0.3, -0.85, 0.28, -1.0, 0.25], ["Z"]];
const DIMETRO_SAIL = [["M", -0.45, 0.05], ["C", -0.35, -0.62, 0.25, -0.7, 0.42, 0.02], ["C", 0.1, -0.02, -0.2, 0.0, -0.45, 0.05], ["Z"]];

const PLESIO = [["M", -0.6, 0.15], ["C", -0.6, -0.12, -0.2, -0.22, 0.1, -0.2], ["C", 0.3, -0.2, 0.4, -0.3, 0.5, -0.5], ["C", 0.6, -0.72, 0.7, -0.86, 0.84, -0.88],
  ["C", 0.98, -0.9, 1.04, -0.8, 0.96, -0.76], ["C", 0.84, -0.74, 0.74, -0.62, 0.66, -0.42], ["C", 0.56, -0.18, 0.5, 0.08, 0.3, 0.2], ["C", 0.0, 0.32, -0.3, 0.32, -0.6, 0.15], ["Z"]];
const PLESIO_TAIL = [["M", -0.56, 0.06], ["L", -1.0, 0.22], ["L", -0.55, 0.2], ["Z"]];
const PLESIO_FLIP = [["M", 0, 0], ["C", 0.1, 0.1, 0.12, 0.36, 0.02, 0.48], ["C", -0.06, 0.3, -0.08, 0.14, -0.06, 0.02], ["Z"]];
const PLESIO_FLIPS = [xform(PLESIO_FLIP, 0.12, 0.18, -0.5), xform(PLESIO_FLIP, -0.38, 0.2, -0.3)];

const MOSA = [["M", 1.0, 0.0], ["C", 0.9, -0.14, 0.6, -0.2, 0.3, -0.18], ["C", -0.1, -0.16, -0.5, -0.06, -0.8, 0.0], ["L", -1.0, -0.22], ["L", -0.92, 0.04], ["L", -1.0, 0.16],
  ["L", -0.8, 0.06], ["C", -0.5, 0.12, -0.1, 0.16, 0.3, 0.14], ["C", 0.6, 0.12, 0.88, 0.08, 1.0, 0.0], ["Z"]];
// Cuerpo más grueso (×1.7 en alto): delgado se leía como un pez espada.
MOSA.splice(0, MOSA.length, ...xform(MOSA.slice(), 0, 0, 0, 1, 1.7));
const MOSA_FLIPS = [xform(PLESIO_FLIP, 0.42, 0.12, -0.6, 0.8), xform(PLESIO_FLIP, -0.2, 0.12, -0.5, 0.65)];

// Amonite: espiral con costillas (como el nautilus, más vueltas y más cámaras).
const AMMO = (() => {
  const b = Math.log(2.2) / (2 * Math.PI), r = (t) => Math.exp(b * t);
  const P = (t, rad) => [Math.cos(t) * rad, Math.sin(t) * rad];
  const ch = [];
  const n = 12;
  for (let turn = 0; turn < 3; turn++) for (let k = 0; k < n; k++) {
    const ta = -2 * Math.PI * (turn + 1) + (2 * Math.PI * k) / n, tb = ta + (2 * Math.PI) / n;
    const outer = [], inner = [];
    for (let i = 0; i <= 6; i++) { const t = ta + ((tb - ta) * i) / 6; outer.push(P(t, r(t))); inner.unshift(P(t, r(t - 2 * Math.PI))); }
    ch.push(polyCmds([...outer, ...inner]));
  }
  const shell = [];
  for (let i = 0; i <= 120; i++) { const t = -2 * Math.PI + (2 * Math.PI * i) / 120; shell.push(P(t, r(t))); }
  return { ch, shell: polyCmds(shell), core: ell(0, 0, r(-6 * Math.PI) * 1.05) };
})();

/* ---- Más biología ---- */
const BACT = [["M", -0.7, -0.22], ["C", -0.7, -0.4, -0.55, -0.42, -0.4, -0.42], ["L", 0.45, -0.42], ["C", 0.62, -0.42, 0.72, -0.3, 0.72, -0.1], ["L", 0.72, 0.1],
  ["C", 0.72, 0.3, 0.62, 0.42, 0.45, 0.42], ["L", -0.4, 0.42], ["C", -0.55, 0.42, -0.7, 0.4, -0.7, 0.22], ["Z"]];
const BACT_FLAG = [taper(Array.from({ length: 13 }, (_, i) => [0.7 + i * 0.025, 0.1 * Math.sin(i * 0.9)]).map(([x, y], i) => [0.7 + i * 0.026, y + i * 0.02]), 0.02, 0.012),
  taper(Array.from({ length: 13 }, (_, i) => [-0.7 - i * 0.026, 0.1 * Math.sin(i * 0.9) - i * 0.03]), 0.02, 0.012)];
const BACT_DNA = taper(qpts([-0.35, 0.05], [0, -0.3], [0.35, 0.05], 16), 0.03, 0.03);

const JELLY_BELL = [["M", -0.62, 0.0], ["C", -0.62, -0.62, -0.3, -0.85, 0, -0.85], ["C", 0.3, -0.85, 0.62, -0.62, 0.62, 0.0], ["Q", 0.47, 0.1, 0.31, 0.0], ["Q", 0.16, 0.1, 0, 0.0],
  ["Q", -0.16, 0.1, -0.31, 0.0], ["Q", -0.47, 0.1, -0.62, 0.0], ["Z"]];
const JELLY_TENT = [-0.45, -0.22, 0, 0.22, 0.45].map((x, k) => taper(Array.from({ length: 16 }, (_, i) => [x + 0.07 * Math.sin(i * 0.7 + k), 0.04 + i * 0.06]), 0.04, 0.012));
const JELLY_ARMS = [-0.1, 0.1].map((x) => taper(Array.from({ length: 12 }, (_, i) => [x + 0.1 * Math.sin(i * 0.5) * (x > 0 ? 1 : -1), 0.04 + i * 0.05]), 0.07, 0.03));

const HEART_ORG = [["M", -0.1, -0.35], ["C", -0.5, -0.5, -0.82, -0.2, -0.74, 0.15], ["C", -0.66, 0.5, -0.3, 0.8, 0.05, 0.95], ["C", 0.35, 0.75, 0.72, 0.4, 0.76, 0.0],
  ["C", 0.8, -0.35, 0.45, -0.52, 0.15, -0.38], ["Z"]];
const AORTA = [["M", -0.08, -0.36], ["C", -0.12, -0.7, 0.05, -0.92, 0.32, -0.9], ["C", 0.55, -0.88, 0.62, -0.7, 0.6, -0.5], ["L", 0.48, -0.5], ["C", 0.48, -0.66, 0.42, -0.76, 0.3, -0.76],
  ["C", 0.12, -0.76, 0.06, -0.6, 0.08, -0.38], ["Z"]];
const VESSELS = [taper([[-0.3, -0.42], [-0.36, -0.68], [-0.44, -0.84]], 0.06, 0.05), taper([[0.25, -0.88], [0.22, -1.0]], 0.04, 0.035), taper([[0.42, -0.86], [0.46, -1.0]], 0.04, 0.035)];

const EYE_BALL = ell(-0.1, 0, 0.72);
const EYE_CORNEA = [["M", 0.5, -0.32], ["C", 0.8, -0.28, 0.82, 0.28, 0.5, 0.32], ["C", 0.58, 0.1, 0.58, -0.1, 0.5, -0.32], ["Z"]];
const EYE_LENS = ell(0.44, 0, 0.09, 0.22);
const EYE_NERVE = [["M", -0.78, -0.12], ["C", -0.9, -0.12, -0.98, -0.06, -1.04, 0.0], ["C", -0.98, 0.06, -0.9, 0.12, -0.78, 0.12], ["Z"]];

const DIATOM = ell(0, 0, 0.92);
const DIATOM_RINGS = [ell(0, 0, 0.62), ell(0, 0, 0.3)];

/* ---- Más figuras para adultos (temas del nicho: flores, mar, animales
   elegantes, hogar acogedor, celeste) ---- */

// Rosa vista desde arriba: anillos de pétalos que se solapan.
const ROSE = (() => {
  const petals = [];
  const ring = (n, R, w, h, a0) => { for (let k = 0; k < n; k++) { const a = a0 + (k / n) * TAU; petals.push(xform(ell(0, 0, w, h), Math.cos(a) * R, Math.sin(a) * R, a + Math.PI / 2)); } };
  ring(7, 0.62, 0.38, 0.3, 0.2); ring(6, 0.38, 0.3, 0.24, 0.6); ring(5, 0.17, 0.2, 0.16, 1.1);
  return petals;
})();
const ROSE_LEAVES = [xform(LEAF, 0.72, 0.72, -0.8, 0.28, 0.38), xform(LEAF, -0.75, 0.68, 0.8, 0.26, 0.36)];

// Suculenta (roseta) en maceta.
// Hojas carnosas redondeadas en abanico (echeveria vista de lado).
const SUCC = (() => {
  const out = [];
  for (const [n, L, w, spread] of [[7, 0.78, 0.21, 1.45], [5, 0.56, 0.17, 1.0], [3, 0.36, 0.13, 0.55]])
    for (let k = 0; k < n; k++) { const r = -spread + (2 * spread * k) / (n - 1); out.push(xform(ell(0, -L / 2, w, L / 2), 0, 0.22, r)); }
  return out;
})();
const SUCC_POT = [["M", -0.5, 0.35], ["L", 0.5, 0.35], ["L", 0.4, 0.98], ["L", -0.4, 0.98], ["Z"]];
const SUCC_RIM = [["M", -0.56, 0.24], ["L", 0.56, 0.24], ["L", 0.56, 0.4], ["L", -0.56, 0.4], ["Z"]];

// Caballito de mar.
const SEAHORSE = [["M", 0.1, -0.78], ["C", 0.28, -0.88, 0.45, -0.8, 0.5, -0.66], ["L", 0.82, -0.62], ["L", 0.82, -0.52], ["L", 0.48, -0.5], ["C", 0.44, -0.4, 0.36, -0.34, 0.3, -0.28],
  ["C", 0.48, -0.1, 0.5, 0.2, 0.32, 0.38], ["C", 0.2, 0.5, 0.05, 0.56, 0.0, 0.66], ["C", -0.06, 0.8, 0.08, 0.92, 0.2, 0.86], ["C", 0.3, 0.8, 0.26, 0.7, 0.18, 0.7],
  ["C", 0.14, 0.7, 0.12, 0.74, 0.14, 0.77], ["C", 0.06, 0.78, 0.02, 0.72, 0.08, 0.66], ["C", 0.0, 0.88, -0.24, 0.9, -0.24, 0.66], ["C", -0.24, 0.5, -0.08, 0.42, -0.06, 0.28],
  ["C", -0.04, 0.0, -0.2, -0.2, -0.12, -0.45], ["C", -0.08, -0.62, 0.0, -0.74, 0.1, -0.78], ["Z"]];
const SEAHORSE_FIN = [["M", -0.1, -0.1], ["C", -0.34, -0.12, -0.42, 0.06, -0.36, 0.2], ["C", -0.24, 0.12, -0.14, 0.08, -0.06, 0.1], ["Z"]];

// Pulpo: cabeza y ocho tentáculos ondulados.
const OCTO_HEAD = [["M", -0.42, -0.1], ["C", -0.5, -0.6, -0.24, -0.92, 0, -0.92], ["C", 0.24, -0.92, 0.5, -0.6, 0.42, -0.1], ["C", 0.3, 0.06, -0.3, 0.06, -0.42, -0.1], ["Z"]];
const OCTO_ARMS = [-0.36, -0.26, -0.15, -0.05, 0.05, 0.15, 0.26, 0.36].map((x0, k) => {
  const dir = x0 < 0 ? -1 : 1, spread = Math.abs(x0) * 2.2;
  const pts = Array.from({ length: 18 }, (_, i) => { const t = i / 17; return [x0 + dir * spread * t * 0.9 + 0.07 * Math.sin(t * 7 + k), -0.04 + t * (0.95 - Math.abs(x0) * 0.6) - 0.15 * Math.sin(t * 3.2) * t]; });
  return taper(pts, 0.07, 0.015);
});

// Lobo aullando (silueta sentada, mira arriba a la derecha).
const WOLF = [["M", -0.5, 0.95], ["C", -0.56, 0.6, -0.5, 0.25, -0.3, 0.0], ["C", -0.18, -0.18, -0.05, -0.35, 0.05, -0.55], ["L", 0.04, -0.74], ["L", 0.14, -0.62],
  ["C", 0.2, -0.66, 0.24, -0.7, 0.28, -0.72], ["L", 0.3, -0.9], ["L", 0.38, -0.7], ["C", 0.5, -0.72, 0.62, -0.82, 0.72, -0.92], ["L", 0.76, -0.86],
  ["C", 0.68, -0.72, 0.6, -0.6, 0.5, -0.52], ["C", 0.4, -0.42, 0.3, -0.3, 0.26, -0.1], ["C", 0.24, 0.1, 0.3, 0.35, 0.32, 0.6], ["L", 0.36, 0.95],
  ["L", 0.2, 0.95], ["L", 0.14, 0.62], ["L", 0.06, 0.95], ["Z"]];
const WOLF_TAIL = [["M", -0.42, 0.75], ["C", -0.7, 0.8, -0.95, 0.9, -1.0, 0.98], ["C", -0.8, 1.0, -0.6, 0.98, -0.42, 0.93], ["Z"]];

// Cabeza de caballo con crin.
const HORSE = [["M", -0.3, 0.95], ["C", -0.32, 0.5, -0.25, 0.1, -0.1, -0.25], ["C", 0.0, -0.5, 0.1, -0.65, 0.2, -0.72], ["L", 0.2, -0.9], ["L", 0.3, -0.74],
  ["C", 0.45, -0.7, 0.58, -0.5, 0.7, -0.25], ["C", 0.8, -0.05, 0.86, 0.1, 0.82, 0.18], ["C", 0.76, 0.26, 0.64, 0.24, 0.55, 0.16], ["C", 0.45, 0.06, 0.35, 0.0, 0.28, 0.06],
  ["C", 0.25, 0.35, 0.35, 0.65, 0.45, 0.95], ["Z"]];
const HORSE_MANE = [["M", 0.15, -0.7], ["C", -0.15, -0.55, -0.35, -0.2, -0.42, 0.2], ["C", -0.48, 0.5, -0.45, 0.75, -0.42, 0.95], ["L", -0.3, 0.95],
  ["C", -0.32, 0.5, -0.25, 0.1, -0.1, -0.25], ["C", 0.0, -0.5, 0.08, -0.62, 0.15, -0.7], ["Z"]];

// Pavo real: cola en abanico de plumas con ojo.
const PEACOCK_BODY = [["M", 0.02, -0.32], ["C", 0.12, -0.45, 0.04, -0.6, 0.1, -0.68], ["C", 0.16, -0.74, 0.24, -0.7, 0.24, -0.64], ["L", 0.32, -0.62], ["L", 0.24, -0.58],
  ["C", 0.22, -0.5, 0.18, -0.4, 0.16, -0.28], ["C", 0.24, 0.0, 0.2, 0.4, 0.05, 0.6], ["C", -0.1, 0.45, -0.14, 0.1, 0.02, -0.32], ["Z"]];
const PEACOCK_FAN = (() => {
  const out = [];
  for (let k = 0; k < 9; k++) out.push(xform([["M", 0, 0], ["C", 0.14, -0.3, 0.16, -0.7, 0, -0.9], ["C", -0.16, -0.7, -0.14, -0.3, 0, 0], ["Z"]], 0.06, 0.45, (k - 4) * 0.3, 1.0, 1.15));
  return out;
})();
const PEACOCK_EYES = Array.from({ length: 9 }, (_, k) => { const r = (k - 4) * 0.3; return [0.06 + Math.sin(r) * 0.8, 0.45 - Math.cos(r) * 0.8]; });

// Gato sentado (silueta elegante, de espaldas, sin cara).
const SITCAT = [["M", -0.38, 0.95], ["C", -0.5, 0.6, -0.42, 0.2, -0.22, -0.05], ["C", -0.26, -0.25, -0.26, -0.45, -0.2, -0.58], ["L", -0.24, -0.86], ["L", -0.06, -0.68],
  ["C", 0.02, -0.7, 0.1, -0.7, 0.16, -0.68], ["L", 0.32, -0.86], ["L", 0.3, -0.58], ["C", 0.36, -0.45, 0.36, -0.25, 0.26, -0.05], ["C", 0.48, 0.2, 0.52, 0.6, 0.4, 0.95], ["Z"]];
const SITCAT_TAIL = [["M", 0.3, 0.88], ["C", 0.7, 0.95, 0.9, 0.75, 0.86, 0.45], ["C", 0.84, 0.3, 0.72, 0.28, 0.72, 0.4], ["C", 0.76, 0.62, 0.62, 0.78, 0.3, 0.78], ["Z"]];

// Tetera.
const TEAPOT = [["M", -0.6, 0.0], ["C", -0.65, -0.4, -0.3, -0.52, 0, -0.52], ["C", 0.3, -0.52, 0.65, -0.4, 0.6, 0.0], ["C", 0.58, 0.4, 0.35, 0.62, 0, 0.62],
  ["C", -0.35, 0.62, -0.58, 0.4, -0.6, 0.0], ["Z"]];
const TEAPOT_LID = [["M", -0.32, -0.5], ["C", -0.28, -0.7, 0.28, -0.7, 0.32, -0.5], ["Z"]];
const TEAPOT_SPOUT = [["M", 0.55, -0.02], ["C", 0.75, -0.05, 0.85, -0.2, 0.98, -0.42], ["L", 1.04, -0.36], ["C", 0.92, -0.1, 0.82, 0.12, 0.56, 0.2], ["Z"]];
const TEAPOT_HANDLE = [["M", -0.56, -0.25], ["C", -0.95, -0.3, -1.0, 0.25, -0.58, 0.28], ["L", -0.6, 0.16], ["C", -0.82, 0.12, -0.8, -0.14, -0.58, -0.12], ["Z"]];
const TEAPOT_BASE = [["M", -0.35, 0.56], ["L", 0.35, 0.56], ["L", 0.42, 0.72], ["L", -0.42, 0.72], ["Z"]];

// Sol radiante (rayos ondulados alternos).
const SUN_RAYS = Array.from({ length: 12 }, (_, k) => {
  const a = (k / 12) * TAU, L = k % 2 ? 0.88 : 1.0;
  return xform([["M", -0.09, 0], ["C", -0.12, -0.3, 0.05, -0.5, 0, -1], ["C", 0.12, -0.5, 0.12, -0.3, 0.09, 0], ["Z"]], Math.cos(a - Math.PI / 2) * 0.48, Math.sin(a - Math.PI / 2) * 0.48, a, 1, L * 0.55);
});

/* ---- Críptidos del mundo (criaturas del folclore, dibujo original) ---- */

// Pie Grande (Norteamérica): caminando de perfil hacia la izquierda, encorvado,
// con zancada y brazos que se balancean; borde de pelo en dientes de sierra.
const furPoly = (pts, amp = 0.025, every = 2) => {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
    out.push([x0, y0]);
    const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.floor(L / 0.07));
    if (i % every === 0) for (let k = 1; k < n; k++) { const t = k / n, nx = (y1 - y0) / L, ny = -(x1 - x0) / L, o = k % 2 ? amp : -amp * 0.3; out.push([x0 + (x1 - x0) * t + nx * o, y0 + (y1 - y0) * t + ny * o]); }
  }
  return polyCmds(out);
};
// Contorno suave por puntos (Catmull-Rom → cúbicas).
const smoothPoly = (pts) => {
  const n = pts.length, P = (i) => pts[(i + n) % n], out = [["M", ...pts[0]]];
  for (let i = 0; i < n; i++) {
    const [x0, y0] = P(i - 1), [x1, y1] = P(i), [x2, y2] = P(i + 1), [x3, y3] = P(i + 2);
    out.push(["C", x1 + (x2 - x0) / 6, y1 + (y2 - y0) / 6, x2 - (x3 - x1) / 6, y2 - (y3 - y1) / 6, x2, y2]);
  }
  return [...out, ["Z"]];
};
const BIGFOOT2 = smoothPoly([[-0.25, -0.98], [-0.04, -0.93], [0.16, -0.76], [0.3, -0.46], [0.33, -0.1], [0.3, 0.12], [0.42, 0.4], [0.52, 0.62], [0.6, 0.9],
  [0.68, 0.98], [0.4, 0.98], [0.34, 0.66], [0.15, 0.3], [-0.03, 0.56], [-0.14, 0.9], [-0.46, 0.98], [-0.44, 0.9], [-0.27, 0.56], [-0.16, 0.2], [-0.22, -0.1],
  [-0.3, -0.42], [-0.38, -0.58], [-0.5, -0.64], [-0.53, -0.76], [-0.45, -0.9]]);
const BIGFOOT_FRONTARM = smoothPoly([[-0.12, -0.56], [-0.28, -0.3], [-0.44, -0.02], [-0.56, 0.16], [-0.6, 0.3], [-0.48, 0.32], [-0.4, 0.14], [-0.24, -0.08], [-0.06, -0.36]]);
const BIGFOOT_BACKARM = smoothPoly([[0.12, -0.56], [0.3, -0.32], [0.46, -0.06], [0.58, 0.12], [0.62, 0.24], [0.5, 0.26], [0.4, 0.08], [0.24, -0.14], [0.06, -0.4]]);
// Monstruo del lago Ness (Escocia): jorobas saliendo del agua.
const NESSIE_NECK = [["M", -0.62, 0.3], ["C", -0.6, -0.1, -0.5, -0.5, -0.3, -0.72], ["C", -0.2, -0.84, -0.04, -0.86, 0.06, -0.78], ["L", 0.14, -0.74], ["L", 0.06, -0.68],
  ["C", -0.04, -0.7, -0.14, -0.66, -0.2, -0.56], ["C", -0.32, -0.36, -0.36, -0.05, -0.34, 0.3], ["Z"]];
const NESSIE_HUMPS = [[0.0, 0.3, 0.2], [0.42, 0.3, 0.17], [0.78, 0.3, 0.12]].map(([x, y, r]) => [["M", x - r, y], ["C", x - r, y - r * 1.3, x + r, y - r * 1.3, x + r, y], ["Z"]]);
const NESSIE_WAVES_OLD = [["M", -1.0, 0.3], ["L", 1.0, 0.3], ["L", 1.0, 0.42], ["Q", 0.75, 0.34, 0.5, 0.42], ["Q", 0.25, 0.5, 0, 0.42], ["Q", -0.25, 0.34, -0.5, 0.42], ["Q", -0.75, 0.5, -1.0, 0.42], ["Z"]];

const NESSIE_WAVES = [0.36, 0.5, 0.64].map((y, k) => taper(Array.from({ length: 30 }, (_, i) => [-0.95 + k * 0.1 + i * 0.06, y + 0.03 * Math.sin(i * 0.9 + k)]), 0.03, 0.03));
// Mothman (West Virginia): alas de polilla con ocelos, cuerpo largo con
// tangle, antenas plumosas y ojos grandes (simétrico; mitad derecha).
const MOTH2_UP = [["M", 0.1, -0.42], ["C", 0.3, -0.8, 0.8, -0.95, 0.98, -0.72], ["C", 1.08, -0.5, 0.86, -0.18, 0.55, -0.1], ["C", 0.38, -0.06, 0.22, -0.08, 0.1, -0.12], ["Z"]];
const MOTH2_LOW = [["M", 0.1, -0.06], ["C", 0.4, -0.04, 0.72, 0.08, 0.68, 0.38], ["C", 0.64, 0.6, 0.42, 0.72, 0.3, 0.92], ["C", 0.22, 0.7, 0.14, 0.5, 0.1, 0.3], ["Z"]];
const MOTH2_BODY = [["M", 0, -0.62], ["C", 0.1, -0.62, 0.13, -0.5, 0.12, -0.38], ["C", 0.12, 0.0, 0.1, 0.4, 0.06, 0.62], ["L", 0.09, 0.95], ["L", 0.03, 0.95], ["L", 0, 0.66], ["Z"]];
const MOTH2_ANT = (() => { const pts = qpts([0.03, -0.6], [0.1, -0.85], [0.3, -0.95], 8); return taper(pts, 0.02, 0.01); })();
const MOTH2_FEATHERS = [0.3, 0.5, 0.7].map((t) => { const i = Math.round(t * 8); const [x, y] = qpts([0.03, -0.6], [0.1, -0.85], [0.3, -0.95], 8)[i]; return taper([[x, y], [x + 0.08, y + 0.05]], 0.012, 0.006); });
// Chupacabras (México / Puerto Rico): espalda con púas, patas finas.
const CHUPA = [["M", -0.8, 0.1], ["C", -0.55, -0.1, -0.3, -0.25, 0.0, -0.28], ["C", 0.3, -0.3, 0.5, -0.4, 0.62, -0.52], ["L", 0.6, -0.7], ["L", 0.72, -0.58], ["C", 0.85, -0.55, 0.95, -0.45, 0.98, -0.36],
  ["L", 0.82, -0.32], ["C", 0.7, -0.3, 0.6, -0.2, 0.52, -0.08], ["L", 0.55, 0.3], ["L", 0.62, 0.62], ["L", 0.5, 0.62], ["L", 0.42, 0.32], ["L", 0.38, 0.05],
  ["C", 0.1, 0.1, -0.15, 0.1, -0.35, 0.05], ["L", -0.4, 0.35], ["L", -0.3, 0.62], ["L", -0.42, 0.62], ["L", -0.55, 0.32], ["L", -0.6, 0.12], ["Z"]];
const CHUPA_SPIKES = Array.from({ length: 7 }, (_, k) => { const x = -0.5 + k * 0.16, y = -0.2 - 0.12 * Math.sin((k / 6) * Math.PI); return [["M", x - 0.06, y + 0.06], ["L", x, y - 0.18], ["L", x + 0.06, y + 0.06], ["Z"]]; });

// Kraken (Escandinavia): tentáculos que salen del mar y rodean un barco.
// Cada tentáculo sube ondulando y termina en un rizo (espiral hacia dentro).
const KRAKEN_ARMS = [[-0.78, 0.0, 1.25], [-0.36, 0.8, 1.45], [0.32, 1.6, 1.4], [0.78, 2.4, 1.2]].map(([x0, ph, len]) => {
  const dir = x0 < 0 ? 1 : -1;
  const pts = Array.from({ length: 26 }, (_, i) => { const t = i / 25; return [x0 + dir * 0.18 * Math.sin(t * 5 + ph), 0.62 - t * len]; });
  const [tx, ty] = pts[pts.length - 1];
  for (let i = 1; i <= 14; i++) { const a = Math.PI + dir * (i / 14) * Math.PI * 1.6, r = 0.16 * (1 - i / 18); pts.push([tx + dir * 0.16 + Math.cos(a) * r * dir, ty + Math.sin(a) * r]); }
  return taper(pts, 0.085, 0.012);
});
// Ventosas a lo largo del lado interior de cada tentáculo.
const KRAKEN_SUCKERS = [[-0.78, 0.0, 1.25], [-0.36, 0.8, 1.45], [0.32, 1.6, 1.4], [0.78, 2.4, 1.2]].flatMap(([x0, ph, len]) => {
  const dir = x0 < 0 ? 1 : -1;
  return [0.18, 0.34, 0.5, 0.66].map((t) => { const x = x0 + dir * 0.18 * Math.sin(t * 5 + ph), y = 0.62 - t * len; return ell(x + dir * 0.035, y, 0.028 * (1 - t * 0.5)); });
});
const KRAKEN_SEA = [["M", -1.0, 0.55], ["Q", -0.75, 0.45, -0.5, 0.55], ["Q", -0.25, 0.65, 0, 0.55], ["Q", 0.25, 0.45, 0.5, 0.55], ["Q", 0.75, 0.65, 1.0, 0.55], ["L", 1.0, 0.95], ["L", -1.0, 0.95], ["Z"]];
const KRAKEN_SHIP = [["M", -0.28, 0.42], ["L", 0.28, 0.42], ["L", 0.2, 0.55], ["L", -0.2, 0.55], ["Z"]];
const KRAKEN_SAIL = [["M", 0.0, 0.0], ["C", 0.16, 0.1, 0.18, 0.28, 0.0, 0.4], ["Z"]];

// Yeti (Himalaya): de frente, hombros macizos, brazos largos hasta las rodillas.
const YETI_PTS = [[0, -0.97], [0.16, -0.93], [0.24, -0.8], [0.3, -0.68], [0.52, -0.62], [0.68, -0.46], [0.78, -0.16], [0.84, 0.2], [0.84, 0.5], [0.76, 0.62],
  [0.64, 0.56], [0.6, 0.3], [0.56, 0.38], [0.54, 0.86], [0.6, 0.97], [0.18, 0.97], [0.14, 0.62], [0.05, 0.5]];
const YETI2 = smoothPoly([...YETI_PTS, ...YETI_PTS.slice(1).reverse().map(([x, y]) => [-x, y])]);
const YETI2_FACE = [["M", 0, -0.86], ["C", 0.13, -0.86, 0.17, -0.76, 0.15, -0.66], ["C", 0.13, -0.56, 0.07, -0.52, 0, -0.52], ["C", -0.07, -0.52, -0.13, -0.56, -0.15, -0.66],
  ["C", -0.17, -0.76, -0.13, -0.86, 0, -0.86], ["Z"]];
const YETI2_CHEST = ell(0, -0.18, 0.3, 0.26);
// Ovni: platillo con cúpula, luces y rayo de abducción.
const UFO_DISC = [["M", -0.95, -0.12], ["C", -0.9, -0.3, -0.5, -0.38, 0, -0.38], ["C", 0.5, -0.38, 0.9, -0.3, 0.95, -0.12], ["C", 0.9, 0.05, 0.5, 0.12, 0, 0.12],
  ["C", -0.5, 0.12, -0.9, 0.05, -0.95, -0.12], ["Z"]];
const UFO_DOME = [["M", -0.42, -0.34], ["C", -0.42, -0.72, -0.2, -0.85, 0, -0.85], ["C", 0.2, -0.85, 0.42, -0.72, 0.42, -0.34], ["Z"]];
const UFO_BEAM = [["M", -0.22, 0.1], ["L", 0.22, 0.1], ["L", 0.62, 0.95], ["L", -0.62, 0.95], ["Z"]];
const UFO_LIGHTS = [-0.7, -0.42, -0.14, 0.14, 0.42, 0.7].map((x) => ell(x, -0.1 + Math.abs(x) * 0.04, 0.06, 0.045));
// Yeti (Himalaya): figura maciza de frente, brazos largos (simétrico).
// Diablo de Jersey: cuerpo de caballo alado, cola en punta.
const JDEVIL = [["M", -0.5, 0.1], ["C", -0.3, -0.05, 0.1, -0.08, 0.35, -0.1], ["C", 0.45, -0.35, 0.55, -0.55, 0.68, -0.62], ["L", 0.62, -0.82], ["L", 0.76, -0.66],
  ["C", 0.9, -0.62, 0.98, -0.5, 0.96, -0.4], ["L", 0.78, -0.38], ["C", 0.68, -0.3, 0.6, -0.15, 0.55, 0.05], ["L", 0.55, 0.62], ["L", 0.44, 0.62], ["L", 0.38, 0.22],
  ["C", 0.1, 0.25, -0.15, 0.25, -0.3, 0.22], ["L", -0.35, 0.62], ["L", -0.46, 0.62], ["L", -0.48, 0.25], ["Z"]];
const JDEVIL_WING = [["M", -0.05, -0.08], ["C", -0.2, -0.6, 0.2, -0.95, 0.55, -0.98], ["C", 0.45, -0.8, 0.42, -0.65, 0.48, -0.5], ["C", 0.32, -0.55, 0.22, -0.48, 0.2, -0.3],
  ["C", 0.1, -0.35, 0.02, -0.25, 0.05, -0.08], ["Z"]];
const JDEVIL_TAIL = [["M", -0.48, 0.08], ["C", -0.75, 0.0, -0.85, 0.3, -0.92, 0.5], ["L", -1.0, 0.48], ["L", -0.94, 0.62], ["L", -0.82, 0.55], ["L", -0.88, 0.5],
  ["C", -0.82, 0.32, -0.72, 0.12, -0.48, 0.18], ["Z"]];

// Thunderbird (pueblos originarios de Norteamérica): ave de alas abiertas, geométrica (simétrica).
const TBIRD_WING = [["M", 0.12, -0.3], ["L", 0.5, -0.55], ["L", 1.0, -0.5], ["L", 0.88, -0.32], ["L", 0.95, -0.2], ["L", 0.78, -0.08], ["L", 0.82, 0.05], ["L", 0.55, 0.0], ["L", 0.12, 0.08], ["Z"]];
const TBIRD_BODY = [["M", 0, -0.75], ["L", 0.14, -0.6], ["L", 0.18, -0.25], ["L", 0.14, 0.35], ["L", 0.32, 0.7], ["L", 0, 0.58], ["L", -0.32, 0.7], ["L", -0.14, 0.35],
  ["L", -0.18, -0.25], ["L", -0.14, -0.6], ["Z"]];
const TBIRD_BEAK = [["M", -0.05, -0.68], ["L", 0, -0.92], ["L", 0.05, -0.68], ["Z"]];

// Jackalope (Wyoming): liebre sentada de perfil con astas de ciervo ramificadas.
const JACK2 = [["M", -0.78, 0.6], ["C", -0.85, 0.3, -0.72, 0.0, -0.45, -0.15], ["C", -0.2, -0.28, 0.05, -0.3, 0.2, -0.32], ["C", 0.28, -0.46, 0.42, -0.52, 0.56, -0.5],
  ["C", 0.68, -0.48, 0.78, -0.4, 0.82, -0.3], ["C", 0.78, -0.24, 0.7, -0.2, 0.6, -0.2], ["C", 0.48, -0.18, 0.4, -0.1, 0.38, 0.05], ["C", 0.36, 0.3, 0.42, 0.6, 0.44, 0.86],
  ["L", 0.6, 0.95], ["L", 0.28, 0.95], ["C", 0.2, 0.8, 0.12, 0.7, 0.05, 0.66], ["C", -0.05, 0.85, -0.2, 0.95, -0.35, 0.95], ["L", -0.66, 0.95], ["C", -0.72, 0.85, -0.78, 0.72, -0.78, 0.6], ["Z"]];
const JACK2_HAUNCH = ell(-0.42, 0.42, 0.32, 0.4);
const JACK2_EAR = [["M", 0.32, -0.42], ["C", 0.14, -0.62, 0.0, -0.82, -0.04, -0.92], ["C", 0.08, -0.9, 0.3, -0.72, 0.44, -0.48], ["Z"]];
const JACK2_ANTLERS = [
  taper([[0.48, -0.5], [0.5, -0.68], [0.44, -0.84], [0.36, -0.98]], 0.026, 0.012),
  taper([[0.49, -0.66], [0.6, -0.78], [0.62, -0.94]], 0.02, 0.01),
  taper([[0.45, -0.8], [0.3, -0.86], [0.24, -0.96]], 0.018, 0.01),
  taper([[0.56, -0.48], [0.68, -0.62], [0.78, -0.72], [0.9, -0.86]], 0.024, 0.012),
  taper([[0.72, -0.66], [0.84, -0.64], [0.96, -0.7]], 0.018, 0.01),
];
// Pie Grande de pie (tres cuartos, mira a la izquierda): cabeza en cono
// sobre hombros altos, brazos colgando largos, piernas cortas y gruesas.
const BF3 = smoothPoly([[-0.12, -0.98], [0.06, -0.96], [0.16, -0.86], [0.22, -0.74], [0.42, -0.66], [0.52, -0.5], [0.56, -0.2], [0.52, 0.1], [0.5, 0.36], [0.46, 0.62],
  [0.5, 0.86], [0.56, 0.97], [0.16, 0.97], [0.16, 0.7], [0.06, 0.56], [-0.06, 0.7], [-0.04, 0.97], [-0.44, 0.97], [-0.38, 0.84], [-0.4, 0.6], [-0.44, 0.34],
  [-0.48, 0.0], [-0.48, -0.36], [-0.42, -0.6], [-0.3, -0.7], [-0.26, -0.8], [-0.22, -0.92]]);
const BF3_ARM_FRONT = smoothPoly([[-0.38, -0.56], [-0.56, -0.36], [-0.66, -0.04], [-0.7, 0.3], [-0.68, 0.46], [-0.58, 0.5], [-0.52, 0.36], [-0.5, 0.04], [-0.4, -0.26]]);
const BF3_ARM_BACK = smoothPoly([[0.42, -0.58], [0.6, -0.34], [0.66, 0.0], [0.68, 0.3], [0.62, 0.42], [0.54, 0.36], [0.54, 0.06], [0.46, -0.24]]);
const BF3_FACE = smoothPoly([[-0.2, -0.86], [-0.06, -0.86], [-0.02, -0.76], [-0.06, -0.64], [-0.16, -0.6], [-0.24, -0.68], [-0.25, -0.78]]);

// Alien gris: cabeza grande, ojos almendrados, cuerpo delgado (simétrico).
const ALIEN_HEAD = [["M", 0, -0.98], ["C", 0.42, -0.98, 0.52, -0.66, 0.42, -0.42], ["C", 0.32, -0.2, 0.12, -0.12, 0, -0.12], ["C", -0.12, -0.12, -0.32, -0.2, -0.42, -0.42],
  ["C", -0.52, -0.66, -0.42, -0.98, 0, -0.98], ["Z"]];
const ALIEN_BODY = smoothPoly([[0, -0.14], [0.08, -0.1], [0.18, 0.0], [0.2, 0.3], [0.16, 0.5], [0.18, 0.95], [0.08, 0.95], [0.04, 0.56], [-0.04, 0.56], [-0.08, 0.95],
  [-0.18, 0.95], [-0.16, 0.5], [-0.2, 0.3], [-0.18, 0.0], [-0.08, -0.1]]);
const ALIEN_ARMS = [1, -1].map((m) => taper([[0.17 * m, 0.0], [0.32 * m, 0.22], [0.4 * m, 0.48], [0.44 * m, 0.6]], 0.035, 0.022));
const ALIEN_EYES = [1, -1].map((m) => xform(ell(0, 0, 0.15, 0.08), 0.17 * m, -0.5, -0.45 * m));

// Serpiente marina enroscada en S, con cresta dorsal.
const SERPENT = (() => {
  const pts = [];
  for (let i = 0; i <= 70; i++) { const t = i / 70, a = t * Math.PI * 3.2; pts.push([0.55 * Math.sin(a) * (0.6 + 0.4 * t), -0.85 + t * 1.7]); }
  return { body: taper(pts.reverse(), 0.035, 0.15), spine: pts };
})();
const SERPENT_HEAD = [["M", -0.06, 0.82], ["C", 0.1, 0.72, 0.38, 0.74, 0.52, 0.84], ["L", 0.62, 0.9], ["L", 0.5, 0.94], ["C", 0.34, 1.0, 0.08, 0.98, -0.06, 0.94], ["Z"]];
const SERPENT_FINS = [0.15, 0.3, 0.45, 0.6].map((t) => { const i = Math.round(t * 70), [x, y] = SERPENT.spine[i], [x2, y2] = SERPENT.spine[i + 2], a = Math.atan2(y2 - y, x2 - x);
  return xform([["M", -0.08, 0], ["L", 0, -0.14], ["L", 0.08, 0], ["Z"]], x, y, a + Math.PI); });

// Wendigo: figura alta y flaca con cráneo de ciervo y astas (simétrico).
const WENDI = smoothPoly([[0, -0.62], [0.1, -0.6], [0.14, -0.5], [0.12, -0.4], [0.3, -0.34], [0.34, -0.1], [0.28, 0.1], [0.2, 0.3], [0.18, 0.62], [0.22, 0.95],
  [0.1, 0.95], [0.06, 0.62], [0.02, 0.36], [-0.02, 0.36], [-0.06, 0.62], [-0.1, 0.95], [-0.22, 0.95], [-0.18, 0.62], [-0.2, 0.3], [-0.28, 0.1], [-0.34, -0.1],
  [-0.3, -0.34], [-0.12, -0.4], [-0.14, -0.5], [-0.1, -0.6]]);
const WENDI_ARMS = [1, -1].map((m) => taper([[0.3 * m, -0.3], [0.44 * m, -0.05], [0.5 * m, 0.25], [0.52 * m, 0.45], [0.56 * m, 0.55]], 0.05, 0.02));
const WENDI_ANTLERS = [1, -1].flatMap((m) => [taper([[0.06 * m, -0.6], [0.16 * m, -0.78], [0.3 * m, -0.9], [0.48 * m, -0.96]], 0.028, 0.012),
  taper([[0.2 * m, -0.84], [0.22 * m, -0.98]], 0.018, 0.008), taper([[0.34 * m, -0.92], [0.42 * m, -1.04]], 0.016, 0.008), taper([[0.12 * m, -0.72], [0.26 * m, -0.7]], 0.016, 0.008)]);

// Monstruo de Flatwoods: capucha en pica, cara redonda, falda plisada (simétrico).
const FLATWOODS_HOOD = [["M", 0, -0.98], ["C", 0.12, -0.8, 0.4, -0.66, 0.42, -0.36], ["C", 0.42, -0.2, 0.3, -0.12, 0.2, -0.14], ["L", -0.2, -0.14], ["C", -0.3, -0.12, -0.42, -0.2, -0.42, -0.36],
  ["C", -0.4, -0.66, -0.12, -0.8, 0, -0.98], ["Z"]];
const FLATWOODS_SKIRT = [["M", -0.24, -0.16], ["L", 0.24, -0.16], ["C", 0.42, 0.2, 0.55, 0.6, 0.62, 0.95], ["L", -0.62, 0.95], ["C", -0.55, 0.6, -0.42, 0.2, -0.24, -0.16], ["Z"]];
const FLATWOODS_FACE = ell(0, -0.4, 0.15, 0.13);

/* ---- Dinosaurios v2: contorno continuo y suave ---- */
// Terópodo de perfil (mira a la derecha): cola curva que se afila, pecho
// hondo, pierna con muslo, rodilla, tobillo y pie con dedos. `head`: puntos
// del cráneo entre la nuca y la garganta.
// La pierna va bajo la cadera (no bajo el pecho): el cuerpo se equilibra sobre ella.
// Las patas son piezas aparte (muslo, rodilla, espinilla, tobillo y pie): dentro
// del contorno del cuerpo el suavizado las convertía en palos.
// Postura horizontal (como en las reconstrucciones modernas): la cabeza baja
// al nivel de la espalda y la cola equilibra el cuerpo sobre la pierna.
// Cola larga (un tercio del animal) que se afila desde la cadera; lomo
// arqueado; pecho hondo y vientre que sube antes de la cadera.
const theropod2 = (head, { neck = [[0.3, -0.33], [0.4, -0.38], [0.46, -0.48]] } = {}) => smoothPoly([
  [-1.02, -0.13], [-0.8, -0.18], [-0.55, -0.26], [-0.28, -0.34], [-0.02, -0.38], [0.16, -0.36], ...neck, ...head.map(([x, y]) => [x, y + 0.16]),
  [0.6, -0.22], [0.58, -0.08], [0.48, 0.08], [0.32, 0.17], [0.14, 0.16], [-0.06, 0.1], [-0.3, 0.04], [-0.56, -0.02], [-0.82, -0.08]]);
// Zigzag del terópodo: muslo hacia adelante hasta la rodilla, espinilla hacia
// atrás hasta el tobillo (talón alto) y metatarso hacia adelante hasta los dedos.
const LEG_SHAPE = [[0.12, -0.1], [0.24, 0.06], [0.25, 0.26], [0.19, 0.41], [0.09, 0.55], [0.05, 0.7], [0.1, 0.85], [0.2, 0.92], [0.31, 0.97],
  [0.0, 0.97], [-0.06, 0.92], [-0.08, 0.84], [-0.06, 0.72], [-0.02, 0.58], [0.03, 0.47], [-0.07, 0.36], [-0.18, 0.22], [-0.2, 0.02]];
// Pata en tres piezas (como en la ilustración de referencia del usuario):
// muslo grande y redondo sobre el cuerpo, pierna recta casi vertical con un
// leve quiebre en el tobillo, y pie corto con garra. Muslo y pierna son piezas
// separadas: cada una se colorea por su lado.
const legPieces = (dx, k = 1) => {
  const T = (pts) => pts.map(([x, y]) => [dx + x * k, y]);
  return {
    // Muslo «de pollo»: ancho arriba, se afina hacia la rodilla (atrás y abajo).
    thigh: smoothPoly(T([[-0.02, -0.22], [0.14, -0.18], [0.24, -0.04], [0.24, 0.12], [0.16, 0.28], [0.06, 0.42], [-0.04, 0.46], [-0.1, 0.4], [-0.14, 0.22], [-0.17, 0.02], [-0.12, -0.14]])),
    // Espinilla: del bajo del muslo hacia delante y abajo, ~media anchura del muslo.
    shin: polyCmds(T([[-0.06, 0.36], [0.07, 0.36], [0.12, 0.62], [0.16, 0.86], [0.02, 0.86], [-0.02, 0.62], [-0.08, 0.4]])),
    foot: smoothPoly(T([[-0.02, 0.84], [0.18, 0.84], [0.3, 0.89], [0.35, 0.97], [-0.06, 0.97], [-0.06, 0.9]])),
  };
};
const LEG_N = legPieces(0.04), LEG_F = legPieces(-0.3, 0.94);
const NEAR_LEG2 = LEG_N.thigh, FAR_LEG2 = LEG_F.thigh;
const LEG_LOWER_N = [LEG_N.shin, LEG_N.foot], LEG_LOWER_F = [LEG_F.shin, LEG_F.foot];
// Brazo con mano de dos dedos.
const ARM2 = smoothPoly([[0.44, -0.08], [0.5, 0.0], [0.56, 0.06], [0.62, 0.12], [0.68, 0.14], [0.72, 0.11], [0.71, 0.17], [0.64, 0.18], [0.58, 0.14], [0.52, 0.1], [0.46, 0.04]]);
const HEADS = {
  // Cráneo profundo con mandíbula marcada (sin zigzag: el suavizado lo hacía bulto).
  trex: [[0.5, -0.78], [0.7, -0.84], [0.86, -0.8], [0.96, -0.7], [0.98, -0.56], [0.92, -0.46], [0.76, -0.42], [0.64, -0.36], [0.52, -0.4]],
  allo: [[0.57, -0.72], [0.65, -0.79], [0.72, -0.72], [0.94, -0.64], [0.98, -0.56], [0.86, -0.52], [0.95, -0.46], [0.88, -0.4], [0.68, -0.38]],
  raptor: [[0.62, -0.69], [0.82, -0.66], [0.97, -0.6], [0.97, -0.55], [0.78, -0.5], [0.66, -0.44]],
  spino: [[0.62, -0.7], [0.82, -0.66], [1.0, -0.6], [1.0, -0.55], [0.8, -0.52], [0.66, -0.47]],
  para: [[0.62, -0.72], [0.8, -0.68], [0.98, -0.63], [0.98, -0.55], [0.8, -0.52], [0.66, -0.46]],
  pachy: [[0.52, -0.78], [0.66, -0.88], [0.82, -0.82], [0.9, -0.7], [0.96, -0.6], [0.88, -0.52], [0.68, -0.46]],
  iguano: [[0.62, -0.73], [0.8, -0.71], [0.97, -0.61], [0.96, -0.52], [0.8, -0.5], [0.66, -0.44]],
};
const TREX2 = theropod2(HEADS.trex), ALLO2 = theropod2(HEADS.allo), RAPTOR2 = theropod2(HEADS.raptor), SPINO2 = theropod2(HEADS.spino),
  PARA2 = theropod2(HEADS.para), PACHY2 = theropod2(HEADS.pachy), IGUANO2 = theropod2(HEADS.iguano);
// Vela irregular: joroba que nace en el lomo y baja hacia la cola, con espinas.
const SPINO2_SAIL = polyCmds((() => { const pts = []; for (let k = 0; k <= 30; k++) { const t = k / 30, x = -0.48 + t * 0.82, h = 0.52 * Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 + 0.06 * Math.cos(t * 40)); pts.push([x, -0.3 - (x + 0.48) * 0.08 - h]); }
  return [...pts, [0.34, -0.36], [0.0, -0.36], [-0.3, -0.33], [-0.48, -0.27]]; })());
const PARA2_CREST = taper([[0.6, -0.54], [0.48, -0.68], [0.3, -0.76], [0.14, -0.76]], 0.05, 0.035);
// Plumas grandes en la cola y el antebrazo, y la garra en hoz del pie.
const RAPTOR2_FEATHERS = [[-0.95, -0.12, 0.7], [-0.8, -0.17, 0.85], [-0.64, -0.22, 1.0], [-0.48, -0.28, 0.9]].map(([x, y, k]) =>
  smoothPoly([[x - 0.06 * k, y + 0.02], [x - 0.04 * k, y - 0.1 * k], [x + 0.02 * k, y - 0.17 * k], [x + 0.07 * k, y - 0.08 * k], [x + 0.06 * k, y + 0.02]]));
const RAPTOR2_ARMFEATHERS = smoothPoly([[0.46, -0.02], [0.56, 0.08], [0.64, 0.16], [0.6, 0.22], [0.5, 0.18], [0.42, 0.06]]);
const RAPTOR2_CLAW = smoothPoly([[0.12, 0.88], [0.2, 0.8], [0.28, 0.79], [0.22, 0.84], [0.18, 0.9]]);
const TREX2_TEETH = [0.84, 0.89].map((x) => [["M", x - 0.015, -0.355], ["L", x, -0.315], ["L", x + 0.015, -0.36]]);

// Cuadrúpedos: patas columnares de pie redondeado.
const STEGO2 = smoothPoly([[-1.0, 0.12], [-0.72, 0.0], [-0.42, -0.18], [-0.08, -0.3], [0.25, -0.22], [0.5, -0.02], [0.68, 0.08], [0.86, 0.12], [0.95, 0.18],
  [0.9, 0.25], [0.74, 0.27], [0.6, 0.24], [0.52, 0.32], [0.5, 0.6], [0.52, 0.86], [0.55, 0.94], [0.32, 0.94], [0.33, 0.62], [0.2, 0.44], [-0.15, 0.46],
  [-0.18, 0.62], [-0.16, 0.88], [-0.12, 0.94], [-0.44, 0.94], [-0.42, 0.6], [-0.46, 0.36], [-0.7, 0.22], [-0.9, 0.17]]);
const stegoSpine = (x) => -0.3 + 0.95 * (x + 0.08) * (x + 0.08);
// Dos filas intercaladas: la exterior más alta, la interior más baja (detrás).
const plateShape = (x, h, w) => { const y = stegoSpine(x) + 0.04; return smoothPoly([[x - w, y], [x - w * 0.75, y - h * 0.55], [x - w * 0.2, y - h * 0.95], [x, y - h], [x + w * 0.2, y - h * 0.95], [x + w * 0.75, y - h * 0.55], [x + w, y]]); };
const STEGO2_PLATES = [[-0.66, 0.16, 0.07], [-0.48, 0.24, 0.09], [-0.28, 0.3, 0.1], [-0.06, 0.32, 0.11], [0.16, 0.28, 0.1], [0.36, 0.2, 0.08],
  [-0.57, 0.14, 0.06], [-0.38, 0.2, 0.07], [-0.17, 0.24, 0.08], [0.05, 0.24, 0.08], [0.26, 0.18, 0.07]].map(([x, h, w]) => plateShape(x, h, w));
// «Thagomizer»: cuatro púas gruesas en la punta de la cola.
const STEGO2_SPIKES = [[-0.94, 0.12, -1.1], [-0.88, 0.08, -0.75], [-0.94, 0.2, -2.0], [-0.86, 0.18, -2.35]].map(([u, v, r]) => xform([["M", -0.05, 0.02], ["Q", -0.02, -0.1, 0, -0.22], ["Q", 0.02, -0.1, 0.05, 0.02], ["Z"]], u, v, r));

const TRIKE2 = smoothPoly([[-1.0, 0.18], [-0.72, 0.02], [-0.4, -0.14], [-0.05, -0.2], [0.3, -0.14], [0.5, 0.02], [0.58, 0.2], [0.5, 0.36], [0.48, 0.62], [0.5, 0.88],
  [0.53, 0.94], [0.3, 0.94], [0.3, 0.6], [0.16, 0.46], [-0.18, 0.48], [-0.2, 0.62], [-0.18, 0.88], [-0.14, 0.94], [-0.46, 0.94], [-0.44, 0.62], [-0.48, 0.38],
  [-0.72, 0.26], [-0.9, 0.22]]);
// Gola con borde festoneado (polyCmds: el suavizado borraría las ondas).
// Gola: escudo grande detrás de la cabeza, inclinado hacia atrás, con festón.
const TRIKE2_FRILL = (() => {
  const cx = 0.5, cy = -0.18, R = 0.36, pts = [];
  for (let k = 0; k <= 72; k++) { const t = k / 72, a = Math.PI * 0.45 + t * Math.PI * 1.45, r = R * (0.96 + 0.06 * Math.cos(t * 9 * 2 * Math.PI)); pts.push([cx + Math.cos(a) * r * 0.85, cy + Math.sin(a) * r * 1.15]); }
  return polyCmds([...pts, [0.62, 0.12]]);
})();
const TRIKE2_HEAD = smoothPoly([[0.56, -0.06], [0.72, -0.1], [0.88, 0.02], [0.99, 0.2], [0.94, 0.28], [0.82, 0.3], [0.66, 0.3], [0.54, 0.18]]);
const TRIKE2_HORNS = [taper([[0.7, -0.08], [0.82, -0.24], [0.94, -0.42]], 0.05, 0.006), taper([[0.64, -0.06], [0.72, -0.24], [0.8, -0.4]], 0.045, 0.006),
  taper([[0.92, 0.1], [0.95, -0.02]], 0.028, 0.006)];

const BRACHIO2 = smoothPoly([[-1.0, 0.35], [-0.7, 0.18], [-0.4, -0.02], [-0.1, -0.14], [0.22, -0.22], [0.33, -0.48], [0.42, -0.78], [0.52, -0.93], [0.7, -0.94],
  [0.8, -0.88], [0.72, -0.82], [0.58, -0.76], [0.52, -0.5], [0.48, -0.18], [0.46, 0.08], [0.48, 0.42], [0.48, 0.88], [0.52, 0.94], [0.3, 0.94], [0.3, 0.42],
  [0.14, 0.3], [-0.14, 0.32], [-0.15, 0.56], [-0.14, 0.88], [-0.1, 0.94], [-0.4, 0.94], [-0.4, 0.56], [-0.46, 0.36], [-0.72, 0.32], [-0.9, 0.36]]);
const DIPLO2 = smoothPoly([[-1.0, 0.1], [-0.7, 0.02], [-0.42, -0.1], [-0.15, -0.18], [0.15, -0.2], [0.42, -0.3], [0.68, -0.44], [0.86, -0.5], [0.98, -0.46],
  [0.94, -0.4], [0.8, -0.36], [0.6, -0.22], [0.4, -0.02], [0.38, 0.2], [0.38, 0.5], [0.4, 0.56], [0.24, 0.56], [0.24, 0.24], [0.1, 0.16], [-0.18, 0.16],
  [-0.2, 0.26], [-0.2, 0.5], [-0.17, 0.56], [-0.38, 0.56], [-0.38, 0.24], [-0.44, 0.1], [-0.7, 0.1], [-0.88, 0.12]]);
const ANKY2 = smoothPoly([[-0.82, 0.22], [-0.6, 0.12], [-0.45, -0.1], [-0.15, -0.24], [0.2, -0.24], [0.48, -0.12], [0.66, 0.02], [0.82, 0.04], [0.96, 0.12],
  [0.95, 0.22], [0.8, 0.28], [0.62, 0.28], [0.6, 0.48], [0.62, 0.56], [0.44, 0.56], [0.44, 0.34], [0.2, 0.36], [-0.2, 0.36], [-0.26, 0.5], [-0.24, 0.56],
  [-0.44, 0.56], [-0.44, 0.34], [-0.6, 0.3], [-0.78, 0.28]]);
const ANKY2_CLUB = smoothPoly([[-1.0, 0.25], [-0.92, 0.16], [-0.8, 0.18], [-0.78, 0.26], [-0.84, 0.33], [-0.96, 0.33]]);
const hexScute = (cx, cy, r) => polyCmds(Array.from({ length: 6 }, (_, k) => { const a = (k / 6) * TAU + Math.PI / 6; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6]; }));
const ANKY2_SCUTES = [[-0.32, -0.08], [-0.08, -0.14], [0.16, -0.14], [0.38, -0.06], [-0.2, 0.08], [0.04, 0.04], [0.28, 0.06]].map(([x, y]) => hexScute(x, y, 0.09));
const DIMETRO2 = smoothPoly([[-1.0, 0.3], [-0.7, 0.2], [-0.42, 0.08], [-0.1, 0.04], [0.3, 0.04], [0.58, 0.08], [0.78, 0.1], [0.96, 0.18], [0.94, 0.26], [0.76, 0.3],
  [0.58, 0.3], [0.56, 0.36], [0.66, 0.5], [0.7, 0.58], [0.52, 0.58], [0.42, 0.42], [0.2, 0.38], [-0.16, 0.38], [-0.2, 0.44], [-0.1, 0.52], [-0.08, 0.58],
  [-0.3, 0.58], [-0.38, 0.4], [-0.6, 0.34], [-0.85, 0.32]]);
const DIMETRO2_SAIL = smoothPoly([[-0.42, 0.08], [-0.36, -0.3], [-0.16, -0.56], [0.1, -0.6], [0.3, -0.38], [0.36, 0.06]]);

const FIGURES = {
  owl: {
    parts: [{ cmds: OWL_BODY, strings: { angle: 0, a: [3, 4], b: [1, 2] } }],
    front: [{ cmds: OWL_WING, mirror: true, tangle: "detail" }],
    deco: () => [
      ...eyeDeco(0.3, -0.42, 0.25), ...eyeDeco(-0.3, -0.42, 0.25),
      { cmds: [["M", -0.09, -0.2], ["L", 0.09, -0.2], ["L", 0, 0.04], ["Z"]], fill: W },
      ...[-0.24, -0.12, 0.12, 0.24].map((u) => ({ cmds: ell(u, 0.95, 0.05, 0.07), fill: W })),
    ],
    silhouette: [OWL_BODY, OWL_WING, xform(OWL_WING, 0, 0, 0, -1, 1)],
    branch: 0.98,
  },
  cat: {
    parts: [{ cmds: CAT_BODY, strings: { angle: 0, a: [3, 4], b: [1, 2] } }],
    back: [{ cmds: CAT_TAIL, tangle: "detail" }],
    front: [{ cmds: CAT_FACE, tangle: null }],
    deco: () => {
      const eye = (m) => [["M", 0.06 * m, -0.27], ["Q", 0.17 * m, -0.38, 0.28 * m, -0.27], ["Q", 0.17 * m, -0.16, 0.06 * m, -0.27], ["Z"]];
      const out = [{ cmds: eye(1), fill: W }, { cmds: eye(-1), fill: W }, { cmds: ell(0.17, -0.27, 0.035, 0.07), fill: W }, { cmds: ell(-0.17, -0.27, 0.035, 0.07), fill: W }];
      out.push({ cmds: [["M", -0.06, -0.15], ["L", 0.06, -0.15], ["L", 0, -0.09], ["Z"]], fill: W });
      out.push({ cmds: [["M", 0, -0.09], ["L", 0, -0.05], ["M", -0.12, -0.03], ["Q", -0.06, 0.02, 0, -0.05], ["Q", 0.06, 0.02, 0.12, -0.03]], fill: "none" });
      const wh = [];
      for (const m of [1, -1]) for (const [v0, v1] of [[-0.12, -0.18], [-0.09, -0.08], [-0.06, 0.02]]) wh.push(["M", 0.14 * m, v0], ["L", 0.36 * m, v1]);
      out.push({ cmds: wh, fill: "none" });
      for (const m of [1, -1]) out.push({ cmds: [["M", 0.27 * m, -0.52], ["L", 0.36 * m, -0.78], ["L", 0.4 * m, -0.47], ["Z"]], fill: W });
      return out;
    },
    silhouette: [CAT_BODY, CAT_TAIL],
  },
  fish: {
    rot: -0.38,
    parts: [{ cmds: FISH_BODY, strings: { angle: Math.PI / 2, a: [2, 3], b: [1, 2], bShape: "chevron" } },
      { cmds: FISH_TAIL, strings: { angle: 0, a: [2, 2], b: [0, 0] } }],
    back: [{ cmds: FISH_DORSAL, tangle: "detail" }, { cmds: FISH_VENTRAL, tangle: "detail" }],
    deco: () => [
      ...eyeDeco(0.5, -0.08, 0.1, 9),
      { cmds: [["M", 0.3, -0.3], ["Q", 0.18, 0, 0.3, 0.3]], fill: "none" },
      ...FISH_BUBBLES.map((cmds) => ({ cmds, fill: W })),
    ],
    // Las burbujas entran en la silueta: así el encaje las deja dentro del marco.
    silhouette: [FISH_BODY, FISH_TAIL, FISH_DORSAL, FISH_VENTRAL, ...FISH_BUBBLES],
  },
  butterfly: {
    mirror: true,
    parts: [{ cmds: BF_UP, strings: { angle: -0.5, a: [2, 3], b: [1, 1] } }, { cmds: BF_LOW, strings: { angle: 0.6, a: [2, 2], b: [1, 1] } }],
    deco: () => [...eyeDeco(0.66, -0.5, 0.13, 10), ...eyeDeco(0.46, 0.52, 0.09, 8)],
    center: () => [
      { cmds: BF_BODY, fill: W }, { cmds: ell(0, -0.48, 0.09), fill: W },
      ...[-0.25, -0.05, 0.15, 0.35].map((v) => ({ cmds: [["M", -0.06, v], ["Q", 0, v + 0.05, 0.06, v]], fill: "none" })),
      ...[1, -1].map((m) => ({ cmds: [["M", 0.03 * m, -0.56], ["Q", 0.12 * m, -0.85, 0.3 * m, -0.92]], fill: "none" })),
      ...[1, -1].map((m) => ({ cmds: ell(0.32 * m, -0.93, 0.035), fill: W })),
    ],
    silhouette: [BF_UP, BF_LOW, xform(BF_UP, 0, 0, 0, -1, 1), xform(BF_LOW, 0, 0, 0, -1, 1), BF_BODY],
  },
  heart: {
    parts: [{ cmds: HEART, strings: { angle: 0.5, a: [3, 4], b: [2, 2] } }],
    front: [{ cmds: xform(HEART, 0, -0.08, 0, 0.3), tangle: "any" }],
    silhouette: [HEART],
  },
  turtle: {
    parts: [{ cmds: TURTLE_SHELL, strings: { angle: 0, a: [3, 3], b: [2, 2], bShape: "chevron" } }],
    back: [
      { cmds: TURTLE_HEAD, tangle: null },
      { cmds: xform(FLIPPER, 0.45, -0.42, -0.5, 1.15), tangle: "detail" }, { cmds: xform(FLIPPER, -0.45, -0.42, Math.PI + 0.5, 1.15, -1.15), tangle: "detail" },
      { cmds: xform(FLIPPER, 0.42, 0.55, 0.55, 0.95), tangle: "detail" }, { cmds: xform(FLIPPER, -0.42, 0.55, Math.PI - 0.55, 0.95, -0.95), tangle: "detail" },
      { cmds: [["M", -0.07, 0.72], ["L", 0, 0.95], ["L", 0.07, 0.72], ["Z"]], tangle: null },
    ],
    deco: () => [{ cmds: ell(0.07, -0.86, 0.025), fill: W }, { cmds: ell(-0.07, -0.86, 0.025), fill: W }],
    rim: true,
    silhouette: [TURTLE_SHELL, TURTLE_HEAD, xform(FLIPPER, 0.45, -0.42, -0.5, 1.15), xform(FLIPPER, -0.45, -0.42, Math.PI + 0.5, 1.15, -1.15),
      xform(FLIPPER, 0.42, 0.55, 0.55, 0.95), xform(FLIPPER, -0.42, 0.55, Math.PI - 0.55, 0.95, -0.95)],
  },
  flower: {
    build: (rng) => {
      const n = rInt(rng, 7, 9), a0 = rFloat(rng, 0, TAU);
      const big = [], small = [];
      for (let k = 0; k < n; k++) {
        const a = a0 + (k / n) * TAU;
        big.push({ cmds: xform(PETAL, 0, 0, a, 0.62 + 0.38 * (n / 9) * 0.6 + 0.15, 1.0), strings: { angle: a + Math.PI / 2, a: [1, 2], b: [0, 1], bShape: "chevron" } });
        small.push({ cmds: xform(PETAL, 0, 0, a + Math.PI / n, 0.5, 0.78), tangle: "detail" });
      }
      return { parts: big, back: small };
    },
    front: [{ cmds: ell(0, 0, 0.22), tangle: "round" }],
    deco: () => [{ cmds: ell(0, 0, 0.09), fill: W }],
    silhouetteFromParts: true,
  },
  leaf: {
    rot: -0.32,
    // Nervio central (familia A) y venas en V que suben hacia la punta (B).
    parts: [{ cmds: LEAF, strings: { angle: Math.PI / 2, a: [1, 1], b: [4, 5], bShape: "chevron", bSign: -1, aAmp: 0.05 } }],
    stem: true,
    silhouette: [LEAF],
  },
  elephant: {
    parts: [{ cmds: ELE_BODY, strings: { angle: 0.15, a: [3, 4], b: [2, 3] } }],
    front: [{ cmds: ELE_EAR, tangle: "any" }],
    deco: () => [
      ...eyeDeco(0.6, -0.3, 0.065, 8),
      ...[0.31, 0.44, -0.52, -0.38].map((u) => ({ cmds: [["M", u - 0.05, 0.9], ["Q", u, 0.82, u + 0.05, 0.9]], fill: "none" })),
    ],
    silhouette: [ELE_BODY],
    branch: 0.86,
  },
  snail: {
    parts: [{ cmds: ell(...SNAIL_SHELL[0]), strings: { angle: 0.8, a: [2, 3], b: [1, 2] } }],
    back: [{ cmds: SNAIL_BODY, tangle: "detail" }],
    front: [
      { cmds: ell(...SNAIL_SHELL[1]), tangle: "any" },
      { cmds: ell(...SNAIL_SHELL[2]), tangle: "round" },
      { cmds: ell(...SNAIL_SHELL[3]), tangle: null },
    ],
    deco: () => [
      { cmds: [["M", 0.8, -0.18], ["Q", 0.74, -0.36, 0.74, -0.5], ["M", 0.92, -0.17], ["Q", 0.96, -0.34, 1.0, -0.47]], fill: "none" },
      { cmds: ell(0.74, -0.53, 0.04), fill: W }, { cmds: ell(1.0, -0.5, 0.04), fill: W },
      { cmds: [["M", 0.86, 0.06], ["Q", 0.91, 0.1, 0.96, 0.05]], fill: "none" },
    ],
    silhouette: [ell(...SNAIL_SHELL[0]), SNAIL_BODY, ell(0.74, -0.53, 0.05), ell(1.0, -0.5, 0.05)],
    branch: 0.66,
  },
  bird: {
    parts: [{ cmds: BIRD_BODY, strings: { angle: 0.35, a: [2, 3], b: [1, 2] } }],
    back: [{ cmds: BIRD_TAIL, tangle: "detail" }],
    front: [{ cmds: BIRD_WING, tangle: "any" }],
    deco: () => [
      { cmds: BIRD_BEAK, fill: W }, ...eyeDeco(0.64, -0.32, 0.08, 8),
      ...[0.02, 0.2].map((u) => ({ cmds: [["M", u, 0.78], ["L", u, 0.9], ["M", u - 0.05, 0.9], ["L", u + 0.06, 0.9]], fill: "none" })),
    ],
    silhouette: [BIRD_BODY, BIRD_TAIL, BIRD_BEAK],
    branch: 0.86,
  },
  whale: {
    parts: [{ cmds: WHALE_BODY, strings: { angle: 0, a: [3, 4], b: [2, 3] } }],
    back: [{ cmds: WHALE_FLUKE, tangle: "detail" }, { cmds: WHALE_SPOUT, tangle: null }],
    front: [{ cmds: WHALE_FIN, tangle: "detail" }],
    deco: () => [
      ...eyeDeco(0.62, 0.0, 0.065, 8),
      { cmds: [["M", 0.95, 0.12], ["C", 0.82, 0.18, 0.66, 0.18, 0.55, 0.12]], fill: "none" },
    ],
    silhouette: [WHALE_BODY, WHALE_FLUKE, WHALE_FIN, WHALE_SPOUT],
  },
  dragonfly: {
    mirror: true,
    parts: [{ cmds: DF_UP, strings: { angle: -0.15, a: [1, 2], b: [2, 3] } }, { cmds: DF_LOW, strings: { angle: 0.15, a: [1, 2], b: [2, 3] } }],
    center: () => [
      { cmds: DF_TAIL, fill: W }, { cmds: ell(0, -0.3, 0.075, 0.13), fill: W }, { cmds: ell(0, -0.53, 0.11, 0.09), fill: W },
      ...[-0.05, 0.12, 0.29, 0.46, 0.63, 0.8].map((v) => ({ cmds: [["M", -0.045, v], ["Q", 0, v + 0.03, 0.045, v]], fill: "none" })),
      ...[1, -1].map((m) => ({ cmds: ell(0.06 * m, -0.56, 0.04), fill: W })),
    ],
    silhouette: [DF_UP, DF_LOW, xform(DF_UP, 0, 0, 0, -1, 1), xform(DF_LOW, 0, 0, 0, -1, 1), DF_TAIL, ell(0, -0.53, 0.11, 0.09)],
  },
  mushroom: {
    parts: [{ cmds: MUSH_STEM, strings: { angle: Math.PI / 2, a: [1, 1], b: [1, 2] } }, { cmds: MUSH_CAP, strings: { angle: 0, a: [2, 3], b: [2, 3] } }],
    back: [{ cmds: MUSH_SMALL_STEM, tangle: null }, { cmds: MUSH_SMALL, tangle: "detail" }],
    front: [{ cmds: ell(-0.48, -0.5, 0.13), tangle: null }, { cmds: ell(0.3, -0.66, 0.11), tangle: "round" }, { cmds: ell(0.66, -0.28, 0.08), tangle: null }],
    deco: () => [{ cmds: [["M", -0.62, 0.9], ["L", -0.58, 0.78], ["L", -0.54, 0.9], ["M", 0.5, 0.92], ["L", 0.54, 0.8], ["L", 0.58, 0.92]], fill: "none" }],
    silhouette: [MUSH_CAP, MUSH_STEM, MUSH_SMALL, MUSH_SMALL_STEM],
    branch: 0.88,
  },
  tree: {
    parts: [{ cmds: TREE_TRUNK, strings: { angle: Math.PI / 2, a: [1, 1], b: [2, 3], bShape: "chevron", bSign: -1 } },
      { cmds: TREE_CROWN, strings: { angle: 0.4, a: [3, 4], b: [2, 3] } }],
    front: [{ cmds: ell(-0.38, -0.12, 0.08), tangle: null }, { cmds: ell(0.42, -0.42, 0.08), tangle: null }, { cmds: ell(0.12, 0.08, 0.07), tangle: null }],
    silhouette: [TREE_CROWN, TREE_TRUNK],
    branch: 0.9,
  },
  moon: {
    parts: [{ cmds: MOON, strings: { angle: 0.9, a: [3, 4], b: [1, 2] } }],
    front: [{ cmds: MOON_STARS[0], tangle: "detail" }, { cmds: MOON_STARS[1], tangle: null }, { cmds: MOON_STARS[2], tangle: null }],
    silhouette: [MOON, ...MOON_STARS],
  },
  bear: {
    parts: [{ cmds: BEAR_BODY, strings: { angle: 0.3, a: [2, 3], b: [1, 2] } }, { cmds: BEAR_HEAD, strings: { angle: -0.2, a: [1, 2], b: [1, 1] } }],
    back: [...BEAR_EARS.map((cmds) => ({ cmds, tangle: "detail" })), ...BEAR_ARMS.map((cmds) => ({ cmds, tangle: "detail" }))],
    front: [{ cmds: ell(0, -0.3, 0.18, 0.13), tangle: null }, { cmds: ell(0, 0.46, 0.32, 0.3), tangle: "round" }, ...BEAR_FEET.map((cmds) => ({ cmds, tangle: null }))],
    deco: () => [
      ...[1, -1].map((m) => ({ cmds: ell(0.17 * m, -0.52, 0.045, 0.055), fill: W })),
      { cmds: ell(0, -0.36, 0.06, 0.04), fill: W },
      { cmds: [["M", 0, -0.32], ["L", 0, -0.25], ["M", -0.08, -0.22], ["Q", -0.04, -0.18, 0, -0.25], ["Q", 0.04, -0.18, 0.08, -0.22]], fill: "none" },
      ...[1, -1].map((m) => ({ cmds: ell(0.32 * m, -0.78, 0.07), fill: "none" })),
    ],
    silhouette: [BEAR_BODY, BEAR_HEAD, ...BEAR_EARS, ...BEAR_ARMS, ...BEAR_FEET],
  },
  rabbit: {
    parts: [{ cmds: RAB_BODY, strings: { angle: 0.4, a: [2, 3], b: [1, 2] } }, { cmds: RAB_HEAD, strings: { angle: 0, a: [1, 2], b: [1, 1] } }],
    back: RAB_EARS.map((cmds) => ({ cmds, tangle: "detail" })),
    front: [{ cmds: ell(0, 0.0, 0.17, 0.11), tangle: null }, ...RAB_FEET.map((cmds) => ({ cmds, tangle: null }))],
    deco: () => [
      ...[1, -1].map((m) => ({ cmds: ell(0.16 * m, -0.18, 0.05, 0.06), fill: W })),
      { cmds: [["M", -0.04, -0.06], ["L", 0.04, -0.06], ["L", 0, -0.01], ["Z"]], fill: W },
      { cmds: [["M", 0, -0.01], ["L", 0, 0.04], ["M", -0.07, 0.06], ["Q", -0.03, 0.09, 0, 0.04], ["Q", 0.03, 0.09, 0.07, 0.06]], fill: "none" },
      ...[1, -1].map((m) => ({ cmds: xform(ell(0, 0, 0.05, 0.26), 0.18 * m, -0.74, 0.14 * m), fill: "none" })),
    ],
    silhouette: [RAB_BODY, RAB_HEAD, ...RAB_EARS, ...RAB_FEET],
  },
  penguin: {
    parts: [{ cmds: PENG_BODY, strings: { angle: 0.2, a: [2, 3], b: [2, 3] } }],
    back: PENG_WINGS.map((cmds) => ({ cmds, tangle: "detail" })),
    front: [{ cmds: PENG_BELLY, tangle: "round" }, ...PENG_FEET.map((cmds) => ({ cmds, tangle: null }))],
    deco: () => [
      ...[1, -1].map((m) => ({ cmds: ell(0.13 * m, -0.68, 0.06, 0.07), fill: W })),
      { cmds: [["M", -0.1, -0.56], ["L", 0.1, -0.56], ["L", 0, -0.42], ["Z"]], fill: W },
    ],
    silhouette: [PENG_BODY, ...PENG_WINGS, ...PENG_FEET],
  },
  fox: {
    parts: [{ cmds: FOX_BODY, strings: { angle: 0.5, a: [2, 3], b: [1, 2] } }, { cmds: FOX_HEAD, strings: { angle: Math.PI / 2, a: [1, 2], b: [1, 1], bShape: "chevron" } }],
    back: [{ cmds: FOX_TAIL, tangle: "detail" }],
    front: [{ cmds: FOX_BIB, tangle: "round" }],
    deco: () => [
      ...[1, -1].map((m) => ({ cmds: [["M", 0.12 * m, -0.3], ["Q", 0.2 * m, -0.38, 0.28 * m, -0.3], ["Q", 0.2 * m, -0.24, 0.12 * m, -0.3], ["Z"]], fill: W })),
      { cmds: ell(0, 0.02, 0.06, 0.045), fill: W },
      ...[1, -1].map((m) => ({ cmds: [["M", 0.5 * m, -0.74], ["L", 0.47 * m, -0.46], ["L", 0.32 * m, -0.5], ["Z"]], fill: "none" })),
    ],
    silhouette: [FOX_BODY, FOX_HEAD, FOX_TAIL],
  },
  koi: {
    rot: 0.12,
    parts: [{ cmds: KOI_BODY, strings: { angle: 0.6, a: [2, 3], b: [3, 4], bShape: "chevron" } }],
    back: [{ cmds: KOI_TAIL, tangle: "detail" }, { cmds: KOI_FIN_R, tangle: "detail" }, { cmds: KOI_FIN_L, tangle: "detail" }],
    deco: () => [{ cmds: ell(0.46, -0.74, 0.04), fill: W }, { cmds: [["M", 0.5, -0.9], ["Q", 0.62, -0.96, 0.7, -1.02], ["M", 0.36, -0.9], ["Q", 0.3, -0.98, 0.22, -1.02]], fill: "none" }],
    silhouette: [KOI_BODY, KOI_TAIL, KOI_FIN_R, KOI_FIN_L],
    adult: true, hide: true,
  },
  hummingbird: {
    parts: [{ cmds: HUM_BODY, strings: { angle: 0.75, a: [1, 2], b: [2, 3] } }, { cmds: HUM_WING, strings: { angle: -0.6, a: [1, 1], b: [4, 5], bShape: "chevron", bSign: 1 } }],
    back: [{ cmds: HUM_WING2, tangle: "detail" }, { cmds: HUM_TAIL, tangle: "detail" }, { cmds: HUM_BEAK, tangle: null }],
    deco: () => [{ cmds: ell(-0.42, -0.5, 0.035), fill: W }],
    silhouette: [HUM_BODY, HUM_WING, HUM_WING2, HUM_TAIL, HUM_BEAK],
    adult: true, hide: true,
  },
  feather: {
    rot: -0.42,
    parts: [{ cmds: FEATHER, strings: { angle: Math.PI / 2, a: [1, 1], b: [5, 6], bShape: "chevron", bSign: -1, aAmp: 0.04 } }],
    back: [{ cmds: FEATHER_QUILL, tangle: null }],
    silhouette: [FEATHER, FEATHER_QUILL],
    adult: true, hide: true,
  },
  nautilus: {
    rot: 0.4,
    parts: [...NAUT.outerCh, ...NAUT.innerCh].map((cmds, k) => ({ cmds, strings: { angle: k * 0.7, a: [1, 1], b: [0, 1] } })),
    front: [{ cmds: NAUT.core, tangle: null }],
    silhouette: [NAUT.shell],
    adult: true,
  },
  lunamoth: {
    mirror: true,
    parts: [{ cmds: MOTH_UP, strings: { angle: -0.4, a: [2, 3], b: [1, 2] } }, { cmds: MOTH_LOW, strings: { angle: 1.1, a: [1, 2], b: [2, 3] } }],
    deco: () => [...eyeDeco(0.56, -0.38, 0.1, 10), ...eyeDeco(0.38, 0.28, 0.08, 8)],
    center: () => [
      { cmds: MOTH_BODY, fill: W }, { cmds: ell(0, -0.32, 0.08), fill: W },
      ...[-0.1, 0.06, 0.22, 0.38].map((v) => ({ cmds: [["M", -0.05, v], ["Q", 0, v + 0.04, 0.05, v]], fill: "none" })),
      ...[1, -1].map((m) => ({ cmds: xform(ell(0, 0, 0.05, 0.2), 0.16 * m, -0.56, 0.5 * m), fill: W })),
    ],
    silhouette: [MOTH_UP, MOTH_LOW, xform(MOTH_UP, 0, 0, 0, -1, 1), xform(MOTH_LOW, 0, 0, 0, -1, 1), MOTH_BODY],
    adult: true,
  },
  hamsa: {
    mirror: true,
    parts: [{ cmds: HAMSA, strings: { angle: 0.2, a: [3, 4], b: [1, 2] } }],
    center: () => [...eyeDeco(0, 0.22, 0.2, 14)],
    silhouette: [HAMSA, xform(HAMSA, 0, 0, 0, -1, 1)],
    adult: true,
  },
  vase: {
    mirror: true,
    parts: [{ cmds: VASE, strings: { angle: 0, a: [4, 5], b: [0, 1] } }],
    back: [{ cmds: VASE_HANDLE, mirror: false, tangle: null }],
    silhouette: [VASE, xform(VASE, 0, 0, 0, -1, 1), VASE_HANDLE, xform(VASE_HANDLE, 0, 0, 0, -1, 1)],
    branch: 0.94,
    adult: true, hide: true,
  },
  lotus: {
    build: () => {
      const big = [-1.05, -0.52, 0, 0.52, 1.05].map((a) => ({ cmds: xform(PETAL, 0, 0.62, a, 0.78 - Math.abs(a) * 0.08, 1.42 - Math.abs(a) * 0.22), strings: { angle: a + Math.PI / 2, a: [1, 2], b: [1, 2], bShape: "chevron" } }));
      const small = [-0.78, -0.26, 0.26, 0.78].map((a) => ({ cmds: xform(PETAL, 0, 0.62, a, 0.6, 1.12), tangle: "detail" }));
      return { parts: [big[0], big[4], big[1], big[3], big[2]], back: small };
    },
    silhouetteFromParts: true,
    adult: true,
  },
  ribbons: {
    parts: RIBBONS.map((cmds, k) => ({ cmds, strings: { angle: [0.9, -0.9, 0.3][k], a: [1, 1], b: [5, 7] } })),
    silhouette: RIBBONS,
    abstract: true,
  },
  drops: {
    parts: DROPS.map((cmds, k) => ({ cmds, strings: { angle: [0.3, 1.2, -0.4][k], a: [2, 3], b: [1, 2] } })),
    front: [{ cmds: xform(DROP, -0.2, 0.32, -0.35, 0.22), tangle: "round" }],
    silhouette: DROPS,
    abstract: true, hide: true,
  },
  orbs: {
    parts: ORBS.map((cmds, k) => ({ cmds, strings: { angle: k * 0.9, a: [1, 3], b: [1, 2] } })),
    silhouette: ORBS,
    abstract: true,
  },
  crystals: {
    parts: GEMS.map(([u, v, r, k]) => ({ cmds: xform(GEM, u, v, r, k * 1.2, k * 1.55), strings: { angle: Math.PI / 2 + r, a: [1, 2], b: [2, 3], bShape: "chevron" } })),
    front: GEMS.map(([u, v, r, k]) => ({ cmds: xform(GEM_TABLE, u, v, r, k * 1.2, k * 1.55), tangle: "any" })),
    silhouette: GEMS.map(([u, v, r, k]) => xform(GEM, u, v, r, k * 1.2, k * 1.55)),
    abstract: true, hide: true,
  },
  neuron: {
    parts: [{ cmds: NEURON.soma, strings: { angle: 0.4, a: [1, 2], b: [1, 1] } }],
    back: [...NEURON.dends.map((cmds) => ({ cmds, tangle: null })), { cmds: NEURON.axon, tangle: null }, ...NEURON.terms.map((cmds) => ({ cmds, tangle: null }))],
    front: [...NEURON.sheaths.map((cmds) => ({ cmds, tangle: "detail" })), ...NEURON.buttons.map((cmds) => ({ cmds, tangle: null })), { cmds: ell(-0.6, 0, 0.12), tangle: "round" }],
    deco: () => [{ cmds: ell(-0.6, 0, 0.04), fill: W }],
    silhouette: [NEURON.soma, ...NEURON.dends, NEURON.axon, ...NEURON.sheaths, ...NEURON.terms, ...NEURON.buttons],
    science: "bio", hide: true,
  },
  brain: {
    parts: [{ cmds: BRAIN, strings: { angle: 0.7, a: [4, 5], b: [3, 4] } }],
    back: [{ cmds: BRAINSTEM, tangle: null }, { cmds: CEREBELLUM, tangle: "detail" }],
    front: [{ cmds: BRAIN_TEMPORAL, tangle: "any" }],
    silhouette: [BRAIN, BRAIN_TEMPORAL, CEREBELLUM, BRAINSTEM],
    science: "bio", hide: true,
  },
  dna: {
    parts: [{ cmds: DNA.a, strings: { angle: Math.PI / 2, a: [1, 1], b: [9, 11] } }, { cmds: DNA.b, strings: { angle: Math.PI / 2, a: [1, 1], b: [9, 11] } }],
    back: DNA.rungs.map((cmds) => ({ cmds, tangle: null })),
    silhouette: [DNA.a, DNA.b, ...DNA.rungs],
    science: "bio", hide: true,
  },
  plantcell: {
    parts: [{ cmds: PCELL_WALL, strings: { angle: 0.5, a: [2, 3], b: [2, 3] } }],
    front: [{ cmds: PCELL_IN, tangle: "round" }, { cmds: PCELL_VAC, tangle: "any" }, { cmds: PCELL_NUC, tangle: "any" }, { cmds: ell(-0.48, -0.42, 0.07), tangle: null },
      ...PCELL_CHL.map((cmds) => ({ cmds, tangle: "detail" }))],
    silhouette: [PCELL_WALL],
    science: "bio",
  },
  animalcell: {
    parts: [{ cmds: ACELL, strings: { angle: 0.3, a: [2, 3], b: [2, 3] } }],
    front: [{ cmds: ACELL_IN, tangle: "round" }, { cmds: ACELL_NUC, tangle: "any" }, { cmds: ell(-0.02, -0.08, 0.09), tangle: null },
      ...ACELL_MITO.map((cmds) => ({ cmds, tangle: "detail" })), ...ACELL_GOLGI.map((cmds) => ({ cmds, tangle: null })), ...ACELL_VES.map((cmds) => ({ cmds, tangle: null }))],
    silhouette: [ACELL],
    science: "bio", hide: true,
  },
  mitochondrion: {
    rot: -0.35,
    parts: [{ cmds: MITO, strings: { angle: 0.2, a: [1, 1], b: [3, 4] } }],
    front: [{ cmds: CRISTAE, tangle: "any" }],
    silhouette: [MITO],
    science: "bio", hide: true,
  },
  virus: {
    parts: [...VIRUS_FACES.map((cmds, k) => ({ cmds, strings: { angle: k * 1.1, a: [1, 2], b: [1, 1] } })), ...VIRUS_FACES.map((cmds, k) => ({ cmds: xform(cmds, 0, 0, 0, -1, 1), strings: { angle: -k * 1.1, a: [1, 2], b: [1, 1] } }))],
    back: [{ cmds: VIRUS_TAIL, tangle: "detail" }, ...VIRUS_LEGS.map((cmds) => ({ cmds, tangle: null }))],
    silhouette: [VIRUS_HEAD, VIRUS_TAIL, ...VIRUS_LEGS],
    science: "bio", hide: true,
  },
  chromosome: {
    parts: CHROMO.map((cmds, k) => ({ cmds, strings: { angle: k ? -0.95 : 0.95, a: [1, 1], b: [6, 8] } })),
    front: [{ cmds: ell(0, -0.07, 0.1, 0.08), tangle: null }],
    silhouette: CHROMO,
    science: "bio", hide: true,
  },
  trex: {
    parts: [{ cmds: TREX2, strings: { angle: Math.PI / 2 + 0.2, a: [1, 2], b: [4, 5] } }],
    back: [...LEG_LOWER_F.map((cmds) => ({ cmds, tangle: null })), { cmds: FAR_LEG2, tangle: "round" }],
    front: [...LEG_LOWER_N.map((cmds) => ({ cmds, tangle: null, halo: false })), { cmds: NEAR_LEG2, tangle: "round", halo: false }, { cmds: ARM2, tangle: null }],
    deco: () => [{ cmds: ell(0.74, -0.56, 0.03), fill: W }, { cmds: [["M", 0.78, -0.36], ["Q", 0.86, -0.34, 0.94, -0.4]], fill: "none" }, ...TREX2_TEETH.map((cmds) => ({ cmds, fill: "none" }))],
    silhouette: [TREX2, FAR_LEG2, NEAR_LEG2, ...LEG_LOWER_N, ...LEG_LOWER_F], branch: 0.9,
    science: "dino", hide: true,
  },
  spinosaurus: {
    parts: [{ cmds: SPINO2, strings: { angle: Math.PI / 2 + 0.2, a: [1, 2], b: [4, 5] } }],
    back: [{ cmds: SPINO2_SAIL, tangle: "any" }, ...LEG_LOWER_F.map((cmds) => ({ cmds, tangle: null })), { cmds: FAR_LEG2, tangle: "round" }],
    front: [...LEG_LOWER_N.map((cmds) => ({ cmds, tangle: null, halo: false })), { cmds: NEAR_LEG2, tangle: "round", halo: false }, { cmds: ARM2, tangle: null }],
    deco: () => [{ cmds: ell(0.72, -0.46, 0.028), fill: W }],
    silhouette: [SPINO2, FAR_LEG2, NEAR_LEG2, ...LEG_LOWER_N, ...LEG_LOWER_F, SPINO2_SAIL], branch: 0.9,
    science: "dino",
  },
  parasaurolophus: {
    parts: [{ cmds: PARA2, strings: { angle: Math.PI / 2 + 0.2, a: [1, 2], b: [4, 5] } }],
    back: [{ cmds: PARA2_CREST, tangle: null }, ...LEG_LOWER_F.map((cmds) => ({ cmds, tangle: null })), { cmds: FAR_LEG2, tangle: "round" }],
    front: [...LEG_LOWER_N.map((cmds) => ({ cmds, tangle: null, halo: false })), { cmds: NEAR_LEG2, tangle: "round", halo: false }, { cmds: ARM2, tangle: null }],
    deco: () => [{ cmds: ell(0.72, -0.47, 0.028), fill: W }],
    silhouette: [PARA2, FAR_LEG2, NEAR_LEG2, ...LEG_LOWER_N, ...LEG_LOWER_F, PARA2_CREST], branch: 0.9,
    science: "dino",
  },
  stegosaurus: {
    parts: [{ cmds: STEGO2, strings: { angle: 0.2, a: [2, 3], b: [2, 3] } }],
    back: [...STEGO2_PLATES.map((cmds) => ({ cmds, tangle: "round" })), ...STEGO2_SPIKES.map((cmds) => ({ cmds, tangle: null }))],
    deco: () => [{ cmds: ell(0.84, 0.17, 0.024), fill: W }],
    silhouette: [STEGO2, ...STEGO2_PLATES, ...STEGO2_SPIKES], branch: 0.9,
    science: "dino", hide: true,
  },
  triceratops: {
    parts: [{ cmds: TRIKE2, strings: { angle: 0.2, a: [3, 4], b: [3, 4] } }],
    front: [{ cmds: TRIKE2_FRILL, tangle: "round" }, { cmds: TRIKE2_HEAD, tangle: null }, ...TRIKE2_HORNS.map((cmds) => ({ cmds, tangle: null }))],
    deco: () => [{ cmds: ell(0.76, 0.06, 0.026), fill: W }],
    silhouette: [TRIKE2, TRIKE2_FRILL, TRIKE2_HEAD, ...TRIKE2_HORNS], branch: 0.9,
    science: "dino", hide: true,
  },
  brachiosaurus: {
    parts: [{ cmds: BRACHIO2, strings: { angle: 0.6, a: [3, 4], b: [3, 4] } }],
    deco: () => [{ cmds: ell(0.66, -0.89, 0.022), fill: W }],
    silhouette: [BRACHIO2], branch: 0.9,
    science: "dino", hide: true,
  },
  ankylosaurus: {
    parts: [{ cmds: ANKY2, strings: { angle: 0.1, a: [2, 3], b: [3, 4] } }],
    back: [{ cmds: ANKY2_CLUB, tangle: "round" }],
    front: ANKY2_SCUTES.map((cmds) => ({ cmds, tangle: null })),
    deco: () => [{ cmds: ell(0.86, 0.12, 0.022), fill: W }],
    silhouette: [ANKY2, ANKY2_CLUB], branch: 0.52,
    science: "dino",
  },
  pterosaur: {
    mirror: true,
    parts: [{ cmds: PTERO_WING, strings: { angle: -0.3, a: [2, 3], b: [2, 3] } }],
    center: () => [{ cmds: PTERO_BODY, fill: W }, { cmds: PTERO_HEAD, fill: W }, ...PTERO_LEGS.map((cmds) => ({ cmds, fill: W })), { cmds: ell(0, -0.32, 0.06), fill: W }],
    silhouette: [PTERO_WING, xform(PTERO_WING, 0, 0, 0, -1, 1), PTERO_BODY, PTERO_HEAD, ...PTERO_LEGS],
    science: "dino",
  },
  allosaurus: {
    parts: [{ cmds: ALLO2, strings: { angle: Math.PI / 2 + 0.2, a: [1, 2], b: [4, 5] } }],
    back: [...LEG_LOWER_F.map((cmds) => ({ cmds, tangle: null })), { cmds: FAR_LEG2, tangle: "round" }],
    front: [...LEG_LOWER_N.map((cmds) => ({ cmds, tangle: null, halo: false })), { cmds: NEAR_LEG2, tangle: "round", halo: false }, { cmds: ARM2, tangle: null }],
    deco: () => [{ cmds: ell(0.74, -0.48, 0.028), fill: W }],
    silhouette: [ALLO2, FAR_LEG2, NEAR_LEG2, ...LEG_LOWER_N, ...LEG_LOWER_F], branch: 0.9,
    science: "dino", hide: true,
  },
  velociraptor: {
    parts: [{ cmds: RAPTOR2, strings: { angle: Math.PI / 2 + 0.2, a: [1, 2], b: [4, 5] } }],
    back: [...RAPTOR2_FEATHERS.map((cmds) => ({ cmds, tangle: null })), ...LEG_LOWER_F.map((cmds) => ({ cmds, tangle: null })), { cmds: FAR_LEG2, tangle: "round" }],
    front: [...LEG_LOWER_N.map((cmds) => ({ cmds, tangle: null, halo: false })), { cmds: NEAR_LEG2, tangle: "round", halo: false }, { cmds: ARM2, tangle: null }, { cmds: RAPTOR2_ARMFEATHERS, tangle: null }, { cmds: RAPTOR2_CLAW, tangle: null, halo: false }],
    deco: () => [{ cmds: ell(0.72, -0.46, 0.028), fill: W }],
    silhouette: [RAPTOR2, FAR_LEG2, NEAR_LEG2, ...LEG_LOWER_N, ...LEG_LOWER_F, ...RAPTOR2_FEATHERS], branch: 0.9,
    science: "dino", hide: true,
  },
  pachycephalosaurus: {
    parts: [{ cmds: PACHY2, strings: { angle: Math.PI / 2 + 0.2, a: [1, 2], b: [4, 5] } }],
    back: [...LEG_LOWER_F.map((cmds) => ({ cmds, tangle: null })), { cmds: FAR_LEG2, tangle: "round" }],
    front: [...LEG_LOWER_N.map((cmds) => ({ cmds, tangle: null, halo: false })), { cmds: NEAR_LEG2, tangle: "round", halo: false }, { cmds: ARM2, tangle: null }],
    deco: () => [{ cmds: ell(0.8, -0.48, 0.028), fill: W }],
    silhouette: [PACHY2, FAR_LEG2, NEAR_LEG2, ...LEG_LOWER_N, ...LEG_LOWER_F], branch: 0.9,
    science: "dino",
  },
  iguanodon: {
    parts: [{ cmds: IGUANO2, strings: { angle: Math.PI / 2 + 0.2, a: [1, 2], b: [4, 5] } }],
    back: [...LEG_LOWER_F.map((cmds) => ({ cmds, tangle: null })), { cmds: FAR_LEG2, tangle: "round" }],
    front: [...LEG_LOWER_N.map((cmds) => ({ cmds, tangle: null, halo: false })), { cmds: NEAR_LEG2, tangle: "round", halo: false }, { cmds: ARM2, tangle: null }],
    deco: () => [{ cmds: ell(0.75, -0.48, 0.028), fill: W }],
    silhouette: [IGUANO2, FAR_LEG2, NEAR_LEG2, ...LEG_LOWER_N, ...LEG_LOWER_F], branch: 0.9,
    science: "dino",
  },
  diplodocus: {
    parts: [{ cmds: DIPLO2, strings: { angle: 0.1, a: [2, 3], b: [4, 5] } }],
    deco: () => [{ cmds: ell(0.9, -0.46, 0.02), fill: W }],
    silhouette: [DIPLO2], branch: 0.52,
    science: "dino", hide: true,
  },
  dimetrodon: {
    parts: [{ cmds: DIMETRO2_SAIL, strings: { angle: 0, a: [1, 1], b: [6, 7] } }, { cmds: DIMETRO2, strings: { angle: 0.2, a: [2, 3], b: [3, 4] } }],
    deco: () => [{ cmds: ell(0.84, 0.16, 0.022), fill: W }],
    silhouette: [DIMETRO2, DIMETRO2_SAIL], branch: 0.54,
    science: "dino", hide: true,
  },
  plesiosaur: {
    parts: [{ cmds: PLESIO, strings: { angle: 0.5, a: [2, 3], b: [3, 4] } }],
    back: [{ cmds: PLESIO_TAIL, tangle: "detail" }, ...PLESIO_FLIPS.map((cmds) => ({ cmds, tangle: "detail" }))],
    deco: () => [{ cmds: ell(0.9, -0.82, 0.02), fill: W }],
    silhouette: [PLESIO, PLESIO_TAIL, ...PLESIO_FLIPS],
    science: "dino", hide: true,
  },
  mosasaurus: {
    rot: -0.25,
    parts: [{ cmds: MOSA, strings: { angle: 0, a: [2, 2], b: [5, 6] } }],
    back: MOSA_FLIPS.map((cmds) => ({ cmds, tangle: "detail" })),
    deco: () => [{ cmds: ell(0.82, -0.06, 0.02), fill: W }, { cmds: [["M", 1.0, 0.0], ["L", 0.7, 0.03]], fill: "none" }],
    silhouette: [MOSA, ...MOSA_FLIPS],
    science: "dino",
  },
  ammonite: {
    rot: 0.3,
    parts: AMMO.ch.map((cmds, k) => ({ cmds, strings: { angle: k * 0.52, a: [1, 1], b: [0, 1] } })),
    front: [{ cmds: AMMO.core, tangle: null }],
    silhouette: [AMMO.shell],
    science: "dino",
  },
  bacterium: {
    parts: [{ cmds: BACT, strings: { angle: 0.3, a: [2, 3], b: [3, 4] } }],
    back: BACT_FLAG.map((cmds) => ({ cmds, tangle: null })),
    front: [{ cmds: BACT_DNA, tangle: null }],
    silhouette: [BACT, ...BACT_FLAG],
    science: "bio", hide: true,
  },
  jellyfish: {
    parts: [{ cmds: JELLY_BELL, strings: { angle: 0, a: [2, 3], b: [2, 3] } }],
    back: [...JELLY_TENT.map((cmds) => ({ cmds, tangle: null })), ...JELLY_ARMS.map((cmds) => ({ cmds, tangle: "detail" }))],
    silhouette: [JELLY_BELL, ...JELLY_TENT, ...JELLY_ARMS],
    science: "bio", hide: true,
  },
  heartorgan: {
    parts: [{ cmds: HEART_ORG, strings: { angle: 0.9, a: [2, 3], b: [2, 3] } }],
    back: [{ cmds: AORTA, tangle: "detail" }, ...VESSELS.map((cmds) => ({ cmds, tangle: null }))],
    silhouette: [HEART_ORG, AORTA, ...VESSELS],
    science: "bio", hide: true,
  },
  eyeball: {
    parts: [{ cmds: EYE_BALL, strings: { angle: Math.PI / 2, a: [3, 4], b: [1, 2] } }],
    back: [{ cmds: EYE_NERVE, tangle: "detail" }],
    front: [{ cmds: EYE_CORNEA, tangle: null }, { cmds: EYE_LENS, tangle: null }, { cmds: ell(-0.1, 0, 0.55), tangle: "any" }],
    silhouette: [EYE_BALL, EYE_CORNEA, EYE_NERVE],
    science: "bio",
  },
  diatom: {
    parts: [{ cmds: DIATOM, strings: { angle: 0, a: [4, 5], b: [4, 5] } }],
    front: [{ cmds: DIATOM_RINGS[0], tangle: "any" }, { cmds: DIATOM_RINGS[1], tangle: "round" }],
    silhouette: [DIATOM],
    science: "bio",
  },
  rose: {
    parts: ROSE.slice(0, 7).map((cmds, k) => ({ cmds, strings: { angle: k * 0.9, a: [1, 2], b: [1, 1] } })),
    back: ROSE_LEAVES.map((cmds) => ({ cmds, tangle: "detail" })),
    front: [...ROSE.slice(7, 13).map((cmds) => ({ cmds, tangle: "any" })), ...ROSE.slice(13).map((cmds) => ({ cmds, tangle: "round" }))],
    silhouette: [...ROSE, ...ROSE_LEAVES],
    adult: true,
  },
  succulent: {
    parts: [{ cmds: SUCC_POT, strings: { angle: 0, a: [1, 2], b: [2, 3] } }, ...SUCC.slice(0, 8).map((cmds, k) => ({ cmds, strings: { angle: k * 0.8, a: [1, 1], b: [1, 2], bShape: "chevron" } }))],
    front: [{ cmds: SUCC_RIM, tangle: "detail" }, ...SUCC.slice(8).map((cmds) => ({ cmds, tangle: "detail" }))],
    silhouette: [SUCC_POT, SUCC_RIM, ...SUCC],
    adult: true, hide: true,
  },
  seahorse: {
    parts: [{ cmds: SEAHORSE, strings: { angle: 0, a: [1, 2], b: [6, 8], bShape: "chevron" } }],
    back: [{ cmds: SEAHORSE_FIN, tangle: "detail" }],
    deco: () => [{ cmds: ell(0.3, -0.62, 0.04), fill: W }],
    silhouette: [SEAHORSE, SEAHORSE_FIN],
    adult: true, hide: true,
  },
  octopus: {
    parts: [{ cmds: OCTO_HEAD, strings: { angle: 0.3, a: [2, 3], b: [2, 3] } }],
    back: OCTO_ARMS.map((cmds) => ({ cmds, tangle: "detail" })),
    deco: () => [{ cmds: ell(-0.15, -0.3, 0.06), fill: W }, { cmds: ell(0.15, -0.3, 0.06), fill: W }],
    silhouette: [OCTO_HEAD, ...OCTO_ARMS],
    adult: true,
  },
  wolf: {
    parts: [{ cmds: WOLF, strings: { angle: 0.6, a: [3, 4], b: [2, 3] } }],
    back: [{ cmds: WOLF_TAIL, tangle: "detail" }],
    silhouette: [WOLF, WOLF_TAIL], branch: 0.96,
    adult: true, hide: true,
  },
  horse: {
    parts: [{ cmds: HORSE, strings: { angle: 0.9, a: [3, 4], b: [2, 3] } }],
    back: [{ cmds: HORSE_MANE, tangle: "detail" }],
    deco: () => [{ cmds: ell(0.42, -0.4, 0.04, 0.03), fill: W }, { cmds: ell(0.72, 0.1, 0.03), fill: W }],
    silhouette: [HORSE, HORSE_MANE],
    adult: true, hide: true,
  },
  peacock: {
    parts: PEACOCK_FAN.map((cmds, k) => ({ cmds, strings: { angle: Math.PI / 2 + (k - 4) * 0.3, a: [1, 1], b: [2, 3], bShape: "chevron", bSign: -1 } })),
    front: [{ cmds: xform(PEACOCK_BODY, 0, 0.35), tangle: "detail" }, ...PEACOCK_EYES.map(([x, y]) => ({ cmds: ell(x, y, 0.08, 0.1), tangle: null }))],
    silhouette: [...PEACOCK_FAN, xform(PEACOCK_BODY, 0, 0.35)],
    adult: true,
  },
  sittingcat: {
    parts: [{ cmds: SITCAT, strings: { angle: 0.5, a: [3, 4], b: [2, 3] } }],
    back: [{ cmds: SITCAT_TAIL, tangle: "detail" }],
    silhouette: [SITCAT, SITCAT_TAIL], branch: 0.96,
    adult: true, hide: true,
  },
  teapot: {
    parts: [{ cmds: TEAPOT, strings: { angle: 0.2, a: [3, 4], b: [2, 3] } }],
    back: [{ cmds: TEAPOT_SPOUT, tangle: "detail" }, { cmds: TEAPOT_HANDLE, tangle: null }],
    front: [{ cmds: TEAPOT_LID, tangle: "detail" }, { cmds: ell(0, -0.68, 0.07), tangle: null }, { cmds: TEAPOT_BASE, tangle: null }],
    silhouette: [TEAPOT, TEAPOT_LID, TEAPOT_SPOUT, TEAPOT_HANDLE, TEAPOT_BASE, ell(0, -0.68, 0.07)], branch: 0.72,
    adult: true, hide: true,
  },
  sun: {
    parts: [{ cmds: ell(0, 0, 0.5), strings: { angle: 0.4, a: [2, 3], b: [2, 3] } }],
    back: SUN_RAYS.map((cmds) => ({ cmds, tangle: "detail" })),
    front: [{ cmds: ell(0, 0, 0.18), tangle: "round" }],
    silhouette: [ell(0, 0, 0.5), ...SUN_RAYS],
    adult: true,
  },
  bigfoot: {
    parts: [{ cmds: BF3, strings: { angle: 1.3, a: [3, 4], b: [3, 4] } }],
    back: [{ cmds: BF3_ARM_BACK, tangle: "detail" }],
    front: [{ cmds: BF3_ARM_FRONT, tangle: "detail" }, { cmds: BF3_FACE, tangle: null }],
    deco: () => [{ cmds: [["M", -0.22, -0.8], ["L", -0.06, -0.8]], fill: "none" }, { cmds: ell(-0.17, -0.75, 0.018), fill: W }, { cmds: ell(-0.08, -0.75, 0.018), fill: W },
      { cmds: [["M", -0.18, -0.66], ["L", -0.08, -0.66]], fill: "none" }],
    silhouette: [BF3, BF3_ARM_FRONT, BF3_ARM_BACK], branch: 0.98,
    cryptid: true, hide: true,
  },
  greyalien: {
    mirror: true,
    parts: [{ cmds: [["M", 0, -0.98], ["C", 0.42, -0.98, 0.52, -0.66, 0.42, -0.42], ["C", 0.32, -0.2, 0.12, -0.12, 0, -0.12], ["Z"]], strings: { angle: 0.6, a: [2, 3], b: [1, 2] } },
      { cmds: polyCmds([[0, -0.13], [0.08, -0.1], [0.18, 0.0], [0.2, 0.3], [0.16, 0.5], [0.18, 0.95], [0.08, 0.95], [0.04, 0.56], [0, 0.56]]), strings: { angle: Math.PI / 2, a: [1, 1], b: [3, 4] } }],
    center: () => [...ALIEN_ARMS.map((cmds) => ({ cmds, fill: W })), ...ALIEN_EYES.map((cmds) => ({ cmds, fill: W })),
      { cmds: [["M", -0.04, -0.24], ["L", 0.04, -0.24]], fill: "none" }],
    silhouette: [ALIEN_HEAD, ALIEN_BODY, ...ALIEN_ARMS],
    cryptid: true, hide: true,
  },
  seaserpent: {
    parts: [{ cmds: SERPENT.body, strings: { angle: Math.PI / 2, a: [1, 1], b: [9, 11] } }],
    back: SERPENT_FINS.map((cmds) => ({ cmds, tangle: null })),
    front: [{ cmds: SERPENT_HEAD, tangle: "detail" }],
    deco: () => [{ cmds: ell(0.36, 0.82, 0.025), fill: W }],
    silhouette: [SERPENT.body, SERPENT_HEAD, ...SERPENT_FINS],
    cryptid: true,
  },
  wendigo: {
    parts: [{ cmds: WENDI, strings: { angle: Math.PI / 2, a: [2, 3], b: [3, 4] } }],
    back: [...WENDI_ARMS.map((cmds) => ({ cmds, tangle: null })), ...WENDI_ANTLERS.map((cmds) => ({ cmds, tangle: null }))],
    front: [{ cmds: smoothPoly([[0, -0.62], [0.09, -0.6], [0.11, -0.5], [0.05, -0.38], [-0.05, -0.38], [-0.11, -0.5], [-0.09, -0.6]]), tangle: null }],
    deco: () => [{ cmds: ell(-0.045, -0.52, 0.022), fill: W }, { cmds: ell(0.045, -0.52, 0.022), fill: W }],
    silhouette: [WENDI, ...WENDI_ARMS, ...WENDI_ANTLERS], branch: 0.96,
    cryptid: true,
  },
  flatwoods: {
    parts: [{ cmds: FLATWOODS_HOOD, strings: { angle: Math.PI / 2, a: [2, 2], b: [3, 4], bShape: "chevron" } }, { cmds: FLATWOODS_SKIRT, strings: { angle: Math.PI / 2, a: [1, 1], b: [5, 6] } }],
    front: [{ cmds: FLATWOODS_FACE, tangle: null }],
    deco: () => [{ cmds: ell(-0.06, -0.42, 0.03), fill: W }, { cmds: ell(0.06, -0.42, 0.03), fill: W }],
    silhouette: [FLATWOODS_HOOD, FLATWOODS_SKIRT],
    cryptid: true,
  },
  nessie: {
    parts: [{ cmds: NESSIE_NECK, strings: { angle: 0.4, a: [1, 1], b: [5, 6], bShape: "chevron" } }, ...NESSIE_HUMPS.map((cmds) => ({ cmds, strings: { angle: 0, a: [1, 1], b: [2, 3] } }))],
    front: NESSIE_WAVES.map((cmds) => ({ cmds, tangle: null })),
    deco: () => [{ cmds: ell(-0.04, -0.76, 0.02), fill: W }],
    silhouette: [NESSIE_NECK, ...NESSIE_HUMPS, ...NESSIE_WAVES],
    cryptid: true, hide: true,
  },
  mothman: {
    mirror: true,
    parts: [{ cmds: MOTH2_UP, strings: { angle: -0.5, a: [2, 3], b: [2, 3] } }, { cmds: MOTH2_LOW, strings: { angle: 0.9, a: [1, 2], b: [2, 3] } },
      { cmds: MOTH2_BODY, strings: { angle: Math.PI / 2, a: [1, 1], b: [5, 6] } }],
    back: [{ cmds: MOTH2_ANT, tangle: null }, ...MOTH2_FEATHERS.map((cmds) => ({ cmds, tangle: null }))],
    front: [{ cmds: ell(0.62, -0.5, 0.13), tangle: "round" }, { cmds: ell(0.42, 0.28, 0.09), tangle: null }],
    center: () => [...[1, -1].map((m) => ({ cmds: ell(0.055 * m, -0.5, 0.045, 0.035), fill: W }))],
    silhouette: [MOTH2_UP, MOTH2_LOW, MOTH2_BODY, MOTH2_ANT, xform(MOTH2_UP, 0, 0, 0, -1, 1), xform(MOTH2_LOW, 0, 0, 0, -1, 1), xform(MOTH2_BODY, 0, 0, 0, -1, 1), xform(MOTH2_ANT, 0, 0, 0, -1, 1)],
    cryptid: true,
  },
  chupacabra: {
    parts: [{ cmds: CHUPA, strings: { angle: 0.3, a: [2, 3], b: [3, 4] } }],
    back: CHUPA_SPIKES.map((cmds) => ({ cmds, tangle: null })),
    deco: () => [{ cmds: ell(0.8, -0.48, 0.035, 0.025), fill: W }],
    silhouette: [CHUPA, ...CHUPA_SPIKES], branch: 0.58,
    cryptid: true, hide: true,
  },
  kraken: {
    parts: KRAKEN_ARMS.map((cmds, k) => ({ cmds, strings: { angle: Math.PI / 2, a: [1, 1], b: [5, 7] } })),
    front: [...KRAKEN_SUCKERS.map((cmds) => ({ cmds, tangle: null })), { cmds: KRAKEN_SEA, tangle: "detail" }, { cmds: KRAKEN_SHIP, tangle: null }, { cmds: KRAKEN_SAIL, tangle: null }],
    deco: () => [{ cmds: [["M", 0, 0.0], ["L", 0, 0.42]], fill: "none" }],
    silhouette: [...KRAKEN_ARMS, KRAKEN_SEA],
    cryptid: true,
  },
  yeti: {
    parts: [{ cmds: YETI2, strings: { angle: 1.2, a: [3, 4], b: [3, 4] } }],
    front: [{ cmds: YETI2_FACE, tangle: null }, { cmds: YETI2_CHEST, tangle: "any" }],
    deco: () => [{ cmds: [["M", -0.12, -0.74], ["L", -0.03, -0.71], ["M", 0.12, -0.74], ["L", 0.03, -0.71], ["M", -0.06, -0.6], ["L", 0.06, -0.6]], fill: "none" },
      { cmds: ell(-0.065, -0.68, 0.02), fill: W }, { cmds: ell(0.065, -0.68, 0.02), fill: W }],
    silhouette: [YETI2], branch: 0.98,
    cryptid: true, hide: true,
  },
  ufo: {
    parts: [{ cmds: UFO_DISC, strings: { angle: 0, a: [1, 2], b: [4, 6] } }, { cmds: UFO_BEAM, strings: { angle: Math.PI / 2, a: [1, 1], b: [3, 4] } }],
    back: [{ cmds: UFO_DOME, tangle: "round" }],
    front: UFO_LIGHTS.map((cmds) => ({ cmds, tangle: null })),
    silhouette: [UFO_DISC, UFO_DOME, UFO_BEAM],
    cryptid: true, hide: true,
  },
  jerseydevil: {
    parts: [{ cmds: JDEVIL, strings: { angle: 0.3, a: [2, 3], b: [3, 4] } }],
    back: [{ cmds: JDEVIL_TAIL, tangle: null }],
    front: [{ cmds: JDEVIL_WING, tangle: "detail" }],
    deco: () => [{ cmds: ell(0.84, -0.52, 0.025), fill: W }],
    silhouette: [JDEVIL, JDEVIL_WING, JDEVIL_TAIL], branch: 0.62,
    cryptid: true,
  },
  thunderbird: {
    mirror: true,
    // El cuerpo va en dos mitades con tangle (antes quedaba un hueco liso).
    parts: [{ cmds: TBIRD_WING, strings: { angle: Math.PI / 2, a: [1, 2], b: [4, 5], bShape: "chevron" } },
      { cmds: polyCmds([[0, -0.75], [0.14, -0.6], [0.18, -0.25], [0.14, 0.35], [0.32, 0.7], [0, 0.58]]), strings: { angle: 0, a: [1, 1], b: [4, 5], bShape: "chevron" } }],
    center: () => [{ cmds: TBIRD_BEAK, fill: W }, ...[1, -1].map((m) => ({ cmds: ell(0.06 * m, -0.58, 0.025), fill: W }))],
    silhouette: [TBIRD_WING, xform(TBIRD_WING, 0, 0, 0, -1, 1), TBIRD_BODY, TBIRD_BEAK],
    cryptid: true, hide: true,
  },
  jackalope: {
    parts: [{ cmds: JACK2, strings: { angle: 0.6, a: [2, 3], b: [2, 3] } }],
    back: [{ cmds: JACK2_EAR, tangle: "detail" }, ...JACK2_ANTLERS.map((cmds) => ({ cmds, tangle: null }))],
    front: [{ cmds: JACK2_HAUNCH, tangle: "any" }],
    deco: () => [{ cmds: ell(0.62, -0.36, 0.03), fill: W }],
    silhouette: [JACK2, JACK2_EAR, ...JACK2_ANTLERS], branch: 0.96,
    cryptid: true, hide: true,
  },
};
export const FIGURE_IDS = Object.keys(FIGURES);
// Grupos: figuras para adultos (elegantes, sin caritas), composiciones
// abstractas y animales tiernos (libro infantil).
export const FIGURE_SETS = {
  adult: ["koi", "hummingbird", "feather", "nautilus", "lunamoth", "hamsa", "vase", "lotus", "butterfly", "dragonfly", "leaf", "flower", "moon", "heart",
    "rose", "succulent", "seahorse", "octopus", "wolf", "horse", "peacock", "sittingcat", "teapot", "sun"],
  abstract: ["ribbons", "drops", "orbs", "crystals"],
  kids: ["owl", "cat", "fish", "turtle", "elephant", "snail", "bird", "whale", "mushroom", "tree", "bear", "rabbit", "penguin", "fox"],
};
// Temas de ciencia: se leen de la etiqueta `science` de cada figura.
FIGURE_SETS.dino = FIGURE_IDS.filter((f) => FIGURES[f].science === "dino");
FIGURE_SETS.bio = FIGURE_IDS.filter((f) => FIGURES[f].science === "bio");
FIGURE_SETS.cryptids = FIGURE_IDS.filter((f) => FIGURES[f].cryptid);
export const ADULT_FIGURES = [...FIGURE_SETS.adult, ...FIGURE_SETS.abstract];
// Figuras que se reconocen como silueta pequeña (las figuritas escondidas).
// En los estilos para adultos, las figuritas escondidas también son adultas.
const HIDEABLE_ADULT = ["koi", "hummingbird", "feather", "vase", "drops", "crystals", "leaf", "moon", "heart", "succulent", "seahorse", "wolf", "horse", "sittingcat", "teapot"];
const HIDEABLE = ["cat", "fish", "heart", "bird", "whale", "rabbit", "bear", "penguin", "moon", "leaf", "turtle", "mushroom", "tree", "fox", "elephant"];

// Figura de la n-ésima página de figura de un libro: recorre todas las
// figuras (barajadas con la semilla del libro) antes de repetir ninguna, y
// nunca repite la misma en dos páginas de figura seguidas.
export function figureForPage(bookSeed, n, ids = FIGURE_IDS) {
  const order = (cycle) => {
    const rng = createRNG(hash(bookSeed >>> 0, 0xf00 + cycle));
    const a = [...ids];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const len = ids.length, cycle = Math.floor(n / len), cur = order(cycle);
  if (cycle > 0 && cur[0] === order(cycle - 1)[len - 1]) [cur[0], cur[1]] = [cur[1], cur[0]];
  return cur[n % len];
}

// Paleta de tangles de la n-ésima página de figura de un libro. Sin paleta,
// cada figura usaba casi los 15 tangles y todas las páginas se parecían; con
// 8 por página cada una tiene carácter propio. La ventana avanza 5 puestos
// por página: dos figuras seguidas comparten 3 tangles y en 3 páginas salen todos.
export const FIGURE_PALETTE_SIZE = 8;
export function figurePalette(bookSeed, n) {
  const rng = createRNG(hash(bookSeed >>> 0, 0x9a1e));
  const ids = POOL.map((t) => t.id);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const start = (n * 5) % ids.length;
  return Array.from({ length: FIGURE_PALETTE_SIZE }, (_, k) => ids[(start + k) % ids.length]);
}

/* ====================== Secciones con strings ====================== */

// Nº de cortes de una familia: con `level` (0 fácil … 1 difícil) se recorre
// el rango del string de menos a más cortes; sin él, al azar dentro del rango.
function cutCount(rng, [lo, hi], level) {
  if (!Number.isFinite(level)) return rInt(rng, lo, hi);
  rng(); // consume igual que rInt: no descuadra el resto de la página
  const min = lo > 0 ? Math.max(1, lo - 1) : 0;
  return Math.round(min + (hi + 1 - min) * Math.min(1, Math.max(0, level)));
}

function makeSections(rng, rings, spec, gap, level) {
  const bb = bboxOf(rings);
  const cx = (bb.x0 + bb.x1) / 2, cy = (bb.y0 + bb.y1) / 2;
  const th = spec.angle + rFloat(rng, -0.25, 0.25);
  const dx = Math.cos(th), dy = Math.sin(th), nx = -dy, ny = dx;
  const toL = (x, y) => ({ a: (x - cx) * dx + (y - cy) * dy, u: (x - cx) * nx + (y - cy) * ny });
  const toP = (a, u) => ({ x: cx + a * dx + u * nx, y: cy + a * dy + u * ny });
  let amin = Infinity, amax = -Infinity, umin = Infinity, umax = -Infinity;
  for (const p of rings) for (const q of p) { const l = toL(q.x, q.y); amin = Math.min(amin, l.a); amax = Math.max(amax, l.a); umin = Math.min(umin, l.u); umax = Math.max(umax, l.u); }
  const A = Math.max(1, amax - amin), U = Math.max(1, umax - umin);

  // Familia A: cortes a lo largo de u (curvas u = c + amp·w(a)).
  const nA = cutCount(rng, spec.a, level), nB = cutCount(rng, spec.b, level);
  const spA = U / (nA + 1), spB = A / (nB + 1);
  const wave = (L) => {
    const l1 = L * rFloat(rng, 0.8, 1.4), l2 = L * rFloat(rng, 0.4, 0.6), p1 = rFloat(rng, 0, TAU), p2 = rFloat(rng, 0, TAU);
    return (t) => 0.7 * Math.sin((t / l1) * TAU + p1) + 0.3 * Math.sin((t / l2) * TAU + p2);
  };
  const wA = wave(A);
  const ampA0 = spA * (spec.aAmp ?? rFloat(rng, 0.25, 0.4));
  const cutsA = Array.from({ length: nA }, (_, k) => ({ c: umin + (k + 1) * spA + rFloat(rng, -0.12, 0.12) * spA, amp: ampA0 + rFloat(rng, -0.08, 0.08) * spA }));
  // Familia B: a = e + amp·v(u); "chevron" = venas (forma de V suave).
  const chevron = spec.bShape === "chevron";
  const wB = wave(U);
  const vB = chevron ? (u) => Math.sqrt(u * u + (U * 0.05) ** 2) / (U / 2) : wB;
  const ampB0 = chevron ? spB * rFloat(rng, 0.7, 1.0) * (spec.bSign || (rng() < 0.5 ? 1 : -1)) : spB * rFloat(rng, 0.25, 0.4);
  const cutsB = Array.from({ length: nB }, (_, k) => ({ e: amin + (k + 1) * spB + rFloat(rng, -0.1, 0.1) * spB - (chevron ? ampB0 * 0.5 : 0), amp: ampB0 + rFloat(rng, -0.06, 0.06) * spB }));
  const curA = (k, a) => cutsA[k].c + cutsA[k].amp * wA(a);
  const curB = (m, u) => cutsB[m].e + cutsB[m].amp * vB(u);

  // Etiqueta de cada punto de muestra → área y bbox de cada sección.
  const step = Math.max(0.9, Math.min(2, Math.sqrt((bb.x1 - bb.x0) * (bb.y1 - bb.y0) / 9000)));
  const secs = new Map();
  for (let y = bb.y0 + step / 2; y < bb.y1; y += step) for (let x = bb.x0 + step / 2; x < bb.x1; x += step) {
    if (!inside(rings, x, y)) continue;
    const { a, u } = toL(x, y);
    let i = 0, j = 0;
    for (let k = 0; k < nA; k++) if (u > curA(k, a)) i++;
    for (let m = 0; m < nB; m++) if (a > curB(m, u)) j++;
    const key = i * 100 + j;
    let s = secs.get(key);
    if (!s) { s = { i, j, n: 0, x0: x, y0: y, x1: x, y1: y }; secs.set(key, s); }
    s.n++; s.x0 = Math.min(s.x0, x); s.y0 = Math.min(s.y0, y); s.x1 = Math.max(s.x1, x); s.y1 = Math.max(s.y1, y);
  }
  const pad = A + U;
  const stripA = (i) => {
    const lo = [], hi = [];
    for (let a = amin - 10; a <= amax + 10; a += 1.5) {
      lo.push(toP(a, i === 0 ? umin - pad : curA(i - 1, a)));
      hi.push(toP(a, i === nA ? umax + pad : curA(i, a)));
    }
    return [...lo, ...hi.reverse()];
  };
  const stripB = (j) => {
    const lo = [], hi = [];
    for (let u = umin - 10; u <= umax + 10; u += 1.5) {
      lo.push(toP(j === 0 ? amin - pad : curB(j - 1, u), u));
      hi.push(toP(j === nB ? amax + pad : curB(j, u), u));
    }
    return [...lo, ...hi.reverse()];
  };
  const lines = [];
  for (let k = 0; k < nA; k++) { const pts = []; for (let a = amin - 4; a <= amax + 4; a += 2) pts.push(toP(a, curA(k, a))); lines.push(pts); }
  for (let m = 0; m < nB; m++) { const pts = []; for (let u = umin - 4; u <= umax + 4; u += 2) pts.push(toP(curB(m, u), u)); lines.push(pts); }
  const list = [...secs.values()].map((s) => ({ ...s, area: s.n * step * step, x1: s.x1 + step / 2, y1: s.y1 + step / 2, x0: s.x0 - step / 2, y0: s.y0 - step / 2 }));
  // Sección (clave i*100+j) de un punto, o -1 si cae fuera de la región.
  const labelAt = (x, y) => {
    if (!inside(rings, x, y)) return -1;
    const { a, u } = toL(x, y);
    let i = 0, j = 0;
    for (let k = 0; k < nA; k++) if (u > curA(k, a)) i++;
    for (let m = 0; m < nB; m++) if (a > curB(m, u)) j++;
    return i * 100 + j;
  };
  return { sections: list, stripA, stripB, lines, nA, nB, labelAt };
}

/* ====================== Facetas (cubista / vitral) ====================== */

// Corta un polígono convexo por la recta que pasa por p con normal n.
function splitConvex(pts, p, n) {
  const side = (q) => (q.x - p.x) * n.x + (q.y - p.y) * n.y;
  const a = [], b = [];
  for (let i = 0; i < pts.length; i++) {
    const P = pts[i], Q = pts[(i + 1) % pts.length], dp = side(P), dq = side(Q);
    (dp >= 0 ? a : b).push(P);
    if ((dp >= 0) !== (dq >= 0)) {
      const t = dp / (dp - dq), X = { x: P.x + (Q.x - P.x) * t, y: P.y + (Q.y - P.y) * t };
      a.push(X); b.push(X);
    }
  }
  return [a, b];
}

// Parte la región (anillos `rings`) en facetas convexas con cortes rectos de
// ángulo libre, como un vitral o un retrato cubista. Cada corte pasa cerca del
// centro de la faceta más grande y solo se acepta si ninguna mitad queda por
// debajo de ~1/3 del área objetivo: así no salen astillas dentro de la figura.
function facetSections(rng, rings, targetArea) {
  const bb = bboxOf(rings);
  const step = Math.max(0.9, Math.min(2.2, Math.sqrt((bb.x1 - bb.x0) * (bb.y1 - bb.y0) / 9000)));
  const samples = [];
  for (let y = bb.y0 + step / 2; y < bb.y1; y += step) for (let x = bb.x0 + step / 2; x < bb.x1; x += step) if (inside(rings, x, y)) samples.push({ x, y });
  const pad = 4;
  const root = { pts: [{ x: bb.x0 - pad, y: bb.y0 - pad }, { x: bb.x1 + pad, y: bb.y0 - pad }, { x: bb.x1 + pad, y: bb.y1 + pad }, { x: bb.x0 - pad, y: bb.y1 + pad }], samples, done: false };
  const polys = [root], area = (q) => q.samples.length * step * step;
  for (let guard = 0; guard < 400; guard++) {
    let big = null;
    for (const q of polys) if (!q.done && (!big || area(q) > area(big))) big = q;
    if (!big || area(big) < targetArea * 1.6) break;
    let ok = false;
    for (let tries = 0; tries < 8 && !ok; tries++) {
      const c = big.samples[Math.floor(rng() * big.samples.length)];
      const mx = big.samples.reduce((acc, q) => acc + q.x, 0) / big.samples.length, my = big.samples.reduce((acc, q) => acc + q.y, 0) / big.samples.length;
      // Eje largo de la faceta (componente principal): el corte va casi
      // perpendicular a él, así las piezas salen compactas y no en agujas.
      let sxx = 0, syy = 0, sxy = 0;
      for (const q of big.samples) { const dx = q.x - mx, dy = q.y - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
      const axis = 0.5 * Math.atan2(2 * sxy, sxx - syy);
      const p = { x: (mx * 2 + c.x) / 3, y: (my * 2 + c.y) / 3 }, th = axis + rFloat(rng, -0.55, 0.55), n = { x: Math.cos(th), y: Math.sin(th) };
      const sa = [], sb = [];
      for (const q of big.samples) ((q.x - p.x) * n.x + (q.y - p.y) * n.y >= 0 ? sa : sb).push(q);
      if (Math.min(sa.length, sb.length) * step * step < targetArea * 0.35) continue;
      // Grosor mínimo de cada mitad, medido a lo largo de la normal del corte.
      const depth = (list) => list.reduce((m, q) => Math.max(m, Math.abs((q.x - p.x) * n.x + (q.y - p.y) * n.y)), 0);
      if (Math.min(depth(sa), depth(sb)) < Math.sqrt(targetArea) * 0.45) continue;
      const [A, B] = splitConvex(big.pts, p, n);
      polys.splice(polys.indexOf(big), 1, { pts: A, samples: sa, done: false }, { pts: B, samples: sb, done: false });
      ok = true;
    }
    if (!ok) big.done = true;
  }
  return polys.filter((q) => q.samples.length).map((q) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const v of q.samples) { x0 = Math.min(x0, v.x); y0 = Math.min(y0, v.y); x1 = Math.max(x1, v.x); y1 = Math.max(y1, v.y); }
    return { pts: q.pts, area: area(q), x0: x0 - step / 2, y0: y0 - step / 2, x1: x1 + step / 2, y1: y1 + step / 2 };
  });
}

/* ============================ Página ============================ */

export async function generateZenFigure(doc, opts) {
  const seed = opts.seed >>> 0;
  const rng = createRNG(hash(seed, 0xf16e));
  for (let w = 0; w < 10; w++) rng();
  const a = opts.areaMm;
  // Dificultad (0 fácil … 1 difícil): huecos más amplios y menos secciones al
  // principio del libro; más finos y numerosos al final.
  const level = Number.isFinite(opts.difficulty) ? Math.min(1, Math.max(0, opts.difficulty)) : null;
  const gap = Math.max(1.4, clampN(opts.minGapMm, 1, 5, 1.9) * (level === null ? 1 : 1.3 - 0.45 * level));
  // «Tu turno»: la figura queda con sus secciones vacías para dibujar los
  // tangles propios (el fondo, ligero).
  const empty = opts.emptySections === true;
  // figureStyle: "strings" (secciones curvas, por defecto), "facet" (cortes
  // rectos, cubista: facetas grandes, muchas lisas) o "glass" (vitral: piezas
  // pequeñas, todas lisas, con plomo grueso).
  const fStyle = ["facet", "glass"].includes(opts.figureStyle) ? opts.figureStyle : "strings";
  const facetPlain = fStyle === "glass" ? 1 : 0.3;
  // Relleno rico (bandas de eco, orbes) y figuras escondidas; richFill: false los apaga.
  const rich = !empty && opts.richFill !== false;
  const stroke = clampN(opts.patternStrokeMm, 0.15, 1.5, 0.35);
  const strStroke = clampN(opts.stringStrokeMm, 0.2, 2, 0.55);
  const outStroke = clampN(opts.cellBorderWidthMm, 0.3, 3, 1.0);
  const sketchy = clampN(opts.sketchy, 0, 2, 0.3);
  const prefix = `f_${(seed % 1000000).toString(16)}_`;
  const defs = [], body = [];
  let nid = 0;
  const id = (t) => `${prefix}${t}${nid++}`;

  // Figura: la pedida (figureName) o una por semilla.
  const ids = Array.isArray(opts.figures) && opts.figures.length ? opts.figures.filter((f) => FIGURES[f]) : FIGURE_IDS;
  const figName = FIGURES[opts.figureName] ? opts.figureName : ids[Math.floor(rng() * ids.length)];
  const def = { ...FIGURES[figName], ...(FIGURES[figName].build ? FIGURES[figName].build(rng) : {}) };
  const parts = def.parts, back = def.back || [], front = def.front || [];

  // Encaje: escala y centro a partir de la silueta girada.
  // Las figuras simétricas no se giran: el espejo se hace respecto a la vertical.
  let rot = def.mirror ? 0 : (def.rot || 0) * (rng() < 0.5 ? 1 : -1) + rFloat(rng, -0.06, 0.06);
  if (Number.isFinite(opts.figureRot) && !def.mirror) rot = opts.figureRot;
  const silCmds = def.silhouetteFromParts ? [...parts, ...back].map((p) => p.cmds) : def.silhouette;
  const unitRings = silCmds.flatMap((c) => flatten(c, (u, v) => [u * Math.cos(rot) - v * Math.sin(rot), u * Math.sin(rot) + v * Math.cos(rot)]));
  const ub = bboxOf(unitRings);
  // Auras: pocas (1–2) para que la figura se funda con el fondo y haya que
  // buscarla; figureAuras [mín, máx] lo cambia (el fondo ligero usa 2–4).
  const [auraLo, auraHi] = Array.isArray(opts.figureAuras) ? opts.figureAuras : [1, 2];
  const aura = fStyle === "glass" ? 1 : rInt(rng, auraLo, auraHi);
  const room = aura * gap * 1.6 + gap * 3; // margen para auras y respiro
  const bottomRoom = def.branch || def.stem ? 0.06 : 0;
  const sFit = Math.min((a.w - 2 * room) / (ub.x1 - ub.x0), (a.h - 2 * room) / ((ub.y1 - ub.y0) * (1 + bottomRoom)));
  // Encuadre: «center» (a página completa), «offset» (más pequeña y movida a
  // un lado o esquina: más fondo para colorear) o «zoom» (más grande que la
  // página y recortada por el marco, como un primer plano).
  const layouts = { center: 0.4, offset: 0.35, zoom: 0.25 };
  let layout = layouts[opts.figureLayout] !== undefined ? opts.figureLayout : null;
  const lr = rng();
  if (!layout) layout = empty ? "center" : lr < 0.4 ? "center" : lr < 0.75 ? "offset" : "zoom";
  const s = sFit * (layout === "offset" ? rFloat(rng, 0.66, 0.8) : layout === "zoom" ? rFloat(rng, 1.25, 1.45) : 1);
  const figW = (ub.x1 - ub.x0) * s, figH = (ub.y1 - ub.y0) * s;
  // Holgura para mover la figura: dentro del marco (offset) o hasta un ~25 %
  // fuera de él (zoom).
  const slackX = layout === "zoom" ? (figW - a.w) / 2 + figW * 0.12 : Math.max(0, (a.w - 2 * room - figW) / 2);
  const slackY = layout === "zoom" ? (figH - a.h) / 2 + figH * 0.12 : Math.max(0, (a.h - 2 * room - figH * (1 + bottomRoom)) / 2);
  const ox = layout === "center" ? 0 : rFloat(rng, -1, 1) * Math.max(0, slackX);
  let oy = layout === "center" ? 0 : rFloat(rng, -1, 1) * Math.max(0, slackY);
  // Con suelo (rama, tallo) la figura va de la mitad hacia abajo: no flota.
  if ((def.branch || def.stem) && layout === "offset") oy = Math.abs(oy);
  const fcx = a.x + a.w / 2 - ((ub.x0 + ub.x1) / 2) * s + ox;
  const fcy = a.y + a.h / 2 - ((ub.y0 + ub.y1) / 2) * s - (bottomRoom ? a.h * 0.02 : 0) + oy;
  const c = Math.cos(rot), sn = Math.sin(rot);
  const tf = (u, v) => [fcx + (u * c - v * sn) * s, fcy + (u * sn + v * c) * s];

  const pb = (sk = sketchy) => new PathBuilder({ sketchy: sk, rng });
  const shapeD = (cmds, sk = sketchy) => emitPath(pb(sk), cmds, tf).d;
  const clipOf = (d) => { const cid = id("c"); defs.push(`<clipPath id="${cid}"><path d="${d}"/></clipPath>`); return cid; };
  // Silueta de varias piezas con un solo contorno exterior: trazo grueso de
  // todas y, encima, su relleno blanco (tapa los contornos internos, que
  // dejaban astillas). El tangle va después, recortado a la unión.
  // Antes, un halo blanco sin línea: los cortes del tangle de debajo se unen
  // al halo en vez de quedar como astillas pegadas al contorno.
  const unionShape = (ds, w, inner) => `${ds.map((d) => `<path d="${d}" fill="#fff" stroke="#fff" stroke-width="${fmt(gap * 2.4)}" stroke-linejoin="round"/>`).join("")}` +
    `${ds.map((d) => `<path d="${d}" fill="#fff" stroke="#000" stroke-width="${fmt(w * 2)}" stroke-linejoin="round"/>`).join("")}` +
    `${ds.map((d) => `<path d="${d}" fill="#fff" stroke="none"/>`).join("")}${inner}`;
  const el = (d, fill = "none", w = stroke) => `<path d="${d}" fill="${fill}" stroke="#000" stroke-width="${fmt(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Elegir tangle evitando repetir: cada uso divide el peso.
  const used = new Map();
  let last = [];
  // tanglePalette: tangles permitidos en esta página (libro). Si deja un
  // grupo con menos de 3, ese grupo usa su lista completa.
  const palette = Array.isArray(opts.tanglePalette) && opts.tanglePalette.length ? new Set(opts.tanglePalette) : null;
  const pickTangle = (pool) => {
    const full = pool.map((t) => (typeof t === "string" ? byId.get(t) : t)).filter(Boolean);
    const inPal = palette ? full.filter((t) => palette.has(t.id)) : full;
    const list = inPal.length >= 3 ? inPal : full;
    let tot = 0;
    const ws = list.map((t) => {
      let w = last.includes(t.id) ? 0.05 : 1 / (1 + 3 * (used.get(t.id) || 0));
      // Con dificultad: los tangles sencillos dominan al principio y los
      // complejos al final (nunca desaparece ninguno del todo).
      if (level !== null) w *= HARD.has(t.id) ? 0.15 + level : 1.15 - level;
      tot += w; return w;
    });
    let r = rng() * tot, pick = list[list.length - 1];
    for (let i = 0; i < list.length; i++) { if ((r -= ws[i]) < 0) { pick = list[i]; break; } }
    used.set(pick.id, (used.get(pick.id) || 0) + 1);
    last = [...last.slice(-2), pick.id];
    return pick;
  };

  // Tangle recortado a la caja `box` (girado al azar).
  const tangleIn = (t, box, gapMul = 1, ang = rFloat(rng, 0, Math.PI)) => {
    const w = box.x1 - box.x0, h = box.y1 - box.y0, cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
    const ca = Math.abs(Math.cos(ang)), sa = Math.abs(Math.sin(ang));
    const hw = (ca * w + sa * h) / 2 + 2, hh = (sa * w + ca * h) / 2 + 2;
    let layers = [];
    try { layers = t.fn(createRNG(hash(seed, 7000 + nid)), { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh }, { gap: gap * gapMul, stroke, sketchy: sketchy * 0.8 }) || []; } catch (e) { layers = []; }
    const inner = layers.filter((l) => l && l.d).map((l) => (l.stroke === false ? `<path d="${l.d}" fill="${l.fill}" stroke="none"/>` : el(l.d, l.fill))).join("");
    return inner ? `<g transform="rotate(${fmt((ang * 180) / Math.PI)} ${fmt(cx)} ${fmt(cy)})" data-tangle="${t.id}">${inner}</g>` : "";
  };

  /* ---- 1) Fondo ---- */
  const frame = { x0: a.x, y0: a.y, x1: a.x + a.w, y1: a.y + a.h };
  const frameD = polyD([{ x: frame.x0, y: frame.y0 }, { x: frame.x1, y: frame.y0 }, { x: frame.x1, y: frame.y1 }, { x: frame.x0, y: frame.y1 }]);
  // Fondo denso (rayos o strings) para que la figura se funda con él; el
  // fondo ligero («airy») queda para «Tu turno» y el preset de fondo ligero.
  const bgKind = fStyle !== "strings" ? "facets" : opts.figureBackground || (empty ? "airy" : rng() < 0.5 ? "rays" : "strings");
  const frameRings = [[{ x: frame.x0, y: frame.y0 }, { x: frame.x1, y: frame.y0 }, { x: frame.x1, y: frame.y1 }, { x: frame.x0, y: frame.y1 }]];
  const frameClip = clipOf(frameD);
  const bg = [], bgLines = [];
  if (bgKind === "rays") {
    // Cuñas desde el centro de la figura hasta el marco, cada una con un tangle amplio.
    const n = rInt(rng, 5, 8), t0 = rng() * TAU, Rr = Math.hypot(a.w, a.h);
    const fx = fcx, fy = fcy;
    const rays = [];
    for (let k = 0; k < n; k++) {
      const t = t0 + (k / n) * TAU + rFloat(rng, -0.15, 0.15) * (TAU / n);
      rays.push(t);
    }
    rays.sort((p, q) => p - q);
    for (let k = 0; k < n; k++) {
      const ta = rays[k], tb = k + 1 < n ? rays[k + 1] : rays[0] + TAU;
      const pts = [{ x: fx, y: fy }];
      for (let q = 0; q <= 8; q++) { const t = ta + ((tb - ta) * q) / 8; pts.push({ x: fx + Math.cos(t) * Rr, y: fy + Math.sin(t) * Rr }); }
      const wedge = clipToRect(pts, frame);
      if (wedge.length < 3) continue;
      const cid = clipOf(polyD(wedge));
      // Una de cada ~5 cuñas queda lisa (zonas amplias para colorear con
      // calma), salvo las enormes: más del 12 % del marco se lee como error.
      const wArea = Math.abs(wedge.reduce((acc, q, i) => { const r = wedge[(i + 1) % wedge.length]; return acc + q.x * r.y - r.x * q.y; }, 0)) / 2;
      // Pocas cuñas lisas (1 de cada 10) y solo pequeñas: el fondo no queda vacío.
      if (rng() < 0.1 && wArea < a.w * a.h * 0.02) continue;
      const t = pickTangle(BG_POOL);
      // El patrón cubre solo la caja de su cuña: generarlo sobre toda la
      // página era lento y resvg descarta contenido mucho mayor que el lienzo.
      bg.push(`<g clip-path="url(#${cid})">${tangleIn(t, bboxOf([wedge]), BG_GAP)}</g>`);
    }
    const lines = pb(sketchy * 0.6);
    for (const t of rays) lines.moveTo(fx, fy).lineTo(fx + Math.cos(t) * Rr, fy + Math.sin(t) * Rr);
    // Margen blanco junto a las líneas del fondo (sin astillas en los cortes).
    if (rich) bg.push(`<path d="${lines.d}" fill="none" stroke="#fff" stroke-width="${fmt(gap * 1.6)}"/>`);
    bgLines.push(el(lines.d, "none", strStroke));
  } else if (bgKind === "strings") {
    const sec = makeSections(rng, frameRings, { angle: rFloat(rng, 0, Math.PI), a: [2, 3], b: [1, 2] }, gap);
    for (const sct of sec.sections) {
      if (sct.area < 150) continue;
      // Una sección lisa es respiro; una lisa enorme (más del 12 % del marco)
      // se lee como un error. El sorteo se mantiene para no mover la semilla.
      if (rng() < 0.1 && sct.area < a.w * a.h * 0.02) continue;
      const ca = clipOf(polyD(clipToRect(sec.stripA(sct.i), frame))), cb = clipOf(polyD(sec.stripB(sct.j)));
      bg.push(`<g clip-path="url(#${ca})"><g clip-path="url(#${cb})">${tangleIn(pickTangle(BG_POOL), sct, BG_GAP)}</g></g>`);
    }
    const lines = pb(sketchy * 0.6);
    for (const p of sec.lines) smoothPath(lines, p);
    // Margen blanco junto a las líneas del fondo (sin astillas en los cortes).
    if (rich) bg.push(`<path d="${lines.d}" fill="none" stroke="#fff" stroke-width="${fmt(gap * 1.6)}"/>`);
    bgLines.push(el(lines.d, "none", strStroke));
  } else if (bgKind === "facets") {
    // Facetas rectas en todo el marco (la figura las tapa). Vitral: piezas
    // pequeñas y lisas; cubista: grandes, la mitad con un tangle amplio.
    // En vitral el fondo va en piezas más grandes que la figura: así destaca.
    const target = fStyle === "glass" ? 900 : 1100;
    const facets = facetSections(rng, frameRings, target);
    const lines = pb(sketchy * 0.4);
    for (const f of facets) {
      const poly = clipToRect(f.pts, frame);
      if (poly.length < 3) continue;
      lines.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) lines.lineTo(poly[i].x, poly[i].y);
      lines.close();
      // Cubista: lisas solo algunas piezas pequeñas (las grandes, vacías, se
      // leían como huecos sin nada que colorear).
      if (fStyle === "glass" || f.area < 200 || (rng() < 0.3 && f.area < a.w * a.h * 0.02)) continue;
      bg.push(`<g clip-path="url(#${clipOf(polyD(poly))})">${tangleIn(pickTangle(BG_POOL), f, BG_GAP)}</g>`);
    }
    if (fStyle !== "glass") bg.push(`<path d="${lines.d}" fill="none" stroke="#fff" stroke-width="${fmt(gap * 1.6)}"/>`);
    bgLines.push(el(lines.d, "none", fStyle === "glass" ? strStroke * 1.3 : strStroke));
  } else {
    // Aire: anillos sueltos grandes y pocos (respiro para colorear con calma).
    bg.push(`<g clip-path="url(#${frameClip})">${tangleIn(byId.get("purk"), frame, 2.1)}</g>`);
  }
  // Sin un recorte de marco que envuelva a los demás: cada región ya viene
  // recortada al marco (resvg pierde contenido con recortes anidados grandes).
  body.push(bg.join(""));
  if (bgLines.length) body.push(`<g clip-path="url(#${frameClip})">${bgLines.join("")}</g>`);
  const minisAt = body.length; // las figuritas escondidas van aquí (ver más abajo)

  /* ---- 2) Auras (eco del contorno) mediante trazos anchos negro/blanco ---- */
  const silD = silCmds.map((cm) => shapeD(cm, 0)).join(" ");
  const ringGap = gap * rFloat(rng, 1.5, 2.0);
  const auraEls = [];
  // Halo blanco por fuera del aura exterior y margen junto al marco: los
  // tangles del fondo que cortan quedan unidos a ellos, no como astillas.
  // (Solo con strings: en facetado y vitral las líneas deben llegar al marco.)
  if (rich && fStyle === "strings") auraEls.push(`<path d="${silD}" fill="none" stroke="#fff" stroke-width="${fmt(2 * aura * ringGap + stroke + gap * 3)}" stroke-linejoin="round"/>`,
    `<path d="${frameD}" fill="none" stroke="#fff" stroke-width="${fmt(gap * 3)}"/>`);
  for (let k = aura; k >= 1; k--) {
    const wOut = 2 * k * ringGap;
    auraEls.push(`<path d="${silD}" fill="none" stroke="#000" stroke-width="${fmt(wOut + stroke)}" stroke-linejoin="round"/>`);
    auraEls.push(`<path d="${silD}" fill="none" stroke="#fff" stroke-width="${fmt(wOut - stroke)}" stroke-linejoin="round"/>`);
  }
  body.push(`<g clip-path="url(#${frameClip})">${auraEls.join("")}</g>`);

  /* ---- 2b) Figuritas escondidas en el fondo («busca y encuentra») ---- */
  // 2–3 siluetas pequeñas de otras figuras, camufladas entre los tangles del
  // fondo con un tangle propio. Nunca tocan la figura, sus auras ni el marco.
  const nHidden = rich && fStyle === "strings" && opts.hiddenFigures !== false ? rInt(rng, 2, 3) : 0;
  if (nHidden) {
    const mainPts = silCmds.flatMap((cm) => flatten(cm, tf)).flat();
    const keep = aura * 2 * ringGap + gap * 3;
    const near = (x, y) => mainPts.some((pt) => (pt.x - x) ** 2 + (pt.y - y) ** 2 < keep * keep);
    const mainSil = silCmds.flatMap((cm) => flatten(cm, tf));
    let band = null;
    if (def.branch) { const [, by] = tf(0, def.branch + 0.06), bh = Math.max(gap * 5, s * 0.1); band = [by - bh, by + bh]; }
    // Solo siluetas que se reconocen pequeñas y sin detalles interiores.
    // Figuritas del mismo tema (ciencia), o adultas, o tiernas.
    const theme = def.science ? FIGURE_IDS.filter((f) => FIGURES[f].science === def.science && FIGURES[f].hide)
      : def.cryptid ? FIGURE_IDS.filter((f) => FIGURES[f].cryptid && FIGURES[f].hide) : null;
    const adultMode = !FIGURE_SETS.kids.includes(figName);
    const pool = (theme && theme.length > 1 ? theme : adultMode ? HIDEABLE_ADULT : HIDEABLE).filter((f) => f !== figName && FIGURES[f]);
    const placed = [], out = [];
    for (let n = 0; n < nHidden; n++) {
      const other = FIGURES[pool[Math.floor(rng() * pool.length)]];
      const unit = other.silhouette.flatMap((cm) => flatten(cm, (u, v) => [u, v]));
      const ubm = bboxOf(unit), size = Math.min(a.w, a.h) * rFloat(rng, 0.14, 0.19);
      const k = size / Math.max(ubm.x1 - ubm.x0, ubm.y1 - ubm.y0);
      for (let tries = 0; tries < 60; tries++) {
        const px = rFloat(rng, frame.x0, frame.x1), py = rFloat(rng, frame.y0, frame.y1), ang = rFloat(rng, -0.4, 0.4);
        const cs = Math.cos(ang), ss = Math.sin(ang), cx0 = (ubm.x0 + ubm.x1) / 2, cy0 = (ubm.y0 + ubm.y1) / 2;
        const T = (u, v) => [px + ((u - cx0) * cs - (v - cy0) * ss) * k, py + ((u - cx0) * ss + (v - cy0) * cs) * k];
        const rings = other.silhouette.flatMap((cm) => flatten(cm, T));
        const bm = bboxOf(rings), m = gap * 2.5;
        if (bm.x0 < frame.x0 + m || bm.x1 > frame.x1 - m || bm.y0 < frame.y0 + m || bm.y1 > frame.y1 - m) continue;
        if (band && bm.y1 > band[0] - m && bm.y0 < band[1] + m) continue;
        if (placed.some((b) => bm.x0 < b.x1 + m && bm.x1 > b.x0 - m && bm.y0 < b.y1 + m && bm.y1 > b.y0 - m)) continue;
        if (rings.some((rg) => rg.some((pt) => inside(mainSil, pt.x, pt.y) || near(pt.x, pt.y)))) continue;
        if (def.stem && bm.x1 > a.x + a.w / 2 - 10 && bm.x0 < a.x + a.w / 2 + 10 && bm.y1 > fcy) continue;
        placed.push(bm);
        const ds = other.silhouette.map((cm) => emitPath(pb(0), cm, T).d);
        const cid = clipOf(ds.join(" "));
        // Interior liso con un eco del contorno: se camufla entre los tangles
        // y, a este tamaño, un tangle recortado dejaba muchas astillas.
        // Eco solo de la pieza mayor: en las uniones (cuerpo y cola) dibujaba
        // líneas de más dentro de la silueta.
        const areaOf = (cm) => { const b = bboxOf(flatten(cm, T)); return (b.x1 - b.x0) * (b.y1 - b.y0); };
        const big = other.silhouette.reduce((m, cm, i) => (areaOf(cm) > areaOf(other.silhouette[m]) ? i : m), 0);
        const eb = gap * 1.3, all = ds[big];
        const echo = `<g clip-path="url(#${cid})"><path d="${all}" fill="none" stroke="#000" stroke-width="${fmt(2 * eb + stroke)}" stroke-linejoin="round"/>` +
          `<path d="${all}" fill="none" stroke="#fff" stroke-width="${fmt(2 * eb - stroke)}" stroke-linejoin="round"/></g>`;
        out.push(`<g data-hidden="${FIGURE_IDS.find((f) => FIGURES[f] === other)}">${unionShape(ds, strStroke, echo)}</g>`);
        break;
      }
    }
    body.splice(minisAt, 0, ...out);
  }

  /* ---- 3) Rama / tallo (por delante del fondo, detrás de la figura) ---- */
  if (def.branch) {
    const [, by] = tf(0, def.branch + 0.06);
    const h = Math.max(gap * 5, s * 0.1);
    const poly = clipToRect([{ x: frame.x0 - 2, y: by - h / 2 }, { x: frame.x1 + 2, y: by - h / 2 - h * 0.15 }, { x: frame.x1 + 2, y: by + h / 2 }, { x: frame.x0 - 2, y: by + h / 2 + h * 0.1 }], frame);
    const d = polyD(poly);
    const cid = clipOf(d);
    body.push(`<path d="${d}" fill="#fff" stroke="none"/><g clip-path="url(#${cid})">${tangleIn(byId.get(rng() < 0.5 ? "static" : "keeko"), bboxOf([poly]), 1.1, 0.04)}</g>${el(d, "none", outStroke)}`);
  }
  if (def.stem) {
    const [sx, sy] = tf(0, 0.8);
    const b = pb();
    b.moveTo(sx - 1.2, sy).quadTo(sx + (a.x + a.w / 2 - sx) * 0.3 - 4, (sy + frame.y1) / 2, a.x + a.w / 2 - 3, frame.y1 + 1)
      .lineTo(a.x + a.w / 2 + 3, frame.y1 + 1).quadTo(sx + (a.x + a.w / 2 - sx) * 0.3 + 4, (sy + frame.y1) / 2, sx + 1.2, sy);
    body.push(`<g clip-path="url(#${frameClip})">${el(b.d, W, outStroke)}</g>`);
  }

  /* ---- 4) Piezas con tangle propio (detrás / delante) ---- */
  const piece = (p, mirrorX = false, front = false) => {
    const cmds = mirrorX ? xform(p.cmds, 0, 0, 0, -1, 1) : p.cmds;
    const d = shapeD(cmds), dc = shapeD(cmds, 0);
    const rings = flatten(cmds, tf), bb = bboxOf(rings);
    // En facetado y vitral las piezas grandes (cola, aletas, alas) también se
    // parten en facetas: antes quedaban como un bloque liso enorme.
    if (fStyle !== "strings" && !empty && p.tangle !== null && (bb.x1 - bb.x0) * (bb.y1 - bb.y0) > gap * gap * 220) {
      return facetPartSvg({ cmds }, rings, dc, clipOf(dc));
    }
    let inner = "";
    if (p.tangle && !empty && fStyle !== "glass") {
      const pool = p.tangle === "detail" ? DETAIL_POOL : p.tangle === "round" ? ["printemps", "purk", "tipple"] : POOL.map((t) => t.id);
      inner = `<g clip-path="url(#${clipOf(dc)})">${tangleIn(pickTangle(pool), bb, p.tangle === "detail" ? 0.9 : 1)}</g>`;
    }
    // Piezas de delante (orgánulos, caras): halo blanco fino para que el
    // tangle de debajo no deje astillas pegadas a su borde.
    const halo = front && rich && p.halo !== false ? `<path d="${dc}" fill="#fff" stroke="#fff" stroke-width="${fmt(gap * 2.2)}" stroke-linejoin="round"/>` : "";
    // Margen blanco interior: las celdas del tangle cortadas en el contorno se
    // unen al borde en vez de quedar como astillas (como en las secciones).
    const margin = rich && inner ? `<path d="${dc}" fill="none" stroke="#fff" stroke-width="${fmt(gap * 1.5)}" stroke-linejoin="round"/>` : "";
    return `${halo}<path d="${dc}" fill="#fff" stroke="none"/>${inner}${margin}${el(d, "none", strStroke * 1.1)}`;
  };
  const pieces = (list, front = false) => list.flatMap((p) => (p.mirror ? [piece(p, false, front), piece(p, true, front)] : [piece(p, false, front)]));

  /* ---- 5) Partes subdivididas ---- */
  // Relleno rico (zentangle clásico): dentro de algunas secciones, una banda
  // de eco que sigue sus bordes (aura interior) y, en las grandes, un orbe
  // con su propio tangle. Ambos dejan zonas de ≥ 2 mm para colorear.
  // Zonas que no se tapan (cara, ojos, piezas de delante, también en espejo).
  const blockers = [...front, ...front.filter((q) => q.mirror).map((q) => ({ cmds: xform(q.cmds, 0, 0, 0, -1, 1) })), ...(def.deco ? def.deco() : [])]
    .map((q) => bboxOf(flatten(q.cmds, tf))).filter((b) => Number.isFinite(b.x0));
  const blocked = (b, pad) => blockers.some((k) => b.x0 < k.x1 + pad && b.x1 > k.x0 - pad && b.y0 < k.y1 + pad && b.y1 > k.y0 - pad);
  const sectionExtras = (q, sec, edgeD, t) => {
    let extra = "";
    const w = q.x1 - q.x0, h = q.y1 - q.y0;
    if (q.area > gap * gap * 80 && rng() < 0.4) {
      const band = gap * rFloat(rng, 1.15, 1.5);
      extra += `<path d="${edgeD}" fill="none" stroke="#000" stroke-width="${fmt(2 * band + stroke)}" stroke-linejoin="round"/>` +
        `<path d="${edgeD}" fill="none" stroke="#fff" stroke-width="${fmt(2 * band - stroke)}" stroke-linejoin="round"/>`;
    } else {
      // Margen blanco sin línea junto a cuerdas y contorno: los trozos del
      // tangle cortados en el borde se unen a él y no quedan como astillas.
      extra += `<path d="${edgeD}" fill="none" stroke="#fff" stroke-width="${fmt(gap * 1.5)}" stroke-linejoin="round"/>`;
    }
    if (q.area > gap * gap * 200 && rng() < 0.45) {
      const key = q.i * 100 + q.j, cx = (q.x0 + q.x1) / 2 + rFloat(rng, -0.12, 0.12) * w, cy = (q.y0 + q.y1) / 2 + rFloat(rng, -0.12, 0.12) * h;
      const r = Math.min(w, h) * rFloat(rng, 0.2, 0.28);
      let fits = r > gap * 3 && sec.labelAt(cx, cy) === key && !blocked({ x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }, gap * 2);
      for (let k = 0; k < 16 && fits; k++) { const an = (k / 16) * TAU; fits = sec.labelAt(cx + Math.cos(an) * (r + gap * 2), cy + Math.sin(an) * (r + gap * 2)) === key; }
      if (fits) {
        const od = `M ${fmt(cx + r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)} A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)} Z`;
        const ot = pickTangle(POOL.filter((x) => x.id !== t.id));
        const ring = rng() < 0.5 ? `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(r + gap * 1.1)}" fill="#fff" stroke="#000" stroke-width="${fmt(stroke)}"/>` : "";
        extra += `${ring}<path d="${od}" fill="#fff" stroke="none"/><g clip-path="url(#${clipOf(od)})">${tangleIn(ot, { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }, 0.85)}</g>` +
          `<path d="${od}" fill="none" stroke="#fff" stroke-width="${fmt(gap * 1.2)}" stroke-linejoin="round"/>${el(od, "none", strStroke)}`;
      }
    }
    return extra;
  };

  // Figura escondida: copia pequeña de la silueta dentro de la propia figura
  // (como el corazón dentro del corazón), con otro tangle. Solo donde cabe
  // entera, lejos del contorno y sin tapar la cara ni las piezas de delante.
  const nestedSvg = () => {
    if (!rich || def.mirror || def.abstract || def.science || figName === "heart" || opts.nestedFigure === false) return "";
    // Contenedor: cualquiera de las partes (cabeza o cuerpo del oso, etc.).
    const partRings = parts.map((p) => flatten(p.cmds, tf));
    const inFig = (x, y) => partRings.some((r) => inside(r, x, y));
    const mb = bboxOf(partRings.flat());
    // Silueta de la copia sin adornos sueltos pequeños (burbujas, gotas).
    const areaU = (cm) => { const b = bboxOf(flatten(cm, (u, v) => [u, v])); return (b.x1 - b.x0) * (b.y1 - b.y0); };
    const maxA = Math.max(...silCmds.map(areaU));
    const miniCmds = silCmds.filter((cm) => areaU(cm) >= maxA * 0.06);
    const su = bboxOf(miniCmds.flatMap((cm) => flatten(cm, (u, v) => [u, v])));
    const scx = (su.x0 + su.x1) / 2, scy = (su.y0 + su.y1) / 2;
    // Piezas de delante (también en espejo): la copia va entera dentro de una
    // (un pingüinito en la panza) o entera fuera, nunca a caballo.
    const frontRings = [...front, ...front.filter((q) => q.mirror).map((q) => ({ cmds: xform(q.cmds, 0, 0, 0, -1, 1) }))].map((q) => flatten(q.cmds, tf));
    const decoBoxes = (def.deco ? def.deco() : []).map((q) => bboxOf(flatten(q.cmds, tf))).filter((b) => Number.isFinite(b.x0));
    const pad = gap * 2;
    // Centros candidatos: puntos de una rejilla dentro de la figura (en
    // unidades de figura, deshaciendo el encaje tf).
    const cands = [];
    for (let y = mb.y0; y < mb.y1; y += gap * 3) for (let x = mb.x0; x < mb.x1; x += gap * 3) {
      if (!inFig(x, y)) continue;
      const dx = x - fcx, dy = y - fcy;
      cands.push([(dx * c + dy * sn) / s, (-dx * sn + dy * c) / s]);
    }
    if (!cands.length) return "";
    for (let tries = 0; tries < 160; tries++) {
      const k = [0.3, 0.25, 0.2, 0.16][Math.floor(tries / 40)] * rFloat(rng, 0.92, 1.05);
      const [cu, cv] = cands[Math.floor(rng() * cands.length)];
      const u0 = cu - k * scx, v0 = cv - k * scy;
      const cmdsList = miniCmds.map((cm) => xform(cm, u0, v0, 0, k));
      const ringsM = cmdsList.flatMap((cm) => flatten(cm, tf));
      const bm = bboxOf(ringsM);
      if (bm.x0 < mb.x0 || bm.x1 > mb.x1 || bm.y0 < mb.y0 || bm.y1 > mb.y1) continue;
      const pts = ringsM.flat();
      if (!pts.every((pt) => inFig(pt.x, pt.y) && inFig(pt.x + pad, pt.y) && inFig(pt.x - pad, pt.y) && inFig(pt.x, pt.y + pad) && inFig(pt.x, pt.y - pad))) continue;
      if (decoBoxes.some((b) => bm.x0 < b.x1 + pad && bm.x1 > b.x0 - pad && bm.y0 < b.y1 + pad && bm.y1 > b.y0 - pad)) continue;
      if (frontRings.some((fr) => { const n = pts.filter((pt) => inside(fr, pt.x, pt.y)).length; return n > 0 && n < pts.length; })) continue;
      const ds = cmdsList.map((cm) => shapeD(cm, 0));
      const cid = clipOf(ds.join(" "));
      const t = pickTangle(POOL);
      return `<g data-hidden="${figName}">${unionShape(ds, strStroke * 1.1, `<g clip-path="url(#${cid})">${tangleIn(t, bm, 1.05)}</g>`)}</g>`;
    }
    return "";
  };

  /* ---- 5b) Partes subdivididas ---- */
  const partSvg = (p) => {
    const rings = flatten(p.cmds, tf);
    const dc = shapeD(p.cmds, 0);
    const pc = clipOf(dc);
    if (fStyle !== "strings") return facetPartSvg(p, rings, dc, pc);
    // El ángulo de los strings es relativo a la figura: se suma su giro.
    const sec = makeSections(rng, rings, { ...p.strings, angle: p.strings.angle + rot }, gap, level);
    let plainUsed = false;
    const totalArea = sec.sections.reduce((acc, q) => acc + q.area, 0);
    const out = [`<path d="${dc}" fill="#fff" stroke="none"/>`];
    const inner = [];
    const lines = pb();
    for (const l of sec.lines) smoothPath(lines, l);
    const edgeD = `${lines.d} ${dc}`;
    for (const q of sec.sections) {
      if (empty || q.area < gap * gap * 14) continue; // «Tu turno» o astilla: queda lisa
      // Muy alargada (p. ej. 60 × 5 mm en cola o pata): con el margen blanco el
      // tangle quedaría en astillas; se deja lisa (un canal fácil de colorear).
      { const w = q.x1 - q.x0, h = q.y1 - q.y0; if (Math.max(w / h, h / w) > 4.5 && Math.min(w, h) < gap * 5) continue; }
      // Respiro: como mucho una sección lisa por parte, y nunca una grande
      // (una banda vacía de media figura se lee como un error).
      if (!plainUsed && q.area < Math.min(900, totalArea * 0.12) && rng() < 0.25) { plainUsed = true; continue; }
      const t = pickTangle(POOL);
      let g = tangleIn(t, q, rFloat(rng, 0.95, 1.15));
      if (rich) g += sectionExtras(q, sec, edgeD, t);
      if (sec.nB) g = `<g clip-path="url(#${clipOf(polyD(sec.stripB(q.j)))})">${g}</g>`;
      if (sec.nA) g = `<g clip-path="url(#${clipOf(polyD(sec.stripA(q.i)))})">${g}</g>`;
      inner.push(g);
    }
    inner.push(el(lines.d, "none", strStroke));
    // Borde interior (caparazón): banda lisa siguiendo el contorno.
    if (def.rim) {
      const rw = gap * 2.4;
      inner.push(`<path d="${dc}" fill="none" stroke="#000" stroke-width="${fmt(2 * rw + stroke)}"/>`, `<path d="${dc}" fill="none" stroke="#fff" stroke-width="${fmt(2 * rw - stroke)}"/>`);
    }
    out.push(`<g clip-path="url(#${pc})">${inner.join("")}</g>`);
    out.push(el(shapeD(p.cmds), "none", outStroke));
    return out.join("");
  };

  // Parte facetada: piezas convexas; en cubista algunas llevan tangle y en
  // vitral todas quedan lisas para colorear.
  const facetPartSvg = (p, rings, dc, pc) => {
    const bb = bboxOf(rings), A = (bb.x1 - bb.x0) * (bb.y1 - bb.y0);
    const target = fStyle === "glass" ? Math.max(260, gap * gap * 70) : Math.max(450, A / (level === null ? 14 : 8 + 10 * level));
    const facets = facetSections(rng, rings, target);
    const inner = [];
    const lines = pb(sketchy * 0.5);
    for (const f of facets) {
      lines.moveTo(f.pts[0].x, f.pts[0].y);
      for (let i = 1; i < f.pts.length; i++) lines.lineTo(f.pts[i].x, f.pts[i].y);
      lines.close();
      if (empty || f.area < gap * gap * 30 || (rng() < facetPlain && (fStyle === "glass" || f.area < a.w * a.h * 0.02))) continue;
      inner.push(`<g clip-path="url(#${clipOf(polyD(f.pts))})">${tangleIn(pickTangle(POOL), f, rFloat(rng, 1.1, 1.4))}</g>`);
    }
    // Margen blanco junto a las aristas (y el contorno): sin astillas de tangle.
    if (fStyle !== "glass") inner.push(`<path d="${lines.d} ${dc}" fill="none" stroke="#fff" stroke-width="${fmt(gap * 1.5)}" stroke-linejoin="round"/>`);
    inner.push(el(lines.d, "none", fStyle === "glass" ? strStroke * 1.3 : strStroke));
    return `<path d="${dc}" fill="#fff" stroke="none"/><g clip-path="url(#${pc})">${inner.join("")}</g>${el(shapeD(p.cmds), "none", outStroke)}`;
  };

  const decoSvg = (list) => list.map((q) => el(shapeD(q.cmds), q.fill, q.w || strStroke)).join("");

  const figure = [];
  figure.push(...pieces(back));
  if (def.mirror) {
    // Mitad derecha + su espejo exacto (simetría bilateral, como la mariposa real).
    const half = [...parts.map(partSvg), ...pieces(front, true), def.deco ? decoSvg(def.deco()) : ""].join("");
    figure.push(`<g>${half}</g>`, `<g transform="translate(${fmt(2 * fcx)} 0) scale(-1 1)">${half}</g>`);
    if (def.center) figure.push(decoSvg(def.center()));
  } else {
    figure.push(...parts.map(partSvg), ...pieces(front, true), nestedSvg());
    if (def.deco) figure.push(decoSvg(def.deco()));
  }
  // En «zoom» la figura sale del marco: se recorta a él.
  body.push(layout === "zoom"
    ? `<g data-figure="${figName}" data-layout="zoom"><g clip-path="url(#${frameClip})">${figure.join("")}</g></g>`
    : `<g data-figure="${figName}" data-layout="${layout}">${figure.join("")}</g>`);

  // Marco.
  body.push(el(polyD(frameRings[0]), "none", outStroke * 1.1));

  if (Array.isArray(doc.defs)) doc.defs.push(...defs);
  else doc.body.unshift(`<defs>${defs.join("")}</defs>`);
  doc.body.push(...body);
  return { figure: figName, background: bgKind };
}

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
};
export const FIGURE_IDS = Object.keys(FIGURES);
// Grupos: figuras para adultos (elegantes, sin caritas), composiciones
// abstractas y animales tiernos (libro infantil).
export const FIGURE_SETS = {
  adult: ["koi", "hummingbird", "feather", "nautilus", "lunamoth", "hamsa", "vase", "lotus", "butterfly", "dragonfly", "leaf", "flower", "moon", "heart"],
  abstract: ["ribbons", "drops", "orbs", "crystals"],
  kids: ["owl", "cat", "fish", "turtle", "elephant", "snail", "bird", "whale", "mushroom", "tree", "bear", "rabbit", "penguin", "fox"],
};
export const ADULT_FIGURES = [...FIGURE_SETS.adult, ...FIGURE_SETS.abstract];
// Figuras que se reconocen como silueta pequeña (las figuritas escondidas).
// En los estilos para adultos, las figuritas escondidas también son adultas.
const HIDEABLE_ADULT = ["koi", "hummingbird", "feather", "vase", "drops", "crystals", "leaf", "moon", "heart"];
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
  const s = Math.min((a.w - 2 * room) / (ub.x1 - ub.x0), (a.h - 2 * room) / ((ub.y1 - ub.y0) * (1 + bottomRoom)));
  const fcx = a.x + a.w / 2 - ((ub.x0 + ub.x1) / 2) * s;
  const fcy = a.y + a.h / 2 - ((ub.y0 + ub.y1) / 2) * s - (bottomRoom ? a.h * 0.02 : 0);
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
    const adultMode = !FIGURE_SETS.kids.includes(figName);
    const pool = (adultMode ? HIDEABLE_ADULT : HIDEABLE).filter((f) => f !== figName && FIGURES[f]);
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
  const piece = (p, mirrorX = false) => {
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
    return `<path d="${dc}" fill="#fff" stroke="none"/>${inner}${el(d, "none", strStroke * 1.1)}`;
  };
  const pieces = (list) => list.flatMap((p) => (p.mirror ? [piece(p), piece(p, true)] : [piece(p)]));

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
        extra += `${ring}<path d="${od}" fill="#fff" stroke="none"/><g clip-path="url(#${clipOf(od)})">${tangleIn(ot, { x0: cx - r, y0: cy - r, x1: cx + r, y1: cy + r }, 0.85)}</g>${el(od, "none", strStroke)}`;
      }
    }
    return extra;
  };

  // Figura escondida: copia pequeña de la silueta dentro de la propia figura
  // (como el corazón dentro del corazón), con otro tangle. Solo donde cabe
  // entera, lejos del contorno y sin tapar la cara ni las piezas de delante.
  const nestedSvg = () => {
    if (!rich || def.mirror || def.abstract || figName === "heart" || opts.nestedFigure === false) return "";
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
    const half = [...parts.map(partSvg), ...pieces(front), def.deco ? decoSvg(def.deco()) : ""].join("");
    figure.push(`<g>${half}</g>`, `<g transform="translate(${fmt(2 * fcx)} 0) scale(-1 1)">${half}</g>`);
    if (def.center) figure.push(decoSvg(def.center()));
  } else {
    figure.push(...parts.map(partSvg), ...pieces(front), nestedSvg());
    if (def.deco) figure.push(decoSvg(def.deco()));
  }
  body.push(`<g data-figure="${figName}">${figure.join("")}</g>`);

  // Marco.
  body.push(el(polyD(frameRings[0]), "none", outStroke * 1.1));

  if (Array.isArray(doc.defs)) doc.defs.push(...defs);
  else doc.body.unshift(`<defs>${defs.join("")}</defs>`);
  doc.body.push(...body);
  return { figure: figName, background: bgKind };
}

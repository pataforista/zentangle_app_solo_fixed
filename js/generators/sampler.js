// sampler.js
// Modo muestrario: una retícula de contenedores iguales (círculos o cuadros),
// cada uno con UN motivo distinto, como las hojas de "doodle patterns".
// Contrasta con zentangleCells: allí las celdas son irregulares y los patrones
// genéricos; aquí cada unidad es una idea reconocible (corazones, gotas, nubes,
// tablero...) y la hoja mezcla negros sólidos, rayado y blancos.
import { createRNG, hash, rFloat } from "../core/prng.js";
import { MOTIFS } from "./patterns/motifs.js";
import { ICONS } from "./patterns/icons.js";
import { fillCadent, fillFlorz, fillTipple, fillPrintemps, fillCrescentMoon } from "./patterns/tangles.js";
import { fillConcentricSquares } from "./patterns/geometric.js";
import { fillScallops, fillSpiralBands } from "./patterns/organic.js";
import { fillParadox, fillFlux } from "./patterns/complex.js";

const classic = (id, fn) => ({
  id,
  fn: (rng, r, cfg) => {
    const d = fn(rng, r, { ...cfg, focus: { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, r: (r.x1 - r.x0) / 2 } });
    return d ? [{ d, fill: "none" }] : [];
  },
});

const CLASSIC = [
  classic("cadent", fillCadent), classic("florz", fillFlorz), classic("tipple", fillTipple),
  classic("printemps", fillPrintemps), classic("crescentMoon", fillCrescentMoon),
  classic("concentricSquares", fillConcentricSquares), classic("scallops", fillScallops),
  classic("spiralBands", fillSpiralBands), classic("paradox", fillParadox), classic("flux", fillFlux),
];

// "iconic": imágenes reconocibles + texturas suaves (mezcla más memorable).
const SOFT = ["bubbles", "scales", "rainbows", "clouds", "flowers", "leaves", "mandala", "honeycomb", "polka", "hearts"];

const POOLS = {
  all: [...MOTIFS, ...ICONS, ...CLASSIC],
  iconic: [...ICONS, ...MOTIFS.filter((m) => SOFT.includes(m.id))],
  icons: ICONS,
  modern: MOTIFS,
  classic: CLASSIC,
};

const fmt = (n) => (Math.round(Number(n) * 1000) / 1000).toString();

// Elige filas x columnas que se acerquen a `count` tiles y llenen la página.
export function pickGrid(count, w, h, gap) {
  let best = null;
  for (let c = 1; c <= 12; c++) {
    for (let r = 1; r <= 16; r++) {
      const size = Math.min((w - (c - 1) * gap) / c, (h - (r - 1) * gap) / r);
      if (size < 12) continue;
      const fill = ((c * size + (c - 1) * gap) * (r * size + (r - 1) * gap)) / (w * h);
      const score = Math.abs(c * r - count) * 0.6 - fill * 10;
      if (!best || score < best.score) best = { cols: c, rows: r, size, score };
    }
  }
  return best || { cols: 1, rows: 1, size: Math.min(w, h), score: 0 };
}

// Asigna un motivo por tile sin repetir hasta agotar la paleta; las masas negras
// ("heavy") no se juntan con vecinas (izquierda/arriba) ni superan el tope.
function assignMotifs(rng, pool, cols, rows, solids, heavyShare) {
  const n = cols * rows;
  const maxHeavy = solids ? Math.max(1, Math.ceil(n * heavyShare)) : n;
  const shuffle = (a) => {
    const o = a.slice();
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    return o;
  };
  let queue = shuffle(pool);
  const out = [];
  let heavyCount = 0;
  for (let k = 0; k < n; k++) {
    if (!queue.length) queue = shuffle(pool).filter((m) => m !== out[k - 1]);
    const i = k % cols, j = Math.floor(k / cols);
    const left = i > 0 ? out[k - 1] : null, up = j > 0 ? out[k - cols] : null;
    const heavyOk = (m) => !solids || !m.heavy || (heavyCount < maxHeavy && !left?.heavy && !up?.heavy);
    let idx = queue.findIndex(heavyOk);
    if (idx < 0) idx = 0;
    const m = queue.splice(idx, 1)[0];
    if (solids && m.heavy) heavyCount++;
    out.push(m);
  }
  return out;
}

export async function generateSampler(doc, opts) {
  const seed = opts.seed >>> 0;
  const a = opts.areaMm;
  const clamp = (v, lo, hi, fb) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);

  const count = Math.round(clamp(opts.cellCount, 2, 120, 20));
  const gap = clamp(opts.samplerGapMm, 0, 30, 5);
  const borderMm = clamp(opts.cellBorderWidthMm, 0.1, 5, 0.8) * clamp(opts.samplerBorderMul, 0.5, 3, 1);
  const strokeMm = clamp(opts.patternStrokeMm, 0.1, 3, 0.45);
  const strokeVar = clamp(opts.samplerStrokeVar, 0, 0.6, 0.25);
  const minGapMm = Math.max(0.9, clamp(opts.minGapMm, 0.5, 10, 1.6));
  const sketchy = clamp(opts.sketchy, 0, 2, 0);
  const solids = opts.samplerSolids !== false;
  const heavyShare = clamp(opts.samplerHeavyShare, 0, 1, 0.3);
  const shapeOpt = opts.samplerShape || "circle"; // circle | square | rounded | mixed
  const pool = POOLS[opts.samplerSet] || POOLS.all;

  // createRNG (sfc32 sin calentar) da salidas muy parecidas con semillas
  // consecutivas: el sorteo de motivos dejaba fuera siempre a algunos (el cactus
  // nunca salía). Se mezcla la semilla con hash() y se descartan las primeras.
  const rng = createRNG(hash(seed, 0x51ab));
  for (let w = 0; w < 12; w++) rng();
  const prefix = `z_${Math.floor(rng() * 1000000).toString(16)}_`;
  const useDocDefs = Array.isArray(doc.defs);
  const localDefs = [];
  const pushDef = (s) => { if (useDocDefs) doc.defs.push(s); else localDefs.push(s); };

  const grid = pickGrid(count, a.w, a.h, gap);
  const { cols, rows, size } = grid;
  const gridW = cols * size + (cols - 1) * gap, gridH = rows * size + (rows - 1) * gap;
  const ox = a.x + (a.w - gridW) / 2, oy = a.y + (a.h - gridH) / 2;

  if (opts.drawOuterBorder === true) {
    doc.body.push(`<rect x="${fmt(a.x)}" y="${fmt(a.y)}" width="${fmt(a.w)}" height="${fmt(a.h)}" fill="none" stroke="#000" stroke-width="${fmt(borderMm)}" stroke-linejoin="round"/>`);
  }

  const motifs = assignMotifs(rng, pool, cols, rows, solids, heavyShare);
  const shapes = ["circle", "rounded", "square"];

  for (let k = 0; k < cols * rows; k++) {
    const i = k % cols, j = Math.floor(k / cols);
    const x0 = ox + i * (size + gap), y0 = oy + j * (size + gap);
    const cx = x0 + size / 2, cy = y0 + size / 2, R = size / 2;
    const shape = shapeOpt === "mixed" ? shapes[Math.floor(rng() * shapes.length)] : shapeOpt;
    const isCircle = shape === "circle";
    const rx = shape === "rounded" ? size * 0.14 : 0;

    const trng = createRNG(hash(seed, 1000 + k));
    const sw = strokeMm * rFloat(trng, 1 - strokeVar * 0.6, 1 + strokeVar);
    const cfg = {
      minGapMm,
      patternStrokeMm: sw,
      sketchy,
      solids,
      inside: isCircle
        ? (x, y, over) => Math.hypot(x - cx, y - cy) <= R + over
        : (x, y, over) => Math.abs(x - cx) <= R + over && Math.abs(y - cy) <= R + over,
    };
    const box = { x0, y0, x1: x0 + size, y1: y0 + size };

    let layers = [];
    try { layers = motifs[k].fn(trng, box, cfg) || []; } catch (e) { layers = []; }
    layers = layers.filter((l) => l && l.d);
    if (!layers.length) {
      const fallback = MOTIFS.find((m) => m.id === "bubbles").fn(trng, box, cfg);
      layers = fallback.filter((l) => l.d);
    }

    const clipId = `${prefix}c${k}`;
    pushDef(isCircle
      ? `<clipPath id="${clipId}"><circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(R)}"/></clipPath>`
      : `<clipPath id="${clipId}"><rect x="${fmt(x0)}" y="${fmt(y0)}" width="${fmt(size)}" height="${fmt(size)}" rx="${fmt(rx)}"/></clipPath>`);

    // Capas: l.clipD recorta la capa a un contorno propio (relleno tangle dentro
    // de una silueta); l.w escala el grosor (los tangles van más finos que el contorno).
    let nClip = 0;
    const paths = layers.map((l) => {
      const el = l.stroke === false
        ? `<path d="${l.d}" fill="${l.fill}" stroke="none"/>`
        : `<path d="${l.d}" fill="${l.fill}" stroke="#000" stroke-width="${fmt(sw * (l.w || 1))}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (!l.clipD) return el;
      const id = `${clipId}_${nClip++}`;
      pushDef(`<clipPath id="${id}"><path d="${l.clipD}"/></clipPath>`);
      return `<g clip-path="url(#${id})">${el}</g>`;
    });
    doc.body.push(`<g clip-path="url(#${clipId})" data-motif="${motifs[k].id}">${paths.join("")}</g>`);

    const inset = borderMm / 2;
    doc.body.push(isCircle
      ? `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(R - inset)}" fill="none" stroke="#000" stroke-width="${fmt(borderMm)}"/>`
      : `<rect x="${fmt(x0 + inset)}" y="${fmt(y0 + inset)}" width="${fmt(size - borderMm)}" height="${fmt(size - borderMm)}" rx="${fmt(Math.max(0, rx - inset))}" fill="none" stroke="#000" stroke-width="${fmt(borderMm)}" stroke-linejoin="round"/>`);
  }

  if (!useDocDefs && localDefs.length) doc.body.unshift(`<defs>${localDefs.join("")}</defs>`);
}

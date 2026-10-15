// sampler.js
// Modo muestrario: una retícula de contenedores iguales (círculos o cuadros) o
// un teselado periódico (samplerLayout), cada unidad con UN motivo distinto, como las hojas de "doodle patterns".
// Contrasta con zentangleCells: allí las celdas son irregulares y los patrones
// genéricos; aquí cada unidad es una idea reconocible (corazones, gotas, nubes,
// tablero...) y la hoja mezcla negros sólidos, rayado y blancos.
import { createRNG, hash, rFloat } from "../core/prng.js";
import { MOTIFS } from "./patterns/motifs.js";
import { ICONS } from "./patterns/icons.js";
import { fillCadent, fillFlorz, fillTipple, fillCrescentMoon } from "./patterns/tangles.js";
import { fillConcentricSquares } from "./patterns/geometric.js";
import { TILINGS, tileArea, insetConvex, polyArea, polyCentroid, distToEdges, pointInPoly } from "./samplerTilings.js";
import { fillScallops, fillSpiralBands } from "./patterns/organic.js";
import { fillParadox, fillFlux } from "./patterns/complex.js";

// Los tangles clásicos están pensados para celdas de página (>= 15 mm) con su
// propio espaciado; en una unidad pequeña quedaban demasiado apretados, así que
// printemps (espirales) se omite: duplica `spirals` y al recortarse en el borde
// dejaba espirales cerradas de ~1 mm. Se les pide más aire (gapMul) para que las zonas quepan en un marcador.
const classic = (id, fn, gapMul = 1.5) => ({
  id,
  fn: (rng, r, cfg) => {
    const d = fn(rng, r, { ...cfg, minGapMm: cfg.minGapMm * gapMul, focus: { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, r: (r.x1 - r.x0) / 2 } });
    return d ? [{ d, fill: "none" }] : [];
  },
});

const CLASSIC = [
  classic("cadent", fillCadent), classic("florz", fillFlorz), classic("tipple", fillTipple),
  classic("crescentMoon", fillCrescentMoon),
  classic("concentricSquares", fillConcentricSquares), classic("scallops", fillScallops),
  classic("spiralBands", fillSpiralBands), classic("paradox", fillParadox), classic("flux", fillFlux),
];

// "iconic": imágenes reconocibles + texturas suaves (mezcla más memorable).
const SOFT = ["bubbles", "scales", "rainbows", "clouds", "flowers", "leaves", "mandala", "honeycomb", "polka", "hearts"];

const ICON_IDS = new Set(ICONS.map((m) => m.id));

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

// Asigna un motivo por unidad sin repetir hasta agotar la paleta; las masas
// negras ("heavy") no se juntan con vecinas ya asignadas ni superan el tope.
// neighbors(k) devuelve los índices (< k) que tocan a la unidad k.
function assignMotifs(rng, pool, n, neighbors, solids, heavyShare) {
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
    const near = neighbors(k).map((q) => out[q]);
    const heavyOk = (m) => !solids || !m.heavy || (heavyCount < maxHeavy && !near.some((x) => x?.heavy));
    let idx = queue.findIndex(heavyOk);
    if (idx < 0) idx = 0;
    const m = queue.splice(idx, 1)[0];
    if (solids && m.heavy) heavyCount++;
    out.push(m);
  }
  return out;
}

// Retícula de contenedores iguales (círculo, cuadro o cuadro redondeado).
function gridUnits(rng, a, count, gap, borderMm, pool, solids, heavyShare, shapeOpt) {
  const { cols, rows, size } = pickGrid(count, a.w, a.h, gap);
  const gridW = cols * size + (cols - 1) * gap, gridH = rows * size + (rows - 1) * gap;
  const ox = a.x + (a.w - gridW) / 2, oy = a.y + (a.h - gridH) / 2;
  const motifs = assignMotifs(rng, pool, cols * rows, (k) => {
    const i = k % cols, j = Math.floor(k / cols), nb = [];
    if (i > 0) nb.push(k - 1);
    if (j > 0) nb.push(k - cols);
    return nb;
  }, solids, heavyShare);
  const shapes = ["circle", "rounded", "square"];
  const units = [];
  for (let k = 0; k < cols * rows; k++) {
    const i = k % cols, j = Math.floor(k / cols);
    const x0 = ox + i * (size + gap), y0 = oy + j * (size + gap);
    const cx = x0 + size / 2, cy = y0 + size / 2, R = size / 2;
    const shape = shapeOpt === "mixed" ? shapes[Math.floor(rng() * shapes.length)] : shapeOpt;
    const isCircle = shape === "circle";
    const rx = shape === "rounded" ? size * 0.14 : 0;
    const inset = borderMm / 2;
    units.push({
      motif: motifs[k],
      box: { x0, y0, x1: x0 + size, y1: y0 + size },
      inside: isCircle
        ? (x, y, over) => Math.hypot(x - cx, y - cy) <= R + over
        : (x, y, over) => Math.abs(x - cx) <= R + over && Math.abs(y - cy) <= R + over,
      clip: isCircle
        ? `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(R)}"/>`
        : `<rect x="${fmt(x0)}" y="${fmt(y0)}" width="${fmt(size)}" height="${fmt(size)}" rx="${fmt(rx)}"/>`,
      border: isCircle
        ? `<circle cx="${fmt(cx)}" cy="${fmt(cy)}" r="${fmt(R - inset)}" fill="none" stroke="#000" stroke-width="${fmt(borderMm)}"/>`
        : `<rect x="${fmt(x0 + inset)}" y="${fmt(y0 + inset)}" width="${fmt(size - borderMm)}" height="${fmt(size - borderMm)}" rx="${fmt(Math.max(0, rx - inset))}" fill="none" stroke="#000" stroke-width="${fmt(borderMm)}" stroke-linejoin="round"/>`,
    });
  }
  return units;
}

const polyD = (poly) => poly.map((p, i) => `${i ? "L" : "M"}${fmt(p.x)} ${fmt(p.y)}`).join(" ") + " Z";

// Teselado periódico (hexágonos, 4.8², 4.6.12, Cairo, rombille). Cada celda es
// un polígono convexo: el motivo recibe una caja cuadrada centrada en él. Los
// iconos usan la caja inscrita (no se recortan); las texturas una mayor, para
// llegar a las esquinas.
function tilingUnits(rng, a, count, gap, borderMm, pool, solids, heavyShare, layout) {
  const cells = tileArea(layout, a, count).map((c) => ({ ...c, poly: insetConvex(c.poly, gap / 2) }))
    .filter((c) => c.poly.length >= 3 && Math.abs(polyArea(c.poly)) > 4).map((c) => {
    const poly = c.poly;
    const cen = polyCentroid(poly);
    const ri = distToEdges(cen.x, cen.y, poly);
    const rc = Math.max(...poly.map((p) => Math.hypot(p.x - cen.x, p.y - cen.y)));
    return { poly, cen, ri, rc, minor: c.minor, partial: c.partial };
  });
  // Una tesela cortada por el borde puede llevar icono si conserva casi todo su
  // círculo inscrito; si no, recibe una textura como las teselas chicas.
  const refRi = Math.max(0, ...cells.filter((c) => !c.minor && !c.partial).map((c) => c.ri));
  for (const c of cells) if (c.partial && (c.minor || c.ri < refRi * 0.8)) c.minor = true;

  // Vecinas: celdas que comparten arista (centros a menos de la suma de radios).
  const near = (i, j) => Math.hypot(cells[i].cen.x - cells[j].cen.x, cells[i].cen.y - cells[j].cen.y) < (cells[i].rc + cells[j].rc) * 0.98 + gap;
  const major = cells.map((c, i) => i).filter((i) => !cells[i].minor);
  // Las teselas chicas sin espacio para una textura coloreable quedan vacías:
  // son ellas mismas una región para pintar.
  const minorIdx = cells.map((c, i) => i).filter((i) => cells[i].minor && cells[i].ri >= 7);
  const pos = new Map(major.map((ci, k) => [ci, k]));
  const majorMotifs = assignMotifs(rng, pool, major.length,
    (k) => major.slice(0, k).filter((cj) => near(major[k], cj)).map((cj) => pos.get(cj)), solids, heavyShare);
  // Las teselas chicas llevan texturas livianas: los iconos ahí quedarían diminutos.
  // Escamas, flores y arcoíris se vuelven astillas sin espacio para colorear en
  // teselas chicas (métrica de colorabilidad), así que se omiten ahí.
  const fine = new Set(["scales", "flowers", "rainbows"]);
  let texPool = pool.filter((m) => !ICON_IDS.has(m.id) && !m.heavy && !fine.has(m.id));
  if (texPool.length < 3) texPool = MOTIFS.filter((m) => SOFT.includes(m.id) && !fine.has(m.id));
  const minorMotifs = assignMotifs(rng, texPool, minorIdx.length, () => [], false, 0);

  const motifOf = new Map();
  major.forEach((ci, k) => motifOf.set(ci, majorMotifs[k]));
  minorIdx.forEach((ci, k) => motifOf.set(ci, minorMotifs[k]));

  return cells.map((c, i) => {
    const m = motifOf.get(i) || null;
    const h = m && ICON_IDS.has(m.id) ? c.ri * 1.04 : Math.min(c.rc, (c.ri + c.rc) / 2);
    const inner = insetConvex(c.poly, borderMm / 2);
    return {
      motif: m,
      minor: c.minor,
      box: { x0: c.cen.x - h, y0: c.cen.y - h, x1: c.cen.x + h, y1: c.cen.y + h },
      inside: (x, y, over) => (pointInPoly(x, y, c.poly) ? -distToEdges(x, y, c.poly) : distToEdges(x, y, c.poly)) <= over,
      clip: `<path d="${polyD(c.poly)}"/>`,
      border: `<path d="${polyD(inner)}" fill="none" stroke="#000" stroke-width="${fmt(borderMm)}" stroke-linejoin="round"/>`,
    };
  });
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

  if (opts.drawOuterBorder === true) {
    doc.body.push(`<rect x="${fmt(a.x)}" y="${fmt(a.y)}" width="${fmt(a.w)}" height="${fmt(a.h)}" fill="none" stroke="#000" stroke-width="${fmt(borderMm)}" stroke-linejoin="round"/>`);
  }

  const layout = TILINGS[opts.samplerLayout] ? opts.samplerLayout : "grid";
  const units = layout === "grid"
    ? gridUnits(rng, a, count, gap, borderMm, pool, solids, heavyShare, shapeOpt)
    : tilingUnits(rng, a, count, gap, borderMm, pool, solids, heavyShare, layout);

  units.forEach((u, k) => {
    const trng = createRNG(hash(seed, 1000 + k));
    const sw = strokeMm * rFloat(trng, 1 - strokeVar * 0.6, 1 + strokeVar);
    const cfg = { minGapMm, patternStrokeMm: sw, sketchy, solids, inside: u.inside };

    let layers = [];
    if (u.motif) {
      try { layers = u.motif.fn(trng, u.box, cfg) || []; } catch (e) { layers = []; }
      layers = layers.filter((l) => l && l.d);
      if (!layers.length) {
        const fallback = MOTIFS.find((m) => m.id === "bubbles").fn(trng, u.box, cfg);
        layers = fallback.filter((l) => l.d);
      }
    }

    const clipId = `${prefix}c${k}`;
    pushDef(`<clipPath id="${clipId}">${u.clip}</clipPath>`);

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
    if (u.motif) {
      doc.body.push(`<g clip-path="url(#${clipId})" data-motif="${u.motif.id}"${u.minor ? ' data-minor="1"' : ""}>${paths.join("")}</g>`);
    }
    doc.body.push(u.border);
  });

  if (!useDocDefs && localDefs.length) doc.body.unshift(`<defs>${localDefs.join("")}</defs>`);
}
export { POOLS };

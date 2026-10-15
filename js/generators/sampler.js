// sampler.js
// Modo muestrario: una retícula de contenedores iguales (círculos o cuadros) o
// un teselado periódico (samplerLayout), cada unidad con UN motivo distinto, como las hojas de "doodle patterns".
// Contrasta con zentangleCells: allí las celdas son irregulares y los patrones
// genéricos; aquí cada unidad es una idea reconocible (corazones, gotas, nubes,
// tablero...) y la hoja mezcla negros sólidos, rayado y blancos.
import { createRNG, hash, rFloat, rInt } from "../core/prng.js";
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

// Icono como patrón: en vez de una sola imagen al centro, el icono se repite en
// copias más chicas que llenan la unidad, ordenadas según un grupo de simetría
// del plano (wallpaper group; hay 17, se usan los que encajan en la retícula):
//   p1  traslación          pm  espejo en columnas alternas
//   pg  deslizamiento (espejo en filas alternas)
//   p2  giro de 180° en damero   pmm espejos en ambos ejes
//   p4  giros de 90° (retícula cuadrada)   p3/p6 giros de 120°/60° (alternada)
// Los iconos con orientación (gato, cactus...) solo usan p1/pm/pg para no
// quedar de cabeza. Las copias que tocan el borde se cortan contra la celda.
// Solo los iconos de un objeto se repiten (los que ya son composiciones, como el
// campo de estrellas o los hongos, se vuelven confeti), cada uno con un diámetro
// mínimo por copia para que sus detalles sigan siendo coloreables.
const REPEATABLE = { cat: 28, cactus: 24, umbrella: 24, lotus: 24, owl: 30, butterfly: 28, sun: 34, feather: 24 };
const UPRIGHT = new Set(["cat", "cactus", "mushrooms", "umbrella", "tulips", "lotus", "owl"]);
const GROUPS_UPRIGHT = ["p1", "pm", "pg"];
const GROUPS_FREE = ["p1", "pm", "pg", "p2", "pmm", "p4", "p3", "p6"];
const SQUARE_GROUPS = new Set(["p2", "pmm", "p4"]);

function copyTransform(group, i, j) {
  const odd = (v) => ((v % 2) + 2) % 2 === 1;
  switch (group) {
    case "pm": return { rot: 0, mirror: odd(i) };
    case "pg": return { rot: 0, mirror: odd(j) };
    case "p2": return { rot: odd(i + j) ? 180 : 0, mirror: false };
    case "pmm": return { rot: odd(j) ? 180 : 0, mirror: odd(i + j) };
    case "p4": return { rot: 90 * ((((i + 2 * j) % 4) + 4) % 4), mirror: false };
    case "p3": return { rot: 120 * ((((i - j) % 3) + 3) % 3), mirror: false };
    case "p6": return { rot: 60 * ((((i + 2 * j) % 6) + 6) % 6), mirror: false };
    default: return { rot: 0, mirror: false };
  }
}

function iconPattern(motif, rng, box, cfg) {
  const minMm = REPEATABLE[motif.id];
  if (!minMm) return null;
  const side = Math.min(box.x1 - box.x0, box.y1 - box.y0);
  const nMax = Math.floor(side / minMm);
  if (nMax < 2) return null;
  const groups = UPRIGHT.has(motif.id) ? GROUPS_UPRIGHT : GROUPS_FREE;
  const group = groups[Math.floor(rng() * groups.length)];
  const square = SQUARE_GROUPS.has(group);
  const n = rInt(rng, 2, Math.min(4, nMax));
  const p = side / n, py = square ? p : p * 0.88, half = p * 0.47;
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const reach = Math.ceil(n / 2) + 2;
  const layers = [];
  let copies = 0;
  for (let j = -reach; j <= reach; j++) {
    for (let i = -reach; i <= reach; i++) {
      const x = cx + (i + (!square && j & 1 ? 0.5 : 0)) * p, y = cy + j * py;
      // Como en una tela estampada, las copias del borde se cortan contra la
      // celda (el recorte de la unidad las limita); solo se omiten las que
      // apenas asomarían.
      if (!cfg.inside(x, y, half * 0.35)) continue;
      const sub = { x0: x - half, y0: y - half, x1: x + half, y1: y + half };
      // El giro/espejo es alrededor del centro de la copia: su círculo no cambia.
      const subCfg = { ...cfg, minGapMm: cfg.minGapMm * 1.35, inside: (qx, qy, o) => Math.hypot(qx - x, qy - y) <= half + o };
      const { rot, mirror } = copyTransform(group, i, j);
      const tf = rot || mirror
        ? `translate(${fmt(x)} ${fmt(y)})${rot ? ` rotate(${rot})` : ""}${mirror ? " scale(-1 1)" : ""} translate(${fmt(-x)} ${fmt(-y)})`
        : null;
      let ls = [];
      try { ls = (motif.fn(rng, sub, subCfg) || []).filter((l) => l && l.d); } catch (e) { ls = []; }
      if (!ls.length) continue;
      copies++;
      for (const l of ls) layers.push(tf ? { ...l, tf } : l);
    }
  }
  // Con menos de 3 copias el patrón no se lee: mejor la imagen única grande.
  return copies >= 3 ? layers : null;
}

// Icono fractal: una copia grande y, en los huecos, copias cada vez más chicas
// (empaquetado voraz de círculos con radios en progresión geométrica, como un
// tamiz de Apolonio truncado). Se detiene en el diámetro mínimo coloreable.
function iconFractal(motif, rng, box, cfg) {
  const minMm = REPEATABLE[motif.id];
  if (!minMm) return null;
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  const sep = cfg.minGapMm * 1.5;
  // Radio máximo en el centro: el círculo debe caber entero en la unidad.
  let lo = 0, hi = (box.x1 - box.x0) / 2;
  for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (cfg.inside(cx, cy, -m)) lo = m; else hi = m; }
  // Solo el último nivel llega al mínimo, así que se tolera algo menos que en
  // el patrón. La copia central es grande; las demás ocupan los huecos y las
  // esquinas de la unidad.
  const rMin = (minMm / 2) * 0.7;
  const r0 = lo * rFloat(rng, 0.5, 0.58);
  const circles = [{ x: cx, y: cy, r: r0 }];
  // Las copias pueden asomar un poco fuera de la celda y quedar cortadas.
  const fits = (x, y, r) => cfg.inside(x, y, -r * 0.45) && circles.every((c) => Math.hypot(x - c.x, y - c.y) >= c.r + r + sep);
  for (let r = r0 * 0.6; r >= rMin; r *= 0.82) {
    const step = Math.max(1, r / 3), pts = [];
    for (let y = box.y0 + r; y <= box.y1 - r; y += step) for (let x = box.x0 + r; x <= box.x1 - r; x += step) pts.push({ x, y });
    // Orden aleatorio pero determinista: distribuye las copias por toda la unidad.
    for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
    for (const q of pts) if (fits(q.x, q.y, r)) circles.push({ x: q.x, y: q.y, r });
  }
  if (circles.length < 3) return null;
  const upright = UPRIGHT.has(motif.id);
  const layers = [];
  circles.forEach((c, k) => {
    // Los iconos dibujan a ~0.75 de su caja: se agranda para que llenen el círculo.
    const h = c.r * 1.18;
    const sub = { x0: c.x - h, y0: c.y - h, x1: c.x + h, y1: c.y + h };
    const subCfg = { ...cfg, minGapMm: cfg.minGapMm * 1.35, inside: (qx, qy, o) => Math.hypot(qx - c.x, qy - c.y) <= c.r + o };
    const rot = upright || k === 0 ? 0 : 30 * Math.floor(rng() * 12);
    const mirror = k > 0 && rng() < 0.5;
    const tf = rot || mirror
      ? `translate(${fmt(c.x)} ${fmt(c.y)})${rot ? ` rotate(${rot})` : ""}${mirror ? " scale(-1 1)" : ""} translate(${fmt(-c.x)} ${fmt(-c.y)})`
      : null;
    let ls = [];
    try { ls = (motif.fn(rng, sub, subCfg) || []).filter((l) => l && l.d); } catch (e) { ls = []; }
    for (const l of ls) layers.push(tf ? { ...l, tf } : l);
  });
  return layers.length ? layers : null;
}

const polyD = (poly) => poly.map((p, i) => `${i ? "L" : "M"}${fmt(p.x)} ${fmt(p.y)}`).join(" ") + " Z";

// Teselado periódico (hexágonos, 4.8², 4.6.12, Cairo, rombille). Cada celda es
// un polígono convexo: el motivo recibe una caja cuadrada centrada en él. Los
// iconos usan la caja inscrita (no se recortan); las texturas una mayor, para
// llegar a las esquinas.
function tilingUnits(rng, a, count, gap, borderMm, pool, solids, heavyShare, layout, edge, iconMode) {
  const cells = tileArea(layout, a, count, edge).map((c) => ({ ...c, poly: insetConvex(c.poly, gap / 2) }))
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
  // En modo patrón el corte es parte del estilo: las teselas del borde también
  // llevan iconos repetidos.
  if (iconMode !== "pattern") for (const c of cells) if (c.partial && (c.minor || c.ri < refRi * 0.8)) c.minor = true;

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
      coverBox: { x0: c.cen.x - c.rc, y0: c.cen.y - c.rc, x1: c.cen.x + c.rc, y1: c.cen.y + c.rc },
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
  const iconMode = ["pattern", "fractal", "mixed"].includes(opts.samplerIconMode) ? opts.samplerIconMode : "single";

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
    : tilingUnits(rng, a, count, gap, borderMm, pool, solids, heavyShare, layout, opts.samplerEdge === "whole" ? "whole" : "fill", iconMode);

  units.forEach((u, k) => {
    const trng = createRNG(hash(seed, 1000 + k));
    const sw = strokeMm * rFloat(trng, 1 - strokeVar * 0.6, 1 + strokeVar);
    const cfg = { minGapMm, patternStrokeMm: sw, sketchy, solids, inside: u.inside };

    let layers = [];
    // samplerIconMode: "single" (una imagen), "pattern" (repetida con simetría),
    // "fractal" (copias de tamaño decreciente) o "mixed" (sorteo entre los tres).
    // Se sortea con un generador aparte para no alterar los demás motivos.
    let mode = "single";
    if (u.motif && ICON_IDS.has(u.motif.id) && !u.minor) {
      mode = iconMode === "mixed" ? ["single", "pattern", "fractal"][Math.floor(createRNG(hash(seed, 5000 + k))() * 3)] : iconMode;
    }
    if (mode === "pattern") layers = (iconPattern(u.motif, trng, u.coverBox || u.box, cfg) || []).filter((l) => l && l.d);
    if (mode === "fractal") layers = (iconFractal(u.motif, trng, u.coverBox || u.box, cfg) || []).filter((l) => l && l.d);
    if (u.motif && !layers.length) {
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
      let out = el;
      if (l.clipD) {
        const id = `${clipId}_${nClip++}`;
        pushDef(`<clipPath id="${id}"><path d="${l.clipD}"/></clipPath>`);
        out = `<g clip-path="url(#${id})">${el}</g>`;
      }
      // l.tf: giro/espejo de la copia en los patrones de iconos.
      return l.tf ? `<g transform="${l.tf}">${out}</g>` : out;
    });
    if (u.motif) {
      doc.body.push(`<g clip-path="url(#${clipId})" data-motif="${u.motif.id}"${u.minor ? ' data-minor="1"' : ""}>${paths.join("")}</g>`);
    }
    doc.body.push(u.border);
  });

  if (!useDocDefs && localDefs.length) doc.body.unshift(`<defs>${localDefs.join("")}</defs>`);
}
export { POOLS };

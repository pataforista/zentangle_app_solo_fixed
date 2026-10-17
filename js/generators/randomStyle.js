// randomStyle.js
// Modo aleatorio de estilos: dada una semilla elige, de forma determinista, un
// estilo de TODA la biblioteca y, en los muestrarios, también su distribución,
// bordes, forma, conjunto de motivos y modo de iconos. Misma semilla => mismo
// estilo, así "Otro diseño", la galería y cada página de un libro mezclan estilos
// y se pueden reproducir.
//
// No hay una lista fija: los presets se agrupan por tipo leyendo
// ZENTANGLE_PRESETS, de modo que cualquier preset nuevo entra solo en el sorteo.
import { ZENTANGLE_PRESETS } from "./zentangle.presets.js";
import { TILING_NAMES } from "./samplerTilings.js";
import { LAYOUT_TEMPLATES } from "./layoutTemplates.js";
import { POOLS } from "./sampler.js";
import { createRNG, hash, rInt } from "../core/prng.js";

export const RANDOM_STYLE_KEY = "random_all";
// Variante para libros de colorear: excluye los estilos con rellenos negros.
export const RANDOM_COLOR_KEY = "random_color";
// "Más vendidos": mezcla curada de los estilos con más salida en libros para
// colorear de KDP (mandalas, animales e iconos tiernos, mosaicos geométricos
// para adultos, zentangle con figura), todos sin rellenos negros.
export const BESTSELLER_KEY = "best_sellers";
export const isRandomKey = (key) => key === RANDOM_STYLE_KEY || key === RANDOM_COLOR_KEY || key === BESTSELLER_KEY;

// Peso = páginas de cada estilo por cada 20 del libro. La lista combina la
// demanda del nicho con la métrica de colorabilidad (_samples/colorability.mjs)
// y una revisión visual. Se excluyen bold_easy (cajas con patrones diminutos,
// no el "bold & easy" de figuras grandes que se vende con ese nombre),
// botanical_zen (sin plantas reales), kdp_relaxed (denso) y facet_spiral
// (la peor colorabilidad de la biblioteca).
// La figura zentangle (zen_figure) lleva casi la mitad del libro: es el
// formato de los títulos líderes del nicho (figura grande llena de tangles).
// Los muestrarios bajan: se leen más como libro infantil que como zentangle.
export const BESTSELLERS = [
  ["zen_figure", 8], ["icon_mandala", 2], ["zen_star", 2], ["classic_z_string", 2],
  ["sampler_icons", 2], ["eye_focus", 1], ["sampler_hex", 1], ["sampler_icon_fractal", 1], ["sampler_cairo", 1],
];

// Mazo del libro: las 20 cartas de BESTSELLERS barajadas con la semilla del
// libro y ordenadas para que dos páginas seguidas nunca repitan estilo (la
// carta siguiente es la de más copias restantes distinta de la anterior).
function bestSellerDeck(bookSeed) {
  const rng = createRNG(hash(bookSeed >>> 0, 0xb357));
  for (let w = 0; w < 12; w++) rng();
  // Copias restantes por estilo; el desempate aleatorio va aparte para no
  // alterar cuántas cartas tiene cada uno.
  const left = new Map(BESTSELLERS.filter(([k]) => ZENTANGLE_PRESETS[k]).map(([k, w]) => [k, { c: w, tie: rng() }]));
  const score = (k) => left.get(k).c + left.get(k).tie * 0.5;
  const deck = [];
  while (left.size) {
    const prev = deck[deck.length - 1];
    let best = null;
    for (const k of left.keys()) if (k !== prev && (!best || score(k) > score(best))) best = k;
    if (!best) best = prev;
    deck.push(best);
    if (--left.get(best).c === 0) left.delete(best);
  }
  return deck;
}

// Estilos de un libro página a página: cada vuelta de 20 páginas usa su propio
// mazo barajado. Si una vuelta empezaría con el estilo con que acabó la
// anterior, se adelanta la primera carta que no rompa la regla de no repetir.
function bookStyles(bookSeed) {
  const decks = [];
  const deckAt = (c) => {
    while (decks.length <= c) {
      const k = decks.length;
      const d = bestSellerDeck(k === 0 ? bookSeed : hash(bookSeed >>> 0, 0x5eed + k));
      const prevLast = k > 0 ? decks[k - 1][decks[k - 1].length - 1] : null;
      if (prevLast && d[0] === prevLast) {
        for (let j = 1; j < d.length; j++) {
          if (d[j] === prevLast || (j + 1 < d.length && d[j - 1] === d[j + 1])) continue;
          d.unshift(d.splice(j, 1)[0]);
          break;
        }
      }
      decks.push(d);
    }
    return decks[c];
  };
  return (i) => { const len = deckAt(0).length; return deckAt(Math.floor(i / len))[i % len]; };
}

// Estilo de la página: con pageIndex sigue el mazo del libro (proporciones
// exactas y sin repeticiones seguidas); sin él, sorteo ponderado por semilla.
export function resolveBestSeller(seed, { pageIndex = null, bookSeed = null } = {}) {
  let presetName;
  if (Number.isInteger(pageIndex) && pageIndex >= 0) {
    const styleAt = bookStyles(bookSeed ?? seed);
    presetName = styleAt(pageIndex);
    // Páginas de figura anteriores a esta: fija qué figura le toca (recorre
    // todas antes de repetir; ver figureForPage).
    if (ZENTANGLE_PRESETS[presetName]?.cellLayout === "zen_figure") {
      let n = 0;
      for (let i = 0; i < pageIndex; i++) if (ZENTANGLE_PRESETS[styleAt(i)]?.cellLayout === "zen_figure") n++;
      return { presetName, overrides: { figurePage: n }, group: "bestseller" };
    }
  } else {
    const rng = createRNG(hash(seed >>> 0, 0xb358));
    for (let w = 0; w < 12; w++) rng();
    const list = BESTSELLERS.filter(([k]) => ZENTANGLE_PRESETS[k]);
    let r = rng() * list.reduce((a, [, w]) => a + w, 0);
    presetName = list[list.length - 1][0];
    for (const [k, w] of list) { if ((r -= w) < 0) { presetName = k; break; } }
  }
  const p = ZENTANGLE_PRESETS[presetName];
  return { presetName, overrides: p.cellLayout === "sampler" ? { samplerSolids: false } : {}, group: "bestseller" };
}

// Presets que no dibujan en celdas del motor (página completa o muestrario).
const NON_CELL = new Set(["sampler", "icon_mandala", "facet_spiral", "zen_figure"]);

const groupOf = (name, p) => {
  if (p.cellLayout === "sampler") return "sampler";
  if (NON_CELL.has(p.cellLayout) || p.cellLayout === "star") return "figure";
  if (p.cellLayout === "template") return "template";
  return name.startsWith("kdp_") ? "kdp" : "classic";
};

// Peso de cada familia: la de muestrarios es la más grande en cantidad de
// presets y no debe acaparar el sorteo.
const WEIGHTS = { kdp: 0.22, classic: 0.2, template: 0.08, sampler: 0.28, figure: 0.22 };

// Teselas principales por página según el teselado (las chicas se suman).
const TILING_COUNT = { hex: [12, 18], octagons: [10, 14], dodecagons: [6, 10], cairo: [12, 16], rhombille: [12, 16] };
const SHAPES = ["circle", "rounded", "square", "mixed"];
const SETS = Object.keys(POOLS);

// Apto para colorear = sin rellenos negros. Solo los muestrarios los producen
// (con samplerSolids); en ellos "sin definir" cuenta como tinta, porque
// sampler.js usa solids salvo que samplerSolids sea false.
export const isColoringSafe = (p) => p.cellLayout !== "sampler" || p.samplerSolids === false;

export function randomStyleGroups({ cellsOnly = false, coloringOnly = false } = {}) {
  const groups = {};
  for (const [name, p] of Object.entries(ZENTANGLE_PRESETS)) {
    if (cellsOnly && NON_CELL.has(p.cellLayout)) continue;
    if (coloringOnly && !isColoringSafe(p)) continue;
    (groups[groupOf(name, p)] ||= []).push(name);
  }
  return groups;
}

const chance = (rng, p) => rng() < p;
const pickOf = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function randomizeSampler(rng, p) {
  const o = {};
  // Distribución: los presets de teselado conservan la suya; los genéricos
  // eligen retícula (30 %) o uno de los teselados.
  const layout = p.samplerLayout || (chance(rng, 0.3) ? "grid" : pickOf(rng, TILING_NAMES));
  o.samplerLayout = layout;
  if (layout === "grid") o.samplerShape = pickOf(rng, SHAPES);
  else o.samplerEdge = chance(rng, 0.6) ? "fill" : "whole";

  // Conjunto de motivos: los presets de iconos como patrón/fractal lo necesitan.
  const needsIcons = p.samplerIconMode === "pattern" || p.samplerIconMode === "fractal";
  o.samplerSet = needsIcons ? p.samplerSet : pickOf(rng, SETS);
  const hasIcons = ["all", "iconic", "icons"].includes(o.samplerSet);

  // Modo de iconos.
  let mode = p.samplerIconMode || "single";
  if (!p.samplerIconMode && hasIcons) {
    const r = rng();
    mode = r < 0.4 ? "single" : r < 0.6 ? "pattern" : r < 0.75 ? "fractal" : "mixed";
  }
  o.samplerIconMode = mode;

  // Cantidad de unidades: las copias repetidas o fractales necesitan unidades
  // grandes; los teselados tienen su rango propio.
  if (mode !== "single" && o.samplerSet !== "all") {
    const [lo, hi] = mode === "fractal" ? [4, 7] : mode === "pattern" ? [6, 10] : [6, 12];
    o.cellCount = rInt(rng, lo, hi);
  } else if (layout !== "grid" && !p.samplerLayout) {
    const [lo, hi] = TILING_COUNT[layout];
    o.cellCount = rInt(rng, lo, hi);
  }
  return o;
}

export function resolveRandomStyle(seed, { cellsOnly = false, coloringOnly = false } = {}) {
  const rng = createRNG(hash(seed >>> 0, 0x2a4d));
  for (let w = 0; w < 12; w++) rng();
  const groups = randomStyleGroups({ cellsOnly, coloringOnly });
  const keys = Object.keys(groups);
  const total = keys.reduce((s, k) => s + WEIGHTS[k], 0);
  let r = rng() * total, group = keys[keys.length - 1];
  for (const k of keys) { if ((r -= WEIGHTS[k]) < 0) { group = k; break; } }
  const presetName = pickOf(rng, groups[group]);
  const p = ZENTANGLE_PRESETS[presetName];

  let overrides = {};
  if (group === "sampler") overrides = randomizeSampler(rng, p);
  // Garantía explícita, por si el sorteo de un muestrario cambiara su tinta.
  if (coloringOnly && group === "sampler") overrides.samplerSolids = false;
  // Plantillas: la mitad de las veces usa una de las seis (burst y la S
  // clásica no tienen preset propio).
  if (group === "template" && chance(rng, 0.5)) overrides.templateName = pickOf(rng, Object.keys(LAYOUT_TEMPLATES));
  return { presetName, overrides, group };
}

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

// Presets que no dibujan en celdas del motor (página completa o muestrario).
const NON_CELL = new Set(["sampler", "icon_mandala", "facet_spiral"]);

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

export function randomStyleGroups({ cellsOnly = false } = {}) {
  const groups = {};
  for (const [name, p] of Object.entries(ZENTANGLE_PRESETS)) {
    if (cellsOnly && NON_CELL.has(p.cellLayout)) continue;
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

export function resolveRandomStyle(seed, { cellsOnly = false } = {}) {
  const rng = createRNG(hash(seed >>> 0, 0x2a4d));
  for (let w = 0; w < 12; w++) rng();
  const groups = randomStyleGroups({ cellsOnly });
  const keys = Object.keys(groups);
  const total = keys.reduce((s, k) => s + WEIGHTS[k], 0);
  let r = rng() * total, group = keys[keys.length - 1];
  for (const k of keys) { if ((r -= WEIGHTS[k]) < 0) { group = k; break; } }
  const presetName = pickOf(rng, groups[group]);
  const p = ZENTANGLE_PRESETS[presetName];

  let overrides = {};
  if (group === "sampler") overrides = randomizeSampler(rng, p);
  // Plantillas: la mitad de las veces usa una de las seis (burst y la S
  // clásica no tienen preset propio).
  if (group === "template" && chance(rng, 0.5)) overrides.templateName = pickOf(rng, Object.keys(LAYOUT_TEMPLATES));
  return { presetName, overrides, group };
}

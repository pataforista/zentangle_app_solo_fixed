// zentangle.generator.js
import { ZENTANGLE_PRESETS } from "./zentangle.presets.js";
import { generateZentangleCells } from "./zentangleCells.js";
import { generateSampler } from "./sampler.js";
import { generateIconMandala, generateFacetSpiral } from "./ornaments.js";
import { RANDOM_STYLE_KEY, resolveRandomStyle } from "./randomStyle.js";

function normalizeAreaMm(areaMm, fallback = { x: 0, y: 0 }) {
  if (!areaMm || typeof areaMm !== "object") {
    throw new Error("buildZentangleOpts: areaMm debe ser un objeto");
  }
  const x = Number.isFinite(areaMm.x) ? areaMm.x : fallback.x;
  const y = Number.isFinite(areaMm.y) ? areaMm.y : fallback.y;
  const w = Number.isFinite(areaMm.w) ? areaMm.w : (Number.isFinite(areaMm.wMm) ? areaMm.wMm : NaN);
  const h = Number.isFinite(areaMm.h) ? areaMm.h : (Number.isFinite(areaMm.hMm) ? areaMm.hMm : NaN);
  if (!Number.isFinite(w) || !Number.isFinite(h)) {
    throw new Error("buildZentangleOpts: areaMm requiere w/h (o wMm/hMm)");
  }
  return { x, y, w, h };
}

// presetName "random_all": cada semilla sortea su propio estilo de toda la
// biblioteca (ver randomStyle.js). Devuelve el estilo realmente usado.
export async function generateZentangle(doc, {
  seed = 123456789,
  areaMm,
  presetName = "editorial_airy",
  overrides = {},
  cellsOnly = false,
} = {}) {
  const area = normalizeAreaMm(areaMm);
  let randomOverrides = {};
  if (presetName === RANDOM_STYLE_KEY) {
    const r = resolveRandomStyle(seed, { cellsOnly });
    presetName = r.presetName;
    randomOverrides = r.overrides;
  }
  const preset = ZENTANGLE_PRESETS[presetName] ?? ZENTANGLE_PRESETS.editorial_airy;

  // Canonical generator: supports all current layouts/presets (rect_bsp, hex, tri, voronoi, strings).
  // Los overrides del llamador ganan sobre el sorteo aleatorio.
  const finalOpts = {
    ...preset,
    ...randomOverrides,
    ...overrides,
    seed,
    areaMm: area,
  };

  // Composiciones de página completa (mandala de iconos, pétalos facetados).
  const ORNAMENTS = { icon_mandala: generateIconMandala, facet_spiral: generateFacetSpiral };
  if (ORNAMENTS[finalOpts.cellLayout]) {
    await ORNAMENTS[finalOpts.cellLayout](doc, finalOpts);
    return { presetName };
  }

  // Muestrario: retícula de círculos/cuadros con un motivo por unidad.
  if (finalOpts.cellLayout === "sampler") {
    await generateSampler(doc, finalOpts);
    return { presetName };
  }

  await generateZentangleCells(doc, finalOpts);
  return { presetName };
}

// zentangle.generator.js
import { ZENTANGLE_PRESETS } from "./zentangle.presets.js";
import { generateZentangleCells } from "./zentangleCells.js";
import { generateSampler } from "./sampler.js";
import { generateIconMandala, generateFacetSpiral } from "./ornaments.js";
import { fillDeadSpace } from "./deadSpace.js";
import { generateZenFigure, figureForPage } from "./figure.js";
import { isRandomKey, resolveBookStyle } from "./randomStyle.js";

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

// presetName "random_all" / "random_color": cada semilla sortea su propio estilo
// de la biblioteca (todos / solo sin rellenos negros; ver randomStyle.js). Devuelve el estilo realmente usado.
export async function generateZentangle(doc, {
  seed = 123456789,
  areaMm,
  presetName = "editorial_airy",
  overrides = {},
  cellsOnly = false,
  // Solo para "Más vendidos" dentro de un libro: posición de la página y
  // semilla del libro, para repartir los estilos en proporciones fijas.
  pageIndex = null,
  bookSeed = null,
  // rasterize(svg, wPx, hPx) => RGBA: activa el relleno de huecos muertos
  // (deadSpace.js) salvo que el estilo u overrides pongan fillDeadSpace: false.
  rasterize = null,
} = {}) {
  const area = normalizeAreaMm(areaMm);
  let randomOverrides = {};
  if (isRandomKey(presetName)) {
    const r = resolveBookStyle(presetName, seed, { pageIndex, bookSeed, cellsOnly });
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
  // Dificultad progresiva (0 fácil … 1 difícil) en estilos que no son figura:
  // el hueco mínimo se abre al principio del libro y se cierra al final.
  if (Number.isFinite(finalOpts.difficulty) && finalOpts.cellLayout !== "zen_figure") {
    const dl = Math.min(1, Math.max(0, finalOpts.difficulty));
    finalOpts.minGapMm = (Number(finalOpts.minGapMm) || 1.4) * (1.25 - 0.4 * dl);
  }
  // Figura zentangle dentro de un libro: cada página de figura toma la
  // siguiente figura del libro (no se repite hasta agotar todas).
  if (finalOpts.cellLayout === "zen_figure" && !finalOpts.figureName && Number.isInteger(pageIndex) && pageIndex >= 0) {
    finalOpts.figureName = figureForPage(bookSeed ?? seed, Number.isInteger(randomOverrides.figurePage) ? randomOverrides.figurePage : pageIndex);
  }

  await drawStyle(doc, finalOpts);
  // La figura deja secciones lisas a propósito (respiro para colorear): el
  // relleno de huecos con burbujas no aplica.
  if (rasterize && finalOpts.fillDeadSpace !== false && finalOpts.cellLayout !== "zen_figure") {
    await fillDeadSpace(doc, {
      areaMm: area, seed, rasterize,
      gapMm: Math.max(1.8, Number(finalOpts.minGapMm) || 0),
      strokeMm: Math.max(0.35, Math.min(0.6, Number(finalOpts.patternStrokeMm) || 0.45)),
    });
  }
  return { presetName };
}

async function drawStyle(doc, finalOpts) {
  // Composiciones de página completa (mandala de iconos, pétalos facetados).
  const ORNAMENTS = { icon_mandala: generateIconMandala, facet_spiral: generateFacetSpiral, zen_figure: generateZenFigure };
  if (ORNAMENTS[finalOpts.cellLayout]) return ORNAMENTS[finalOpts.cellLayout](doc, finalOpts);
  // Muestrario: retícula de círculos/cuadros con un motivo por unidad.
  if (finalOpts.cellLayout === "sampler") return generateSampler(doc, finalOpts);
  return generateZentangleCells(doc, finalOpts);
}

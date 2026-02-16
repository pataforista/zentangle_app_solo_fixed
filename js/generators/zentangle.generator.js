// zentangle.generator.js
import { ZENTANGLE_PRESETS } from "./zentangle.presets.js";
import { generateZentangleCells } from "./zentangleCells.js";

// Back-compat / robustness:
// - Preferred: { x, y, w, h } in millimeters.
// - Legacy:   { wMm, hMm } (no origin). Origin defaults to (0,0).
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

/**
 * buildZentangleOpts({ seed, areaMm, presetName, density, complexity, overrides })
 *
 * Inputs de alto nivel:
 * - density (0..1): cuántas celdas y qué tan lleno se ve
 * - complexity (0..1): capas y variabilidad (rotación, draw-behind)
 *
 * Puedes pasar overrides para controlar variables finas (ver presets).
 */
export function buildZentangleOpts({
  seed,
  areaMm,
  presetName = "editorial_airy",
  density = 0.55,
  complexity = 0.55,
  overrides = {},
} = {}) {
  if (seed == null) seed = 123456789;
  if (!areaMm) throw new Error("buildZentangleOpts: areaMm es requerido");

  // Normalizar formato de área (compatibilidad con {wMm,hMm}).
  const area = normalizeAreaMm(areaMm);

  const preset = ZENTANGLE_PRESETS[presetName] ?? ZENTANGLE_PRESETS.editorial_airy;

  // Helpers de mapeo
  const clamp01 = (x) => Math.max(0, Math.min(1, Number(x)));
  const mix = (a, b, t) => a + (b - a) * clamp01(t);

  density = clamp01(density);
  complexity = clamp01(complexity);

  // Si el preset ya trae cellLayout, lo respetamos, salvo override explícito
  const cellLayout = overrides.cellLayout ?? preset.cellLayout ?? "rect_bsp";

  // Rect BSP: mapear cantidad/tamaño
  const cellCount = Number(overrides.cellCount ?? preset.cellCount ?? Math.round(mix(22, 42, density)));
  const minCellSizeMm = Number(overrides.minCellSizeMm ?? preset.minCellSizeMm ?? mix(18, 12.5, density));

  // Hex/Tri: parámetros de tamaño
  const hexRadiusMm = Number(overrides.hexRadiusMm ?? preset.hexRadiusMm ?? mix(14, 10, density));
  const triSideMm = Number(overrides.triSideMm ?? preset.triSideMm ?? mix(26, 18, density));

  // Jerarquía de línea (mm)
  const minStrokeMm = Number(overrides.minStrokeMm ?? preset.minStrokeMm ?? 0.28);
  const cellBorderWidthMm = Number(overrides.cellBorderWidthMm ?? preset.cellBorderWidthMm ?? mix(0.78, 0.65, density));
  const patternStrokeMm = Number(overrides.patternStrokeMm ?? preset.patternStrokeMm ?? mix(0.36, 0.30, density));

  // Coloreabilidad
  const minGapMm = Number(overrides.minGapMm ?? preset.minGapMm ?? mix(1.7, 1.2, density));

  // Rotación (para grids puede saturar visualmente)
  const rotatePatterns = (overrides.rotatePatterns != null)
    ? !!overrides.rotatePatterns
    : (preset.rotatePatterns != null ? !!preset.rotatePatterns : (complexity >= 0.35));
  const rotationSet = overrides.rotationSet ?? preset.rotationSet ?? "ergonomic";

  // Márgenes internos
  const innerMarginMm = Number(overrides.innerMarginMm ?? preset.innerMarginMm ?? 0.7);
  const extraMarginWhenRotatedMm = Number(overrides.extraMarginWhenRotatedMm ?? preset.extraMarginWhenRotatedMm ?? 0.35);

  // Capas
  const layersPerCell = overrides.layersPerCell ?? preset.layersPerCell ?? "auto";
  const maxPatternPassesPerCell = Number(overrides.maxPatternPassesPerCell ?? preset.maxPatternPassesPerCell ?? (complexity > 0.65 ? 3 : 2));

  // Anti-saturación
  const whiteSpaceMm = Number(overrides.whiteSpaceMm ?? preset.whiteSpaceMm ?? mix(1.15, 0.6, density));
  const patternSkipProb = Number(overrides.patternSkipProb ?? preset.patternSkipProb ?? mix(0.22, 0.08, density));

  // Draw-behind
  const enableDrawBehind = (overrides.enableDrawBehind != null) ? !!overrides.enableDrawBehind : (preset.enableDrawBehind != null ? !!preset.enableDrawBehind : true);
  const drawBehindProbability = Number(overrides.drawBehindProbability ?? preset.drawBehindProbability ?? mix(0.40, 0.60, complexity));
  const allowDrawBehindOnLayer2 = (overrides.allowDrawBehindOnLayer2 != null) ? !!overrides.allowDrawBehindOnLayer2 : !!(preset.allowDrawBehindOnLayer2);

  // Familias de patrones
  const enableScallops = (overrides.enableScallops != null) ? !!overrides.enableScallops : (preset.enableScallops != null ? !!preset.enableScallops : true);
  const enableSpiralBands = (overrides.enableSpiralBands != null) ? !!overrides.enableSpiralBands : (preset.enableSpiralBands != null ? !!preset.enableSpiralBands : true);
  const enableAuraSquares = (overrides.enableAuraSquares != null) ? !!overrides.enableAuraSquares : (preset.enableAuraSquares != null ? !!preset.enableAuraSquares : true);

  // Borde orgánico interno (recomendado para "menos frío")
  const innerOrganicBorderEnabled = (overrides.innerOrganicBorderEnabled != null)
    ? !!overrides.innerOrganicBorderEnabled
    : (preset.innerOrganicBorderEnabled != null ? !!preset.innerOrganicBorderEnabled : true);
  const innerOrganicBorderInsetMm = Number(overrides.innerOrganicBorderInsetMm ?? preset.innerOrganicBorderInsetMm ?? 0.8);
  const innerOrganicJitterMm = Number(overrides.innerOrganicJitterMm ?? preset.innerOrganicJitterMm ?? 0.55);
  const innerOrganicRoundMm = Number(overrides.innerOrganicRoundMm ?? preset.innerOrganicRoundMm ?? 1.0);

  // Clip orgánico real (más riesgoso: puede generar micro-espacios; por defecto apagado)
  const organicBorder = (overrides.organicBorder != null) ? !!overrides.organicBorder : !!(preset.organicBorder);

  // New: Sketchy lines
  const sketchy = Number(overrides.sketchy ?? preset.sketchy ?? 0);

  // Output
  return {
    seed,
    areaMm: area,

    // Layout
    cellLayout,
    cellCount,
    minCellSizeMm,
    hexRadiusMm,
    triSideMm,

    // Stroke/spacing
    cellBorderWidthMm,
    patternStrokeMm,
    minStrokeMm,
    minGapMm,

    // Anti-saturación
    whiteSpaceMm,
    maxPatternPassesPerCell,
    patternSkipProb,
    allowDrawBehindOnLayer2,

    // Rotación / márgenes
    rotatePatterns,
    rotationSet,
    innerMarginMm,
    extraMarginWhenRotatedMm,

    // Pattern families
    enableScallops,
    enableSpiralBands,
    enableAuraSquares,

    // Draw-behind
    enableDrawBehind,
    drawBehindProbability,

    // Bordes orgánicos internos
    innerOrganicBorderEnabled,
    innerOrganicBorderInsetMm,
    innerOrganicJitterMm,
    innerOrganicRoundMm,

    // Clip orgánico real
    organicBorder,

    // Style
    sketchy,
  };
}

export function generateZentangle(doc, {
  seed = 123456789,
  areaMm,
  presetName = "editorial_airy",
  density = 0.55,
  complexity = 0.55,
  overrides = {},
} = {}) {
  const opts = buildZentangleOpts({ seed, areaMm, presetName, density, complexity, overrides });
  return generateZentangleCells(doc, opts);
}

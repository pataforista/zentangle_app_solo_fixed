// zentangle.generator.js
import { ZENTANGLE_PRESETS } from "./zentangle.presets.js";
import { generateZentangleCells } from "./zentangleCells.js";

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

export async function generateZentangle(doc, {
  seed = 123456789,
  areaMm,
  presetName = "editorial_airy",
  overrides = {},
} = {}) {
  const area = normalizeAreaMm(areaMm);
  const preset = ZENTANGLE_PRESETS[presetName] ?? ZENTANGLE_PRESETS.editorial_airy;

  // Canonical generator: supports all current layouts/presets (rect_bsp, hex, tri, voronoi, strings).
  const finalOpts = {
    ...preset,
    ...overrides,
    seed,
    areaMm: area,
  };

  generateZentangleCells(doc, finalOpts);
}

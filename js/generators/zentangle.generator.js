// zentangle.generator.js
import { ZENTANGLE_PRESETS } from "./zentangle.presets.js";
import { PartitionEngine } from "./partitionEngine.js";
import { PATTERN_LIBRARY } from "./patterns/library.js";
import { SVGPen, RoughPen } from "../core/penRenderer.js";
import { hash, createRNG, pick } from "../core/prng.js";
import { GeometryCore } from "../core/geometryCore.js";

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
  density = 0.55,
  complexity = 0.55,
  overrides = {},
} = {}) {
  const area = normalizeAreaMm(areaMm);
  const engine = new PartitionEngine(area, seed);

  const cellCount = overrides.cellCount || 30;
  const layout = overrides.cellLayout || "voronoi";

  let cells = [];
  if (layout === "voronoi") {
    cells = await engine.generateVoronoi(cellCount);
  } else {
    cells = engine.generateString(complexity);
  }

  cells = engine.validateAndRefine(cells, overrides.minGapMm || 1.4);

  // Layer 4: Setup SVG Rendering
  const paths = [];

  for (const cell of cells) {
    // Deterministic RNG for cell decisions (not just pattern internals)
    const cellRngSeed = hash(seed, cell.id);
    const cellRng = createRNG(cellRngSeed);

    if (cellRng() < (overrides.patternSkipProb || 0.1)) continue;

    const PenClass = (overrides.sketchy > 0) ? RoughPen : SVGPen;

    const pen = new PenClass({
      strokeWidth: overrides.patternStrokeMm || 0.35,
      sketchy: overrides.sketchy || 0,
      rng: cellRng,
      seed: cellRngSeed, // reproducible rough lines
      budget: 100 * (overrides.density || 1) // Simple budget
    });

    // Pick 1-2 patterns
    const available = Object.keys(PATTERN_LIBRARY);
    const pCount = (cellRng() < (overrides.complexity || 0.5)) ? 2 : 1;

    for (let i = 0; i < pCount; i++) {
      const pId = pick(cellRng, available);
      const pattern = PATTERN_LIBRARY[pId];
      pattern.render(cell, seed, pen, {
        density: overrides.density,
        spacing: 1.5 + cellRng() * 2
      });
    }

    // Border
    const borderPen = new PenClass({
      strokeWidth: overrides.cellBorderWidthMm || 0.7,
      sketchy: overrides.sketchy || 0,
      rng: cellRng,
      seed: cellRngSeed + 999
    });
    borderPen.polygon(cell.polygon, true);

    doc.body.push(borderPen.getSVGPath());
    doc.body.push(pen.getSVGPath());
  }
}

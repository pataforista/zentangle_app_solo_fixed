import { createSvgDoc, PAPER_SIZES_MM } from "./svgDoc.js";
import { renderSvgToString } from "./svgRender.js";
import { downloadText } from "./export.js";
import { getStateFromURL, setStateToURL, randomSeed32 } from "./urlState.js";

import { PRESETS, Z_PRESETS } from "./zentangle.presets.js";
import { generateZentangle } from "./zentangle.generator.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_STATE = {
  preset: "A4",
  mode: "zentangle",
  petals: 12,
  complexity: 110,
  seed: 1,
  zPreset: "editorial",
};

const ui = {
  paper: $("paper"),
  marginMm: $("marginMm"),
  seed: $("seed"),
  zPreset: $("zPreset"),

  cellCount: $("cellCount"),
  minCellSizeMm: $("minCellSizeMm"),

  cellBorderWidthMm: $("cellBorderWidthMm"),
  patternStrokeMm: $("patternStrokeMm"),
  minGapMm: $("minGapMm"),
  whiteSpaceMm: $("whiteSpaceMm"),

  maxPatternPassesPerCell: $("maxPatternPassesPerCell"),
  patternSkipProb: $("patternSkipProb"),
  rotatePatterns: $("rotatePatterns"),
  rotationSet: $("rotationSet"),

  innerOrganicBorderEnabled: $("innerOrganicBorderEnabled"),
  innerOrganicBorderInsetMm: $("innerOrganicBorderInsetMm"),
  innerOrganicJitterMm: $("innerOrganicJitterMm"),
  innerOrganicRoundMm: $("innerOrganicRoundMm"),

  btnRandomSeed: $("btnRandomSeed"),
  btnRender: $("btnRender"),
  btnDownloadSVG: $("btnDownloadSVG"),
  btnDownloadJSON: $("btnDownloadJSON"),

  previewInner: $("previewInner"),
  status: $("status"),
};

function num(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

function int(v, fallback = 0) {
  const x = parseInt(String(v), 10);
  return Number.isFinite(x) ? x : fallback;
}

function bool01(v) {
  return String(v) === "1";
}

/**
 * Motor: UI -> opts (con presets) -> generator -> SVG string
 * Mantener esto simple evita “se rompió al separar archivos”.
 */
function buildOptsFromUI() {
  const zPresetKey = String(ui.zPreset.value || "editorial");
  const zPreset = Z_PRESETS[zPresetKey] ?? Z_PRESETS.editorial;

  // Preset base “editorial/dense/airy” + overrides explícitos de UI
  const opts = {
    ...zPreset,

    // reproducibilidad
    seed: (int(ui.seed.value, 1) >>> 0),

    // layout base (lo importante para no saturar)
    cellCount: int(ui.cellCount.value, 30),
    minCellSizeMm: int(ui.minCellSizeMm.value, 14),

    // jerarquía visual (tu comentario de “líneas gruesas” vive aquí)
    cellBorderWidthMm: num(ui.cellBorderWidthMm.value, 0.70),
    patternStrokeMm: num(ui.patternStrokeMm.value, 0.35),

    // coloreabilidad
    minGapMm: num(ui.minGapMm.value, 1.4),
    whiteSpaceMm: num(ui.whiteSpaceMm.value, 1.0),

    // anti-saturación
    maxPatternPassesPerCell: int(ui.maxPatternPassesPerCell.value, 2),
    patternSkipProb: num(ui.patternSkipProb.value, 0.18),

    // rotación
    rotatePatterns: bool01(ui.rotatePatterns.value),
    rotationSet: String(ui.rotationSet.value || "ergonomic"),

    // borde orgánico interno (truco visual para “menos frío”)
    innerOrganicBorderEnabled: bool01(ui.innerOrganicBorderEnabled.value),
    innerOrganicBorderInsetMm: num(ui.innerOrganicBorderInsetMm.value, 0.9),
    innerOrganicJitterMm: num(ui.innerOrganicJitterMm.value, 0.55),
    innerOrganicRoundMm: num(ui.innerOrganicRoundMm.value, 1.0),
  };

  return { opts, zPresetKey };
}

function render() {
  const paperKey = String(ui.paper.value || "A4");
  const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;

  const marginMm = Math.max(0, num(ui.marginMm.value, 8));
  const inner = {
    x: marginMm,
    y: marginMm,
    w: presetPaper.w - marginMm * 2,
    h: presetPaper.h - marginMm * 2,
  };

  const { opts, zPresetKey } = buildOptsFromUI();

  const doc = createSvgDoc({
    wMm: presetPaper.w,
    hMm: presetPaper.h,
    meta: {
      title: "Zentangle Cells",
      generator: "zentangle",
      seed: opts.seed,
      preset: paperKey,
      zPreset: zPresetKey,
    },
  });

  generateZentangle(doc, {
    preset: paperKey,
    mode: "zentangle",
    seed: opts.seed,
    petals: 12,
    complexity: 110,
    zPreset: zPresetKey,

    // esta es la parte clave
    z: opts,

    // área de dibujo
    areaMm: inner,
  });

  const svg = renderSvgToString(doc);
  ui.previewInner.innerHTML = svg;

  // reflejar a URL para compartir/reproducir
  setStateToURL({
    preset: paperKey,
    mode: "zentangle",
    petals: 12,
    complexity: 110,
    seed: opts.seed,
    zPreset: zPresetKey,
  });

  ui.status.textContent = `OK — seed=${opts.seed} | ${paperKey} | zPreset=${zPresetKey}`;
  return { svg, opts, paperKey, zPresetKey };
}

function bind() {
  // init state from URL
  const st = getStateFromURL(DEFAULT_STATE);

  ui.paper.value = st.preset;
  ui.seed.value = String(st.seed >>> 0);
  ui.zPreset.value = st.zPreset;

  // render triggers
  ui.btnRandomSeed.addEventListener("click", () => {
    ui.seed.value = String(randomSeed32());
    render();
  });

  ui.btnRender.addEventListener("click", () => render());

  // live re-render (simple, sin debounce por ahora)
  [
    ui.paper, ui.marginMm, ui.seed, ui.zPreset,
    ui.cellCount, ui.minCellSizeMm,
    ui.cellBorderWidthMm, ui.patternStrokeMm, ui.minGapMm, ui.whiteSpaceMm,
    ui.maxPatternPassesPerCell, ui.patternSkipProb,
    ui.rotatePatterns, ui.rotationSet,
    ui.innerOrganicBorderEnabled, ui.innerOrganicBorderInsetMm, ui.innerOrganicJitterMm, ui.innerOrganicRoundMm
  ].forEach((el) => el.addEventListener("input", () => render()));

  ui.btnDownloadSVG.addEventListener("click", () => {
    const { svg, paperKey, zPresetKey } = render();
    downloadText(`zentangle_${paperKey}_${zPresetKey}.svg`, svg, "image/svg+xml");
  });

  ui.btnDownloadJSON.addEventListener("click", () => {
    const { opts, paperKey, zPresetKey } = render();
    downloadText(
      `zentangle_${paperKey}_${zPresetKey}_opts.json`,
      JSON.stringify(opts, null, 2),
      "application/json"
    );
  });

  // first paint
  render();
}

bind();

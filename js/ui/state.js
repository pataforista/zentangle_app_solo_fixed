// js/ui/state.js
// Estado global, referencias a elementos del DOM, opciones y geometría de página.
// Módulo extraído de app.js (Fase 0.3).
import { createSvgDoc, PAPER_SIZES_MM, PAPER_LABELS } from "../core/svgDoc.js";
export { PAPER_SIZES_MM, PAPER_LABELS } from "../core/svgDoc.js";
import { renderSvgToString } from "../core/svgRender.js";
import { randomSeed32 } from "../core/urlState.js";
import { ZENTANGLE_PRESETS } from "../generators/zentangle.presets.js";
import { generateZentangle } from "../generators/zentangle.generator.js";
import { RANDOM_COLOR_KEY, BESTSELLER_KEY, isRandomKey } from "../generators/randomStyle.js";
export { RANDOM_COLOR_KEY, BESTSELLER_KEY, isRandomKey } from "../generators/randomStyle.js";
import { designUnits, planSequence, kdpInsideMarginMm } from "../core/bookPlan.js";
import { TANGLE_INFO } from "../generators/bookExtras.js";

export const $ = (id) => document.getElementById(id);

export const DEFAULT_STATE = {
  preset: "LETTER",
  mode: "zentangle",
  seed: 42,
  zPreset: BESTSELLER_KEY,
};

export const ui = {
  paper: $("paper"),
  marginMm: $("marginMm"),
  seed: $("seed"),
  zPreset: $("zPreset"),
  samplerLayout: $("samplerLayout"),
  samplerLayoutRow: $("samplerLayoutRow"),
  randomHint: $("randomHint"),
  samplerEdge: $("samplerEdge"),
  samplerIconMode: $("samplerIconMode"),

  cellCount: $("cellCount"),
  minCellSizeMm: $("minCellSizeMm"),

  cellBorderWidthMm: $("cellBorderWidthMm"),
  patternStrokeMm: $("patternStrokeMm"),
  lineThicknessProfile: $("lineThicknessProfile"),
  minGapMm: $("minGapMm"),
  whiteSpaceMm: $("whiteSpaceMm"),
  sketchy: $("sketchy"),

  maxPatternPassesPerCell: $("maxPatternPassesPerCell"),
  patternSkipProb: $("patternSkipProb"),
  rotatePatterns: $("rotatePatterns"),
  rotationSet: $("rotationSet"),

  innerOrganicBorderEnabled: $("innerOrganicBorderEnabled"),
  innerOrganicBorderInsetMm: $("innerOrganicBorderInsetMm"),
  innerOrganicJitterMm: $("innerOrganicJitterMm"),
  innerOrganicRoundMm: $("innerOrganicRoundMm"),

  // Composición & variación
  patternFamily: $("patternFamily"),
  focalStrength: $("focalStrength"),
  rotationJitterDeg: $("rotationJitterDeg"),

  // Image processing controls
  imageUpload: $("imageUpload"),
  imageFileName: $("imageFileName"),
  useImageMode: $("useImageMode"),
  imageThreshold: $("imageThreshold"),
  imageThresholdVal: $("imageThresholdVal"),
  imageSlices: $("imageSlices"),
  imageSlicesVal: $("imageSlicesVal"),
  imageZoom: $("imageZoom"),
  imageZoomVal: $("imageZoomVal"),
  imageBlend: $("imageBlend"),
  imageBlendVal: $("imageBlendVal"),
  imageOffsetX: $("imageOffsetX"),
  imageOffsetY: $("imageOffsetY"),

  // Libro completo
  bookPages: $("bookPages"),
  bookBlank: $("bookBlank"),
  bookTitle: $("bookTitle"),
  bookAuthor: $("bookAuthor"),
  bookProgressive: $("bookProgressive"),
  bookGuide: $("bookGuide"),
  bookSpreads: $("bookSpreads"),
  bookTurn: $("bookTurn"),
  bookAutoFix: $("bookAutoFix"),
  bookSummary: $("bookSummary"),
  bookBar: $("bookBar"),
  btnBook: $("btnBook"),

  btnResetPreset: $("btnResetPreset"),
  btnRandomSeed: $("btnRandomSeed"),
  btnGallery: $("btnGallery"),
  btnRender: $("btnRender"),
  previewPanel: document.querySelector(".preview-panel"),
  btnDownloadSVG: $("btnDownloadSVG"),
  btnDownloadPNG: $("btnDownloadPNG"),
  btnDownloadPDF: $("btnDownloadPDF"),
  btnDownloadJSON: $("btnDownloadJSON"),

  previewInner: $("previewInner"),
  status: $("status"),

  // KDP Controls
  kdpBleedMm: $("kdpBleedMm"),
  showSafeZone: $("showSafeZone"),
  paperTextureEnabled: $("paperTextureEnabled"),
  cellShadowEnabled: $("cellShadowEnabled"),
  fillDeadSpace: $("fillDeadSpace"),
  imageOffsetXVal: $("imageOffsetXVal"),
  imageOffsetYVal: $("imageOffsetYVal"),
  btnResetOffset: $("btnResetOffset"),
};

// Estado mutable de la aplicación
export const appState = {
  currentImage: null,
  processedImageCanvas: null,
  densityMapCanvas: null,
  imageStats: null,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,

  // Libro en revisión
  currentSvg: "",
  bookReview: null,
  bookJob: null,
  excludedFigures: new Set(),
  pinnedPages: new Set(),
  pageHistory: new Map(),
  touched: new Set(),
  stylePicker: null,
};

export const busyButtons = () => [
  ui.btnRender,
  ui.btnRandomSeed,
  ui.btnGallery,
  ui.btnBook,
  ui.btnDownloadSVG,
  ui.btnDownloadPNG,
  ui.btnDownloadPDF,
  ui.btnDownloadJSON
];

export async function withBusy(fn) {
  const btns = busyButtons().filter(Boolean);
  btns.forEach((b) => (b.disabled = true));
  try {
    return await fn();
  } finally {
    btns.forEach((b) => (b.disabled = false));
  }
}

export function num(v, fallback = 0) {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
}

export function int(v, fallback = 0) {
  const x = parseInt(String(v), 10);
  return Number.isFinite(x) ? x : fallback;
}

export function bool01(v) {
  return String(v) === "1";
}

// Rasterizador para el relleno de huecos (deadSpace.js)
export async function rasterizeSvg(svg, w, h) {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("No se pudo rasterizar la página")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    canvas.width = 0; canvas.height = 0;
    return { data, width: w, height: h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const debounce = (fn, ms = 100) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

export const RANDOM_HINT_ALL = "🎲 Cada diseño usa un estilo distinto de toda la biblioteca (y en los muestrarios también sortea distribución, bordes e iconos). «Otro diseño», «8 variaciones» y cada página del libro cambian de estilo. Los ajustes finos de estilo no aplican.";
export const RANDOM_HINT_BEST = "💰 Mezcla de los estilos con más salida en KDP (mandalas, iconos tiernos, mosaicos geométricos, zentangle con figura), todos sin negros. En el libro se reparten en proporciones fijas y nunca se repite estilo en dos páginas seguidas; ↻ Cambiar conserva el estilo de esa página. Los ajustes finos no aplican.";
export const RANDOM_HINT_COLOR = "🎲 Como el aleatorio, pero solo con estilos sin rellenos negros (se excluyen los muestrarios de tinta): todo queda listo para colorear. Los ajustes finos de estilo no aplican.";

export const styleLabel = (key) => (ui.zPreset?.querySelector(`option[value="${key}"]`)?.textContent || key).replace(/\s*\(.*?\)\s*$/, "").trim();

export const needsWideMargin = (key) => key === "commercial_print" || key === "bold_easy" || isRandomKey(key);

export function buildOptsFromUI() {
  const zPresetKey = String(ui.zPreset.value || "editorial_airy");

  if (isRandomKey(zPresetKey)) {
    const opts = {
      seed: (int(ui.seed.value, 1) >>> 0),
      kdpBleedMm: num(ui.kdpBleedMm.value, 0),
      showSafeZone: ui.showSafeZone.checked,
      paperTextureEnabled: bool01(ui.paperTextureEnabled.value),
      cellShadowEnabled: bool01(ui.cellShadowEnabled.value),
      fillDeadSpace: ui.fillDeadSpace ? ui.fillDeadSpace.checked : true,
      lineThicknessProfile: String(ui.lineThicknessProfile.value || "standard"),
    };
    if (appState.touched.has("sketchy")) opts.sketchy = num(ui.sketchy.value, 0);
    return { opts, zPresetKey };
  }

  const zPreset = ZENTANGLE_PRESETS[zPresetKey] ?? ZENTANGLE_PRESETS.editorial_airy;

  const opts = {
    ...zPreset,
    seed: (int(ui.seed.value, 1) >>> 0),
    cellCount: int(ui.cellCount.value, 30),
    minCellSizeMm: int(ui.minCellSizeMm.value, 14),
    cellBorderWidthMm: num(ui.cellBorderWidthMm.value, 0.70),
    patternStrokeMm: num(ui.patternStrokeMm.value, 0.35),
    lineThicknessProfile: String(ui.lineThicknessProfile.value || "standard"),
    minGapMm: num(ui.minGapMm.value, 1.4),
    whiteSpaceMm: num(ui.whiteSpaceMm.value, 1.0),
    sketchy: num(ui.sketchy.value, 0),
    maxPatternPassesPerCell: int(ui.maxPatternPassesPerCell.value, 2),
    patternSkipProb: num(ui.patternSkipProb.value, 0.18),
    rotatePatterns: bool01(ui.rotatePatterns.value),
    rotationSet: String(ui.rotationSet.value || "ergonomic"),
    innerOrganicBorderEnabled: bool01(ui.innerOrganicBorderEnabled.value),
    innerOrganicBorderInsetMm: num(ui.innerOrganicBorderInsetMm.value, 0.9),
    innerOrganicJitterMm: num(ui.innerOrganicJitterMm.value, 0.55),
    innerOrganicRoundMm: num(ui.innerOrganicRoundMm.value, 1.0),

    // Composición & variación
    focalStrength: num(ui.focalStrength.value, 0.3),
    rotationJitterDeg: num(ui.rotationJitterDeg.value, 2.5),

    // KDP Professional Standards
    kdpBleedMm: num(ui.kdpBleedMm.value, 0),
    showSafeZone: ui.showSafeZone.checked,

    // Advanced look options
    paperTextureEnabled: bool01(ui.paperTextureEnabled.value),
    cellShadowEnabled: bool01(ui.cellShadowEnabled.value),
    fillDeadSpace: ui.fillDeadSpace ? ui.fillDeadSpace.checked : true,
  };

  if (zPreset.cellLayout === "sampler" && ui.samplerLayout) {
    opts.samplerLayout = String(ui.samplerLayout.value || "grid");
    opts.samplerEdge = String(ui.samplerEdge?.value || "fill");
    opts.samplerIconMode = String(ui.samplerIconMode?.value || "single");
  }

  const famVal = String(ui.patternFamily.value || "");
  if (famVal) opts.patternFamily = famVal;

  return { opts, zPresetKey };
}

export function applyPresetToUI(presetKey, { force = false } = {}) {
  const isRandom = isRandomKey(presetKey);
  if (ui.randomHint) {
    ui.randomHint.hidden = !isRandom;
    ui.randomHint.textContent = presetKey === BESTSELLER_KEY ? RANDOM_HINT_BEST : presetKey === RANDOM_COLOR_KEY ? RANDOM_HINT_COLOR : RANDOM_HINT_ALL;
  }
  const p = ZENTANGLE_PRESETS[presetKey];
  if (!p) {
    if (isRandom && ui.samplerLayoutRow) ui.samplerLayoutRow.hidden = true;
    return;
  }
  const keep = (el) => !force && el && appState.touched.has(el.id);
  const set = (el, v) => { if (el && v !== undefined && v !== null && !keep(el)) el.value = String(v); };
  const setBool = (el, v) => { if (el && v !== undefined && !keep(el)) el.value = v ? "1" : "0"; };

  if (p.cellCount) set(ui.cellCount, p.cellCount);
  if (p.minCellSizeMm) set(ui.minCellSizeMm, p.minCellSizeMm);
  set(ui.cellBorderWidthMm, p.cellBorderWidthMm);
  set(ui.patternStrokeMm, p.patternStrokeMm);
  set(ui.minGapMm, p.minGapMm);
  set(ui.whiteSpaceMm, p.whiteSpaceMm);
  set(ui.maxPatternPassesPerCell, p.maxPatternPassesPerCell);
  set(ui.patternSkipProb, p.patternSkipProb);
  setBool(ui.rotatePatterns, p.rotatePatterns);
  set(ui.rotationSet, p.rotationSet);
  setBool(ui.innerOrganicBorderEnabled, p.innerOrganicBorderEnabled);
  set(ui.innerOrganicBorderInsetMm, p.innerOrganicBorderInsetMm);
  set(ui.innerOrganicJitterMm, p.innerOrganicJitterMm);
  set(ui.innerOrganicRoundMm, p.innerOrganicRoundMm);

  set(ui.patternFamily, p.patternFamily || "");
  if (ui.samplerLayout) ui.samplerLayout.value = p.samplerLayout || "grid";
  if (ui.samplerEdge) ui.samplerEdge.value = p.samplerEdge || "fill";
  if (ui.samplerIconMode) ui.samplerIconMode.value = p.samplerIconMode || "single";
  if (ui.samplerLayoutRow) ui.samplerLayoutRow.hidden = p.cellLayout !== "sampler";
  set(ui.focalStrength, p.focalStrength != null ? p.focalStrength : 0.3);
  set(ui.rotationJitterDeg, p.rotationJitterDeg != null ? p.rotationJitterDeg : 2.5);

  if (presetKey === "bold_easy" && ui.lineThicknessProfile && !keep(ui.lineThicknessProfile)) {
    ui.lineThicknessProfile.value = "bold";
    appState.touched.add("lineThicknessProfile");
  }
}

export function kdpWarning(marginMm, bleedMm = 0) {
  const artEdgeMm = marginMm - (bleedMm || 0);
  if (artEdgeMm < 6.35) return " | ⚠ Arte a menos de 6.35 mm del borde: KDP lo rechazaría (sube el margen o quita el sangrado)";
  const minIn = kdpInsideMarginMm(KDP_MIN_PAGES);
  if (marginMm < minIn) return ` | ⚠ Margen menor a ${minIn} mm: por debajo del margen interior (lomo) mínimo de KDP`;
  return "";
}

export const THUMB_SEED = 7;
export const THUMB_OVERRIDES = {
  zen_figure: { figureName: "nautilus" },
  zen_figure_light: { figureName: "hummingbird" },
  zen_figure_facet: { figureName: "hamsa" },
  zen_figure_glass: { figureName: "lunamoth" },
  zen_figure_kids: { figureName: "owl" },
  zen_figure_dino: { figureName: "triceratops" },
  zen_figure_dino_origami: { figureName: "stegosaurus" },
  zen_figure_bio: { figureName: "neuron" },
  zen_figure_cryptids: { figureName: "kraken" }
};

export async function renderThumb(key) {
  const p = PAPER_SIZES_MM.LETTER, m = 10;
  const doc = createSvgDoc({ wMm: p.w, hMm: p.h, meta: { seed: THUMB_SEED, generator: "patrones" } });
  await generateZentangle(doc, { seed: THUMB_SEED, presetName: key, overrides: THUMB_OVERRIDES[key] || {}, areaMm: { x: m, y: m, w: p.w - 2 * m, h: p.h - 2 * m }, rasterize: rasterizeSvg });
  return renderSvgToString(doc);
}

export function showCurrentStyle() {
  const el = $("styleCurrent");
  if (!el) return;
  const strong = document.createElement("strong");
  strong.textContent = styleLabel(ui.zPreset.value);
  el.replaceChildren("Seleccionado: ", strong);
}

export const KDP_MIN_PAGES = 24;
export const KDP_MAX_PAGES = 828;
export const MAX_DESIGNS = 300;
export const SVG_BUDGET = (Number(globalThis.ZT_SVG_BUDGET_MB) || 160) * 1024 * 1024;
export const THUMB_PX = 640;
export const QPX = 6;

export function pageGeometry() {
  const paperKey = String(ui.paper.value || "LETTER");
  const paper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.LETTER;
  let marginMm = Math.max(0, num(ui.marginMm.value, 12.7));
  const { opts, zPresetKey } = buildOptsFromUI();
  if (needsWideMargin(zPresetKey)) marginMm = Math.max(marginMm, 12.5);
  const inner = { x: marginMm, y: marginMm, w: paper.w - marginMm * 2, h: paper.h - marginMm * 2 };
  return { paperKey, paper, marginMm, inner, opts, zPresetKey };
}

export const GUIDE_PAGES_EST = Math.ceil(Object.keys(TANGLE_INFO).length / 3) + 2;

export function bookPlan() {
  const n = Math.min(MAX_DESIGNS, Math.max(1, int(ui.bookPages.value, 50)));
  const blank = ui.bookBlank.value === "1";
  const flags = {
    progressive: !!ui.bookProgressive?.checked,
    guide: !!ui.bookGuide?.checked,
    spreads: !!ui.bookSpreads?.checked,
    turn: !!ui.bookTurn?.checked,
  };
  const units = designUnits(n, { spreads: flags.spreads });
  const turnPages = flags.turn ? (n >= 20 ? 2 : 1) : 0;
  const frontMatterPages = 4;
  const total = planSequence(units, { blank, guidePages: flags.guide ? GUIDE_PAGES_EST : 0, passport: flags.guide, turnPages, frontMatterPages }).length;
  return { n, blank, flags, units, turnPages, total, frontMatterPages };
}

export const bookKey = (g, plan) => JSON.stringify({ p: g.paperKey, i: g.inner, k: g.zPresetKey, o: g.opts, n: plan.n, blank: plan.blank, f: plan.flags });

// IDs que se recuerdan en localStorage
export const PERSIST_IDS = [
  "paper", "marginMm", "zPreset", "samplerLayout", "samplerEdge", "samplerIconMode",
  "bookPages", "bookBlank", "bookTitle", "bookAuthor", "bookProgressive", "bookGuide", "bookSpreads", "bookTurn", "bookAutoFix",
  "showSafeZone", "paperTextureEnabled", "cellShadowEnabled", "fillDeadSpace", "kdpBleedMm", "lineThicknessProfile"
];

export function loadSettings() {
  try { return JSON.parse(localStorage.getItem("zentangle_settings") || "{}"); } catch { return {}; }
}

export function saveSettings() {
  try {
    const s = {};
    PERSIST_IDS.forEach((id) => {
      const el = $(id);
      if (!el) return;
      s[id] = el.type === "checkbox" ? el.checked : el.value;
    });
    s.excludedFigures = Array.from(appState.excludedFigures);
    localStorage.setItem("zentangle_settings", JSON.stringify(s));
  } catch { /* ignore quota / storage disabled */ }
}

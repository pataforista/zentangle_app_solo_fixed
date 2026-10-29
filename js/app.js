import { createSvgDoc, PAPER_SIZES_MM, PAPER_LABELS } from "./core/svgDoc.js";
import { renderSvgToString } from "./core/svgRender.js";
import { downloadTextFile, downloadPng, downloadPdf, buildBookPdf } from "./core/export.js";
import { getStateFromURL, setStateToURL, randomSeed32 } from "./core/urlState.js";
import { applySobelEdgeDetection, loadImageFromFile, drawImageWithSymmetry, generateDensityMap, getImageStats } from "./core/imageProcessor.js";

import { ZENTANGLE_PRESETS } from "./generators/zentangle.presets.js";
import { generateZentangle } from "./generators/zentangle.generator.js";
import { RANDOM_COLOR_KEY, BESTSELLER_KEY, isRandomKey, isColoringSafe } from "./generators/randomStyle.js";
import { createStylePicker } from "./ui/stylePicker.js";
import { designUnits, planSequence, difficultyAt, kdpInsideMarginMm, printSafeOpts } from "./core/bookPlan.js";
import { generateSpread, SPREAD_FIGURES } from "./generators/spread.js";
import { figureForPage, FIGURE_IDS } from "./generators/figure.js";
import { kdpListingText } from "./core/kdpListing.js";
import { TANGLE_INFO, tanglesInSvgs, tangleGuidePages, tanglePassportPage, footerSvg, levelInfo, appendToSvg } from "./generators/bookExtras.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_STATE = {
  preset: "LETTER", // 8.5×11 in: el tamaño más habitual en KDP
  mode: "zentangle",
  seed: 42,
  zPreset: BESTSELLER_KEY, // mezcla de los estilos más rentables para KDP
};

const ui = {
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
  bookProgressive: $("bookProgressive"),
  bookGuide: $("bookGuide"),
  bookSpreads: $("bookSpreads"),
  bookTurn: $("bookTurn"),
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

// State for image processing
let appState = {
  currentImage: null,
  processedImageCanvas: null,
  densityMapCanvas: null,
  imageStats: null,
  isDragging: false,
  dragStartX: 0,
  dragStartY: 0,
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

// Rasterizador para el relleno de huecos (deadSpace.js): dibuja el SVG en un
// canvas y devuelve sus píxeles RGBA.
async function rasterizeSvg(svg, w, h) {
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

const debounce = (fn, ms = 100) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(this, args), ms);
  };
};

function buildOptsFromUI() {
  const zPresetKey = String(ui.zPreset.value || "editorial_airy");

  // Aleatorio: cada semilla sortea su propio estilo (randomStyle.js), así que los
  // ajustes finos de estilo no aplican; solo viajan las opciones globales.
  if (isRandomKey(zPresetKey)) {
    const opts = {
      seed: (int(ui.seed.value, 1) >>> 0),
      kdpBleedMm: num(ui.kdpBleedMm.value, 0),
      showSafeZone: ui.showSafeZone.checked,
      paperTextureEnabled: bool01(ui.paperTextureEnabled.value),
      cellShadowEnabled: bool01(ui.cellShadowEnabled.value),
      fillDeadSpace: ui.fillDeadSpace ? ui.fillDeadSpace.checked : true,
    };
    if (touched.has("sketchy")) opts.sketchy = num(ui.sketchy.value, 0);
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

  // Distribución del muestrario (retícula o teselado); solo aplica a muestrarios.
  if (zPreset.cellLayout === "sampler" && ui.samplerLayout) {
    opts.samplerLayout = String(ui.samplerLayout.value || "grid");
    opts.samplerEdge = String(ui.samplerEdge?.value || "fill");
    opts.samplerIconMode = String(ui.samplerIconMode?.value || "single");
  }

  // Familia de patrón: solo sobreescribe el preset si el usuario eligió una.
  const famVal = String(ui.patternFamily.value || "");
  if (famVal) opts.patternFamily = famVal;

  return { opts, zPresetKey };
}

const RANDOM_HINT_ALL = "🎲 Cada diseño usa un estilo distinto de toda la biblioteca (y en los muestrarios también sortea distribución, bordes e iconos). «Otro diseño», «8 variaciones» y cada página del libro cambian de estilo. Los ajustes finos de estilo no aplican.";
const RANDOM_HINT_BEST = "💰 Mezcla de los estilos con más salida en KDP (mandalas, iconos tiernos, mosaicos geométricos, zentangle con figura), todos sin negros. En el libro se reparten en proporciones fijas y nunca se repite estilo en dos páginas seguidas; ↻ Cambiar conserva el estilo de esa página. Los ajustes finos no aplican.";
const RANDOM_HINT_COLOR = "🎲 Como el aleatorio, pero solo con estilos sin rellenos negros (se excluyen los muestrarios de tinta): todo queda listo para colorear. Los ajustes finos de estilo no aplican.";

// Nombre legible de un estilo: el texto de su opción en el menú.
const styleLabel = (key) => (ui.zPreset.querySelector(`option[value="${key}"]`)?.textContent || key).replace(/\s*\(.*?\)\s*$/, "").trim();

// Margen mínimo según el estilo (sangrado KDP). En aleatorio no se sabe de
// antemano qué estilo saldrá en cada página, así que se aplica el más estricto.
const needsWideMargin = (key) => key === "commercial_print" || key === "bold_easy" || isRandomKey(key);

// Controles que el usuario ha ajustado a mano. Al cambiar de preset se
// conservan (para iterar diseños rápido sin re-tunear); el resto se sincroniza
// con el preset. El botón "Reset" reaplica el preset completo (force).
const touched = new Set();

// Sincroniza los sliders/selectores con los valores del preset elegido, de modo
// que el preset funcione como base de estilo real (antes los sliders pisaban
// silenciosamente al preset). Respeta los controles tocados salvo force=true.
function applyPresetToUI(presetKey, { force = false } = {}) {
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
  const keep = (el) => !force && el && touched.has(el.id);
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
}

// Genera N variaciones (misma configuración, distintas semillas) como galería
// clicable, para elegir el diseño que más guste e iterar rápido.
async function renderGallery(count = 8) {
  if (ui.useImageMode.checked && appState.processedImageCanvas) {
    // En modo imagen no aplica la galería de semillas; render normal.
    return render();
  }
  ui.status.textContent = "Generando variaciones...";

  const paperKey = String(ui.paper.value || "A4");
  const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;
  let marginMm = Math.max(0, num(ui.marginMm.value, 12.7));
  const { opts, zPresetKey } = buildOptsFromUI();
  if (needsWideMargin(zPresetKey)) {
    marginMm = Math.max(marginMm, 12.5);
  }
  const inner = { x: marginMm, y: marginMm, w: presetPaper.w - marginMm * 2, h: presetPaper.h - marginMm * 2 };

  // La semilla actual primero, luego aleatorias para comparar.
  const seeds = [opts.seed >>> 0];
  while (seeds.length < count) {
    const s = randomSeed32();
    if (!seeds.includes(s)) seeds.push(s);
  }

  if (ui.previewPanel) ui.previewPanel.classList.add("gallery-active");
  const grid = document.createElement("div");
  grid.className = "gallery-grid";
  ui.previewInner.innerHTML = "";
  ui.previewInner.appendChild(grid);

  for (let i = 0; i < seeds.length; i++) {
    const seed = seeds[i];
    const doc = createSvgDoc({ wMm: presetPaper.w, hMm: presetPaper.h, meta: { seed, generator: "patrones" } });
    const used = await generateZentangle(doc, { seed, presetName: zPresetKey, overrides: opts, areaMm: inner, rasterize: rasterizeSvg });
    const innerSvg = renderSvgToString(doc);
    // En aleatorio cada variación es de un estilo distinto: se rotula.
    const styleTag = isRandomKey(zPresetKey) ? ` · ${styleLabel(used.presetName)}` : "";

    const item = document.createElement("button");
    item.type = "button";
    item.className = "gallery-item";
    item.title = `Usar semilla ${seed}`;
    item.innerHTML =
      `<div class="gallery-thumb"><div style="background:#fff">${innerSvg}</div></div>` +
      `<span class="gallery-label">seed ${seed}${styleTag}</span>`;
    item.addEventListener("click", () => {
      ui.seed.value = String(seed);
      render();
    });
    grid.appendChild(item);
    await new Promise((r) => setTimeout(r, 0)); // mantener la UI responsiva
    ui.status.textContent = `Generando variaciones… ${i + 1}/${seeds.length}`;
  }

  ui.status.textContent = `✓ ${seeds.length} variaciones · haz clic en una para usarla`;
}


// Conformidad KDP: el PDF exportado es tamaño trim (subir como "sin sangrado").
// El arte debe quedar a >= 6.35 mm del borde y el margen cubrir el gutter (9.5 mm para < 150 págs).
function kdpWarning(marginMm, bleedMm = 0) {
  const artEdgeMm = marginMm - (bleedMm || 0);
  if (artEdgeMm < 6.35) return " | ⚠ Arte a menos de 6.35 mm del borde: KDP lo rechazaría (sube el margen o quita el sangrado)";
  const minIn = kdpInsideMarginMm(KDP_MIN_PAGES);
  if (marginMm < minIn) return ` | ⚠ Margen menor a ${minIn} mm: por debajo del margen interior (lomo) mínimo de KDP`;
  return "";
}

// ---------- Selector de estilos ----------
// Miniatura de un estilo con sus valores propios (sin los ajustes finos del
// usuario) y una semilla fija, para comparar estilos entre sí.
const THUMB_SEED = 7;
// Con la misma semilla, las tarjetas de figura mostraban la misma hoja: cada
// una enseña una figura distinta y reconocible.
const THUMB_OVERRIDES = { zen_figure: { figureName: "owl" }, zen_figure_light: { figureName: "cat" } };
async function renderThumb(key) {
  const p = PAPER_SIZES_MM.LETTER, m = 10;
  const doc = createSvgDoc({ wMm: p.w, hMm: p.h, meta: { seed: THUMB_SEED, generator: "patrones" } });
  await generateZentangle(doc, { seed: THUMB_SEED, presetName: key, overrides: THUMB_OVERRIDES[key] || {}, areaMm: { x: m, y: m, w: p.w - 2 * m, h: p.h - 2 * m }, rasterize: rasterizeSvg });
  return renderSvgToString(doc);
}

function showCurrentStyle() {
  const el = $("styleCurrent");
  if (!el) return;
  const strong = document.createElement("strong");
  strong.textContent = styleLabel(ui.zPreset.value);
  el.replaceChildren("Seleccionado: ", strong);
}

// ---------- Libro completo ----------
const KDP_MIN_PAGES = 24;
// Máximo de páginas de un libro de tapa blanda en blanco y negro en KDP.
const KDP_MAX_PAGES = 828;
const MAX_DESIGNS = 300;
// Memoria para guardar los SVG completos de la revisión (~1.5–3.5 MB por
// figura). Pasado el tope, la página guarda solo su miniatura y su semilla, y
// el SVG se regenera idéntico al armar el PDF (los diseños son deterministas).
const SVG_BUDGET = (Number(globalThis.ZT_SVG_BUDGET_MB) || 160) * 1024 * 1024; // ZT_SVG_BUDGET_MB: solo para pruebas
const THUMB_PX = 640;
let bookJob = null; // { cancelled: boolean } mientras se genera un libro

function pageGeometry() {
  const paperKey = String(ui.paper.value || "LETTER");
  const paper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.LETTER;
  let marginMm = Math.max(0, num(ui.marginMm.value, 12.7));
  const { opts, zPresetKey } = buildOptsFromUI();
  if (needsWideMargin(zPresetKey)) marginMm = Math.max(marginMm, 12.5);
  const inner = { x: marginMm, y: marginMm, w: paper.w - marginMm * 2, h: paper.h - marginMm * 2 };
  return { paperKey, paper, marginMm, inner, opts, zPresetKey };
}

// Páginas de guía previstas antes de generar (la cifra real depende de los
// tangles que salgan; 3 por página).
const GUIDE_PAGES_EST = Math.ceil(Object.keys(TANGLE_INFO).length / 3) + 2; // + «Antes de empezar» y «Combina»

function bookPlan() {
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
  const total = planSequence(units, { blank, guidePages: flags.guide ? GUIDE_PAGES_EST : 0, passport: flags.guide, turnPages }).length;
  return { n, blank, flags, units, turnPages, total };
}

// Semillas reproducibles: la seed del usuario + el índice de página.
const bookSeed = (base, i) => ((base >>> 0) + Math.imul(i, 0x9e3779b1)) >>> 0;

function updateBookSummary() {
  if (!ui.bookSummary) return;
  const { n, blank, total, flags, units, turnPages } = bookPlan();
  const g = pageGeometry();
  const spreads = units.filter((u) => u.kind === "spread").length;
  const extras = [spreads ? `${spreads} doble${spreads > 1 ? "s" : ""} página${spreads > 1 ? "s" : ""}` : "", flags.guide ? "guía y pasaporte" : "", turnPages ? `${turnPages} «Tu turno»` : "", flags.progressive ? "dificultad progresiva" : ""].filter(Boolean);
  const parts = [`${n} diseños${blank ? " con reverso en blanco" : ""}${extras.length ? ` · ${extras.join(" · ")}` : ""} = <strong>${flags.guide ? "≈ " : ""}${total} páginas</strong> · ${PAPER_LABELS[g.paperKey] || g.paperKey} · margen ${g.marginMm} mm${g.zPresetKey === BESTSELLER_KEY ? " · 💰 estilos más rentables, repartidos" : isRandomKey(g.zPresetKey) ? " · 🎲 un estilo distinto en cada página" : ""}`];
  let cls = "hint ok";
  if (total < KDP_MIN_PAGES) { parts.push(`⚠ KDP pide mínimo ${KDP_MIN_PAGES} páginas: añade diseños.`); cls = "hint warn"; }
  // Margen interior mínimo de KDP según el número de páginas.
  const needIn = kdpInsideMarginMm(total);
  if (g.marginMm < needIn) { parts.push(`⚠ Con ${total} páginas KDP pide un margen interior de al menos ${needIn} mm: sube el margen a ${Math.ceil(needIn)} mm.`); cls = "hint warn"; }
  if (!blank) parts.push("📄 Sin hojas en blanco: en KDP elige «Tinta y papel: color prémium», el papel más grueso de KDP (60–71 lb frente a 50–61 lb del blanco y negro). Cuesta más por página y aun así prueba tus rotuladores: el papel grueso reduce el traspaso, no lo elimina.");
  if (total > KDP_MAX_PAGES) { parts.push(`⚠ KDP admite hasta ${KDP_MAX_PAGES} páginas en blanco y negro: quita diseños o usa «Otro diseño» como reverso.`); cls = "hint warn"; }
  if (n >= 120) parts.push(`⏱ Libro grande: preparar ${n} diseños lleva varios minutos (≈ 1–2 s por diseño).`);
  const w = kdpWarning(g.marginMm, g.opts.kdpBleedMm).replace(/^ \| /, "");
  if (w) { parts.push(w); cls = "hint warn"; }
  else if (cls !== "hint warn" && total >= KDP_MIN_PAGES && total <= KDP_MAX_PAGES) parts.push("✓ Cumple los límites de KDP");
  ui.bookSummary.className = cls;
  ui.bookSummary.innerHTML = parts.join("<br>");
  updateBookButton();
}

// Revisión del libro: primero se generan todas las páginas en una cuadrícula;
// cada una se puede cambiar por otro diseño al instante (↻) y el PDF se arma
// después con exactamente las páginas aprobadas, sin volver a generarlas.
// bookReview = { key, g, n, blank, flags, units, turnPages, baseSeed, pages: [{ kind, seed, tries, svg, url, presetName, left?, right? }], extras }
let bookReview = null;

// Huella de todo lo que define el libro: si cambia, la revisión queda vieja.
const bookKey = (g, plan) => JSON.stringify({ p: g.paperKey, i: g.inner, k: g.zPresetKey, o: g.opts, n: plan.n, blank: plan.blank, f: plan.flags });

// Semilla del reemplazo número `tries` de la página i. tries = 0 es la semilla
// original del libro (misma seed = mismo libro); los reemplazos derivan de ella.
const pageSeed = (base, i, tries) => {
  const s0 = bookSeed(base, i);
  return tries ? (Math.imul(s0 ^ (tries * 0x85ebca6b), 0xc2b2ae35) ^ (tries + 0x27d4eb2f)) >>> 0 : s0;
};

// pageIndex + bookSeed: en "Más vendidos" fijan el estilo de cada página del
// libro (un reemplazo con ↻ cambia el diseño, no el estilo).
// plan: { n, units, flags } del libro; fija si la página es doble y su dificultad.
// Miniatura PNG de una página (o de una doble página) para la revisión: pesa
// ~50–150 KB frente a los MB del SVG, así un libro de 300 diseños cabe en memoria.
async function thumbUrl(svg, wMm, hMm) {
  const w = Math.round(THUMB_PX * (wMm / Math.min(wMm, hMm * 0.78)));
  const h = Math.round(w * (hMm / wMm));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("No se pudo dibujar la miniatura")); img.src = url; });
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => c.toBlob(res, "image/png"));
    c.width = 0; c.height = 0;
    return URL.createObjectURL(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const svgSize = (p) => (p.svg?.length || 0) + (p.left?.length || 0) + (p.right?.length || 0);

// Guarda los SVG de la página si caben en el presupuesto; si no, los suelta
// (se regeneran al armar el PDF).
function keepOrDropSvg(review, page, freed = 0) {
  review.svgBytes = Math.max(0, (review.svgBytes || 0) - freed);
  const size = svgSize(page);
  if (review.svgBytes + size <= SVG_BUDGET) { review.svgBytes += size; return; }
  page.svg = page.left = page.right = null;
}

async function makeBookPage(g, seed, pageIndex, bookSeed, plan, { thumb = true } = {}) {
  const geo = { w: g.paper.w, h: g.paper.h, m: g.marginMm };
  const kind = plan?.units?.[pageIndex]?.kind || "single";
  const difficulty = plan?.flags?.progressive ? difficultyAt(pageIndex, plan.n) : null;
  const lv = difficulty === null ? null : levelInfo(difficulty);
  const footer = lv ? footerSvg(geo, { text: `Nivel ${lv.level} de 5 · ≈ ${lv.minutes} min`, level: lv.level }) : "";
  if (kind === "spread") {
    // Las dobles páginas recorren sus figuras en orden (la n-ésima doble de
    // este libro), en vez de sortearlas: así no se repiten seguidas.
    const nth = plan.units.slice(0, pageIndex).filter((u) => u.kind === "spread").length;
    const figureName = SPREAD_FIGURES[(nth + (bookSeed >>> 0)) % SPREAD_FIGURES.length];
    const sp = await generateSpread({ paper: g.paper, marginMm: g.marginMm, seed, difficulty, figureName, rasterize: rasterizeSvg });
    const right = appendToSvg(sp.right, footer);
    const url = thumb ? await thumbUrl(sp.wide, g.paper.w * 2, g.paper.h) : null;
    return { kind, seed, svg: sp.wide, left: sp.left, right, url, presetName: "zen_figure", tangles: tanglesInSvgs([sp.wide]), figure: sp.figure };
  }
  const d = createSvgDoc({ wMm: g.paper.w, hMm: g.paper.h, meta: { seed, generator: "patrones" } });
  // printSafeOpts: guías de zona segura, textura y sombreado nunca se imprimen.
  const overrides = { ...printSafeOpts(g.opts), seed, ...(difficulty === null ? {} : { difficulty }) };
  // En los modos aleatorios, la página original (tries 0) toma su estilo de la
  // secuencia del libro, que evita vecinas repetidas. Un ↻ cambia la semilla:
  // esa página sortea un estilo nuevo con ella (en «Más vendidos» sigue el mazo).
  const rerolled = isRandomKey(g.zPresetKey) && g.zPresetKey !== BESTSELLER_KEY && seed !== pageSeed(bookSeed, pageIndex, 0);
  const used = await generateZentangle(d, { seed, presetName: g.zPresetKey, overrides, areaMm: g.inner, pageIndex: rerolled ? null : pageIndex, bookSeed, rasterize: rasterizeSvg });
  const svg = appendToSvg(renderSvgToString(d), footer);
  const url = thumb ? await thumbUrl(svg, g.paper.w, g.paper.h) : null;
  return { kind, seed, svg, url, presetName: used.presetName, tangles: tanglesInSvgs([svg]), figure: (svg.match(/data-figure="([^"]+)"/) || [])[1] || null };
}

// Páginas que no son diseños: guía y pasaporte (con los tangles que de
// verdad salen en el libro) y «Tu turno» (figuras con secciones vacías).
async function buildBookExtras(review) {
  const { g, flags, turnPages, baseSeed } = review;
  const geo = { w: g.paper.w, h: g.paper.h, m: g.marginMm };
  const out = { guide: [], passport: null, turn: [] };
  if (flags.guide) {
    const found = [...new Set(review.pages.flatMap((p) => p.tangles || []))];
    const ids = found.length >= 3 ? found : Object.keys(TANGLE_INFO);
    out.guide = tangleGuidePages(ids, geo);
    out.passport = tanglePassportPage(ids, geo);
  }
  // «Tu turno» usa figuras que no salen en el libro (si quedan).
  const usedFigs = new Set(review.pages.map((p) => p.figure).filter(Boolean));
  const freshFigs = FIGURE_IDS.filter((f) => !usedFigs.has(f));
  for (let k = 0; k < turnPages; k++) {
    const seed = pageSeed(baseSeed, 1000 + k, 0);
    const d = createSvgDoc({ wMm: g.paper.w, hMm: g.paper.h, meta: { seed, generator: "patrones" } });
    await generateZentangle(d, { seed, presetName: "zen_figure", overrides: { ...ZENTANGLE_PRESETS.zen_figure, seed, emptySections: true, figureName: freshFigs.length ? freshFigs[k % freshFigs.length] : figureForPage(baseSeed ^ 0x7777, k) }, areaMm: g.inner });
    const text = flags.guide ? "Tu turno: dibuja en cada sección un tangle de la guía" : "Tu turno: dibuja tus propios tangles en cada sección";
    out.turn.push(appendToSvg(renderSvgToString(d), footerSvg(geo, { text })));
  }
  return out;
}

const extrasList = (ex) => [
  ...ex.guide.map((svg, i) => ({ svg, label: `Guía ${i + 1}` })),
  ...(ex.passport ? [{ svg: ex.passport, label: "Pasaporte" }] : []),
  ...ex.turn.map((svg, i) => ({ svg, label: `Tu turno ${i + 1}` })),
];

const bookSequence = (review, ex) => planSequence(review.units, { blank: review.blank, guidePages: ex.guide.length, passport: !!ex.passport, turnPages: ex.turn.length });

function freeBookReview() {
  bookReview?.pages.forEach((p) => p && URL.revokeObjectURL(p.url));
  bookReview?.extraUrls?.forEach((u) => URL.revokeObjectURL(u));
  bookReview = null;
}

const reviewIsFresh = () => {
  if (!bookReview) return false;
  return bookReview.key === bookKey(pageGeometry(), bookPlan());
};

function updateBookButton() {
  if (bookJob) return;
  const fresh = reviewIsFresh();
  const view = $("btnBookReview");
  if (view) view.hidden = !fresh;
  ui.btnBook.textContent = fresh
    ? `⬇ Descargar libro (PDF · ${bookReview.total} págs)`
    : (bookReview ? "📖 Preparar libro de nuevo (cambiaste ajustes)" : "📖 Preparar libro (revisar páginas)");
  ui.btnBook.dataset.mode = fresh ? "download" : "prepare";
}

// Cuadrícula de revisión en el panel de vista previa.
function showBookReview() {
  if (!bookReview) return;
  ui.previewPanel?.classList.add("gallery-active");
  const wrap = document.createElement("div");
  wrap.className = "book-review";
  const head = document.createElement("div");
  head.className = "book-review-head";
  const title = document.createElement("p");
  title.className = "book-review-title";
  title.textContent = `Revisa tu libro: ${bookReview.n} diseños. ¿Alguno no te gusta? Pulsa ↻ y se reemplaza por otro al instante.`;
  const dl = document.createElement("button");
  dl.type = "button";
  dl.className = "btn btn-primary";
  dl.textContent = "⬇ Descargar PDF";
  dl.addEventListener("click", () => createBook());
  const recipe = document.createElement("button");
  recipe.type = "button";
  recipe.className = "btn btn-secondary";
  recipe.textContent = "🧾 Receta del libro";
  recipe.title = "Guarda ajustes y semillas de cada página (con los ↻) para auditar o rehacer el libro";
  recipe.addEventListener("click", downloadBookRecipe);
  head.append(title, dl, recipe);

  const grid = document.createElement("div");
  grid.className = "gallery-grid book-grid";
  bookReview.pages.forEach((page, i) => grid.append(bookTile(i)));
  // Guía, pasaporte y «Tu turno»: se ven aquí y se regeneran al descargar
  // (la guía refleja los tangles de las páginas finales).
  extrasList(bookReview.extras).forEach((x, k) => {
    const tile = document.createElement("figure");
    tile.className = "gallery-item book-tile extra";
    const img = document.createElement("img");
    img.src = bookReview.extraUrls[k];
    img.alt = x.label;
    img.addEventListener("click", () => tile.classList.toggle("zoomed"));
    const cap = document.createElement("figcaption");
    const label = document.createElement("span");
    label.className = "gallery-label";
    label.textContent = x.label;
    cap.append(label);
    tile.append(img, cap);
    grid.append(tile);
  });
  wrap.append(head, grid);
  ui.previewInner.replaceChildren(wrap);
}

// Receta del libro: todo lo necesario para auditar o rehacer exactamente las
// páginas aprobadas (incluidos los ↻). Rehacerla idéntica exige el mismo commit
// de la app: las correcciones de geometría cambian los dibujos.
function bookRecipe(review) {
  const { g, n, blank, flags, baseSeed, pages, total } = review;
  return {
    app: "generador-libros-colorear", recipeVersion: 1, createdAt: new Date().toISOString(),
    paper: { key: g.paperKey, wMm: g.paper.w, hMm: g.paper.h }, marginMm: g.marginMm,
    style: g.zPresetKey, opts: printSafeOpts(g.opts), designs: n, blankBacks: blank, flags, baseSeed, totalPages: total,
    pages: pages.map((p, i) => ({ design: i + 1, kind: p.kind, seed: p.seed, tries: p.tries || 0, style: p.presetName, figure: p.figure || null, tangles: p.tangles || [] })),
  };
}

function downloadBookRecipe() {
  if (!bookReview) return;
  const r = bookReview;
  downloadTextFile(`receta_libro_${r.n}disenos_${r.g.paperKey}_seed${r.baseSeed}.json`, JSON.stringify(bookRecipe(r), null, 2), "application/json;charset=utf-8");
  ui.status.textContent = "✓ Receta descargada: guárdala junto al PDF";
}

function bookTile(i) {
  const page = bookReview.pages[i];
  const tile = document.createElement("figure");
  tile.className = `gallery-item book-tile${page.kind === "spread" ? " spread" : ""}`;
  tile.dataset.index = String(i);
  const img = document.createElement("img");
  img.src = page.url;
  img.alt = `Diseño ${i + 1}`;
  img.title = "Clic para ampliar";
  img.addEventListener("click", () => tile.classList.toggle("zoomed"));
  const cap = document.createElement("figcaption");
  const label = document.createElement("span");
  label.className = "gallery-label";
  const style = isRandomKey(bookReview.g.zPresetKey) ? ` · ${styleLabel(page.presetName)}` : "";
  const lv = bookReview.flags?.progressive ? ` · nivel ${levelInfo(difficultyAt(i, bookReview.n)).level}` : "";
  label.textContent = `${i + 1}${page.kind === "spread" ? " · doble página" : ""}${page.tries ? ` · cambio ${page.tries}` : ""}${style}${lv}`;
  const redo = document.createElement("button");
  redo.type = "button";
  redo.className = "btn btn-secondary tile-redo";
  redo.textContent = "↻ Cambiar";
  redo.title = "Borrar este diseño y generar otro en su lugar";
  redo.addEventListener("click", () => replaceBookPage(i, tile));
  cap.append(label, redo);
  tile.append(img, cap);
  return tile;
}

async function replaceBookPage(i, tile) {
  if (!bookReview || bookJob) return;
  const review = bookReview;
  const old = review.pages[i];
  const btn = tile.querySelector(".tile-redo");
  btn.disabled = true;
  btn.textContent = "Generando…";
  tile.classList.add("busy");
  try {
    const tries = (old.tries || 0) + 1;
    const page = await makeBookPage(review.g, pageSeed(review.baseSeed, i, tries), i, review.baseSeed, review);
    if (bookReview !== review) { URL.revokeObjectURL(page.url); return; } // se descartó mientras tanto
    page.tries = tries;
    keepOrDropSvg(review, page, svgSize(old));
    review.pages[i] = page;
    URL.revokeObjectURL(old.url);
    tile.replaceWith(bookTile(i));
    ui.status.textContent = `✓ Diseño ${i + 1} reemplazado`;
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "↻ Cambiar";
    tile.classList.remove("busy");
    ui.status.textContent = `✗ No se pudo reemplazar el diseño ${i + 1}: ${err.message}`;
  }
}

async function prepareBook() {
  const plan = bookPlan();
  const { n, blank } = plan;
  const g = pageGeometry();
  const baseSeed = g.opts.seed >>> 0;
  const job = (bookJob = { cancelled: false });
  const others = busyButtons().filter((b) => b && b !== ui.btnBook);
  others.forEach((b) => (b.disabled = true));
  freeBookReview();
  const review = { key: bookKey(g, plan), g, n, blank, flags: plan.flags, units: plan.units, turnPages: plan.turnPages, baseSeed, pages: [], extras: { guide: [], passport: null, turn: [] }, extraUrls: [], total: 0 };
  ui.btnBook.textContent = "✖ Cancelar";
  ui.bookBar.hidden = false; ui.bookBar.value = 0;
  try {
    for (let i = 0; i < n; i++) {
      if (job.cancelled) { review.pages.forEach((p) => URL.revokeObjectURL(p.url)); ui.status.textContent = "Preparación cancelada"; return; }
      const page = await makeBookPage(g, pageSeed(baseSeed, i, 0), i, baseSeed, review);
      page.tries = 0;
      keepOrDropSvg(review, page);
      review.pages.push(page);
      ui.bookBar.value = (i + 1) / n;
      ui.btnBook.textContent = `✖ Cancelar (${i + 1}/${n})`;
      ui.status.textContent = `Preparando libro… diseño ${i + 1} de ${n}`;
      await new Promise((r) => setTimeout(r, 0)); // deja respirar a la UI
    }
    review.extras = await buildBookExtras(review);
    review.extraUrls = extrasList(review.extras).map((x) => URL.createObjectURL(new Blob([x.svg], { type: "image/svg+xml" })));
    review.total = bookSequence(review, review.extras).length;
    bookReview = review;
    showBookReview();
    ui.status.textContent = `✓ ${n} diseños listos para revisar (${review.total} páginas) · cambia los que no te gusten y descarga el PDF`;
  } catch (err) {
    review.pages.forEach((p) => URL.revokeObjectURL(p.url));
    ui.status.textContent = `✗ No se pudo preparar el libro: ${err.message}`;
    console.error("Error al preparar libro:", err);
  } finally {
    bookJob = null;
    ui.bookBar.hidden = true;
    others.forEach((b) => (b.disabled = false));
    updateBookButton();
  }
}

// Botón principal: prepara la revisión o, si ya hay una vigente, arma el PDF.
async function onBookButton() {
  if (bookJob) { bookJob.cancelled = true; ui.status.textContent = "Cancelando…"; return; }
  if (reviewIsFresh()) return createBook();
  return prepareBook();
}

async function createBook() {
  if (bookJob || !bookReview) return;
  const { g, n, baseSeed, pages } = bookReview;
  const job = (bookJob = { cancelled: false });
  const others = busyButtons().filter((b) => b && b !== ui.btnBook);
  others.forEach((b) => (b.disabled = true));
  document.querySelectorAll(".tile-redo").forEach((b) => (b.disabled = true));
  ui.btnBook.textContent = "✖ Cancelar";
  ui.bookBar.hidden = false; ui.bookBar.value = 0;
  try {
    const title = `Libro para colorear (${n} diseños)`;
    // Guía con los tangles de las páginas finales (tras los ↻) y orden de páginas.
    const extras = await buildBookExtras(bookReview);
    const sequence = bookSequence(bookReview, extras);
    const total = sequence.length;
    // Páginas sin SVG guardado (libros grandes): se regeneran con su semilla.
    // Se recuerda la última para no generar dos veces las dos mitades de una doble.
    let regen = null;
    const full = async (i) => {
      if (pages[i].svg) return pages[i];
      if (regen?.i !== i) regen = { i, page: await makeBookPage(g, pages[i].seed, i, baseSeed, bookReview, { thumb: false }) };
      return regen.page;
    };
    const svgOf = async (e) => ({ design: async () => (await full(e.i)).svg, spreadL: async () => (await full(e.i)).left, spreadR: async () => (await full(e.i)).right,
      guide: async () => extras.guide[e.i], passport: async () => extras.passport, turn: async () => extras.turn[e.i] })[e.type]();
    const doc = await buildBookPdf({
      widthMm: g.paper.w, heightMm: g.paper.h, sequence, getEntrySvg: async (e) => svgOf(e), title,
      isCancelled: () => job.cancelled,
      onProgress: (i, count) => {
        ui.bookBar.value = i / count;
        ui.btnBook.textContent = `✖ Cancelar (${i}/${count})`;
        ui.status.textContent = `Creando PDF… página ${i} de ${count}`;
      },
      getSvg: async (i) => pages[i].svg,
    });
    if (!doc) { ui.status.textContent = "PDF cancelado"; return; }
    const name = `libro_${n}disenos_${g.paperKey}_${g.zPresetKey}_seed${baseSeed}.pdf`;
    doc.save(name);
    const changed = pages.filter((p) => p.tries).length;
    ui.status.textContent = `✓ Libro listo: ${total} páginas${changed ? ` (${changed} ${changed === 1 ? "diseño cambiado" : "diseños cambiados"})` : ""} · ${name}` + kdpWarning(g.marginMm, g.opts.kdpBleedMm);
  } catch (err) {
    ui.status.textContent = `✗ No se pudo crear el libro: ${err.message}`;
    console.error("Error al crear libro:", err);
  } finally {
    bookJob = null;
    ui.bookBar.hidden = true;
    others.forEach((b) => (b.disabled = false));
    document.querySelectorAll(".tile-redo").forEach((b) => (b.disabled = false));
    updateBookButton();
  }
}

// ---------- Recordar ajustes entre sesiones (uso personal) ----------
const SETTINGS_KEY = "zentangle.settings.v1";
const PERSIST_IDS = ["paper", "marginMm", "zPreset", "bookPages", "bookBlank", "bookProgressive", "bookGuide", "bookSpreads", "bookTurn", "kdpBleedMm", "showSafeZone", "fillDeadSpace"];
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null") || {}; } catch { return {}; }
}
function saveSettings() {
  try {
    const data = { touched: {} };
    PERSIST_IDS.forEach((id) => { const el = $(id); if (el) data[id] = el.type === "checkbox" ? el.checked : el.value; });
    touched.forEach((id) => { const el = $(id); if (el) data.touched[id] = el.value; });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
  } catch { /* modo privado o sin permiso: no pasa nada */ }
}

// forPrint: genera la página para descargar (sin guías de zona segura, textura
// ni sombreado) y no toca la vista previa.
async function render({ forPrint = false } = {}) {
  updateBookButton(); // cualquier cambio de ajustes deja vieja la revisión del libro
  ui.status.textContent = "Renderizando...";
  if (ui.previewPanel) ui.previewPanel.classList.remove("gallery-active");
  const paperKey = String(ui.paper.value || "A4");
  const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;

  let marginMm = Math.max(0, num(ui.marginMm.value, 12.7));

  const built = buildOptsFromUI();
  const zPresetKey = built.zPresetKey;
  const opts = forPrint ? printSafeOpts(built.opts) : built.opts;

  // KDP Bleed Safety: Amazon KDP requiere ~12.5mm si hay sangrado
  if (needsWideMargin(zPresetKey)) {
    marginMm = Math.max(marginMm, 12.5);
  }

  const inner = {
    x: marginMm,
    y: marginMm,
    w: presetPaper.w - marginMm * 2,
    h: presetPaper.h - marginMm * 2,
  };

  // Check if image mode is enabled and image is processed
  if (ui.useImageMode.checked && appState.processedImageCanvas) {
    return await renderImageMode(presetPaper, marginMm, inner, paperKey);
  }

  const doc = createSvgDoc({
    wMm: presetPaper.w,
    hMm: presetPaper.h,
    meta: {
      title: "Diseño para colorear",
      generator: "patrones",
      seed: opts.seed,
      preset: paperKey,
      zPreset: zPresetKey,
    },
  });

  const used = await generateZentangle(doc, {
    seed: opts.seed,
    presetName: zPresetKey,
    overrides: opts,
    areaMm: inner,
    rasterize: rasterizeSvg, // relleno de huecos; opts.fillDeadSpace lo apaga
  });
  // En aleatorio, el estilo realmente dibujado (para estado, nombre de archivo y JSON).
  const shownKey = isRandomKey(zPresetKey) ? used.presetName : zPresetKey;

  const svg = renderSvgToString(doc);
  if (forPrint) {
    ui.status.textContent = "Preparando descarga…";
    return { svg, opts, paperKey, zPresetKey: shownKey };
  }
  ui.previewInner.innerHTML = svg;

  setStateToURL({
    preset: paperKey,
    mode: "zentangle",
    petals: 12,
    complexity: 110,
    seed: opts.seed,
    zPreset: zPresetKey,
    paperTextureEnabled: ui.paperTextureEnabled.value,
    cellShadowEnabled: ui.cellShadowEnabled.value,
  });

  const presetLabel = {
    kdp_balanced: "KDP Balanceado",
    kdp_intricate: "KDP Intrincado",
    kdp_relaxed: "KDP Relajado",
    kdp_organic_flow: "KDP Orgánico",
    kdp_geometric_art: "KDP Geométrico",
    kdp_dense_meditative: "KDP Meditativo",
    kdp_masterpiece: "KDP Masterpiece",
  }[shownKey] || styleLabel(shownKey);

  const kdpWarn = kdpWarning(marginMm, opts.kdpBleedMm);
  const dice = isRandomKey(zPresetKey) ? "🎲 " : "";
  ui.status.textContent = `✓ ${dice}${presetLabel} | Seed: ${opts.seed} | ${paperKey} | 300 DPI ready${kdpWarn}`;
  return { svg, opts, paperKey, zPresetKey: shownKey };
}

async function renderImageMode(presetPaper, marginMm, inner, paperKey) {
  const { opts, zPresetKey } = buildOptsFromUI();

  // --- 1) Process image with symmetry ---
  const CANVAS_SIZE = 1000;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = CANVAS_SIZE;
  tempCanvas.height = CANVAS_SIZE;

  const slices = parseInt(ui.imageSlices.value, 10);
  const zoom = parseFloat(ui.imageZoom.value);
  const offsetX = parseFloat(ui.imageOffsetX.value || 0);
  const offsetY = parseFloat(ui.imageOffsetY.value || 0);

  const resultCanvas = drawImageWithSymmetry(
    tempCanvas,
    appState.processedImageCanvas,
    slices,
    zoom,
    offsetX,
    offsetY
  );

  const imgDataUrl = resultCanvas.toDataURL("image/png");

  // Cleanup canvases to release GPU memory
  tempCanvas.width = 0;
  tempCanvas.height = 0;
  tempCanvas.remove?.();
  resultCanvas.width = 0;
  resultCanvas.height = 0;
  resultCanvas.remove?.();

  // --- 2) Build SVG with image as background layer ---
  const doc = createSvgDoc({
    wMm: presetPaper.w,
    hMm: presetPaper.h,
    meta: {
      title: "Image-based Zentangle",
      generator: "image-zentangle",
      seed: opts.seed,
      preset: paperKey,
      zPreset: zPresetKey,
      mode: "image",
    },
  });

  // White background
  doc.body.push(`  <rect width="${presetPaper.w}" height="${presetPaper.h}" fill="white"/>`);

  // Image layer with user-controlled opacity
  const imageOpacity = parseFloat(ui.imageBlend ? ui.imageBlend.value : 0.35);
  doc.body.push(`  <image x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" href="${imgDataUrl}" preserveAspectRatio="xMidYMid slice" opacity="${imageOpacity}"/>`);

  // --- 3) Generate zentangle patterns on top ---
  // Sobre una imagen solo tienen sentido los estilos de celdas: el aleatorio
  // excluye muestrarios y composiciones de página completa.
  await generateZentangle(doc, {
    seed: opts.seed,
    presetName: zPresetKey,
    overrides: opts,
    areaMm: inner,
    cellsOnly: true,
  });

  const svg = renderSvgToString(doc);
  ui.previewInner.innerHTML = svg;

  setStateToURL({
    preset: paperKey,
    mode: "image",
    seed: opts.seed,
    zPreset: zPresetKey,
    paperTextureEnabled: ui.paperTextureEnabled.value,
    cellShadowEnabled: ui.cellShadowEnabled.value,
  });

  ui.status.textContent = `✓ Imagen + Zentangle | Seed: ${opts.seed} | ${slices} simetrías | ${paperKey}`;
  return { svg, opts, paperKey, zPresetKey };
}

const debouncedRender = debounce(async () => { await render(); saveSettings(); }, 100);

function cleanupCanvas(canvas) {
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
    canvas.remove?.();
  }
  return null;
}

async function processImage(threshold) {
  if (!appState.currentImage) return;

  ui.status.textContent = "Procesando imagen...";

  // Clear previous canvases to release GPU memory
  appState.processedImageCanvas = cleanupCanvas(appState.processedImageCanvas);
  appState.densityMapCanvas = cleanupCanvas(appState.densityMapCanvas);

  // Get image statistics
  appState.imageStats = getImageStats(appState.currentImage);

  // Process with edge detection (advanced options)
  appState.processedImageCanvas = applySobelEdgeDetection(
    appState.currentImage,
    threshold,
    {
      normalize: true,     // Better edge detection with contrast normalization
      blurPasses: 2,       // Smooth noise without losing details
      invertEdges: false   // Keep black edges on white background
    }
  );

  // Generate density map for pattern guidance
  appState.densityMapCanvas = generateDensityMap(appState.currentImage);

  ui.status.textContent = "✓ Imagen procesada";
}

// Muestra el valor actual junto a cada slider que no tenga ya un readout propio
// (los de imagen usan sus spans *Val). Sin esto el usuario ajusta a ciegas.
function attachRangeReadouts() {
  document.querySelectorAll('.controls-panel input[type="range"]').forEach((input) => {
    if (document.getElementById(input.id + "Val")) return;
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (!label) return;
    const out = document.createElement("output");
    out.className = "range-val";
    out.htmlFor = input.id;
    const show = () => { out.textContent = input.value; };
    show();
    input.addEventListener("input", show);
    label.appendChild(out);
  });
}

// Evita clics repetidos mientras se genera/exporta y deja claro que hay trabajo en curso.
const busyButtons = () => [ui.btnRender, ui.btnRandomSeed, ui.btnGallery,
  ui.btnDownloadSVG, ui.btnDownloadPNG, ui.btnDownloadPDF, ui.btnDownloadJSON];
async function withBusy(fn) {
  const btns = busyButtons();
  btns.forEach((b) => { if (b) b.disabled = true; });
  try { return await fn(); }
  finally { btns.forEach((b) => { if (b) b.disabled = false; }); }
}

function bind() {
  const st = getStateFromURL(DEFAULT_STATE);
  attachRangeReadouts();

  // Ajustes recordados (solo si la URL no trae estilo/papel explícitos).
  const saved = loadSettings();
  const urlHas = (k) => new URL(location.href).searchParams.has(k);
  PERSIST_IDS.forEach((id) => {
    const el = $(id);
    if (!el || saved[id] === undefined) return;
    if ((id === "paper" && urlHas("preset")) || (id === "zPreset" && urlHas("zPreset"))) return;
    if (el.type === "checkbox") el.checked = !!saved[id]; else el.value = String(saved[id]);
  });
  if (!urlHas("preset") && saved.paper && ui.paper.selectedIndex >= 0) st.preset = ui.paper.value;
  if (!urlHas("zPreset") && saved.zPreset && ui.zPreset.selectedIndex >= 0) st.zPreset = ui.zPreset.value;

  // Si la URL trae un valor desconocido, el <select> quedaría en blanco: usar el de respaldo.
  ui.paper.value = st.preset;
  if (ui.paper.selectedIndex < 0) ui.paper.value = DEFAULT_STATE.preset;
  ui.seed.value = String(st.seed >>> 0);
  ui.zPreset.value = st.zPreset;
  if (ui.zPreset.selectedIndex < 0) ui.zPreset.value = DEFAULT_STATE.zPreset;
  // Aplica el preset inicial a los controles (base de estilo real).
  applyPresetToUI(ui.zPreset.value);

  // Re-aplica los ajustes finos que el usuario había tocado.
  Object.entries(saved.touched || {}).forEach(([id, v]) => {
    const el = $(id);
    if (el) { el.value = v; touched.add(id); }
  });

  ui.paperTextureEnabled.value = st.paperTextureEnabled || "0";
  ui.cellShadowEnabled.value = st.cellShadowEnabled || "0";

  const updateOffsetReadout = () => {
    if (ui.imageOffsetXVal) ui.imageOffsetXVal.textContent = String(Math.round(ui.imageOffsetX.value || 0));
    if (ui.imageOffsetYVal) ui.imageOffsetYVal.textContent = String(Math.round(ui.imageOffsetY.value || 0));
  };
  updateOffsetReadout();

  if (ui.btnResetOffset) {
    ui.btnResetOffset.addEventListener("click", (e) => {
      e.preventDefault();
      ui.imageOffsetX.value = 0;
      ui.imageOffsetY.value = 0;
      updateOffsetReadout();
      if (ui.useImageMode.checked && appState.processedImageCanvas) {
        render();
      }
    });
  }

  // Image upload handler
  ui.imageUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      appState.currentImage = await loadImageFromFile(file);

      // Process and show stats
      const threshold = parseInt(ui.imageThreshold.value, 10);
      await processImage(threshold);

      // Display image info
      const stats = appState.imageStats;
      const sizeInfo = `${stats.width}×${stats.height}px (${stats.contrast})`;
      ui.imageFileName.textContent = `✓ ${file.name} · ${sizeInfo}`;
      const sec = document.getElementById("imageSection");
      if (sec) sec.open = true;

      ui.useImageMode.checked = true;
      render();
    } catch (err) {
      ui.imageFileName.textContent = `✗ Error: ${err.message}`;
      console.error("Image load error:", err);
    }
  });

  // Image threshold handler
  ui.imageThreshold.addEventListener("input", (e) => {
    ui.imageThresholdVal.textContent = e.target.value;
  });

  ui.imageThreshold.addEventListener("change", async (e) => {
    if (appState.currentImage) {
      await processImage(parseInt(e.target.value, 10));
      render();
    }
  });

  ui.useImageMode.addEventListener("change", () => {
    render();
  });

  // Image symmetry controls
  ui.imageSlices.addEventListener("input", (e) => {
    ui.imageSlicesVal.textContent = e.target.value;
    if (ui.useImageMode.checked && appState.processedImageCanvas) {
      requestAnimationFrame(render);
    }
  });

  ui.imageZoom.addEventListener("input", (e) => {
    ui.imageZoomVal.textContent = e.target.value + 'x';
    if (ui.useImageMode.checked && appState.processedImageCanvas) {
      requestAnimationFrame(render);
    }
  });

  ui.imageBlend.addEventListener("input", (e) => {
    ui.imageBlendVal.textContent = Math.round(parseFloat(e.target.value) * 100) + '%';
    if (ui.useImageMode.checked && appState.processedImageCanvas) {
      requestAnimationFrame(render);
    }
  });

  ui.imageOffsetX.addEventListener("input", () => {
    updateOffsetReadout();
    if (ui.useImageMode.checked && appState.processedImageCanvas) {
      requestAnimationFrame(render);
    }
  });

  ui.imageOffsetY.addEventListener("input", () => {
    updateOffsetReadout();
    if (ui.useImageMode.checked && appState.processedImageCanvas) {
      requestAnimationFrame(render);
    }
  });

  // Drag handlers for image preview
  const preview = document.querySelector("#preview");
  if (preview) {
    const getClientPos = (e) => e.touches
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };

    const startDrag = (e) => {
      if (!ui.useImageMode.checked || !appState.processedImageCanvas) return;
      appState.isDragging = true;
      const pos = getClientPos(e);
      appState.dragStartX = pos.x;
      appState.dragStartY = pos.y;
    };

    const onDrag = (e) => {
      if (!appState.isDragging) return;
      e.preventDefault();
      const pos = getClientPos(e);

      const sensitivity = 2 / parseFloat(ui.imageZoom.value);
      ui.imageOffsetX.value = Math.max(
        -1000,
        Math.min(1000, parseFloat(ui.imageOffsetX.value || 0) + (pos.x - appState.dragStartX) * sensitivity)
      );
      ui.imageOffsetY.value = Math.max(
        -1000,
        Math.min(1000, parseFloat(ui.imageOffsetY.value || 0) + (pos.y - appState.dragStartY) * sensitivity)
      );

      appState.dragStartX = pos.x;
      appState.dragStartY = pos.y;
      updateOffsetReadout();
      requestAnimationFrame(render);
    };

    const endDrag = () => {
      appState.isDragging = false;
    };

    preview.addEventListener("mousedown", startDrag);
    window.addEventListener("mousemove", onDrag);
    window.addEventListener("mouseup", endDrag);
    preview.addEventListener("touchstart", startDrag, { passive: false });
    window.addEventListener("touchmove", onDrag, { passive: false });
    window.addEventListener("touchend", endDrag);
  }

  ui.btnRandomSeed.addEventListener("click", () => {
    ui.seed.value = String(randomSeed32());
    withBusy(render);
  });

  // El render es automático al cambiar cualquier ajuste; el botón es opcional.
  ui.btnRender?.addEventListener("click", () => withBusy(render));
  ui.btnBook.addEventListener("click", onBookButton);
  $("btnBookReview")?.addEventListener("click", showBookReview);
  // Ficha de KDP con el libro tal como está configurado (o revisado).
  $("btnKdpListing")?.addEventListener("click", () => {
    const plan = bookPlan();
    const g = pageGeometry();
    const fresh = reviewIsFresh();
    const text = kdpListingText({
      designs: plan.n,
      pages: fresh ? bookReview.total : plan.total,
      paperLabel: PAPER_LABELS[g.paperKey] || g.paperKey,
      trimWmm: g.paper.w,
      trimHmm: g.paper.h,
      flags: plan.flags,
      spreads: plan.units.filter((u) => u.kind === "spread").length,
      turnPages: plan.turnPages,
      blank: plan.blank,
      // Qué describe la ficha: solo figuras, mezcla o estilos sin figura; y si
      // hay rellenos negros (aleatorio con todo o muestrarios de tinta).
      content: /^zen_figure/.test(g.zPresetKey) ? "figures" : g.zPresetKey === BESTSELLER_KEY || isRandomKey(g.zPresetKey) ? "mixed" : "other",
      noBlack: g.zPresetKey === BESTSELLER_KEY || g.zPresetKey === RANDOM_COLOR_KEY || (!isRandomKey(g.zPresetKey) && isColoringSafe(ZENTANGLE_PRESETS[g.zPresetKey] || {})),
    });
    downloadTextFile(`ficha_kdp_${plan.n}disenos.txt`, text, "text/plain;charset=utf-8");
    ui.status.textContent = "✓ Ficha de KDP descargada: título, descripción y palabras clave sin marcas ajenas";
  });

  // Resumen del libro en vivo (páginas totales, tamaño, avisos KDP).
  const bookOptEls = [ui.bookProgressive, ui.bookGuide, ui.bookSpreads, ui.bookTurn];
  [ui.bookPages, ui.bookBlank, ui.paper, ui.marginMm, ui.kdpBleedMm, ui.zPreset, ...bookOptEls].forEach((el) => {
    if (el) { el.addEventListener("input", updateBookSummary); el.addEventListener("change", updateBookSummary); }
  });
  [ui.bookPages, ui.bookBlank, ...bookOptEls].forEach((el) => el && el.addEventListener("change", saveSettings));
  updateBookSummary();

  if (ui.btnGallery) ui.btnGallery.addEventListener("click", () => withBusy(() => renderGallery(8)));

  // El preset sincroniza los controles NO tocados antes de renderizar; tus
  // ajustes manuales se conservan para iterar rápido entre presets.
  ui.zPreset.addEventListener("change", () => {
    applyPresetToUI(ui.zPreset.value);
    showCurrentStyle();
    debouncedRender();
  });

  // Selector visual: escribe en el <select> (fuente de verdad) y dispara su
  // "change", así el resto de la app no cambia.
  const pickerRoot = $("stylePicker");
  if (pickerRoot) {
    createStylePicker({
      select: ui.zPreset,
      root: pickerRoot,
      renderThumb,
      onPick: () => ui.zPreset.dispatchEvent(new Event("change")),
    });
  }
  showCurrentStyle();

  // Reset: reaplica el preset completo (descarta tus ajustes) y vuelve al estilo limpio.
  if (ui.btnResetPreset) {
    ui.btnResetPreset.addEventListener("click", () => {
      touched.clear();
      applyPresetToUI(ui.zPreset.value, { force: true });
      debouncedRender();
    });
  }

  // Controles de estilo: marcan "tocado" (para conservarse al cambiar de preset).
  const styleControls = [
    ui.cellCount, ui.minCellSizeMm,
    ui.cellBorderWidthMm, ui.patternStrokeMm, ui.minGapMm, ui.whiteSpaceMm, ui.sketchy,
    ui.maxPatternPassesPerCell, ui.patternSkipProb,
    ui.rotatePatterns, ui.rotationSet,
    ui.innerOrganicBorderEnabled, ui.innerOrganicBorderInsetMm, ui.innerOrganicJitterMm, ui.innerOrganicRoundMm,
    ui.patternFamily, ui.focalStrength, ui.rotationJitterDeg,
  ];
  styleControls.forEach((el) => {
    if (!el) return;
    const evt = el.type === "checkbox" ? "change" : "input";
    el.addEventListener(evt, () => { touched.add(el.id); debouncedRender(); });
  });

  // Controles no ligados al estilo del preset: solo re-renderizan.
  [
    ui.paper, ui.marginMm, ui.seed, ui.kdpBleedMm, ui.showSafeZone, ui.fillDeadSpace,
    ui.paperTextureEnabled, ui.cellShadowEnabled,
    // La distribución la define cada preset de muestrario: no se arrastra al cambiar.
    ui.samplerLayout, ui.samplerEdge, ui.samplerIconMode,
  ].forEach((el) => {
    if (!el) return;
    const evt = el.type === "checkbox" ? "change" : "input";
    el.addEventListener(evt, debouncedRender);
  });

  ui.btnDownloadSVG.addEventListener("click", () => withBusy(async () => {
    try {
      ui.status.innerText = "Preparando SVG...";
      const { svg, paperKey, zPresetKey } = await render({ forPrint: true });
      downloadTextFile(`diseno_${paperKey}_${zPresetKey}.svg`, svg);
      ui.status.innerText = "✓ Descargado SVG";
    } catch (err) {
      ui.status.innerText = `✗ Error al descargar SVG: ${err.message}`;
      console.error("Error al descargar SVG:", err);
    }
  }));

  ui.btnDownloadPNG.addEventListener("click", () => withBusy(async () => {
    try {
      const { svg, paperKey, zPresetKey } = await render({ forPrint: true });
      const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;
      ui.status.innerText = "Preparando PNG...";
      await downloadPng(`diseno_${paperKey}_${zPresetKey}_300dpi.png`, svg, presetPaper.w, presetPaper.h);
      ui.status.innerText = "✓ Descargado PNG";
    } catch (err) {
      ui.status.innerText = `✗ Error al descargar PNG: ${err.message}`;
      console.error("Error al descargar PNG:", err);
    }
  }));

  ui.btnDownloadPDF.addEventListener("click", () => withBusy(async () => {
    try {
      const { svg, paperKey, zPresetKey } = await render({ forPrint: true });
      const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;
      ui.status.innerText = "Generando PDF (KDP)...";
      await downloadPdf(`diseno_${paperKey}_${zPresetKey}_kdp.pdf`, svg, presetPaper.w, presetPaper.h);
      ui.status.innerText = "✓ Descargado PDF";
    } catch (err) {
      ui.status.innerText = `✗ Error al descargar PDF: ${err.message}`;
      console.error("Error al descargar PDF:", err);
    }
  }));

  ui.btnDownloadJSON.addEventListener("click", () => withBusy(async () => {
    try {
      ui.status.innerText = "Preparando JSON...";
      const { opts, paperKey, zPresetKey } = await render();
      downloadTextFile(
        `diseno_${paperKey}_${zPresetKey}_opts.json`,
        JSON.stringify(opts, null, 2)
      );
      ui.status.innerText = "✓ Descargado JSON";
    } catch (err) {
      ui.status.innerText = `✗ Error al descargar JSON: ${err.message}`;
      console.error("Error al descargar JSON:", err);
    }
  }));

  render();
}

bind();

import { createSvgDoc, PAPER_SIZES_MM, PAPER_LABELS } from "./core/svgDoc.js";
import { renderSvgToString } from "./core/svgRender.js";
import { downloadTextFile, downloadPng, downloadPdf, buildBookPdf } from "./core/export.js";
import { getStateFromURL, setStateToURL, randomSeed32 } from "./core/urlState.js";
import { applySobelEdgeDetection, loadImageFromFile, drawImageWithSymmetry, generateDensityMap, getImageStats } from "./core/imageProcessor.js";

import { ZENTANGLE_PRESETS } from "./generators/zentangle.presets.js";
import { generateZentangle } from "./generators/zentangle.generator.js";
import { RANDOM_COLOR_KEY, isRandomKey } from "./generators/randomStyle.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_STATE = {
  preset: "LETTER", // 8.5×11 in: el tamaño más habitual en KDP
  mode: "zentangle",
  seed: 42,
  zPreset: "kdp_balanced",
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
    ui.randomHint.textContent = presetKey === RANDOM_COLOR_KEY ? RANDOM_HINT_COLOR : RANDOM_HINT_ALL;
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
    const doc = createSvgDoc({ wMm: presetPaper.w, hMm: presetPaper.h, meta: { seed, generator: "zentangle" } });
    const used = await generateZentangle(doc, { seed, presetName: zPresetKey, overrides: opts, areaMm: inner });
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
  if (marginMm < 9.5) return " | ⚠ Margen menor a 9.5 mm: insuficiente como gutter KDP";
  return "";
}

// ---------- Libro completo ----------
const KDP_MIN_PAGES = 24;
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

function bookPlan() {
  const n = Math.min(150, Math.max(1, int(ui.bookPages.value, 30)));
  const blank = ui.bookBlank.value === "1";
  return { n, blank, total: blank ? n * 2 : n };
}

// Semillas reproducibles: la seed del usuario + el índice de página.
const bookSeed = (base, i) => ((base >>> 0) + Math.imul(i, 0x9e3779b1)) >>> 0;

function updateBookSummary() {
  if (!ui.bookSummary) return;
  const { n, blank, total } = bookPlan();
  const g = pageGeometry();
  const parts = [`${n} diseños${blank ? ` + ${n} hojas en blanco` : ""} = <strong>${total} páginas</strong> · ${PAPER_LABELS[g.paperKey] || g.paperKey} · margen ${g.marginMm} mm${isRandomKey(g.zPresetKey) ? " · 🎲 un estilo distinto en cada página" : ""}`];
  let cls = "hint ok";
  if (total < KDP_MIN_PAGES) { parts.push(`⚠ KDP pide mínimo ${KDP_MIN_PAGES} páginas: sube a ${blank ? KDP_MIN_PAGES / 2 : KDP_MIN_PAGES} diseños.`); cls = "hint warn"; }
  const w = kdpWarning(g.marginMm, g.opts.kdpBleedMm).replace(/^ \| /, "");
  if (w) { parts.push(w); cls = "hint warn"; }
  else if (total >= KDP_MIN_PAGES) parts.push("✓ Cumple lo mínimo de KDP");
  ui.bookSummary.className = cls;
  ui.bookSummary.innerHTML = parts.join("<br>");
}

async function createBook() {
  if (bookJob) { bookJob.cancelled = true; ui.status.textContent = "Cancelando…"; return; }
  const { n, blank, total } = bookPlan();
  const g = pageGeometry();
  const baseSeed = g.opts.seed >>> 0;
  const job = (bookJob = { cancelled: false });
  const others = busyButtons().filter((b) => b && b !== ui.btnBook);
  others.forEach((b) => (b.disabled = true));
  ui.previewPanel?.classList.remove("gallery-active");
  ui.btnBook.textContent = "✖ Cancelar";
  ui.bookBar.hidden = false; ui.bookBar.value = 0;
  try {
    const title = `Libro para colorear (${n} diseños)`;
    const doc = await buildBookPdf({
      widthMm: g.paper.w, heightMm: g.paper.h, count: n, blankBetween: blank, title,
      isCancelled: () => job.cancelled,
      onProgress: (i, count) => {
        ui.bookBar.value = i / count;
        ui.btnBook.textContent = `✖ Cancelar (${i}/${count})`;
        ui.status.textContent = `Creando libro… página ${i} de ${count}`;
      },
      getSvg: async (i) => {
        const seed = bookSeed(baseSeed, i);
        const d = createSvgDoc({ wMm: g.paper.w, hMm: g.paper.h, meta: { seed, generator: "zentangle" } });
        await generateZentangle(d, { seed, presetName: g.zPresetKey, overrides: { ...g.opts, seed }, areaMm: g.inner });
        const svg = renderSvgToString(d);
        ui.previewInner.innerHTML = svg; // muestra la página en curso
        return svg;
      },
    });
    if (!doc) { ui.status.textContent = "Libro cancelado"; return; }
    const name = `libro_${n}disenos_${g.paperKey}_${g.zPresetKey}_seed${baseSeed}.pdf`;
    doc.save(name);
    ui.status.textContent = `✓ Libro listo: ${total} páginas · ${name}` + kdpWarning(g.marginMm, g.opts.kdpBleedMm);
  } catch (err) {
    ui.status.textContent = `✗ No se pudo crear el libro: ${err.message}`;
    console.error("Error al crear libro:", err);
  } finally {
    bookJob = null;
    ui.btnBook.textContent = "📖 Crear libro (PDF para KDP)";
    ui.bookBar.hidden = true;
    others.forEach((b) => (b.disabled = false));
  }
}

// ---------- Recordar ajustes entre sesiones (uso personal) ----------
const SETTINGS_KEY = "zentangle.settings.v1";
const PERSIST_IDS = ["paper", "marginMm", "zPreset", "bookPages", "bookBlank", "kdpBleedMm", "showSafeZone"];
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

async function render() {
  ui.status.textContent = "Renderizando...";
  if (ui.previewPanel) ui.previewPanel.classList.remove("gallery-active");
  const paperKey = String(ui.paper.value || "A4");
  const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;

  let marginMm = Math.max(0, num(ui.marginMm.value, 12.7));

  const { opts, zPresetKey } = buildOptsFromUI();

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
      title: "Zentangle Cells",
      generator: "zentangle",
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
  });
  // En aleatorio, el estilo realmente dibujado (para estado, nombre de archivo y JSON).
  const shownKey = isRandomKey(zPresetKey) ? used.presetName : zPresetKey;

  const svg = renderSvgToString(doc);
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

  ui.btnRender.addEventListener("click", () => withBusy(render));
  ui.btnBook.addEventListener("click", createBook);

  // Resumen del libro en vivo (páginas totales, tamaño, avisos KDP).
  [ui.bookPages, ui.bookBlank, ui.paper, ui.marginMm, ui.kdpBleedMm, ui.zPreset].forEach((el) => {
    if (el) { el.addEventListener("input", updateBookSummary); el.addEventListener("change", updateBookSummary); }
  });
  [ui.bookPages, ui.bookBlank].forEach((el) => el && el.addEventListener("change", saveSettings));
  updateBookSummary();

  if (ui.btnGallery) ui.btnGallery.addEventListener("click", () => withBusy(() => renderGallery(8)));

  // El preset sincroniza los controles NO tocados antes de renderizar; tus
  // ajustes manuales se conservan para iterar rápido entre presets.
  ui.zPreset.addEventListener("change", () => {
    applyPresetToUI(ui.zPreset.value);
    debouncedRender();
  });

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
    ui.paper, ui.marginMm, ui.seed, ui.kdpBleedMm, ui.showSafeZone,
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
      const { svg, paperKey, zPresetKey } = await render();
      downloadTextFile(`zentangle_${paperKey}_${zPresetKey}.svg`, svg);
      ui.status.innerText = "✓ Descargado SVG";
    } catch (err) {
      ui.status.innerText = `✗ Error al descargar SVG: ${err.message}`;
      console.error("Error al descargar SVG:", err);
    }
  }));

  ui.btnDownloadPNG.addEventListener("click", () => withBusy(async () => {
    try {
      const { svg, paperKey, zPresetKey } = await render();
      const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;
      ui.status.innerText = "Preparando PNG...";
      await downloadPng(`zentangle_${paperKey}_${zPresetKey}_300dpi.png`, svg, presetPaper.w, presetPaper.h);
      ui.status.innerText = "✓ Descargado PNG";
    } catch (err) {
      ui.status.innerText = `✗ Error al descargar PNG: ${err.message}`;
      console.error("Error al descargar PNG:", err);
    }
  }));

  ui.btnDownloadPDF.addEventListener("click", () => withBusy(async () => {
    try {
      const { svg, paperKey, zPresetKey } = await render();
      const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;
      ui.status.innerText = "Generando PDF (KDP)...";
      await downloadPdf(`zentangle_${paperKey}_${zPresetKey}_kdp.pdf`, svg, presetPaper.w, presetPaper.h);
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
        `zentangle_${paperKey}_${zPresetKey}_opts.json`,
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

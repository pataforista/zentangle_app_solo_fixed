import { createSvgDoc, PAPER_SIZES_MM } from "./core/svgDoc.js";
import { renderSvgToString } from "./core/svgRender.js";
import { downloadTextFile, downloadPng, downloadPdf } from "./core/export.js";
import { getStateFromURL, setStateToURL, randomSeed32 } from "./core/urlState.js";
import { applySobelEdgeDetection, loadImageFromFile } from "./core/imageProcessor.js";

import { ZENTANGLE_PRESETS } from "./generators/zentangle.presets.js";
import { generateZentangle } from "./generators/zentangle.generator.js";

const $ = (id) => document.getElementById(id);

const DEFAULT_STATE = {
  paper: "A4",
  mode: "zentangle",
  seed: 42,
  zPreset: "kdp_balanced",
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
  sketchy: $("sketchy"),

  maxPatternPassesPerCell: $("maxPatternPassesPerCell"),
  patternSkipProb: $("patternSkipProb"),
  rotatePatterns: $("rotatePatterns"),
  rotationSet: $("rotationSet"),

  innerOrganicBorderEnabled: $("innerOrganicBorderEnabled"),
  innerOrganicBorderInsetMm: $("innerOrganicBorderInsetMm"),
  innerOrganicJitterMm: $("innerOrganicJitterMm"),
  innerOrganicRoundMm: $("innerOrganicRoundMm"),

  // Image processing controls
  imageUpload: $("imageUpload"),
  imageFileName: $("imageFileName"),
  useImageMode: $("useImageMode"),
  imageThreshold: $("imageThreshold"),
  imageThresholdVal: $("imageThresholdVal"),

  btnRandomSeed: $("btnRandomSeed"),
  btnRender: $("btnRender"),
  btnDownloadSVG: $("btnDownloadSVG"),
  btnDownloadPNG: $("btnDownloadPNG"),
  btnDownloadPDF: $("btnDownloadPDF"),
  btnDownloadJSON: $("btnDownloadJSON"),

  previewInner: $("previewInner"),
  status: $("status"),
};

// State for image processing
let appState = {
  currentImage: null,
  processedImageCanvas: null,
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
  };

  return { opts, zPresetKey };
}

async function render() {
  ui.status.textContent = "Renderizando...";
  const paperKey = String(ui.paper.value || "A4");
  const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;

  let marginMm = Math.max(0, num(ui.marginMm.value, 8));

  const { opts, zPresetKey } = buildOptsFromUI();

  // KDP Bleed Safety: Amazon KDP requiere ~12.5mm si hay sangrado
  if (zPresetKey === "commercial_print" || zPresetKey === "bold_easy") {
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
    return renderImageMode(presetPaper, marginMm, inner, paperKey);
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

  await generateZentangle(doc, {
    seed: opts.seed,
    presetName: zPresetKey,
    overrides: opts,
    areaMm: inner,
  });

  const svg = renderSvgToString(doc);
  ui.previewInner.innerHTML = svg;

  setStateToURL({
    preset: paperKey,
    mode: "zentangle",
    petals: 12,
    complexity: 110,
    seed: opts.seed,
    zPreset: zPresetKey,
  });

  const presetLabel = {
    kdp_balanced: "KDP Balanceado",
    kdp_intricate: "KDP Intrincado",
    kdp_relaxed: "KDP Relajado",
    kdp_organic_flow: "KDP Orgánico",
    kdp_geometric_art: "KDP Geométrico",
    kdp_dense_meditative: "KDP Meditativo",
    kdp_masterpiece: "KDP Masterpiece",
  }[zPresetKey] || zPresetKey;

  ui.status.textContent = `✓ ${presetLabel} | Seed: ${opts.seed} | ${paperKey} | 300 DPI ready`;
  return { svg, opts, paperKey, zPresetKey };
}

function renderImageMode(presetPaper, marginMm, inner, paperKey) {
  // Create SVG document for image mode
  const doc = createSvgDoc({
    wMm: presetPaper.w,
    hMm: presetPaper.h,
    meta: {
      title: "Image-based Zentangle",
      generator: "image-processor",
      mode: "image",
    },
  });

  // Convert processed image canvas to base64 and embed in SVG
  const imgDataUrl = appState.processedImageCanvas.toDataURL("image/png");

  // Add white background
  doc.body.push(`  <rect width="${presetPaper.w}mm" height="${presetPaper.h}mm" fill="white"/>`);

  // Calculate scaling to fit image in the inner area
  const imgW = appState.processedImageCanvas.width;
  const imgH = appState.processedImageCanvas.height;

  // DPI conversion: canvas pixels to mm (assuming 96 DPI typical screen)
  const pixelsPerMm = 96 / 25.4; // 96 DPI / 25.4 mm per inch
  const imgWidthMm = imgW / pixelsPerMm;
  const imgHeightMm = imgH / pixelsPerMm;

  // Scale to fit within inner area while maintaining aspect ratio
  let scaledW = imgWidthMm;
  let scaledH = imgHeightMm;

  if (scaledW > inner.w) {
    const ratio = inner.w / scaledW;
    scaledW = inner.w;
    scaledH *= ratio;
  }

  if (scaledH > inner.h) {
    const ratio = inner.h / scaledH;
    scaledH = inner.h;
    scaledW *= ratio;
  }

  // Center the image
  const offsetX = inner.x + (inner.w - scaledW) / 2;
  const offsetY = inner.y + (inner.h - scaledH) / 2;

  // Add image to SVG
  doc.body.push(`  <image x="${offsetX}mm" y="${offsetY}mm" width="${scaledW}mm" height="${scaledH}mm" href="${imgDataUrl}" preserveAspectRatio="xMidYMid meet"/>`);

  const svg = renderSvgToString(doc);
  ui.previewInner.innerHTML = svg;

  ui.status.textContent = `✓ Imagen procesada | ${appState.processedImageCanvas.width}x${appState.processedImageCanvas.height}px | ${paperKey}`;
  return { svg, paperKey };
}

const debouncedRender = debounce(render, 100);

async function processImage(threshold) {
  if (!appState.currentImage) return;

  ui.status.textContent = "Procesando imagen...";
  appState.processedImageCanvas = applySobelEdgeDetection(appState.currentImage, threshold);
  ui.status.textContent = "Imagen procesada";
}

function bind() {
  const st = getStateFromURL(DEFAULT_STATE);

  ui.paper.value = st.preset;
  ui.seed.value = String(st.seed >>> 0);
  ui.zPreset.value = st.zPreset;

  // Image upload handler
  ui.imageUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      appState.currentImage = await loadImageFromFile(file);
      ui.imageFileName.textContent = `✓ ${file.name} (${appState.currentImage.width}x${appState.currentImage.height}px)`;
      ui.useImageMode.checked = true;

      const threshold = parseInt(ui.imageThreshold.value, 10);
      await processImage(threshold);
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

  ui.btnRandomSeed.addEventListener("click", () => {
    ui.seed.value = String(randomSeed32());
    render();
  });

  ui.btnRender.addEventListener("click", () => render());

  [
    ui.paper, ui.marginMm, ui.seed, ui.zPreset,
    ui.cellCount, ui.minCellSizeMm,
    ui.cellBorderWidthMm, ui.patternStrokeMm, ui.minGapMm, ui.whiteSpaceMm, ui.sketchy,
    ui.maxPatternPassesPerCell, ui.patternSkipProb,
    ui.rotatePatterns, ui.rotationSet,
    ui.innerOrganicBorderEnabled, ui.innerOrganicBorderInsetMm, ui.innerOrganicJitterMm, ui.innerOrganicRoundMm
  ].forEach((el) => {
    if (el) el.addEventListener("input", debouncedRender);
  });

  ui.btnDownloadSVG.addEventListener("click", async () => {
    const { svg, paperKey, zPresetKey } = await render();
    downloadTextFile(`zentangle_${paperKey}_${zPresetKey}.svg`, svg);
  });

  ui.btnDownloadPNG.addEventListener("click", async () => {
    const { svg, paperKey, zPresetKey } = await render();
    const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;
    ui.status.innerText = "Preparando PNG...";
    await downloadPng(`zentangle_${paperKey}_${zPresetKey}_300dpi.png`, svg, presetPaper.w, presetPaper.h);
    ui.status.innerText = "Descargado PNG";
  });

  ui.btnDownloadPDF.addEventListener("click", async () => {
    const { svg, paperKey, zPresetKey } = await render();
    const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;
    ui.status.innerText = "Generando PDF (KDP)...";
    await downloadPdf(`zentangle_${paperKey}_${zPresetKey}_kdp.pdf`, svg, presetPaper.w, presetPaper.h);
    ui.status.innerText = "Descargado PDF";
  });

  ui.btnDownloadJSON.addEventListener("click", async () => {
    const { opts, paperKey, zPresetKey } = await render();
    downloadTextFile(
      `zentangle_${paperKey}_${zPresetKey}_opts.json`,
      JSON.stringify(opts, null, 2)
    );
  });

  render();
}

bind();

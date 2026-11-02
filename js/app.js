// js/app.js
// Punto de entrada de la aplicación Zentangle & Libros de Colorear KDP.
// Coordina los submódulos: ui/state.js, ui/viewer.js, ui/review.js, ui/bookExport.js.

import { createSvgDoc } from "./core/svgDoc.js";
import { renderSvgToString } from "./core/svgRender.js";
import { downloadTextFile, downloadPng, downloadPdf } from "./core/export.js";
import { getStateFromURL, setStateToURL, randomSeed32 } from "./core/urlState.js";
import {
  applySobelEdgeDetection,
  loadImageFromFile,
  drawImageWithSymmetry,
  generateDensityMap,
  getImageStats
} from "./core/imageProcessor.js";

import { ZENTANGLE_PRESETS } from "./generators/zentangle.presets.js";
import { generateZentangle } from "./generators/zentangle.generator.js";
import { createStylePicker } from "./ui/stylePicker.js";
import { printSafeOpts } from "./core/bookPlan.js";
import { BOOK_RECIPES } from "./core/bookRecipes.js";
import { compileFigureDefinition, registerImportedFigure } from "./core/svgImporter.js";
import { FIGURES, FIGURE_IDS, FIGURE_SETS } from "./generators/figure.js";
import { getThicknessProfile } from "./core/thicknessProfiles.js";
import { loadCurrentBook } from "./core/bookStorage.js";

// Submódulos UI modularizados (Fase 0.3)
import {
  $,
  ui,
  appState,
  DEFAULT_STATE,
  num,
  rasterizeSvg,
  debounce,
  buildOptsFromUI,
  applyPresetToUI,
  needsWideMargin,
  styleLabel,
  kdpWarning,
  renderThumb,
  showCurrentStyle,
  loadSettings,
  saveSettings,
  busyButtons,
  withBusy,
  PAPER_SIZES_MM,
  isRandomKey
} from "./ui/state.js";

import { openViewer, closeViewer } from "./ui/viewer.js";

import {
  updateBookButton,
  updateBookSummary,
  showBookReview,
  onBookButton,
  renderFigureSelector,
  loadBookRecipe,
  handleRecipeFile,
  showLibrary,
  saveCurrentBookToLibrary,
  tryRestoreAutosavedBook,
  restoreAutosavedBook
} from "./ui/review.js";

import {
  downloadListing,
  downloadCover,
  downloadOpenBook,
  bindSalesListeners
} from "./ui/bookExport.js";

// Genera N variaciones (misma configuración, distintas semillas) como galería
// clicable, para elegir el diseño que más guste e iterar rápido.
async function renderGallery(count = 8) {
  if (ui.useImageMode.checked && appState.processedImageCanvas) {
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
    await new Promise((r) => setTimeout(r, 0));
    ui.status.textContent = `Generando variaciones… ${i + 1}/${seeds.length}`;
  }

  ui.status.textContent = `✓ ${seeds.length} variaciones · haz clic en una para usarla`;
}

// forPrint: genera la página para descargar (sin guías de zona segura, textura
// ni sombreado) y no toca la vista previa.
async function render({ forPrint = false } = {}) {
  updateBookButton();
  ui.status.textContent = "Renderizando...";
  if (ui.previewPanel) ui.previewPanel.classList.remove("gallery-active");
  const paperKey = String(ui.paper.value || "A4");
  const presetPaper = PAPER_SIZES_MM[paperKey] ?? PAPER_SIZES_MM.A4;

  let marginMm = Math.max(0, num(ui.marginMm.value, 12.7));

  const built = buildOptsFromUI();
  const zPresetKey = built.zPresetKey;
  const opts = forPrint ? printSafeOpts(built.opts) : built.opts;

  if (needsWideMargin(zPresetKey)) {
    marginMm = Math.max(marginMm, 12.5);
  }

  const inner = {
    x: marginMm,
    y: marginMm,
    w: presetPaper.w - marginMm * 2,
    h: presetPaper.h - marginMm * 2,
  };

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
    rasterize: rasterizeSvg,
  });
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

  tempCanvas.width = 0;
  tempCanvas.height = 0;
  tempCanvas.remove?.();
  resultCanvas.width = 0;
  resultCanvas.height = 0;
  resultCanvas.remove?.();

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

  doc.body.push(`  <rect width="${presetPaper.w}" height="${presetPaper.h}" fill="white"/>`);
  const imageOpacity = parseFloat(ui.imageBlend ? ui.imageBlend.value : 0.35);
  doc.body.push(`  <image x="${inner.x}" y="${inner.y}" width="${inner.w}" height="${inner.h}" href="${imgDataUrl}" preserveAspectRatio="xMidYMid slice" opacity="${imageOpacity}"/>`);

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

const debouncedRender = debounce(async () => {
  await render();
  saveSettings();
}, 100);

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

  appState.processedImageCanvas = cleanupCanvas(appState.processedImageCanvas);
  appState.densityMapCanvas = cleanupCanvas(appState.densityMapCanvas);
  appState.imageStats = getImageStats(appState.currentImage);

  appState.processedImageCanvas = applySobelEdgeDetection(
    appState.currentImage,
    threshold,
    {
      normalize: true,
      blurPasses: 2,
      invertEdges: false
    }
  );

  appState.densityMapCanvas = generateDensityMap(appState.currentImage);
  ui.status.textContent = "✓ Imagen procesada";
}

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

function bind() {
  const st = getStateFromURL(DEFAULT_STATE);
  attachRangeReadouts();

  const saved = loadSettings();
  const urlHas = (k) => new URL(location.href).searchParams.has(k);
  [
    "paper", "marginMm", "zPreset", "samplerLayout", "samplerEdge", "samplerIconMode",
    "bookPages", "bookBlank", "bookTitle", "bookAuthor", "bookProgressive", "bookGuide", "bookSpreads", "bookTurn", "bookAutoFix",
    "showSafeZone", "paperTextureEnabled", "cellShadowEnabled", "fillDeadSpace", "kdpBleedMm", "lineThicknessProfile"
  ].forEach((id) => {
    const el = $(id);
    if (!el || saved[id] === undefined) return;
    if ((id === "paper" && urlHas("preset")) || (id === "zPreset" && urlHas("zPreset"))) return;
    if (el.type === "checkbox") el.checked = !!saved[id];
    else el.value = String(saved[id]);
  });

  if (!urlHas("preset") && saved.paper && ui.paper.selectedIndex >= 0) st.preset = ui.paper.value;
  if (!urlHas("zPreset") && saved.zPreset && ui.zPreset.selectedIndex >= 0) st.zPreset = ui.zPreset.value;

  ui.paper.value = st.preset;
  if (ui.paper.selectedIndex < 0) ui.paper.value = DEFAULT_STATE.preset;
  ui.seed.value = String(urlHas("seed") ? st.seed >>> 0 : randomSeed32());
  ui.zPreset.value = st.zPreset;
  if (ui.zPreset.selectedIndex < 0) ui.zPreset.value = DEFAULT_STATE.zPreset;

  applyPresetToUI(ui.zPreset.value);

  Object.entries(saved.touched || {}).forEach(([id, v]) => {
    const el = $(id);
    if (el) {
      el.value = v;
      appState.touched.add(id);
    }
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

  ui.imageUpload.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      appState.currentImage = await loadImageFromFile(file);
      const threshold = parseInt(ui.imageThreshold.value, 10);
      await processImage(threshold);

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

  ui.imageSlices.addEventListener("input", (e) => {
    ui.imageSlicesVal.textContent = e.target.value;
    if (ui.useImageMode.checked && appState.processedImageCanvas) {
      requestAnimationFrame(render);
    }
  });

  ui.imageZoom.addEventListener("input", (e) => {
    ui.imageZoomVal.textContent = e.target.value + "x";
    if (ui.useImageMode.checked && appState.processedImageCanvas) {
      requestAnimationFrame(render);
    }
  });

  ui.imageBlend.addEventListener("input", (e) => {
    ui.imageBlendVal.textContent = Math.round(parseFloat(e.target.value) * 100) + "%";
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

  const preview = document.querySelector("#preview");
  if (preview) {
    const getClientPos = (e) =>
      e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };

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

  ui.btnRender?.addEventListener("click", () => withBusy(render));
  ui.btnBook.addEventListener("click", onBookButton);
  $("btnBookReview")?.addEventListener("click", showBookReview);
  $("btnKdpListing")?.addEventListener("click", downloadListing);
  $("btnCover")?.addEventListener("click", downloadCover);
  $("btnOpenBook")?.addEventListener("click", downloadOpenBook);

  $("btnLoadRecipe")?.addEventListener("click", loadBookRecipe);
  $("inputRecipe")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleRecipeFile(file);
  });

  // Fase 4: Venta (ficha bilingüe, lotes, mockups)
  bindSalesListeners();

  const recipeBox = $("bookRecipes");
  const markRecipe = () =>
    recipeBox?.querySelectorAll(".recipe").forEach((b) => {
      const r = BOOK_RECIPES.find((x) => x.id === b.dataset.id);
      b.setAttribute("aria-pressed", String(r.style === ui.zPreset.value && int(ui.bookPages.value) === r.designs));
    });

  BOOK_RECIPES.forEach((r) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "recipe";
    b.dataset.id = r.id;
    b.textContent = r.label;
    b.title = r.hint;
    b.addEventListener("click", () => {
      ui.seed.value = String(randomSeed32());
      ui.zPreset.value = r.style;
      ui.bookPages.value = String(r.designs);
      ui.bookProgressive.checked = r.progressive;
      ui.bookGuide.checked = r.guide;
      ui.bookSpreads.checked = r.spreads;
      ui.bookTurn.checked = r.turn;
      ui.zPreset.dispatchEvent(new Event("change"));
      appState.stylePicker?.sync();
      updateBookSummary();
      saveSettings();
      markRecipe();
      const h = $("recipeHint");
      if (h) h.textContent = `${r.label}: ${r.hint} Ahora pulsa «📖 Preparar libro».`;
      ui.status.textContent = `✓ Libro «${r.label.replace(/^\S+\s/, "")}» configurado: ${r.designs} diseños · semilla ${ui.seed.value} · pulsa «Preparar libro»`;
    });
    recipeBox?.append(b);
  });

  [ui.zPreset, ui.bookPages].forEach((el) => el?.addEventListener("change", markRecipe));
  markRecipe();

  const bookOptEls = [ui.bookProgressive, ui.bookGuide, ui.bookSpreads, ui.bookTurn];
  [ui.bookPages, ui.bookBlank, ui.paper, ui.marginMm, ui.kdpBleedMm, ui.zPreset, ...bookOptEls].forEach((el) => {
    if (el) {
      el.addEventListener("input", updateBookSummary);
      el.addEventListener("change", updateBookSummary);
    }
  });
  [ui.bookPages, ui.bookBlank, ...bookOptEls].forEach((el) => el && el.addEventListener("change", saveSettings));
  updateBookSummary();

  if (ui.btnGallery) ui.btnGallery.addEventListener("click", () => withBusy(() => renderGallery(8)));

  ui.zPreset.addEventListener("change", () => {
    applyPresetToUI(ui.zPreset.value);
    showCurrentStyle();
    debouncedRender();
  });

  const pickerRoot = $("stylePicker");
  if (pickerRoot) {
    appState.stylePicker = createStylePicker({
      select: ui.zPreset,
      root: pickerRoot,
      renderThumb,
      onPick: () => ui.zPreset.dispatchEvent(new Event("change")),
    });
  }
  showCurrentStyle();

  if (ui.btnResetPreset) {
    ui.btnResetPreset.addEventListener("click", () => {
      appState.touched.clear();
      applyPresetToUI(ui.zPreset.value, { force: true });
      debouncedRender();
    });
  }

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
    el.addEventListener(evt, () => {
      appState.touched.add(el.id);
      debouncedRender();
    });
  });

  if (ui.lineThicknessProfile) {
    ui.lineThicknessProfile.addEventListener("change", () => {
      const p = getThicknessProfile(ui.lineThicknessProfile.value);
      if (p && ui.cellBorderWidthMm) ui.cellBorderWidthMm.value = p.cellBorderWidthMm;
      if (p && ui.patternStrokeMm) ui.patternStrokeMm.value = p.patternStrokeMm;
      appState.touched.add("lineThicknessProfile");
      appState.touched.add("cellBorderWidthMm");
      appState.touched.add("patternStrokeMm");
      debouncedRender();
    });
  }

  [
    ui.paper, ui.marginMm, ui.seed, ui.kdpBleedMm, ui.showSafeZone, ui.fillDeadSpace,
    ui.paperTextureEnabled, ui.cellShadowEnabled,
    ui.samplerLayout, ui.samplerEdge, ui.samplerIconMode,
  ].forEach((el) => {
    if (!el) return;
    const evt = el.type === "checkbox" ? "change" : "input";
    el.addEventListener(evt, debouncedRender);
  });

  ui.btnDownloadSVG.addEventListener("click", () =>
    withBusy(async () => {
      try {
        ui.status.innerText = "Preparando SVG...";
        const { svg, paperKey, zPresetKey } = await render({ forPrint: true });
        downloadTextFile(`diseno_${paperKey}_${zPresetKey}.svg`, svg);
        ui.status.innerText = "✓ Descargado SVG";
      } catch (err) {
        ui.status.innerText = `✗ Error al descargar SVG: ${err.message}`;
        console.error("Error al descargar SVG:", err);
      }
    })
  );

  ui.btnDownloadPNG.addEventListener("click", () =>
    withBusy(async () => {
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
    })
  );

  ui.btnDownloadPDF.addEventListener("click", () =>
    withBusy(async () => {
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
    })
  );

  ui.btnDownloadJSON.addEventListener("click", () =>
    withBusy(async () => {
      try {
        ui.status.innerText = "Preparando JSON...";
        const { opts, paperKey, zPresetKey } = await render();
        downloadTextFile(`diseno_${paperKey}_${zPresetKey}_opts.json`, JSON.stringify(opts, null, 2));
        ui.status.innerText = "✓ Descargado JSON";
      } catch (err) {
        ui.status.innerText = `✗ Error al descargar JSON: ${err.message}`;
        console.error("Error al descargar JSON:", err);
      }
    })
  );

  $("btnLibrary")?.addEventListener("click", showLibrary);
  $("btnSaveToLibrary")?.addEventListener("click", saveCurrentBookToLibrary);
  $("btnCloseLibrary")?.addEventListener("click", () => {
    const panel = $("libraryPanel");
    if (panel) panel.hidden = true;
  });

  $("btnContinueBook")?.addEventListener("click", async () => {
    const savedBook = await loadCurrentBook();
    if (savedBook) await restoreAutosavedBook(savedBook);
  });

  const btnImportSvg = $("btnImportSvgFigure");
  if (btnImportSvg) {
    btnImportSvg.addEventListener("click", async () => {
      const svgFileInput = $("svgFigureUpload");
      const jsonFileInput = $("jsonFigureUpload");
      const feedback = $("svgImportFeedback");
      if (!svgFileInput || !svgFileInput.files || !svgFileInput.files[0]) {
        if (feedback) {
          feedback.style.display = "block";
          feedback.style.background = "#fee2e2";
          feedback.style.color = "#991b1b";
          feedback.textContent = "Por favor selecciona un archivo SVG de silueta.";
        }
        return;
      }

      try {
        const svgFile = svgFileInput.files[0];
        const svgText = await svgFile.text();

        let meta = {};
        if (jsonFileInput && jsonFileInput.files && jsonFileInput.files[0]) {
          const jsonText = await jsonFileInput.files[0].text();
          try {
            meta = JSON.parse(jsonText);
          } catch (e) {
            if (feedback) {
              feedback.style.display = "block";
              feedback.style.background = "#fee2e2";
              feedback.style.color = "#991b1b";
              feedback.textContent = "Error al parsear archivo JSON: " + e.message;
            }
            return;
          }
        }

        const defaultId = svgFile.name.replace(/\.svg$/i, "").toLowerCase().replace(/[^a-z0-9_]/g, "_");
        meta.id = meta.id || $("svgFigId")?.value?.trim() || defaultId;
        meta.theme = meta.theme || $("svgFigTheme")?.value || "adult";
        meta.license = meta.license || $("svgFigLicense")?.value?.trim() || "Cesión comercial exclusiva / CC0";
        meta.origin = meta.origin || $("svgFigOrigin")?.value?.trim() || "Dibujo original vectorial";
        meta.author = meta.author || "Ilustrador";
        meta.audience = meta.theme === "kids" ? "kids" : "adult";

        const compiled = compileFigureDefinition(svgText, meta);
        if (!compiled.success) {
          if (feedback) {
            feedback.style.display = "block";
            feedback.style.background = "#fee2e2";
            feedback.style.color = "#991b1b";
            feedback.textContent = "Error al validar silueta: " + compiled.errors.join("; ");
          }
          return;
        }

        registerImportedFigure(compiled, FIGURES, FIGURE_IDS, FIGURE_SETS);

        if (ui.zPreset) {
          ui.zPreset.value = "zen_figure";
        }
        renderFigureSelector();
        render();

        if (feedback) {
          feedback.style.display = "block";
          feedback.style.background = "#dcfce7";
          feedback.style.color = "#166534";
          feedback.textContent = `✓ Silueta '${meta.id}' importada y validada correctamente con ${compiled.figureDef.parts.length} partes. ¡Previsualizando ahora!`;
        }
      } catch (err) {
        if (feedback) {
          feedback.style.display = "block";
          feedback.style.background = "#fee2e2";
          feedback.style.color = "#991b1b";
          feedback.textContent = "Error inesperado al importar: " + err.message;
        }
      }
    });
  }

  ui.zPreset.addEventListener("change", () => {
    renderFigureSelector();
  });

  const savedFigs = saved.excludedFigures;
  if (Array.isArray(savedFigs)) appState.excludedFigures = new Set(savedFigs);
  renderFigureSelector();

  tryRestoreAutosavedBook();

  render();
}

bind();

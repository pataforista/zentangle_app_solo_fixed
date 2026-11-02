// js/ui/bookExport.js
// Exportación de libros (PDF de interior, cubierta KDP, vista abierta, ficha y lote de venta).
// Módulo extraído de app.js (Fase 0.3).

import { $, ui, appState, busyButtons, pageGeometry, bookPlan, kdpWarning, isRandomKey, int, PAPER_LABELS } from "./state.js";
import { buildBookPdf, downloadTextFile } from "../core/export.js";
import { kdpListingText } from "../core/kdpListing.js";
import { downloadCoverPdf } from "../generators/cover.js";
import { downloadOpenBookPdf } from "../generators/openBookView.js";
import { ZENTANGLE_PRESETS } from "../generators/zentangle.presets.js";
import { RANDOM_COLOR_KEY, BESTSELLER_KEY, isColoringSafe } from "../generators/randomStyle.js";
import { STYLE_THEME } from "../core/bookRecipes.js";
import { generateFullListingText } from "../generators/bookListing.js";
import { generateBookRecipe, downloadBatchFiles, downloadBatchZip, validateBatchConfig, calculateBatchStats } from "../core/batchGenerator.js";
import { exportPageAsImage, getBestPagesForMockup, downloadImage, getCanvaInstructions, EXPORT_PRESETS, exportAplusPackageZip } from "../core/mockupExport.js";
import { buildBookExtras, bookSequence, makeBookPage, reviewIsFresh, updateNextSteps, updateBookButton, updateQualitySummary, downloadBookRecipe } from "./review.js";

// Genera y descarga el PDF final del interior del libro.
export async function createBook() {
  if (appState.bookJob || !appState.bookReview) return;
  const bookReview = appState.bookReview;
  const { g, n, baseSeed, pages } = bookReview;
  const job = (appState.bookJob = { cancelled: false });
  const others = busyButtons().filter((b) => b && b !== ui.btnBook);
  others.forEach((b) => (b.disabled = true));
  document.querySelectorAll(".tile-redo").forEach((b) => (b.disabled = true));
  ui.btnBook.textContent = "✖ Cancelar";
  ui.bookBar.hidden = false;
  ui.bookBar.value = 0;
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
      if (regen?.i !== i) regen = { i, page: await makeBookPage(g, pages[i].seed, i, baseSeed, bookReview, { thumb: false, quality: false }) };
      return regen.page;
    };
    const svgOf = async (e) => ({
      design: async () => (await full(e.i)).svg,
      spreadL: async () => (await full(e.i)).left,
      spreadR: async () => (await full(e.i)).right,
      guide: async () => extras.guide[e.i],
      passport: async () => extras.passport,
      turn: async () => extras.turn[e.i],
      frontMatter: async () => extras.frontMatter[e.i],
      hiddenSolutions: async () => extras.hiddenSolutions
    })[e.type]();
    const doc = await buildBookPdf({
      widthMm: g.paper.w,
      heightMm: g.paper.h,
      sequence,
      getEntrySvg: async (e) => svgOf(e),
      title,
      bleedMm: g.opts.kdpBleedMm || 0,
      isCancelled: () => job.cancelled,
      onProgress: (i, count) => {
        ui.bookBar.value = i / count;
        ui.btnBook.textContent = `✖ Cancelar (${i}/${count})`;
        ui.status.textContent = `Creando PDF… página ${i} de ${count}`;
      },
      getSvg: async (i) => pages[i].svg,
    });
    if (!doc) {
      ui.status.textContent = "PDF cancelado";
      return;
    }
    const bleedSuffix = g.opts.kdpBleedMm ? "_con_sangrado" : "";
    const name = `libro_${n}disenos_${g.paperKey}_${g.zPresetKey}_seed${baseSeed}${bleedSuffix}.pdf`;
    doc.save(name);
    bookReview.done.pdf = true;
    updateNextSteps();
    const changed = pages.filter((p) => p.tries).length;
    const bleedNotice = g.opts.kdpBleedMm ? " · ⚠ Al subir a KDP, selecciona «Con sangrado»" : "";
    ui.status.textContent = `✓ PDF listo (${total} páginas). Siguiente: 📝 ficha KDP y 🧾 receta, arriba en la revisión. · ${total} páginas${changed ? ` (${changed} ${changed === 1 ? "diseño cambiado" : "diseños cambiados"})` : ""} · ${name}${bleedNotice}` + kdpWarning(g.marginMm, g.opts.kdpBleedMm);
  } catch (err) {
    ui.status.textContent = `✗ No se pudo crear el libro: ${err.message}`;
    console.error("Error al crear libro:", err);
  } finally {
    appState.bookJob = null;
    ui.bookBar.hidden = true;
    others.forEach((b) => (b.disabled = false));
    document.querySelectorAll(".tile-redo").forEach((b) => (b.disabled = false));
    updateBookButton();
    updateQualitySummary();
  }
}

// Todo en un clic: PDF del interior, ficha de KDP y receta.
export async function downloadAll() {
  if (appState.bookJob || !appState.bookReview) return;
  const review = appState.bookReview;
  await createBook();
  if (appState.bookReview !== review || !review.done.pdf) return; // cancelado o con error
  downloadListing();
  downloadBookRecipe();
  ui.status.textContent = "✓ Listo: PDF, ficha de KDP y receta descargados. Sube el PDF como interior y pega la ficha en KDP.";
}

// Ficha de KDP con el libro tal como está configurado (o revisado), según su tema.
export function downloadListing() {
  const plan = bookPlan();
  const g = pageGeometry();
  const fresh = reviewIsFresh();
  const text = kdpListingText({
    designs: plan.n,
    pages: fresh ? appState.bookReview.total : plan.total,
    paperLabel: PAPER_LABELS[g.paperKey] || g.paperKey,
    trimWmm: g.paper.w,
    trimHmm: g.paper.h,
    flags: plan.flags,
    spreads: plan.units.filter((u) => u.kind === "spread").length,
    turnPages: plan.turnPages,
    blank: plan.blank,
    theme: STYLE_THEME[g.zPresetKey] || null,
    content: /^zen_figure/.test(g.zPresetKey) ? "figures" : g.zPresetKey === BESTSELLER_KEY || isRandomKey(g.zPresetKey) ? "mixed" : "other",
    noBlack: g.zPresetKey === BESTSELLER_KEY || g.zPresetKey === RANDOM_COLOR_KEY || (!isRandomKey(g.zPresetKey) && isColoringSafe(ZENTANGLE_PRESETS[g.zPresetKey] || {})),
  });
  downloadTextFile(`ficha_kdp_${plan.n}disenos.txt`, text, "text/plain;charset=utf-8");
  if (fresh) {
    appState.bookReview.done.listing = true;
    updateNextSteps();
  }
  ui.status.textContent = "✓ Ficha de KDP descargada: título, descripción, palabras clave y medidas de portada";
}

// Genera y descarga la portada PDF para KDP.
export async function downloadCover() {
  try {
    const plan = bookPlan();
    const g = pageGeometry();
    const fresh = reviewIsFresh();
    const pages = fresh ? appState.bookReview.total : plan.total;
    const title = ui.bookTitle?.value?.trim() || "Libro para colorear";
    const author = ui.bookAuthor?.value?.trim() || "";

    ui.status.textContent = "Generando portada...";
    const { spec, filename } = await downloadCoverPdf({
      pages,
      trimWmm: g.paper.w,
      trimHmm: g.paper.h,
      paper: plan.blank ? "white" : "premium",
      title,
      author,
    });

    if (fresh) {
      appState.bookReview.done.cover = true;
      updateNextSteps();
    }
    ui.status.textContent = `✓ Portada lista: ${spec.widthMm} × ${spec.heightMm} mm · lomo ${spec.spineMm} mm · ${filename}`;
  } catch (err) {
    ui.status.textContent = `✗ No se pudo generar la portada: ${err.message}`;
    console.error("Error al generar portada:", err);
  }
}

// Descarga un PDF con la vista de libro abierto (pliegos dobles).
export async function downloadOpenBook() {
  if (!appState.bookReview) {
    ui.status.textContent = "⚠ Primero prepara el libro";
    return;
  }
  try {
    const bookReview = appState.bookReview;
    const { g, baseSeed, pages, units, blank } = bookReview;
    const geo = { w: g.paper.w, h: g.paper.h, m: g.marginMm };
    const title = ui.bookTitle?.value?.trim() || "Libro para colorear";

    ui.status.textContent = "Generando vista de libro abierto...";
    const extras = await buildBookExtras(bookReview);
    const sequence = bookSequence(bookReview, extras);

    let regen = null;
    const full = async (i) => {
      if (pages[i].svg) return pages[i];
      if (regen?.i !== i) regen = { i, page: await makeBookPage(g, pages[i].seed, i, baseSeed, bookReview, { thumb: false, quality: false }) };
      return regen.page;
    };
    const svgOf = async (e) => ({
      design: async () => (await full(e.i)).svg,
      spreadL: async () => (await full(e.i)).left,
      spreadR: async () => (await full(e.i)).right,
      guide: async () => extras.guide[e.i],
      passport: async () => extras.passport,
      turn: async () => extras.turn[e.i],
      frontMatter: async () => extras.frontMatter[e.i],
      hiddenSolutions: async () => extras.hiddenSolutions
    })[e.type]();

    const filename = await downloadOpenBookPdf(sequence, geo, svgOf, title);
    ui.status.textContent = `✓ Vista de libro abierta lista: ${filename}`;
  } catch (err) {
    ui.status.textContent = `✗ No se pudo generar la vista de libro abierto: ${err.message}`;
    console.error("Error al generar vista de libro abierto:", err);
  }
}

// Vincula los eventos de la Fase 4 (Venta: ficha bilingüe, lotes y mockups).
export function bindSalesListeners() {
  let currentBilingualListing = null;

  $("btnBilingualListing")?.addEventListener("click", () => {
    const theme = $("listingTheme")?.value || "adult";
    const printType = $("listingPrintType")?.value || "blackWhite";
    const plan = bookPlan();
    const g = pageGeometry();
    const fresh = reviewIsFresh();

    const listingOpts = {
      theme,
      designs: plan.n,
      pages: fresh ? appState.bookReview.total : plan.total,
      paperLabel: PAPER_LABELS[g.paperKey] || g.paperKey,
      flags: plan.flags,
      blank: plan.blank,
      printType,
      channel: "amazon",
    };

    try {
      currentBilingualListing = generateFullListingText(listingOpts);
      const preview = $("bilingualListingPreview");
      const textEl = $("bilingualListingText");
      if (preview && textEl) {
        textEl.textContent = currentBilingualListing;
        preview.hidden = false;
      }
      const btnCopy = $("btnCopyListing");
      const btnDownload = $("btnDownloadBilingualListing");
      if (btnCopy) btnCopy.disabled = false;
      if (btnDownload) btnDownload.disabled = false;
      ui.status.textContent = "✓ Ficha bilingüe generada: título, subtítulo, palabras clave, categorías y regalías en español e inglés";
    } catch (err) {
      ui.status.textContent = `✗ Error generando ficha bilingüe: ${err.message}`;
      console.error("Error generando ficha bilingüe:", err);
    }
  });

  $("btnCopyListing")?.addEventListener("click", async () => {
    if (!currentBilingualListing) return;
    try {
      await navigator.clipboard.writeText(currentBilingualListing);
      ui.status.textContent = "✓ Ficha bilingüe copiada al portapapeles";
    } catch (err) {
      const textarea = document.createElement("textarea");
      textarea.value = currentBilingualListing;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        ui.status.textContent = "✓ Ficha bilingüe copiada al portapapeles";
      } catch (e) {
        ui.status.textContent = "✗ No se pudo copiar al portapapeles";
      }
      document.body.removeChild(textarea);
    }
  });

  $("btnDownloadBilingualListing")?.addEventListener("click", () => {
    if (!currentBilingualListing) return;
    const theme = $("listingTheme")?.value || "adult";
    downloadTextFile(`ficha_bilingue_${theme}.txt`, currentBilingualListing, "text/plain;charset=utf-8");
    ui.status.textContent = "✓ Ficha bilingüe descargada como TXT";
  });

  $("btnGenerateBatch")?.addEventListener("click", async () => {
    const count = int($("batchCount")?.value, 5);
    const baseName = $("batchBaseName")?.value?.trim() || "libro";
    const pages = int($("batchPages")?.value, 50);
    const theme = $("batchTheme")?.value || "adult";

    const validation = validateBatchConfig({ count, baseName, pages });
    if (!validation.valid) {
      ui.status.textContent = `✗ Configuración inválida: ${validation.errors.join(", ")}`;
      return;
    }

    const batchBar = $("batchBar");
    const batchStatus = $("batchStatus");
    if (batchBar) batchBar.hidden = false;

    ui.status.textContent = `Generando lote de ${count} libros...`;

    try {
      const books = [];
      for (let i = 0; i < count; i++) {
        if (batchBar) batchBar.value = (i + 1) / count;
        if (batchStatus) batchStatus.textContent = `Generando libro ${i + 1} de ${count}...`;

        const seed = Math.floor(Math.random() * 2147483647);
        const bookData = {
          seed,
          name: `${baseName}_${i + 1}`,
          theme,
          pages,
          paperKey: String(ui.paper.value || "LETTER"),
          printType: $("listingPrintType")?.value || "blackWhite",
          channel: "amazon",
          batchId: `batch_${Date.now()}`,
          bookIndex: i,
        };

        bookData.listingText = generateFullListingText({
          theme,
          designs: pages,
          pages,
          paperLabel: PAPER_LABELS[bookData.paperKey] || bookData.paperKey,
          flags: {},
          blank: true,
          printType: bookData.printType,
          channel: bookData.channel,
        });
        bookData.recipe = generateBookRecipe(bookData);

        books.push(bookData);
        await new Promise((r) => setTimeout(r, 10));
      }

      await downloadBatchZip(books, `${baseName}_${count}libros.zip`);

      const stats = calculateBatchStats(books);
      if (batchBar) batchBar.hidden = true;
      if (batchStatus) batchStatus.textContent = `✓ Lote completado: ${stats.totalBooks} libros, ${stats.totalPages} páginas totales (en ${baseName}_${count}libros.zip)`;
      ui.status.textContent = `✓ Lote de ${count} libros empaquetado y descargado en ZIP`;
    } catch (err) {
      ui.status.textContent = `✗ Error generando lote: ${err.message}`;
      console.error("Error generando lote:", err);
      if (batchBar) batchBar.hidden = true;
    }
  });

  $("btnExportMockups")?.addEventListener("click", async () => {
    if (!appState.bookReview) {
      ui.status.textContent = "⚠ Primero prepara un libro para exportar sus páginas";
      return;
    }

    try {
      ui.status.textContent = "Empaquetando mockups 3D y módulos A+...";
      await exportAplusPackageZip(appState.bookReview, "mockups_y_aplus.zip");
      ui.status.textContent = "✓ Mockup 3D de libro abierto y 3 módulos A+ descargados en mockups_y_aplus.zip";
    } catch (err) {
      ui.status.textContent = `✗ Error exportando mockups: ${err.message}`;
      console.error("Error exportando mockups:", err);
    }
  });
}

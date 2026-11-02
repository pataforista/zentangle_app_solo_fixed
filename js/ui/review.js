// js/ui/review.js
// Revisión de libro completo: generación de páginas, cuadrícula interactiva,
// reemplazos (↻), undo, fijado (📌), modo escaparate, control de calidad,
// recetas (JSON) y biblioteca local.
// Módulo extraído de app.js (Fase 0.3).

import {
  $,
  ui,
  appState,
  busyButtons,
  rasterizeSvg,
  pageGeometry,
  bookPlan,
  bookKey,
  styleLabel,
  isRandomKey,
  applyPresetToUI,
  showCurrentStyle,
  saveSettings,
  kdpWarning,
  KDP_MIN_PAGES,
  KDP_MAX_PAGES,
  SVG_BUDGET,
  THUMB_PX,
  QPX,
  PAPER_SIZES_MM,
  PAPER_LABELS,
  num,
  int,
  bool01,
  BESTSELLER_KEY
} from "./state.js";
import { openViewer, closeViewer } from "./viewer.js";
import { createBook, downloadAll, downloadListing } from "./bookExport.js";

import { createSvgDoc } from "../core/svgDoc.js";
import { renderSvgToString } from "../core/svgRender.js";
import { downloadTextFile } from "../core/export.js";
import { ZENTANGLE_PRESETS } from "../generators/zentangle.presets.js";
import { generateZentangle } from "../generators/zentangle.generator.js";
import { planSequence, difficultyAt, kdpInsideMarginMm, printSafeOpts } from "../core/bookPlan.js";
import { pageSeed, spreadFigureFor, singlesBefore } from "../core/bookSeeds.js";
import { generateSpread, SPREAD_FIGURES } from "../generators/spread.js";
import { figureForPage, FIGURE_IDS } from "../generators/figure.js";
import {
  analyzeColorability,
  qualityVerdict,
  qualityScore,
  extractFigureMetrics,
  analyzeContrast,
  coverageVerdict
} from "../core/pageQuality.js";
import {
  TANGLE_INFO,
  tanglesInSvgs,
  tangleGuidePages,
  tanglePassportPage,
  footerSvg,
  levelInfo,
  appendToSvg
} from "../generators/bookExtras.js";
import { getQualityLimitsForProfile } from "../core/thicknessProfiles.js";
import { generateFrontMatter } from "../generators/frontMatter.js";
import {
  saveCurrentBook,
  loadCurrentBook,
  clearCurrentBook,
  saveBookToLibrary,
  listLibraryBooks,
  getLibraryBook,
  renameLibraryBook,
  updateLibraryBookState,
  duplicateLibraryBook,
  deleteLibraryBook
} from "../core/bookStorage.js";

export function updateBookSummary() {
  if (!ui.bookSummary) return;
  const { n, blank, total, flags, units, turnPages } = bookPlan();
  const g = pageGeometry();
  const spreads = units.filter((u) => u.kind === "spread").length;
  const extras = [
    spreads ? `${spreads} doble${spreads > 1 ? "s" : ""} página${spreads > 1 ? "s" : ""}` : "",
    flags.guide ? "guía y pasaporte" : "",
    turnPages ? `${turnPages} «Tu turno»` : "",
    flags.progressive ? "dificultad progresiva" : ""
  ].filter(Boolean);
  const parts = [
    `${n} diseños${blank ? " con reverso en blanco" : ""}${extras.length ? ` · ${extras.join(" · ")}` : ""} = <strong>${flags.guide ? "≈ " : ""}${total} páginas</strong> · ${PAPER_LABELS[g.paperKey] || g.paperKey} · margen ${g.marginMm} mm${g.zPresetKey === BESTSELLER_KEY ? " · 💰 estilos más rentables, repartidos" : isRandomKey(g.zPresetKey) ? " · 🎲 un estilo distinto en cada página" : ""}`
  ];
  let cls = "hint ok";
  if (total < KDP_MIN_PAGES) {
    parts.push(`⚠ KDP pide mínimo ${KDP_MIN_PAGES} páginas: añade diseños.`);
    cls = "hint warn";
  }
  const needIn = kdpInsideMarginMm(total);
  if (g.marginMm < needIn) {
    parts.push(`⚠ Con ${total} páginas KDP pide un margen interior de al menos ${needIn} mm: sube el margen a ${Math.ceil(needIn)} mm.`);
    cls = "hint warn";
  }
  if (!blank) {
    parts.push("📄 Sin hojas en blanco: en KDP elige «Tinta y papel: color prémium», el papel más grueso de KDP (60–71 lb frente a 50–61 lb del blanco y negro). Cuesta más por página y aun así prueba tus rotuladores: el papel grueso reduce el traspaso, no lo elimina.");
  }
  if (total > KDP_MAX_PAGES) {
    parts.push(`⚠ KDP admite hasta ${KDP_MAX_PAGES} páginas en blanco y negro: quita diseños o usa «Otro diseño» como reverso.`);
    cls = "hint warn";
  }
  if (n >= 120) {
    parts.push(`⏱ Libro grande: preparar ${n} diseños lleva varios minutos (≈ 1–2 s por diseño).`);
  }
  const w = kdpWarning(g.marginMm, g.opts.kdpBleedMm).replace(/^ \| /, "");
  if (w) {
    parts.push(w);
    cls = "hint warn";
  } else if (cls !== "hint warn" && total >= KDP_MIN_PAGES && total <= KDP_MAX_PAGES) {
    parts.push("✓ Cumple los límites de KDP");
  }
  ui.bookSummary.className = cls;
  ui.bookSummary.innerHTML = parts.join("<br>");
  updateBookButton();
}

export async function thumbUrl(svg, wMm, hMm) {
  const w = Math.round(THUMB_PX * (wMm / Math.min(wMm, hMm * 0.78)));
  const h = Math.round(w * (hMm / wMm));
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = () => rej(new Error("No se pudo dibujar la miniatura"));
      img.src = url;
    });
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise((res) => c.toBlob(res, "image/png"));
    c.width = 0;
    c.height = 0;
    return URL.createObjectURL(blob);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const svgSize = (p) => (p.svg?.length || 0) + (p.left?.length || 0) + (p.right?.length || 0);

export function keepOrDropSvg(review, page, freed = 0) {
  review.svgBytes = Math.max(0, (review.svgBytes || 0) - freed);
  const size = svgSize(page);
  if (review.svgBytes + size <= SVG_BUDGET) {
    review.svgBytes += size;
    return;
  }
  page.svg = page.left = page.right = null;
}

export const stripFooter = (svg) => svg.replace(/<g data-footer="1">[\s\S]*?<\/g>/, "");

export async function measurePage(svg, wMm, hMm, artAreaMm2, thicknessProfile = "standard") {
  const r = await rasterizeSvg(svg, Math.round(wMm * QPX), Math.round(hMm * QPX));
  const q = analyzeColorability(r, QPX);
  const profileLimits = getQualityLimitsForProfile(thicknessProfile);
  const v = qualityVerdict(q, artAreaMm2, { ...profileLimits, badPerDm2: Number(globalThis.ZT_QUALITY_BAD_DM2) || profileLimits.badPerDm2 });
  const result = { bad: q.bad, ink: Math.round(q.ink * 10) / 10, ok: v.ok, reasons: [...v.reasons], maxBad: v.maxBad };
  const figMetrics = extractFigureMetrics(svg);
  if (figMetrics) {
    result.coverage = figMetrics.coverage;
    result.layout = figMetrics.layout;
    const covV = coverageVerdict(figMetrics.coverage, figMetrics.layout);
    if (!covV.ok) result.reasons.push(covV.reason);
    const contrast = analyzeContrast(r, figMetrics.silD, wMm, hMm);
    if (contrast) {
      result.contrast = contrast.contrast;
      result.densityInside = contrast.densityInside;
      result.densityOutside = contrast.densityOutside;
      if (!contrast.ok) result.reasons.push(contrast.reason);
    }
    if (!covV.ok || (contrast && !contrast.ok)) result.ok = false;
  }
  return result;
}

export const artArea = (g, spread = false) => g.inner.w * g.inner.h * (spread ? 2 : 1);

export async function makeBookPage(g, seed, pageIndex, bookSeed, plan, { thumb = true, quality = true } = {}) {
  const geo = { w: g.paper.w, h: g.paper.h, m: g.marginMm };
  const kind = plan?.units?.[pageIndex]?.kind || "single";
  const difficulty = plan?.flags?.progressive ? difficultyAt(pageIndex, plan.n) : null;
  const lv = difficulty === null ? null : levelInfo(difficulty);
  const footer = lv ? footerSvg(geo, { text: `Nivel ${lv.level} de 5 · ≈ ${lv.minutes} min`, level: lv.level, lineThicknessProfile: g.opts.lineThicknessProfile }) : "";
  if (kind === "spread") {
    const nth = plan.units.slice(0, pageIndex).filter((u) => u.kind === "spread").length;
    const figureName = spreadFigureFor(ZENTANGLE_PRESETS[g.zPresetKey]?.figures, SPREAD_FIGURES, bookSeed, nth);
    const sp = await generateSpread({ paper: g.paper, marginMm: g.marginMm, seed, difficulty, figureName, rasterize: rasterizeSvg });
    const right = appendToSvg(sp.right, footer);
    const url = thumb ? await thumbUrl(sp.wide, g.paper.w * 2, g.paper.h) : null;
    const q = quality ? await measurePage(sp.wide, g.paper.w * 2, g.paper.h, artArea(g, true), g.opts.lineThicknessProfile) : null;
    return { kind, seed, svg: sp.wide, left: sp.left, right, url, quality: q, presetName: "zen_figure", tangles: tanglesInSvgs([sp.wide]), figure: sp.figure };
  }
  const d = createSvgDoc({ wMm: g.paper.w, hMm: g.paper.h, meta: { seed, generator: "patrones" } });
  const overrides = { ...printSafeOpts(g.opts), seed, ...(difficulty === null ? {} : { difficulty }) };
  if (!isRandomKey(g.zPresetKey) && plan?.units) overrides.figurePage = singlesBefore(plan.units, pageIndex);
  const filteredFigs = getFilteredFigures();
  if (filteredFigs.length && filteredFigs.length !== (ZENTANGLE_PRESETS[g.zPresetKey]?.figures || FIGURE_IDS).length) {
    overrides.figures = filteredFigs;
  }
  const rerolled = isRandomKey(g.zPresetKey) && g.zPresetKey !== BESTSELLER_KEY && seed !== pageSeed(bookSeed, pageIndex, 0);
  const used = await generateZentangle(d, { seed, presetName: g.zPresetKey, overrides, areaMm: g.inner, pageIndex: rerolled ? null : pageIndex, bookSeed, rasterize: rasterizeSvg });
  const bare = renderSvgToString(d);
  const nHidden = (bare.match(/data-hidden="/g) || []).length;
  const seek = nHidden ? `busca ${nHidden} figura${nHidden > 1 ? "s" : ""} escondida${nHidden > 1 ? "s" : ""}` : "";
  const pageFooter = lv
    ? footerSvg(geo, { text: `Nivel ${lv.level} de 5 · ≈ ${lv.minutes} min${seek ? ` · ${seek}` : ""}`, level: lv.level, lineThicknessProfile: g.opts.lineThicknessProfile })
    : seek ? footerSvg(geo, { text: `${seek[0].toUpperCase()}${seek.slice(1)}`, lineThicknessProfile: g.opts.lineThicknessProfile }) : "";
  const svg = appendToSvg(bare, pageFooter);
  const url = thumb ? await thumbUrl(svg, g.paper.w, g.paper.h) : null;
  const q = quality ? await measurePage(bare, g.paper.w, g.paper.h, artArea(g), g.opts.lineThicknessProfile) : null;
  return { kind, seed, svg, url, quality: q, presetName: used.presetName, tangles: tanglesInSvgs([svg]), figure: (svg.match(/data-figure="([^"]+)"/) || [])[1] || null };
}

export async function buildBookExtras(review) {
  const { g, flags, turnPages, baseSeed } = review;
  const geo = { w: g.paper.w, h: g.paper.h, m: g.marginMm };
  const out = { guide: [], passport: null, turn: [], frontMatter: [] };

  const title = ui.bookTitle?.value?.trim() || "Libro para colorear";
  const author = ui.bookAuthor?.value?.trim() || "";
  out.frontMatter = generateFrontMatter(geo, { title, author, lineThicknessProfile: g.opts.lineThicknessProfile });

  if (flags.guide) {
    const found = [...new Set(review.pages.flatMap((p) => p.tangles || []))];
    const ids = found.length >= 3 ? found : Object.keys(TANGLE_INFO);
    out.guide = tangleGuidePages(ids, geo, { lineThicknessProfile: g.opts.lineThicknessProfile });
    out.passport = tanglePassportPage(ids, geo, { lineThicknessProfile: g.opts.lineThicknessProfile });
  }

  out.hiddenSolutions = collectHiddenSolutions(review, geo);

  const usedFigs = new Set(review.pages.map((p) => p.figure).filter(Boolean));
  const turnSet = ZENTANGLE_PRESETS[g.zPresetKey]?.figures || ZENTANGLE_PRESETS.zen_figure.figures;
  const freshFigs = turnSet.filter((f) => !usedFigs.has(f));
  for (let k = 0; k < turnPages; k++) {
    const seed = pageSeed(baseSeed, 1000 + k, 0);
    const d = createSvgDoc({ wMm: g.paper.w, hMm: g.paper.h, meta: { seed, generator: "patrones" } });
    await generateZentangle(d, { seed, presetName: "zen_figure", overrides: { ...ZENTANGLE_PRESETS.zen_figure, seed, emptySections: true, figureName: freshFigs.length ? freshFigs[k % freshFigs.length] : figureForPage(baseSeed ^ 0x7777, k, turnSet) }, areaMm: g.inner });
    const text = flags.guide ? "Tu turno: dibuja en cada sección un tangle de la guía" : "Tu turno: dibuja tus propios tangles en cada sección";
    out.turn.push(appendToSvg(renderSvgToString(d), footerSvg(geo, { text, lineThicknessProfile: g.opts.lineThicknessProfile })));
  }
  return out;
}

export function collectHiddenSolutions(review, geo) {
  const solutions = [];
  review.pages.forEach((page, pageIndex) => {
    const svg = page.svg || "";
    const hiddenMatches = [...svg.matchAll(/data-hidden="([^"]+)"/g)];
    hiddenMatches.forEach((match) => {
      solutions.push({
        pageIndex,
        figureName: match[1],
      });
    });
  });
  if (solutions.length === 0) return null;
  return generateSolutionsPage(solutions, geo);
}

export function generateSolutionsPage(solutions, geo) {
  const { w, h, m } = geo;
  const FONT = `font-family="Helvetica, Arial, sans-serif"`;
  const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>`];
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(m + 10)}" ${FONT} font-size="8" font-weight="bold" text-anchor="middle">Soluciones: figuras escondidas</text>`);
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(m + 18)}" ${FONT} font-size="3.5" text-anchor="middle">Aquí están todas las figuras que se esconden en el libro</text>`);

  const startY = m + 30;
  const lineHeight = 6;
  const maxSolutions = Math.floor((h - startY - m) / lineHeight);

  solutions.slice(0, maxSolutions).forEach((sol, i) => {
    const y = startY + i * lineHeight;
    const pageNum = sol.pageIndex + 1;
    out.push(`<text x="${fmt(m)}" y="${fmt(y)}" ${FONT} font-size="4">Página ${pageNum}: <tspan font-weight="bold">${esc(sol.figureName)}</tspan></text>`);
  });

  if (solutions.length > maxSolutions) {
    const y = startY + maxSolutions * lineHeight;
    out.push(`<text x="${fmt(m)}" y="${fmt(y)}" ${FONT} font-size="3.5" font-style="italic">...y ${solutions.length - maxSolutions} más</text>`);
  }

  out.push("</svg>");
  return out.join("");
}

export const fmt = (n) => (Math.round(Number(n) * 100) / 100).toString();

export const extrasList = (ex) => [
  ...(ex.frontMatter || []).map((svg, i) => ({ svg, label: ["Portada", "Copyright", "Pertenece a", "Prueba de color"][i] || `Front matter ${i + 1}` })),
  ...ex.guide.map((svg, i) => ({ svg, label: `Guía ${i + 1}` })),
  ...(ex.passport ? [{ svg: ex.passport, label: "Pasaporte" }] : []),
  ...(ex.hiddenSolutions ? [{ svg: ex.hiddenSolutions, label: "Soluciones" }] : []),
  ...ex.turn.map((svg, i) => ({ svg, label: `Tu turno ${i + 1}` })),
];

export const bookSequence = (review, ex) =>
  planSequence(review.units, {
    blank: review.blank,
    guidePages: ex.guide.length,
    passport: !!ex.passport,
    turnPages: ex.turn.length,
    frontMatterPages: (ex.frontMatter || []).length,
    hiddenSolutions: !!ex.hiddenSolutions,
  });

export function freeBookReview() {
  closeViewer();
  appState.bookReview?.pages.forEach((p) => p && URL.revokeObjectURL(p.url));
  appState.bookReview?.extraUrls?.forEach((u) => URL.revokeObjectURL(u));
  appState.bookReview = null;
}

export const reviewIsFresh = () => {
  if (!appState.bookReview) return false;
  return appState.bookReview.key === bookKey(pageGeometry(), bookPlan());
};

export function updateBookButton() {
  if (appState.bookJob) return;
  const fresh = reviewIsFresh();
  const view = $("btnBookReview");
  if (view) view.hidden = !fresh;
  const openBook = $("btnOpenBook");
  if (openBook) openBook.hidden = !fresh;
  ui.btnBook.textContent = fresh
    ? `⬇ Descargar libro (PDF · ${appState.bookReview.total} págs)`
    : (appState.bookReview ? "📖 Preparar libro de nuevo (cambiaste ajustes)" : "📖 Preparar libro (revisar páginas)");
  ui.btnBook.dataset.mode = fresh ? "download" : "prepare";
}

export function showBookReview() {
  const bookReview = appState.bookReview;
  if (!bookReview) return;
  ui.previewPanel?.classList.add("gallery-active");
  const wrap = document.createElement("div");
  wrap.className = "book-review";
  const head = document.createElement("div");
  head.className = "book-review-head";
  const title = document.createElement("p");
  title.className = "book-review-title";
  title.textContent = `Revisa tu libro: ${bookReview.n} diseños. Toca una página para verla a tamaño real; ↻ la cambia por otra al instante.`;
  const qsum = document.createElement("p");
  qsum.id = "qSummary";
  qsum.className = "q-summary";
  const titleBox = document.createElement("div");
  const next = document.createElement("p");
  next.id = "nextSteps";
  next.className = "next-steps";
  titleBox.append(title, qsum, next);
  const fix = document.createElement("button");
  fix.type = "button";
  fix.id = "btnFixFlagged";
  fix.className = "btn btn-secondary";
  fix.addEventListener("click", fixFlaggedPages);
  const dl = document.createElement("button");
  dl.type = "button";
  dl.className = "btn btn-primary";
  dl.id = "btnDownloadAll";
  dl.textContent = "📦 Descargar todo";
  dl.title = "PDF del interior + ficha de KDP + receta del libro (el navegador puede pedir permiso para varias descargas)";
  dl.addEventListener("click", downloadAll);
  const actions = document.createElement("div");
  actions.className = "book-review-actions";
  actions.append(fix, dl);
  head.append(titleBox, actions);

  const grid = document.createElement("div");
  grid.className = "gallery-grid book-grid";
  bookReview.pages.forEach((page, i) => grid.append(bookTile(i)));
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
  updateQualitySummary();
  updateNextSteps();
}

export function updateNextSteps() {
  const el = $("nextSteps");
  const bookReview = appState.bookReview;
  if (!el || !bookReview) return;
  const d = bookReview.done, flagged = flaggedPages(bookReview).length;
  const steps = [
    ["Revisar", !flagged, null],
    ["⬇ PDF", d.pdf, () => createBook()],
    ["📝 Ficha KDP", d.listing, downloadListing],
    ["🧾 Receta", d.recipe, downloadBookRecipe],
  ];
  el.replaceChildren("Para terminar: ");
  steps.forEach(([label, ok, fn], k) => {
    if (k) el.append(" → ");
    if (ok) {
      const sp = document.createElement("span");
      sp.className = "done";
      sp.textContent = `✓ ${label}`;
      el.append(sp);
      return;
    }
    if (!fn) {
      el.append(`${label} (${flagged} marcada${flagged > 1 ? "s" : ""})`);
      return;
    }
    const b = document.createElement("button");
    b.type = "button";
    b.className = "link-btn";
    b.textContent = label;
    b.addEventListener("click", fn);
    el.append(b);
  });
}

export const flaggedPages = (review) => review.pages.map((p, i) => (p.quality && !p.quality.ok ? i : -1)).filter((i) => i >= 0);

export function updateQualitySummary() {
  const el = $("qSummary"), fix = $("btnFixFlagged");
  const bookReview = appState.bookReview;
  if (!bookReview || !el) return;
  const flagged = flaggedPages(bookReview);
  const measured = bookReview.pages.filter((p) => p.quality).length;
  el.className = `q-summary${flagged.length ? " warn" : ""}`;
  el.textContent = !measured ? "" : flagged.length
    ? `Control de calidad: ${measured - flagged.length} páginas bien · ${flagged.length} marcada${flagged.length > 1 ? "s" : ""} (zonas donde no cabe la punta del rotulador).`
    : `Control de calidad: las ${measured} páginas pasan.`;
  if (fix) {
    fix.hidden = !flagged.length;
    fix.textContent = `🛠 Arreglar ${flagged.length === 1 ? "la marcada" : `las ${flagged.length} marcadas`}`;
    fix.disabled = !!appState.bookJob;
  }
  updateNextSteps();
}

export async function fixFlaggedPages() {
  if (!appState.bookReview || appState.bookJob) return;
  const review = appState.bookReview;
  const flagged = flaggedPages(review);
  if (!flagged.length) return;
  const job = (appState.bookJob = { cancelled: false });
  const others = busyButtons().filter((b) => b && b !== ui.btnBook);
  others.forEach((b) => (b.disabled = true));
  document.querySelectorAll(".tile-redo, #btnFixFlagged").forEach((b) => (b.disabled = true));
  ui.btnBook.textContent = "✖ Detener";
  let fixed = 0, done = 0;
  try {
    for (const i of flagged) {
      if (job.cancelled || appState.bookReview !== review) break;
      const tile = document.querySelector(`.book-tile[data-index="${i}"]`);
      tile?.classList.add("busy");
      ui.status.textContent = `Arreglando la página ${i + 1} (${done + 1} de ${flagged.length})…`;
      const old = review.pages[i];
      let best = old, tries = old.tries || 0;
      const score = (p) => qualityScore(p.quality, p.quality.maxBad);
      for (let a = 0; a < 3 && !best.quality.ok && !job.cancelled; a++) {
        tries++;
        const cand = await makeBookPage(review.g, pageSeed(review.baseSeed, i, tries), i, review.baseSeed, review);
        cand.tries = tries;
        if (score(cand) < score(best)) {
          if (best !== old) URL.revokeObjectURL(best.url);
          best = cand;
        } else {
          URL.revokeObjectURL(cand.url);
        }
        await new Promise((r) => setTimeout(r, 0));
      }
      if (appState.bookReview !== review) {
        if (best !== old) URL.revokeObjectURL(best.url);
        break;
      }
      if (best !== old) {
        keepOrDropSvg(review, best, svgSize(old));
        review.pages[i] = best;
        URL.revokeObjectURL(old.url);
      }
      if (best.quality.ok) fixed++;
      done++;
      const fresh = bookTile(i);
      if (tile) tile.replaceWith(fresh);
      fresh.querySelector(".tile-redo").disabled = true;
    }
    const left = flaggedPages(review).length;
    ui.status.textContent = `✓ ${fixed} de ${flagged.length} páginas arregladas` + (left ? ` · ${left} siguen marcadas: ábrelas para ver las zonas en rojo y decide si las dejas o las cambias con ↻` : "");
  } catch (err) {
    ui.status.textContent = `✗ No se pudieron arreglar las páginas: ${err.message}`;
    console.error("Error al arreglar páginas:", err);
  } finally {
    appState.bookJob = null;
    others.forEach((b) => (b.disabled = false));
    document.querySelectorAll(".tile-redo").forEach((b) => (b.disabled = false));
    updateBookButton();
    updateQualitySummary();
  }
}

export function bookRecipe(review) {
  const { g, n, blank, flags, baseSeed, pages, total } = review;
  return {
    app: "generador-libros-colorear",
    recipeVersion: 1,
    createdAt: new Date().toISOString(),
    paper: { key: g.paperKey, wMm: g.paper.w, hMm: g.paper.h },
    marginMm: g.marginMm,
    style: g.zPresetKey,
    opts: printSafeOpts(g.opts),
    designs: n,
    blankBacks: blank,
    flags,
    baseSeed,
    totalPages: total,
    pages: pages.map((p, i) => ({
      design: i + 1,
      kind: p.kind,
      seed: p.seed,
      tries: p.tries || 0,
      style: p.presetName,
      figure: p.figure || null,
      tangles: p.tangles || [],
      quality: p.quality
        ? {
            bad: p.quality.bad,
            ink: p.quality.ink,
            ok: p.quality.ok,
            ...(p.quality.coverage != null ? { coverage: p.quality.coverage, layout: p.quality.layout } : {}),
            ...(p.quality.contrast != null ? { contrast: p.quality.contrast, densityInside: p.quality.densityInside, densityOutside: p.quality.densityOutside } : {})
          }
        : null
    })),
  };
}

export function downloadBookRecipe() {
  const bookReview = appState.bookReview;
  if (!bookReview) return;
  const r = bookReview;
  downloadTextFile(`receta_libro_${r.n}disenos_${r.g.paperKey}_seed${r.baseSeed}.json`, JSON.stringify(bookRecipe(r), null, 2), "application/json;charset=utf-8");
  r.done.recipe = true;
  updateNextSteps();
  ui.status.textContent = "✓ Receta descargada: guárdala junto al PDF";
}

export function restoreOptsToUI(opts) {
  if (!opts) return;
  const set = (el, v) => { if (el && v !== undefined && v !== null) el.value = String(v); };
  const setBool = (el, v) => { if (el && v !== undefined) el.value = v ? "1" : "0"; };
  set(ui.cellCount, opts.cellCount);
  set(ui.minCellSizeMm, opts.minCellSizeMm);
  set(ui.cellBorderWidthMm, opts.cellBorderWidthMm);
  set(ui.patternStrokeMm, opts.patternStrokeMm);
  set(ui.lineThicknessProfile, opts.lineThicknessProfile);
  set(ui.minGapMm, opts.minGapMm);
  set(ui.whiteSpaceMm, opts.whiteSpaceMm);
  set(ui.sketchy, opts.sketchy);
  set(ui.maxPatternPassesPerCell, opts.maxPatternPassesPerCell);
  set(ui.patternSkipProb, opts.patternSkipProb);
  setBool(ui.rotatePatterns, opts.rotatePatterns);
  set(ui.rotationSet, opts.rotationSet);
  setBool(ui.innerOrganicBorderEnabled, opts.innerOrganicBorderEnabled);
  set(ui.innerOrganicBorderInsetMm, opts.innerOrganicBorderInsetMm);
  set(ui.innerOrganicJitterMm, opts.innerOrganicJitterMm);
  set(ui.innerOrganicRoundMm, opts.innerOrganicRoundMm);
  set(ui.patternFamily, opts.patternFamily || "");
  set(ui.focalStrength, opts.focalStrength);
  set(ui.rotationJitterDeg, opts.rotationJitterDeg);
  set(ui.kdpBleedMm, opts.kdpBleedMm);
  if (ui.showSafeZone && opts.showSafeZone !== undefined) ui.showSafeZone.checked = !!opts.showSafeZone;
  setBool(ui.paperTextureEnabled, opts.paperTextureEnabled);
  setBool(ui.cellShadowEnabled, opts.cellShadowEnabled);
  if (ui.fillDeadSpace && opts.fillDeadSpace !== undefined) ui.fillDeadSpace.checked = !!opts.fillDeadSpace;
  if (ui.samplerLayout) set(ui.samplerLayout, opts.samplerLayout);
  if (ui.samplerEdge) set(ui.samplerEdge, opts.samplerEdge);
  if (ui.samplerIconMode) set(ui.samplerIconMode, opts.samplerIconMode);
}

export function loadBookRecipe() {
  const input = $("inputRecipe");
  if (!input) return;
  input.value = "";
  input.click();
}

export async function handleRecipeFile(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const recipe = JSON.parse(text);
    if (recipe.app !== "generador-libros-colorear") {
      ui.status.textContent = "✗ El archivo no es una receta de este generador";
      return;
    }
    if (!recipe.pages || !Array.isArray(recipe.pages) || !recipe.pages.length) {
      ui.status.textContent = "✗ Receta inválida: faltan las páginas";
      return;
    }
    if (!recipe.paper || !recipe.style || recipe.baseSeed === undefined) {
      ui.status.textContent = "✗ Receta incompleta: faltan datos esenciales (papel, estilo o semilla)";
      return;
    }
    await restoreBookFromRecipe(recipe);
  } catch (err) {
    ui.status.textContent = `✗ No se pudo cargar la receta: ${err.message}`;
    console.error("Error al cargar receta:", err);
  }
}

export async function restoreBookFromRecipe(recipe) {
  if (recipe.paper.key && PAPER_SIZES_MM[recipe.paper.key]) {
    ui.paper.value = recipe.paper.key;
  }
  ui.marginMm.value = String(recipe.marginMm ?? 12.7);
  if (ui.zPreset.querySelector(`option[value="${recipe.style}"]`) || isRandomKey(recipe.style)) {
    ui.zPreset.value = recipe.style;
  } else {
    ui.status.textContent = `✗ El estilo «${recipe.style}» ya no está disponible en esta versión`;
    return;
  }
  ui.bookPages.value = String(recipe.designs);
  ui.bookBlank.value = recipe.blankBacks ? "1" : "0";
  if (ui.bookProgressive) ui.bookProgressive.checked = !!recipe.flags?.progressive;
  if (ui.bookGuide) ui.bookGuide.checked = !!recipe.flags?.guide;
  if (ui.bookSpreads) ui.bookSpreads.checked = !!recipe.flags?.spreads;
  if (ui.bookTurn) ui.bookTurn.checked = !!recipe.flags?.turn;
  ui.seed.value = String(recipe.baseSeed);

  applyPresetToUI(recipe.style, { force: true });
  restoreOptsToUI(recipe.opts);

  const styleIds = [
    "cellCount", "minCellSizeMm", "cellBorderWidthMm", "patternStrokeMm",
    "minGapMm", "whiteSpaceMm", "sketchy", "maxPatternPassesPerCell", "patternSkipProb",
    "rotatePatterns", "rotationSet", "innerOrganicBorderEnabled", "innerOrganicBorderInsetMm",
    "innerOrganicJitterMm", "innerOrganicRoundMm", "patternFamily", "focalStrength",
    "rotationJitterDeg"
  ];
  styleIds.forEach((id) => appState.touched.add(id));

  appState.stylePicker?.sync();
  showCurrentStyle();
  updateBookSummary();
  saveSettings();

  const plan = bookPlan();
  const g = pageGeometry();
  const baseSeed = recipe.baseSeed >>> 0;

  freeBookReview();
  const job = (appState.bookJob = { cancelled: false });
  const review = {
    key: bookKey(g, plan),
    g,
    n: recipe.designs,
    blank: recipe.blankBacks,
    flags: { ...recipe.flags },
    units: plan.units,
    turnPages: plan.turnPages,
    baseSeed,
    pages: [],
    extras: { guide: [], passport: null, turn: [], frontMatter: [] },
    extraUrls: [],
    total: 0,
    done: {},
  };

  ui.btnBook.textContent = "✖ Cancelar";
  ui.bookBar.hidden = false;
  ui.bookBar.value = 0;

  try {
    for (let i = 0; i < recipe.pages.length; i++) {
      if (job.cancelled) {
        review.pages.forEach((p) => URL.revokeObjectURL(p.url));
        ui.status.textContent = "Carga de receta cancelada";
        return;
      }
      const rp = recipe.pages[i];
      const page = await makeBookPage(g, rp.seed, i, baseSeed, review);
      page.tries = rp.tries || 0;
      keepOrDropSvg(review, page);
      review.pages.push(page);
      ui.bookBar.value = (i + 1) / recipe.pages.length;
      ui.btnBook.textContent = `✖ Cancelar (${i + 1}/${recipe.pages.length})`;
      ui.status.textContent = `Cargando receta… diseño ${i + 1} de ${recipe.pages.length}`;
      await new Promise((r) => setTimeout(r, 0));
    }
    review.extras = await buildBookExtras(review);
    review.extraUrls = extrasList(review.extras).map((x) => URL.createObjectURL(new Blob([x.svg], { type: "image/svg+xml" })));
    review.total = bookSequence(review, review.extras).length;
    appState.bookReview = review;
    showBookReview();
    const nFlag = flaggedPages(review).length;
    ui.status.textContent = `✓ Receta cargada: ${review.n} diseños (${review.total} páginas) restaurados` + (nFlag ? ` · ${nFlag} marcada${nFlag > 1 ? "s" : ""} por calidad` : "") + " · puedes descargar el PDF directamente";
  } catch (err) {
    review.pages.forEach((p) => URL.revokeObjectURL(p.url));
    ui.status.textContent = `✗ Error al restaurar la receta: ${err.message}`;
    console.error("Error al restaurar receta:", err);
  } finally {
    appState.bookJob = null;
    ui.bookBar.hidden = true;
    updateBookButton();
    updateQualitySummary();
  }
}

export function bookTile(i) {
  const bookReview = appState.bookReview;
  const page = bookReview.pages[i];
  const tile = document.createElement("figure");
  const flagged = page.quality && !page.quality.ok;
  tile.className = `gallery-item book-tile${page.kind === "spread" ? " spread" : ""}${flagged ? " flagged" : ""}${page.pinned ? " pinned" : ""}`;
  tile.dataset.index = String(i);
  const img = document.createElement("img");
  img.src = page.url;
  img.alt = `Diseño ${i + 1}`;
  img.title = "Ver a tamaño real";
  img.addEventListener("click", () => openViewer(i));
  const cap = document.createElement("figcaption");
  const label = document.createElement("span");
  label.className = "gallery-label";
  const style = isRandomKey(bookReview.g.zPresetKey) ? ` · ${styleLabel(page.presetName)}` : "";
  const lv = bookReview.flags?.progressive ? ` · nivel ${levelInfo(difficultyAt(i, bookReview.n)).level}` : "";
  label.textContent = `${i + 1}${page.kind === "spread" ? " · doble página" : ""}${page.tries ? ` · cambio ${page.tries}` : ""}${style}${lv}`;
  const btns = document.createElement("div");
  btns.className = "tile-btns";
  const redo = document.createElement("button");
  redo.type = "button";
  redo.className = "btn btn-secondary tile-redo";
  redo.textContent = "↻";
  redo.title = "Borrar este diseño y generar otro en su lugar";
  redo.addEventListener("click", () => replaceBookPage(i, tile));
  btns.append(redo);

  if (page.history && page.history.length) {
    const undo = document.createElement("button");
    undo.type = "button";
    undo.className = "btn btn-secondary tile-undo";
    undo.textContent = "←";
    undo.title = `Deshacer cambio (quedan ${page.history.length} versión${page.history.length > 1 ? "es" : ""})`;
    undo.addEventListener("click", () => undoBookPage(i, tile));
    btns.append(undo);
  }

  const pin = document.createElement("button");
  pin.type = "button";
  pin.className = `btn btn-secondary tile-pin${page.pinned ? " active" : ""}`;
  pin.textContent = "📌";
  pin.title = page.pinned ? "Desfijar (no sobrevivirá a «Preparar»)" : "Fijar (sobrevivirá a «Preparar»)";
  pin.addEventListener("click", () => togglePinPage(i));
  btns.append(pin);

  if (page.quality) {
    const badge = document.createElement("span");
    badge.className = `q-badge${flagged ? " bad" : ""}`;
    badge.textContent = flagged ? "⚠ revisar" : "✓";
    const covInfo = page.quality.coverage != null ? ` · cobertura ${Math.round(page.quality.coverage * 100)}%` : "";
    const contInfo = page.quality.contrast != null ? ` · contraste ${page.quality.contrast >= 0 ? "+" : ""}${page.quality.contrast}` : "";
    badge.title = flagged ? page.quality.reasons.join(" · ") : `Calidad correcta (${page.quality.bad} zonas diminutas${covInfo}${contInfo})`;
    cap.append(label, badge, btns);
  } else {
    cap.append(label, btns);
  }
  tile.append(img, cap);
  return tile;
}

export async function replaceBookPage(i, tile) {
  if (!appState.bookReview || appState.bookJob) return;
  const review = appState.bookReview;
  const old = review.pages[i];
  const btn = tile.querySelector(".tile-redo");
  btn.disabled = true;
  btn.textContent = "Generando…";
  tile.classList.add("busy");
  try {
    const tries = (old.tries || 0) + 1;
    const page = await makeBookPage(review.g, pageSeed(review.baseSeed, i, tries), i, review.baseSeed, review);
    if (appState.bookReview !== review) {
      URL.revokeObjectURL(page.url);
      return;
    }
    page.tries = tries;
    if (!page.history) page.history = [];
    page.history.push({ seed: old.seed, tries: old.tries || 0, presetName: old.presetName, figure: old.figure, quality: old.quality });
    if (page.history.length > 5) page.history.shift();
    keepOrDropSvg(review, page, svgSize(old));
    review.pages[i] = page;
    URL.revokeObjectURL(old.url);
    tile.replaceWith(bookTile(i));
    updateQualitySummary();
    saveCurrentBook(review);
    const q = page.quality;
    ui.status.textContent = `✓ Diseño ${i + 1} reemplazado` + (q && !q.ok ? ` · sigue marcado: ${q.reasons.join(" · ")}` : "");
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "↻ Cambiar";
    tile.classList.remove("busy");
    ui.status.textContent = `✗ No se pudo reemplazar el diseño ${i + 1}: ${err.message}`;
  }
}

export async function undoBookPage(i, tile) {
  if (!appState.bookReview || appState.bookJob) return;
  const review = appState.bookReview;
  const page = review.pages[i];
  if (!page.history || !page.history.length) {
    ui.status.textContent = `✗ No hay versión anterior para el diseño ${i + 1}`;
    return;
  }
  const btn = tile?.querySelector(".tile-redo");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Deshaciendo…";
  }
  if (tile) tile.classList.add("busy");
  try {
    const prev = page.history.pop();
    const restored = await makeBookPage(review.g, prev.seed, i, review.baseSeed, review);
    if (appState.bookReview !== review) {
      URL.revokeObjectURL(restored.url);
      return;
    }
    restored.tries = prev.tries;
    restored.history = page.history;
    restored.pinned = page.pinned;
    keepOrDropSvg(review, restored, svgSize(page));
    review.pages[i] = restored;
    URL.revokeObjectURL(page.url);
    const freshTile = bookTile(i);
    if (tile) tile.replaceWith(freshTile);
    else showBookReview();
    updateQualitySummary();
    saveCurrentBook(review);
    ui.status.textContent = `✓ Diseño ${i + 1} restaurado a la versión anterior`;
  } catch (err) {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "↻ Cambiar";
    }
    if (tile) tile.classList.remove("busy");
    ui.status.textContent = `✗ No se pudo deshacer el diseño ${i + 1}: ${err.message}`;
  }
}

export function togglePinPage(i) {
  if (!appState.bookReview) return;
  const page = appState.bookReview.pages[i];
  page.pinned = !page.pinned;
  const tile = document.querySelector(`.book-tile[data-index="${i}"]`);
  if (tile) tile.replaceWith(bookTile(i));
  saveCurrentBook(appState.bookReview);
  ui.status.textContent = page.pinned
    ? `📌 Diseño ${i + 1} fijado: sobrevivirá a «Preparar libro»`
    : `Diseño ${i + 1} desfijado`;
}

export function pageShowcaseScore(page) {
  const q = page.quality || {};
  const coverage = q.coverage ?? 0;
  const contrast = q.contrast ?? 0;
  const normalizedContrast = Math.max(0, Math.min(1, (contrast + 0.5) / 1.5));
  return coverage * 0.6 + normalizedContrast * 0.4;
}

export function applyShowcaseOrder(review) {
  if (!review?.pages?.length) return;
  const showcaseEnabled = $("showcaseMode")?.checked;
  if (!showcaseEnabled) return;

  const pinned = [];
  const unpinned = [];
  review.pages.forEach((page, idx) => {
    const entry = { page, origIdx: idx };
    if (page.pinned) pinned.push(entry);
    else unpinned.push(entry);
  });

  unpinned.sort((a, b) => pageShowcaseScore(b.page) - pageShowcaseScore(a.page));

  const showcaseCount = Math.min(4, unpinned.length);
  const showcase = unpinned.slice(0, showcaseCount);
  const rest = unpinned.slice(showcaseCount);

  const seed = review.baseSeed;
  let rng = seed;
  for (let i = rest.length - 1; i > 0; i--) {
    rng = (rng * 1103515245 + 12345) >>> 0;
    const j = rng % (i + 1);
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  const ordered = [...showcase, ...rest];
  review.pages = ordered.map((entry) => entry.page);
}

export async function prepareBook() {
  const plan = bookPlan();
  const { n, blank } = plan;
  const g = pageGeometry();
  const baseSeed = g.opts.seed >>> 0;
  const job = (appState.bookJob = { cancelled: false });
  const others = busyButtons().filter((b) => b && b !== ui.btnBook);
  others.forEach((b) => (b.disabled = true));

  const oldPinned = appState.bookReview
    ? appState.bookReview.pages.map((p, idx) => ({ ...p, _origIndex: idx })).filter((p) => p.pinned)
    : [];

  freeBookReview();
  const review = {
    key: bookKey(g, plan),
    g,
    n,
    blank,
    flags: plan.flags,
    units: plan.units,
    turnPages: plan.turnPages,
    baseSeed,
    pages: [],
    extras: { guide: [], passport: null, turn: [], frontMatter: [] },
    extraUrls: [],
    total: 0,
    done: {},
  };
  ui.btnBook.textContent = "✖ Cancelar";
  ui.bookBar.hidden = false;
  ui.bookBar.value = 0;
  try {
    for (let i = 0; i < n; i++) {
      if (job.cancelled) {
        review.pages.forEach((p) => URL.revokeObjectURL(p.url));
        ui.status.textContent = "Preparación cancelada";
        return;
      }
      const pinned = oldPinned.find((p) => p._origIndex === i);
      if (pinned) {
        const restored = await makeBookPage(g, pinned.seed, i, baseSeed, review);
        restored.tries = pinned.tries;
        restored.history = pinned.history;
        restored.pinned = true;
        keepOrDropSvg(review, restored);
        review.pages.push(restored);
      } else {
        const page = await makeBookPage(g, pageSeed(baseSeed, i, 0), i, baseSeed, review);
        page.tries = 0;
        keepOrDropSvg(review, page);
        review.pages.push(page);
      }
      ui.bookBar.value = (i + 1) / n;
      ui.btnBook.textContent = `✖ Cancelar (${i + 1}/${n})`;
      ui.status.textContent = `Preparando libro… diseño ${i + 1} de ${n}`;
      await new Promise((r) => setTimeout(r, 0));
    }

    applyShowcaseOrder(review);

    review.extras = await buildBookExtras(review);
    review.extraUrls = extrasList(review.extras).map((x) => URL.createObjectURL(new Blob([x.svg], { type: "image/svg+xml" })));
    review.total = bookSequence(review, review.extras).length;
    appState.bookReview = review;
    showBookReview();
    await clearCurrentBook();
    await saveCurrentBook(review);
    const nFlag = flaggedPages(review).length;
    const nPinned = oldPinned.length;
    const showcaseEnabled = $("showcaseMode")?.checked;
    const showcaseMsg = showcaseEnabled ? " · 🏪 modo escaparate activado (4 mejores al inicio)" : "";
    const figCheck = verifyNoExcludedFigures(review);
    const figWarn = !figCheck.ok ? ` · ⚠ ${figCheck.violations.length} figura${figCheck.violations.length > 1 ? "s" : ""} excluida${figCheck.violations.length > 1 ? "s" : ""} encontrada${figCheck.violations.length > 1 ? "s" : ""}` : "";
    ui.status.textContent = `✓ ${n} diseños listos (${review.total} páginas)` + (nPinned ? ` · ${nPinned} fijad${nPinned === 1 ? "a" : "as"}` : "") + (nFlag ? ` · ${nFlag} marcada${nFlag > 1 ? "s" : ""} por calidad: pulsa «🛠 Arreglar»` : " · todas pasan el control de calidad") + showcaseMsg + figWarn + " · luego descarga el PDF";
  } catch (err) {
    review.pages.forEach((p) => URL.revokeObjectURL(p.url));
    ui.status.textContent = `✗ No se pudo preparar el libro: ${err.message}`;
    console.error("Error al preparar libro:", err);
  } finally {
    appState.bookJob = null;
    ui.bookBar.hidden = true;
    others.forEach((b) => (b.disabled = false));
    updateBookButton();
    updateQualitySummary();
  }
}

export async function onBookButton() {
  if (appState.bookJob) {
    appState.bookJob.cancelled = true;
    ui.status.textContent = "Cancelando…";
    return;
  }
  if (reviewIsFresh()) return createBook();
  await prepareBook();
  if (ui.bookAutoFix?.checked && appState.bookReview && flaggedPages(appState.bookReview).length) {
    await fixFlaggedPages();
  }
}

export function getFilteredFigures() {
  const preset = ZENTANGLE_PRESETS[ui.zPreset.value];
  const allFigs = preset?.figures || FIGURE_IDS;
  return allFigs.filter((f) => !appState.excludedFigures.has(f));
}

export function renderFigureSelector() {
  const container = $("figureSelector");
  if (!container) return;
  const preset = ZENTANGLE_PRESETS[ui.zPreset.value];
  const allFigs = preset?.figures || FIGURE_IDS;
  if (!allFigs || allFigs.length === 0 || !preset?.figures) {
    container.hidden = true;
    return;
  }
  container.hidden = false;
  container.innerHTML = "";
  const title = document.createElement("p");
  title.className = "hint";
  title.style.margin = "0 0 8px";
  title.textContent = "Figuras del libro (desmarca las que no quieras):";
  container.append(title);
  const grid = document.createElement("div");
  grid.className = "figure-grid";
  allFigs.forEach((figId) => {
    const label = document.createElement("label");
    label.className = "figure-check";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !appState.excludedFigures.has(figId);
    cb.dataset.figure = figId;
    cb.addEventListener("change", () => {
      if (cb.checked) appState.excludedFigures.delete(figId);
      else appState.excludedFigures.add(figId);
      saveSettings();
      updateFigureSummary();
    });
    const span = document.createElement("span");
    span.textContent = figId;
    label.append(cb, span);
    grid.append(label);
  });
  container.append(grid);
  updateFigureSummary();
}

export function updateFigureSummary() {
  const el = $("figureSummary");
  if (!el) return;
  const preset = ZENTANGLE_PRESETS[ui.zPreset.value];
  const allFigs = preset?.figures || [];
  if (!allFigs.length) {
    el.textContent = "";
    return;
  }
  const included = allFigs.filter((f) => !appState.excludedFigures.has(f)).length;
  const excluded = allFigs.length - included;
  el.textContent = `${included} figura${included !== 1 ? "s" : ""} incluida${included !== 1 ? "s" : ""}${excluded ? ` · ${excluded} excluida${excluded !== 1 ? "s" : ""}` : ""}`;
  el.className = excluded ? "hint warn" : "hint ok";
}

export function verifyNoExcludedFigures(review) {
  if (!appState.excludedFigures.size) return { ok: true, violations: [] };
  const violations = [];
  review.pages.forEach((page, i) => {
    if (page.figure && appState.excludedFigures.has(page.figure)) {
      violations.push({ pageIndex: i, figure: page.figure });
    }
  });
  return { ok: violations.length === 0, violations };
}

export function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function showLibrary() {
  const panel = $("libraryPanel");
  if (!panel) return;
  panel.hidden = false;
  const list = $("libraryList");
  if (!list) return;
  list.innerHTML = "<p class=\"hint\">Cargando biblioteca…</p>";
  try {
    const books = await listLibraryBooks();
    if (!books.length) {
      list.innerHTML = "<p class=\"hint\">No hay libros guardados todavía. Termina un libro y guárdalo aquí.</p>";
      return;
    }
    list.innerHTML = "";
    const table = document.createElement("table");
    table.className = "library-table";
    table.innerHTML = "<thead><tr><th>Nombre</th><th>Tipo</th><th>Fecha</th><th>Estado</th><th>ASIN</th><th>Acciones</th></tr></thead>";
    const tbody = document.createElement("tbody");
    books.forEach((book) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(book.name)}</td>
        <td>${escapeHtml(book.type)}</td>
        <td>${new Date(book.date).toLocaleDateString("es")}</td>
        <td><select class="lib-state" data-id="${book.id}">
          <option value="draft"${book.state === "draft" ? " selected" : ""}>Borrador</option>
          <option value="reviewed"${book.state === "reviewed" ? " selected" : ""}>Revisado</option>
          <option value="published"${book.state === "published" ? " selected" : ""}>Publicado</option>
        </select></td>
        <td><input class="lib-asin" data-id="${book.id}" value="${escapeHtml(book.asin || "")}" placeholder="B0..." maxlength="10" /></td>
        <td class="lib-actions">
          <button class="btn btn-secondary lib-load" data-id="${book.id}" title="Cargar este libro">📂</button>
          <button class="btn btn-secondary lib-dup" data-id="${book.id}" title="Duplicar (volumen 2)">📋</button>
          <button class="btn btn-secondary lib-rename" data-id="${book.id}" title="Renombrar">✏️</button>
          <button class="btn btn-secondary lib-del" data-id="${book.id}" title="Eliminar">🗑</button>
        </td>`;
      tbody.append(tr);
    });
    table.append(tbody);
    list.append(table);
    list.querySelectorAll(".lib-state").forEach((sel) => sel.addEventListener("change", async (e) => {
      await updateLibraryBookState(e.target.dataset.id, { state: e.target.value });
    }));
    list.querySelectorAll(".lib-asin").forEach((inp) => inp.addEventListener("change", async (e) => {
      await updateLibraryBookState(e.target.dataset.id, { asin: e.target.value });
    }));
    list.querySelectorAll(".lib-load").forEach((btn) => btn.addEventListener("click", async (e) => {
      const book = await getLibraryBook(e.target.dataset.id);
      if (book?.recipe) await restoreBookFromRecipe(book.recipe);
    }));
    list.querySelectorAll(".lib-dup").forEach((btn) => btn.addEventListener("click", async (e) => {
      await duplicateLibraryBook(e.target.dataset.id);
      showLibrary();
      ui.status.textContent = "✓ Libro duplicado (volumen 2 con semilla nueva)";
    }));
    list.querySelectorAll(".lib-rename").forEach((btn) => btn.addEventListener("click", async (e) => {
      const book = await getLibraryBook(e.target.dataset.id);
      const newName = prompt("Nuevo nombre:", book?.name || "");
      if (newName) {
        await renameLibraryBook(e.target.dataset.id, newName);
        showLibrary();
      }
    }));
    list.querySelectorAll(".lib-del").forEach((btn) => btn.addEventListener("click", async (e) => {
      if (confirm("¿Eliminar este libro de la biblioteca?")) {
        await deleteLibraryBook(e.target.dataset.id);
        showLibrary();
      }
    }));
  } catch (err) {
    list.innerHTML = `<p class="hint warn">Error al cargar la biblioteca: ${err.message}</p>`;
  }
}

export async function saveCurrentBookToLibrary() {
  if (!appState.bookReview) {
    ui.status.textContent = "✗ No hay un libro preparado para guardar";
    return;
  }
  const name = prompt("Nombre del libro:", ui.bookTitle?.value?.trim() || `Libro ${appState.bookReview.n} diseños`);
  if (!name) return;
  const recipe = bookRecipe(appState.bookReview);
  await saveBookToLibrary({ name, state: "reviewed", recipe });
  ui.status.textContent = `✓ Libro «${name}» guardado en la biblioteca`;
}

export async function tryRestoreAutosavedBook() {
  const saved = await loadCurrentBook();
  if (!saved) return false;
  const currentKey = bookKey(pageGeometry(), bookPlan());
  if (saved.key !== currentKey) {
    const btn = $("btnContinueBook");
    if (btn) {
      btn.hidden = false;
      btn.textContent = `📖 Continuar último libro (${saved.n} diseños, ${saved.savedAt ? new Date(saved.savedAt).toLocaleString("es") : ""})`;
      btn.onclick = () => restoreAutosavedBook(saved);
    }
    return false;
  }
  await restoreAutosavedBook(saved);
  return true;
}

export async function restoreAutosavedBook(saved) {
  if (!saved || !saved.pages?.length) return;
  if (saved.g.paperKey) ui.paper.value = saved.g.paperKey;
  ui.marginMm.value = String(saved.g.marginMm);
  if (ui.zPreset.querySelector(`option[value="${saved.g.zPresetKey}"]`) || isRandomKey(saved.g.zPresetKey)) {
    ui.zPreset.value = saved.g.zPresetKey;
  }
  ui.bookPages.value = String(saved.n);
  ui.bookBlank.value = saved.blank ? "1" : "0";
  if (ui.bookProgressive) ui.bookProgressive.checked = !!saved.flags?.progressive;
  if (ui.bookGuide) ui.bookGuide.checked = !!saved.flags?.guide;
  if (ui.bookSpreads) ui.bookSpreads.checked = !!saved.flags?.spreads;
  if (ui.bookTurn) ui.bookTurn.checked = !!saved.flags?.turn;
  ui.seed.value = String(saved.baseSeed);
  applyPresetToUI(saved.g.zPresetKey, { force: true });
  restoreOptsToUI(saved.g.opts);
  appState.stylePicker?.sync();
  showCurrentStyle();
  updateBookSummary();

  const plan = bookPlan();
  const g = pageGeometry();
  freeBookReview();
  const job = (appState.bookJob = { cancelled: false });
  const review = {
    key: bookKey(g, plan),
    g,
    n: saved.n,
    blank: saved.blank,
    flags: { ...saved.flags },
    units: plan.units,
    turnPages: plan.turnPages,
    baseSeed: saved.baseSeed,
    pages: [],
    extras: { guide: [], passport: null, turn: [], frontMatter: [] },
    extraUrls: [],
    total: 0,
    done: {},
  };
  ui.btnBook.textContent = "✖ Cancelar";
  ui.bookBar.hidden = false;
  ui.bookBar.value = 0;
  try {
    for (let i = 0; i < saved.pages.length; i++) {
      if (job.cancelled) {
        review.pages.forEach((p) => URL.revokeObjectURL(p.url));
        return;
      }
      const sp = saved.pages[i];
      const page = await makeBookPage(g, sp.seed, i, saved.baseSeed, review);
      page.tries = sp.tries || 0;
      page.history = sp.history || [];
      page.pinned = !!sp.pinned;
      keepOrDropSvg(review, page);
      review.pages.push(page);
      ui.bookBar.value = (i + 1) / saved.pages.length;
      ui.btnBook.textContent = `✖ Cancelar (${i + 1}/${saved.pages.length})`;
      ui.status.textContent = `Restaurando libro… página ${i + 1} de ${saved.pages.length}`;
      await new Promise((r) => setTimeout(r, 0));
    }
    review.extras = await buildBookExtras(review);
    review.extraUrls = extrasList(review.extras).map((x) => URL.createObjectURL(new Blob([x.svg], { type: "image/svg+xml" })));
    review.total = bookSequence(review, review.extras).length;
    appState.bookReview = review;
    showBookReview();
    const nFlag = flaggedPages(review).length;
    const nPinned = review.pages.filter((p) => p.pinned).length;
    ui.status.textContent = `✓ Libro restaurado: ${review.n} diseños (${review.total} páginas)` + (nPinned ? ` · ${nPinned} fijad${nPinned === 1 ? "a" : "s"}` : "") + (nFlag ? ` · ${nFlag} marcada${nFlag > 1 ? "s" : ""} por calidad` : "");
    const btn = $("btnContinueBook");
    if (btn) btn.hidden = true;
  } catch (err) {
    review.pages.forEach((p) => URL.revokeObjectURL(p.url));
    ui.status.textContent = `✗ Error al restaurar: ${err.message}`;
    console.error("Error al restaurar autosave:", err);
  } finally {
    appState.bookJob = null;
    ui.bookBar.hidden = true;
    updateBookButton();
    updateQualitySummary();
  }
}

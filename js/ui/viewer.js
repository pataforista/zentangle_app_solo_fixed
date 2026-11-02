// js/ui/viewer.js
// Visor a tamaño real y pantalla completa para inspeccionar páginas del libro y zonas difíciles.
// Módulo extraído de app.js (Fase 0.3).

import { appState, rasterizeSvg, QPX, styleLabel, isRandomKey } from "./state.js";
import { analyzeColorability } from "../core/pageQuality.js";
import { stripFooter, replaceBookPage, makeBookPage } from "./review.js";

let viewer = null;

export function isViewerOpen() {
  return viewer !== null;
}

export function closeViewer() {
  if (!viewer) return;
  document.removeEventListener("keydown", viewer.onKey);
  if (viewer.url) URL.revokeObjectURL(viewer.url);
  viewer.el.remove();
  viewer = null;
}

function viewerButton(text, title, onClick) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn btn-secondary";
  b.textContent = text;
  if (title) b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

export function openViewer(i) {
  const bookReview = appState.bookReview;
  if (!bookReview) return;
  if (!viewer) {
    const el = document.createElement("div");
    el.className = "viewer";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-modal", "true");
    const bar = document.createElement("div");
    bar.className = "viewer-bar";
    const label = document.createElement("span");
    label.className = "grow";
    const zooms = [["fit", "Ajustar"], ["real", "Tamaño real"], ["double", "200 %"]].map(([z, t]) => {
      const b = viewerButton(t, z === "real" ? "Como se imprime (en pantalla de ~96 ppp)" : "", () => { viewer.zoom = z; layoutViewer(); });
      b.dataset.zoom = z;
      return b;
    });
    const marks = document.createElement("label");
    marks.className = "check";
    const marksBox = document.createElement("input");
    marksBox.type = "checkbox";
    marksBox.checked = true;
    marksBox.addEventListener("change", () => { viewer.marks = marksBox.checked; showViewerMarks(); });
    marks.append(marksBox, " Zonas difíciles en rojo");
    const prev = viewerButton("‹", "Página anterior (←)", () => moveViewer(-1));
    const next = viewerButton("›", "Página siguiente (→)", () => moveViewer(1));
    const redo = viewerButton("↻ Cambiar", "Cambiar este diseño por otro", async () => {
      const tile = document.querySelector(`.book-tile[data-index="${viewer.i}"]`);
      if (!tile || appState.bookJob) return;
      redo.disabled = true;
      await replaceBookPage(viewer.i, tile);
      redo.disabled = false;
      if (viewer) showViewerPage();
    });
    const close = viewerButton("✕ Cerrar", "Cerrar (Esc)", closeViewer);
    bar.append(prev, next, label, ...zooms, marks, redo, close);
    const scroll = document.createElement("div");
    scroll.className = "viewer-scroll";
    const pageEl = document.createElement("div");
    pageEl.className = "viewer-page";
    const img = document.createElement("img");
    img.alt = "";
    const canvas = document.createElement("canvas");
    pageEl.append(img, canvas);
    const note = document.createElement("p");
    note.className = "viewer-note";
    scroll.append(pageEl, note);
    el.append(bar, scroll);
    document.body.append(el);
    const onKey = (e) => {
      if (e.key === "Escape") closeViewer();
      else if (e.key === "ArrowLeft") moveViewer(-1);
      else if (e.key === "ArrowRight") moveViewer(1);
    };
    document.addEventListener("keydown", onKey);
    viewer = { el, label, zooms, scroll, pageEl, img, canvas, note, onKey, zoom: "fit", marks: true, i, url: null, svg: null, token: 0 };
  }
  viewer.i = i;
  showViewerPage();
}

export function moveViewer(d) {
  const bookReview = appState.bookReview;
  if (!viewer || !bookReview) return;
  const n = bookReview.pages.length;
  viewer.i = (viewer.i + d + n) % n;
  showViewerPage();
}

export function viewerSize() {
  const bookReview = appState.bookReview;
  const page = bookReview.pages[viewer.i];
  return { wMm: bookReview.g.paper.w * (page.kind === "spread" ? 2 : 1), hMm: bookReview.g.paper.h };
}

export function layoutViewer() {
  const bookReview = appState.bookReview;
  if (!viewer || !bookReview) return;
  const { wMm, hMm } = viewerSize();
  const p = viewer.pageEl;
  p.style.aspectRatio = `${wMm} / ${hMm}`;
  if (viewer.zoom === "fit") {
    const sw = viewer.scroll.clientWidth - 32, sh = viewer.scroll.clientHeight - 56;
    p.style.width = `${Math.max(120, Math.min(sw, (sh * wMm) / hMm))}px`;
  } else p.style.width = `${viewer.zoom === "double" ? 2 * wMm : wMm}mm`;
  viewer.zooms.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.zoom === viewer.zoom)));
}

export async function showViewerPage() {
  const bookReview = appState.bookReview;
  if (!viewer || !bookReview) return;
  const review = bookReview, i = viewer.i, page = review.pages[i];
  const token = ++viewer.token;
  const q = page.quality;
  const style = isRandomKey(review.g.zPresetKey) ? ` · ${styleLabel(page.presetName)}` : "";
  viewer.label.textContent = `Diseño ${i + 1} de ${review.pages.length}${page.kind === "spread" ? " · doble página" : ""}${style}` +
    (q ? (q.ok ? ` · ✓ calidad (${q.bad} zonas${q.coverage != null ? ` · cobertura ${Math.round(q.coverage * 100)}%` : ""}${q.contrast != null ? ` · contraste ${q.contrast >= 0 ? "+" : ""}${q.contrast}` : ""})` : ` · ⚠ ${q.reasons.join(" · ")}`) : "");
  layoutViewer();
  viewer.canvas.width = viewer.canvas.height = 0;
  viewer.note.textContent = "Cargando…";
  const svg = page.svg || (await makeBookPage(review.g, page.seed, i, review.baseSeed, review, { thumb: false, quality: false })).svg;
  if (!viewer || viewer.token !== token) return;
  if (viewer.url) URL.revokeObjectURL(viewer.url);
  viewer.url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  viewer.svg = svg;
  viewer.img.src = viewer.url;
  showViewerMarks();
}

export async function showViewerMarks() {
  if (!viewer) return;
  const token = viewer.token, c = viewer.canvas;
  if (!viewer.marks || !viewer.svg) { c.width = c.height = 0; viewer.note.textContent = ""; return; }
  const { wMm, hMm } = viewerSize();
  const r = await rasterizeSvg(stripFooter(viewer.svg), Math.round(wMm * QPX), Math.round(hMm * QPX));
  if (!viewer || viewer.token !== token || !viewer.marks) return;
  const q = analyzeColorability(r, QPX, { mark: true });
  c.width = r.width; c.height = r.height;
  const ctx = c.getContext("2d");
  const out = ctx.createImageData(r.width, r.height);
  for (let k = 0; k < q.mask.length; k++) if (q.mask[k]) { out.data[k * 4] = 230; out.data[k * 4 + 3] = 220; }
  ctx.putImageData(out, 0, 0);
  viewer.note.textContent = q.bad
    ? `En rojo: ${q.bad} zonas donde no cabe la punta de un rotulador. Unas pocas esquinas pequeñas son normales; muchas juntas, mejor ↻ Cambiar.`
    : "Sin zonas difíciles.";
}

if (typeof window !== "undefined") {
  window.addEventListener("resize", () => {
    if (viewer) layoutViewer();
  });
}

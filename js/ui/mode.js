// Modo de la barra lateral: «Rápido» muestra solo lo necesario para sacar un
// libro (tipo, título, nº de diseños); «Personalizar» muestra todas las
// opciones. Los elementos con .adv-only se ocultan en modo rápido (CSS).
const KEY = "zt_ui_mode";
const HINTS = {
  quick: "Elige un tipo de libro, ponle título y pulsa <strong>Preparar libro</strong>.",
  custom: "Todas las opciones a la vista. Cada cambio se ve al instante en la vista previa.",
};

export function getMode() {
  return document.body.dataset.mode === "custom" ? "custom" : "quick";
}

export function setMode(mode, { save = true } = {}) {
  const m = mode === "custom" ? "custom" : "quick";
  document.body.dataset.mode = m;
  for (const b of document.querySelectorAll(".mode-switch [data-mode]")) {
    b.setAttribute("aria-pressed", String(b.dataset.mode === m));
  }
  const hint = document.getElementById("modeHint");
  if (hint) hint.innerHTML = HINTS[m];
  if (save) {
    try { localStorage.setItem(KEY, m); } catch { /* almacenamiento bloqueado */ }
  }
  document.dispatchEvent(new CustomEvent("zt:mode", { detail: m }));
}

export function initMode() {
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch { /* sin almacenamiento */ }
  setMode(saved || document.body.dataset.mode || "quick", { save: false });
  for (const b of document.querySelectorAll(".mode-switch [data-mode]")) {
    b.addEventListener("click", () => setMode(b.dataset.mode));
  }
  for (const b of document.querySelectorAll("[data-set-mode]")) {
    b.addEventListener("click", () => setMode(b.dataset.setMode));
  }
}

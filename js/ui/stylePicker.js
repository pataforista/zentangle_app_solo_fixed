// stylePicker.js
// Selector visual de estilos: pestañas por categoría y tarjetas con miniatura
// real de cada estilo. Reemplaza al <select> de ~45 opciones (que sigue en el
// DOM, oculto, como fuente de verdad: el resto de la app lee su valor).
//
// Las categorías salen de los <optgroup> del select, más una pestaña curada
// "Para colorear" al principio. Las miniaturas se generan bajo demanda (solo
// las de la pestaña visible, una por vez) y se guardan como <img> para no
// meter cientos de miles de nodos SVG en el DOM.

// Estilos con regiones amplias y sin masas negras: lo que más se pide en un
// libro para colorear. El orden es el de las tarjetas.
const COLORING = [
  "best_sellers", "zen_figure", "zen_figure_light", "zen_figure_facet", "zen_figure_glass", "zen_figure_dino", "zen_figure_bio", "zen_figure_kids", "sampler_icons", "sampler_hex", "random_color", "sampler_coloring", "sampler_octagons",
  "sampler_dodecagons", "sampler_cairo", "sampler_icon_patterns", "sampler_icon_fractal",
  "icon_mandala", "zen_star", "classic_z_string", "eye_focus", "bold_easy", "kdp_relaxed",
];

// Etiqueta corta + subtítulo a partir del texto de la opción:
// "⭐ Iconos para colorear (luna, mariposa...)" → { title, sub }; también
// "🎲 Aleatorio — solo para colorear". El emoji inicial se descarta.
function splitLabel(text) {
  const clean = String(text).replace(/^\s*[^\p{L}\p{N}]+\s*/u, "").trim();
  const m = clean.match(/^(.*?)\s*\((.*)\)\s*$/) || clean.match(/^(.*?)\s+—\s+(.*)$/);
  return m ? { title: m[1], sub: m[2] } : { title: clean, sub: "" };
}

export function createStylePicker({ select, root, renderThumb, onPick }) {
  const groups = [];
  const optByKey = new Map();
  for (const og of select.querySelectorAll("optgroup")) {
    const keys = [...og.querySelectorAll("option")].map((o) => { optByKey.set(o.value, o); return o.value; });
    groups.push({ id: `g${groups.length}`, label: og.label, keys });
  }
  const coloring = COLORING.filter((k) => optByKey.has(k));
  if (coloring.length) groups.unshift({ id: "color", label: "⭐ Para colorear", keys: coloring });

  root.innerHTML = "";
  const tabs = document.createElement("div");
  tabs.className = "sp-tabs";
  tabs.setAttribute("role", "tablist");
  tabs.setAttribute("aria-label", "Categorías de estilo");
  const grid = document.createElement("div");
  grid.className = "sp-grid";
  grid.setAttribute("role", "listbox");
  grid.setAttribute("aria-label", "Estilos");
  root.append(tabs, grid);

  const thumbs = new Map(); // key -> object URL
  const queue = [];
  let working = false;
  let activeGroup = null;

  const pump = async () => {
    if (working) return;
    working = true;
    while (queue.length) {
      const { key, img } = queue.shift();
      if (thumbs.has(key)) { img.src = thumbs.get(key); continue; }
      if (!img.isConnected) continue; // la pestaña cambió: se regenera al volver
      try {
        const svg = await renderThumb(key);
        const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
        thumbs.set(key, url);
        img.src = url;
        img.closest(".sp-card")?.classList.remove("loading");
      } catch (e) {
        img.closest(".sp-card")?.classList.add("failed");
      }
      // Cede el hilo entre miniaturas: la vista previa principal tiene prioridad.
      await new Promise((r) => setTimeout(r, 30));
    }
    working = false;
  };

  const markSelected = () => {
    for (const card of grid.querySelectorAll(".sp-card")) {
      const on = card.dataset.key === select.value;
      card.classList.toggle("selected", on);
      card.setAttribute("aria-selected", on ? "true" : "false");
    }
  };

  const showGroup = (g) => {
    activeGroup = g;
    for (const t of tabs.children) {
      const on = t.dataset.id === g.id;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    }
    grid.innerHTML = "";
    queue.length = 0;
    for (const key of g.keys) {
      const opt = optByKey.get(key);
      const { title, sub } = splitLabel(opt.textContent);
      const card = document.createElement("button");
      card.type = "button";
      card.className = "sp-card" + (thumbs.has(key) ? "" : " loading");
      card.dataset.key = key;
      card.setAttribute("role", "option");
      card.title = opt.textContent.trim();
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      const name = document.createElement("span");
      name.className = "sp-name";
      name.textContent = title;
      card.append(img, name);
      if (sub) {
        const s = document.createElement("span");
        s.className = "sp-sub";
        s.textContent = sub;
        card.append(s);
      }
      if (/tinta/i.test(opt.textContent)) card.classList.add("ink");
      card.addEventListener("click", () => {
        if (select.value === key) return;
        select.value = key;
        markSelected();
        onPick?.(key);
      });
      grid.append(card);
      if (thumbs.has(key)) img.src = thumbs.get(key);
      else queue.push({ key, img });
    }
    markSelected();
    pump();
  };

  for (const g of groups) {
    const t = document.createElement("button");
    t.type = "button";
    t.className = "sp-tab";
    t.dataset.id = g.id;
    t.setAttribute("role", "tab");
    t.textContent = g.label.replace(/\s*\(.*\)\s*$/, "");
    t.addEventListener("click", () => showGroup(g));
    tabs.append(t);
  }

  // Abre la pestaña que contiene el estilo actual (prefiere la curada).
  const sync = () => {
    if (activeGroup && activeGroup.keys.includes(select.value)) { markSelected(); return; }
    showGroup(groups.find((g) => g.keys.includes(select.value)) || groups[0]);
  };
  sync();
  return { sync };
}

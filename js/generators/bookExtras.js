// bookExtras.js
// Páginas y adornos de libro que no son diseños:
//   - guía de tangles paso a paso (cómo se dibuja cada tangle del libro),
//   - pasaporte de tangles (lista para marcar los que ya coloreaste/dibujaste),
//   - pie de página con nivel de dificultad y tiempo estimado.
// Todo devuelve SVG en texto (página completa o fragmento), en mm.
import { createRNG, hash } from "../core/prng.js";
import { FIGURE_TANGLES } from "./figure.js";

const fmt = (n) => (Math.round(Number(n) * 100) / 100).toString();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = `font-family="Helvetica, Arial, sans-serif"`;

// Nombre y cómo se dibuja, en una o dos frases (lo que leerá quien colorea).
export const TANGLE_INFO = {
  hollibaugh: { name: "Hollibaugh", how: "Dibuja cintas de dos líneas paralelas. Cada cinta nueva pasa por detrás: se interrumpe al llegar a las anteriores." },
  printemps: { name: "Printemps", how: "Traza una espiral pequeña y ciérrala con un círculo. Llena el espacio con rollos de distintos tamaños." },
  tipple: { name: "Tipple", how: "Burbujas de muchos tamaños, apretadas sin tocarse. Empieza por las grandes y rellena con las pequeñas." },
  purk: { name: "Purk", how: "Círculos con uno o dos anillos dentro (auras). Agrúpalos como piedras de río." },
  nzeppel: { name: "'Nzeppel", how: "Imagina una cuadrícula en diagonal y dibuja en cada casilla una almohadilla de esquinas redondeadas." },
  bales: { name: "Bales", how: "Sobre una cuadrícula, une cada par de puntos vecinos con una hoja (dos arcos). Alterna cuál pasa por encima." },
  cubine: { name: "Cubine", how: "Dibuja hexágonos en panal y une el centro de cada uno con tres vértices alternos: aparecen cubos." },
  paradox: { name: "Paradox", how: "En un cuadrado, traza una recta de un lado al siguiente, siempre en el mismo sentido y un poco más adentro. La espiral aparece sola." },
  beadlines: { name: "Beadlines", how: "Líneas onduladas paralelas; entre cada par, ensarta perlas alternando grandes y pequeñas." },
  keeko: { name: "Keeko", how: "Grupos de 3 o 4 líneas cortas. Alterna horizontal y vertical, como un tejido de cesta." },
  static: { name: "Static", how: "Líneas en zigzag paralelas, todas con el mismo ritmo." },
  cadent: { name: "Cadent", how: "Una retícula de perlas. Une cada perla con su vecina mediante una curva en S." },
  florz: { name: "Florz", how: "Una cuadrícula de líneas con un pequeño rombo en cada cruce." },
  crescent: { name: "Crescent Moon", how: "Semicírculos en fila sobre una línea. Repite las filas para formar escamas." },
  scallops: { name: "Scallops", how: "Arcos en fila; cada fila se desplaza media escama, como tejas o escamas de pez." },
};

const byId = new Map(FIGURE_TANGLES.map((t) => [t.id, t]));

// Tangles mencionados en una lista de SVG (atributo data-tangle), en orden de
// aparición y solo los que tienen ficha.
export function tanglesInSvgs(svgs) {
  const seen = new Set();
  for (const s of svgs) for (const m of String(s).matchAll(/data-tangle="([^"]+)"/g)) if (TANGLE_INFO[m[1]]) seen.add(m[1]);
  return [...seen];
}

// Capas del tangle en un cuadrado (semilla fija: la guía es estable).
function layersIn(id, box, gap) {
  const t = byId.get(id);
  if (!t) return [];
  try { return (t.fn(createRNG(hash(0x9a1de, id.length * 31 + id.charCodeAt(0))), box, { gap, stroke: 0.3, sketchy: 0 }) || []).filter((l) => l && l.d); } catch (e) { return []; }
}

// Paso `frac` (0..1) de la construcción: el tangle "crece" desde la esquina
// superior izquierda. En los de cintas (capas por pares) se revelan cintas.
function reveal(layers, box, frac) {
  if (frac >= 1) return layers;
  if (layers.length > 3) return layers.slice(0, Math.max(2, Math.round((layers.length / 2) * frac) * 2));
  const S = (box.x1 - box.x0) + (box.y1 - box.y0);
  return layers.map((l) => {
    // Orden por el centro de cada trazo (no por su punto inicial: el círculo
    // de Printemps empieza en su borde y salía antes que su espiral).
    const parts = l.d.split(/(?=M )/).filter((p) => {
      const nums = (p.match(/-?[\d.]+/g) || []).map(Number);
      if (nums.length < 2) return false;
      let sx = 0, sy = 0, k = 0;
      for (let i = 0; i + 1 < nums.length; i += 2) { sx += nums[i]; sy += nums[i + 1]; k++; }
      return ((sx / k - box.x0) + (sy / k - box.y0)) / S <= frac;
    });
    return { ...l, d: parts.join(" ") };
  }).filter((l) => l.d);
}

const layerEls = (layers, sw) => layers.map((l) => (l.stroke === false
  ? `<path d="${l.d}" fill="${l.fill}" stroke="none"/>`
  : `<path d="${l.d}" fill="${l.fill || "none"}" stroke="#000" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`)).join("");

// Texto en varias líneas (corte por palabras a ~maxChars).
function wrap(text, maxChars) {
  const out = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if ((line + " " + w).trim().length > maxChars && line) { out.push(line); line = w; } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

const pageOpen = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>`;

// Páginas de la guía: 3 tangles por página; cada uno con su explicación,
// tres pasos, el tangle terminado y un recuadro vacío para practicar.
export function tangleGuidePages(ids, { w, h, m }) {
  const list = ids.filter((id) => TANGLE_INFO[id] && byId.has(id));
  const per = 3, pages = [];
  for (let p = 0; p * per < list.length; p++) {
    const chunk = list.slice(p * per, p * per + per);
    const out = [pageOpen(w, h)];
    const head = 24;
    out.push(`<text x="${fmt(m)}" y="${fmt(m + 8)}" ${FONT} font-size="8" font-weight="bold">Guía de tangles${list.length > per ? ` (${p + 1}/${Math.ceil(list.length / per)})` : ""}</text>`);
    out.push(`<text x="${fmt(m)}" y="${fmt(m + 15)}" ${FONT} font-size="3.6">Así se dibujan los tangles de este libro. Sigue los pasos y practica en el recuadro punteado.</text>`);
    const rowH = (h - 2 * m - head) / per;
    const gapX = 3.5;
    const sq = Math.min(rowH - 22, (w - 2 * m - 4 * gapX) / 5);
    chunk.forEach((id, k) => {
      const info = TANGLE_INFO[id];
      const y0 = m + head + k * rowH;
      out.push(`<text x="${fmt(m)}" y="${fmt(y0 + 5)}" ${FONT} font-size="5.2" font-weight="bold">${esc(info.name)}</text>`);
      wrap(info.how, Math.floor((w - 2 * m) / 1.75)).slice(0, 2).forEach((ln, i) => {
        out.push(`<text x="${fmt(m)}" y="${fmt(y0 + 10.5 + i * 4.6)}" ${FONT} font-size="3.5">${esc(ln)}</text>`);
      });
      const top = y0 + 18;
      const gap = Math.max(1.5, sq / 22);
      const box = { x0: 0, y0: 0, x1: sq, y1: sq };
      const full = layersIn(id, box, gap);
      ["1", "2", "3", "✓", ""].forEach((label, i) => {
        const x = m + i * (sq + gapX);
        const cid = `g_${p}_${k}_${i}`;
        const layers = i < 3 ? reveal(full, box, [0.3, 0.55, 0.8][i]) : i === 3 ? full : [];
        out.push(`<clipPath id="${cid}"><rect x="0" y="0" width="${fmt(sq)}" height="${fmt(sq)}"/></clipPath>`);
        out.push(`<g transform="translate(${fmt(x)} ${fmt(top)})"><g clip-path="url(#${cid})">${layerEls(layers, 0.3)}</g>`
          + `<rect x="0" y="0" width="${fmt(sq)}" height="${fmt(sq)}" fill="none" stroke="#000" stroke-width="${i === 4 ? 0.4 : 0.5}"${i === 4 ? ' stroke-dasharray="1.6 1.2"' : ""}/></g>`);
        const cap = i < 3 ? `Paso ${label}` : i === 3 ? "Terminado" : "Tu práctica";
        out.push(`<text x="${fmt(x + sq / 2)}" y="${fmt(top + sq + 4.2)}" ${FONT} font-size="3.2" text-anchor="middle">${cap}</text>`);
      });
    });
    out.push("</svg>");
    pages.push(out.join(""));
  }
  return pages;
}

// Pasaporte: cada tangle con una muestra redonda y dos casillas para marcar.
export function tanglePassportPage(ids, { w, h, m }) {
  const list = ids.filter((id) => TANGLE_INFO[id] && byId.has(id));
  if (!list.length) return null;
  const out = [pageOpen(w, h)];
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(m + 9)}" ${FONT} font-size="8" font-weight="bold" text-anchor="middle">Mi pasaporte de tangles</text>`);
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(m + 16)}" ${FONT} font-size="3.6" text-anchor="middle">Marca cada tangle cuando lo colorees y cuando lo dibujes por tu cuenta.</text>`);
  const cols = list.length > 8 ? 2 : 1;
  const rows = Math.ceil(list.length / cols);
  const top = m + 24, rowH = Math.min(30, (h - top - m) / rows), colW = (w - 2 * m) / cols;
  const r = Math.min(11, rowH * 0.4);
  list.forEach((id, i) => {
    const cx = m + Math.floor(i / rows) * colW, cy = top + (i % rows) * rowH + rowH / 2;
    const box = { x0: -r, y0: -r, x1: r, y1: r };
    const cid = `pp_${i}`;
    out.push(`<clipPath id="${cid}"><circle cx="0" cy="0" r="${fmt(r)}"/></clipPath>`);
    out.push(`<g transform="translate(${fmt(cx + r + 1)} ${fmt(cy)})"><g clip-path="url(#${cid})">${layerEls(layersIn(id, box, Math.max(1.2, r / 9)), 0.25)}</g><circle r="${fmt(r)}" fill="none" stroke="#000" stroke-width="0.5"/></g>`);
    const tx = cx + 2 * r + 6;
    out.push(`<text x="${fmt(tx)}" y="${fmt(cy - 1.5)}" ${FONT} font-size="4.6" font-weight="bold">${esc(TANGLE_INFO[id].name)}</text>`);
    [["Lo coloreé", 0], ["Lo dibujé", 1]].forEach(([lab, j]) => {
      const bx = tx + j * 30;
      out.push(`<rect x="${fmt(bx)}" y="${fmt(cy + 2)}" width="4" height="4" fill="none" stroke="#000" stroke-width="0.4"/>`);
      out.push(`<text x="${fmt(bx + 5.5)}" y="${fmt(cy + 5.3)}" ${FONT} font-size="3.3">${lab}</text>`);
    });
  });
  out.push("</svg>");
  return out.join("");
}

// Nivel 1-5 y minutos aproximados para una dificultad 0..1.
export function levelInfo(difficulty) {
  const d = Math.min(1, Math.max(0, Number(difficulty) || 0));
  const level = 1 + Math.min(4, Math.floor(d * 5));
  return { level, minutes: [25, 40, 55, 75, 95][level - 1] };
}

// Pie de página (dentro del margen inferior, a ≥ 6.35 mm del corte como pide
// KDP). Devuelve "" si el margen no deja sitio.
export function footerSvg({ w, h, m }, { text = "", level = 0 } = {}) {
  if (m < 10 || (!text && !level)) return "";
  const y = h - m + 5;
  const parts = [];
  let x = w / 2;
  if (level) {
    // Cinco puntos de nivel (contorno; el nivel alcanzado lleva un punto dentro).
    const dots = [];
    for (let i = 0; i < 5; i++) {
      const cx = w / 2 - 34 + i * 4;
      dots.push(`<circle cx="${fmt(cx)}" cy="${fmt(y - 1.1)}" r="1.3" fill="none" stroke="#000" stroke-width="0.3"/>`);
      if (i < level) dots.push(`<circle cx="${fmt(cx)}" cy="${fmt(y - 1.1)}" r="0.6" fill="#000"/>`);
    }
    parts.push(...dots);
    x = w / 2 - 14;
  }
  parts.push(`<text x="${fmt(x)}" y="${fmt(y)}" ${FONT} font-size="3.2" text-anchor="${level ? "start" : "middle"}" fill="#000">${esc(text)}</text>`);
  return `<g data-footer="1">${parts.join("")}</g>`;
}

// Inserta un fragmento al final de un SVG de página.
export const appendToSvg = (svg, frag) => (frag ? svg.replace(/<\/svg>\s*$/, `${frag}</svg>`) : svg);


// spread.js
// Doble página: una figura que atraviesa el lomo. Se dibuja UNA figura sobre
// el ancho de dos páginas y se reparte en página izquierda (verso) y derecha
// (recto). Junto al lomo queda una franja en blanco del ancho de los dos
// márgenes interiores (KDP no imprime contenido ahí), así que la figura
// "pasa por debajo" de la encuadernación y sus strings empalman exactos.
import { generateZentangle } from "./zentangle.generator.js";
import { ZENTANGLE_PRESETS } from "./zentangle.presets.js";
import { createRNG, hash } from "../core/prng.js";

// Figuras que se leen bien partidas por el lomo (anchas, sin cara en el centro).
export const SPREAD_FIGURES = ["fish", "butterfly", "leaf", "heart"];

const fmt = (n) => (Math.round(Number(n) * 1000) / 1000).toString();

// Solape en el lomo (mm): la encuadernación esconde unos milímetros a cada
// lado del lomo; en modo continuo esa franja se repite al final de la página
// izquierda y al principio de la derecha, así las líneas empalman a la vista.
export const CROSSOVER_MM = 3;

// continuous = true: el dibujo llega hasta el lomo (una sola figura y un solo
// marco que abarca las dos páginas). false: franja blanca segura en el lomo
// (ancho de los dos márgenes interiores) y un marco por página.
export async function generateSpread({ paper, marginMm, seed, difficulty = null, figureName = null, rasterize = null, continuous = true }) {
  const W = paper.w, H = paper.h, m = marginMm;
  const c = continuous ? CROSSOVER_MM : 0;
  const rng = createRNG(hash(seed >>> 0, 0x5b4d));
  const fig = figureName || SPREAD_FIGURES[Math.floor(rng() * SPREAD_FIGURES.length)];
  const overrides = { ...ZENTANGLE_PRESETS.zen_figure, seed, figureName: fig };
  // La hoja se acuesta para cruzar el lomo con su nervio central.
  if (fig === "leaf") overrides.figureRot = (rng() < 0.5 ? 1 : -1) * (Math.PI / 2 - 0.12);
  if (Number.isFinite(difficulty)) overrides.difficulty = difficulty;
  // Lienzo de 2W - c: la página derecha empieza c mm antes del final de la izquierda.
  const SW = 2 * W - c;
  const doc = { wMm: SW, hMm: H, defs: [], body: [], meta: { seed } };
  await generateZentangle(doc, { seed, presetName: "zen_figure", overrides, areaMm: { x: m, y: m, w: SW - 2 * m, h: H - 2 * m }, rasterize });
  const defs = doc.defs.length ? `<defs>${doc.defs.join("")}</defs>` : "";
  const content = doc.body.join("");
  const border = Number(overrides.cellBorderWidthMm || 1.2) * 1.1;
  const rx = W - c; // origen de la página derecha en el lienzo
  const gutter = continuous ? "" : `<rect x="${fmt(W - m)}" y="0" width="${fmt(2 * m)}" height="${fmt(H)}" fill="#fff"/>`;
  const frame = (x) => (continuous ? "" : `<rect x="${fmt(x + m)}" y="${fmt(m)}" width="${fmt(W - 2 * m)}" height="${fmt(H - 2 * m)}" fill="none" stroke="#000" stroke-width="${fmt(border)}" stroke-linejoin="round"/>`);
  const svg = (vx, vw, frames) => `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(vw)}mm" height="${fmt(H)}mm" viewBox="${fmt(vx)} 0 ${fmt(vw)} ${fmt(H)}">`
    + `<metadata>generator=patrones-doble; seed=${seed}</metadata>${defs}<rect x="${fmt(vx)}" y="0" width="${fmt(vw)}" height="${fmt(H)}" fill="#fff"/>${content}${gutter}${frames}</svg>`;
  return {
    figure: fig,
    continuous,
    left: svg(0, W, frame(0)),
    right: svg(rx, W, frame(rx)),
    // Vista previa: el lienzo completo tal como se lee con el libro abierto.
    wide: svg(0, SW, frame(0) + frame(rx)),
  };
}

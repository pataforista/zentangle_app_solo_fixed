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

export async function generateSpread({ paper, marginMm, seed, difficulty = null, figureName = null, rasterize = null }) {
  const W = paper.w, H = paper.h, m = marginMm;
  const rng = createRNG(hash(seed >>> 0, 0x5b4d));
  const fig = figureName || SPREAD_FIGURES[Math.floor(rng() * SPREAD_FIGURES.length)];
  const overrides = { ...ZENTANGLE_PRESETS.zen_figure, seed, figureName: fig };
  // La hoja se acuesta para cruzar el lomo con su nervio central.
  if (fig === "leaf") overrides.figureRot = (rng() < 0.5 ? 1 : -1) * (Math.PI / 2 - 0.12);
  if (Number.isFinite(difficulty)) overrides.difficulty = difficulty;
  const doc = { wMm: 2 * W, hMm: H, defs: [], body: [], meta: { seed } };
  await generateZentangle(doc, { seed, presetName: "zen_figure", overrides, areaMm: { x: m, y: m, w: 2 * W - 2 * m, h: H - 2 * m }, rasterize });
  const defs = doc.defs.length ? `<defs>${doc.defs.join("")}</defs>` : "";
  const content = doc.body.join("");
  const border = Number(overrides.cellBorderWidthMm || 1.2) * 1.1;
  const gutter = `<rect x="${fmt(W - m)}" y="0" width="${fmt(2 * m)}" height="${fmt(H)}" fill="#fff"/>`;
  const frame = (x) => `<rect x="${fmt(x + m)}" y="${fmt(m)}" width="${fmt(W - 2 * m)}" height="${fmt(H - 2 * m)}" fill="none" stroke="#000" stroke-width="${fmt(border)}" stroke-linejoin="round"/>`;
  const svg = (vx, vw, frames) => `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(vw)}mm" height="${fmt(H)}mm" viewBox="${fmt(vx)} 0 ${fmt(vw)} ${fmt(H)}">`
    + `<metadata>generator=zentangle-spread; seed=${seed}</metadata>${defs}<rect x="${fmt(vx)}" y="0" width="${fmt(vw)}" height="${fmt(H)}" fill="#fff"/>${content}${gutter}${frames}</svg>`;
  return {
    figure: fig,
    left: svg(0, W, frame(0)),
    right: svg(W, W, frame(W)),
    wide: svg(0, 2 * W, frame(0) + frame(W)),
  };
}

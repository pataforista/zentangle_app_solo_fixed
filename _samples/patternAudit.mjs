// Colorabilidad de cada relleno de celda por separado, en las formas de celda que
// el motor usa de verdad (cuadrada, banda ancha, tira alta, triángulo).
// Cada relleno se dibuja como lo hace zentangleCells: dentro de su celda, con el
// borde grueso encima y recortado por la celda; se cuentan las regiones blancas
// que no se pueden colorear (ver regions.mjs).
//
// Uso: npm run audit:patterns [-- nombre1,nombre2]   (SEEDS=8 más semillas; ROT=0,45 para fijar los giros)
import { createRequire } from "node:module";
import { createRNG } from "../js/core/prng.js";
import { whiteRegions } from "./regions.mjs";

const { Resvg } = createRequire(import.meta.url)("@resvg/resvg-js");
const PX = 8;

import { CELL_PATTERN_FAMILIES, AXIS_ALIGNED, RECT_ONLY } from "../js/generators/zentangleCells.js";

// Exactamente los rellenos que el motor de celdas puede dibujar.
export const CELL_PATTERNS = [...new Set(Object.values(CELL_PATTERN_FAMILIES).flat())].map((fn) => [fn.name, fn]);

// El motor no dibuja los rellenos RECT_ONLY en celdas poligonales: el auditor tampoco.
export const drawnIn = (fn, shape) => !(RECT_ONLY.has(fn) && (shape === "triangulo" || shape === "hexagono"));

// Giros con los que el motor dibuja cada relleno: 0/45/90/135 más el temblor de
// +2° (rotationJitterDeg es ±2.5); las rejillas alineadas solo a 0° y 90°, sin temblor.
export const rotationsFor = (fn) => (AXIS_ALIGNED.has(fn) ? [0, 90] : [2, 47, 92, 137]);

// Celdas de prueba (mm): caja del patrón y recorte (la celda).
export const SHAPES = {
  cuadrada: { w: 40, h: 40, clip: (w, h) => `M0 0H${w}V${h}H0Z` },
  banda: { w: 120, h: 16, clip: (w, h) => `M0 0H${w}V${h}H0Z` },
  tira: { w: 16, h: 60, clip: (w, h) => `M0 0H${w}V${h}H0Z` },
  triangulo: { w: 44, h: 38, clip: (w, h) => `M0 ${h}L${w / 2} 0L${w} ${h}Z` },
  // Hexágono de radio 12 mm (celda de hex_editorial y kdp_geometric_art).
  hexagono: { w: 20.78, h: 24, clip: (w, h) => `M${w / 2} 0L${w} ${h / 4}L${w} ${(3 * h) / 4}L${w / 2} ${h}L0 ${(3 * h) / 4}L0 ${h / 4}Z` },
};

// rot: giro del patrón en grados, como en zentangleCells (0, 45, 90, 135): se genera sobre
// una caja ampliada que cubre la celda tras girar y el clip recorta el sobrante.
export function auditPattern(fn, shape, seed, cfgOver = {}, rot = 0) {
  const { w, h, clip } = SHAPES[shape];
  const cfg = { minGapMm: 1.4, patternStrokeMm: 0.35, sketchy: 0, cellMm: 0, ...cfgOver };
  const rad = (rot * Math.PI) / 180, cA = Math.abs(Math.cos(rad)), sA = Math.abs(Math.sin(rad));
  const hw = (cA * w + sA * h) / 2, hh = (sA * w + cA * h) / 2, cx = w / 2, cy = h / 2;
  const d = fn(createRNG(seed), { x0: cx - hw, y0: cy - hh, x1: cx + hw, y1: cy + hh }, cfg);
  const c = clip(w, h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${w + 2} ${h + 2}" width="${w + 2}mm" height="${h + 2}mm">
<defs><clipPath id="c"><path d="${c}"/></clipPath></defs><rect x="-1" y="-1" width="${w + 2}" height="${h + 2}" fill="#fff"/>
${d ? `<g clip-path="url(#c)"><path transform="rotate(${rot} ${cx} ${cy})" d="${d}" fill="none" stroke="#000" stroke-width="${cfg.patternStrokeMm}" stroke-linecap="round" stroke-linejoin="round"/></g>` : ""}
<path d="${c}" fill="none" stroke="#000" stroke-width="1" stroke-linejoin="round"/></svg>`;
  // El exterior de la celda se pinta de negro en el mismo dibujo para que no cuente como región.
  const outside = `<path d="M-1 -1H${w + 1}V${h + 1}H-1Z ${c}" fill="#000" fill-rule="evenodd"/>`;
  const img = new Resvg(svg.replace("</svg>", outside + "</svg>"), { fitTo: { mode: "width", value: (w + 2) * PX } }).render();
  return { ...whiteRegions(img.pixels, img.width, img.height, PX), empty: !d };
}

if (process.argv[1] && process.argv[1].endsWith("patternAudit.mjs")) {
  const only = process.argv[2] ? process.argv[2].split(",") : null;
  const seeds = Array.from({ length: Number(process.env.SEEDS || 3) }, (_, i) => 11 + i * 17);
  const forced = process.env.ROT ? process.env.ROT.split(",").map(Number) : null;
  console.log("patrón".padEnd(22) + Object.keys(SHAPES).map((s) => s.padStart(18)).join("") + "   (no coloreables / manchitas por celda; giros del motor" + (forced ? ` forzados a ${forced.join("/")}` : "") + ")");
  const rows = [];
  for (const [name, fn] of CELL_PATTERNS) {
    if (only && !only.includes(name)) continue;
    const cols = Object.keys(SHAPES).map((shape) => {
      if (!drawnIn(fn, shape)) return { bad: 0, micro: 0, empty: true, skipped: true };
      const r = seeds.flatMap((s) => (forced || rotationsFor(fn)).map((rot) => auditPattern(fn, shape, s, {}, rot)));
      const m = (k) => r.reduce((a, x) => a + x[k], 0) / r.length;
      return { bad: m("bad"), micro: m("micro"), empty: r.every((x) => x.empty) };
    });
    rows.push({ name, cols });
    console.log(name.padEnd(22) + cols.map((c) => (c.skipped ? "(no se usa)" : c.empty ? "(vacío)" : `${c.bad.toFixed(0)} / ${c.micro.toFixed(0)}`).padStart(18)).join(""));
  }
}

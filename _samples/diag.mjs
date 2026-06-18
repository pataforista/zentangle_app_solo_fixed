import * as G from "../js/generators/patterns/geometric.js";
import * as O from "../js/generators/patterns/organic.js";
import * as C from "../js/generators/patterns/complex.js";
import * as D from "../js/generators/patterns/dense.js";
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";

const all = { ...G, ...O, ...C, ...D };
const fns = Object.entries(all).filter(([k, v]) => k.startsWith("fill") && typeof v === "function");

// Deterministic-ish rng
let s = 12345;
const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };

const cell = Number(process.argv[2] || 60), pad = 6, cols = 4;
const rows = Math.ceil(fns.length / cols);
const W = cols * (cell + pad) + pad, H = rows * (cell + pad) + pad + 20;
const cfg = { sketchy: 0.3, minGapMm: 1.4, patternStrokeMm: 0.35 };

let body = `<rect width="${W}" height="${H}" fill="white"/>`;
fns.forEach(([name, fn], idx) => {
  const cx = pad + (idx % cols) * (cell + pad);
  const cy = pad + Math.floor(idx / cols) * (cell + pad);
  const r = { x0: cx, y0: cy, x1: cx + cell, y1: cy + cell };
  let d = "";
  try { d = fn(rng, r, cfg) || ""; } catch (e) { d = ""; name += " ERR"; }
  body += `<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" fill="none" stroke="#888" stroke-width="0.3"/>`;
  if (d) body += `<path d="${d}" fill="none" stroke="#000" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round"/>`;
  body += `<text x="${cx + 2}" y="${cy + cell - 2}" font-size="3" fill="#c00">${name}</text>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${body}</svg>`;
const png = new Resvg(svg, { background: "white", fitTo: { mode: "width", value: 1100 } }).render().asPng();
const out = `_samples/diag_${cell}.png`;
writeFileSync(out, png);
console.log("wrote", out, "with", fns.length, "patterns");

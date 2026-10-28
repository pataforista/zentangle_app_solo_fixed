// Huellas golden: cada (preset, semilla) debe producir exactamente el mismo SVG.
// Atrapa cambios de orden o de número de llamadas a rng() que reordenarían todo
// un libro sin que ninguna otra prueba lo note (la prueba de determinismo solo
// compara dos ejecuciones entre sí, no contra una huella guardada).
//
// Uso:  npm run golden              compara con _samples/golden.json
//       npm run golden -- --update  reescribe el archivo (tras un cambio de salida intencionado)
//
// Node cae siempre al Voronoi simple (d3-delaunay no carga por https); el
// navegador usa d3, así que sus páginas Voronoi no coinciden con estas huellas.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { generateZentangle } from "../js/generators/zentangle.generator.js";
import { ZENTANGLE_PRESETS } from "../js/generators/zentangle.presets.js";
import { BESTSELLER_KEY, RANDOM_STYLE_KEY, RANDOM_COLOR_KEY, resolveBookStyle } from "../js/generators/randomStyle.js";

const FILE = new URL("./golden.json", import.meta.url);
const UPDATE = process.argv.includes("--update");
const AREA = { x: 10, y: 10, w: 190, h: 260 };
const SEEDS = [7, 99, 1147527462];
// Estilos con relleno de huecos (rasterizado con resvg): una huella por estilo.
const RASTER_PRESETS = ["sampler_icons", "icon_mandala", "classic_z_string", "hex_editorial", "kdp_balanced"];
const BOOK_MODES = [BESTSELLER_KEY, RANDOM_STYLE_KEY, RANDOM_COLOR_KEY];
const BOOK_SEEDS = [123456789, 1147527462];
const BOOK_PAGES = 60;

console.warn = () => {};
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);
const hashDoc = (d) => sha(d.body.join("") + "|" + d.defs.join(""));

let Resvg = null;
try { ({ Resvg } = createRequire(import.meta.url)("@resvg/resvg-js")); } catch { /* sin resvg se omiten las huellas con relleno */ }

const current = { pages: {}, raster: {}, books: {} };

for (const name of Object.keys(ZENTANGLE_PRESETS)) {
  for (const seed of SEEDS) {
    const d = { body: [], defs: [] };
    await generateZentangle(d, { seed, presetName: name, areaMm: AREA });
    current.pages[`${name}@${seed}`] = hashDoc(d);
  }
}

if (Resvg) {
  const rasterize = async (svg, w) => { const r = new Resvg(svg, { fitTo: { mode: "width", value: w } }).render(); return { data: r.pixels, width: r.width, height: r.height }; };
  for (const name of RASTER_PRESETS) {
    const d = { body: [], defs: [] };
    await generateZentangle(d, { seed: 3, presetName: name, areaMm: AREA, rasterize });
    current.raster[`${name}@3`] = hashDoc(d);
  }
}

// Secuencia de estilos de un libro (lo que decide qué motor toca en cada página).
const pageSeedOf = (base, i) => ((base >>> 0) + Math.imul(i, 0x9e3779b1)) >>> 0;
for (const mode of BOOK_MODES) {
  for (const base of BOOK_SEEDS) {
    const seq = Array.from({ length: BOOK_PAGES }, (_, i) => {
      const r = resolveBookStyle(mode, pageSeedOf(base, i), { pageIndex: i, bookSeed: base });
      return `${r.presetName}:${JSON.stringify(r.overrides)}`;
    });
    current.books[`${mode}@${base}`] = sha(seq.join("\n"));
  }
}

if (UPDATE || !existsSync(FILE)) {
  writeFileSync(FILE, JSON.stringify(current, null, 1) + "\n");
  console.log(`✓ Huellas golden escritas: ${Object.keys(current.pages).length} páginas, ${Object.keys(current.raster).length} con relleno, ${Object.keys(current.books).length} libros.`);
  process.exit(0);
}

const saved = JSON.parse(readFileSync(FILE, "utf8"));
const diffs = [];
for (const group of ["pages", "raster", "books"]) {
  for (const [k, v] of Object.entries(current[group])) {
    if (saved[group]?.[k] === undefined) diffs.push(`${group}: ${k} no tiene huella guardada`);
    else if (saved[group][k] !== v) diffs.push(`${group}: ${k} cambió (${saved[group][k]} → ${v})`);
  }
  for (const k of Object.keys(saved[group] || {})) if (current[group][k] === undefined && !(group === "raster" && !Resvg)) diffs.push(`${group}: ${k} ya no se genera`);
}
if (diffs.length) {
  console.error(`✗ La salida cambió en ${diffs.length} huellas golden:`);
  diffs.slice(0, 20).forEach((l) => console.error("  " + l));
  if (diffs.length > 20) console.error(`  … y ${diffs.length - 20} más`);
  console.error("Si el cambio es intencionado: npm run golden -- --update");
  process.exit(1);
}
console.log(`✓ Golden: ${Object.keys(current.pages).length} páginas, ${Object.keys(current.raster).length} con relleno, ${Object.keys(current.books).length} secuencias de libro idénticas.`);

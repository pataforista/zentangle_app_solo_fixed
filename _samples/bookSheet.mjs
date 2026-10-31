// Hoja de contactos de un libro: las primeras páginas de un tipo de libro
// (BOOK_RECIPES), tal como las genera la app, en una sola imagen para revisarlas
// de un vistazo.
// Uso: node _samples/bookSheet.mjs dino [n=16] [semilla] → _samples/book_dino.png
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
const ROOT = new URL("..", import.meta.url).href.replace(/\/$/, "");
const { generateZentangle } = await import(ROOT + "/js/generators/zentangle.generator.js");
const { BOOK_RECIPES } = await import(ROOT + "/js/core/bookRecipes.js");
const { difficultyAt } = await import(ROOT + "/js/core/bookPlan.js");
const { pageSeed } = await import(ROOT + "/js/core/bookSeeds.js");
console.warn = () => {};

const [id = "adult", nArg = "16", seedArg = "20261031"] = process.argv.slice(2);
const recipe = BOOK_RECIPES.find((r) => r.id === id);
if (!recipe) { console.error(`Tipo de libro desconocido: ${id} (${BOOK_RECIPES.map((r) => r.id).join(", ")})`); process.exit(1); }
const n = Math.min(Number(nArg), recipe.designs), base = Number(seedArg) >>> 0;
const W = 215.9, H = 279.4, M = 12.7, TW = 260, TH = Math.round((TW * H) / W), cols = 6, gap = 10;
const rasterize = async (svg, w) => { const r = new Resvg(svg, { fitTo: { mode: "width", value: w } }).render(); return { data: r.pixels, width: r.width, height: r.height }; };
const tiles = [];
for (let i = 0; i < n; i++) {
  const seed = pageSeed(base, i, 0);
  const doc = { body: [], defs: [] };
  const difficulty = recipe.progressive ? difficultyAt(i, recipe.designs) : null;
  const used = await generateZentangle(doc, { seed, presetName: recipe.style, overrides: { seed, ...(difficulty === null ? {} : { difficulty }) },
    areaMm: { x: M, y: M, w: W - 2 * M, h: H - 2 * M }, pageIndex: i, bookSeed: base, rasterize });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}mm" height="${H}mm"><defs>${doc.defs.join("")}</defs><rect width="${W}" height="${H}" fill="#fff"/>${doc.body.join("")}</svg>`;
  const fig = (svg.match(/data-figure="([^"]+)"/) || [])[1];
  const lay = (svg.match(/data-layout="([^"]+)"/) || [])[1];
  const bg = (svg.match(/data-bg="([^"]+)"/) || [])[1];
  tiles.push({ png: new Resvg(svg, { background: "white", fitTo: { mode: "width", value: TW } }).render().asPng(), label: `${i + 1} ${fig || used.presetName}${lay ? ` · ${lay}` : ""}${bg ? ` · ${bg}` : ""}` });
}
const rows = Math.ceil(tiles.length / cols), MW = cols * (TW + gap) + gap, MH = rows * (TH + gap + 18) + gap;
let body = `<rect width="${MW}" height="${MH}" fill="#ccc"/>`;
tiles.forEach((t, i) => {
  const x = gap + (i % cols) * (TW + gap), y = gap + Math.floor(i / cols) * (TH + gap + 18);
  body += `<image x="${x}" y="${y}" width="${TW}" height="${TH}" href="data:image/png;base64,${t.png.toString("base64")}"/><text x="${x + 3}" y="${y + TH + 13}" font-size="12" font-family="sans-serif">${t.label}</text>`;
});
const out = `_samples/book_${id}.png`;
writeFileSync(out, new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${MW}" height="${MH}">${body}</svg>`, { background: "white", font: { loadSystemFonts: true } }).render().asPng());
console.log(`${out}: ${tiles.length} páginas de «${recipe.label}»`);

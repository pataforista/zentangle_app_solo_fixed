// Auditoría de libros completos: genera cada tipo de libro (BOOK_RECIPES) como
// la app (semilla por página, dificultad, dobles páginas, arreglo automático) y
// mide calidad y variedad.
//   calidad:  páginas marcadas antes y después del arreglo (3 intentos), zonas
//             difíciles, tinta y mayor hueco vacío
//   variedad: figuras distintas, repeticiones seguidas, encuadres, fondos,
//             tangles por página y parecido visual entre páginas (huella 24×24)
// Uso: npm run audit:books [-- adult,dino]   (BOOKS=2 audita 2 libros por tipo;
//      SEED=… fija la semilla base; JSON=1 imprime el resumen en JSON)
import { Resvg } from "@resvg/resvg-js";
const ROOT = new URL("..", import.meta.url).href.replace(/\/$/, "");
const { generateZentangle } = await import(ROOT + "/js/generators/zentangle.generator.js");
const { generateSpread, SPREAD_FIGURES } = await import(ROOT + "/js/generators/spread.js");
const { ZENTANGLE_PRESETS } = await import(ROOT + "/js/generators/zentangle.presets.js");
const { BOOK_RECIPES } = await import(ROOT + "/js/core/bookRecipes.js");
const { designUnits, difficultyAt } = await import(ROOT + "/js/core/bookPlan.js");
const { analyzeColorability, qualityVerdict, qualityScore } = await import(ROOT + "/js/core/pageQuality.js");
const { pageSeed, spreadFigureFor, singlesBefore } = await import(ROOT + "/js/core/bookSeeds.js");
const { isRandomKey } = await import(ROOT + "/js/generators/randomStyle.js");
console.warn = () => {};

const PAPER = { w: 215.9, h: 279.4 }, M = 12.7, QPX = 6;
const inner = { x: M, y: M, w: PAPER.w - 2 * M, h: PAPER.h - 2 * M };
const raster = (svg, w) => { const r = new Resvg(svg, { fitTo: { mode: "width", value: w } }).render(); return { data: r.pixels, width: r.width, height: r.height }; };
const rasterize = async (svg, w) => raster(svg, w);
const svgOf = (doc, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm"><defs>${doc.defs.join("")}</defs><rect width="${w}" height="${h}" fill="#fff"/>${doc.body.join("")}</svg>`;

// Huella visual: densidad de tinta en una rejilla 24×24 del área de dibujo.
function fingerprint(r, wMm) {
  const G = 24, px = r.width / wMm, out = new Float32Array(G * G);
  const x0 = Math.round(M * px), y0 = Math.round(M * px), w = r.width - 2 * x0, h = r.height - 2 * y0;
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
    let ink = 0, n = 0;
    for (let y = y0 + Math.floor((gy * h) / G); y < y0 + Math.floor(((gy + 1) * h) / G); y += 2)
      for (let x = x0 + Math.floor((gx * w) / G); x < x0 + Math.floor(((gx + 1) * w) / G); x += 2) { n++; if (r.data[(y * r.width + x) * 4] < 128) ink++; }
    out[gy * G + gx] = n ? ink / n : 0;
  }
  return out;
}
function corr(a, b) {
  let ma = 0, mb = 0; for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; } ma /= a.length; mb /= b.length;
  let s = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { const da = a[i] - ma, db = b[i] - mb; s += da * db; sa += da * da; sb += db * db; }
  return s / Math.sqrt(sa * sb || 1);
}

async function makePage(recipe, baseSeed, i, units, tries) {
  const seed = pageSeed(baseSeed, i, tries);
  const difficulty = recipe.progressive ? difficultyAt(i, recipe.designs) : null;
  if (units[i].kind === "spread") {
    const nth = units.slice(0, i).filter((u) => u.kind === "spread").length;
    const figureName = spreadFigureFor(ZENTANGLE_PRESETS[recipe.style]?.figures, SPREAD_FIGURES, baseSeed, nth);
    const sp = await generateSpread({ paper: PAPER, marginMm: M, seed, difficulty, figureName, rasterize });
    const r = raster(sp.wide, Math.round(PAPER.w * 2 * QPX));
    return { svg: sp.wide, r, wMm: PAPER.w * 2, area: inner.w * inner.h * 2, preset: "spread", figure: sp.figure };
  }
  const doc = { body: [], defs: [] };
  const overrides = { seed, ...(difficulty === null ? {} : { difficulty }) };
  if (!isRandomKey(recipe.style)) overrides.figurePage = singlesBefore(units, i);
  const used = await generateZentangle(doc, { seed, presetName: recipe.style, overrides, areaMm: inner, pageIndex: i, bookSeed: baseSeed, rasterize });
  const svg = svgOf(doc, PAPER.w, PAPER.h);
  return { svg, r: raster(svg, Math.round(PAPER.w * QPX)), wMm: PAPER.w, area: inner.w * inner.h, preset: used.presetName };
}

function measure(p) {
  const pxInner = { x0: Math.round(M * QPX), y0: Math.round(M * QPX), x1: p.r.width - Math.round(M * QPX), y1: p.r.height - Math.round(M * QPX) };
  const q = analyzeColorability(p.r, QPX, { inner: pxInner });
  const v = qualityVerdict(q, p.area);
  const tangles = new Set([...p.svg.matchAll(/data-tangle="([^"]+)"/g)].map((m) => m[1]));
  return {
    preset: p.preset, figure: p.figure || (p.svg.match(/data-figure="([^"]+)"/) || [])[1] || null,
    layout: (p.svg.match(/data-layout="([^"]+)"/) || [])[1] || null, bg: (p.svg.match(/data-bg="([^"]+)"/) || [])[1] || null,
    hidden: (p.svg.match(/data-hidden="/g) || []).length, tangles: [...tangles],
    bad: q.bad, maxBad: v.maxBad, ink: q.ink, blankMm: q.blankMm, ok: v.ok, score: qualityScore(q, v.maxBad), fp: fingerprint(p.r, p.wMm),
  };
}

async function auditBook(recipe, baseSeed) {
  const units = designUnits(recipe.designs, { spreads: recipe.spreads });
  const pages = [];
  let flagged0 = 0;
  for (let i = 0; i < recipe.designs; i++) {
    let best = measure(await makePage(recipe, baseSeed, i, units, 0));
    if (!best.ok) flagged0++;
    // Arreglo automático de la app: hasta 3 intentos, se queda con el mejor.
    for (let t = 1; t <= 3 && !best.ok; t++) {
      const c = measure(await makePage(recipe, baseSeed, i, units, t));
      if (c.score < best.score) best = c;
    }
    pages.push(best);
  }
  const figs = pages.map((p) => p.figure).filter(Boolean);
  const count = (arr) => arr.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});
  let seqRepeat = 0, nearDup = 0, maxSim = 0, simPairs = [];
  for (let i = 1; i < pages.length; i++) if (pages[i].figure && pages[i].figure === pages[i - 1].figure) seqRepeat++;
  for (let i = 0; i < pages.length; i++) for (let j = i + 1; j < pages.length; j++) {
    const s = corr(pages[i].fp, pages[j].fp); if (s > maxSim) maxSim = s; if (s > 0.8) nearDup++;
    if (s > 0.7) simPairs.push(`${i + 1}/${j + 1} ${pages[i].figure || pages[i].preset} ${s.toFixed(2)}`);
  }
  const avg = (f) => pages.reduce((a, p) => a + f(p), 0) / pages.length;
  const allT = new Set(pages.flatMap((p) => p.tangles));
  return {
    recipe: recipe.id, seed: baseSeed, designs: pages.length,
    flaggedBefore: flagged0, flaggedAfter: pages.filter((p) => !p.ok).length,
    badRatio: +avg((p) => p.bad / Math.max(1, p.maxBad)).toFixed(2), ink: +avg((p) => p.ink).toFixed(1),
    blankMm: +avg((p) => p.blankMm).toFixed(1), maxBlankMm: +Math.max(...pages.map((p) => p.blankMm)).toFixed(1),
    figures: figs.length, distinctFigures: new Set(figs).size, maxFigureRepeat: Math.max(0, ...Object.values(count(figs))), seqRepeat,
    layouts: count(pages.map((p) => p.layout).filter(Boolean)), bgs: count(pages.map((p) => p.bg).filter(Boolean)),
    presets: count(pages.map((p) => p.preset)), hiddenAvg: +avg((p) => p.hidden).toFixed(1),
    tanglesPerPage: +avg((p) => p.tangles.length).toFixed(1), distinctTangles: allT.size,
    maxSim: +maxSim.toFixed(2), nearDupPairs: nearDup, simPairs: simPairs.slice(0, 6), figureOrder: figs.slice(0, 8),
  };
}

const only = process.argv[2] ? process.argv[2].split(",") : null;
const nBooks = Number(process.env.BOOKS || 1);
const base = Number(process.env.SEED || 20261031) >>> 0;
const out = [];
for (const recipe of BOOK_RECIPES.filter((r) => !only || only.includes(r.id))) {
  for (let b = 0; b < nBooks; b++) {
    const t0 = Date.now();
    const res = await auditBook(recipe, (base + b * 7919) >>> 0);
    res.seconds = Math.round((Date.now() - t0) / 1000);
    out.push(res);
    if (!process.env.JSON) {
      console.log(`\n■ ${res.recipe} (semilla ${res.seed}, ${res.designs} diseños, ${res.seconds} s)`);
      console.log(`  calidad: marcadas ${res.flaggedBefore} → ${res.flaggedAfter} tras arreglo · zonas/máx ${res.badRatio} · tinta ${res.ink} % · hueco vacío medio ${res.blankMm} mm (máx ${res.maxBlankMm})`);
      console.log(`  figuras: ${res.distinctFigures} distintas en ${res.figures} páginas · repetición máx ${res.maxFigureRepeat} · seguidas ${res.seqRepeat} · escondidas/pág ${res.hiddenAvg}`);
      console.log(`  encuadres ${JSON.stringify(res.layouts)} · fondos ${JSON.stringify(res.bgs)}`);
      console.log(`  tangles/pág ${res.tanglesPerPage} · distintos en el libro ${res.distinctTangles} · parecido máx ${res.maxSim} · pares casi iguales ${res.nearDupPairs}`);
      if (res.simPairs.length) console.log(`  pares parecidos (> 0.7): ${res.simPairs.join(" · ")}`);
      if (Object.keys(res.presets).length > 1) console.log(`  estilos ${JSON.stringify(res.presets)}`);
      console.log(`  primeras figuras: ${res.figureOrder.join(", ")}`);
    }
  }
}
if (process.env.JSON) console.log(JSON.stringify(out, null, 1));

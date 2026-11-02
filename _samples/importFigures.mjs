// _samples/importFigures.mjs
// Script de importación y validación automática de figuras SVG (§5.3).
// Escanea el directorio figures/, valida geometría, licencias y renderizado,
// y genera una hoja de contacto para revisión humana.
//
// Uso: node _samples/importFigures.mjs [--sheet]
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import { compileFigureDefinition, registerImportedFigure } from "../js/core/svgImporter.js";
import { FIGURES, FIGURE_IDS, FIGURE_SETS } from "../js/generators/figure.js";
import { generateZentangle } from "../js/generators/zentangle.generator.js";
import { analyzeColorability, qualityVerdict } from "../js/core/pageQuality.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIGURES_DIR = join(__dirname, "..", "figures");

console.log("=== IMPORTADOR Y AUDITOR DE SILUETAS SVG ===\n");

function findSvgFigures(dir) {
  const list = [];
  if (!existsSync(dir)) return list;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      list.push(...findSvgFigures(full));
    } else if (ent.isFile() && ent.name.endsWith(".svg")) {
      const jsonPath = full.replace(/\.svg$/, ".json");
      if (existsSync(jsonPath)) {
        list.push({ svgPath: full, jsonPath });
      }
    }
  }
  return list;
}

const figures = findSvgFigures(FIGURES_DIR);
console.log(`Encontradas ${figures.length} siluetas SVG con ficha .json en ${FIGURES_DIR}\n`);

if (figures.length === 0) {
  console.log("No hay figuras para importar. Añade archivos en figures/<tema>/<nombre>.svg y .json.");
  process.exit(0);
}

const thumbs = [];
const page = { x: 12.7, y: 12.7, w: 190.5, h: 254 };

for (const { svgPath, jsonPath } of figures) {
  const svgText = readFileSync(svgPath, "utf8");
  const meta = JSON.parse(readFileSync(jsonPath, "utf8"));
  console.log(`Procesando figura '${meta.id}' (${meta.label?.es || meta.id})...`);

  const compiled = compileFigureDefinition(svgText, meta);
  if (!compiled.success) {
    console.error(`❌ Error al compilar ${meta.id}:`, compiled.errors);
    continue;
  }
  if (compiled.warnings && compiled.warnings.length > 0) {
    console.warn(`⚠️ Advertencias para ${meta.id}:`, compiled.warnings);
  }

  // Registrar en el motor
  registerImportedFigure(compiled, FIGURES, FIGURE_IDS, FIGURE_SETS);

  // Probar 3 semillas distintas
  const testSeeds = [11, 42, 99];
  let allOk = true;

  for (const seed of testSeeds) {
    const doc = { body: [], defs: [] };
    await generateZentangle(doc, {
      seed,
      presetName: "zen_figure",
      areaMm: page,
      overrides: { figureName: meta.id, figureBackground: "rays" },
    });

    const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 215.9 279.4"><defs>${doc.defs.join("")}</defs><rect width="216" height="280" fill="#fff"/>${doc.body.join("")}</svg>`;
    const raster = new Resvg(fullSvg, { fitTo: { mode: "width", value: 300 } }).render();
    const qa = analyzeColorability({ data: raster.pixels, width: raster.width, height: raster.height }, 1.4, { inner: { x0: 17, y0: 17, x1: 283, y1: 370 } });
    const verdict = qualityVerdict(qa);

    if (!verdict.ok) {
      console.error(`  ❌ Semilla ${seed}: Falló control de calidad:`, verdict.reasons);
      allOk = false;
    } else {
      console.log(`  ✓ Semilla ${seed}: Calidad óptima (bad: ${qa.bad}, tinta: ${(qa.ink * 100).toFixed(1)}%, hueco: ${qa.blankMm.toFixed(1)} mm)`);
    }

    thumbs.push({ png: raster, id: meta.id, seed, bad: qa.bad });
  }

  if (allOk) {
    console.log(`✓ '${meta.id}' validada con éxito (licencia: ${meta.license}, autor: ${meta.author}).\n`);
  }
}

// Generar hoja de contacto visual
if (thumbs.length > 0) {
  const tw = 300, th = Math.round(300 * 279.4 / 215.9), cols = 3, rows = Math.ceil(thumbs.length / cols), gap = 14;
  let body = `<rect width="${cols * (tw + gap) + gap}" height="${rows * (th + gap + 20) + gap}" fill="#f1f5f9"/>`;
  thumbs.forEach((t, i) => {
    const x = gap + (i % cols) * (tw + gap);
    const y = gap + Math.floor(i / cols) * (th + gap + 20);
    const uri = "data:image/png;base64," + t.png.asPng().toString("base64");
    body += `<image x="${x}" y="${y}" width="${tw}" height="${th}" href="${uri}"/>`;
    body += `<text x="${x + 6}" y="${y + th + 14}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#1e293b">${t.id} (seed ${t.seed} · bad: ${t.bad})</text>`;
  });

  const mw = cols * (tw + gap) + gap, mh = rows * (th + gap + 20) + gap;
  const sheetSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${mw}" height="${mh}" viewBox="0 0 ${mw} ${mh}">${body}</svg>`;
  const outPath = join(__dirname, "imported_figures_contact.png");
  writeFileSync(outPath, new Resvg(sheetSvg, { background: "#f1f5f9" }).render().asPng());
  console.log(`🖼️ Hoja de contacto generada: ${outPath}`);
}

console.log("=== VALIDACIÓN DE IMPORTACIÓN FINALIZADA CON ÉXITO ===");

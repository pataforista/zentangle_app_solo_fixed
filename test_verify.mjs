import assert from "assert";
import { generateZentangleCells } from "./js/generators/zentangleCells.js";

async function runTests() {
  console.log("=== INICIANDO SUITE DE PRUEBAS AUTOMATIZADAS ===\n");

  try {
    // 1. Prueba de Determinismo
    console.log("Prueba 1: Determinismo (misma semilla -> mismo output)...");
    const doc1 = { body: [], defs: [] };
    const doc2 = { body: [], defs: [] };
    const doc3 = { body: [], defs: [] };

    const opts1 = {
      seed: 54321,
      areaMm: { x: 10, y: 10, w: 100, h: 100 },
      cellLayout: "rect_bsp",
      cellCount: 15,
      minCellSizeMm: 12,
      patternFamily: "geometric"
    };

    const opts3 = {
      ...opts1,
      seed: 99999 // Semilla diferente
    };

    await generateZentangleCells(doc1, opts1);
    await generateZentangleCells(doc2, opts1); // Misma semilla
    await generateZentangleCells(doc3, opts3); // Semilla diferente

    const svg1 = doc1.body.join("\n");
    const svg2 = doc2.body.join("\n");
    const svg3 = doc3.body.join("\n");

    assert.strictEqual(svg1, svg2, "ERROR: Dos ejecuciones con la misma semilla produjeron resultados diferentes.");
    assert.notStrictEqual(svg1, svg3, "ERROR: Dos ejecuciones con semillas diferentes produjeron resultados idénticos.");
    console.log("✓ Determinismo verificado correctamente.\n");


    // 2. Prueba de Estándares KDP
    console.log("Prueba 2: Estándares KDP (Bleed, Zona Segura, Áreas Mínimas)...");
    
    // 2a. Sangrado (Bleed)
    const docBleed = { body: [], defs: [] };
    const optsBleed = {
      seed: 123,
      areaMm: { x: 10, y: 10, w: 100, h: 100 },
      kdpBleedMm: 3.175, // Sangrado estándar KDP
      drawOuterBorder: true
    };
    await generateZentangleCells(docBleed, optsBleed);
    
    // Verificamos que el borde exterior se dibuje ensanchado por el sangrado.
    // El rect original es x0=10, y0=10, x1=110, y1=110. Con sangrado de 3.175 es x0=6.825, y0=6.825, x1=113.175, y1=113.175.
    const outerPath = docBleed.body[0];
    assert.ok(outerPath.includes("6.825") && outerPath.includes("113.175"), "ERROR: El sangrado KDP no extendió el marco exterior adecuadamente.");
    console.log("✓ Sangrado KDP verificado (marco ensanchado a 6.825 - 113.175 mm).");

    // 2b. Zona Segura
    const docSafeZone = { body: [], defs: [] };
    const optsSafeZone = {
      seed: 123,
      areaMm: { x: 10, y: 10, w: 100, h: 100 },
      showSafeZone: true
    };
    await generateZentangleCells(docSafeZone, optsSafeZone);
    const hasSafeZoneDef = docSafeZone.defs.some(d => d.includes("safeZone"));
    assert.ok(hasSafeZoneDef, "ERROR: Las guías de zona segura no fueron agregadas a los defs.");
    console.log("✓ Guías de zona segura KDP verificadas.");


    // 3. Prueba de Rendimiento (Límite de Celdas)
    console.log("\nPrueba 3: Rendimiento en Celdas Densas (kdp_masterpiece)...");
    const docPerf = { body: [], defs: [] };
    const optsPerf = {
      seed: 123,
      areaMm: { x: 10, y: 10, w: 150, h: 150 },
      cellLayout: "rect_bsp",
      cellCount: 45, // Máxima densidad (Masterpiece)
      minCellSizeMm: 8,
      patternFamily: "organic"
    };

    const start = Date.now();
    await generateZentangleCells(docPerf, optsPerf);
    const duration = Date.now() - start;

    console.log(`Renderizado completado en ${duration} ms (celdas: ${optsPerf.cellCount}).`);
    assert.ok(duration < 250, `ERROR: El renderizado tardó demasiado (${duration} ms). Debe ser < 250ms.`);
    console.log("✓ Rendimiento dentro del límite óptimo.");


    // 4. Regresión Estructural (Conteo de Elementos)
    console.log("\nPrueba 4: Regresión Estructural (Conteo de elementos SVG)...");
    const docReg = { body: [], defs: [] };
    const optsReg = {
      seed: 777,
      areaMm: { x: 0, y: 0, w: 100, h: 100 },
      cellLayout: "rect_bsp",
      cellCount: 10,
      minCellSizeMm: 15,
      patternFamily: "tangles",
      innerOrganicBorderEnabled: true
    };

    await generateZentangleCells(docReg, optsReg);

    // Contamos elementos basándonos en la estructura esperada:
    // - 1 path para el borde exterior (drawOuterBorder)
    // - 10 paths para los bordes de las celdas
    // - 10 grupos para los patrones de las celdas (con seed 777 ninguna celda se salta)
    // - 10 clipPaths en los defs
    const pathCount = docReg.body.filter(s => s.startsWith("<path")).length;
    const groupCount = docReg.body.filter(s => s.startsWith("<g")).length;
    const clipPathCount = docReg.defs.filter(s => s.includes("clipPath")).length;
    const totalPaths = docReg.body.join("").split("<path").length - 1;

    console.log(`Estructura SVG - Paths top-level: ${pathCount}, Groups: ${groupCount}, clipPaths: ${clipPathCount}, Paths totales: ${totalPaths}`);

    assert.strictEqual(pathCount, 11, `ERROR: Conteo de paths top-level incorrecto (${pathCount} != 11)`);
    assert.strictEqual(groupCount, 10, `ERROR: Conteo de grupos incorrecto (${groupCount} != 10)`);
    assert.strictEqual(clipPathCount, 10, `ERROR: Conteo de clipPaths incorrecto (${clipPathCount} != 10)`);
    assert.strictEqual(totalPaths, 21, `ERROR: Conteo total de paths incorrecto (${totalPaths} != 21)`);
    console.log("✓ Estructura de elementos consistente.");

    console.log("\n==============================================");
    console.log("🎉 TODAS LAS PRUEBAS PASARON EXITOSAMENTE! 🎉");
    console.log("==============================================");
    process.exit(0);

  } catch (err) {
    console.error("\n❌ ERROR EN LAS PRUEBAS:");
    console.error(err);
    process.exit(1);
  }
}

runTests();

import assert from "assert";
import { generateZentangleCells } from "./js/generators/zentangleCells.js";
import { generateZentangle } from "./js/generators/zentangle.generator.js";
import { ZENTANGLE_PRESETS } from "./js/generators/zentangle.presets.js";
import { MOTIFS } from "./js/generators/patterns/motifs.js";
import { ICONS } from "./js/generators/patterns/icons.js";
import { createRNG } from "./js/core/prng.js";

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


    // 5. Modo Sketchy (trazo a mano en curvas y círculos)
    console.log("\nPrueba 5: Modo Sketchy (determinismo y curvas rugosas)...");
    const optsSketchy = {
      seed: 4242,
      areaMm: { x: 10, y: 10, w: 100, h: 100 },
      cellLayout: "rect_bsp",
      cellCount: 12,
      minCellSizeMm: 12,
      patternFamily: "organic",
      sketchy: 0.9
    };
    const docSk1 = { body: [], defs: [] };
    const docSk2 = { body: [], defs: [] };
    const docSk0 = { body: [], defs: [] };
    await generateZentangleCells(docSk1, optsSketchy);
    await generateZentangleCells(docSk2, optsSketchy);
    await generateZentangleCells(docSk0, { ...optsSketchy, sketchy: 0 });

    const skSvg = docSk1.body.join("");
    assert.strictEqual(skSvg, docSk2.body.join(""), "ERROR: El modo sketchy no es determinista.");
    assert.ok(!/NaN|Infinity/.test(skSvg + docSk1.defs.join("")), "ERROR: El modo sketchy produce coordenadas inválidas.");
    assert.notStrictEqual(skSvg, docSk0.body.join(""), "ERROR: sketchy > 0 no altera el trazo.");
    // La familia organic dibuja curvas: con sketchy deben quedar subdivididas en
    // cadenas de cuadráticas (más comandos Q que la versión limpia)
    const qRough = (skSvg.match(/Q /g) || []).length;
    const qClean = (docSk0.body.join("").match(/Q /g) || []).length;
    assert.ok(qRough > qClean, `ERROR: Las curvas no se subdividen en modo sketchy (Q rough=${qRough} <= Q clean=${qClean}).`);
    console.log(`✓ Sketchy determinista y con curvas rugosas (Q: ${qClean} limpio -> ${qRough} rugoso).`);

    // 6. Modo muestrario (sampler)
    console.log("\nPrueba 6: Modo muestrario (determinismo, motivos válidos, solids)...");
    const area = { x: 12, y: 12, w: 186, h: 273 };
    const samplerNames = Object.keys(ZENTANGLE_PRESETS).filter((n) => ZENTANGLE_PRESETS[n].cellLayout === "sampler");
    assert.ok(samplerNames.length >= 6, "ERROR: faltan presets de muestrario.");
    for (const name of samplerNames) {
      const a = { body: [], defs: [] }, b = { body: [], defs: [] };
      await generateZentangle(a, { seed: 99, presetName: name, areaMm: area });
      await generateZentangle(b, { seed: 99, presetName: name, areaMm: area });
      const out = a.body.join("") + a.defs.join("");
      assert.strictEqual(out, b.body.join("") + b.defs.join(""), `ERROR: ${name} no es determinista.`);
      assert.ok(!/NaN|Infinity|undefined/.test(out), `ERROR: ${name} produce coordenadas inválidas.`);
      const tiles = (a.body.join("").match(/data-motif=/g) || []).length;
      const want = ZENTANGLE_PRESETS[name].cellCount;
      assert.ok(Math.abs(tiles - want) <= Math.max(3, want * 0.25), `ERROR: ${name} generó ${tiles} unidades (pedidas ~${want}).`);
    }
    // Cada motivo debe devolver capas con trazo, sin NaN, con y sin rellenos negros.
    const R = 21;
    for (const m of [...MOTIFS, ...ICONS]) {
      for (const solids of [true, false]) {
        const cfg = { minGapMm: 1.8, patternStrokeMm: 0.5, sketchy: 0.3, solids, inside: (x, y, o) => Math.hypot(x - R, y - R) <= R + o };
        const layers = m.fn(createRNG(5), { x0: 0, y0: 0, x1: 42, y1: 42 }, cfg).filter((l) => l.d);
        const d = layers.map((l) => l.d).join(" ");
        assert.ok(d.length > 20, `ERROR: el motivo ${m.id} no dibujó nada (solids=${solids}).`);
        assert.ok(!/NaN|Infinity/.test(d), `ERROR: el motivo ${m.id} produce coordenadas inválidas.`);
        if (!solids) assert.ok(layers.every((l) => l.fill !== "#000"), `ERROR: ${m.id} rellena de negro con solids=false.`);
        // Determinista aunque se llame varias veces seguidas (sin estado compartido).
        const again = m.fn(createRNG(5), { x0: 0, y0: 0, x1: 42, y1: 42 }, cfg).filter((l) => l.d);
        assert.strictEqual(JSON.stringify(again), JSON.stringify(layers), `ERROR: ${m.id} no es determinista entre llamadas.`);
        // Los rellenos recortados deben traer un contorno válido.
        for (const l of layers) if (l.clipD) assert.ok(l.clipD.length > 10 && !/NaN/.test(l.clipD), `ERROR: ${m.id} tiene un recorte inválido.`);
      }
    }
    // Para colorear (solids=false) no debe haber rellenos negros en toda la página.
    for (const name of ["sampler_coloring", "sampler_icons"]) {
      for (const seed of [3, 8, 21]) {
        const docCol = { body: [], defs: [] };
        await generateZentangle(docCol, { seed, presetName: name, areaMm: area });
        assert.ok(!/fill="#000"/.test(docCol.body.join("")), `ERROR: ${name} contiene rellenos negros (seed ${seed}).`);
      }
    }
    // Cobertura: con semillas consecutivas deben salir TODOS los iconos (un PRNG
    // sin mezclar dejaba fuera al cactus para siempre).
    const seenIcons = new Set();
    for (let seed = 1; seed <= 120; seed++) {
      const d = { body: [], defs: [] };
      await generateZentangle(d, { seed, presetName: "sampler_icons", areaMm: area });
      for (const m of d.body.join("").matchAll(/data-motif="(\w+)"/g)) seenIcons.add(m[1]);
    }
    for (const ic of ICONS) assert.ok(seenIcons.has(ic.id), `ERROR: el icono ${ic.id} nunca sale en sampler_icons (120 semillas).`);
    console.log(`✓ Muestrario verificado (${samplerNames.length} presets, ${MOTIFS.length + ICONS.length} motivos).`);

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

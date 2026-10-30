import assert from "assert";
import { generateZentangleCells } from "./js/generators/zentangleCells.js";
import { generateZentangle } from "./js/generators/zentangle.generator.js";
import { ZENTANGLE_PRESETS } from "./js/generators/zentangle.presets.js";
import { MOTIFS } from "./js/generators/patterns/motifs.js";
import { ICONS } from "./js/generators/patterns/icons.js";
import { createRNG } from "./js/core/prng.js";
import { RANDOM_STYLE_KEY, RANDOM_COLOR_KEY, BESTSELLER_KEY, BESTSELLERS, resolveRandomStyle, resolveBestSeller, isColoringSafe } from "./js/generators/randomStyle.js";
import { POOLS } from "./js/generators/sampler.js";
import { LAYOUT_TEMPLATES, getTemplateCells } from "./js/generators/layoutTemplates.js";
import { TILINGS, TILING_NAMES, tileArea, insetConvex, polyArea, pointInPoly, distToEdges } from "./js/generators/samplerTilings.js";

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
      innerOrganicBorderEnabled: true,
      // Sin saltos al azar: así el conteo describe la estructura y no depende del flujo de cada celda.
      patternSkipProb: 0
    };

    await generateZentangleCells(docReg, optsReg);

    // Contamos elementos basándonos en la estructura esperada:
    // - 1 path para el borde exterior (drawOuterBorder)
    // - 10 paths para los bordes de las celdas
    // - 10 grupos para los patrones de las celdas (patternSkipProb: 0, ninguna celda se salta)
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
      if (ZENTANGLE_PRESETS[name].samplerLayout && ZENTANGLE_PRESETS[name].samplerLayout !== "grid") {
        // Teselado: cellCount cuenta las teselas principales; las chicas y las
        // cortadas por el borde se suman como acompañamiento (data-minor).
        const majors = (a.body.join("").match(/data-motif="\w+">/g) || []).length;
        assert.ok(majors >= Math.max(1, Math.floor(want * 0.3)) && tiles >= want, `ERROR: ${name} generó ${majors} teselas principales / ${tiles} en total (pedidas ~${want}).`);
      } else {
        assert.ok(Math.abs(tiles - want) <= Math.max(3, want * 0.25), `ERROR: ${name} generó ${tiles} unidades (pedidas ~${want}).`);
      }
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
    // Teselados: las teselas de la celda primitiva cubren exactamente su área
    // (coordenadas de Cairo/rombille tomadas de Wolfram PeriodicTiling) y la
    // contracción convexa nunca deja picos fuera del polígono original.
    for (const [tname, t] of Object.entries(TILINGS)) {
      const unit = Math.abs(t.v1.x * t.v2.y - t.v1.y * t.v2.x);
      const sum = t.tiles.reduce((acc, x) => acc + Math.abs(polyArea(x.poly)), 0);
      assert.ok(Math.abs(sum - unit) < 1e-9, `ERROR: el teselado ${tname} no cubre su celda (${sum} vs ${unit}).`);
      const cells = tileArea(tname, area, 14);
      assert.ok(cells.length >= 8, `ERROR: ${tname} colocó solo ${cells.length} teselas.`);
      for (const c of cells) {
        for (const p of c.poly) assert.ok(p.x >= area.x - 1e-6 && p.x <= area.x + area.w + 1e-6 && p.y >= area.y - 1e-6 && p.y <= area.y + area.h + 1e-6, `ERROR: ${tname} se sale del área.`);
        for (const p of insetConvex(c.poly, 1.5)) assert.ok(pointInPoly(p.x, p.y, c.poly) || distToEdges(p.x, p.y, c.poly) < 1e-6, `ERROR: la contracción de ${tname} deja picos.`);
      }
    }
    for (const layout of TILING_NAMES) {
      const d = { body: [], defs: [] };
      await generateZentangle(d, { seed: 5, presetName: "sampler_coloring", areaMm: area, overrides: { samplerLayout: layout } });
      const out = d.body.join("") + d.defs.join("");
      assert.ok(!/NaN|Infinity|undefined/.test(out), `ERROR: samplerLayout=${layout} produce coordenadas inválidas.`);
      assert.ok(!/fill="#000"/.test(d.body.join("")), `ERROR: samplerLayout=${layout} rellena de negro para colorear.`);
    }

    // Zentangle con figura: estrella como string, mandala de iconos y pétalos
    // facetados. Deterministas, sin coordenadas inválidas y renderizables (un
    // recorte vacío anidado en otro hacía fallar a resvg).
    const { Resvg } = await import("@resvg/resvg-js");
    for (const name of ["zen_star", "icon_mandala", "facet_spiral"]) {
      for (const seed of [3, 8, 21, 77]) {
        const d1 = { body: [], defs: [] }, d2 = { body: [], defs: [] };
        await generateZentangle(d1, { seed, presetName: name, areaMm: area });
        await generateZentangle(d2, { seed, presetName: name, areaMm: area });
        const out = d1.body.join("") + d1.defs.join("");
        assert.strictEqual(out, d2.body.join("") + d2.defs.join(""), `ERROR: ${name} no es determinista.`);
        assert.ok(!/NaN|Infinity|undefined/.test(out), `ERROR: ${name} produce coordenadas inválidas (seed ${seed}).`);
        assert.ok(!/fill="#000"/.test(d1.body.join("")) || name === "zen_star", `ERROR: ${name} rellena de negro (seed ${seed}).`);
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297"><defs>${d1.defs.join("")}</defs>${d1.body.join("")}</svg>`;
        new Resvg(svg, { fitTo: { mode: "width", value: 200 } }).render();
      }
    }

    console.log(`✓ Muestrario verificado (${samplerNames.length} presets, ${MOTIFS.length + ICONS.length} motivos).`);

    // 7. Elegibles y aleatorio: todo estilo del motor se puede elegir en el menú
    // y el modo aleatorio los sortea todos (y las opciones de los muestrarios).
    console.log("\nPrueba 7: Estilos elegibles y modo aleatorio...");
    const { readFileSync } = await import("node:fs");
    const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
    const menu = html.match(/<select id="zPreset"[^>]*>([\s\S]*?)<\/select>/)[1];
    const menuValues = [...menu.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
    assert.strictEqual(new Set(menuValues).size, menuValues.length, "ERROR: opciones duplicadas en el menú de estilos.");
    for (const name of Object.keys(ZENTANGLE_PRESETS)) assert.ok(menuValues.includes(name), `ERROR: el preset ${name} no se puede elegir en el menú.`);
    for (const v of menuValues) assert.ok(v === RANDOM_STYLE_KEY || v === RANDOM_COLOR_KEY || v === BESTSELLER_KEY || ZENTANGLE_PRESETS[v], `ERROR: el menú ofrece ${v}, que no existe.`);
    assert.ok(menuValues.includes(RANDOM_STYLE_KEY), "ERROR: falta la opción Aleatorio en el menú.");
    assert.ok(menuValues.includes(RANDOM_COLOR_KEY), "ERROR: falta la opción Aleatorio para colorear en el menú.");
    assert.ok(/\[hidden\]\s*\{\s*display:\s*none\s*!important/.test(html), "ERROR: falta la regla CSS [hidden]; .form-row (display:grid) dejaría visibles los selectores ocultos.");
    for (const id of ["samplerLayout", "samplerEdge", "samplerIconMode"]) {
      const sel = html.match(new RegExp(`<select id="${id}"[^>]*>([\\s\\S]*?)</select>`))[1];
      const vals = [...sel.matchAll(/<option value="([^"]+)"/g)].map((m) => m[1]);
      const expected = { samplerLayout: ["grid", ...TILING_NAMES], samplerEdge: ["fill", "whole"], samplerIconMode: ["single", "pattern", "fractal", "mixed"] }[id];
      assert.deepStrictEqual(vals, expected, `ERROR: el selector ${id} no ofrece todas las opciones del motor.`);
    }

    const picked = { presets: new Set(), layouts: new Set(), edges: new Set(), modes: new Set(), shapes: new Set(), sets: new Set(), templates: new Set(), groups: new Set() };
    const samplerSeeds = [];
    for (let seed = 1; seed <= 1500; seed++) {
      const r = resolveRandomStyle(seed), again = resolveRandomStyle(seed);
      assert.strictEqual(JSON.stringify(r), JSON.stringify(again), "ERROR: el estilo aleatorio no es determinista.");
      picked.presets.add(r.presetName); picked.groups.add(r.group);
      const o = r.overrides, p = ZENTANGLE_PRESETS[r.presetName];
      if (r.group === "sampler") {
        picked.layouts.add(o.samplerLayout); picked.sets.add(o.samplerSet); picked.modes.add(o.samplerIconMode);
        if (o.samplerEdge) picked.edges.add(o.samplerEdge);
        if (o.samplerShape) picked.shapes.add(o.samplerShape);
        if (samplerSeeds.length < 120) samplerSeeds.push(seed);
      }
      if (p.cellLayout === "template") picked.templates.add(o.templateName || p.templateName);
      const cells = resolveRandomStyle(seed, { cellsOnly: true });
      assert.ok(!["sampler", "icon_mandala", "facet_spiral"].includes(ZENTANGLE_PRESETS[cells.presetName].cellLayout), "ERROR: cellsOnly devolvió un estilo que no es de celdas.");
    }
    for (const name of Object.keys(ZENTANGLE_PRESETS)) assert.ok(picked.presets.has(name), `ERROR: el modo aleatorio nunca sortea ${name} (1500 semillas).`);
    for (const l of ["grid", ...TILING_NAMES]) assert.ok(picked.layouts.has(l), `ERROR: el aleatorio nunca sortea la distribución ${l}.`);
    for (const e of ["fill", "whole"]) assert.ok(picked.edges.has(e), `ERROR: el aleatorio nunca sortea bordes ${e}.`);
    for (const m of ["single", "pattern", "fractal", "mixed"]) assert.ok(picked.modes.has(m), `ERROR: el aleatorio nunca sortea el modo de iconos ${m}.`);
    for (const sh of ["circle", "rounded", "square", "mixed"]) assert.ok(picked.shapes.has(sh), `ERROR: el aleatorio nunca sortea la forma ${sh}.`);
    for (const st of Object.keys(POOLS)) assert.ok(picked.sets.has(st), `ERROR: el aleatorio nunca sortea el conjunto ${st}.`);
    for (const t of Object.keys(LAYOUT_TEMPLATES)) assert.ok(picked.templates.has(t), `ERROR: el aleatorio nunca sortea la plantilla ${t}.`);
    for (const g of ["kdp", "classic", "template", "sampler", "figure"]) assert.ok(picked.groups.has(g), `ERROR: el aleatorio nunca sortea la familia ${g}.`);

    // Cada preset genera y se renderiza (resvg falló alguna vez con recortes vacíos).
    // En Node d3-delaunay no carga por https y el Voronoi cae a su versión simple:
    // se silencia ese aviso, que no es de lo que se prueba aquí.
    const realWarn = console.warn, realError = console.error;
    console.warn = () => {}; console.error = (...a) => { if (!/d3-delaunay/.test(String(a[0]))) realError(...a); };
    for (const name of Object.keys(ZENTANGLE_PRESETS)) {
      const d = { body: [], defs: [] };
      const used = await generateZentangle(d, { seed: 7, presetName: name, areaMm: area });
      const out = d.body.join("") + d.defs.join("");
      assert.strictEqual(used.presetName, name, `ERROR: ${name} reporta otro estilo (${used.presetName}).`);
      assert.ok(out.length > 800 && !/NaN|Infinity|undefined/.test(out), `ERROR: el preset ${name} no dibuja o produce coordenadas inválidas.`);
      new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 210 297"><defs>${d.defs.join("")}</defs>${d.body.join("")}</svg>`, { fitTo: { mode: "width", value: 160 } }).render();
    }

    console.warn = realWarn; console.error = realError;

    // Aleatorio: genera con el estilo sorteado, igual a pedir ese preset con esos overrides.
    for (const seed of [2, 11, 29, 53, 97, 131]) {
      const viaRandom = { body: [], defs: [] }, direct = { body: [], defs: [] };
      const used = await generateZentangle(viaRandom, { seed, presetName: RANDOM_STYLE_KEY, areaMm: area });
      const r = resolveRandomStyle(seed);
      await generateZentangle(direct, { seed, presetName: r.presetName, overrides: r.overrides, areaMm: area });
      assert.strictEqual(used.presetName, r.presetName, "ERROR: el aleatorio reporta un estilo distinto al sorteado.");
      assert.strictEqual(viaRandom.body.join("") + viaRandom.defs.join(""), direct.body.join("") + direct.defs.join(""), `ERROR: aleatorio(seed ${seed}) difiere del preset ${r.presetName} directo.`);
    }

    // Los overrides del llamador ganan sobre el sorteo.
    {
      const seed = samplerSeeds[0];
      const d = { body: [], defs: [] };
      await generateZentangle(d, { seed, presetName: RANDOM_STYLE_KEY, overrides: { samplerLayout: "cairo", samplerIconMode: "single" }, areaMm: area });
      assert.ok(/data-motif=/.test(d.body.join("")), "ERROR: el override del llamador rompió el aleatorio.");
    }

    // Aleatorio para colorear: nunca elige un estilo con tinta, sí elige todos los
    // demás, y sus páginas no tienen un solo relleno negro. La regla se contrasta
    // con los hechos: los presets excluidos son justo los que dibujan negro.
    {
      const safe = Object.keys(ZENTANGLE_PRESETS).filter((n) => isColoringSafe(ZENTANGLE_PRESETS[n]));
      const unsafe = Object.keys(ZENTANGLE_PRESETS).filter((n) => !safe.includes(n));
      assert.ok(unsafe.length >= 4 && safe.length >= 30, `ERROR: la clasificación de estilos para colorear es sospechosa (${safe.length} aptos / ${unsafe.length} con tinta).`);
      const gotColor = new Set(), gotGroups = new Set(), colorSampler = [];
      for (let seed = 1; seed <= 1500; seed++) {
        const r = resolveRandomStyle(seed, { coloringOnly: true });
        assert.ok(safe.includes(r.presetName), `ERROR: el aleatorio para colorear sorteó ${r.presetName}, que lleva tinta.`);
        assert.ok(r.group !== "sampler" || r.overrides.samplerSolids === false, "ERROR: un muestrario sorteado para colorear no fuerza samplerSolids=false.");
        gotColor.add(r.presetName); gotGroups.add(r.group);
        if (r.group === "sampler" && colorSampler.length < 25) colorSampler.push(seed);
      }
      for (const n of safe) assert.ok(gotColor.has(n), `ERROR: el aleatorio para colorear nunca sortea ${n}.`);
      for (const g of ["kdp", "classic", "template", "sampler", "figure"]) assert.ok(gotGroups.has(g), `ERROR: el aleatorio para colorear nunca sortea la familia ${g}.`);
      // Hechos: los estilos "con tinta" realmente dibujan negro y los aptos no.
      for (const n of Object.keys(ZENTANGLE_PRESETS)) {
        const d = { body: [], defs: [] };
        await generateZentangle(d, { seed: 5, presetName: n, areaMm: area });
        assert.strictEqual(/fill="#000"/.test(d.body.join("")), unsafe.includes(n), `ERROR: ${n} ${unsafe.includes(n) ? "no dibuja negro pero está marcado con tinta" : "dibuja negro pero está marcado apto para colorear"}.`);
      }
      // Páginas completas en modo colorear: sin negro, y con el mismo resultado que pedir el estilo directo.
      const pagesSeeds = [...colorSampler.slice(0, 10), 3, 8, 21, 34, 55, 89, 144, 233, 377, 610];
      for (const seed of pagesSeeds) {
        const d = { body: [], defs: [] };
        const used = await generateZentangle(d, { seed, presetName: RANDOM_COLOR_KEY, areaMm: area });
        assert.ok(safe.includes(used.presetName), `ERROR: aleatorio-colorear dibujó ${used.presetName}, que lleva tinta.`);
        assert.ok(!/fill="#000"/.test(d.body.join("")), `ERROR: aleatorio-colorear produjo un relleno negro (seed ${seed}, ${used.presetName}).`);
      }
      // cellsOnly y coloringOnly se combinan (imagen de fondo + libro de colorear).
      const both = resolveRandomStyle(9, { cellsOnly: true, coloringOnly: true });
      assert.ok(!["sampler", "icon_mandala", "facet_spiral"].includes(ZENTANGLE_PRESETS[both.presetName].cellLayout), "ERROR: cellsOnly + coloringOnly devolvió un estilo que no es de celdas.");
      console.log(`✓ Aleatorio para colorear: ${safe.length} estilos aptos sorteados, ${unsafe.length} con tinta excluidos (${unsafe.join(", ")}).`);
    }

    // Todos los motivos e iconos aparecen alguna vez en el aleatorio (páginas de muestrario).
    const seenMotifs = new Set();
    for (const seed of samplerSeeds) {
      const d = { body: [], defs: [] };
      await generateZentangle(d, { seed, presetName: RANDOM_STYLE_KEY, areaMm: area });
      for (const m of d.body.join("").matchAll(/data-motif="(\w+)"/g)) seenMotifs.add(m[1]);
    }
    for (const m of [...MOTIFS, ...ICONS]) assert.ok(seenMotifs.has(m.id), `ERROR: el motivo ${m.id} nunca sale en el aleatorio (${samplerSeeds.length} muestrarios).`);
    console.log(`✓ ${Object.keys(ZENTANGLE_PRESETS).length} estilos elegibles y sorteados (1500 semillas), ${picked.layouts.size} distribuciones, ${picked.modes.size} modos de iconos, ${MOTIFS.length + ICONS.length} motivos.`);

    console.log("\nPrueba 8: Plantillas (string) sin huecos, solapes ni celdas vacías...");
    // Cada plantilla es una partición: la suma de áreas es la página (antes
    // "eye" dejaba franjas sin cubrir y "spiral" apilaba un cuadro sobre otro).
    const rect = { x0: 0, y0: 0, x1: 190, y1: 254 };
    const shoelace = (p) => Math.abs(p.reduce((s, a, i) => { const b = p[(i + 1) % p.length]; return s + a.x * b.y - b.x * a.y; }, 0) / 2);
    for (const t of Object.keys(LAYOUT_TEMPLATES)) {
      for (let s = 1; s <= 5; s++) {
        const sum = getTemplateCells(t, rect, createRNG(s)).reduce((acc, c) => acc + shoelace(c.poly), 0);
        assert.ok(Math.abs(sum - 190 * 254) < 1, `ERROR: la plantilla ${t} no cubre la página exacta (área ${sum.toFixed(1)}).`);
      }
    }
    // Sin saltos probabilísticos, toda celda recibe patrón: un patrón que no
    // cabía (fillCircles en celdas gigantes) dejaba media página en blanco.
    for (const name of ["classic_z_string", "eye_focus", "classic_grid", "spiral_modern"]) {
      for (let i = 0; i < 20; i++) {
        const seed = (347387974 + Math.imul(i, 0x9e3779b1)) >>> 0;
        const d = { body: [], defs: [] };
        await generateZentangle(d, { seed, presetName: name, overrides: { patternSkipProb: 0 }, areaMm: area });
        const clips = d.defs.join("").match(/<clipPath id="[^"]*clip_\d+"/g) || [];
        const groups = d.body.join("").match(/<g clip-path="url\(#[^)]*clip_\d+\)"/g) || [];
        assert.strictEqual(groups.length, clips.length, `ERROR: ${name} seed ${seed} deja ${clips.length - groups.length} celda(s) vacía(s).`);
        assert.ok(clips.length >= 6, `ERROR: ${name} seed ${seed} tiene solo ${clips.length} regiones (la plantilla no se subdividió).`);
      }
    }
    console.log(`✓ ${Object.keys(LAYOUT_TEMPLATES).length} plantillas son particiones exactas; 80 páginas sin celdas vacías.`);

    console.log("\nPrueba 9: Más vendidos (estilos rentables, repartidos sin repetir)...");
    const deckTotal = BESTSELLERS.reduce((a, [, w]) => a + w, 0);
    for (const [k] of BESTSELLERS) {
      assert.ok(ZENTANGLE_PRESETS[k], `ERROR: Más vendidos incluye ${k}, que no existe.`);
      assert.ok(isColoringSafe(ZENTANGLE_PRESETS[k]), `ERROR: Más vendidos incluye ${k}, que tiene rellenos negros.`);
    }
    for (const bs of [1, 42, 347387974]) {
      const styles = Array.from({ length: deckTotal * 2 }, (_, i) => resolveBestSeller(0, { pageIndex: i, bookSeed: bs }).presetName);
      for (let i = 1; i < styles.length; i++) assert.notStrictEqual(styles[i], styles[i - 1], `ERROR: Más vendidos repite ${styles[i]} en las páginas ${i} y ${i + 1} (libro ${bs}).`);
      const first = styles.slice(0, deckTotal);
      for (const [k, w] of BESTSELLERS) assert.strictEqual(first.filter((x) => x === k).length, w, `ERROR: ${k} debería salir ${w} veces cada ${deckTotal} páginas (libro ${bs}).`);
    }
    // En el libro el estilo depende de la página, no de la semilla: ↻ Cambiar
    // (otra semilla, misma página) da otro diseño del mismo estilo.
    const dA = { body: [], defs: [] }, dB = { body: [], defs: [] };
    const uA = await generateZentangle(dA, { seed: 11, presetName: BESTSELLER_KEY, areaMm: area, pageIndex: 3, bookSeed: 42 });
    const uB = await generateZentangle(dB, { seed: 999, presetName: BESTSELLER_KEY, areaMm: area, pageIndex: 3, bookSeed: 42 });
    assert.strictEqual(uA.presetName, uB.presetName, "ERROR: cambiar una página de Más vendidos cambió su estilo.");
    assert.notStrictEqual(dA.body.join(""), dB.body.join(""), "ERROR: cambiar una página de Más vendidos no cambió el diseño.");
    assert.ok(!/fill="#000"/.test(dA.body.join("") + dB.body.join("")), "ERROR: Más vendidos dibujó rellenos negros.");
    const cellsOnlyPick = await generateZentangle({ body: [], defs: [] }, { seed: 5, presetName: BESTSELLER_KEY, areaMm: area, cellsOnly: true });
    assert.ok(!["sampler", "icon_mandala", "facet_spiral"].includes(ZENTANGLE_PRESETS[cellsOnlyPick.presetName].cellLayout), "ERROR: Más vendidos en modo imagen devolvió un estilo sin celdas.");
    console.log(`✓ ${BESTSELLERS.length} estilos rentables sin negros; proporciones exactas cada ${deckTotal} páginas y sin repeticiones seguidas.`);

    console.log("\nPrueba 10: Relleno de huecos vacíos (burbujas sin tocar líneas)...");
    {
      const { Resvg } = await import("@resvg/resvg-js");
      const PXMM = 4;
      const raster = async (svg, w) => { const r = new Resvg(svg, { fitTo: { mode: "width", value: w } }).render(); return { data: r.pixels, width: r.width, height: r.height }; };
      const inkOf = async (body, defs) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${area.x} ${area.y} ${area.w} ${area.h}"><defs>${defs.join("")}</defs><rect x="0" y="0" width="999" height="999" fill="#fff"/>${body.join("")}</svg>`;
        const r = await raster(svg, Math.round(area.w * PXMM));
        const ink = new Uint8Array(r.width * r.height);
        for (let i = 0; i < ink.length; i++) ink[i] = r.data[i * 4] < 160 ? 1 : 0;
        return { ink, w: r.width, h: r.height };
      };
      let filled = 0;
      for (const name of ["sampler_icons", "sampler_icon_fractal", "icon_mandala", "classic_z_string"]) {
        const a0 = { body: [], defs: [] }, a1 = { body: [], defs: [] };
        await generateZentangle(a0, { seed: 3, presetName: name, areaMm: area });
        await generateZentangle(a1, { seed: 3, presetName: name, areaMm: area, rasterize: raster });
        assert.strictEqual(a1.body.slice(0, a0.body.length).join(""), a0.body.join(""), `ERROR: el relleno de ${name} alteró el diseño original.`);
        const extra = a1.body.slice(a0.body.length);
        if (!extra.length) continue;
        filled++;
        assert.ok(extra.length === 1 && /data-filler="bubbles"/.test(extra[0]), `ERROR: el relleno de ${name} añadió algo inesperado.`);
        // Ninguna burbuja a menos de 1.2 mm de una línea del diseño (hueco pedido: 1.8 mm).
        const base = await inkOf(a0.body, a0.defs), bub = await inkOf(extra, []);
        const near = Math.round(1.2 * PXMM);
        for (let y = 0; y < bub.h; y += 1) for (let x = 0; x < bub.w; x += 1) {
          if (!bub.ink[y * bub.w + x]) continue;
          for (let dy = -near; dy <= near; dy++) for (let dx = -near; dx <= near; dx++) {
            if (dx * dx + dy * dy > near * near) continue;
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= base.w || yy >= base.h) continue;
            assert.ok(!base.ink[yy * base.w + xx], `ERROR: una burbuja de ${name} toca una línea del diseño en (${(x / PXMM).toFixed(1)}, ${(y / PXMM).toFixed(1)}) mm.`);
          }
        }
      }
      assert.ok(filled >= 3, "ERROR: el relleno de huecos no se aplicó en los estilos con espacio vacío.");
      const off = { body: [], defs: [] };
      await generateZentangle(off, { seed: 3, presetName: "sampler_icons", areaMm: area, rasterize: raster, overrides: { fillDeadSpace: false } });
      assert.ok(!/data-filler/.test(off.body.join("")), "ERROR: fillDeadSpace: false no desactivó el relleno.");
      console.log(`✓ Relleno aplicado en ${filled} estilos sin alterar el diseño ni acercarse a menos de 1.2 mm de una línea.`);
    }

    console.log("\nPrueba 11: Figura zentangle (figura grande con tangles clásicos)...");
    {
      const { Resvg } = await import("@resvg/resvg-js");
      const { FIGURE_IDS, figureForPage } = await import("./js/generators/figure.js");
      const { CLASSIC_TANGLES } = await import("./js/generators/patterns/classicTangles.js");
      const page = { x: 12.7, y: 12.7, w: 190.5, h: 254 };
      // Tinta por cuadrante del marco: un fondo o una figura que pierda media
      // página (recortes anidados que resvg descarta) deja un cuadrante vacío.
      const quadrantInk = (d) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 215.9 279.4"><defs>${d.defs.join("")}</defs><rect width="216" height="280" fill="#fff"/>${d.body.join("")}</svg>`;
        const img = new Resvg(svg, { fitTo: { mode: "width", value: 432 } }).render();
        const px = img.pixels, q = [0, 0, 0, 0], n = [0, 0, 0, 0];
        const s = img.width / 215.9;
        for (let y = Math.ceil(page.y * s) + 2; y < (page.y + page.h) * s - 2; y++) for (let x = Math.ceil(page.x * s) + 2; x < (page.x + page.w) * s - 2; x++) {
          const k = (x < (page.x + page.w / 2) * s ? 0 : 1) + (y < (page.y + page.h / 2) * s ? 0 : 2);
          n[k]++; if (px[(y * img.width + x) * 4] < 128) q[k]++;
        }
        return q.map((v, i) => v / n[i]);
      };
      for (const fig of FIGURE_IDS) {
        for (const bgKind of ["rays", "strings", "airy"]) {
          const opts = { seed: 11, presetName: "zen_figure", areaMm: page, overrides: { figureName: fig, figureBackground: bgKind } };
          const d1 = { body: [], defs: [] }, d2 = { body: [], defs: [] };
          await generateZentangle(d1, opts);
          await generateZentangle(d2, opts);
          const html = d1.body.join("");
          assert.strictEqual(html, d2.body.join(""), `ERROR: la figura ${fig} no es determinista.`);
          assert.ok(html.includes(`data-figure="${fig}"`), `ERROR: no se dibujó la figura ${fig}.`);
          assert.ok(!/fill="#000"/.test(html), `ERROR: la figura ${fig} tiene rellenos negros (no apta para colorear).`);
          const tangles = html.match(/data-tangle="[^"]+"/g) || [];
          assert.ok(tangles.length >= 6, `ERROR: la figura ${fig} (fondo ${bgKind}) tiene solo ${tangles.length} tangles.`);
          const ink = quadrantInk(d1);
          for (const v of ink) assert.ok(v > 0.04, `ERROR: la figura ${fig} (fondo ${bgKind}) deja un cuadrante casi vacío (tinta ${ink.map((x) => (x * 100).toFixed(1)).join("/")} %).`);
        }
      }
      // Cada tangle clásico produce líneas en cajas chicas y grandes.
      for (const t of CLASSIC_TANGLES) for (const side of [20, 120]) {
        const layers = t.fn(createRNG(5), { x0: 0, y0: 0, x1: side, y1: side * 0.8 }, { gap: 1.9, stroke: 0.35, sketchy: 0.3 });
        assert.ok(layers.some((l) => l.d && l.d.length > 40), `ERROR: el tangle ${t.id} quedó vacío en una caja de ${side} mm.`);
      }
      // En un libro, las figuras se recorren todas antes de repetir y nunca
      // sale la misma en dos páginas de figura seguidas.
      for (const bs of [1, 42]) {
        const seq = Array.from({ length: FIGURE_IDS.length * 3 }, (_, i) => figureForPage(bs, i));
        assert.strictEqual(new Set(seq.slice(0, FIGURE_IDS.length)).size, FIGURE_IDS.length, "ERROR: las primeras figuras del libro se repiten.");
        for (let i = 1; i < seq.length; i++) assert.notStrictEqual(seq[i], seq[i - 1], `ERROR: figura ${seq[i]} repetida en páginas de figura seguidas (libro ${bs}).`);
      }
      // Más vendidos: las páginas de figura de un libro llevan figuras distintas.
      const figs = [];
      for (let i = 0; i < 20; i++) {
        const r = resolveBestSeller(0, { pageIndex: i, bookSeed: 42 });
        if (ZENTANGLE_PRESETS[r.presetName].cellLayout !== "zen_figure") continue;
        const d = { body: [], defs: [] };
        await generateZentangle(d, { seed: 100 + i, presetName: BESTSELLER_KEY, areaMm: page, pageIndex: i, bookSeed: 42 });
        figs.push(d.body.join("").match(/data-figure="([^"]+)"/)[1]);
      }
      assert.ok(figs.length >= 6, "ERROR: Más vendidos tiene pocas páginas de figura.");
      assert.strictEqual(new Set(figs).size, Math.min(figs.length, FIGURE_IDS.length), `ERROR: Más vendidos repite figuras antes de agotarlas (${figs.join(", ")}).`);
      console.log(`✓ ${FIGURE_IDS.length} figuras × 3 fondos completas, sin negros y deterministas; ${CLASSIC_TANGLES.length} tangles clásicos; figuras sin repetir en el libro.`);
    }

    console.log("\nPrueba 12: Libro con dificultad progresiva, guía, dobles páginas y «Tu turno»...");
    {
      const { designUnits, planSequence, difficultyAt, kdpInsideMarginMm } = await import("./js/core/bookPlan.js");
      // Margen interior mínimo de KDP por número de páginas (pulgadas → mm).
      for (const [pages, mm] of [[24, 9.6], [150, 9.6], [151, 12.7], [300, 12.7], [301, 15.9], [500, 15.9], [700, 19.1], [828, 22.3]]) assert.strictEqual(kdpInsideMarginMm(pages), mm, `ERROR: margen interior KDP para ${pages} páginas.`);
      const { generateSpread } = await import("./js/generators/spread.js");
      const { TANGLE_INFO, tangleGuidePages, tanglePassportPage, footerSvg, levelInfo, tanglesInSvgs } = await import("./js/generators/bookExtras.js");
      const { Resvg } = await import("@resvg/resvg-js");
      const W = 215.9, H = 279.4, M = 12.7, page = { x: M, y: M, w: W - 2 * M, h: H - 2 * M };

      // Orden de páginas: en un libro de una cara cada diseño va a la derecha
      // con su reverso en blanco; la doble página ocupa izquierda + derecha y
      // sus dos reversos quedan en blanco.
      const units = designUnits(30, { spreads: true });
      assert.strictEqual(units.filter((u) => u.kind === "spread").length, 4, "ERROR: 30 diseños deberían llevar 4 dobles páginas.");
      assert.strictEqual(units[0].kind, "single", "ERROR: el libro no debe abrir con una doble página.");
      for (const blank of [true, false]) {
        const seq = planSequence(units, { blank, guidePages: 4, passport: true, turnPages: 2 });
        seq.forEach((e, k) => {
          if (!e) return;
          if (e.type === "spreadL") {
            assert.strictEqual(k % 2, 1, "ERROR: la mitad izquierda de una doble página no cae en página izquierda.");
            assert.deepStrictEqual(seq[k + 1], { type: "spreadR", i: e.i }, "ERROR: la doble página no sigue en la página de enfrente.");
            if (blank) assert.ok(seq[k - 1] === null && (seq[k + 2] === null || seq[k + 2] === undefined), "ERROR: el reverso de una doble página no está en blanco.");
          }
          if (blank && (e.type === "design" || e.type === "turn")) {
            assert.strictEqual(k % 2, 0, `ERROR: un diseño cae en página izquierda (página ${k + 1}).`);
            assert.ok(seq[k + 1] === null || seq[k + 1] === undefined, "ERROR: un diseño no tiene el reverso en blanco.");
          }
        });
        assert.strictEqual(seq.filter((e) => e && e.type === "design").length, 26, "ERROR: faltan diseños en la secuencia.");
        if (!blank) assert.ok(!seq.some((e) => e === null), "ERROR: el libro sin hojas en blanco tiene páginas en blanco.");
        assert.deepStrictEqual(seq.slice(0, 4).map((e) => e && e.type), ["guide", "guide", "guide", "guide"], "ERROR: la guía no abre el libro.");
      }

      // Dificultad: al final del libro hay más secciones con tangle y huecos más finos.
      assert.strictEqual(difficultyAt(0, 30), 0); assert.strictEqual(difficultyAt(29, 30), 1);
      assert.strictEqual(levelInfo(0).level, 1); assert.strictEqual(levelInfo(1).level, 5);
      let easy = 0, hard = 0;
      for (const seed of [1, 2, 3, 4]) for (const fig of ["owl", "cat", "heart"]) {
        for (const [d, add] of [[0, (v) => (easy += v)], [1, (v) => (hard += v)]]) {
          const doc = { body: [], defs: [] };
          await generateZentangle(doc, { seed, presetName: "zen_figure", areaMm: page, overrides: { figureName: fig, figureBackground: "airy", difficulty: d } });
          const figPart = doc.body.join("").split('data-figure="')[1];
          add((figPart.match(/data-tangle=/g) || []).length);
        }
      }
      assert.ok(hard > easy * 1.4, `ERROR: la dificultad no cambia la densidad (fácil ${easy}, difícil ${hard}).`);

      // «Tu turno»: la figura queda sin tangles, solo strings.
      const turn = { body: [], defs: [] };
      await generateZentangle(turn, { seed: 4, presetName: "zen_figure", areaMm: page, overrides: { figureName: "cat", emptySections: true } });
      const turnFig = turn.body.join("").split('data-figure="')[1];
      assert.ok(!/data-tangle=/.test(turnFig), "ERROR: «Tu turno» dejó tangles dentro de la figura.");

      // Doble página: dos SVG de una página cada uno; la figura continúa a
      // ambos lados del lomo (hay tinta junto al margen interior de las dos).
      const pageInk = (svg) => {
        const img = new Resvg(svg, { fitTo: { mode: "width", value: Math.round(W * 4) } }).render();
        return { px: img.pixels, w: img.width, h: img.height, s: img.width / W };
      };
      // Tinta en la franja [x0, x1] mm (coordenadas locales de la página).
      const inkNear = (pg, x0, x1) => {
        let ink = 0, n = 0;
        for (let y = Math.round((M + 5) * pg.s); y < (H - M - 5) * pg.s; y++) for (let x = Math.round(x0 * pg.s); x < x1 * pg.s; x++) { n++; if (pg.px[(y * pg.w + x) * 4] < 128) ink++; }
        return ink / n;
      };
      for (const fig of ["fish", "butterfly", "leaf", "heart"]) {
        // Segura: franja blanca en el lomo y un marco por página.
        const safe = await generateSpread({ paper: { w: W, h: H }, marginMm: M, seed: 9, figureName: fig });
        assert.ok(safe.left.includes(`viewBox="0 0 ${W} ${H}"`) && safe.right.includes(`viewBox="${W} 0 ${W} ${H}"`), `ERROR: la doble página (${fig}) no se partió en dos páginas.`);
        const SL = pageInk(safe.left), SR = pageInk(safe.right);
        assert.ok(inkNear(SL, W - M + 1, W - 1) < 0.001 && inkNear(SR, 1, M - 1) < 0.001, `ERROR: la doble página segura (${fig}) invade el margen interior.`);
        assert.ok(inkNear(SL, W - M - 6, W - M - 1.5) > 0.03 && inkNear(SR, M + 1.5, M + 6) > 0.03, `ERROR: la doble página segura (${fig}) no llega a su margen interior.`);
      }

      // Guía y pasaporte: 3 tangles por página, cada uno con nombre, pasos y
      // práctica; el pasaporte los lista todos.
      const ids = Object.keys(TANGLE_INFO);
      const geo = { w: W, h: H, m: M };
      const guide = tangleGuidePages(ids, geo);
      assert.strictEqual(guide.length, Math.ceil(ids.length / 3) + 2, "ERROR: número de páginas de la guía (introducción + fichas + «Combina»).");
      assert.ok(/Antes de empezar/.test(guide[0]) && /marca registrada de Zentangle/.test(guide[0]), "ERROR: falta la introducción con el origen y el crédito de la marca.");
      for (const id of ids) assert.ok(guide.join("").includes(TANGLE_INFO[id].combo.slice(0, 20).replace("'", "'")), `ERROR: falta cómo combinar ${id}.`);
      // Complejidad creciente: el nivel de cada ficha nunca baja respecto a la anterior.
      const order = [...guide.slice(1, -1).join("").matchAll(/font-size="5.2" font-weight="bold">([^<]+)</g)].map((mm) => mm[1]);
      const lvOf = (name) => Object.values(TANGLE_INFO).find((t) => t.name.replace("'", "&#39;") === name || t.name === name)?.level;
      for (let k = 1; k < order.length; k++) assert.ok(lvOf(order[k]) >= lvOf(order[k - 1]), `ERROR: la guía baja de nivel en ${order[k]}.`);
      assert.strictEqual(lvOf(order[0]), 1, "ERROR: la guía no empieza por un tangle básico.");
      assert.strictEqual(lvOf(order[order.length - 1]), 3, "ERROR: la guía no termina con un tangle avanzado.");
      assert.ok(/Combina/.test(guide[guide.length - 1]) && (guide[guide.length - 1].match(/Tu práctica/g) || []).length === 3, "ERROR: falta la página «Combina» con sus 3 prácticas.");
      const all = guide.join("");
      for (const id of ids) assert.ok(all.includes(TANGLE_INFO[id].name.replace("'", "'")), `ERROR: la guía no explica ${id}.`);
      assert.strictEqual((all.match(/Tu práctica/g) || []).length, ids.length + 3, "ERROR: falta un recuadro de práctica.");
      const pass = tanglePassportPage(ids, geo);
      for (const id of ids) assert.ok(pass.includes(TANGLE_INFO[id].name), `ERROR: el pasaporte no incluye ${id}.`);
      // Los pasos crecen: cada paso tiene más trazo que el anterior.
      const g0 = guide[1];
      const groups = [...g0.matchAll(/<g clip-path="url\(#g_0_0_(\d)\)">(.*?)<\/g>/g)].map((m) => m[2].length);
      assert.ok(groups[0] < groups[1] && groups[1] <= groups[2] && groups[2] <= groups[3], `ERROR: los pasos de la guía no crecen (${groups.join(", ")}).`);
      assert.deepStrictEqual(tanglesInSvgs(['<g data-tangle="paradox"/><g data-tangle="tipple"/><g data-tangle="paradox"/><g data-tangle="nope"/>']), ["paradox", "tipple"]);
      // Pie: dentro del margen inferior y nunca con margen < 10 mm.
      assert.ok(footerSvg(geo, { text: "Nivel 1", level: 1 }).includes("Nivel 1"));
      assert.strictEqual(footerSvg({ w: W, h: H, m: 8 }, { text: "x", level: 1 }), "");
      // Con margen justo (10 mm) el texto no baja de la zona segura de KDP (6.35 mm del corte).
      for (const m of [10, 11, 12.7, 20]) {
        const ys = [...footerSvg({ w: W, h: H, m }, { text: "Nivel 1", level: 1 }).matchAll(/<text[^>]* y="([\d.]+)"/g)].map((x) => Number(x[1]));
        assert.ok(ys.length && ys.every((y) => H - y >= 7.5), `ERROR: pie a menos de 7.5 mm del borde con margen ${m} mm.`);
      }
      // Lo que es solo de pantalla nunca llega a la página impresa.
      const { printSafeOpts } = await import("./js/core/bookPlan.js");
      const ps = printSafeOpts({ showSafeZone: true, paperTextureEnabled: true, cellShadowEnabled: true, seed: 5 });
      assert.deepStrictEqual([ps.showSafeZone, ps.paperTextureEnabled, ps.cellShadowEnabled, ps.seed], [false, false, false, 5]);
      console.log(`✓ Secuencia de páginas correcta, dificultad ${easy} → ${hard} tangles, «Tu turno» vacío, dobles páginas con franja segura, guía de ${guide.length} páginas y pasaporte.`);
    }

    console.log("\nPrueba 13: Propiedad intelectual (marca, nombres de patrones y ficha KDP)...");
    {
      const { TANGLE_INFO, tangleGuidePages, tanglePassportPage, footerSvg } = await import("./js/generators/bookExtras.js");
      const { kdpListing, kdpListingText, containsBlocked, ATTRIBUTION_ES } = await import("./js/core/kdpListing.js");
      const geo = { w: 215.9, h: 279.4, m: 12.7 };
      const ids = Object.keys(TANGLE_INFO);
      const printed = (svg) => [...svg.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map((mm) => mm[1]).join(" ");
      const guide = tangleGuidePages(ids, geo), pass = tanglePassportPage(ids, geo);
      // «Zentangle» solo en la página de introducción, siempre con ®, y con el
      // crédito de la marca y la aclaración de que no es un producto oficial.
      guide.slice(1).concat([pass]).forEach((svg) => assert.ok(!/zentangle/i.test(printed(svg)), "ERROR: «Zentangle» aparece fuera de la introducción."));
      const intro = printed(guide[0]);
      for (const mm of intro.matchAll(/Zentangle(?!, Inc)(.)/g)) assert.strictEqual(mm[1], "®", "ERROR: «Zentangle» sin ® en la introducción.");
      assert.ok(/marca registrada de Zentangle, Inc/.test(intro) && /no es un producto oficial/.test(intro) && /Rick Roberts y Maria Thomas/.test(intro), "ERROR: falta la atribución completa.");
      // Patrones de autor individual o sin verificar: nunca con su nombre de la comunidad.
      const all = guide.map(printed).join(" ") + printed(pass);
      for (const bad of ["Beadlines", "Purk", "Cubine", "Florz", "Scallops"]) assert.ok(!all.includes(bad), `ERROR: el libro imprime el nombre «${bad}».`);
      // La estrella de oficial solo en los verificados.
      assert.strictEqual(Object.values(TANGLE_INFO).filter((t) => t.official).length, 10);
      // Pies de página y «Tu turno» sin la marca.
      assert.ok(!/zentangle/i.test(footerSvg(geo, { text: "Tu turno: dibuja tus propios tangles en cada sección" })));
      // Ficha KDP: sin marcas en título, subtítulo ni palabras clave; atribución en la descripción.
      for (const flags of [{}, { progressive: true, guide: true }]) {
        const l = kdpListing({ designs: 50, pages: 120, flags, spreads: 6, turnPages: 2 });
        for (const t of [...l.titles, l.subtitle, ...l.keywords]) assert.strictEqual(containsBlocked(t), null, `ERROR: término de marca en la ficha: «${t}».`);
        assert.ok(l.description.includes(ATTRIBUTION_ES), "ERROR: falta la atribución en la descripción.");
        assert.ok(l.keywords.length <= 7, "ERROR: KDP admite 7 palabras clave.");
      }
      assert.ok(kdpListingText({ designs: 50, pages: 120 }).includes("REGLAS DE PROPIEDAD INTELECTUAL"));
      // Fichas por tema: sin marcas, 7 palabras clave y el tema en el título.
      const { THEME_LISTING } = await import("./js/core/kdpListing.js");
      const { BOOK_RECIPES, STYLE_THEME } = await import("./js/core/bookRecipes.js");
      const { ZENTANGLE_PRESETS: PR } = await import("./js/generators/zentangle.presets.js");
      for (const theme of Object.keys(THEME_LISTING)) {
        const l = kdpListing({ designs: 30, pages: 64, theme });
        for (const t of [...l.titles, l.subtitle, ...l.keywords]) assert.strictEqual(containsBlocked(t), null, `ERROR: marca en la ficha ${theme}: «${t}».`);
        assert.ok(l.keywords.length === 7 && l.keywords.every((k) => k.length <= 50), `ERROR: palabras clave de ${theme}.`);
        assert.ok(l.description.includes(ATTRIBUTION_ES));
      }
      assert.ok(/Dinosaurios/.test(kdpListing({ designs: 30, pages: 64, theme: "dino" }).titles[0]));
      for (const r of BOOK_RECIPES) assert.ok(PR[r.style] || r.style === "best_sellers", `ERROR: la receta ${r.id} usa un estilo inexistente.`);
      for (const k of Object.keys(STYLE_THEME)) assert.ok(PR[k] && THEME_LISTING[STYLE_THEME[k]], `ERROR: tema de ${k}.`);
      // Portada: 8.5×11 in, 120 págs en papel blanco → lomo 0.270 in; ancho 0.125+8.5+0.270+8.5+0.125.
      const { coverSpec } = await import("./js/core/kdpListing.js");
      const cv = coverSpec({ pages: 120, trimWmm: 215.9, trimHmm: 279.4 });
      assert.strictEqual(cv.spineIn, 0.27);
      assert.strictEqual(cv.widthIn, 17.52);
      assert.strictEqual(cv.heightIn, 11.25);
      assert.ok(cv.spineText && !coverSpec({ pages: 60, trimWmm: 215.9, trimHmm: 279.4 }).spineText, "ERROR: KDP solo admite texto en el lomo con más de 79 páginas.");
      assert.ok(coverSpec({ pages: 120, trimWmm: 215.9, trimHmm: 279.4, paper: "premium" }).spineIn > cv.spineIn);
      assert.ok(kdpListingText({ designs: 50, pages: 120, trimWmm: 215.9, trimHmm: 279.4 }).includes("Lomo: 0.27 in"));
      // La ficha no promete lo que el libro no trae.
      const figOnly = kdpListing({ designs: 30, pages: 60, content: "figures" }).description;
      assert.ok(!/mandalas/.test(figOnly), "ERROR: la ficha promete mandalas en un libro solo de figuras.");
      assert.ok(!/sin rellenos negros/.test(kdpListing({ designs: 30, pages: 60, noBlack: false }).description), "ERROR: la ficha promete «sin negros» en un libro con tinta.");
      assert.ok(/Impreso por una sola cara/.test(kdpListing({ designs: 30, pages: 60 }).description) && !/una sola cara/.test(kdpListing({ designs: 30, pages: 60, blank: false }).description));
      console.log("✓ Marca solo como atribución (con ®), patrones de autoría no verificada con nombre propio, ficha KDP sin marcas ajenas.");
    }

    console.log("\nPrueba 14: Defaults de solids y PRNG obligatorio...");
    {
      const { PathBuilder } = await import("./js/core/pathBuilder.js");
      assert.throws(() => new PathBuilder({ sketchy: 0 }), /rng/, "ERROR: PathBuilder aceptó trabajar sin PRNG sembrado.");
      const area14 = { x: 10, y: 10, w: 190, h: 260 };
      const blacks = async (presetName, samplerSolids) => {
        const d = { body: [], defs: [] };
        await generateZentangle(d, { seed: 3, presetName, areaMm: area14, overrides: { samplerSolids } });
        return (d.body.join("").match(/fill="#000"/g) || []).length;
      };
      // Sin definir, el muestrario pinta tinta y los ornamentos contorno; fijarlo en un test evita que un refactor los unifique sin querer.
      assert.ok(await blacks("sampler_icons", undefined) > 0, "ERROR: el muestrario sin samplerSolids ya no usa tinta por defecto.");
      assert.strictEqual(await blacks("sampler_icons", false), 0, "ERROR: samplerSolids:false dejó masas negras en el muestrario.");
      assert.strictEqual(await blacks("icon_mandala", undefined), 0, "ERROR: el mandala de iconos sin samplerSolids ya no es contorno por defecto.");
      assert.ok(await blacks("icon_mandala", true) > 0, "ERROR: samplerSolids:true no produjo tinta en el mandala de iconos.");
      console.log("✓ PathBuilder exige rng; defaults de solids: muestrario = tinta, ornamentos = contorno.");
    }

    console.log("\nPrueba 15: Contratos de salida de los patrones (string vs capas)...");
    {
      // Los rellenos del motor de celdas devuelven un string `d`; los motivos,
      // iconos y tangles clásicos devuelven capas [{ d, fill }]. Los dos motores
      // no se mezclan: figure.js adapta los primeros con legacy(). Si alguien
      // pasa un patrón de capas a la paleta de celdas, el SVG saldría con
      // d="[object Object]"; esta prueba lo caza en la frontera.
      const cellModules = await Promise.all(["geometric", "organic", "complex", "dense", "tangles"].map((m) => import(`./js/generators/patterns/${m}.js`)));
      const cellFns = cellModules.flatMap((mod) => Object.entries(mod).filter(([k, v]) => /^fill/.test(k) && typeof v === "function"));
      assert.ok(cellFns.length >= 20, `ERROR: solo se encontraron ${cellFns.length} rellenos de celda.`);
      const boxes = [{ x0: 0, y0: 0, x1: 42, y1: 42 }, { x0: 0, y0: 0, x1: 190, y1: 14 }, { x0: 0, y0: 0, x1: 18, y1: 80 }];
      let checkedCell = 0;
      for (const [name, fn] of cellFns) {
        for (const box of boxes) {
          const d = fn(createRNG(11), box, { minGapMm: 1.4, patternStrokeMm: 0.35, sketchy: 0.3, cellMm: 0 });
          assert.ok(d === undefined || d === null || d === "" || typeof d === "string", `ERROR: ${name} devolvió ${Array.isArray(d) ? "un array" : typeof d} en vez de un string d.`);
          if (d) assert.ok(!/NaN|Infinity|\[object/.test(d), `ERROR: ${name} produce un path inválido.`);
          checkedCell++;
        }
      }
      const { CLASSIC_TANGLES } = await import("./js/generators/patterns/classicTangles.js");
      const { FIGURE_TANGLES } = await import("./js/generators/figure.js");
      const layerFns = [
        ...CLASSIC_TANGLES.map((t) => ({ id: "classic:" + t.id, fn: t.fn, cfg: { gap: 1.7, stroke: 0.4, sketchy: 0 } })),
        ...FIGURE_TANGLES.map((t) => ({ id: "figura:" + t.id, fn: t.fn, cfg: { gap: 1.7, stroke: 0.4, sketchy: 0 } })),
        ...MOTIFS.map((t) => ({ id: "motivo:" + t.id, fn: t.fn, cfg: { minGapMm: 1.8, patternStrokeMm: 0.5, sketchy: 0, solids: false, inside: () => true } })),
        ...ICONS.map((t) => ({ id: "icono:" + t.id, fn: t.fn, cfg: { minGapMm: 1.8, patternStrokeMm: 0.5, sketchy: 0, solids: false, inside: () => true } })),
      ];
      let checkedLayers = 0;
      for (const { id, fn, cfg } of layerFns) {
        const out = fn(createRNG(11), { x0: 0, y0: 0, x1: 42, y1: 42 }, cfg);
        assert.ok(Array.isArray(out), `ERROR: ${id} debe devolver un array de capas, devolvió ${typeof out}.`);
        for (const layer of out) {
          assert.ok(layer && typeof layer === "object" && typeof layer.d === "string", `ERROR: ${id} devolvió una capa sin d de tipo string.`);
          assert.ok(["none", "#000", "#fff"].includes(layer.fill), `ERROR: ${id} devolvió una capa con fill inesperado «${layer.fill}».`);
        }
        checkedLayers++;
      }
      // El adaptador de figure.js convierte string → capas con relleno vacío (nunca negro).
      const adapted = FIGURE_TANGLES.find((t) => t.id === "cadent").fn(createRNG(11), { x0: 0, y0: 0, x1: 60, y1: 60 }, { gap: 1.7, stroke: 0.4, sketchy: 0 });
      assert.ok(Array.isArray(adapted) && adapted.length >= 1 && adapted.every((l) => l.fill === "none" && typeof l.d === "string"), "ERROR: el adaptador de figure.js no devolvió capas con fill none.");
      console.log(`✓ ${checkedCell} salidas de ${cellFns.length} rellenos de celda son string; ${checkedLayers} motores de capas devuelven [{ d, fill }].`);
    }

    console.log("\nPrueba 16: Secuencia de estilos de un libro aleatorio (sin vecinas repetidas)...");
    {
      const { randomBookSequence, resolveBookStyle } = await import("./js/generators/randomStyle.js");
      const { figureForPage } = await import("./js/generators/figure.js");
      const books = [1, 2, 7, 99, 2025, 123456789, 1147527462, 77777, 424242, 31337];
      let pages = 0;
      for (const mode of [RANDOM_STYLE_KEY, RANDOM_COLOR_KEY]) {
        for (const base of books) {
          const seq = randomBookSequence(mode, base, 60);
          const layoutOf = (e) => ZENTANGLE_PRESETS[e.presetName].cellLayout;
          const hexish = (e) => layoutOf(e) === "hex" || (e.overrides.samplerLayout || ZENTANGLE_PRESETS[e.presetName].samplerLayout) === "hex";
          for (let i = 1; i < seq.length; i++) {
            assert.notStrictEqual(seq[i].presetName, seq[i - 1].presetName, `ERROR: ${mode}@${base}: el estilo ${seq[i].presetName} se repite en las páginas ${i} y ${i + 1}.`);
            assert.notStrictEqual(layoutOf(seq[i]), layoutOf(seq[i - 1]), `ERROR: ${mode}@${base}: dos páginas seguidas con el layout ${layoutOf(seq[i])} (${i} y ${i + 1}).`);
            if (i >= 2) assert.ok(!(hexish(seq[i]) && hexish(seq[i - 1]) && hexish(seq[i - 2])), `ERROR: ${mode}@${base}: tres páginas hexagonales seguidas en ${i - 1}-${i + 1}.`);
          }
          // Las figuras de un libro recorren su lista sin repetir hasta agotarla.
          const figs = seq.filter((e) => layoutOf(e) === "zen_figure").map((e) => figureForPage(base, e.overrides.figurePage));
          assert.strictEqual(new Set(figs.slice(0, 8)).size, Math.min(8, figs.length), `ERROR: ${mode}@${base}: una figura se repite antes de agotar las ocho.`);
          // random_color nunca produce rellenos negros.
          if (mode === RANDOM_COLOR_KEY) assert.ok(seq.every((e) => isColoringSafe({ ...ZENTANGLE_PRESETS[e.presetName], ...e.overrides })), `ERROR: random_color@${base} incluyó un estilo con tinta.`);
          // La secuencia depende solo de la semilla del libro: un libro corto es el prefijo de uno largo,
          // y resolveBookStyle devuelve la misma entrada pida la página que la pida.
          assert.deepStrictEqual(randomBookSequence(mode, base, 20), seq.slice(0, 20), `ERROR: ${mode}@${base}: la secuencia no es un prefijo estable.`);
          for (const i of [0, 17, 59]) assert.deepStrictEqual(resolveBookStyle(mode, 12345, { pageIndex: i, bookSeed: base }), seq[i], `ERROR: ${mode}@${base}: resolveBookStyle(${i}) no coincide con la secuencia.`);
          pages += seq.length;
        }
      }
      // Sin pageIndex (galería, «Otro diseño», un ↻) se sortea con la semilla de la página, como antes.
      assert.deepStrictEqual(resolveBookStyle(RANDOM_COLOR_KEY, 4242), resolveRandomStyle(4242, { coloringOnly: true }), "ERROR: sin pageIndex el modo aleatorio ya no sortea con la semilla.");
      console.log(`✓ ${pages} páginas en 20 libros: sin estilo ni layout repetido en vecinas, sin 3 hexagonales seguidas, figuras sin repetir y secuencia estable.`);
    }

    console.log("\nPrueba 17: Semilla por celda (esquema 2) frente al flujo compartido (esquema 1)...");
    {
      const area17 = { x: 10, y: 10, w: 190, h: 260 };
      const run = async (scheme, family) => {
        const d = { body: [], defs: [] };
        await generateZentangle(d, { seed: 21, presetName: "editorial_airy", areaMm: area17, overrides: { flowLinesEnabled: true, patternFamily: family, ...(scheme ? { seedScheme: scheme } : {}) } });
        const body = d.body.join("");
        return { body, flow: (body.match(/<path d="[^"]+"[^>]*stroke-dasharray="3,3"[^>]*\/>/g) || []).join("|") };
      };
      // Las líneas de flujo se dibujan tras las celdas con el rng de la página. Con el esquema 2 las
      // celdas no lo consumen, así que no dependen de qué tangles se dibujaron; con el 1 sí.
      const [g2, o2, g1, o1, def] = [await run(2, "geometric"), await run(2, "organic"), await run(1, "geometric"), await run(1, "organic"), await run(0, "geometric")];
      assert.ok(g2.flow && g1.flow, "ERROR: no se dibujaron las líneas de flujo de la prueba.");
      assert.strictEqual(g2.flow, o2.flow, "ERROR: con el esquema 2 las celdas siguen consumiendo el rng de la página.");
      assert.notStrictEqual(g1.flow, o1.flow, "ERROR: el esquema 1 ya no comparte el flujo de la página (los libros antiguos no se reproducirían).");
      assert.notStrictEqual(g2.body, g1.body, "ERROR: los esquemas 1 y 2 producen la misma página.");
      assert.strictEqual(def.body, g2.body, "ERROR: el esquema por defecto ya no es el 2.");
      console.log("✓ Esquema 2 por defecto: celdas con flujo propio (no reordenan la página); esquema 1 reproduce el flujo compartido.");
    }

    console.log("\nPrueba 18: Compuerta de colorabilidad por relleno de celda...");
    {
      // Cada relleno del motor se dibuja dentro de cinco formas de celda (cuadrada, banda, tira,
      // triángulo y hexágono) con los giros que usa el motor, y se cuentan las regiones blancas visibles que no
      // caben una punta de marcador. Casi todas son astillas donde la rejilla del relleno corta el borde
      // de la celda. Detalle por patrón: npm run audit:patterns.
      const { CELL_PATTERNS, SHAPES, auditPattern, rotationsFor, drawnIn } = await import("./_samples/patternAudit.mjs");
      const DEFAULT_CEIL = 6;
      // Casos conocidos (media de regiones malas por celda) con su techo; lo demás debe quedar en DEFAULT_CEIL.
      // Son rellenos de líneas o de curvas cortados por los bordes oblicuos de un hexágono, y otros giros de Printemps.
      const KNOWN = { "fillCurvesSmooth@hexagono": 17, "fillStripesSmooth@hexagono": 16, "fillFlorz@hexagono": 15, "fillScallops@hexagono": 13, "fillParadox@hexagono": 13, "fillCircles@hexagono": 12, "fillPrintemps@triangulo": 12, "fillAura@hexagono": 10, "fillCrescentMoon@cuadrada": 10 };
      let total = 0, pairs = 0;
      const mean = {};
      for (const [name, fn] of CELL_PATTERNS) {
        for (const shape of Object.keys(SHAPES)) {
          if (!drawnIn(fn, shape)) continue; // el motor no dibuja ese relleno en esa celda
          const rs = rotationsFor(fn).map((rot) => auditPattern(fn, shape, 11, {}, rot));
          const bad = rs.reduce((a, x) => a + x.bad, 0) / rs.length;
          mean[`${name}@${shape}`] = bad;
          total += bad; pairs++;
          assert.ok(bad <= (KNOWN[`${name}@${shape}`] ?? DEFAULT_CEIL), `ERROR: ${name} en celda ${shape} deja ${bad.toFixed(1)} regiones no coloreables de media (techo ${KNOWN[`${name}@${shape}`] ?? DEFAULT_CEIL}). Mira npm run audit:patterns.`);
        }
      }
      // Las correcciones de astillas en el borde de la celda (Cadent, Scallops, Triangles, Flow, Printemps) no se pierden.
      for (const shape of ["cuadrada", "banda", "tira"]) {
        for (const [name, ceil] of [["fillCadent", 2], ["fillScallops", 3], ["fillTriangles", 1], ["fillFlow", 3], ["fillPrintemps", 6]]) assert.ok(mean[`${name}@${shape}`] <= ceil, `ERROR: ${name} vuelve a dejar astillas en celdas ${shape} (${mean[`${name}@${shape}`].toFixed(1)} > ${ceil}).`);
      }
      assert.ok(total <= 250, `ERROR: la suma de regiones no coloreables subió a ${total.toFixed(0)} (referencia 197, techo 250).`);
      console.log(`✓ ${pairs} combinaciones relleno × celda bajo su techo; suma ${total.toFixed(0)} regiones no coloreables (techo 250).`);
    }

    console.log("\nPrueba 19: Control de calidad por página y variedad de figuras...");
    {
      const { analyzeColorability, qualityVerdict, QUALITY_LIMITS } = await import("./js/core/pageQuality.js");
      // Raster sintético 100×100 px a 10 px/mm: fondo blanco, un marco negro y,
      // dentro, una ranura de 0.4 mm (no coloreable) y un cuadro de 4×4 mm (sí).
      const w = 100, h = 100, px = 10, data = new Uint8ClampedArray(w * h * 4).fill(255);
      const ink = (x0, y0, x1, y1) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) data.fill(0, (y * w + x) * 4, (y * w + x) * 4 + 3); };
      ink(0, 0, 100, 2); ink(0, 98, 100, 100); ink(0, 0, 2, 100); ink(98, 0, 100, 100); // marco
      ink(10, 10, 60, 12); ink(10, 16, 60, 18); ink(10, 10, 12, 18); ink(58, 10, 60, 18); // ranura de 4 px = 0.4 mm
      ink(10, 30, 54, 32); ink(10, 72, 54, 74); ink(10, 30, 12, 74); ink(52, 30, 54, 74); // cuadro de 4 mm
      const q = analyzeColorability({ data, width: w, height: h }, px, { mark: true });
      assert.strictEqual(q.bad, 1, `ERROR: la ranura de 0.4 mm debía contar como 1 zona difícil (contó ${q.bad}).`);
      assert.ok(q.mask[(13 * w + 30)] === 1 && q.mask[(50 * w + 30)] === 0, "ERROR: la máscara no marca solo la ranura.");
      // El límite escala con el área del dibujo: Letter con margen 12.7 mm ≈ 63 zonas.
      const letterArt = (215.9 - 25.4) * (279.4 - 25.4);
      const v = qualityVerdict({ bad: 70, ink: 12 }, letterArt);
      assert.ok(!v.ok && v.maxBad === Math.round(QUALITY_LIMITS.badPerDm2 * letterArt / 10000) && v.maxBad > 55 && v.maxBad < 70);
      assert.ok(qualityVerdict({ bad: 10, ink: 12 }, letterArt).ok);
      assert.ok(!qualityVerdict({ bad: 10, ink: 40 }, letterArt).ok, "ERROR: una página casi negra debe marcarse.");
      assert.ok(qualityVerdict({ bad: 70, ink: 12 }, letterArt * 2).ok, "ERROR: una doble página admite el doble de zonas.");

      // Variedad: paletas de 8 tangles por página de figura, que cubren todos en 3 páginas.
      const { figurePalette, figureForPage, FIGURE_TANGLES, FIGURE_PALETTE_SIZE, ADULT_FIGURES: FIGURE_IDS } = await import("./js/generators/figure.js");
      const all = new Set(FIGURE_TANGLES.map((t) => t.id));
      const p0 = figurePalette(42, 0), p1 = figurePalette(42, 1);
      assert.strictEqual(new Set(p0).size, FIGURE_PALETTE_SIZE);
      assert.ok(p0.every((t) => all.has(t)));
      assert.notDeepStrictEqual(p0, p1);
      assert.strictEqual(new Set([0, 1, 2].flatMap((n) => figurePalette(42, n))).size, all.size, "ERROR: 3 páginas de figura no recorren todos los tangles.");
      assert.deepStrictEqual(figurePalette(42, 5), figurePalette(42, 5));
      // En un libro la figura usa su paleta y, en su segunda aparición, va en espejo.
      const { generateZentangle } = await import("./js/generators/zentangle.generator.js");
      const { createSvgDoc } = await import("./js/core/svgDoc.js");
      const { renderSvgToString } = await import("./js/core/svgRender.js");
      const { tanglesInSvgs } = await import("./js/generators/bookExtras.js");
      const fig = async (pageIndex) => {
        const d = createSvgDoc({ wMm: 215.9, hMm: 279.4, meta: { seed: 9 } });
        await generateZentangle(d, { seed: 9 + pageIndex, presetName: "zen_figure", overrides: {}, areaMm: { x: 12.7, y: 12.7, w: 190.5, h: 254 }, pageIndex, bookSeed: 42 });
        return renderSvgToString(d);
      };
      const L = FIGURE_IDS.length;
      const repeatAt = L + [...Array(L).keys()].find((k) => figureForPage(42, L + k, FIGURE_IDS) === figureForPage(42, 0, FIGURE_IDS));
      const first = await fig(0), again = await fig(repeatAt);
      const pal = new Set(figurePalette(42, 0));
      const used = tanglesInSvgs([first]).filter((t) => all.has(t));
      // Fuera de la paleta solo el respaldo de un grupo con menos de 3 (fondo o detalle).
      assert.ok(used.length >= 4 && used.filter((t) => !pal.has(t)).length <= 2, `ERROR: la figura usa tangles fuera de su paleta (${used.join(", ")}).`);
      // El espejo de página es un elemento propio del cuerpo (va seguido de salto de línea).
      const pageMirror = /scale\(-1 1\)">\n/;
      assert.ok(!pageMirror.test(first), "ERROR: la primera aparición de la figura no debe ir en espejo.");
      assert.ok(pageMirror.test(again) && (again.match(/data-figure="([^"]+)"/) || [])[1] === (first.match(/data-figure="([^"]+)"/) || [])[1], "ERROR: la figura repetida no va en espejo.");
      // La mezcla «Más vendidos» ya no usa el muestrario de iconos fractales.
      const { BESTSELLERS } = await import("./js/generators/randomStyle.js");
      assert.ok(!BESTSELLERS.some(([k]) => k === "sampler_icon_fractal") && BESTSELLERS.reduce((a, [, w]) => a + w, 0) === 20);
      console.log(`✓ Calidad por página (zonas difíciles, tinta, límite por área) y figuras con paleta propia de ${FIGURE_PALETTE_SIZE} tangles, en espejo al repetirse.`);
    }

    console.log("\nPrueba 20: Repertorio ampliado (figuras, iconos, facetado y vitral)...");
    {
      const { FIGURE_IDS } = await import("./js/generators/figure.js");
      const { ICONS } = await import("./js/generators/patterns/icons.js");
      assert.ok(FIGURE_IDS.length >= 20, `ERROR: el repertorio bajó a ${FIGURE_IDS.length} figuras.`);
      assert.ok(ICONS.length >= 22, `ERROR: el repertorio bajó a ${ICONS.length} iconos.`);
      const { Resvg } = await import("@resvg/resvg-js");
      const { analyzeColorability } = await import("./js/core/pageQuality.js");
      const page = { x: 12.7, y: 12.7, w: 190.5, h: 254 };
      const bad = {};
      for (const preset of ["zen_figure_facet", "zen_figure_glass"]) {
        let tot = 0;
        for (const fig of FIGURE_IDS) {
          const run = async () => { const d = { body: [], defs: [] }; await generateZentangle(d, { seed: 21, presetName: preset, areaMm: page, overrides: { figureName: fig } }); return d; };
          const d1 = await run(), d2 = await run(), html = d1.body.join("");
          assert.strictEqual(html, d2.body.join(""), `ERROR: ${preset}/${fig} no es determinista.`);
          assert.ok(html.includes(`data-figure="${fig}"`) && !/fill="#000"/.test(html), `ERROR: ${preset}/${fig} sin figura o con negros.`);
          const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 215.9 279.4"><defs>${d1.defs.join("")}</defs><rect width="216" height="280" fill="#fff"/>${html}</svg>`;
          const img = new Resvg(svg, { fitTo: { mode: "width", value: 216 * 5 } }).render();
          tot += analyzeColorability({ data: img.pixels, width: img.width, height: img.height }, 5).bad;
        }
        bad[preset] = tot / FIGURE_IDS.length;
      }
      // Vitral y facetado tienen piezas grandes: menos zonas difíciles que la figura con strings (~50).
      assert.ok(bad.zen_figure_glass < 25 && bad.zen_figure_facet < 45, `ERROR: zonas difíciles de media: facetado ${bad.zen_figure_facet.toFixed(1)}, vitral ${bad.zen_figure_glass.toFixed(1)}.`);
      // Figura zentangle con relleno rico y figuras escondidas: el margen
      // blanco junto a cuerdas, auras y marco mantiene las astillas a raya.
      let tot = 0, hidden = 0, nested = 0;
      for (const fig of FIGURE_IDS) {
        const d = { body: [], defs: [] };
        await generateZentangle(d, { seed: 21, presetName: "zen_figure", areaMm: page, overrides: { figureName: fig } });
        const html = d.body.join("");
        hidden += (html.match(/data-hidden="/g) || []).length;
        if (html.includes(`data-hidden="${fig}"`)) nested++;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 215.9 279.4"><defs>${d.defs.join("")}</defs><rect width="216" height="280" fill="#fff"/>${html}</svg>`;
        const img = new Resvg(svg, { fitTo: { mode: "width", value: 216 * 5 } }).render();
        const qa = analyzeColorability({ data: img.pixels, width: img.width, height: img.height }, 5, { inner: { x0: 74, y0: 74, x1: 1006, y1: 1323 } });
        tot += qa.bad;
        // Sin huecos vacíos grandes: el mayor círculo blanco del dibujo < 15 mm de radio.
        assert.ok(qa.blankMm < 15, `ERROR: ${fig} deja un hueco vacío de ${qa.blankMm.toFixed(1)} mm de radio.`);
      }
      bad.zen_figure = tot / FIGURE_IDS.length;
      assert.ok(bad.zen_figure < 40, `ERROR: la figura zentangle sube a ${bad.zen_figure.toFixed(1)} zonas difíciles de media (techo 40).`);
      assert.ok(hidden >= FIGURE_IDS.length * 2 && nested >= 15, `ERROR: pocas figuras escondidas (${hidden} en total, ${nested} dentro de su figura).`);
      // Repertorio por estilo: adulto (y abstracto) frente a infantil, en libro.
      const { FIGURE_SETS } = await import("./js/generators/figure.js");
      for (const [preset, allowed] of [["zen_figure", [...FIGURE_SETS.adult, ...FIGURE_SETS.abstract]], ["zen_figure_glass", [...FIGURE_SETS.adult, ...FIGURE_SETS.abstract]], ["zen_figure_kids", FIGURE_SETS.kids], ["zen_figure_dino", [...FIGURE_SETS.dino, ...FIGURE_SETS.dinoOrigamiMix]], ["zen_figure_dino_origami", FIGURE_SETS.dinoOrigami], ["zen_figure_bio", FIGURE_SETS.bio], ["zen_figure_cryptids", FIGURE_SETS.cryptids]]) {
        const seen = new Set();
        for (let i = 0; i < 24; i++) {
          const d = { body: [], defs: [] };
          await generateZentangle(d, { seed: 100 + i, presetName: preset, areaMm: page, pageIndex: i, bookSeed: 7, overrides: { richFill: false } });
          seen.add((d.body.join("").match(/data-figure="([^"]+)"/) || [])[1]);
        }
        for (const f of seen) assert.ok(allowed.includes(f), `ERROR: ${preset} sacó la figura ${f}, que no es de su repertorio.`);
        assert.ok(seen.size >= Math.min(14, allowed.length), `ERROR: ${preset} solo usó ${seen.size} figuras en 24 páginas.`);
      }
      const turn = { body: [], defs: [] };
      await generateZentangle(turn, { seed: 4, presetName: "zen_figure", areaMm: page, overrides: { figureName: "cat", emptySections: true } });
      assert.ok(!turn.body.join("").includes("data-hidden"), "ERROR: «Tu turno» no debe llevar figuras escondidas.");
      console.log(`✓ ${FIGURE_IDS.length} figuras y ${ICONS.length} iconos; zonas difíciles de media: zentangle ${bad.zen_figure.toFixed(0)}, facetado ${bad.zen_figure_facet.toFixed(0)}, vitral ${bad.zen_figure_glass.toFixed(0)}; ${hidden} figuras escondidas (${nested} dentro de su figura).`);
    }

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

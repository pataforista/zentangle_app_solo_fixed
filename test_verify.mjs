import assert from "assert";
import { generateZentangleCells } from "./js/generators/zentangleCells.js";
import { generateZentangle } from "./js/generators/zentangle.generator.js";
import { ZENTANGLE_PRESETS } from "./js/generators/zentangle.presets.js";
import { MOTIFS } from "./js/generators/patterns/motifs.js";
import { ICONS } from "./js/generators/patterns/icons.js";
import { createRNG } from "./js/core/prng.js";
import { RANDOM_STYLE_KEY, RANDOM_COLOR_KEY, resolveRandomStyle, isColoringSafe } from "./js/generators/randomStyle.js";
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
    for (const v of menuValues) assert.ok(v === RANDOM_STYLE_KEY || v === RANDOM_COLOR_KEY || ZENTANGLE_PRESETS[v], `ERROR: el menú ofrece ${v}, que no existe.`);
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

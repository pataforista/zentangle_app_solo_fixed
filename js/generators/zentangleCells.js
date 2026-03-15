// zentangleCells.js
import { createRNG, rFloat, rInt, pick } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";
import { LAYOUT_TEMPLATES, getTemplateCells } from "./layoutTemplates.js";

import {
  fillConcentricSquares, fillAuraSquares, fillCrosses, fillTriangles, fillAura, fillCircuit
} from "./patterns/geometric.js";
import { fillStripesSmooth, fillCircles, fillCurvesSmooth, fillScallops, fillSpiralBands, fillFlow, fillWaves } from "./patterns/organic.js";
import { fillParadox, fillHollibaugh, fillFlux } from "./patterns/complex.js";
import { fillStippling, fillPokerChips } from "./patterns/dense.js";

/**
 * Zentangle Cells — v5 (integrated)
 * - Soporta: rect_bsp (antes), hex, tri
 * - ClipPath geométrico por celda (sin micro-huecos)
 * - Borde orgánico interno opcional (look "mano" sin romper el clip)
 * - Anti-saturación (whiteSpaceMm, patternSkipProb, maxPatternPassesPerCell)
 *
 * Requisito: doc = { body: [], defs?: [] }
 */
export async function generateZentangleCells(doc, opts) {
  const {
    seed,
    areaMm,

    // Layout
    cellLayout = "rect_bsp",     // "rect_bsp" | "hex" | "tri"
    cellCount = 30,             // solo rect_bsp
    minCellSizeMm = 14,         // solo rect_bsp
    hexRadiusMm = 12,           // solo hex
    triSideMm = 22,             // solo tri

    // Jerarquía de línea (mm)
    cellBorderWidthMm = 0.75,
    patternStrokeMm = 0.35,
    minStrokeMm = 0.28,

    // Coloreabilidad
    minGapMm = 1.4,

    // Composición
    drawOuterBorder = true,
    layersPerCell = "auto",

    // Rotación
    rotatePatterns = true,
    rotationSet = "ergonomic",
    innerMarginMm = 0.7,
    extraMarginWhenRotatedMm = 0.35,

    // Anti-saturación
    whiteSpaceMm = 1.0,
    maxPatternPassesPerCell = 2,
    patternSkipProb = 0.18,

    // Draw-behind
    enableDrawBehind = true,
    drawBehindProbability = 0.55,
    allowDrawBehindOnLayer2 = false,

    // Bordes orgánicos internos
    innerOrganicBorderEnabled = true,
    innerOrganicBorderInsetMm = 0.8,
    innerOrganicJitterMm = 0.55,
    innerOrganicRoundMm = 1.0,

    // Clip orgánico real (solo rect): más riesgo de micro-espacios; por defecto false
    organicBorder = false,

    // New: Styles
    sketchy = 0,
  } = opts;

  const rng = createRNG(seed >>> 0);
  const renderPrefix = `z_${Math.floor(Math.random() * 1000000).toString(16)}_`;

  // Pisos técnicos
  const cellStroke = Math.max(minStrokeMm, cellBorderWidthMm);
  const patStroke = Math.max(minStrokeMm, patternStrokeMm);

  const cfg = {
    minStrokeMm,
    minGapMm: Math.max(0.9, minGapMm),
    patternStrokeMm: patStroke,
    sketchy
  };

  const baseRect = {
    x0: areaMm.x, y0: areaMm.y,
    x1: areaMm.x + areaMm.w, y1: areaMm.y + areaMm.h,
  };

  // 1) Generar celdas (rect o polígonos)
  const cells = _makeCells(rng, baseRect, {
    cellLayout,
    cellCount,
    minCellSizeMm,
    hexRadiusMm,
    triSideMm,
  });

  // 2) Outer border
  if (drawOuterBorder) {
    const outer = new PathBuilder({ sketchy, rng });
    _addRectToBuilder(outer, baseRect);
    doc.body.push(outer.toPath({
      stroke: "#000",
      strokeWidthMm: cellStroke,
      fill: "none",
      linecap: "round",
      linejoin: "round",
    }));
  }

  // 3) Fondo con textura de papel (para look premium)
  doc.body.push(`<rect x="${baseRect.x0}" y="${baseRect.y0}" width="${areaMm.w}" height="${areaMm.h}" 
    fill="white" filter="url(#${renderPrefix}paperTexture)" pointer-events="none" />`);

  // 4) Patrones disponibles por "Familias" para reducir caos
  const families = {
    geometric: [fillConcentricSquares, fillAuraSquares, fillCrosses, fillTriangles, fillAura, fillCircuit],
    organic: [fillStripesSmooth, fillCircles, fillCurvesSmooth, fillScallops, fillSpiralBands, fillFlow, fillAura, fillWaves],
    dense: [fillStippling, fillAuraSquares, fillConcentricSquares, fillParadox, fillHollibaugh, fillFlux, fillTriangles]
  };

  const familyKey = opts.patternFamily || (rng() < 0.5 ? "geometric" : "organic");
  const patterns = families[familyKey] || [...families.geometric, ...families.organic];

  // Jerarquía de línea: Bordes/Strings claramente más gruesos
  const borderMultiplier = opts.borderStrokeMultiplier || 1.45;
  const borderStroke = cellStroke * borderMultiplier;

  // 5) Defs bucket (seguro)
  const useDocDefs = Array.isArray(doc.defs);
  const localDefs = [];
  const pushDef = (s) => { if (useDocDefs) doc.defs.push(s); else localDefs.push(s); };

  // 2) Dibujar cada celda
  for (let i = 0; i < cells.length; i++) {
    // Yield every 3 cells to keep UI responsive
    if (i > 0 && i % 3 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
    const cell = cells[i];

    const rot = _pickRotation(rng, rotatePatterns, rotationSet);
    const margin = innerMarginMm + (rot !== 0 ? extraMarginWhenRotatedMm : 0);

    // Aire editorial: shrink bbox + whiteSpace
    const box = _shrinkRect(cell.bbox, margin + Math.max(0, whiteSpaceMm));
    if (!_isValidRect(box)) continue;

    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    const minDim = Math.min(w, h);

    // --- Grafitado (Graphite Shading) ---
    const shadowId = `${renderPrefix}shadow_${i}`;
    const clipId = `${renderPrefix}clip_${i}`;
    let clipD = "";
    pushDef(`
      <filter id="${shadowId}" x="-30%" y="-30%" width="160%" height="160%">
        <!-- Base Shadow -->
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" result="blur" />
        <feOffset in="blur" dx="0.6" dy="0.6" result="offsetBlur" />
        
        <!-- Grain / Graphite Texture -->
        <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="grain" />
        <feComposite in="offsetBlur" in2="grain" operator="arithmetic" k1="0.4" k2="0.6" k3="0" k4="0" result="texturedShadow" />

        <feComponentTransfer in="texturedShadow" result="finalShadow">
          <feFuncA type="linear" slope="0.35" />
        </feComponentTransfer>
        <feComposite in="SourceGraphic" in2="finalShadow" operator="over" />
      </filter>
    `);

    // --- Textura de Papel (Premium) ---
    pushDef(`
      <filter id="${renderPrefix}paperTexture" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.03 0.04" numOctaves="5" result="noise" />
        <feDiffuseLighting in="noise" lighting-color="#fff" surfaceScale="1.5" result="light">
          <feDistantLight azimuth="45" elevation="65" />
        </feDiffuseLighting>
        
        <!-- Subtle tooth for the paper -->
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" result="tooth" />
        <feComponentTransfer in="tooth" result="toothAlpha">
          <feFuncA type="linear" slope="0.1" />
        </feComponentTransfer>
        <feComposite in="light" in2="toothAlpha" operator="arithmetic" k1="0" k2="1" k3="0.1" k4="0" result="finalPaper" />

        <feComposite in="SourceGraphic" in2="finalPaper" operator="arithmetic" k1="0" k2="1" k3="0.15" k4="0" />
      </filter>
    `);

    if (cell.kind === "rect") {
      if (organicBorder) {
        // Clip orgánico real (rect): opcional
        const cornerR = Math.min(3.2, Math.max(1.4, minDim * 0.10));
        const bulge = Math.min(2.4, Math.max(0.7, minDim * 0.06));
        const lumps = (minDim < 22) ? 1 : (rng() < 0.55 ? 2 : 1);
        clipD = _organicRectD(rng, box, { cornerR, bulge, lumps });
      } else {
        clipD = _rectPathD(box);
      }

      // Borde visible + Sombra
      const borderD = clipD;
      doc.body.push(`<path d="${borderD}" fill="none" stroke="#000" stroke-width="${_fmt(borderStroke)}mm" stroke-linecap="round" stroke-linejoin="round" filter="url(#${shadowId})"/>`);
    } else {
      // Polígono
      const poly = _clipPolyToRect(cell.poly, box);
      if (!poly || poly.length < 3) continue;

      clipD = _polyPathD(poly, true);

      // Borde visible: orgánico interno + Sombra
      if (innerOrganicBorderEnabled) {
        const dynInset = Math.max(0.3, Math.min(innerOrganicBorderInsetMm, minDim * 0.06));
        const innerPoly = _polyInsetToCentroid(poly, dynInset);
        if (innerPoly && innerPoly.length >= 3) {
          const innerD = _organicPolyStrokeD(rng, innerPoly, Math.max(0, innerOrganicJitterMm), Math.max(0, innerOrganicRoundMm));
          doc.body.push(`<path d="${innerD}" fill="none" stroke="#000" stroke-width="${_fmt(borderStroke)}mm" stroke-linecap="round" stroke-linejoin="round" filter="url(#${shadowId})"/>`);
        }
      } else {
        doc.body.push(`<path d="${clipD}" fill="none" stroke="#000" stroke-width="${_fmt(borderStroke)}mm" stroke-linecap="round" stroke-linejoin="round" filter="url(#${shadowId})"/>`);
      }
    }

    // Clip defs
    pushDef(`<clipPath id="${clipId}"><path d="${clipD}"/></clipPath>`);

    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;

    // --- Capas / densidad ---
    const distToCenter = Math.sqrt(Math.pow(cx - (baseRect.x0 + baseRect.x1) / 2, 2) + Math.pow(cy - (baseRect.y0 + baseRect.y1) / 2, 2));
    const maxDist = Math.sqrt(Math.pow(baseRect.x1 - baseRect.x0, 2) + Math.pow(baseRect.y1 - baseRect.y0, 2)) / 2;
    const centerFactor = 1 - Math.min(1, distToCenter / maxDist); // 1 en el centro, 0 lejos

    const simpleCellProb = (opts.focusMode ? 0.15 : 0.05); // Much lower prob of being 'simple'
    const isSimpleCell = rng() < simpleCellProb;

    let layers;
    if (isSimpleCell) {
      // Even simple cells get at least one layer to avoid blanks
      layers = 1; 
    } else if (layersPerCell === "auto") {
      // Capping layers to 2 mostly. Too many layers creates a scribble effect.
      if (minDim < 15) layers = 1;
      else if (minDim < 35) layers = (rng() < 0.7 ? 1 : 2); 
      else layers = (rng() < 0.6 ? 2 : 3); // Max 3 for very large cells
    } else {
      layers = Math.max(1, Math.min(3, Number(layersPerCell)));
    }
    layers = Math.min(layers, Math.max(1, Number(maxPatternPassesPerCell)));

    let lastFn = null;

    const patternsGroup = [];
    for (let L = 0; L < layers; L++) {
      // Skip probabilístico
      if (rng() < Math.max(0, patternSkipProb) && minDim < 35) continue;

      // Smart Selection Strategy + Anti-Repetition
      const allPatterns = [...patterns];
      
      let available = allPatterns.filter(p => p !== lastFn);
      if (available.length === 0) available = allPatterns;

      if (minDim < 13) {
        available = [fillStripesSmooth, fillCrosses, fillConcentricSquares, fillParadox].filter(p => p !== lastFn);
      } 
      
      if (available.length === 0) available = allPatterns;

      const fn = pick(rng, available);
      lastFn = fn;

      // Escalado Dinámico: Ajustar parámetros para llenar más espacio densamente
      // Máximo aire (v3.6): Nunca bajamos del 90% del gap original en presets normales
      const stepScale = Math.max(0.9, Math.min(1.0, minDim / 60)); 
      
      let strokeScale = 1.0;
      if (opts.focusMode || familyKey === "dense") {
        strokeScale = 0.7; // Solo adelgazamos si se busca densidad extrema
      }

      const cellCfg = {
        ...cfg,
        minGapMm: Math.max(1.1, cfg.minGapMm * stepScale), 
        patternStrokeMm: Math.max(0.25, cfg.patternStrokeMm * stepScale * strokeScale)
      };

      let d = fn(rng, box, cellCfg);

      // Meta-Patterns: Círculos invocan stippling en los huecos
      if (fn === fillCircles && rng() < 0.7 && minDim > 20) {
        const stipD = fillStippling(rng, box, cellCfg, true);
        if (stipD) d += " " + stipD;
      }

      if (!d) continue;

      const canCover = enableDrawBehind && (L > 0) && (allowDrawBehindOnLayer2 || L === 1);
      const coverP1 = Math.min(drawBehindProbability, (minDim >= 26 ? 0.30 : 0.22));
      const coverP2 = Math.min(drawBehindProbability, (minDim >= 30 ? 0.46 : 0.34));
      const doCover = canCover && (rng() < (L === 1 ? coverP1 : coverP2));
      const fill = doCover ? "#fff" : "none";

      const jitter = (rng() - 0.5) * 0.15;

      patternsGroup.push(
        `<path d="${d}"
          fill="${fill}"
          stroke="#000" stroke-width="${_fmt(cellCfg.patternStrokeMm)}mm"
          stroke-linecap="round" stroke-linejoin="round"
          transform="rotate(${_fmt(rot + jitter)} ${_fmt(cx)} ${_fmt(cy)})"
        />`
      );
    }
    
    if (patternsGroup.length) {
      doc.body.push(`<g clip-path="url(#${clipId})">${patternsGroup.join("")}</g>`);
    }
  }

  // 6) Flow Lines (Global Continuity)
  if (opts.flowLinesEnabled !== false) {
    const flowCount = rInt(rng, 1, 3);
    for (let i = 0; i < flowCount; i++) {
      // Uses sketchy too? maybe not for flow lines, or yes?
      // Let's use clean for flow lines grid.
      const b = new PathBuilder({ sketchy: 0, rng });
      const xStart = baseRect.x0 + rng() * (baseRect.x1 - baseRect.x0);
      const yStart = baseRect.y0 + rng() * (baseRect.y1 - baseRect.y0);
      b.moveTo(xStart, yStart);

      const cp1x = baseRect.x0 + rng() * (baseRect.x1 - baseRect.x0);
      const cp1y = baseRect.y0 + rng() * (baseRect.y1 - baseRect.y0);
      const cp2x = baseRect.x0 + rng() * (baseRect.x1 - baseRect.x0);
      const cp2y = baseRect.y0 + rng() * (baseRect.y1 - baseRect.y0);
      const xEnd = baseRect.x0 + rng() * (baseRect.x1 - baseRect.x0);
      const yEnd = baseRect.y0 + rng() * (baseRect.y1 - baseRect.y0);

      b.cubicTo(cp1x, cp1y, cp2x, cp2y, xEnd, yEnd);
      doc.body.push(`<path d="${b.d}" fill="none" stroke="#000" stroke-width="${_fmt(borderStroke * 0.45)}mm" stroke-opacity="0.30" stroke-dasharray="3,3" pointer-events="none" />`);
    }
  }

  // Fallback defs injection
  if (!useDocDefs && localDefs.length) {
    doc.body.unshift(`<defs>${localDefs.join("")}</defs>`);
  }
}

/* =========================
   Layout generators
   ========================= */

function _makeCells(rng, baseRect, cfg) {
  const { cellLayout, cellCount, minCellSizeMm, hexRadiusMm, triSideMm } = cfg;

  if (cellLayout === "hex") return _makeHexCells(baseRect, Math.max(6, hexRadiusMm));
  if (cellLayout === "tri") return _makeTriCells(baseRect, Math.max(10, triSideMm));
  if (cellLayout === "voronoi") return _makeVoronoiCells(rng, baseRect, Math.max(10, cellCount));
  if (cellLayout === "strings") return _makeStringCells(rng, baseRect, Math.max(2, Math.floor(cellCount / 8)));

  if (cellLayout === "template") {
    const names = Object.keys(LAYOUT_TEMPLATES);
    const tName = cfg.templateName || names[rInt(rng, 0, names.length - 1)];
    return getTemplateCells(tName, baseRect);
  }

  // default
  const rects = _splitRectangles(rng, baseRect, Math.max(1, cellCount), Math.max(6, minCellSizeMm));
  return rects.map((r) => ({ kind: "rect", bbox: r, poly: null }));
}

function _makeVoronoiCells(rng, rect, count) {
  // Use a slightly tight radius for better distribution
  const radius = Math.sqrt(((rect.x1 - rect.x0) * (rect.y1 - rect.y0)) / count) * 0.95;
  const points = _poissonDiscSampling(rng, rect, radius);

  // Check if d3.Delaunay is available (usually globally in index.html)
  if (typeof d3 !== "undefined" && d3.Delaunay) {
    try {
      const delaunay = d3.Delaunay.from(points.map(p => [p.x, p.y]));
      const voronoi = delaunay.voronoi([rect.x0, rect.y0, rect.x1, rect.y1]);
      const cells = [];
      for (let i = 0; i < points.length; i++) {
        const polyCoords = voronoi.cellPolygon(i);
        if (polyCoords) {
          const poly = polyCoords.map(p => ({ x: p[0], y: p[1] }));
          cells.push({ kind: "poly", bbox: _bboxOfPoly(poly), poly });
        }
      }
      return cells;
    } catch (e) {
      console.warn("Voronoi error, falling back to simple scatter:", e);
    }
  }

  // Fallback: Partition-based scatter (simpler but stable)
  return _makeStringCells(rng, rect, count);
}

function _makeStringCells(rng, rect, count) {
  // Mezclamos lógica recursiva con radial para evitar bandas horizontales
  const useRadial = rng() < 0.45;
  let polygons;

  if (useRadial) {
    polygons = _radialSplit(rng, rect, Math.max(3, Math.floor(count / 4)));
  } else {
    // Increased depth for more cells if count is high
    const depth = count > 30 ? 4 : (count > 12 ? 3 : 2);
    polygons = _recursiveBezierSplit(rng, rect, depth);
  }

  return polygons.map(poly => {
    const w = _bboxOfPoly(poly);
    const minDim = Math.min(w.x1 - w.x0, w.y1 - w.y0);
    // Reduced warp to prevent boundary escape
    const warpAmt = minDim * 0.065; 
    const warped = _warpPolyOrganic(rng, poly, warpAmt);
    return { kind: "poly", bbox: _bboxOfPoly(warped), poly: warped };
  });
}

function _radialSplit(rng, rect, rays) {
  const cx = (rect.x0 + rect.x1) / 2 + (rng() - 0.5) * (rect.x1 - rect.x0) * 0.2;
  const cy = (rect.y0 + rect.y1) / 2 + (rng() - 0.5) * (rect.y1 - rect.y0) * 0.2;
  const res = [];
  const angles = [];
  for (let i = 0; i < rays; i++) {
    angles.push((i / rays) * Math.PI * 2 + (rng() - 0.5) * 0.4);
  }
  angles.sort((a, b) => a - b);

  const rMax = Math.max(rect.x1 - rect.x0, rect.y1 - rect.y0) * 1.5;

  for (let i = 0; i < rays; i++) {
    const a1 = angles[i];
    const a2 = angles[(i + 1) % rays];

    const p1 = { x: cx + Math.cos(a1) * rMax, y: cy + Math.sin(a1) * rMax };
    const p2 = { x: cx + Math.cos(a2) * rMax, y: cy + Math.sin(a2) * rMax };

    const triangle = [{ x: cx, y: cy }, p1, p2];
    // Clip el triángulo gigante al rect de la página
    const clipped = _clipPolyToRect(triangle, rect);
    if (clipped && clipped.length >= 3) {
      res.push(_subdividePoly(clipped));
    }
  }
  return res;
}

function _warpPolyOrganic(rng, poly, amount) {
  // Perturba los puntos del polígono para dar look de "curva"
  const res = [];
  const seed = rng() * 100;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    // Usamos senos/cosenos para una deformación continua (tipo ruido simple)
    const offX = Math.sin(p.y * 0.2 + seed) * amount;
    const offY = Math.cos(p.x * 0.2 + seed) * amount;
    res.push({ x: p.x + offX, y: p.y + offY });
  }
  return res;
}

function _recursiveBezierSplit(rng, rect, depth) {
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  const minSplitSize = 10.0;

  if (depth <= 0 || (w < minSplitSize * 2.2 && h < minSplitSize * 2.2)) {
    const p = [
      { x: rect.x0, y: rect.y0 },
      { x: rect.x1, y: rect.y0 },
      { x: rect.x1, y: rect.y1 },
      { x: rect.x0, y: rect.y1 }
    ];
    return [_subdividePoly(p)];
  }

  // Composición Dinámica: Romper las bandas puramente horizontales
  const aspect = w / h;
  let splitHoriz;
  if (aspect > 2.0) splitHoriz = false; // Forzar vertical si es muy ancho
  else if (aspect < 0.5) splitHoriz = true; // Forzar horizontal si es muy alto
  else splitHoriz = rng() < 0.45; // Ligero sesgo hacia vertical para romper la inercia

  // El punto de corte 't' ahora es más variable
  const t = rFloat(rng, 0.35, 0.65);

  if (splitHoriz) {
    const y = rect.y0 + h * t;
    return [..._recursiveBezierSplit(rng, { ...rect, y1: y }, depth - 1),
    ..._recursiveBezierSplit(rng, { ...rect, y0: y }, depth - 1)];
  } else {
    const x = rect.x0 + w * t;
    return [..._recursiveBezierSplit(rng, { ...rect, x1: x }, depth - 1),
    ..._recursiveBezierSplit(rng, { ...rect, x0: x }, depth - 1)];
  }
}

function _subdividePoly(poly) {
  const res = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    res.push(p1);
    res.push({ x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 });
  }
  return res;
}

function _poissonDiscSampling(rng, rect, radius) {
  const points = [];
  const active = [];
  const k = 30; // intentos
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;

  // Primer punto
  const p0 = { x: rect.x0 + rng() * w, y: rect.y0 + rng() * h };
  points.push(p0);
  active.push(p0);

  while (active.length > 0) {
    const idx = Math.floor(rng() * active.length);
    const p = active[idx];
    let found = false;

    for (let i = 0; i < k; i++) {
      const a = rng() * Math.PI * 2;
      const r = radius * (1 + rng());
      const next = { x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r };

      if (next.x >= rect.x0 && next.x <= rect.x1 && next.y >= rect.y0 && next.y <= rect.y1) {
        let tooClose = false;
        for (const op of points) {
          if (Math.hypot(next.x - op.x, next.y - op.y) < radius) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          points.push(next);
          active.push(next);
          found = true;
          break;
        }
      }
    }
    if (!found) active.splice(idx, 1);
  }
  return points;
}

function _makeHexCells(baseRect, R) {
  // Flat-top hexagons
  const w = baseRect.x1 - baseRect.x0;
  const h = baseRect.y1 - baseRect.y0;

  const dx = R * 3 / 2;
  const dy = Math.sqrt(3) * R;

  const cells = [];
  const cols = Math.ceil(w / dx) + 2;
  const rows = Math.ceil(h / dy) + 2;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const cx = baseRect.x0 + col * dx;
      const cy = baseRect.y0 + row * dy + (col % 2 ? dy / 2 : 0);

      const poly = _hexPoints(cx, cy, R);
      const bbox = _bboxOfPoly(poly);
      // quick reject if far outside
      if (bbox.x1 < baseRect.x0 - R || bbox.x0 > baseRect.x1 + R || bbox.y1 < baseRect.y0 - R || bbox.y0 > baseRect.y1 + R) continue;
      cells.push({ kind: "poly", bbox, poly });
    }
  }
  return cells;
}

function _hexPoints(cx, cy, R) {
  // flat-top: angles 0,60,... but rotated 30 gives pointy-top. We want flat-top.
  const pts = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 3) * k;
    pts.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) });
  }
  return pts;
}

function _makeTriCells(baseRect, side) {
  // Equilateral triangle grid (two orientations)
  const w = baseRect.x1 - baseRect.x0;
  const h = baseRect.y1 - baseRect.y0;
  const triH = Math.sqrt(3) * side / 2;

  const cols = Math.ceil(w / side) + 2;
  const rows = Math.ceil(h / triH) + 2;

  const cells = [];
  for (let r = -1; r < rows; r++) {
    for (let c = -1; c < cols; c++) {
      const x = baseRect.x0 + c * side;
      const y = baseRect.y0 + r * triH;

      // Up triangle
      const up = [
        { x: x, y: y + triH },
        { x: x + side / 2, y: y },
        { x: x + side, y: y + triH },
      ];
      let bbox = _bboxOfPoly(up);
      if (!(bbox.x1 < baseRect.x0 - side || bbox.x0 > baseRect.x1 + side || bbox.y1 < baseRect.y0 - triH || bbox.y0 > baseRect.y1 + triH)) {
        cells.push({ kind: "poly", bbox, poly: up });
      }

      // Down triangle
      const dn = [
        { x: x, y: y },
        { x: x + side, y: y },
        { x: x + side / 2, y: y + triH },
      ];
      bbox = _bboxOfPoly(dn);
      if (!(bbox.x1 < baseRect.x0 - side || bbox.x0 > baseRect.x1 + side || bbox.y1 < baseRect.y0 - triH || bbox.y0 > baseRect.y1 + triH)) {
        cells.push({ kind: "poly", bbox, poly: dn });
      }
    }
  }
  return cells;
}

/* =========================
   Helpers: geometry & organic
   ========================= */

function _pickRotation(rng, rotatePatterns, rotationSet) {
  if (!rotatePatterns) return 0;
  if (rotationSet === "classic") return (rng() < 0.5) ? 0 : 90;
  if (rotationSet === "free15") return rInt(rng, 0, 3) * 15;
  const set = [0, 45, 90, 135];
  return set[rInt(rng, 0, set.length - 1)];
}

function _addRectToBuilder(b, r) {
  b.moveTo(r.x0, r.y0).lineTo(r.x1, r.y0).lineTo(r.x1, r.y1).lineTo(r.x0, r.y1).close();
}
function _shrinkRect(r, m) {
  return { x0: r.x0 + m, y0: r.y0 + m, x1: r.x1 - m, y1: r.y1 - m };
}
function _isValidRect(r) {
  return (r.x1 > r.x0 + 0.25) && (r.y1 > r.y0 + 0.25);
}
function _fmt(n) { return (Math.round(Number(n) * 1000) / 1000).toString(); }

function _rectPathD(r) {
  return `M ${_fmt(r.x0)} ${_fmt(r.y0)} L ${_fmt(r.x1)} ${_fmt(r.y0)} L ${_fmt(r.x1)} ${_fmt(r.y1)} L ${_fmt(r.x0)} ${_fmt(r.y1)} Z`;
}

function _bboxOfPoly(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

function _polyPathD(poly, closed) {
  if (!poly || poly.length === 0) return "";
  let d = `M ${_fmt(poly[0].x)} ${_fmt(poly[0].y)}`;
  for (let i = 1; i < poly.length; i++) d += ` L ${_fmt(poly[i].x)} ${_fmt(poly[i].y)}`;
  if (closed) d += " Z";
  return d;
}

// Sutherland–Hodgman: clip polygon to axis-aligned rect
function _clipPolyToRect(poly, rect) {
  let out = poly;
  out = _clipPoly(out, (p) => p.x >= rect.x0, (a, b) => _intersectX(a, b, rect.x0));
  out = _clipPoly(out, (p) => p.x <= rect.x1, (a, b) => _intersectX(a, b, rect.x1));
  out = _clipPoly(out, (p) => p.y >= rect.y0, (a, b) => _intersectY(a, b, rect.y0));
  out = _clipPoly(out, (p) => p.y <= rect.y1, (a, b) => _intersectY(a, b, rect.y1));
  return out;
}

function _clipPoly(subject, insideFn, intersectFn) {
  if (!subject || subject.length === 0) return [];
  const output = [];
  for (let i = 0; i < subject.length; i++) {
    const curr = subject[i];
    const prev = subject[(i - 1 + subject.length) % subject.length];
    const currIn = insideFn(curr);
    const prevIn = insideFn(prev);

    if (currIn) {
      if (!prevIn) output.push(intersectFn(prev, curr));
      output.push(curr);
    } else if (prevIn) {
      output.push(intersectFn(prev, curr));
    }
  }
  return output;
}

function _intersectX(a, b, x) {
  const dx = b.x - a.x;
  if (Math.abs(dx) < 1e-9) return { x, y: a.y };
  const t = (x - a.x) / dx;
  return { x, y: a.y + (b.y - a.y) * t };
}
function _intersectY(a, b, y) {
  const dy = b.y - a.y;
  if (Math.abs(dy) < 1e-9) return { x: a.x, y };
  const t = (y - a.y) / dy;
  return { x: a.x + (b.x - a.x) * t, y };
}

// Simple inset: move each vertex towards centroid by a distance (approx)
function _polyInsetToCentroid(poly, inset) {
  const c = _centroid(poly);
  if (!c) return null;
  const out = [];
  for (const p of poly) {
    const vx = p.x - c.x;
    const vy = p.y - c.y;
    const len = Math.hypot(vx, vy) || 1;
    const scale = Math.max(0.01, (len - inset) / len);
    out.push({ x: c.x + vx * scale, y: c.y + vy * scale });
  }
  return out;
}

function _centroid(poly) {
  let x = 0, y = 0;
  for (const p of poly) { x += p.x; y += p.y; }
  const n = poly.length || 1;
  return { x: x / n, y: y / n };
}

// Organic stroke around a polygon (jitter along tangent/normal + rounded corners)
function _organicPolyStrokeD(rng, poly, jitterMm, cornerR) {
  // Build a polyline with jittered points
  const pts = [];
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p0 = poly[(i - 1 + n) % n];
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];

    const tx = p2.x - p0.x;
    const ty = p2.y - p0.y;
    const tlen = Math.hypot(tx, ty) || 1;
    const ux = tx / tlen;
    const uy = ty / tlen;

    // normal
    const nx = -uy;
    const ny = ux;

    const jt = rFloat(rng, -jitterMm, jitterMm) * 0.45;
    const jn = rFloat(rng, -jitterMm, jitterMm);

    pts.push({ x: p1.x + ux * jt + nx * jn, y: p1.y + uy * jt + ny * jn });
  }

  // Rounded corners via quadTo around each vertex
  const b = new PathBuilder({ sketchy: 0, rng }); // No sketchy for border usually, or maybe yes?
  // Let's passed 0 for border strictness
  const rr = Math.max(0, cornerR);

  for (let i = 0; i < pts.length; i++) {
    const pPrev = pts[(i - 1 + n) % n];
    const p = pts[i];
    const pNext = pts[(i + 1) % n];

    const v1x = p.x - pPrev.x, v1y = p.y - pPrev.y;
    const v2x = pNext.x - p.x, v2y = pNext.y - p.y;

    const l1 = Math.hypot(v1x, v1y) || 1;
    const l2 = Math.hypot(v2x, v2y) || 1;

    const r = Math.min(rr, l1 * 0.35, l2 * 0.35);

    const a1x = p.x - (v1x / l1) * r;
    const a1y = p.y - (v1y / l1) * r;
    const a2x = p.x + (v2x / l2) * r;
    const a2y = p.y + (v2y / l2) * r;

    if (i === 0) b.moveTo(a1x, a1y);
    else b.lineTo(a1x, a1y);

    b.quadTo(p.x, p.y, a2x, a2y);
  }

  b.close();
  return b.d;
}

// Organic rect (clip orgánico real)
function _organicRectD(rng, r, params) {
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const minDim = Math.min(w, h);
  const cornerR = Math.max(0.8, Math.min(params.cornerR ?? 2.2, minDim * 0.22));
  const bulge = Math.max(0.25, Math.min(params.bulge ?? 1.2, minDim * 0.18));
  const lumps = Math.max(1, Math.min(2, params.lumps ?? 1));

  const topPts = _bulgeEdge(rng, { x0: r.x0 + cornerR, x1: r.x1 - cornerR, y: r.y0 }, "x", bulge, lumps, -1);
  const rightPts = _bulgeEdge(rng, { y0: r.y0 + cornerR, y1: r.y1 - cornerR, x: r.x1 }, "y", bulge, lumps, +1);
  const botPts = _bulgeEdge(rng, { x0: r.x0 + cornerR, x1: r.x1 - cornerR, y: r.y1 }, "x", bulge, lumps, +1);
  const leftPts = _bulgeEdge(rng, { y0: r.y0 + cornerR, y1: r.y1 - cornerR, x: r.x0 }, "y", bulge, lumps, -1);

  const b = new PathBuilder({ sketchy: 0, rng });
  b.moveTo(r.x0 + cornerR, r.y0);

  _curveThroughPoints(b, topPts);
  b.quadTo(r.x1, r.y0, r.x1, r.y0 + cornerR);

  _curveThroughPoints(b, rightPts);
  b.quadTo(r.x1, r.y1, r.x1 - cornerR, r.y1);

  _curveThroughPoints(b, botPts);
  b.quadTo(r.x0, r.y1, r.x0, r.y1 - cornerR);

  _curveThroughPoints(b, leftPts);
  b.quadTo(r.x0, r.y0, r.x0 + cornerR, r.y0);

  b.close();
  return b.d;
}

function _bulgeEdge(rng, edge, axis, bulge, lumps, normalSign) {
  const pts = [];
  if (axis === "x") {
    const len = edge.x1 - edge.x0;
    const t1 = lumps === 2 ? 0.28 : 0.35;
    const t2 = lumps === 2 ? 0.72 : 0.65;
    const n1 = normalSign * rFloat(rng, bulge * 0.55, bulge);
    const n2 = normalSign * rFloat(rng, bulge * 0.45, bulge * 0.95);
    pts.push({ x: edge.x0, y: edge.y });
    pts.push({ x: edge.x0 + len * t1, y: edge.y + n1 });
    if (lumps === 2) pts.push({ x: edge.x0 + len * 0.50, y: edge.y + normalSign * rFloat(rng, bulge * 0.20, bulge * 0.55) });
    pts.push({ x: edge.x0 + len * t2, y: edge.y + n2 });
    pts.push({ x: edge.x1, y: edge.y });
  } else {
    const len = edge.y1 - edge.y0;
    const t1 = lumps === 2 ? 0.28 : 0.35;
    const t2 = lumps === 2 ? 0.72 : 0.65;
    const n1 = normalSign * rFloat(rng, bulge * 0.55, bulge);
    const n2 = normalSign * rFloat(rng, bulge * 0.45, bulge * 0.95);
    pts.push({ x: edge.x, y: edge.y0 });
    pts.push({ x: edge.x + n1, y: edge.y0 + len * t1 });
    if (lumps === 2) pts.push({ x: edge.x + normalSign * rFloat(rng, bulge * 0.20, bulge * 0.55), y: edge.y0 + len * 0.50 });
    pts.push({ x: edge.x + n2, y: edge.y0 + len * t2 });
    pts.push({ x: edge.x, y: edge.y1 });
  }
  return pts;
}

// Midpoint smoothing with safe last segment (lineTo)
function _curveThroughPoints(b, pts) {
  if (!pts || pts.length < 2) return;

  // ensure we touch the first point
  b.lineTo(pts[0].x, pts[0].y);

  for (let i = 1; i < pts.length - 1; i++) {
    const pControl = pts[i];
    const pNext = pts[i + 1];
    const midX = (pControl.x + pNext.x) / 2;
    const midY = (pControl.y + pNext.y) / 2;
    b.quadTo(pControl.x, pControl.y, midX, midY);
  }

  // final straight segment avoids end-loop/kink
  const pLast = pts[pts.length - 1];
  b.lineTo(pLast.x, pLast.y);
}

function _splitRectangles(rng, base, targetCount, minSizeMm) {
  let rects = [base];
  const area = (r) => Math.max(0, (r.x1 - r.x0) * (r.y1 - r.y0));

  for (let i = 0; i < targetCount * 2.5 && rects.length < targetCount; i++) {
    const total = rects.reduce((s, r) => s + area(r), 0);
    if (total <= 0.001) break;

    let val = rng() * total;
    let idx = 0;
    for (; idx < rects.length; idx++) {
      const a = area(rects[idx]);
      if (val <= a) break;
      val -= a;
    }
    idx = Math.min(idx, rects.length - 1);

    const r = rects[idx];
    const w = r.x1 - r.x0;
    const h = r.y1 - r.y0;

    if (w < minSizeMm * 2.1 && h < minSizeMm * 2.1) continue;

    const cutVert = (w >= h) ? (rng() < 0.60) : (rng() < 0.40);

    if (cutVert && w >= minSizeMm * 2.1) {
      const cutPos = 0.5 + rFloat(rng, -0.15, 0.15);
      const x = r.x0 + w * cutPos;
      rects.splice(idx, 1, { ...r, x1: x }, { ...r, x0: x });
    } else if (!cutVert && h >= minSizeMm * 2.1) {
      const cutPos = 0.5 + rFloat(rng, -0.15, 0.15);
      const y = r.y0 + h * cutPos;
      rects.splice(idx, 1, { ...r, y1: y }, { ...r, y0: y });
    }
  }
  return rects;
}

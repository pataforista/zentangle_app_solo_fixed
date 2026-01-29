// zentangleCells.js
import { mulberry32, rFloat, rInt, pick } from "./prng.js";
import { PathBuilder } from "./pathBuilder.js";

/**
 * Zentangle Cells — v5 (integrated)
 * - Soporta: rect_bsp (antes), hex, tri
 * - ClipPath geométrico por celda (sin micro-huecos)
 * - Borde orgánico interno opcional (look "mano" sin romper el clip)
 * - Anti-saturación (whiteSpaceMm, patternSkipProb, maxPatternPassesPerCell)
 *
 * Requisito: doc = { body: [], defs?: [] }
 */
export function generateZentangleCells(doc, opts) {
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
  } = opts;

  const rng = mulberry32(seed >>> 0);

  // Pisos técnicos
  const cellStroke = Math.max(minStrokeMm, cellBorderWidthMm);
  const patStroke = Math.max(minStrokeMm, patternStrokeMm);

  const cfg = {
    minStrokeMm,
    minGapMm: Math.max(0.9, minGapMm),
    patternStrokeMm: patStroke,
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
    const outer = new PathBuilder();
    _addRectToBuilder(outer, baseRect);
    doc.body.push(outer.toPath({
      stroke: "#000",
      strokeWidthMm: cellStroke,
      fill: "none",
      linecap: "round",
      linejoin: "round",
    }));
  }

  // 3) Patrones disponibles
  const patterns = [
    _fillConcentricSquares,
    _fillStripesSmooth,
    _fillCircles,
    _fillCrosses,
    _fillCurvesSmooth,
  ];
  // extras
  patterns.push(_fillScallops, _fillSpiralBands, _fillAuraSquares, _fillFlow, _fillTriangles, _fillStippling);

  // 4) Defs bucket (seguro)
  const useDocDefs = Array.isArray(doc.defs);
  const localDefs = [];
  const pushDef = (s) => { if (useDocDefs) doc.defs.push(s); else localDefs.push(s); };

  // 5) Render por celda
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];

    const rot = _pickRotation(rng, rotatePatterns, rotationSet);
    const margin = innerMarginMm + (rot !== 0 ? extraMarginWhenRotatedMm : 0);

    // Aire editorial: shrink bbox + whiteSpace
    const box = _shrinkRect(cell.bbox, margin + Math.max(0, whiteSpaceMm));
    if (!_isValidRect(box)) continue;

    const w = box.x1 - box.x0;
    const h = box.y1 - box.y0;
    const minDim = Math.min(w, h);

    // --- Clip geometry ---
    const clipId = `zt_clip_${seed >>> 0}_${i}`;
    let clipD = null;

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

      // Borde visible: si clip orgánico está apagado, dibuja rect; si está encendido, dibuja orgánico
      const borderD = clipD;
      doc.body.push(`<path d="${borderD}" fill="none" stroke="#000" stroke-width="${_fmt(cellStroke)}mm" stroke-linecap="round" stroke-linejoin="round"/>`);
    } else {
      // Polígono: clipear el polígono base al rectángulo exterior (para que no se salga de la página)
      const poly = _clipPolyToRect(cell.poly, box);
      if (!poly || poly.length < 3) continue;

      // Clip geométrico perfecto
      clipD = _polyPathD(poly, true);

      // Borde visible: orgánico interno (recomendado)
      if (innerOrganicBorderEnabled) {
        const dynInset = Math.max(0.3, Math.min(innerOrganicBorderInsetMm, minDim * 0.06));
        const innerPoly = _polyInsetToCentroid(poly, dynInset);
        if (innerPoly && innerPoly.length >= 3) {
          const innerD = _organicPolyStrokeD(rng, innerPoly, Math.max(0, innerOrganicJitterMm), Math.max(0, innerOrganicRoundMm));
          doc.body.push(`<path d="${innerD}" fill="none" stroke="#000" stroke-width="${_fmt(cellStroke)}mm" stroke-linecap="round" stroke-linejoin="round"/>`);
        }
      } else {
        // Si quieres borde geométrico:
        doc.body.push(`<path d="${clipD}" fill="none" stroke="#000" stroke-width="${_fmt(cellStroke)}mm" stroke-linecap="round" stroke-linejoin="round"/>`);
      }
    }

    // Clip defs
    pushDef(`<clipPath id="${clipId}" clipPathUnits="userSpaceOnUse"><path d="${clipD}"/></clipPath>`);

    // --- Capas / densidad ---
    let layers;
    if (layersPerCell === "auto") {
      if (minDim < 16) layers = 1;
      else if (minDim < 28) layers = (rng() < 0.22 ? 2 : 1);
      else layers = (rng() < 0.18 ? 3 : 2);
    } else {
      layers = Math.max(1, Math.min(3, Number(layersPerCell)));
    }
    layers = Math.min(layers, Math.max(1, Number(maxPatternPassesPerCell)));

    const cx = (box.x0 + box.x1) / 2;
    const cy = (box.y0 + box.y1) / 2;

    for (let L = 0; L < layers; L++) {
      // Skip probabilístico para dar "aire"
      if (rng() < Math.max(0, patternSkipProb) && minDim < 35) continue;

      // Smart Selection Strategy
      let available = patterns; // default all

      // Filter by size constraints to avoid muddy details
      if (minDim < 12) {
        // Very small: only simple textures
        available = [_fillStripesSmooth, _fillCrosses, _fillConcentricSquares];
      } else if (minDim < 20) {
        // Medium: avoid complex spirals or dense circles
        available = patterns.filter(p => p !== _fillSpiralBands && p !== _fillCircles && p !== _fillFlow);
      }

      // If specific "families" enabled, filter further (existing logic usage)
      // Note: we just pick from 'available' now.

      const fn = pick(rng, available.length > 0 ? available : patterns);
      const d = fn(rng, box, cfg);
      if (!d) continue;

      const canCover = enableDrawBehind && (L > 0) && (allowDrawBehindOnLayer2 || L === 1);
      const coverP1 = Math.min(drawBehindProbability, (minDim >= 26 ? 0.30 : 0.22));
      const coverP2 = Math.min(drawBehindProbability, (minDim >= 30 ? 0.46 : 0.34));
      const doCover = canCover && (rng() < (L === 1 ? coverP1 : coverP2));
      const fill = doCover ? "#fff" : "none";

      doc.body.push(
        `<path d="${d}"
          clip-path="url(#${clipId})"
          fill="${fill}"
          stroke="#000" stroke-width="${_fmt(patStroke)}mm"
          stroke-linecap="round" stroke-linejoin="round"
          transform="rotate(${_fmt(rot)} ${_fmt(cx)} ${_fmt(cy)})"
        />`
      );
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
  // default
  const rects = _splitRectangles(rng, baseRect, Math.max(1, cellCount), Math.max(6, minCellSizeMm));
  return rects.map((r) => ({ kind: "rect", bbox: r, poly: null }));
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
   Patterns
   ========================= */

function _fillConcentricSquares(rng, r, cfg) {
  const b = new PathBuilder();
  const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
  const step = rFloat(rng, Math.max(cfg.minGapMm * 1.25, minDim * 0.06), Math.max(cfg.minGapMm * 1.45, minDim * 0.10));
  let x0 = r.x0, y0 = r.y0, x1 = r.x1, y1 = r.y1;
  while (x1 - x0 > step * 1.15 && y1 - y0 > step * 1.15) {
    b.moveTo(x0, y0).lineTo(x1, y0).lineTo(x1, y1).lineTo(x0, y1).close();
    x0 += step; y0 += step; x1 -= step; y1 -= step;
  }
  return b.d;
}

function _fillAuraSquares(rng, r, cfg) {
  const b = new PathBuilder();
  const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
  const step = rFloat(rng, Math.max(cfg.minGapMm * 1.35, minDim * 0.07), Math.max(cfg.minGapMm * 1.55, minDim * 0.12));
  const aura = rFloat(rng, Math.max(0.45, cfg.minGapMm * 0.35), Math.min(step * 0.45, 1.1));
  let x0 = r.x0, y0 = r.y0, x1 = r.x1, y1 = r.y1;
  while (x1 - x0 > step * 1.25 && y1 - y0 > step * 1.25) {
    b.moveTo(x0, y0).lineTo(x1, y0).lineTo(x1, y1).lineTo(x0, y1).close();
    b.moveTo(x0 + aura, y0 + aura).lineTo(x1 - aura, y0 + aura).lineTo(x1 - aura, y1 - aura).lineTo(x0 + aura, y1 - aura).close();
    x0 += step; y0 += step; x1 -= step; y1 -= step;
  }
  return b.d;
}

function _fillStripesSmooth(rng, r, cfg) {
  const b = new PathBuilder();
  const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
  const isVertical = rng() > 0.5;
  const step = rFloat(rng, Math.max(cfg.minGapMm * 1.55, minDim * 0.08), Math.max(cfg.minGapMm * 1.75, minDim * 0.13));
  const amp = rFloat(rng, 0.6, Math.max(1.4, Math.min(minDim * 0.08, cfg.minGapMm * 1.4)));

  if (isVertical) {
    for (let x = r.x0 + step; x < r.x1; x += step) {
      const midY = (r.y0 + r.y1) / 2;
      b.moveTo(x, r.y0).quadTo(x + amp, (r.y0 + midY) / 2, x, midY).quadTo(x - amp, (midY + r.y1) / 2, x, r.y1);
      if (rng() < 0.45) {
        const dx = rFloat(rng, -0.5, 0.5);
        b.moveTo(x + dx, r.y0).quadTo(x + dx + amp, (r.y0 + midY) / 2, x + dx, midY).quadTo(x + dx - amp, (midY + r.y1) / 2, x + dx, r.y1);
      }
    }
  } else {
    for (let y = r.y0 + step; y < r.y1; y += step) {
      const midX = (r.x0 + r.x1) / 2;
      b.moveTo(r.x0, y).quadTo((r.x0 + midX) / 2, y + amp, midX, y).quadTo((midX + r.x1) / 2, y - amp, r.x1, y);
      if (rng() < 0.45) {
        const dy = rFloat(rng, -0.5, 0.5);
        b.moveTo(r.x0, y + dy).quadTo((r.x0 + midX) / 2, y + dy + amp, midX, y + dy).quadTo((midX + r.x1) / 2, y + dy - amp, r.x1, y + dy);
      }
    }
  }
  return b.d;
}

function _fillCircles(rng, r, cfg) {
  const b = new PathBuilder();
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const minDim = Math.min(w, h);
  let radius = rFloat(rng, Math.max(1.2, cfg.minGapMm * 0.55), Math.max(1.4, minDim * 0.12));
  const pitch = radius * 2 + cfg.minGapMm;
  const cols = Math.max(1, Math.floor(w / pitch));
  const rows = Math.max(1, Math.floor(h / pitch));

  if (cols > 1) radius = Math.min(radius, (w - (cols + 1) * cfg.minGapMm) / (cols * 2));
  if (rows > 1) radius = Math.min(radius, (h - (rows + 1) * cfg.minGapMm) / (rows * 2));

  const gapX = (w - cols * radius * 2) / (cols + 1);
  const gapY = (h - rows * radius * 2) / (rows + 1);
  if (gapX < cfg.minGapMm * 0.55 || gapY < cfg.minGapMm * 0.55) return null;

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = r.x0 + gapX + radius + i * (radius * 2 + gapX);
      const cy = r.y0 + gapY + radius + j * (radius * 2 + gapY);
      b.moveTo(cx + radius, cy);
      b.quadTo(cx + radius, cy + radius, cx, cy + radius);
      b.quadTo(cx - radius, cy + radius, cx - radius, cy);
      b.quadTo(cx - radius, cy - radius, cx, cy - radius);
      b.quadTo(cx + radius, cy - radius, cx + radius, cy);
    }
  }
  return b.d;
}

function _fillCrosses(rng, r, cfg) {
  const b = new PathBuilder();
  const step = rFloat(rng, Math.max(cfg.minGapMm * 2.4, 3), Math.max(cfg.minGapMm * 3, 5));
  const s = step * 0.25;
  for (let x = r.x0 + step / 2; x < r.x1; x += step) {
    for (let y = r.y0 + step / 2; y < r.y1; y += step) {
      b.moveTo(x - s, y - s).lineTo(x + s, y + s);
      b.moveTo(x + s, y - s).lineTo(x - s, y + s);
    }
  }
  return b.d;
}

function _fillCurvesSmooth(rng, r, cfg) {
  const b = new PathBuilder();
  const stepY = rFloat(rng, cfg.minGapMm * 1.5, cfg.minGapMm * 2.5);
  const segX = rFloat(rng, stepY * 2, stepY * 4);
  const amp = rFloat(rng, 0.8, 1.5);
  let y = r.y0 + stepY;
  while (y < r.y1) {
    b.moveTo(r.x0, y);
    let x = r.x0;
    let flip = rng() < 0.5 ? -1 : 1;
    while (x < r.x1) {
      const nextX = Math.min(r.x1, x + segX);
      const mx = (x + nextX) / 2;
      b.quadTo(mx, y + flip * amp, nextX, y);
      flip *= -1;
      x = nextX;
    }
    y += stepY;
  }
  return b.d;
}

function _fillScallops(rng, r, cfg) {
  const b = new PathBuilder();
  const step = rFloat(rng, cfg.minGapMm * 2.8, cfg.minGapMm * 4);
  const rad = step * 0.6;
  for (let y = r.y0 + rad; y < r.y1 + rad; y += rad) {
    const row = Math.floor((y - r.y0) / rad);
    const offset = row % 2 ? rad : 0;
    for (let x = r.x0 + offset; x < r.x1 + rad; x += rad * 2) {
      b.moveTo(x - rad, y).quadTo(x, y - rad, x + rad, y);
    }
  }
  return b.d;
}

return b.d;
}

function _fillSpiralBands(rng, r, cfg) {
  const b = new PathBuilder();
  const cx = (r.x0 + r.x1) / 2;
  const cy = (r.y0 + r.y1) / 2;
  const maxR = Math.min(r.x1 - r.x0, r.y1 - r.y0) * 0.45;
  if (maxR < cfg.minGapMm * 2.2) return null;

  const bands = rInt(rng, 2, 4);
  const maxSegLenMm = 1.2;

  for (let k = 0; k < bands; k++) {
    let a = rFloat(rng, 0, Math.PI * 2);
    let rad = maxR * (0.98 - k * 0.18);
    const totalAngle = rFloat(rng, 2.3, 3.4) * Math.PI * 2;
    const approxLen = Math.max(1, (rad * 0.55) * totalAngle);
    const steps = Math.max(24, Math.min(100, Math.round(approxLen / maxSegLenMm)));
    const stepAngle = totalAngle / steps;
    const decay = Math.pow(0.20, 1 / steps);

    b.moveTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    for (let i = 0; i < steps; i++) {
      a += stepAngle;
      rad *= (0.985 + rFloat(rng, -0.003, 0.002));
      rad *= decay;
      if (rad < maxR * 0.10) break;
      b.lineTo(cx + rad * Math.cos(a), cy + rad * Math.sin(a));
    }
  }
  return b.d;
}

function _fillFlow(rng, r, cfg) {
  // "Hollibaugh" style flow lines
  const b = new PathBuilder();
  const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
  // Vertical-ish flowing lines
  const cols = Math.max(3, Math.floor((r.x1 - r.x0) / (cfg.minGapMm * 2.5)));
  const stepX = (r.x1 - r.x0) / cols;

  for (let i = 0; i <= cols; i++) {
    const xBase = r.x0 + i * stepX;
    if (i === 0 || i === cols) {
      // edges just straight? no, let's skip edges they are clipped anyway
      continue;
    }

    // Draw a flowing line from top to bottom
    b.moveTo(xBase, r.y0);

    let y = r.y0;
    let x = xBase;
    const steps = 6;
    const dy = (r.y1 - r.y0) / steps;

    for (let k = 0; k < steps; k++) {
      const nextY = y + dy;
      const drift = rFloat(rng, -stepX * 0.6, stepX * 0.6);
      const cp1x = x + rFloat(rng, -2, 2);
      const cp1y = y + dy * 0.33;
      const cp2x = xBase + drift + rFloat(rng, -2, 2); // tend back to base?
      const cp2y = y + dy * 0.66;
      const nextX = xBase + drift;

      b.quadTo(cp1x, cp1y, (x + nextX) / 2, (y + nextY) / 2); // smooth approx

      x = nextX;
      y = nextY; // abstract logic
    }
    // Simple spline through random points is better:
    // Let's redo: just Top to Bottom bezier
    const c1x = xBase + rFloat(rng, -minDim * 0.3, minDim * 0.3);
    const c1y = r.y0 + (r.y1 - r.y0) * 0.33;
    const c2x = xBase + rFloat(rng, -minDim * 0.3, minDim * 0.3);
    const c2y = r.y0 + (r.y1 - r.y0) * 0.66;
    const destX = xBase + rFloat(rng, -stepX, stepX);

    // Reset and do single cubic
    b.moveTo(xBase, r.y0); // actually we can't reset 'b' mid-stream easily in this builder? 
    // wait, moveTo starts new subpath.
    b.cubicTo(c1x, c1y, c2x, c2y, destX, r.y1);

    // Double line for "ribbon" effect?
    if (rng() < 0.5) {
      const gap = cfg.minGapMm * 0.6;
      b.moveTo(xBase + gap, r.y0);
      b.cubicTo(c1x + gap, c1y, c2x + gap, c2y, destX + gap, r.y1);
    }
  }
  return b.d;
}

function _fillTriangles(rng, r, cfg) {
  // Random subdivision triangles
  const b = new PathBuilder();
  const count = rInt(rng, 5, 12);
  for (let i = 0; i < count; i++) {
    const p1 = { x: rFloat(rng, r.x0, r.x1), y: rFloat(rng, r.y0, r.y1) };
    const p2 = { x: rFloat(rng, r.x0, r.x1), y: rFloat(rng, r.y0, r.y1) };
    const p3 = { x: rFloat(rng, r.x0, r.x1), y: rFloat(rng, r.y0, r.y1) };

    // Just strokes
    b.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y).lineTo(p1.x, p1.y);
  }
  return b.d;
}

function _fillStippling(rng, r, cfg) {
  const b = new PathBuilder();
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const area = w * h;
  const density = 0.4; // dots per mm2 approx? 
  const count = Math.floor(area * density);

  // Gradient stippling? High density near bottom
  for (let i = 0; i < count; i++) {
    let x = rFloat(rng, r.x0, r.x1);
    let y = rFloat(rng, r.y0, r.y1);

    // REJECT based on y (more dots at bottom)
    const prob = (y - r.y0) / h;
    if (rng() > prob) continue;

    const rad = rFloat(rng, 0.1, 0.25);
    // Draw little circle
    b.circle(x, y, rad);
  }
  return b.d;
}

/* =========================
   Helpers: rect split
   ========================= */

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
  const b = new PathBuilder();
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

  const b = new PathBuilder();
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

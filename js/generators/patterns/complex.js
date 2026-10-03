import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

/**
 * Patrón PARADOX: Triángulos recursivos que crean ilusión de giro.
 */
export function fillParadox(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const poly = _clipPolyToRect(cfg.poly || [
        { x: r.x0, y: r.y0 },
        { x: r.x1, y: r.y0 },
        { x: r.x1, y: r.y1 },
        { x: r.x0, y: r.y1 }
    ], r);
    if (!poly || poly.length < 3) return null;

    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    // Pocos pasos: la recursión se acumula hacia el centro y entinta la celda
    const steps = Math.min(9, Math.floor(minDim / 5));
    const ratio = rFloat(rng, 0.12, 0.18);

    _drawParadoxTriangle(b, [poly[0], poly[1], poly[2]], steps, ratio, cfg.minGapMm * 1.2);
    _drawParadoxTriangle(b, [poly[0], poly[3], poly[2]], steps, ratio, cfg.minGapMm * 1.2);
    
    return b.d;
}

// Updated _drawParadoxTriangle to accept ratio and use sw for stroke width if needed (not directly in this function)
function _drawParadoxTriangle(b, pts, steps, ratio, minGap = 0) {
    let current = [...pts];
    const shift = ratio; // Use the new ratio for displacement

    for (let i = 0; i < steps; i++) {
        const p0 = current[0], p1 = current[1], p2 = current[2];
        // Check for degenerate triangle to prevent infinite loops or scribbles
        const area = 0.5 * Math.abs(p0.x * (p1.y - p2.y) + p1.x * (p2.y - p0.y) + p2.x * (p0.y - p1.y));
        if (area < 0.5) break; // Stop if triangle is too small to avoid black blobs
        // Para colorear: si el siguiente giro desplaza los vértices menos de un
        // hueco, las franjas nuevas serían hilos imposibles de rellenar.
        const minSide = Math.min(Math.hypot(p1.x - p0.x, p1.y - p0.y),
            Math.hypot(p2.x - p1.x, p2.y - p1.y), Math.hypot(p0.x - p2.x, p0.y - p2.y));
        if (i > 0 && minSide * shift < minGap) break;

        b.moveTo(p0.x, p0.y)
         .lineTo(p1.x, p1.y)
         .lineTo(p2.x, p2.y)
         .close();
        
        current = [
            { x: p0.x + (p1.x - p0.x) * shift, y: p0.y + (p1.y - p0.y) * shift },
            { x: p1.x + (p2.x - p1.x) * shift, y: p1.y + (p2.y - p1.y) * shift },
            { x: p2.x + (p0.x - p2.x) * shift, y: p2.y + (p0.y - p2.y) * shift }
        ];
    }
}

/**
 * Patrón HOLLIBAUGH: Cintas entrelazadas con profundidad.
 */
export function fillHollibaugh(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    // Wide ribbons read better for KDP coloring than hairline strokes
    const width = rFloat(rng, minDim * 0.10, minDim * 0.18);
    const count = rInt(rng, 3, 6);
    // Cintas de la misma orientación separadas al menos un ancho: al solaparse
    // casi paralelas dejaban astillas de <1 mm imposibles de colorear.
    const placed = { v: [], h: [] };
    const clear = (list, p) => list.every(q => Math.abs(q - p) > width * 2 + cfg.minGapMm);

    for (let i = 0; i < count; i++) {
        const isVertical = rng() > 0.5;
        const angleOffset = rFloat(rng, -0.04, 0.04);

        if (isVertical) {
            const x = rFloat(rng, r.x0 + width, r.x1 - width * 2);
            if (!clear(placed.v, x)) continue;
            placed.v.push(x);
            // Draw a slightly angled ribbon
            b.moveTo(x, r.y0).lineTo(x + width, r.y0)
             .lineTo(x + width + angleOffset * (r.y1 - r.y0), r.y1)
             .lineTo(x + angleOffset * (r.y1 - r.y0), r.y1).close();
        } else {
            const y = rFloat(rng, r.y0 + width, r.y1 - width * 2);
            if (!clear(placed.h, y)) continue;
            placed.h.push(y);
            // Draw a slightly angled ribbon
            b.moveTo(r.x0, y).lineTo(r.x0, y + width)
             .lineTo(r.x1, y + width + angleOffset * (r.x1 - r.x0))
             .lineTo(r.x1, y + angleOffset * (r.x1 - r.x0)).close();
        }
    }
    return b.d;
}

/**
 * Patrón FLUX: roseta de pétalos con aura interior y núcleo concéntrico.
 * Los pétalos se reparten en sectores iguales y nunca se solapan: antes se
 * cruzaban con ángulos aleatorios y el centro se volvía una maraña negra.
 * Se ancla en cfg.focus (centro del círculo inscrito de la celda) si existe.
 */
export function fillFlux(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const f = cfg.focus || { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, r: minDim / 2 };
    const gap = cfg.minGapMm;
    const R = f.r * 0.9;
    if (R < gap * 4) return null;

    // Núcleo: dos círculos concéntricos (o uno si no cabe el aura)
    const core = Math.max(gap * 1.3, R * rFloat(rng, 0.18, 0.24));
    b.circle(f.x, f.y, core);
    if (core > gap * 2.4) b.circle(f.x, f.y, core - gap);

    // Tantos pétalos como quepan con ~3 huecos de ancho a media altura
    const mid = (core + R) / 2;
    const n = Math.max(7, Math.min(22, Math.floor((Math.PI * 2 * mid) / (gap * 3.4))));
    const half = Math.PI / n;
    const a0 = rFloat(rng, 0, Math.PI * 2);
    const tipJitter = R * 0.04;

    for (let i = 0; i < n; i++) {
        const a = a0 + i * 2 * half;
        const tip = R - rFloat(rng, 0, tipJitter);
        _petal(b, f, a, half * 0.96, core, tip);
        // Aura interior del pétalo si hay sitio para colorear entre líneas
        const innerHalf = half * 0.5;
        if (mid * innerHalf * 2 > gap * 2 && tip - core > gap * 4) {
            _petal(b, f, a, innerHalf, core + gap, tip - gap * 1.6);
        }
    }
    return b.d;
}

// Pétalo en el sector [a-half, a+half]: base sobre el círculo r0, punta en r1.
// Los controles quedan dentro del sector, así pétalos vecinos solo se tocan.
function _petal(b, f, a, half, r0, r1) {
    const pt = (ang, rad) => ({ x: f.x + Math.cos(ang) * rad, y: f.y + Math.sin(ang) * rad });
    const bl = pt(a - half, r0), br = pt(a + half, r0), tp = pt(a, r1);
    const cr = r0 + (r1 - r0) * 0.62;
    const cl = pt(a - half, cr), cR = pt(a + half, cr);
    b.moveTo(bl.x, bl.y).quadTo(cl.x, cl.y, tp.x, tp.y).quadTo(cR.x, cR.y, br.x, br.y);
}

// Helper functions for clipping polygons to rectangles
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

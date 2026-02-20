/**
 * GeometryCore.js
 * Layer 1: Low-level geometric primitives and operations.
 * Pure logic, no side effects, no rendering knowledge.
 */

export const GeometryCore = {
  /**
   * Linear interpolation between two coordinates or values.
   */
  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  /**
   * Euclidean distance between two points.
   */
  dist(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  },

  /**
   * Samples a quadratic Bézier curve.
   */
  sampleQuad(p0, p1, p2, t) {
    const x = (1 - t) ** 2 * p0.x + 2 * (1 - t) * t * p1.x + t ** 2 * p2.x;
    const y = (1 - t) ** 2 * p0.y + 2 * (1 - t) * t * p1.y + t ** 2 * p2.y;
    return { x, y };
  },

  /**
   * Samples a cubic Bézier curve.
   */
  sampleCubic(p0, p1, p2, p3, t) {
    const x = (1 - t) ** 3 * p0.x + 3 * (1 - t) ** 2 * t * p1.x + 3 * (1 - t) * t ** 2 * p2.x + t ** 3 * p3.x;
    const y = (1 - t) ** 3 * p0.y + 3 * (1 - t) ** 2 * t * p1.y + 3 * (1 - t) * t ** 2 * p2.y + t ** 3 * p3.y;
    return { x, y };
  },

  /**
   * Offset a simple stroke (polyline) by a certain amount.
   * Returns a list of points representing the offset boundary.
   */
  offsetPolyline(points, offset) {
    if (points.length < 2) return [];
    
    const result = [];
    for (let i = 0; i < points.length; i++) {
        const p = points[i];
        let dx, dy;
        
        if (i === 0) {
            dx = points[i+1].x - p.x;
            dy = points[i+1].y - p.y;
        } else if (i === points.length - 1) {
            dx = p.x - points[i-1].x;
            dy = p.y - points[i-1].y;
        } else {
            // Average of segments
            const dx1 = p.x - points[i-1].x;
            const dy1 = p.y - points[i-1].y;
            const dx2 = points[i+1].x - p.x;
            const dy2 = points[i+1].y - p.y;
            const len1 = Math.hypot(dx1, dy1);
            const len2 = Math.hypot(dx2, dy2);
            dx = (dx1 / len1 + dx2 / len2) / 2;
            dy = (dy1 / len1 + dy2 / len2) / 2;
        }
        
        const len = Math.hypot(dx, dy);
        const nx = -dy / len;
        const ny = dx / len;
        
        result.push({ x: p.x + nx * offset, y: p.y + ny * offset });
    }
    return result;
  },

  /**
   * Sutherland-Hodgman Polygon Clipping
   * Clips subjectPolygon against clipPolygon (must be convex).
   */
  clipPolygon(subjectPolygon, clipPolygon) {
    let outputList = subjectPolygon;
    let cp1 = clipPolygon[clipPolygon.length - 1];

    for (const cp2 of clipPolygon) {
        const inputList = outputList;
        outputList = [];
        let s = inputList[inputList.length - 1];

        for (const e of inputList) {
            if (this._isInside(cp1, cp2, e)) {
                if (!this._isInside(cp1, cp2, s)) {
                    outputList.push(this._intersection(cp1, cp2, s, e));
                }
                outputList.push(e);
            } else if (this._isInside(cp1, cp2, s)) {
                outputList.push(this._intersection(cp1, cp2, s, e));
            }
            s = e;
        }
        cp1 = cp2;
    }
    return outputList;
  },

  _isInside(cp1, cp2, p) {
    return (cp2.x - cp1.x) * (p.y - cp1.y) > (cp2.y - cp1.y) * (p.x - cp1.x);
  },

  _intersection(cp1, cp2, s, e) {
    const dc = { x: cp1.x - cp2.x, y: cp1.y - cp2.y };
    const dp = { x: s.x - e.x, y: s.y - e.y };
    const n1 = cp1.x * cp2.y - cp1.y * cp2.x;
    const n2 = s.x * e.y - s.y * e.x;
    const n3 = 1.0 / (dc.x * dp.y - dc.y * dp.x);
    return {
        x: (n1 * dp.x - n2 * dc.x) * n3,
        y: (n1 * dp.y - n2 * dc.y) * n3
    };
  },

  /**
   * Returns a point shifted by noise/jitter.
   */
  jitterPoint(p, amount, rng) {
    return {
      x: p.x + (rng() - 0.5) * amount,
      y: p.y + (rng() - 0.5) * amount
    };
  },

  /**
   * Area of a polygon using Shoelace formula.
   */
  polygonArea(poly) {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
        let j = (i + 1) % poly.length;
        area += poly[i].x * poly[j].y;
        area -= poly[j].x * poly[i].y;
    }
    return Math.abs(area) / 2;
  },

  /**
   * Centroid of a polygon.
   */
  polygonCentroid(poly) {
    let x = 0, y = 0, area = 0;
    for (let i = 0; i < poly.length; i++) {
        let j = (i + 1) % poly.length;
        let f = poly[i].x * poly[j].y - poly[j].x * poly[i].y;
        x += (poly[i].x + poly[j].x) * f;
        y += (poly[i].y + poly[j].y) * f;
        area += f;
    }
    area *= 3; // Shoelace area is area*2, centroid uses area*6
    return { x: x / area, y: y / area };
  }
};

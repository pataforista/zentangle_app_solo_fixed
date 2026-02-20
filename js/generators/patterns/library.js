/**
 * library.js
 * Layer 3: Collection of Zentangle patterns.
 */

import { Pattern } from "./patternDSL.js";
import { GeometryCore } from "../../core/geometryCore.js";
import { rFloat, pick } from "../../core/prng.js";

export class FluxPattern extends Pattern {
    constructor() { super("flux"); }
    _execute(cell, rng, pen, params) {
        // Parallel curves with variable spacing
        const poly = cell.polygon;
        const centroid = cell.centroid;
        const spacing = params.spacing || 2;

        // Find a main axis (long side)
        let maxDist = 0;
        let p1 = poly[0], p2 = poly[1];
        for (let i = 0; i < poly.length; i++) {
            for (let j = i + 1; j < poly.length; j++) {
                const d = GeometryCore.dist(poly[i], poly[j]);
                if (d > maxDist) { maxDist = d; p1 = poly[i]; p2 = poly[j]; }
            }
        }

        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        const perp = angle + Math.PI / 2;

        for (let i = -10; i < 10; i++) {
            const offset = i * spacing;
            const lineP1 = { x: p1.x + Math.cos(perp) * offset, y: p1.y + Math.sin(perp) * offset };
            const lineP2 = { x: p2.x + Math.cos(perp) * offset, y: p2.y + Math.sin(perp) * offset };

            // In a real implementation we would clip this line to the cell
            // For now, simple line between offset points
            pen.line(lineP1, lineP2);
        }
    }
}

export class HollibaughPattern extends Pattern {
    constructor() { super("hollibaugh"); }
    _execute(cell, rng, pen, params) {
        // Cross-hatching ribbons (the "over-under" effect)
        const poly = cell.polygon;
        const count = params.count || 5;
        const width = params.width || 3;

        for (let i = 0; i < count; i++) {
            const angle = rng() * Math.PI * 2;
            const p = GeometryCore.jitterPoint(cell.centroid, 10, rng);
            const dx = Math.cos(angle);
            const dy = Math.sin(angle);

            const linePoints = [
                { x: p.x - dx * 100, y: p.y - dy * 100 },
                { x: p.x + dx * 100, y: p.y + dy * 100 }
            ];

            const offset1 = GeometryCore.offsetPolyline(linePoints, width / 2);
            const offset2 = GeometryCore.offsetPolyline(linePoints, -width / 2);

            pen.line(offset1[0], offset1[1]);
            pen.line(offset2[0], offset2[1]);
        }
    }
}

export class PrintempsPattern extends Pattern {
    constructor() { super("printemps"); }
    _execute(cell, rng, pen, params) {
        // Spirals / petals
        const area = GeometryCore.polygonArea(cell.polygon);
        const spiralCount = Math.floor(area / 100);

        for (let i = 0; i < spiralCount; i++) {
            const p = GeometryCore.jitterPoint(cell.centroid, Math.sqrt(area) / 2, rng);
            const radius = 2 + rng() * 5;
            // Simplified spiral: concentric circles
            for (let r = 1; r <= radius; r += 1.5) {
                pen.circle(p, r);
            }
        }
    }
}

export class CrescentMoonPattern extends Pattern {
    constructor() { super("crescent_moon"); }
    _execute(cell, rng, pen, params) {
        // Half moons along the borders
        const poly = cell.polygon;
        for (let i = 0; i < poly.length; i++) {
            const p1 = poly[i];
            const p2 = poly[(i + 1) % poly.length];
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const angle = Math.atan2(dy, dx);
            const perp = angle - Math.PI / 2;

            const moonCenter = { x: mid.x + Math.cos(perp) * 2, y: mid.y + Math.sin(perp) * 2 };
            pen.circle(moonCenter, 2);
            // Echo arcs
            pen.circle(moonCenter, 3.5);
            pen.circle(moonCenter, 5);
        }
    }
}

export const PATTERN_LIBRARY = {
    flux: new FluxPattern(),
    hollibaugh: new HollibaughPattern(),
    printemps: new PrintempsPattern(),
    crescent_moon: new CrescentMoonPattern()
};

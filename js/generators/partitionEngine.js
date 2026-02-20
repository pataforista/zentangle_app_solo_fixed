/**
 * partitionEngine.js
 * Layer 2: Spatial partitioning and layout.
 * Generates the "String" or the "Grid" of cells.
 */

import { GeometryCore } from "../core/geometryCore.js";
import { createRNG, rFloat, pick } from "../core/prng.js";

// We'll use a dynamic import or assume d3 is globally available/imported in index.html
// For this standalone module, we define the interface we expect.
let Delaunay;

export async function initPartitionEngine() {
    if (!Delaunay) {
        const module = await import("https://cdn.skypack.dev/d3-delaunay@6");
        Delaunay = module.Delaunay;
    }
}

export class PartitionEngine {
    constructor(area, seed) {
        this.area = area; // {x, y, w, h}
        this.seed = seed;
        this.rng = createRNG(seed);
    }

    /**
     * Generates cells using Lloyd-relaxed Voronoi.
     */
    async generateVoronoi(count, iterations = 3) {
        await initPartitionEngine();

        const points = [];
        for (let i = 0; i < count; i++) {
            points.push([
                this.area.x + this.rng() * this.area.w,
                this.area.y + this.rng() * this.area.h
            ]);
        }

        const bbox = [this.area.x, this.area.y, this.area.x + this.area.w, this.area.y + this.area.h];
        let delaunay, voronoi;

        for (let it = 0; it < iterations; it++) {
            delaunay = Delaunay.from(points);
            voronoi = delaunay.voronoi(bbox);

            for (let i = 0; i < points.length; i++) {
                const polygon = voronoi.cellPolygon(i);
                if (polygon) {
                    const polyPoints = polygon.map(p => ({ x: p[0], y: p[1] }));
                    const centroid = GeometryCore.polygonCentroid(polyPoints);
                    points[i] = [centroid.x, centroid.y];
                }
            }
        }

        delaunay = Delaunay.from(points);
        voronoi = delaunay.voronoi(bbox);

        const cells = [];
        for (let i = 0; i < points.length; i++) {
            const polygon = voronoi.cellPolygon(i);
            if (polygon) {
                const polyPoints = polygon.map(p => ({ x: p[0], y: p[1] }));
                cells.push({
                    id: i,
                    polygon: polyPoints,
                    centroid: { x: points[i][0], y: points[i][1] },
                    seed: this.seed + i
                });
            }
        }
        return cells;
    }

    /**
     * Generates a "String" based partition (classic Zentangle).
     */
    generateString(complexity = 1) {
        // Start with the full rectangle as a single polygon
        let polygons = [[
            { x: this.area.x, y: this.area.y },
            { x: this.area.x + this.area.w, y: this.area.y },
            { x: this.area.x + this.area.w, y: this.area.y + this.area.h },
            { x: this.area.x, y: this.area.y + this.area.h }
        ]];

        const stringCount = 2 + Math.floor(this.rng() * 2) * complexity;

        for (let i = 0; i < stringCount; i++) {
            const newPolygons = [];
            for (const poly of polygons) {
                this._splitPolygon(poly, newPolygons);
            }
            polygons = newPolygons;
        }

        return polygons.map((p, i) => ({
            id: i,
            polygon: p,
            centroid: GeometryCore.polygonCentroid(p),
            seed: this.seed + i
        }));
    }

    _splitPolygon(poly, results) {
        if (GeometryCore.polygonArea(poly) < 400 || this.rng() < 0.2) {
            results.push(poly);
            return;
        }

        const centroid = GeometryCore.polygonCentroid(poly);
        const angle = this.rng() * Math.PI * 2;
        const dx = Math.cos(angle);
        const dy = Math.sin(angle);

        const p1 = { x: centroid.x - dx * 1000, y: centroid.y - dy * 1000 };
        const p2 = { x: centroid.x + dx * 1000, y: centroid.y + dy * 1000 };

        const clip1 = [
            p1, p2,
            { x: p2.x + dy * 2000, y: p2.y - dx * 2000 },
            { x: p1.x + dy * 2000, y: p1.y - dx * 2000 }
        ];
        const clip2 = [
            p1, p2,
            { x: p2.x - dy * 2000, y: p2.y + dx * 2000 },
            { x: p1.x - dy * 2000, y: p1.y + dx * 2000 }
        ];

        const part1 = GeometryCore.clipPolygon(poly, clip1);
        const part2 = GeometryCore.clipPolygon(poly, clip2);

        if (part1.length >= 3 && GeometryCore.polygonArea(part1) > 10) {
            this._splitPolygon(part1, results);
        }
        if (part2.length >= 3 && GeometryCore.polygonArea(part2) > 10) {
            this._splitPolygon(part2, results);
        }
    }

    /**
     * Applies internal padding and validates cells.
     */
    validateAndRefine(cells, paddingMm = 2) {
        return cells
            .map(cell => {
                const area = GeometryCore.polygonArea(cell.polygon);
                if (area < 25) return null; // Min area rule

                // Internal padding: slightly offset the polygon inwards
                const paddedPoly = cell.polygon.map(p => ({
                    x: GeometryCore.lerp(p.x, cell.centroid.x, paddingMm / 10),
                    y: GeometryCore.lerp(p.y, cell.centroid.y, paddingMm / 10)
                }));

                return { ...cell, polygon: paddedPoly };
            })
            .filter(Boolean);
    }
}

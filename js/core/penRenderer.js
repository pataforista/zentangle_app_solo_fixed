/**
 * penRenderer.js
 * Layer 4: Abstract drawing interface and ink simulation.
 * Handles stroke weights, line caps, and micro-variations.
 */

import { PathBuilder } from "./pathBuilder.js";
import { GeometryCore } from "./geometryCore.js";

export class AbstractPen {
    constructor(options = {}) {
        this.stroke = options.stroke || "#000";
        this.strokeWidth = options.strokeWidth || 0.35;
        this.linecap = options.linecap || "round";
        this.linejoin = options.linejoin || "round";
        this.sketchy = options.sketchy || 0;
        this.rng = options.rng || Math.random;

        // Budgeting
        this.budget = options.budget || Infinity;
        this.strokesUsed = 0;
    }

    hasBudget() {
        return this.strokesUsed < this.budget;
    }

    useStroke() {
        this.strokesUsed++;
    }

    // To be implemented by subclasses
    line(p1, p2) { }
    bezier(points) { } // Quadratic or Cubic
    circle(p, r) { }
    polygon(points, close = true) { }
}

export class SVGPen extends AbstractPen {
    constructor(options = {}) {
        super(options);
        this.builder = new PathBuilder({
            sketchy: this.sketchy,
            rng: this.rng
        });
    }

    line(p1, p2) {
        if (!this.hasBudget()) return;
        this.builder.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
        this.useStroke();
    }

    polyline(points) {
        if (!this.hasBudget() || points.length < 2) return;
        this.builder.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.builder.lineTo(points[i].x, points[i].y);
        }
        this.useStroke();
    }

    bezier(points) {
        if (!this.hasBudget()) return;
        if (points.length === 3) {
            this.builder.moveTo(points[0].x, points[0].y)
                .quadTo(points[1].x, points[1].y, points[2].x, points[2].y);
        } else if (points.length === 4) {
            this.builder.moveTo(points[0].x, points[0].y)
                .cubicTo(points[1].x, points[1].y, points[2].x, points[2].y, points[3].x, points[3].y);
        }
        this.useStroke();
    }

    circle(p, r) {
        if (!this.hasBudget()) return;
        this.builder.circle(p.x, p.y, r);
        this.useStroke();
    }

    polygon(points, close = true) {
        if (!this.hasBudget() || points.length < 2) return;
        this.builder.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) {
            this.builder.lineTo(points[i].x, points[i].y);
        }
        if (close) this.builder.close();
        this.useStroke();
    }

    getSVGPath() {
        return this.builder.toPath({
            stroke: this.stroke,
            strokeWidthMm: this.strokeWidth,
            linecap: this.linecap,
            linejoin: this.linejoin
        });
    }
}

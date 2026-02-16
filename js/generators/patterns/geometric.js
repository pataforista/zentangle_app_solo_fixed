import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

function _isValidRect(r) {
    return (r.x1 > r.x0 + 0.25) && (r.y1 > r.y0 + 0.25);
}

export function fillConcentricSquares(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const step = rFloat(rng, Math.max(cfg.minGapMm * 1.25, minDim * 0.06), Math.max(cfg.minGapMm * 1.45, minDim * 0.10));
    let x0 = r.x0, y0 = r.y0, x1 = r.x1, y1 = r.y1;
    while (x1 - x0 > step * 1.15 && y1 - y0 > step * 1.15) {
        b.moveTo(x0, y0).lineTo(x1, y0).lineTo(x1, y1).lineTo(x0, y1).close();
        x0 += step; y0 += step; x1 -= step; y1 -= step;
    }
    return b.d;
}

export function fillAuraSquares(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
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

export function fillCrosses(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const step = rFloat(rng, Math.max(cfg.minGapMm * 2.4, 3), Math.max(cfg.minGapMm * 3, 5));
    const s = step * 0.25;
    const sw = cfg.patternStrokeMm;

    for (let x = r.x0 + step / 2; x < r.x1; x += step) {
        for (let y = r.y0 + step / 2; y < r.y1; y += step) {
            b.taperedLine(x - s, y - s, x + s, y + s, sw);
            b.taperedLine(x + s, y - s, x - s, y + s, sw);
        }
    }
    return b.d;
}

export function fillTriangles(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const count = rInt(rng, 5, 12);
    const sw = cfg.patternStrokeMm;
    for (let i = 0; i < count; i++) {
        const p1 = { x: rFloat(rng, r.x0, r.x1), y: rFloat(rng, r.y0, r.y1) };
        const p2 = { x: rFloat(rng, r.x0, r.x1), y: rFloat(rng, r.y0, r.y1) };
        const p3 = { x: rFloat(rng, r.x0, r.x1), y: rFloat(rng, r.y0, r.y1) };

        b.taperedLine(p1.x, p1.y, p2.x, p2.y, sw);
        b.taperedLine(p2.x, p2.y, p3.x, p3.y, sw);
        b.taperedLine(p3.x, p3.y, p1.x, p1.y, sw);
    }
    return b.d;
}

export function fillAura(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    const minDim = Math.min(w, h);
    const steps = rInt(rng, 3, 6);
    const stepSize = (minDim * 0.45) / steps;

    for (let i = 0; i < steps; i++) {
        const inset = i * stepSize;
        const box = {
            x0: r.x0 + inset,
            y0: r.y0 + inset,
            x1: r.x1 - inset,
            y1: r.y1 - inset
        };
        if (!_isValidRect(box)) break;

        const cornerR = Math.max(0.5, stepSize * 0.5);
        b.moveTo(box.x0 + cornerR, box.y0)
            .lineTo(box.x1 - cornerR, box.y0)
            .arcTo(cornerR, cornerR, 0, 0, 1, box.x1, box.y0 + cornerR)
            .lineTo(box.x1, box.y1 - cornerR)
            .arcTo(cornerR, cornerR, 0, 0, 1, box.x1 - cornerR, box.y1)
            .lineTo(box.x0 + cornerR, box.y1)
            .arcTo(cornerR, cornerR, 0, 0, 1, box.x0, box.y1 - cornerR)
            .lineTo(box.x0, box.y0 + cornerR)
            .arcTo(cornerR, cornerR, 0, 0, 1, box.x0 + cornerR, box.y0)
            .close();
    }
    return b.d;
}

export function fillCircuit(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    const nodesCount = rInt(rng, 3, 6);
    const nodes = [];

    // Create nodes
    for (let i = 0; i < nodesCount; i++) {
        const x = rFloat(rng, r.x0 + w * 0.1, r.x1 - w * 0.1);
        const y = rFloat(rng, r.y0 + h * 0.1, r.y1 - h * 0.1);
        nodes.push({ x, y });
        // Node circle
        b.circle(x, y, rFloat(rng, 0.5, 1.2));
    }

    // Connect nodes with "PCB traces" (manhattan + 45deg)
    // For simplicity: simple L-shapes or Z-shapes
    for (let i = 0; i < nodes.length; i++) {
        const n1 = nodes[i];
        const n2 = nodes[(i + 1) % nodes.length];

        // Draw trace
        b.moveTo(n1.x, n1.y);

        // Simple mid-point turn
        const midX = (n1.x + n2.x) / 2;
        if (rng() < 0.5) {
            b.lineTo(midX, n1.y);
            b.lineTo(midX, n2.y);
        } else {
            b.lineTo(n1.x, (n1.y + n2.y) / 2);
            b.lineTo(n2.x, (n1.y + n2.y) / 2);
        }
        b.lineTo(n2.x, n2.y);
    }

    return b.d;
}

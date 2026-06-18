import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

function _isValidRect(r) {
    return (r.x1 > r.x0 + 0.25) && (r.y1 > r.y0 + 0.25);
}

export function fillConcentricSquares(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const step = rFloat(rng, Math.max(cfg.minGapMm * 0.8, minDim * 0.04), Math.max(cfg.minGapMm * 1.1, minDim * 0.07));
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
    const step = rFloat(rng, Math.max(cfg.minGapMm * 0.9, minDim * 0.05), Math.max(cfg.minGapMm * 1.2, minDim * 0.08));
    const aura = rFloat(rng, Math.max(0.25, cfg.minGapMm * 0.2), Math.min(step * 0.4, 0.8));
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
    const step = rFloat(rng, Math.max(cfg.minGapMm * 1.2, 1.5), Math.max(cfg.minGapMm * 1.8, 2.5));
    const s = step * 0.35; // slightly larger relative cross
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
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    const minDim = Math.min(w, h);
    // Clean isometric triangular grid (recognizable tangle, leaves white space to color)
    const rows = Math.max(2, Math.round(minDim / Math.max(cfg.minGapMm * 3.0, 5)));
    const stepY = h / rows;
    const stepX = stepY * 1.1547; // equilateral-ish (2/sqrt3)
    const cols = Math.max(2, Math.round(w / stepX));
    const dx = w / cols;

    // Horizontal rails
    for (let j = 0; j <= rows; j++) {
        const y = r.y0 + j * stepY;
        b.moveTo(r.x0, y).lineTo(r.x1, y);
    }
    // Alternating diagonals row by row -> rows of up/down triangles
    for (let j = 0; j < rows; j++) {
        const yTop = r.y0 + j * stepY;
        const yBot = yTop + stepY;
        const shift = (j % 2) ? dx / 2 : 0;
        for (let i = -1; i <= cols; i++) {
            const x = r.x0 + i * dx + shift;
            b.moveTo(x, yBot).lineTo(x + dx / 2, yTop);
            b.moveTo(x + dx / 2, yTop).lineTo(x + dx, yBot);
        }
    }
    return b.d;
}

export function fillAura(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    const minDim = Math.min(w, h);
    const steps = rInt(rng, 5, 12);
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
    const minDim = Math.min(w, h);
    const step = rFloat(rng, Math.max(cfg.minGapMm * 1.5, minDim * 0.1), Math.max(cfg.minGapMm * 2.5, minDim * 0.2));
    const sw = cfg.patternStrokeMm;
    
    // Draw an orthogonal circuit board (Manhattan routing)
    let y = r.y0 + step / 2;
    while (y < r.y1) {
        let x = r.x0 + step / 2;
        b.moveTo(x, y);
        while (x < r.x1) {
            const nextX = Math.min(r.x1, x + step * rInt(rng, 1, 4));
            b.lineTo(nextX, y);
            
            if (rng() < 0.3 && nextX < r.x1) {
                // Draw a node
                b.circle(nextX, y, rFloat(rng, 0.4, 0.9));
                // Optional vertical branch
                if (rng() < 0.5) {
                    const dirY = rng() < 0.5 ? 1 : -1;
                    const branchY = y + dirY * step * rInt(rng, 1, 3);
                    if (branchY > r.y0 && branchY < r.y1) {
                        b.moveTo(nextX, y);
                        b.lineTo(nextX, branchY);
                        b.circle(nextX, branchY, rFloat(rng, 0.3, 0.7));
                    }
                }
                b.moveTo(nextX, y);
            }
            x = nextX;
        }
        y += step;
    }

    return b.d;
}

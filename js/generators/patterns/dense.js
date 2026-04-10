import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

// Re-export shared patterns from geometric/organic if needed for "dense" family,
// or import them in logical grouper.
// For now, if 'dense' array uses them, we might need to export them here or handle in index.
// But mostly we just put explicit dense patterns here.

export function fillStippling(rng, r, cfg, isMeta = false) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    const area = w * h;
    const density = isMeta ? 0.15 : 0.4;
    const count = Math.floor(area * density);

    for (let i = 0; i < count; i++) {
        let x = rFloat(rng, r.x0, r.x1);
        let y = rFloat(rng, r.y0, r.y1);

        const rad = rFloat(rng, 0.1, 0.25);

        if (!isMeta) {
            const distToEdge = Math.min(x - r.x0, r.x1 - x, y - r.y0, r.y1 - y);
            const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
            // Perceptual stippling: higher density towards the center or intentionally grouped
            const prob = Math.min(0.9, 0.2 + (distToEdge / (minDim * 0.5)) * 0.7);
            if (rng() > prob) continue;
        }

        b.circle(x, y, rad);
    }
    return b.d;
}

export function fillPokerChips(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const radius = rFloat(rng, minDim * 0.15, minDim * 0.25);
    const thickness = radius * 0.3;

    // Random stack position
    const cx = (r.x0 + r.x1) / 2;
    const cy = (r.y0 + r.y1) / 2 + (r.y1 - r.y0) * 0.2;

    const chips = rInt(rng, 3, 7);

    // Draw stack from bottom up
    for (let i = 0; i < chips; i++) {
        const y = cy - i * thickness;
        // Ellipse approx
        const rx = radius;
        const ry = radius * 0.4;

        // Side
        b.moveTo(cx - rx, y);
        b.lineTo(cx - rx, y - thickness);
        // Arc top back (hidden? no, drawn for sketchy look or skipped)
        // Arc top front
        b.lineTo(cx + rx, y - thickness); // Just straight for side??
        // Let's do a proper cylinder

        // Top face
        b.circle(cx, y - thickness, rx); // Wrong, circle is circle. We need ellipse.
        // PathBuilder circle is circle.
        // We construct ellipse manually
        _ellipse(b, cx, y - thickness, rx, ry);

        // Side body
        // If we want it solid, we can't really do hidden line removal easily in simplified SVG without masks.
        // So we just draw outlines: wireframe stack.

        // Side lines
        b.moveTo(cx - rx, y - thickness);
        b.lineTo(cx - rx, y);
        b.arcTo(rx, ry, 0, 0, 0, cx + rx, y); // Bottom curve
        b.lineTo(cx + rx, y - thickness);
    }

    return b.d;
}

function _ellipse(b, cx, cy, rx, ry) {
    b.moveTo(cx - rx, cy);
    b.arcTo(rx, ry, 0, 1, 0, cx + rx, cy);
    b.arcTo(rx, ry, 0, 1, 0, cx - rx, cy);
}

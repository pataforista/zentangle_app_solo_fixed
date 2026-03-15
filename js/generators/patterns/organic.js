import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

export function fillStripesSmooth(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const isVertical = rng() > 0.5;
    const step = rFloat(rng, Math.max(cfg.minGapMm * 1.0, minDim * 0.05), Math.max(cfg.minGapMm * 1.25, minDim * 0.09));
    const amp = rFloat(rng, 0.4, Math.max(0.9, Math.min(minDim * 0.05, cfg.minGapMm * 0.9)));

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

export function fillCircles(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    const minDim = Math.min(w, h);
    let radius = rFloat(rng, Math.max(0.6, cfg.minGapMm * 0.35), Math.max(0.9, minDim * 0.08));
    const pitch = radius * 2 + cfg.minGapMm * 0.5;
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
            b.circle(cx, cy, radius);
        }
    }
    return b.d;
}

export function fillCurvesSmooth(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const stepY = rFloat(rng, Math.max(0.8, cfg.minGapMm * 0.9), Math.max(1.5, cfg.minGapMm * 1.5));
    const segX = rFloat(rng, stepY * 1.5, stepY * 3);
    const amp = rFloat(rng, 0.4, Math.max(0.8, minDim * 0.05));
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

export function fillScallops(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const step = rFloat(rng, cfg.minGapMm * 1.8, cfg.minGapMm * 2.5);
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

export function fillSpiralBands(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
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

export function fillFlow(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const cols = Math.max(3, Math.floor((r.x1 - r.x0) / (cfg.minGapMm * 2.5)));
    const stepX = (r.x1 - r.x0) / cols;

    for (let i = 0; i <= cols; i++) {
        const xBase = r.x0 + i * stepX;
        if (i === 0 || i === cols) continue;

        const c1x = xBase + rFloat(rng, -minDim * 0.3, minDim * 0.3);
        const c1y = r.y0 + (r.y1 - r.y0) * 0.33;
        const c2x = xBase + rFloat(rng, -minDim * 0.3, minDim * 0.3);
        const c2y = r.y0 + (r.y1 - r.y0) * 0.66;
        const destX = xBase + rFloat(rng, -stepX, stepX);

        b.moveTo(xBase, r.y0);
        b.cubicTo(c1x, c1y, c2x, c2y, destX, r.y1);

        if (rng() < 0.5) {
            const gap = cfg.minGapMm * 0.6;
            b.moveTo(xBase + gap, r.y0);
            b.cubicTo(c1x + gap, c1y, c2x + gap, c2y, destX + gap, r.y1);
        }
    }
    return b.d;
}

export function fillWaves(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const stepY = rFloat(rng, Math.max(1.0, cfg.minGapMm * 1.5), Math.max(2.0, cfg.minGapMm * 3.0));
    const freq = rFloat(rng, 0.1, 0.3);
    const amp = rFloat(rng, 0.5, Math.max(1.0, minDim * 0.08));

    for (let y = r.y0 + stepY/2; y < r.y1; y += stepY) {
        b.moveTo(r.x0, y);
        const steps = 20;
        const dx = (r.x1 - r.x0) / steps;
        for (let i = 0; i <= steps; i++) {
            const x = r.x0 + i * dx;
            const waveY = y + Math.sin(x * freq) * amp;
            b.lineTo(x, waveY);
        }
    }
    return b.d;
}

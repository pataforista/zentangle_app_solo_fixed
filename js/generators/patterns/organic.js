import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

export function fillStripesSmooth(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const isVertical = rng() > 0.5;
    // Sin líneas "gemelas" a 0.5 mm: dejaban hilos blancos sin espacio para colorear.
    const step = rFloat(rng, Math.max(cfg.minGapMm * 1.2, minDim * 0.05), Math.max(cfg.minGapMm * 1.5, minDim * 0.09));
    const amp = rFloat(rng, 0.4, Math.max(0.9, Math.min(minDim * 0.05, cfg.minGapMm * 0.9)));

    if (isVertical) {
        for (let x = r.x0 + step; x < r.x1; x += step) {
            const midY = (r.y0 + r.y1) / 2;
            b.moveTo(x, r.y0).quadTo(x + amp, (r.y0 + midY) / 2, x, midY).quadTo(x - amp, (midY + r.y1) / 2, x, r.y1);
        }
    } else {
        for (let y = r.y0 + step; y < r.y1; y += step) {
            const midX = (r.x0 + r.x1) / 2;
            b.moveTo(r.x0, y).quadTo((r.x0 + midX) / 2, y + amp, midX, y).quadTo((midX + r.x1) / 2, y - amp, r.x1, y);
        }
    }
    return b.d;
}

export function fillCircles(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const w = r.x1 - r.x0, h = r.y1 - r.y0;
    const minDim = Math.min(w, h);
    // Radio mínimo ~1.6 mm: con 0.6-0.9 mm el interior del círculo no admitía
    // ni la punta de un marcador fino.
    const rMin = Math.max(1.6, cfg.minGapMm * 0.8);
    let radius = rFloat(rng, rMin, Math.max(rMin * 1.2, minDim * 0.09));
    const pitch = radius * 2 + cfg.minGapMm * 0.5;
    const cols = Math.max(1, Math.floor(w / pitch));
    const rows = Math.max(1, Math.floor(h / pitch));

    if (cols > 1) radius = Math.min(radius, (w - (cols + 1) * cfg.minGapMm) / (cols * 2));
    if (rows > 1) radius = Math.min(radius, (h - (rows + 1) * cfg.minGapMm) / (rows * 2));
    if (radius < rMin * 0.9) return null;

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

// Espiral de bandas: dos brazos de Arquímedes entrelazados (desfasados π)
// que nacen juntos en el foco y cubren toda la celda con bandas de ancho
// constante, listas para colorear. Antes eran 2-4 espirales sueltas que se
// cortaban a medio giro y dejaban la celda con aspecto inacabado.
export function fillSpiralBands(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const f = cfg.focus || { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, r: minDim / 2 };
    if (f.r < cfg.minGapMm * 2.5) return null;

    // pitch = separación entre vueltas del mismo brazo; banda = pitch / 2
    const pitch = Math.max(cfg.minGapMm * 3.6, f.r / rInt(rng, 3, 5));
    const reach = Math.max(
        Math.hypot(f.x - r.x0, f.y - r.y0), Math.hypot(f.x - r.x1, f.y - r.y0),
        Math.hypot(f.x - r.x0, f.y - r.y1), Math.hypot(f.x - r.x1, f.y - r.y1));
    const thetaMax = Math.min(16, reach / pitch) * Math.PI * 2;
    const dir = rng() < 0.5 ? 1 : -1;
    const a0 = rFloat(rng, 0, Math.PI * 2);
    const maxSegLenMm = 1.2;

    for (const arm of [0, Math.PI]) {
        let th = 0;
        b.moveTo(f.x, f.y);
        while (th < thetaMax) {
            const rad = (pitch * th) / (Math.PI * 2);
            th += Math.min(0.35, maxSegLenMm / Math.max(rad, 0.5));
            const rr = (pitch * th) / (Math.PI * 2);
            const a = a0 + arm + dir * th;
            b.lineTo(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr);
        }
    }
    return b.d;
}

export function fillFlow(rng, r, cfg) {
    const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
    const minDim = Math.min(r.x1 - r.x0, r.y1 - r.y0);
    const cols = Math.max(3, Math.floor((r.x1 - r.x0) / (cfg.minGapMm * 2.5)));
    const stepX = (r.x1 - r.x0) / cols;

    for (let i = 1; i < cols; i++) {
        const xBase = r.x0 + i * stepX;

        // Intentional Bézier points: follow a main flow axis with controlled curvature
        const cp1x = xBase + (i % 2 === 0 ? stepX * 0.4 : -stepX * 0.4);
        const cp1y = r.y0 + (r.y1 - r.y0) * 0.33;
        const cp2x = xBase + (i % 2 === 0 ? -stepX * 0.4 : stepX * 0.4);
        const cp2y = r.y0 + (r.y1 - r.y0) * 0.66;
        const destX = xBase;

        b.moveTo(xBase, r.y0);
        b.cubicTo(cp1x, cp1y, cp2x, cp2y, destX, r.y1);

        if (rng() < 0.4) {
            const gap = cfg.minGapMm * 0.7;
            b.moveTo(xBase + gap, r.y0);
            b.cubicTo(cp1x + gap, cp1y, cp2x + gap, cp2y, destX + gap, r.y1);
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
        const segs = 4;
        const dx = (r.x1 - r.x0) / segs;
        for (let i = 0; i < segs; i++) {
            const x1 = r.x0 + i * dx;
            const x2 = r.x0 + (i + 1) * dx;
            const mx = (x1 + x2) / 2;
            const flip = (i % 2 === 0) ? 1 : -1;
            b.quadTo(mx, y + amp * flip, x2, y);
        }
    }
    return b.d;
}

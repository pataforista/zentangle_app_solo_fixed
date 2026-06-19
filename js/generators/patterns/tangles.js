// Tangles "auténticos": patrones reconocibles del vocabulario Zentangle,
// construidos a partir de primitivas repetidas (rejillas, perlas, espirales,
// medias lunas). Diseñados para ser COLOREABLES: contornos sobre blanco,
// sin masas negras. Todos devuelven un string de path `d`.
import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

// ---------------------------------------------------------------------------
// CADENT: rejilla de "perlas" conectadas por curvas en S => aspecto tejido.
// ---------------------------------------------------------------------------
export function fillCadent(rng, r, cfg) {
  const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const minDim = Math.min(w, h);
  const g = Math.max(cfg.minGapMm * 2.6, minDim / rInt(rng, 4, 6));
  const cols = Math.max(2, Math.round(w / g));
  const rows = Math.max(2, Math.round(h / g));
  const dx = w / cols, dy = h / rows;
  const rp = Math.min(dx, dy) * 0.20; // radio de la perla
  const bow = Math.min(dx, dy) * 0.28; // curvatura de la S

  const X = (i) => r.x0 + i * dx;
  const Y = (j) => r.y0 + j * dy;

  // Perlas
  for (let i = 0; i <= cols; i++)
    for (let j = 0; j <= rows; j++) b.circle(X(i), Y(j), rp);

  // Conectores horizontales (curva en S entre perlas vecinas)
  for (let j = 0; j <= rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x1 = X(i) + rp, x2 = X(i + 1) - rp, y = Y(j);
      const dir = ((i + j) % 2 === 0) ? 1 : -1;
      b.moveTo(x1, y)
       .cubicTo(x1 + (x2 - x1) * 0.35, y - bow * dir,
                x2 - (x2 - x1) * 0.35, y + bow * dir, x2, y);
    }
  }
  // Conectores verticales
  for (let i = 0; i <= cols; i++) {
    for (let j = 0; j < rows; j++) {
      const y1 = Y(j) + rp, y2 = Y(j + 1) - rp, x = X(i);
      const dir = ((i + j) % 2 === 0) ? -1 : 1;
      b.moveTo(x, y1)
       .cubicTo(x - bow * dir, y1 + (y2 - y1) * 0.35,
                x + bow * dir, y2 - (y2 - y1) * 0.35, x, y2);
    }
  }
  return b.d;
}

// ---------------------------------------------------------------------------
// TIPPLE: burbujas de tamaños variados empaquetadas (sin solaparse).
// ---------------------------------------------------------------------------
export function fillTipple(rng, r, cfg) {
  const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const minDim = Math.min(w, h);
  const rMax = Math.max(cfg.minGapMm * 1.6, minDim * 0.16);
  const rMin = Math.max(0.7, rMax * 0.22);
  const gap = cfg.minGapMm * 0.55;
  const placed = [];
  const attempts = 380;

  for (let a = 0; a < attempts; a++) {
    // sesgo hacia círculos pequeños para rellenar huecos
    const rad = rMin + Math.pow(rng(), 1.7) * (rMax - rMin);
    const cx = r.x0 + rad + rng() * (w - 2 * rad);
    const cy = r.y0 + rad + rng() * (h - 2 * rad);
    let ok = true;
    for (const p of placed) {
      if (Math.hypot(cx - p.x, cy - p.y) < rad + p.r + gap) { ok = false; break; }
    }
    if (ok) { placed.push({ x: cx, y: cy, r: rad }); b.circle(cx, cy, rad); }
  }
  return b.d;
}

// ---------------------------------------------------------------------------
// PRINTEMPS: rejilla de espirales (rollos) compactos.
// ---------------------------------------------------------------------------
export function fillPrintemps(rng, r, cfg) {
  const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const minDim = Math.min(w, h);
  const cell = Math.max(cfg.minGapMm * 3.2, minDim / rInt(rng, 3, 5));
  const cols = Math.max(1, Math.round(w / cell));
  const rows = Math.max(1, Math.round(h / cell));
  const dx = w / cols, dy = h / rows;
  const maxR = Math.min(dx, dy) * 0.42;

  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const cx = r.x0 + dx * (i + 0.5) + (j % 2 ? dx * 0.12 : 0);
      const cy = r.y0 + dy * (j + 0.5);
      _spiral(b, cx, cy, maxR, rFloat(rng, 0, Math.PI * 2), rng() < 0.5 ? 1 : -1);
    }
  }
  return b.d;
}

function _spiral(b, cx, cy, maxR, a0, dir) {
  const turns = 2.6;
  const total = turns * Math.PI * 2;
  const steps = Math.max(18, Math.round(maxR * 6));
  b.moveTo(cx, cy);
  for (let s = 1; s <= steps; s++) {
    const t = s / steps;
    const a = a0 + dir * total * t;
    const rad = maxR * t;
    b.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
  }
}

// ---------------------------------------------------------------------------
// CRESCENT MOON: filas de "lunas" (bultos) con auras concéntricas dentro.
// ---------------------------------------------------------------------------
export function fillCrescentMoon(rng, r, cfg) {
  const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const minDim = Math.min(w, h);
  const rowH = Math.max(cfg.minGapMm * 4.0, minDim / rInt(rng, 3, 5));
  const bump = rowH * 0.42;            // radio del bulto
  const auras = 2;
  const auraGap = bump / (auras + 1.4);

  for (let y = r.y0 + rowH; y <= r.y1 + bump; y += rowH) {
    const baseY = Math.min(y, r.y1);
    let x = r.x0;
    let flip = 1;
    while (x + bump * 2 <= r.x1 + 0.5) {
      const cx = x + bump;
      // arco del bulto (semicírculo hacia arriba)
      b.moveTo(cx - bump, baseY)
       .arcTo(bump, bump, 0, 0, flip > 0 ? 1 : 0, cx + bump, baseY);
      // auras internas
      for (let k = 1; k <= auras; k++) {
        const rr = bump - k * auraGap;
        if (rr > 0.5)
          b.moveTo(cx - rr, baseY)
           .arcTo(rr, rr, 0, 0, flip > 0 ? 1 : 0, cx + rr, baseY);
      }
      x += bump * 2;
    }
  }
  return b.d;
}

// ---------------------------------------------------------------------------
// FLORZ: rejilla diagonal de rombos con un pequeño motivo en cada nodo.
// ---------------------------------------------------------------------------
export function fillFlorz(rng, r, cfg) {
  const b = new PathBuilder({ sketchy: cfg.sketchy, rng });
  const w = r.x1 - r.x0, h = r.y1 - r.y0;
  const minDim = Math.min(w, h);
  const g = Math.max(cfg.minGapMm * 2.4, minDim / rInt(rng, 4, 7));
  const cols = Math.max(2, Math.round(w / g));
  const rows = Math.max(2, Math.round(h / g));
  const dx = w / cols, dy = h / rows;
  const node = Math.min(dx, dy) * 0.16;

  // rejilla recta
  for (let j = 0; j <= rows; j++) {
    const y = r.y0 + j * dy;
    b.moveTo(r.x0, y).lineTo(r.x1, y);
  }
  for (let i = 0; i <= cols; i++) {
    const x = r.x0 + i * dx;
    b.moveTo(x, r.y0).lineTo(x, r.y1);
  }
  // Rombo solo en nodos INTERIORES: los del borde se recortarían a la mitad
  // por el clip de la celda y dejarían "flechas" feas.
  for (let i = 1; i < cols; i++) {
    for (let j = 1; j < rows; j++) {
      const x = r.x0 + i * dx, y = r.y0 + j * dy;
      b.moveTo(x, y - node).lineTo(x + node, y)
       .lineTo(x, y + node).lineTo(x - node, y).close();
    }
  }
  return b.d;
}

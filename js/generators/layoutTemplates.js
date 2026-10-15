/**
 * layoutTemplates.js
 * Strings predefinidos para el layout "template". Cada plantilla es una
 * partición de la página en coordenadas normalizadas (0..1): las regiones no
 * se solapan y cubren la página completa (antes "eye" dejaba dos franjas
 * laterales sin patrón y "spiral" apilaba un cuadro encima de otro).
 *
 * Cada plantilla es una función j => regiones, donde j(v, amp) devuelve v con
 * un temblor determinista: así cada página varía sin perder la figura.
 * zentangleCells subdivide después las regiones grandes.
 */

const P = (x, y) => ({ x, y });

export const LAYOUT_TEMPLATES = {
  // Z: trazo superior, diagonal y trazo inferior. Las cuatro regiones son
  // convexas y la Z se lee de un vistazo.
  classic_z: (j) => {
    const yT0 = j(0.2, 0.05), yT1 = j(0.24, 0.05);
    const yB0 = j(0.76, 0.05), yB1 = j(0.8, 0.05);
    const xD0 = j(0.82, 0.06), xD1 = j(0.18, 0.06);
    const yAt = (x, y0, y1) => y0 + (y1 - y0) * x;
    const dTop = P(xD0, yAt(xD0, yT0, yT1)), dBot = P(xD1, yAt(xD1, yB0, yB1));
    return [
      [P(0, 0), P(1, 0), P(1, yT1), dTop, P(0, yT0)],
      [P(0, yT0), dTop, dBot, P(0, yB0)],
      [dTop, P(1, yT1), P(1, yB1), dBot],
      [P(0, yB0), dBot, P(1, yB1), P(1, 1), P(0, 1)],
    ];
  },

  // S: curva que baja serpenteando de arriba abajo.
  classic_s: (j) => {
    const s = [P(j(0.5, 0.06), 0), P(j(0.62, 0.05), 0.3), P(j(0.38, 0.05), 0.7), P(j(0.5, 0.06), 1)];
    return [
      [P(0, 0), ...s, P(0, 1)],
      [P(1, 0), P(1, 1), ...s.slice().reverse()],
    ];
  },

  // Ojo: lente central y dos párpados que llegan hasta los bordes laterales.
  eye: (j) => {
    const yc = j(0.5, 0.04), xl = j(0.2, 0.04), xr = j(0.8, 0.04);
    const t = j(0.3, 0.04), b = j(0.7, 0.04);
    const L = P(xl, yc), R = P(xr, yc);
    const T1 = P(0.35, t), T2 = P(0.65, t), B1 = P(0.35, b), B2 = P(0.65, b);
    return [
      [L, T1, T2, R, B2, B1],
      [P(0, 0), P(1, 0), P(1, yc), R, T2, T1, L, P(0, yc)],
      [P(0, yc), L, B1, B2, R, P(1, yc), P(1, 1), P(0, 1)],
    ];
  },

  // Estallido: cuatro cuñas desde un centro desplazado.
  burst: (j) => {
    const c = P(j(0.5, 0.08), j(0.5, 0.08));
    return [
      [c, P(0, 0), P(1, 0)],
      [c, P(1, 0), P(1, 1)],
      [c, P(1, 1), P(0, 1)],
      [c, P(0, 1), P(0, 0)],
    ];
  },

  // Retícula 3x3 con líneas desplazadas.
  grid: (j) => {
    const xs = [0, j(1 / 3, 0.04), j(2 / 3, 0.04), 1];
    const ys = [0, j(1 / 3, 0.04), j(2 / 3, 0.04), 1];
    const out = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        out.push([P(xs[c], ys[r]), P(xs[c + 1], ys[r]), P(xs[c + 1], ys[r + 1]), P(xs[c], ys[r + 1])]);
      }
    }
    return out;
  },

  // Espiral áurea: en cada paso se corta una franja de la región restante
  // (izquierda, arriba, derecha, abajo...) y el resto sigue girando.
  spiral: (j) => {
    let x0 = 0, y0 = 0, x1 = 1, y1 = 1;
    const out = [];
    const f = j(0.42, 0.04);
    for (let k = 0; k < 5; k++) {
      const w = x1 - x0, h = y1 - y0;
      switch (k % 4) {
        case 0: { const x = x0 + w * f; out.push([P(x0, y0), P(x, y0), P(x, y1), P(x0, y1)]); x0 = x; break; }
        case 1: { const y = y0 + h * f; out.push([P(x0, y0), P(x1, y0), P(x1, y), P(x0, y)]); y0 = y; break; }
        case 2: { const x = x1 - w * f; out.push([P(x, y0), P(x1, y0), P(x1, y1), P(x, y1)]); x1 = x; break; }
        default: { const y = y1 - h * f; out.push([P(x0, y), P(x1, y), P(x1, y1), P(x0, y1)]); y1 = y; break; }
      }
    }
    out.push([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)]);
    return out;
  },
};

// rng opcional: sin él la plantilla sale en su forma canónica (sin temblor).
export function getTemplateCells(templateName, rect, rng = null) {
  const template = LAYOUT_TEMPLATES[templateName] || LAYOUT_TEMPLATES.classic_z;
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  const j = (v, amp) => (rng ? v + (rng() - 0.5) * 2 * amp : v);

  return template(j).map((poly01) => {
    const poly = poly01.map((p) => ({
      x: rect.x0 + p.x * w,
      y: rect.y0 + p.y * h,
    }));
    return { kind: "poly", bbox: _bbox(poly), poly };
  });
}

function _bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

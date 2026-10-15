// samplerTilings.js
// Teselados periódicos para el muestrario: en lugar de la retícula de cuadros,
// la hoja se reparte en hexágonos, octógonos + cuadrados (4.8²), dodecágonos +
// hexágonos + cuadrados (4.6.12), pentágonos de El Cairo o rombos (rombille).
// Coordenadas de Cairo y rombille tomadas de PeriodicTiling (Wolfram).
//
// Cada teselado se define por una celda primitiva: dos vectores de traslación y
// las teselas que contiene (arista = 1). "minor" marca las teselas chicas de los
// teselados con dos o tres tamaños: reciben texturas, no iconos.

const S3 = Math.sqrt(3);
const S2 = Math.SQRT2;

// Polígono regular de n lados con arista `edge`; la primera normal de arista
// apunta en el ángulo `normal0`.
function regular(cx, cy, n, edge, normal0 = 0) {
  const R = edge / (2 * Math.sin(Math.PI / n));
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = normal0 + Math.PI / n + (k * 2 * Math.PI) / n;
    pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
  }
  return pts;
}

const P = (pairs) => pairs.map(([x, y]) => ({ x, y }));

function cairo() {
  const a = (1 + S3) / 4, b = S3 / 6, c = (1 + S3) / 2, e = (2 + S3) / (2 * S3);
  return {
    v1: { x: c, y: c }, v2: { x: -c, y: c },
    tiles: [
      P([[0, b], [-a, a], [-b, c], [b, c], [a, a]]),
      P([[0, b], [a, a], [e, 0], [a, -a], [0, -b]]),
      P([[0, -b], [-a, -a], [-e, 0], [-a, a], [0, b]]),
      P([[0, -b], [a, -a], [b, -c], [-b, -c], [-a, -a]]),
    ].map((poly) => ({ poly })),
  };
}

function rhombille() {
  const t = 1 / S3;
  return {
    v1: { x: 2, y: 0 }, v2: { x: 1, y: S3 },
    tiles: [
      P([[0, 0], [-1, t], [0, 2 * t], [1, t]]),
      P([[0, 0], [1, t], [1, -t], [0, -2 * t]]),
      P([[0, 0], [0, -2 * t], [-1, -t], [-1, t]]),
    ].map((poly) => ({ poly })),
  };
}

// 4.8²: octógono en el origen y cuadrado girado 45° en el hueco diagonal.
function octagons() {
  const w = 1 + S2;
  return {
    v1: { x: w, y: 0 }, v2: { x: 0, y: w },
    tiles: [
      { poly: regular(0, 0, 8, 1, 0) },
      { poly: regular(w / 2, w / 2, 4, 1, Math.PI / 4), minor: true },
    ],
  };
}

// 4.6.12: dodecágonos en retícula triangular; cuadrados entre cada par vecino y
// hexágonos en los centros de los triángulos.
function dodecagons() {
  const d = 3 + S3;
  const v1 = { x: d, y: 0 }, v2 = { x: d / 2, y: (d * S3) / 2 };
  const tiles = [{ poly: regular(0, 0, 12, 1, 0) }];
  for (const ang of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
    tiles.push({ poly: regular(Math.cos(ang) * d / 2, Math.sin(ang) * d / 2, 4, 1, ang), minor: true });
  }
  const h = d / S3;
  for (const ang of [Math.PI / 6, Math.PI / 2]) {
    tiles.push({ poly: regular(Math.cos(ang) * h, Math.sin(ang) * h, 6, 1, ang), minor: true });
  }
  return { v1, v2, tiles };
}

function hexagons() {
  return {
    v1: { x: S3, y: 0 }, v2: { x: S3 / 2, y: 1.5 },
    tiles: [{ poly: regular(0, 0, 6, 1, 0) }],
  };
}

export const TILINGS = { hex: hexagons(), octagons: octagons(), dodecagons: dodecagons(), cairo: cairo(), rhombille: rhombille() };
export const TILING_NAMES = Object.keys(TILINGS);

// ---------- geometría ----------

export function polyArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

export function polyCentroid(poly) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const f = p.x * q.y - q.x * p.y;
    a += f; cx += (p.x + q.x) * f; cy += (p.y + q.y) * f;
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

function distToSeg(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

export function distToEdges(px, py, poly) {
  let m = Infinity;
  for (let i = 0; i < poly.length; i++) m = Math.min(m, distToSeg(px, py, poly[i], poly[(i + 1) % poly.length]));
  return m;
}

export function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > py) !== (b.y > py) && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// Recorte de un polígono convexo a un rectángulo (Sutherland–Hodgman).
export function clipToRect(poly, r) {
  const edges = [
    (p) => p.x >= r.x0, (p) => p.x <= r.x1, (p) => p.y >= r.y0, (p) => p.y <= r.y1,
  ];
  const cut = [
    (a, b) => lerpAt(a, b, (r.x0 - a.x) / (b.x - a.x)), (a, b) => lerpAt(a, b, (r.x1 - a.x) / (b.x - a.x)),
    (a, b) => lerpAt(a, b, (r.y0 - a.y) / (b.y - a.y)), (a, b) => lerpAt(a, b, (r.y1 - a.y) / (b.y - a.y)),
  ];
  let out = poly;
  for (let e = 0; e < 4 && out.length; e++) {
    const inp = out; out = [];
    for (let i = 0; i < inp.length; i++) {
      const a = inp[i], b = inp[(i + 1) % inp.length], ia = edges[e](a), ib = edges[e](b);
      if (ia) out.push(a);
      if (ia !== ib) out.push(cut[e](a, b));
    }
  }
  // Sin vértices repetidos (aparecen cuando un vértice cae justo en el borde).
  return out.filter((p, i) => {
    const q = out[(i + 1) % out.length];
    return out.length < 2 || Math.hypot(p.x - q.x, p.y - q.y) > 1e-6;
  });
}
const lerpAt = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

// Contracción de un polígono convexo: cada arista se desplaza `d` hacia adentro.
// Se recorta el polígono con cada semiplano desplazado (no intersectando rectas
// vecinas), así las aristas más cortas que `d` desaparecen sin dejar picos.
export function insetConvex(poly, d) {
  if (d <= 0) return poly.slice();
  const sgn = polyArea(poly) > 0 ? 1 : -1;
  const n = poly.length;
  let out = poly;
  for (let i = 0; i < n && out.length; i++) {
    const p = poly[i], q = poly[(i + 1) % n];
    const len = Math.hypot(q.x - p.x, q.y - p.y);
    if (len < 1e-9) continue;
    // Normal interior: a la izquierda en polígonos antihorarios (área > 0).
    const nx = (-(q.y - p.y) / len) * sgn, ny = ((q.x - p.x) / len) * sgn;
    const side = (pt) => (pt.x - p.x) * nx + (pt.y - p.y) * ny - d;
    const inp = out; out = [];
    for (let k = 0; k < inp.length; k++) {
      const a = inp[k], b = inp[(k + 1) % inp.length], sa = side(a), sb = side(b);
      if (sa >= 0) out.push(a);
      if ((sa >= 0) !== (sb >= 0)) out.push(lerpAt(a, b, sa / (sa - sb)));
    }
  }
  return out;
}

// ---------- colocación en la página ----------

function place(t, s, area, phase) {
  const { v1, v2, tiles } = t;
  const cx = area.x + area.w / 2, cy = area.y + area.h / 2;
  const det = v1.x * v2.y - v1.y * v2.x;
  // Rango de índices que cubre el área (en unidades de la celda primitiva).
  const reach = (Math.hypot(area.w, area.h) / 2) / s + 4;
  const span = Math.ceil(reach / (Math.abs(det) / Math.max(Math.hypot(v1.x, v1.y), Math.hypot(v2.x, v2.y)))) + 1;
  const out = [];
  const rect = { x0: area.x, y0: area.y, x1: area.x + area.w, y1: area.y + area.h };
  for (let j = -span; j <= span; j++) {
    for (let i = -span; i <= span; i++) {
      const ox = (i + phase.x) * v1.x + (j + phase.y) * v2.x, oy = (i + phase.x) * v1.y + (j + phase.y) * v2.y;
      for (const tile of tiles) {
        const full = tile.poly.map((p) => ({ x: cx + (p.x + ox) * s, y: cy + (p.y + oy) * s }));
        const poly = clipToRect(full, rect);
        if (poly.length < 3) continue;
        // Las teselas cortadas por el borde de la página se conservan si queda
        // al menos un tercio: así el teselado llena la hoja sin bordes dentados.
        const fullA = Math.abs(polyArea(full)), a = Math.abs(polyArea(poly));
        if (a < fullA * 0.3) continue;
        out.push({ poly, minor: !!tile.minor, partial: a < fullA * 0.999, frac: a / fullA });
      }
    }
  }
  return out;
}

// Elige la escala para que entren ~count teselas en el área. Prueba varias fases de la retícula y se queda con la que mejor
// llena la página.
export function tileArea(name, area, count) {
  const t = TILINGS[name] || TILINGS.hex;
  const unitArea = Math.abs(t.v1.x * t.v2.y - t.v1.y * t.v2.x);
  // count se refiere a las teselas principales: las "minor" son acompañamiento.
  const majors = t.tiles.filter((x) => !x.minor).length;
  const s0 = Math.sqrt((area.w * area.h * majors) / (unitArea * Math.max(1, count)));
  const phases = [{ x: 0, y: 0 }, { x: 0.5, y: 0 }, { x: 0, y: 0.5 }, { x: 0.5, y: 0.5 }];
  let best = null;
  for (let f = 0.7; f <= 1.15; f += 0.025) {
    const s = s0 * f;
    for (const phase of phases) {
      const cells = place(t, s, area, phase);
      if (!cells.length) continue;
      // Más cerca de count primero; a igualdad, mayor cobertura de la página.
      const cover = cells.reduce((acc, c) => acc + Math.abs(polyArea(c.poly)), 0) / (area.w * area.h);
      // Las teselas cortadas cuentan por la fracción que conservan.
      const n = cells.reduce((acc, c) => acc + (c.minor ? 0 : c.frac), 0);
      const score = Math.abs(n - count) / Math.max(1, count) - cover * 0.5;
      if (!best || score < best.score) best = { score, cells };
    }
  }
  const cells = best ? best.cells : [];
  if (!cells.length) return cells;
  // Orden de lectura (filas, luego columnas) para un sorteo de motivos estable.
  const cen = (c) => polyCentroid(c.poly);
  const rowH = Math.max(1, Math.sqrt((area.w * area.h) / Math.max(1, cells.length)) * 0.5);
  cells.sort((a, b) => {
    const ca = cen(a), cb = cen(b);
    return Math.round(ca.y / rowH) - Math.round(cb.y / rowH) || ca.x - cb.x;
  });
  return cells;
}

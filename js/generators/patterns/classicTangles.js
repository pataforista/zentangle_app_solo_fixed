// classicTangles.js
// Tangles clásicos densos para las figuras grandes (figure.js). Cada uno imita
// un tangle oficial del método Zentangle (Hollibaugh, Printemps, Purk, Bales,
// 'Nzeppel, Keeko, Paradox…) con la densidad de un libro profesional, pero sin
// masas negras: todo es contorno sobre blanco, listo para colorear.
//
// Firma: fn(rng, box, cfg) → capas [{ d, fill, stroke? }] (como motifs.js).
//   box: { x0, y0, x1, y1 } a cubrir (el llamador recorta a la sección).
//   cfg: { gap, stroke, sketchy }   gap = grosor mínimo de cualquier región
//        coloreable (mm). Nada de lo que se dibuja deja huecos más finos.
import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

const TAU = Math.PI * 2;
const W = "#fff";
const mk = (rng, cfg) => new PathBuilder({ sketchy: cfg.sketchy || 0, rng });
const dims = (r) => ({ w: r.x1 - r.x0, h: r.y1 - r.y0, cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2 });

// Curva suave por una lista de puntos (cuadráticas por los puntos medios).
export function smoothPath(b, pts, closed = false) {
  const n = pts.length;
  if (n < 2) return b;
  if (closed) {
    const m0 = mid(pts[n - 1], pts[0]);
    b.moveTo(m0.x, m0.y);
    for (let i = 0; i < n; i++) {
      const m = mid(pts[i], pts[(i + 1) % n]);
      b.quadTo(pts[i].x, pts[i].y, m.x, m.y);
    }
    return b.close();
  }
  b.moveTo(pts[0].x, pts[0].y);
  if (n === 2) return b.lineTo(pts[1].x, pts[1].y);
  for (let i = 1; i < n - 1; i++) {
    const m = i === n - 2 ? pts[n - 1] : mid(pts[i], pts[i + 1]);
    b.quadTo(pts[i].x, pts[i].y, m.x, m.y);
  }
  return b;
}
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

// Empaquetado de círculos sin solaparse (rejilla espacial para que sea rápido).
function packCircles(rng, r, rMin, rMax, sep, tries, bias = 1.6) {
  const { w, h } = dims(r);
  const cell = rMax * 2 + sep;
  const cols = Math.max(1, Math.ceil(w / cell) + 2), grid = new Map();
  const key = (i, j) => j * cols + i;
  const out = [];
  // Primero los grandes (más intentos al principio), luego rellenan los chicos.
  for (let t = 0; t < tries; t++) {
    const k = t / tries;
    const rad = Math.max(rMin, rMin + (rMax - rMin) * Math.pow(1 - k, bias) * (0.55 + 0.45 * rng()));
    const x = r.x0 - rad * 0.6 + rng() * (w + rad * 1.2);
    const y = r.y0 - rad * 0.6 + rng() * (h + rad * 1.2);
    const gi = Math.floor((x - r.x0) / cell) + 1, gj = Math.floor((y - r.y0) / cell) + 1;
    let ok = true;
    for (let dj = -1; dj <= 1 && ok; dj++) for (let di = -1; di <= 1 && ok; di++) {
      for (const p of grid.get(key(gi + di, gj + dj)) || []) {
        if (Math.hypot(x - p.x, y - p.y) < rad + p.r + sep) { ok = false; break; }
      }
    }
    if (!ok) continue;
    const c = { x, y, r: rad };
    out.push(c);
    const kk = key(gi, gj);
    if (!grid.has(kk)) grid.set(kk, []);
    grid.get(kk).push(c);
  }
  return out;
}

// Espiral suave de radio R con vueltas separadas al menos `gap`.
function spiral(b, cx, cy, R, gap, a0, dir) {
  const turns = Math.max(1.2, Math.min(4, R / (gap * 1.15)));
  const steps = Math.max(24, Math.round(turns * 22));
  const pts = [];
  for (let s = 0; s <= steps; s++) {
    const t = s / steps, a = a0 + dir * turns * TAU * t;
    // r crece casi lineal: vueltas equiespaciadas (espiral de Arquímedes).
    const rad = R * (0.08 + 0.92 * t);
    pts.push({ x: cx + Math.cos(a) * rad, y: cy + Math.sin(a) * rad });
  }
  smoothPath(b, pts);
}

// ---------------------------------------------------------------------------
// HOLLIBAUGH: cintas que pasan unas por detrás de otras (orden de pintor).
// ---------------------------------------------------------------------------
function hollibaugh(rng, r, cfg) {
  const { w, h, cx, cy } = dims(r);
  const D = Math.hypot(w, h);
  const g = cfg.gap;
  // Dos orientaciones exactamente perpendiculares (con un giro común): cintas
  // casi paralelas se acercaban a lo largo de la página y dejaban franjas de
  // menos de 1 mm entre bordes.
  const a0 = rFloat(rng, 0, Math.PI);
  const n = Math.max(8, Math.min(90, Math.round(D / (g * 2.6))));
  const placed = [[], []]; // por orientación: [lo, hi] en la coordenada normal
  const layers = [];
  for (let i = 0, tries = 0; layers.length < n * 2 && tries < n * 6; tries++) {
    const o = i % 2;
    const ang = a0 + (o ? Math.PI / 2 : 0);
    const bw = g * rFloat(rng, 2.4, 3.6);
    const dx = Math.cos(ang), dy = Math.sin(ang), nxu = -dy, nyu = dx;
    const off = rFloat(rng, -0.55, 0.55) * D;
    const lo = off - bw / 2, hi = off + bw / 2;
    // Bordes de cintas paralelas: o se separan un hueco coloreable o la
    // nueva cinta tapa por completo a la vieja (sin franjas finas).
    const ok = placed[o].every(([l, u]) => lo >= u + g * 1.1 || hi <= l - g * 1.1 || (lo <= l - g * 1.1 && hi >= u + g * 1.1));
    if (!ok) continue;
    placed[o].push([lo, hi]);
    i++;
    const px = cx + nxu * off, py = cy + nyu * off;
    const nx = nxu * bw / 2, ny = nyu * bw / 2;
    const A = { x: px - dx * D, y: py - dy * D }, B = { x: px + dx * D, y: py + dy * D };
    const fill = mk(rng, { sketchy: 0 }), edge = mk(rng, cfg);
    fill.moveTo(A.x + nx, A.y + ny).lineTo(B.x + nx, B.y + ny).lineTo(B.x - nx, B.y - ny).lineTo(A.x - nx, A.y - ny).close();
    edge.moveTo(A.x + nx, A.y + ny).lineTo(B.x + nx, B.y + ny).moveTo(A.x - nx, A.y - ny).lineTo(B.x - nx, B.y - ny);
    layers.push({ d: fill.d, fill: W, stroke: false }, { d: edge.d, fill: "none" });
  }
  return layers;
}

// ---------------------------------------------------------------------------
// PRINTEMPS: rollos (espirales dentro de círculos) empaquetados.
// ---------------------------------------------------------------------------
function printemps(rng, r, cfg) {
  const g = cfg.gap;
  const cs = packCircles(rng, r, g * 1.8, g * 4.4, g * 0.45, 5000, 1.2);
  const b = mk(rng, cfg);
  for (const c of cs) {
    b.circle(c.x, c.y, c.r);
    // La espiral no toca el círculo: queda un canal continuo (si lo tocaba
    // en tangente dejaba una astilla imposible de colorear).
    if (c.r > g * 2.2) spiral(b, c.x, c.y, c.r - g * 1.05, g * 1.1, rFloat(rng, 0, TAU), rng() < 0.5 ? 1 : -1);
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// TIPPLE: burbujas de muchos tamaños, apretadas.
// ---------------------------------------------------------------------------
function tipple(rng, r, cfg) {
  const g = cfg.gap;
  const cs = packCircles(rng, r, Math.max(1.25, g * 0.7), g * 3.4, g * 0.3, 8000, 2.0);
  const b = mk(rng, cfg);
  for (const c of cs) b.circle(c.x, c.y, c.r);
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// PURK: círculos con auras concéntricas, empaquetados.
// ---------------------------------------------------------------------------
function purk(rng, r, cfg) {
  const g = cfg.gap;
  const cs = packCircles(rng, r, g * 1.6, g * 5.8, g * 0.45, 5000, 1.3);
  const b = mk(rng, cfg);
  for (const c of cs) {
    for (let rr = c.r; rr >= g * 0.9; rr -= g * 1.25) b.circle(c.x, c.y, rr);
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// 'NZEPPEL: almohadillas redondeadas en retícula diagonal.
// ---------------------------------------------------------------------------
function nzeppel(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 4.4, 5.6);
  const D = Math.hypot(w, h) / 2 + s;
  const rot = Math.PI / 4 + rFloat(rng, -0.1, 0.1);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const b = mk(rng, cfg);
  const half = s / 2 - g * 0.4, k = half * 0.55, e = half * 0.45;
  for (let u = -D; u <= D; u += s) for (let v = -D; v <= D; v += s) {
    const X = cx + u * c - v * sn, Y = cy + u * sn + v * c;
    if (X < r.x0 - s || X > r.x1 + s || Y < r.y0 - s || Y > r.y1 + s) continue;
    // Cuadrado de esquinas muy redondeadas (cuatro cuadráticas), girado.
    const P = (x, y) => ({ x: X + x * c - y * sn, y: Y + x * sn + y * c });
    // Lados rectos y esquinas redondeadas (cuadráticas en cada esquina).
    const Q = [[-half, -e], [-half, -half, -e, -half], [e, -half], [half, -half, half, -e], [half, e], [half, half, e, half], [-e, half], [-half, half, -half, e]];
    const p0 = P(Q[0][0], Q[0][1]);
    b.moveTo(p0.x, p0.y);
    for (let i = 1; i < 8; i += 2) {
      const cc = P(Q[i][0], Q[i][1]), en = P(Q[i][2], Q[i][3]), nx3 = P(Q[(i + 1) % 8][0], Q[(i + 1) % 8][1]);
      b.quadTo(cc.x, cc.y, en.x, en.y).lineTo(nx3.x, nx3.y);
    }
    b.close();
    // Brillo: un arco interior en una esquina (volumen de "piedra").
    if (half > g * 2.4) {
      const a = P(-k, -k * 0.2), m = P(-k, -k), e = P(-k * 0.2, -k);
      b.moveTo(a.x, a.y).quadTo(m.x, m.y, e.x, e.y);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// BALES: hojas (lentes) sobre una cuadrícula, tejidas arriba/abajo.
// ---------------------------------------------------------------------------
function bales(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 5.2, 6.6);
  const bulge = s * 0.3;
  const rot = rFloat(rng, -0.25, 0.25) + (rng() < 0.4 ? Math.PI / 4 : 0);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const lens = (b, A, B, nx, ny) => {
    const m = mid(A, B);
    b.moveTo(A.x, A.y).quadTo(m.x + nx, m.y + ny, B.x, B.y).quadTo(m.x - nx, m.y - ny, A.x, A.y).close();
  };
  const vert = mk(rng, cfg), horiz = mk(rng, cfg);
  for (let u = -D; u <= D; u += s) for (let v = -D; v <= D; v += s) {
    const A = P(u, v);
    if (A.x < r.x0 - s * 1.5 || A.x > r.x1 + s * 1.5 || A.y < r.y0 - s * 1.5 || A.y > r.y1 + s * 1.5) continue;
    // Lente horizontal (u→u+s) y vertical (v→v+s); cada una tapa a la otra en
    // tablero de ajedrez: el tejido característico de Bales.
    const top = ((Math.round(u / s) + Math.round(v / s)) & 1) === 0;
    lens(top ? horiz : vert, A, P(u + s, v), -sn * bulge, c * bulge);
    lens(top ? vert : horiz, A, P(u, v + s), c * bulge, sn * bulge);
  }
  return [{ d: vert.d, fill: W }, { d: horiz.d, fill: W }];
}

// ---------------------------------------------------------------------------
// CUBINE: cubos isométricos (rombos de tres orientaciones).
// ---------------------------------------------------------------------------
function cubine(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 3.4, 4.4);
  const b = mk(rng, cfg);
  const hx = s * Math.sqrt(3), vy = s * 1.5;
  const nx = Math.ceil(w / hx / 2) + 2, ny = Math.ceil(h / vy / 2) + 2;
  for (let j = -ny; j <= ny; j++) for (let i = -nx; i <= nx; i++) {
    const X = cx + (i + (j & 1 ? 0.5 : 0)) * hx, Y = cy + j * vy;
    const V = (k) => ({ x: X + Math.cos(-Math.PI / 2 + (k * Math.PI) / 3) * s, y: Y + Math.sin(-Math.PI / 2 + (k * Math.PI) / 3) * s });
    const p = [0, 1, 2, 3, 4, 5].map(V);
    b.moveTo(p[0].x, p[0].y);
    for (let k = 1; k <= 6; k++) b.lineTo(p[k % 6].x, p[k % 6].y);
    // Tres aristas desde el centro: tapa, cara izquierda y derecha.
    b.moveTo(X, Y).lineTo(p[1].x, p[1].y).moveTo(X, Y).lineTo(p[3].x, p[3].y).moveTo(X, Y).lineTo(p[5].x, p[5].y);
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// PARADOX: cuadrados en espiral (giro alterno en tablero).
// ---------------------------------------------------------------------------
function paradox(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h } = dims(r);
  // Paso amplio (t ≈ 0.3): con t = 0.2 los triángulos eran agujas de 13°
  // cuya punta ningún marcador alcanza.
  const s = g * rFloat(rng, 10, 12.5);
  const t = rFloat(rng, 0.29, 0.33);
  // Trazo limpio: el temblor "a mano" prolonga las líneas más allá de cada
  // vértice y en Paradox cada vértice es un cruce (astillas de tinta).
  const b = mk(rng, { sketchy: 0 });
  const cols = Math.ceil(w / s) + 1, rows = Math.ceil(h / s) + 1;
  const ox = r.x0 - (cols * s - w) / 2, oy = r.y0 - (rows * s - h) / 2;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let p = [{ x: ox + i * s, y: oy + j * s }, { x: ox + (i + 1) * s, y: oy + j * s }, { x: ox + (i + 1) * s, y: oy + (j + 1) * s }, { x: ox + i * s, y: oy + (j + 1) * s }];
    if ((i + j) & 1) p.reverse();
    b.moveTo(p[0].x, p[0].y); for (let k = 1; k <= 4; k++) b.lineTo(p[k % 4].x, p[k % 4].y);
    // Cada cuadrado nuevo une puntos a fracción t de los lados del anterior;
    // se para antes de que los triángulos sean más finos que un marcador.
    for (let it = 0; it < 30; it++) {
      const q = p.map((a, k) => { const c2 = p[(k + 1) % 4]; return { x: a.x + (c2.x - a.x) * t, y: a.y + (c2.y - a.y) * t }; });
      const side = Math.hypot(q[1].x - q[0].x, q[1].y - q[0].y);
      if (side * t < g * 1.1 || side < g * 3.5) break;
      b.moveTo(q[0].x, q[0].y); for (let k = 1; k <= 4; k++) b.lineTo(q[k % 4].x, q[k % 4].y);
      p = q;
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// BEADLINES: hileras onduladas con perlas de dos tamaños.
// ---------------------------------------------------------------------------
function beadlines(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 3.6, 4.6);
  const rot = rFloat(rng, -0.6, 0.6);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const lam = s * rFloat(rng, 4, 6), amp = s * 0.35, ph = rFloat(rng, 0, TAU);
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const yOf = (u, v0) => v0 + Math.sin((u / lam) * TAU + ph) * amp;
  const lines = mk(rng, cfg), beads = mk(rng, cfg);
  for (let v0 = -D; v0 <= D; v0 += s) {
    const pts = [];
    for (let u = -D; u <= D; u += lam / 12) pts.push(P(u, yOf(u, v0)));
    smoothPath(lines, pts);
    // Perlas sobre la línea media de la banda (alternan grande / chica).
    const big = (s - g) / 2 - g * 0.1, small = big * 0.6;
    let u = -D, k = 0;
    while (u < D) {
      const rad = k++ & 1 ? small : big;
      u += rad;
      const q = P(u, yOf(u, v0 + s / 2));
      if (q.x > r.x0 - s && q.x < r.x1 + s && q.y > r.y0 - s && q.y < r.y1 + s && rad >= g * 0.8) beads.circle(q.x, q.y, rad);
      u += rad + g * 0.9;
    }
  }
  return [{ d: lines.d, fill: "none" }, { d: beads.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// KEEKO: bloques de líneas paralelas alternando dirección (cestería).
// ---------------------------------------------------------------------------
function keeko(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const n = rInt(rng, 3, 4);
  const s = (n + 1) * g * 1.15;
  const rot = rFloat(rng, -0.3, 0.3);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  for (let u = -D; u <= D; u += s) for (let v = -D; v <= D; v += s) {
    const horiz = ((Math.round(u / s) + Math.round(v / s)) & 1) === 0;
    for (let k = 1; k <= n; k++) {
      const f = (k / (n + 1)) * s;
      const A = horiz ? P(u, v + f) : P(u + f, v), B = horiz ? P(u + s, v + f) : P(u + f, v + s);
      b.moveTo(A.x, A.y).lineTo(B.x, B.y);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// STATIC: zigzags paralelos (bandas cerradas entre zigzags).
// ---------------------------------------------------------------------------
function staticZ(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 2.0, 2.6), lam = s * rFloat(rng, 1.6, 2.4), amp = s * 0.55;
  const rot = rFloat(rng, -0.5, 0.5) + (rng() < 0.5 ? Math.PI / 2 : 0);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  for (let v = -D; v <= D; v += s) {
    let up = 1;
    const p0 = P(-D, v); b.moveTo(p0.x, p0.y);
    for (let u = -D; u <= D; u += lam / 2, up = -up) { const q = P(u + lam / 2, v + up * amp / 2); b.lineTo(q.x, q.y); }
  }
  return [{ d: b.d, fill: "none" }];
}

export const CLASSIC_TANGLES = [
  { id: "hollibaugh", fn: hollibaugh },
  { id: "printemps", fn: printemps },
  { id: "tipple", fn: tipple },
  { id: "purk", fn: purk },
  { id: "nzeppel", fn: nzeppel },
  { id: "bales", fn: bales },
  { id: "cubine", fn: cubine },
  { id: "paradox", fn: paradox },
  { id: "beadlines", fn: beadlines },
  { id: "keeko", fn: keeko },
  { id: "static", fn: staticZ },
];

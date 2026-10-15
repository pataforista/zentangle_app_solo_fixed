// motifs.js
// Biblioteca de motivos para el modo muestrario (sampler). A diferencia de los
// rellenos de zentangleCells, cada motivo devuelve CAPAS pintables:
//   [{ d, fill, stroke? }]   fill: "none" | "#000" | "#fff"; stroke:false => solo relleno
// y reconoce cfg.solids: con solids=false las masas negras pasan a contorno
// (coloreables); con solids=true se rellenan como en un muestrario de tinta.
//
// cfg: { minGapMm, patternStrokeMm, sketchy, solids, inside(x,y,over) }
//   inside() indica si un punto cae dentro del contenedor (círculo/cuadro), para
//   no dibujar motivos cuyo centro queda fuera y solo dejarían astillas.
import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

const TAU = Math.PI * 2;
const K = "#000";
const W = "#fff";

const mk = (rng, cfg) => new PathBuilder({ sketchy: cfg.sketchy, rng });
const ink = (cfg) => (cfg.solids ? K : "none");
const sideOf = (r) => Math.min(r.x1 - r.x0, r.y1 - r.y0);
const centerOf = (r) => ({ x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2 });

// Paso para n repeticiones a lo ancho; nunca menor a lo que un marcador alcanza
// a rellenar (minGapMm * factor).
function pitch(rng, r, cfg, nMin, nMax, minFactor = 3.8) {
  return Math.max(sideOf(r) / rInt(rng, nMin, nMax), cfg.minGapMm * minFactor);
}

// Retícula centrada en el contenedor (simétrica), opcionalmente alternada y con
// jitter. Descarta puntos cuyo centro queda más allá de `over` del borde.
function lattice(rng, r, cfg, px, py, { stagger = false, jitter = 0, over = 0.3, ext = 0 } = {}) {
  // Para colorear los elementos cortados por el borde dejan astillas sin
  // espacio para un marcador: se exige que el centro quede bien adentro.
  // Con ext (radio del elemento, en unidades del paso) el motivo aislado debe
  // caber ENTERO y a un hueco del contorno: medio corazón cortado dejaba dos
  // cuñas que ningún marcador alcanza.
  if (ext > 0 && !cfg.solids) {
    const pts = lattice(rng, r, cfg, px, py, { stagger, jitter, over: 0.32 - (ext + cfg.minGapMm / Math.min(px, py)) });
    if (pts.length >= 3) return pts;
  }
  const slack = cfg.solids ? 0 : 0.32;
  const { x: cx, y: cy } = centerOf(r);
  const nx = Math.ceil((r.x1 - r.x0) / px / 2) + 1;
  const ny = Math.ceil((r.y1 - r.y0) / py / 2) + 1;
  const pts = [];
  for (let j = -ny; j <= ny; j++) {
    for (let i = -nx; i <= nx; i++) {
      const x = cx + (i + (stagger && (j & 1) ? 0.5 : 0)) * px + (rng() - 0.5) * 2 * jitter * px;
      const y = cy + j * py + (rng() - 0.5) * 2 * jitter * py;
      if (cfg.inside(x, y, (over - slack) * Math.min(px, py))) pts.push({ x, y, i, j });
    }
  }
  return pts;
}

// Formas unitarias ([-1,1]) como comandos; emit() las escala, rota y coloca.
const HEART = [["M", 0, 0.92], ["C", -0.15, 0.78, -1, 0.22, -1, -0.35], ["C", -1, -0.8, -0.66, -1, -0.4, -1],
  ["C", -0.2, -1, -0.05, -0.88, 0, -0.68], ["C", 0.05, -0.88, 0.2, -1, 0.4, -1], ["C", 0.66, -1, 1, -0.8, 1, -0.35],
  ["C", 1, 0.22, 0.15, 0.78, 0, 0.92], ["Z"]];
const DROP = [["M", 0, -1], ["C", 0.15, -0.55, 0.78, -0.05, 0.78, 0.42], ["C", 0.78, 0.8, 0.42, 1, 0, 1],
  ["C", -0.42, 1, -0.78, 0.8, -0.78, 0.42], ["C", -0.78, -0.05, -0.15, -0.55, 0, -1], ["Z"]];
const LEAF = [["M", 0, -1], ["C", 0.75, -0.5, 0.75, 0.5, 0, 1], ["C", -0.75, 0.5, -0.75, -0.5, 0, -1], ["Z"]];
const LEAF_RIB = [...LEAF, ["M", 0, -0.7], ["L", 0, 0.95]];
const PETAL = [["M", 0, 0], ["Q", 0.85, -0.45, 0, -1], ["Q", -0.85, -0.45, 0, 0], ["Z"]];
const RSQ = [["M", -0.55, -1], ["L", 0.55, -1], ["Q", 1, -1, 1, -0.55], ["L", 1, 0.55], ["Q", 1, 1, 0.55, 1],
  ["L", -0.55, 1], ["Q", -1, 1, -1, 0.55], ["L", -1, -0.55], ["Q", -1, -1, -0.55, -1], ["Z"]];

function emit(b, cmds, cx, cy, sx, sy = sx, rot = 0) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const T = (x, y) => [cx + x * sx * c - y * sy * s, cy + x * sx * s + y * sy * c];
  for (const [t, ...a] of cmds) {
    if (t === "M") b.moveTo(...T(a[0], a[1]));
    else if (t === "L") b.lineTo(...T(a[0], a[1]));
    else if (t === "C") b.cubicTo(...T(a[0], a[1]), ...T(a[2], a[3]), ...T(a[4], a[5]));
    else if (t === "Q") b.quadTo(...T(a[0], a[1]), ...T(a[2], a[3]));
    else if (t === "Z") b.close();
  }
}

// Curva suave por puntos (Catmull-Rom → cubicas). Con sketchy>0 las cúbicas se
// remuestrean con temblor suave, que da trazo "a mano" sin ruido en cada tramo.
function smoothThrough(b, pts) {
  b.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    b.cubicTo(
      p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6,
      p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6,
      p2.x, p2.y
    );
  }
}

/* ============ Motivos ============ */

// Corazones en contorno con "eco" interior (tangle clásico): nunca rellenos.
function hearts(rng, r, cfg) {
  const p = pitch(rng, r, cfg, 3, 4, 5);
  const tilt = rFloat(rng, 0, 0.3);
  const outer = mk(rng, cfg), inner = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, p, p * 0.92, { stagger: true, jitter: 0.03, ext: 0.48 })) {
    const t = (rng() - 0.5) * 2 * tilt, hs = p * 0.42;
    emit(outer, HEART, q.x, q.y, hs, hs, t);
    emit(inner, HEART, q.x, q.y + hs * 0.06, hs * 0.5, hs * 0.5, t);
  }
  return [{ d: outer.d, fill: "none" }, { d: inner.d, fill: "none" }];
}

function flowers(rng, r, cfg) {
  // Trío de flores grandes (5 pétalos sin solapar): cada pétalo es una zona que
  // cabe un marcador, y tres flores se recuerdan mejor que un campo de ocho.
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, p = R * 0.95, a1 = rFloat(rng, 0, TAU);
  const b = mk(rng, cfg), core = mk(rng, cfg);
  for (let i = 0; i < 3; i++) {
    const ang = a1 + (i * TAU) / 3;
    const fx = cx + Math.cos(ang) * R * 0.5, fy = cy + Math.sin(ang) * R * 0.5;
    const a0 = rFloat(rng, 0, TAU), r0 = p * 0.11, L = p * 0.33;
    for (let k = 0; k < 5; k++) {
      const a = a0 + (k / 5) * TAU;
      emit(b, PETAL, fx + Math.sin(a) * r0, fy - Math.cos(a) * r0, L * 0.68, L, a);
    }
    core.circle(fx, fy, r0);
  }
  return [{ d: b.d, fill: "none" }, { d: core.d, fill: ink(cfg) }];
}

function drops(rng, r, cfg) {
  const p = pitch(rng, r, cfg, 3, 5);
  const b = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, p, p * 0.85, { stagger: true, jitter: 0.03, ext: 0.36 })) {
    emit(b, DROP, q.x, q.y, p * 0.2, p * 0.3, (rng() - 0.5) * 0.2);
  }
  return [{ d: b.d, fill: ink(cfg) }];
}

function clouds(rng, r, cfg) {
  // Tres nubes escalonadas (composición fija, sin recortes). Cada una es una
  // capa con relleno blanco: si se rozan, la de adelante tapa a la de atrás.
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2;
  // Contorno en unidades (0..1): cuatro lóbulos sobre una base plana redondeada.
  const U = [[0, 0.3], [0.2, 0.74], [0.52, 1], [0.82, 0.72], [1, 0.3]];
  const flip = rng() < 0.5 ? 1 : -1;
  const layers = [];
  for (const [dx, dy, wk] of [[-0.1, -0.52, 0.88], [0.2, 0.02, 1.0], [-0.16, 0.56, 0.84]]) {
    const b = mk(rng, cfg);
    const w = R * wk * 0.86, h = w * 0.58;
    const X = (u) => cx + flip * dx * R - w / 2 + u * w, Y = (v) => cy + dy * R + h / 2 - v * h;
    const pt = U.map(([u, v]) => [X(u), Y(v)]);
    const arc = (a, c) => { const rr = Math.hypot(c[0] - a[0], c[1] - a[1]) * 0.52; b.arcTo(rr, rr, 0, 0, 1, c[0], c[1]); };
    b.moveTo(pt[0][0], pt[0][1]);
    for (let k = 1; k < pt.length; k++) arc(pt[k - 1], pt[k]);
    const br = [X(0.85), Y(0)], bl = [X(0.15), Y(0)];
    arc(pt[4], br);
    b.lineTo(bl[0], bl[1]);
    arc(bl, pt[0]);
    b.close();
    layers.push({ d: b.d, fill: W });
  }
  return layers;
}

function checker(rng, r, cfg) {
  // Tablero cuadrado centrado, entero dentro del círculo (con la retícula al azar
  // los bordes quedaban escalonados). En tinta las casillas oscuras van negras;
  // para colorear todas quedan en contorno.
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, n = rInt(rng, 4, 5);
  const side = R * 1.4, s = side / n, x0 = cx - side / 2, y0 = cy - side / 2;
  const outline = mk(rng, cfg), dark = mk(rng, cfg);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) ((i + j) & 1 ? outline : dark).rect(x0 + i * s, y0 + j * s, s, s);
  return [{ d: outline.d, fill: "none" }, { d: dark.d, fill: ink(cfg) }];
}

// Bandas excéntricas (círculos anidados desplazados): rayado grueso tipo diana.
function eclipse(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = (sideOf(r) / 2) * 1.08;
  const k = rInt(rng, 4, 6), dir = rng() < 0.5 ? -1 : 1, start = rInt(rng, 0, 1);
  const layers = [];
  for (let i = 0; i <= k; i++) {
    const t = i / (k + 0.6);
    const b = mk(rng, cfg);
    b.circle(cx + dir * R * 0.5 * t, cy, R * (1.05 - t));
    layers.push({ d: b.d, fill: (i + start) & 1 ? W : (cfg.solids ? K : W) });
  }
  return layers;
}

function bubbles(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2;
  const gap = Math.max(cfg.minGapMm * 0.9, 1.4);
  const rMax = R * 0.34, rMin = Math.max(R * 0.07, cfg.minGapMm * 1.1);
  const cs = [];
  for (let t = 0; t < 500 && cs.length < 70; t++) {
    const rad = Math.max(rMin, rMax * (1 - t / 380));
    const x = cx + rFloat(rng, -R, R), y = cy + rFloat(rng, -R, R);
    // Para colorear, burbuja entera y separada del contorno: la tangente con el
    // borde dejaba lunas finísimas imposibles de pintar.
    if (!cfg.inside(x, y, cfg.solids ? rad * 0.4 : -(rad + gap))) continue;
    if (cs.some((c) => Math.hypot(c.x - x, c.y - y) < c.r + rad + gap)) continue;
    cs.push({ x, y, r: rad });
  }
  const big = mk(rng, cfg), small = mk(rng, cfg);
  for (const c of cs) (c.r < rMin * 1.7 ? small : big).circle(c.x, c.y, c.r);
  return [{ d: big.d, fill: "none" }, { d: small.d, fill: ink(cfg) }];
}

function zigzag(wide) {
  return (rng, r, cfg) => {
    const p = Math.max(sideOf(r) * rFloat(rng, 0.1, 0.15), cfg.minGapMm * 3.2);
    const amp = p * (wide ? 0.9 : 0.42), half = p * (wide ? 0.7 : 0.55);
    const b = mk(rng, cfg);
    for (let y = r.y0 - p; y <= r.y1 + p; y += p) {
      let up = true;
      b.moveTo(r.x0 - half, y);
      for (let x = r.x0; x <= r.x1 + half; x += half) {
        b.lineTo(x, y + (up ? -amp / 2 : amp / 2));
        up = !up;
      }
    }
    return [{ d: b.d, fill: "none" }];
  };
}

// Escamas solapadas (seigaiha): cada fila tapa el borde de la anterior.
function scales(rng, r, cfg) {
  // Pocas escamas grandes con 2 anillos: con 3 anillos y escamas de 4 mm quedaban
  // cientos de regiones de ~1 mm (231 por unidad con tinta).
  const n = rInt(rng, 3, 4);
  const rings = [1, 0.58];
  const Rs = Math.max(sideOf(r) / (2 * n), cfg.minGapMm * 1.9);
  const layers = [];
  for (let j = -1, y = r.y0 - Rs; y <= r.y1 + Rs * 1.5; j++, y += Rs * 0.5) {
    const fillB = mk(rng, { ...cfg, sketchy: 0 }), line = mk(rng, cfg);
    const off = (j & 1) * Rs;
    for (let x = r.x0 - 2 * Rs + off; x <= r.x1 + 2 * Rs; x += 2 * Rs) {
      fillB.moveTo(x - Rs, y).arcTo(Rs, Rs, 0, 0, 1, x + Rs, y).close();
      for (const f of rings) {
        line.moveTo(x - Rs * f, y).arcTo(Rs * f, Rs * f, 0, 0, 1, x + Rs * f, y);
      }
    }
    layers.push({ d: fillB.d, fill: W, stroke: false }, { d: line.d, fill: "none" });
  }
  return layers;
}

// Arcoíris sueltos: arcos concéntricos sobre una retícula alternada.
function rainbows(rng, r, cfg) {
  const n = rInt(rng, 3, 4);
  const Rs = Math.max(sideOf(r) / (2 * n) * 0.95, cfg.minGapMm * 2.2);
  const b = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, Rs * 2.15, Rs * 1.1, { stagger: true, over: 0.4 })) {
    for (const f of [1, 0.68, 0.36]) {
      b.moveTo(q.x - Rs * f, q.y + Rs * 0.5).arcTo(Rs * f, Rs * f, 0, 0, 1, q.x + Rs * f, q.y + Rs * 0.5);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

function squareSpirals(rng, r, cfg) {
  // Cuatro espirales cuadradas en 2x2 (caben enteras en el círculo).
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2, size = R * 0.6;
  const st = Math.max(cfg.minGapMm * 1.25, size / rInt(rng, 5, 6));
  const b = mk(rng, cfg);
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = cx + dx * R * 0.42, y = cy + dy * R * 0.42;
    let L = x - size / 2, T = y - size / 2, Rr = x + size / 2, B = y + size / 2;
    b.moveTo(L, T);
    let first = true;
    for (let guard = 0; guard < 40; guard++) {
      b.lineTo(Rr, T);
      if (B - T < st * 1.5) break;
      if (!first) L += st;
      b.lineTo(Rr, B);
      if (Rr - L < st * 1.5) break;
      b.lineTo(L, B);
      T += st;
      b.lineTo(L, T);
      if (Rr - L < st * 2.2 || B - T < st * 1.5) break;
      Rr -= st; B -= st; first = false;
    }
  }
  return [{ d: b.d, fill: "none" }];
}

function spiralsGrid(rng, r, cfg) {
  const p = pitch(rng, r, cfg, 3, 4, 5);
  const Rm = p * 0.46;
  const g = Math.max(cfg.minGapMm * 1.2, Rm / rFloat(rng, 2.4, 3.4));
  const turns = Rm / g;
  const b = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, p, p * 0.9, { stagger: true, jitter: 0.02, over: 0.3, ext: 0.52 })) {
    const flip = rng() < 0.5 ? -1 : 1, a0 = rFloat(rng, 0, TAU);
    const pts = [];
    for (let th = 0; th <= turns * TAU; th += TAU / 9) {
      const rad = (g * th) / TAU;
      pts.push({ x: q.x + Math.cos(a0 + flip * th) * rad, y: q.y + Math.sin(a0 + flip * th) * rad });
    }
    if (pts.length > 2) smoothThrough(b, pts);
  }
  return [{ d: b.d, fill: "none" }];
}

function asterisks(rng, r, cfg) {
  // Seis rayos con hueco en el centro: al cruzarse, las 3 líneas cerraban seis
  // cuñas diminutas por asterisco.
  const p = pitch(rng, r, cfg, 3, 5, 4.2);
  const b = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, p, p * 0.9, { stagger: true, jitter: 0.05, ext: 0.4 })) {
    const a0 = rFloat(rng, 0, Math.PI / 3), in0 = p * 0.1, out = p * 0.34;
    for (let k = 0; k < 6; k++) {
      const a = a0 + (k * Math.PI) / 3, c = Math.cos(a), n = Math.sin(a);
      b.moveTo(q.x + c * in0, q.y + n * in0).lineTo(q.x + c * out, q.y + n * out);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

function roundedSquares(rng, r, cfg) {
  const p = pitch(rng, r, cfg, 4, 5, 3.6);
  const b = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, p, p, { jitter: 0.06, ext: 0.44 })) {
    emit(b, RSQ, q.x, q.y, p * 0.3, p * 0.3, (rng() - 0.5) * 0.3);
  }
  return [{ d: b.d, fill: ink(cfg) }];
}

function leaves(rng, r, cfg) {
  const p = pitch(rng, r, cfg, 3, 4, 4.6);
  const rot = rFloat(rng, -0.5, 0.5);
  const b = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, p, p * 0.8, { stagger: true, jitter: 0.03, ext: 0.54 })) {
    emit(b, cfg.solids ? LEAF_RIB : LEAF, q.x, q.y, p * 0.27, p * 0.42, rot + (rng() - 0.5) * 0.12);
  }
  return [{ d: b.d, fill: "none" }];
}

function honeycomb(rng, r, cfg) {
  const Rh = Math.max(sideOf(r) / rInt(rng, 4, 6), cfg.minGapMm * 3.4);
  const wHex = Math.sqrt(3) * Rh;
  const shrink = 1 - Math.max(0.1, (cfg.minGapMm * 1.2) / wHex);
  const outline = mk(rng, cfg), solid = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, wHex, Rh * 1.5, { stagger: true, over: 0.25 })) {
    const target = cfg.solids && rng() < 0.28 ? solid : outline;
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + (k * TAU) / 6;
      const x = q.x + Math.cos(a) * Rh * shrink, y = q.y + Math.sin(a) * Rh * shrink;
      if (k === 0) target.moveTo(x, y); else target.lineTo(x, y);
    }
    target.close();
  }
  return [{ d: outline.d, fill: "none" }, { d: solid.d, fill: K }];
}

// Mandala central: motivo "héroe" de una sola pieza (anillos de pétalos y festón).
function mandala(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const R = sideOf(r) / 2;
  const n = rInt(rng, 7, 9);
  const a0 = rFloat(rng, 0, TAU);
  const b = mk(rng, cfg), core = mk(rng, cfg);
  // Sin anillo de puntos ni borde doble (dejaban coronas y círculos de ~1 mm
  // imposibles de rellenar); el núcleo solo se pinta con tinta.
  if (cfg.solids) core.circle(cx, cy, R * 0.13);
  b.circle(cx, cy, R * 0.2);
  for (let k = 0; k < n; k++) {
    const a = a0 + (k / n) * TAU;
    emit(b, PETAL, cx + Math.sin(a) * R * 0.22, cy - Math.cos(a) * R * 0.22, R * 0.22, R * 0.36, a);
  }
  const m = n * 2;
  for (let k = 0; k < m; k++) {
    const A = a0 + (k / m) * TAU, B = a0 + ((k + 1) / m) * TAU;
    const p1 = [cx + Math.sin(A) * R * 0.8, cy - Math.cos(A) * R * 0.8];
    const p2 = [cx + Math.sin(B) * R * 0.8, cy - Math.cos(B) * R * 0.8];
    const rr = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 0.62;
    b.moveTo(p1[0], p1[1]);
    b.arcTo(rr, rr, 0, 0, 1, p2[0], p2[1]);
  }
  return [{ d: b.d, fill: "none" }, { d: core.d, fill: ink(cfg) }];
}

function wavesDots(rng, r, cfg) {
  const p = Math.max(sideOf(r) * rFloat(rng, 0.17, 0.22), cfg.minGapMm * 3.6);
  const lam = p * 2.6, amp = p * 0.22;
  const waves = mk(rng, cfg), dots = mk(rng, cfg);
  let row = 0;
  for (let y = r.y0 - p * 0.2; y <= r.y1 + p; y += p, row++) {
    const pts = [];
    for (let x = r.x0 - lam / 4; x <= r.x1 + lam / 4; x += lam / 4) {
      pts.push({ x, y: y + Math.sin(((x - r.x0) / lam) * TAU) * amp });
    }
    if (pts.length > 2) smoothThrough(waves, pts);
    if (row % 2 === 0) {
      for (let x = r.x0 + lam / 4; x <= r.x1; x += lam / 2) dots.circle(x, y + p * 0.5, Math.max(p * 0.14, 1.2));
    }
  }
  return [{ d: waves.d, fill: "none" }, { d: dots.d, fill: ink(cfg) }];
}

function scatterTriangles(rng, r, cfg) {
  const p = pitch(rng, r, cfg, 3, 4, 4);
  const outline = mk(rng, cfg), solid = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, p, p, { stagger: true, jitter: 0.1, ext: 0.38 })) {
    const a0 = rFloat(rng, 0, TAU), rad = p * 0.34;
    const t = cfg.solids && rng() < 0.45 ? solid : outline;
    for (let k = 0; k < 3; k++) {
      const a = a0 + (k * TAU) / 3;
      const x = q.x + Math.cos(a) * rad, y = q.y + Math.sin(a) * rad;
      if (k === 0) t.moveTo(x, y); else t.lineTo(x, y);
    }
    t.close();
  }
  return [{ d: outline.d, fill: "none" }, { d: solid.d, fill: K }];
}

// Bandas diagonales anchas (cebra): negras con solids, contorno si no.
function diagStripes(rng, r, cfg) {
  const { x: cx, y: cy } = centerOf(r);
  const D = Math.hypot(r.x1 - r.x0, r.y1 - r.y0);
  const bw = Math.max(sideOf(r) * rFloat(rng, 0.09, 0.14), cfg.minGapMm * 2.6);
  const pitchB = bw * rFloat(rng, 1.9, 2.3);
  const ang = [Math.PI / 4, -Math.PI / 4, Math.PI / 6, -Math.PI / 6, Math.PI / 3][rInt(rng, 0, 4)];
  const c = Math.cos(ang), s = Math.sin(ang);
  const T = (u, v) => [cx + u * c - v * s, cy + u * s + v * c];
  const b = mk(rng, cfg);
  for (let u = -D; u <= D; u += pitchB) {
    const [x1, y1] = T(u, -D), [x2, y2] = T(u + bw, -D), [x3, y3] = T(u + bw, D), [x4, y4] = T(u, D);
    b.moveTo(x1, y1).lineTo(x2, y2).lineTo(x3, y3).lineTo(x4, y4).close();
  }
  return [{ d: b.d, fill: ink(cfg) }];
}

function polka(rng, r, cfg) {
  const p = pitch(rng, r, cfg, 3, 5, 4);
  // En contorno el círculo crece un poco: sin anillo interior (la corona
  // resultante era demasiado fina para un marcador).
  const rad = p * (cfg.solids ? 0.27 : 0.3);
  const dots = mk(rng, cfg);
  for (const q of lattice(rng, r, cfg, p, p * 0.87, { stagger: true, jitter: 0.02, ext: 0.36 })) dots.circle(q.x, q.y, rad);
  return [{ d: dots.d, fill: ink(cfg) }];
}

function bricks(rng, r, cfg) {
  const h = Math.max(sideOf(r) / rInt(rng, 5, 7), cfg.minGapMm * 3.4);
  const bw = h * rFloat(rng, 2.1, 2.6);
  const b = mk(rng, cfg);
  let row = 0;
  for (let y = r.y0 - (h * 0.5); y <= r.y1 + h; y += h, row++) {
    b.moveTo(r.x0 - bw, y).lineTo(r.x1 + bw, y);
    const off = (row & 1) * bw / 2;
    for (let x = r.x0 - bw + off; x <= r.x1 + bw; x += bw) b.moveTo(x, y).lineTo(x, y + h);
  }
  return [{ d: b.d, fill: "none" }];
}

/* ============ Registro ============ */
// heavy: con solids=true produce una masa negra grande; el muestrario las reparte
// para que dos vecinas pesadas no se junten.
export const MOTIFS = [
  { id: "hearts", fn: hearts },
  { id: "flowers", fn: flowers },
  { id: "drops", fn: drops, heavy: true },
  { id: "clouds", fn: clouds },
  { id: "checker", fn: checker, heavy: true },
  { id: "eclipse", fn: eclipse, heavy: true },
  { id: "bubbles", fn: bubbles },
  { id: "zigzag", fn: zigzag(false) },
  { id: "chevrons", fn: zigzag(true) },
  { id: "scales", fn: scales },
  { id: "rainbows", fn: rainbows },
  { id: "squareSpirals", fn: squareSpirals },
  { id: "spirals", fn: spiralsGrid },
  { id: "asterisks", fn: asterisks },
  { id: "roundedSquares", fn: roundedSquares, heavy: true },
  { id: "leaves", fn: leaves },
  { id: "honeycomb", fn: honeycomb },
  { id: "mandala", fn: mandala },
  { id: "wavesDots", fn: wavesDots },
  { id: "triangles", fn: scatterTriangles },
  { id: "diagStripes", fn: diagStripes, heavy: true },
  { id: "polka", fn: polka, heavy: true },
  { id: "bricks", fn: bricks },
];

// Helpers compartidos con icons.js
export { mk, ink, sideOf, centerOf, pitch, lattice, emit, smoothThrough, TAU, K, W, HEART, DROP, PETAL };

// boldTangles.js
// Patrones originales «de página completa»: densos, de contraste fuerte y legibles a
// escala de rotulador. Son de las familias clásicas del dibujo de patrones (cestas,
// abanicos, chevrones, retículas, hojas…), dibujados por esta app con reglas propias;
// no copian ningún patrón con autor. Solo contornos (sin rellenos negros): se colorean.
// Firma: fn(rng, box, cfg) → capas [{ d, fill }] (como originalTangles.js).
import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

const TAU = Math.PI * 2;
const mk = (rng, cfg) => new PathBuilder({ sketchy: cfg.sketchy || 0, rng });
const dims = (r) => ({ w: r.x1 - r.x0, h: r.y1 - r.y0, cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2 });

// Recorre una retícula girada `rot` de paso su×sv (con filas alternas desplazadas si
// `stagger`) y llama a fn(L, i, j, tools) por cada celda visible. L(du, dv) pasa un
// punto local de la celda a coordenadas de página.
function lattice(r, rot, su, sv, stagger, fn) {
  const { w, h, cx, cy } = dims(r);
  const D = Math.hypot(w, h) / 2 + Math.max(su, sv) * 1.5;
  const c = Math.cos(rot), sn = Math.sin(rot);
  let j = 0;
  for (let v = -D; v <= D; v += sv, j++) {
    const off = stagger && (j & 1) ? su / 2 : 0;
    let i = 0;
    for (let u = -D + off; u <= D; u += su, i++) {
      const px = cx + u * c - v * sn, py = cy + u * sn + v * c;
      if (px < r.x0 - su || px > r.x1 + su || py < r.y0 - sv || py > r.y1 + sv) continue;
      fn((du, dv) => ({ x: px + du * c - dv * sn, y: py + du * sn + dv * c }), i, j, { u, v, c, sn });
    }
  }
}
const poly = (b, pts) => { b.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < pts.length; i++) b.lineTo(pts[i].x, pts[i].y); b.close(); };


// Líneas de una retícula girada (cada línea una sola vez: dibujar dos veces una arista
// compartida, con el temblor del trazo, deja astillas). dir: "uv" rectas, "diag" a 45°.
// Recorta un segmento a un rectángulo (Liang–Barsky): sin esto las líneas salían 3 veces más
// largas que la caja, y el renderizador descarta contenido mucho mayor que el lienzo.
function clipSeg(a, z, rc) {
  let t0 = 0, t1 = 1;
  const dx = z.x - a.x, dy = z.y - a.y;
  for (const [p, q] of [[-dx, a.x - rc.x0], [dx, rc.x1 - a.x], [-dy, a.y - rc.y0], [dy, rc.y1 - a.y]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return t0 >= t1 ? null : [{ x: a.x + dx * t0, y: a.y + dy * t0 }, { x: a.x + dx * t1, y: a.y + dy * t1 }];
}
// Dibuja una polilínea recortada a un rectángulo.
function clippedPolyline(b, pts, rc) {
  let pen = null;
  for (let i = 0; i + 1 < pts.length; i++) {
    const seg = clipSeg(pts[i], pts[i + 1], rc);
    if (!seg) { pen = null; continue; }
    if (!pen || Math.hypot(pen.x - seg[0].x, pen.y - seg[0].y) > 1e-6) b.moveTo(seg[0].x, seg[0].y);
    b.lineTo(seg[1].x, seg[1].y); pen = seg[1];
  }
}
function gridLines(r, rot, s, b, kind = "uv") {
  const { w, h, cx, cy } = dims(r);
  const D = Math.hypot(w, h) / 2 + s * 2, c = Math.cos(rot), sn = Math.sin(rot);
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const rc = { x0: r.x0 - s, y0: r.y0 - s, x1: r.x1 + s, y1: r.y1 + s };
  const line = (p0, p1) => { const seg = clipSeg(P(p0[0], p0[1]), P(p1[0], p1[1]), rc); if (seg) { b.moveTo(seg[0].x, seg[0].y); b.lineTo(seg[1].x, seg[1].y); } };
  if (kind === "uv") {
    for (let t = -Math.ceil(D / s) * s - s / 2; t <= D; t += s) { line([t, -D], [t, D]); line([-D, t], [D, t]); }
  } else {
    for (let t = -Math.ceil(2 * D / s) * s; t <= 2 * D; t += s) { line([t - D, D], [t + D, -D]); line([t - D, -D], [t + D, D]); }
  }
}

// CESTAS: bloques cuadrados con rayas paralelas, alternando horizontal y vertical.
function cestas(rng, r, cfg) {
  const g = cfg.gap, s = g * rFloat(rng, 5.2, 6.6), rot = rng() < 0.5 ? 0 : rFloat(rng, -0.5, 0.5);
  const n = Math.max(3, Math.floor(s / (g * 1.3)));
  const b = mk(rng, cfg);
  gridLines(r, rot, s, b, "uv");
  lattice(r, rot, s, s, false, (L, i, j) => {
    const a = s / 2;
    for (let k = 1; k < n; k++) {
      const t = -a + (k * s) / n;
      const p0 = (i + j) & 1 ? L(t, -a) : L(-a, t), p1 = (i + j) & 1 ? L(t, a) : L(a, t);
      b.moveTo(p0.x, p0.y); b.lineTo(p1.x, p1.y);
    }
  });
  return [{ d: b.d, fill: "none" }];
}

// ABANICOS: arcos concéntricos en forma de U que encajan fila sobre fila, como escamas.
function abanicos(rng, r, cfg) {
  const g = cfg.gap, s = g * rFloat(rng, 5.6, 7.2), R = s / 2, rot = rFloat(rng, -0.12, 0.12);
  const n = Math.max(2, Math.min(4, Math.floor(R / (g * 1.15))));
  const b = mk(rng, cfg);
  lattice(r, rot, s, R, true, (L) => {
    for (let k = 0; k < n; k++) {
      const rr = R * (1 - k / n), p0 = L(-rr, 0), p1 = L(rr, 0);
      b.moveTo(p0.x, p0.y);
      b.arcTo(rr, rr, 0, 0, 0, p1.x, p1.y);
    }
  });
  return [{ d: b.d, fill: "none" }];
}

// CHEVRONES: bandas de zigzags paralelos; las bandas alternan hacia arriba y hacia abajo.
function chevrones(rng, r, cfg) {
  const g = cfg.gap, p = g * rFloat(rng, 4.6, 6.4), A = p * 0.55, d = g * rFloat(rng, 1.5, 1.8); // separación perpendicular 1.92–2.30 mm (comprobado con Wolfram)
  const n = rInt(rng, 3, 4), rot = rFloat(rng, -0.35, 0.35);
  const { w, h, cx, cy } = dims(r);
  const D = Math.hypot(w, h) / 2 + p * 2, c = Math.cos(rot), sn = Math.sin(rot);
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const bandH = A + n * d + g * 1.1, b = mk(rng, cfg), rc = { x0: r.x0 - p, y0: r.y0 - p, x1: r.x1 + p, y1: r.y1 + p };
  let band = 0;
  for (let v0 = -D; v0 <= D; v0 += bandH, band++) {
    const dir = band & 1 ? -1 : 1;
    for (let k = 0; k < n; k++) {
      const pts = []; let up = false;
      for (let u = -D; u <= D + p; u += p / 2, up = !up) pts.push(P(u, v0 + k * d + (up ? A * dir : 0)));
      clippedPolyline(b, pts, rc);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ROMBOS: retícula diagonal de rombos que comparten aristas; cada uno lleva un rombo interior y un punto.
function rombos(rng, r, cfg) {
  const g = cfg.gap, s = g * rFloat(rng, 7.4, 8.8), rot = rFloat(rng, -0.2, 0.2) + (rng() < 0.5 ? 0 : Math.PI / 4); // aro del punto ≥ 1.4 mm
  const b = mk(rng, cfg);
  gridLines(r, rot, s, b, "diag");
  const { w, h, cx, cy } = dims(r);
  const D = Math.hypot(w, h) / 2 + s * 2, c = Math.cos(rot), sn = Math.sin(rot), N = Math.ceil((2 * D) / s) + 2;
  for (let nx = -N; nx <= N; nx++) for (let ny = -N; ny <= N; ny++) {
    if (((nx + ny) & 1) === 0) continue; // centros de rombo: nx + ny impar
    const u = (nx * s) / 2, v = (ny * s) / 2, px = cx + u * c - v * sn, py = cy + u * sn + v * c;
    if (px < r.x0 - s || px > r.x1 + s || py < r.y0 - s || py > r.y1 + s) continue;
    const L = (du, dv) => ({ x: px + du * c - dv * sn, y: py + du * sn + dv * c }), a = s * 0.32; // rombo interior: aro del punto ≥ 1.45 mm (comprobado con Wolfram)
    poly(b, [L(0, -a), L(a, 0), L(0, a), L(-a, 0)]);
    b.circle(px, py, g * 0.7); // 3.8 mm²: sobre el mínimo coloreable
  }
  return [{ d: b.d, fill: "none" }];
}

// HOJAS: hojas almendradas con nervio central y venas, en filas desplazadas.
function hojas(rng, r, cfg) {
  const g = cfg.gap, Lh = g * rFloat(rng, 6.2, 7.6), rot = rFloat(rng, -0.25, 0.25);
  const b = mk(rng, cfg);
  lattice(r, rot, Lh * 0.62, Lh * 0.6, true, (L) => {
    const a = Lh / 2, t0 = L(0, -a), t1 = L(0, a);
    b.moveTo(t0.x, t0.y); b.quadTo(L(Lh * 0.5, 0).x, L(Lh * 0.5, 0).y, t1.x, t1.y);
    b.quadTo(L(-Lh * 0.5, 0).x, L(-Lh * 0.5, 0).y, t0.x, t0.y); b.close();
    b.moveTo(t0.x, t0.y); b.lineTo(t1.x, t1.y);
    for (const v of [-0.12, 0.2]) for (const sgn of [-1, 1]) {
      const p0 = L(0, Lh * v), p1 = L(sgn * Lh * 0.12, Lh * (v - 0.1)); // la vena no llega al borde: sin astillas
      b.moveTo(p0.x, p0.y); b.lineTo(p1.x, p1.y);
    }
  });
  return [{ d: b.d, fill: "none" }];
}

// ROSETAS: flores de seis pétalos empaquetadas en panal.
function rosetas(rng, r, cfg) {
  const g = cfg.gap, R = g * rFloat(rng, 3.7, 4.6), rot = rFloat(rng, -0.3, 0.3);
  const b = mk(rng, cfg);
  lattice(r, rot, R * 2, R * 1.74, true, (L) => {
    for (let k = 0; k < 6; k++) {
      const a = (k * TAU) / 6, ca = Math.cos(a), sa = Math.sin(a), tip = R * 0.98, wd = R * 0.46;
      const at = (d, o) => L(ca * d - sa * o, sa * d + ca * o);
      const c0 = at(0, 0), t = at(tip, 0), q1 = at(tip * 0.5, wd), q2 = at(tip * 0.5, -wd);
      b.moveTo(c0.x, c0.y); b.quadTo(q1.x, q1.y, t.x, t.y); b.quadTo(q2.x, q2.y, c0.x, c0.y);
    }
  });
  return [{ d: b.d, fill: "none" }];
}

// RAYOS: soles pequeños (círculo con púas y punto central) en panal.
function rayos(rng, r, cfg) {
  const g = cfg.gap, R = g * rFloat(rng, 3.6, 4.4), rot = rFloat(rng, -0.3, 0.3), n = rng() < 0.5 ? 8 : 10;
  const b = mk(rng, cfg);
  lattice(r, rot, R * 2.05, R * 1.78, true, (L) => {
    const c0 = L(0, 0);
    b.circle(c0.x, c0.y, R * 0.98);
    for (let k = 0; k < n; k++) {
      const a = (k * TAU) / n + Math.PI / n, p0 = L(Math.cos(a) * R * 0.52, Math.sin(a) * R * 0.52), p1 = L(Math.cos(a) * R * 0.98, Math.sin(a) * R * 0.98);
      b.moveTo(p0.x, p0.y); b.lineTo(p1.x, p1.y);
    }
    b.circle(c0.x, c0.y, R * 0.52);
    b.circle(c0.x, c0.y, g * 0.7);
  });
  return [{ d: b.d, fill: "none" }];
}

// PELDAÑOS: escaleras paralelas que suben en diagonal.
function peldanos(rng, r, cfg) {
  const g = cfg.gap, st = g * rFloat(rng, 2.0, 2.8), sp = g * rFloat(rng, 1.7, 2.3), rot = rFloat(rng, -0.5, 0.5);
  const { w, h, cx, cy } = dims(r);
  const D = Math.hypot(w, h) / 2 + st * 2, c = Math.cos(rot), sn = Math.sin(rot);
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg), rc = { x0: r.x0 - st, y0: r.y0 - st, x1: r.x1 + st, y1: r.y1 + st };
  for (let v0 = -D * 1.6; v0 <= D * 1.6; v0 += sp) {
    const pts = [P(-D, v0 + D)];
    for (let u = -D, k = 0; u < D; u += st, k++) { pts.push(P(u + st, v0 + D - k * st)); pts.push(P(u + st, v0 + D - (k + 1) * st)); }
    clippedPolyline(b, pts, rc);
  }
  return [{ d: b.d, fill: "none" }];
}

// MARCOS: cuadros con un rombo inscrito, un cuadrado interior y un punto central.
function marcos(rng, r, cfg) {
  const g = cfg.gap, s = g * rFloat(rng, 7.2, 9.0), rot = rFloat(rng, -0.15, 0.15);
  const b = mk(rng, cfg);
  gridLines(r, rot, s, b, "uv");
  lattice(r, rot, s, s, false, (L) => {
    const a = s / 2;
    poly(b, [L(0, -a), L(a, 0), L(0, a), L(-a, 0)]);
    poly(b, [L(-a / 2, -a / 2), L(a / 2, -a / 2), L(a / 2, a / 2), L(-a / 2, a / 2)]);
    const c0 = L(0, 0); b.circle(c0.x, c0.y, g * 0.7);
  });
  return [{ d: b.d, fill: "none" }];
}

export const BOLD_TANGLES = [
  { id: "cestas", fn: cestas },
  { id: "abanicos", fn: abanicos },
  { id: "chevrones", fn: chevrones },
  { id: "rombos", fn: rombos },
  { id: "hojas", fn: hojas },
  { id: "rosetas", fn: rosetas },
  { id: "rayos", fn: rayos },
  { id: "peldanos", fn: peldanos },
  { id: "marcos", fn: marcos },
];

// originalTangles.js
// 15 tangles originales para el libro de colorear zentangle.
// Cada uno es visualmente distinto y rellena un rectángulo. Todos son
// «coloreables»: contorno sobre blanco, sin masas negras.
// Firma: fn(rng, box, cfg) → capas [{ d, fill, stroke? }] (como classicTangles.js).
import { PathBuilder } from "../../core/pathBuilder.js";
import { rFloat, rInt } from "../../core/prng.js";

const TAU = Math.PI * 2;
const W = "#fff";
const mk = (rng, cfg) => new PathBuilder({ sketchy: cfg.sketchy || 0, rng });
const dims = (r) => ({ w: r.x1 - r.x0, h: r.y1 - r.y0, cx: (r.x0 + r.x1) / 2, cy: (r.y0 + r.y1) / 2 });

// ---------------------------------------------------------------------------
// ONDAS: líneas onduladas paralelas suaves (como olas de agua calma).
// ---------------------------------------------------------------------------
function ondas(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 2.2, 3.0);
  const rot = rFloat(rng, -0.4, 0.4);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const lam = s * rFloat(rng, 3.5, 5.5);
  const amp = s * rFloat(rng, 0.3, 0.6);
  const ph = rFloat(rng, 0, TAU);
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  for (let v = -D; v <= D; v += s) {
    const pts = [];
    for (let u = -D; u <= D; u += lam / 10) {
      const yOff = Math.sin((u / lam) * TAU + ph) * amp;
      pts.push(P(u, v + yOff));
    }
    if (pts.length >= 2) {
      b.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) b.lineTo(pts[i].x, pts[i].y);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// SEMILLAS: formas almendradas (ojos) empaquetadas en filas.
// ---------------------------------------------------------------------------
function semillas(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 3.8, 5.2);
  const rot = rFloat(rng, -0.2, 0.2);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  const seedW = s * 0.42, seedH = s * 0.24;
  for (let v = -D; v <= D; v += s) {
    const offset = ((Math.round(v / s) & 1) ? s * 0.5 : 0);
    for (let u = -D + offset; u <= D; u += s) {
      const center = P(u, v);
      if (center.x < r.x0 - s || center.x > r.x1 + s || center.y < r.y0 - s || center.y > r.y1 + s) continue;
      // Forma almendrada: dos arcos que se encuentran en las puntas.
      const tipL = P(u - seedW, v);
      const tipR = P(u + seedW, v);
      const top = P(u, v - seedH);
      const bot = P(u, v + seedH);
      b.moveTo(tipL.x, tipL.y);
      b.quadTo(top.x, top.y, tipR.x, tipR.y);
      b.quadTo(bot.x, bot.y, tipL.x, tipL.y);
      b.close();
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// TELARAÑA: polígonos concéntricos unidos por líneas radiales.
// ---------------------------------------------------------------------------
function telarana(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 4.5, 6.0);
  const sides = rInt(rng, 5, 8);
  const rings = rInt(rng, 2, 4);
  const rot = rFloat(rng, 0, TAU);
  const b = mk(rng, cfg);
  const D = Math.hypot(w, h) / 2 + s;
  for (let gx = -D; gx <= D; gx += s * 2.5) {
    for (let gy = -D; gy <= D; gy += s * 2.5) {
      const X = cx + gx, Y = cy + gy;
      if (X < r.x0 - s * 2 || X > r.x1 + s * 2 || Y < r.y0 - s * 2 || Y > r.y1 + s * 2) continue;
      const R = s * 0.9;
      // Anillos concéntricos (polígonos).
      for (let ring = 1; ring <= rings; ring++) {
        const rr = R * (ring / rings);
        const a0 = rot + (ring & 1 ? Math.PI / sides : 0);
        for (let k = 0; k <= sides; k++) {
          const a = a0 + (k / sides) * TAU;
          const px = X + Math.cos(a) * rr, py = Y + Math.sin(a) * rr;
          k === 0 ? b.moveTo(px, py) : b.lineTo(px, py);
        }
        b.close();
      }
      // Líneas radiales desde el centro hasta el anillo exterior.
      for (let k = 0; k < sides; k++) {
        const a = rot + (k / sides) * TAU;
        b.moveTo(X, Y);
        b.lineTo(X + Math.cos(a) * R, Y + Math.sin(a) * R);
      }
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// LADRILLOS: retícula de rectángulos desplazados (como una pared de ladrillos).
// ---------------------------------------------------------------------------
function ladrillos(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const bw = g * rFloat(rng, 4.5, 6.5);
  const bh = bw * rFloat(rng, 0.35, 0.5);
  const rot = rFloat(rng, -0.15, 0.15);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + bw;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  for (let v = -D; v <= D; v += bh) {
    const row = Math.round(v / bh);
    const offset = (row & 1) ? bw * 0.5 : 0;
    for (let u = -D + offset; u <= D; u += bw) {
      const p0 = P(u, v), p1 = P(u + bw, v), p2 = P(u + bw, v + bh), p3 = P(u, v + bh);
      b.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y).close();
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// CORRIENTES: curvas en S fluidas como ríos vistos desde arriba.
// ---------------------------------------------------------------------------
function corrientes(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 2.8, 4.0);
  const rot = rFloat(rng, -0.3, 0.3);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  for (let v = -D; v <= D; v += s) {
    const amp = s * rFloat(rng, 0.6, 1.2);
    const lam = s * rFloat(rng, 4, 7);
    const ph = rFloat(rng, 0, TAU);
    const pts = [];
    for (let u = -D; u <= D; u += lam / 8) {
      const yOff = Math.sin((u / lam) * TAU + ph) * amp + Math.sin((u / lam) * TAU * 0.5 + ph * 1.3) * amp * 0.3;
      pts.push(P(u, v + yOff));
    }
    if (pts.length >= 2) {
      b.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        b.quadTo(pts[i].x, pts[i].y, mx, my);
      }
      b.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// ESPINAS: formas de espina (V invertida) en filas alternas (espina de pez).
// ---------------------------------------------------------------------------
function espinas(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 2.8, 3.8);
  const rot = rFloat(rng, -0.3, 0.3);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  const halfW = s * 0.4, height = s * 0.55;
  for (let v = -D; v <= D; v += s * 0.7) {
    const row = Math.round(v / (s * 0.7));
    const offset = (row & 1) ? halfW : 0;
    for (let u = -D + offset; u <= D; u += halfW * 2) {
      const top = P(u, v - height * 0.5);
      const left = P(u - halfW, v + height * 0.5);
      const right = P(u + halfW, v + height * 0.5);
      b.moveTo(top.x, top.y).lineTo(left.x, left.y).moveTo(top.x, top.y).lineTo(right.x, right.y);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// RED: patrón de rombos (diagonales cruzadas) formando una red.
// ---------------------------------------------------------------------------
function red(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 3.2, 4.5);
  const rot = rFloat(rng, -0.15, 0.15) + Math.PI / 4;
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  // Dos familias de líneas paralelas perpendiculares entre sí.
  for (let u = -D; u <= D; u += s) {
    const p0 = P(u, -D), p1 = P(u, D);
    b.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y);
  }
  for (let v = -D; v <= D; v += s) {
    const p0 = P(-D, v), p1 = P(D, v);
    b.moveTo(p0.x, p0.y).lineTo(p1.x, p1.y);
  }
  // Pequeño círculo en cada cruce (nudo de la red).
  const knotR = g * 0.5;
  for (let u = -D; u <= D; u += s) {
    for (let v = -D; v <= D; v += s) {
      const pt = P(u, v);
      if (pt.x >= r.x0 - s && pt.x <= r.x1 + s && pt.y >= r.y0 - s && pt.y <= r.y1 + s) {
        b.circle(pt.x, pt.y, knotR);
      }
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// GOTAS: gotas en filas alternas (unas hacia arriba, otras hacia abajo).
// ---------------------------------------------------------------------------
function gotas(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 3.5, 4.8);
  const rot = rFloat(rng, -0.2, 0.2);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  const dropR = s * 0.32;
  for (let v = -D; v <= D; v += s) {
    const row = Math.round(v / s);
    const flip = row & 1 ? -1 : 1;
    const offset = (row & 1) ? s * 0.5 : 0;
    for (let u = -D + offset; u <= D; u += s) {
      const center = P(u, v);
      if (center.x < r.x0 - s || center.x > r.x1 + s || center.y < r.y0 - s || center.y > r.y1 + s) continue;
      // Gota: círculo con una punta (la punta es una cuadrática).
      const tipY = center.y - flip * dropR * 1.6;
      b.moveTo(center.x, center.y + flip * dropR);
      b.arcTo(dropR, dropR, 0, 1, flip > 0 ? 0 : 1, center.x, center.y - flip * dropR * 0.3);
      b.quadTo(center.x + dropR * 0.15, tipY, center.x, tipY);
      b.quadTo(center.x - dropR * 0.15, tipY, center.x - dropR, center.y - flip * dropR * 0.3);
      b.arcTo(dropR, dropR, 0, 1, flip > 0 ? 0 : 1, center.x, center.y + flip * dropR);
      b.close();
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// LIANAS: curvas entrelazadas como lianas colgantes.
// ---------------------------------------------------------------------------
function lianas(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 3.0, 4.5);
  const b = mk(rng, cfg);
  // Cadenas verticales onduladas que se entrelazan.
  for (let x = r.x0; x <= r.x1; x += s) {
    const amp = s * rFloat(rng, 0.3, 0.7);
    const phase = rFloat(rng, 0, TAU);
    const pts = [];
    for (let y = r.y0 - s; y <= r.y1 + s; y += s * 0.3) {
      const xOff = Math.sin((y / (s * 3)) * TAU + phase) * amp;
      pts.push({ x: x + xOff, y });
    }
    if (pts.length >= 2) {
      b.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        b.quadTo(pts[i].x, pts[i].y, mx, my);
      }
      b.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }
    // Pequeñas hojas (arcos) a lo largo de la liana.
    for (let i = 2; i < pts.length - 2; i += rInt(rng, 3, 5)) {
      const side = rng() < 0.5 ? -1 : 1;
      const leafLen = g * rFloat(rng, 1.2, 2.0);
      const pt = pts[i];
      b.moveTo(pt.x, pt.y);
      b.quadTo(pt.x + side * leafLen, pt.y - leafLen * 0.3, pt.x + side * leafLen * 0.3, pt.y - leafLen * 0.8);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// NIDO: bucles concéntricos irregulares (como un nido de pájaro visto desde arriba).
// ---------------------------------------------------------------------------
function nido(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const b = mk(rng, cfg);
  const maxR = Math.min(w, h) * 0.48;
  const nRings = Math.max(3, Math.round(maxR / (g * 1.8)));
  for (let ring = 1; ring <= nRings; ring++) {
    const R = maxR * (ring / nRings);
    const nPts = Math.max(8, Math.round(R * 1.2));
    const pts = [];
    for (let k = 0; k <= nPts; k++) {
      const a = (k / nPts) * TAU;
      const jitter = g * rFloat(rng, -0.6, 0.6);
      const rr = R + jitter;
      pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
    }
    b.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
      b.quadTo(pts[i].x, pts[i].y, mx, my);
    }
    b.close();
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// PANAL: celdas hexagonales simples (panal de abejas, sin las aristas internas de Cubine).
// ---------------------------------------------------------------------------
function panal(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 3.0, 4.2);
  const b = mk(rng, cfg);
  const hx = s * Math.sqrt(3), vy = s * 1.5;
  const nx = Math.ceil(w / hx / 2) + 2, ny = Math.ceil(h / vy / 2) + 2;
  for (let j = -ny; j <= ny; j++) for (let i = -nx; i <= nx; i++) {
    const X = cx + (i + (j & 1 ? 0.5 : 0)) * hx, Y = cy + j * vy;
    if (X < r.x0 - s * 2 || X > r.x1 + s * 2 || Y < r.y0 - s * 2 || Y > r.y1 + s * 2) continue;
    const V = (k) => ({ x: X + Math.cos(-Math.PI / 2 + (k * Math.PI) / 3) * s, y: Y + Math.sin(-Math.PI / 2 + (k * Math.PI) / 3) * s });
    const p = [0, 1, 2, 3, 4, 5].map(V);
    b.moveTo(p[0].x, p[0].y);
    for (let k = 1; k <= 6; k++) b.lineTo(p[k % 6].x, p[k % 6].y);
    b.close();
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// RIZOS: pequeños espirales (rollos) en filas, más simples que Printemps.
// ---------------------------------------------------------------------------
function rizos(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 3.5, 4.8);
  const rot = rFloat(rng, -0.15, 0.15);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  const curlR = s * 0.32;
  const turns = rFloat(rng, 1.5, 2.5);
  for (let v = -D; v <= D; v += s) {
    const offset = ((Math.round(v / s) & 1) ? s * 0.5 : 0);
    for (let u = -D + offset; u <= D; u += s) {
      const center = P(u, v);
      if (center.x < r.x0 - s || center.x > r.x1 + s || center.y < r.y0 - s || center.y > r.y1 + s) continue;
      const dir = rng() < 0.5 ? 1 : -1;
      const a0 = rFloat(rng, 0, TAU);
      const steps = Math.max(16, Math.round(curlR * 10));
      const pts = [];
      for (let st = 0; st <= steps; st++) {
        const t = st / steps;
        const a = a0 + dir * turns * TAU * t;
        const rad = curlR * (0.1 + 0.9 * t);
        pts.push({ x: center.x + Math.cos(a) * rad, y: center.y + Math.sin(a) * rad });
      }
      b.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) b.lineTo(pts[i].x, pts[i].y);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// FLECHAS: filas de formas de flecha/chevron apuntando en la misma dirección.
// ---------------------------------------------------------------------------
function flechas(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 3.0, 4.2);
  const rot = rFloat(rng, -0.3, 0.3);
  const c = Math.cos(rot), sn = Math.sin(rot);
  const D = Math.hypot(w, h) / 2 + s;
  const P = (u, v) => ({ x: cx + u * c - v * sn, y: cy + u * sn + v * c });
  const b = mk(rng, cfg);
  const arrowW = s * 0.38, arrowH = s * 0.5;
  for (let v = -D; v <= D; v += s * 0.75) {
    const offset = ((Math.round(v / (s * 0.75)) & 1) ? arrowW : 0);
    for (let u = -D + offset; u <= D; u += arrowW * 2) {
      const tip = P(u, v - arrowH * 0.5);
      const left = P(u - arrowW, v + arrowH * 0.5);
      const right = P(u + arrowW, v + arrowH * 0.5);
      const notch = P(u, v + arrowH * 0.15);
      b.moveTo(tip.x, tip.y).lineTo(right.x, right.y).lineTo(notch.x, notch.y).lineTo(left.x, left.y).close();
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// MUSGO: grupos de puntos pequeños conectados por líneas finas (como musgo).
// ---------------------------------------------------------------------------
function musgo(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h } = dims(r);
  const s = g * rFloat(rng, 3.5, 5.0);
  const b = mk(rng, cfg);
  const dotR = g * 0.45;
  // Grupos de 3-5 puntos conectados.
  for (let y = r.y0; y <= r.y1; y += s) {
    for (let x = r.x0; x <= r.x1; x += s) {
      const nDots = rInt(rng, 3, 5);
      const pts = [];
      for (let d = 0; d < nDots; d++) {
        const dx = x + rFloat(rng, -s * 0.35, s * 0.35);
        const dy = y + rFloat(rng, -s * 0.35, s * 0.35);
        pts.push({ x: dx, y: dy });
        b.circle(dx, dy, dotR);
      }
      // Conectar puntos cercanos con líneas finas.
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          if (Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) < s * 0.6) {
            b.moveTo(pts[i].x, pts[i].y).lineTo(pts[j].x, pts[j].y);
          }
        }
      }
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// ---------------------------------------------------------------------------
// DUNAS: capas curvas superpuestas (como dunas de arena).
// ---------------------------------------------------------------------------
function dunas(rng, r, cfg) {
  const g = cfg.gap;
  const { w, h, cx, cy } = dims(r);
  const s = g * rFloat(rng, 2.5, 3.5);
  const b = mk(rng, cfg);
  const layerH = s * 1.2;
  for (let y = r.y0 - layerH; y <= r.y1 + layerH; y += layerH) {
    const amp = s * rFloat(rng, 0.4, 0.8);
    const lam = w * rFloat(rng, 0.3, 0.6);
    const ph = rFloat(rng, 0, TAU);
    // Línea base ondulada.
    const pts = [];
    for (let x = r.x0 - s; x <= r.x1 + s; x += lam / 12) {
      const yOff = Math.sin((x / lam) * TAU + ph) * amp;
      pts.push({ x, y: y + yOff });
    }
    if (pts.length >= 2) {
      b.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2;
        b.quadTo(pts[i].x, pts[i].y, mx, my);
      }
      b.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    }
    // Línea de sombra paralela (da volumen de duna).
    const shadowOff = g * 0.8;
    const pts2 = pts.map((p) => ({ x: p.x + shadowOff * 0.3, y: p.y + shadowOff }));
    if (pts2.length >= 2) {
      b.moveTo(pts2[0].x, pts2[0].y);
      for (let i = 1; i < pts2.length - 1; i++) {
        const mx = (pts2[i].x + pts2[i + 1].x) / 2, my = (pts2[i].y + pts2[i + 1].y) / 2;
        b.quadTo(pts2[i].x, pts2[i].y, mx, my);
      }
      b.lineTo(pts2[pts2.length - 1].x, pts2[pts2.length - 1].y);
    }
  }
  return [{ d: b.d, fill: "none" }];
}

// Exportar los 15 tangles originales en el formato del pool.
export const ORIGINAL_TANGLES = [
  { id: "ondas", fn: ondas },
  { id: "semillas", fn: semillas },
  { id: "telarana", fn: telarana },
  { id: "ladrillos", fn: ladrillos },
  { id: "corrientes", fn: corrientes },
  { id: "espinas", fn: espinas },
  { id: "red", fn: red },
  { id: "gotas", fn: gotas },
  { id: "lianas", fn: lianas },
  { id: "nido", fn: nido },
  { id: "panal", fn: panal },
  { id: "rizos", fn: rizos },
  { id: "flechas", fn: flechas },
  { id: "musgo", fn: musgo },
  { id: "dunas", fn: dunas },
];

// ornaments.js
// Páginas de composición única (no una retícula de unidades) y la estrella
// subdividida, que zentangleCells usa como string (starCells):
//   icon_mandala   tile Zentangle con mandala de iconos: uno al centro y anillos
//                  de copias giradas hacia afuera (simetría de roseta Cn) sobre
//                  un tangle de fondo, cenefa, y esquinas con tangles clásicos.
//   facet_spiral   flores de pétalos facetados (cristal) en espiral áurea,
//                  chicas al centro y grandes al borde, encimadas.
// Todas reciben (doc, opts) como generateSampler y respetan cfg.solids / sketchy.
import { createRNG, hash, rFloat, rInt } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";
import { ICONS } from "./patterns/icons.js";
import { MOTIFS } from "./patterns/motifs.js";
import { REPEATABLE, POOLS } from "./sampler.js";

const TAU = Math.PI * 2;
const fmt = (n) => (Math.round(Number(n) * 1000) / 1000).toString();
const clampN = (v, lo, hi, fb) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb);

function baseOpts(opts) {
  const seed = opts.seed >>> 0;
  const rng = createRNG(hash(seed, 0x0a7e));
  for (let w = 0; w < 12; w++) rng();
  return {
    seed, rng,
    a: opts.areaMm,
    strokeMm: clampN(opts.patternStrokeMm, 0.1, 3, 0.5),
    borderMm: clampN(opts.cellBorderWidthMm, 0.1, 5, 0.9),
    minGapMm: Math.max(0.9, clampN(opts.minGapMm, 0.5, 10, 1.8)),
    sketchy: clampN(opts.sketchy, 0, 2, 0),
    solids: opts.samplerSolids === true,
    prefix: `o_${(seed % 1000000).toString(16)}_`,
  };
}

const pathEl = (d, sw, fill = "none") =>
  `<path d="${d}" fill="${fill}" stroke="#000" stroke-width="${fmt(sw)}" stroke-linecap="round" stroke-linejoin="round"/>`;

// Dibuja las capas de un icono (formato motifs/icons) con una transformación.
function iconLayers(layers, sw, tf, defs, idBase) {
  let n = 0;
  const out = layers.filter((l) => l && l.d).map((l) => {
    let el = l.stroke === false
      ? `<path d="${l.d}" fill="${l.fill}" stroke="none"/>`
      : pathEl(l.d, sw * (l.w || 1), l.fill);
    if (l.clipD) {
      const id = `${idBase}_${n++}`;
      defs.push(`<clipPath id="${id}"><path d="${l.clipD}"/></clipPath>`);
      el = `<g clip-path="url(#${id})">${el}</g>`;
    }
    return el;
  });
  return tf ? `<g transform="${tf}">${out.join("")}</g>` : out.join("");
}

function pushDefs(doc, defs) {
  if (!defs.length) return;
  if (Array.isArray(doc.defs)) doc.defs.push(...defs);
  else doc.body.unshift(`<defs>${defs.join("")}</defs>`);
}

// Sección Zentangle: un tangle recortado a una región (clipD) cuyo test de
// pertenencia es inside(). El propio contorno en blanco va dentro del grupo
// recortado para que nunca quede vacío (resvg falla con recortes sin contenido).
function tangleRegion(motif, seedRng, box, inside, clipD, o, defs, id, evenodd = false, gapMul = 1.4) {
  const cfg = { minGapMm: o.minGapMm * gapMul, patternStrokeMm: o.strokeMm * 0.85, sketchy: o.sketchy, solids: false, inside };
  let layers = [];
  try { layers = (motif.fn(seedRng, box, cfg) || []).filter((l) => l && l.d); } catch (e) { layers = []; }
  if (!layers.length) return "";
  defs.push(`<clipPath id="${id}"><path d="${clipD}"${evenodd ? ' clip-rule="evenodd"' : ""}/></clipPath>`);
  return `<g clip-path="url(#${id})" data-tangle="${motif.id}"><path d="${clipD}" fill="#fff" stroke="none"${evenodd ? ' fill-rule="evenodd"' : ""}/>${iconLayers(layers, o.strokeMm * 0.85, null, defs, id)}</g>`;
}

// Sin asteriscos: tapados a medias por los discos de los iconos quedaban como
// rayitas sueltas flotando entre las copias.
const ringTangles = () => MOTIFS.filter((m) => ["polka", "wavesDots", "bubbles"].includes(m.id));

// ---------------------------------------------------------------------------
// Mandala de iconos
// ---------------------------------------------------------------------------

const MANDALA_ICONS = Object.keys(REPEATABLE);

function drawIcon(motif, rng, x, y, r, rot, o, defs, id, backing = false) {
  const cfg = {
    minGapMm: o.minGapMm * 1.2, patternStrokeMm: o.strokeMm, sketchy: o.sketchy, solids: o.solids,
    inside: (qx, qy, ov) => Math.hypot(qx - x, qy - y) <= r + ov,
  };
  // Los iconos dibujan a ~0.75 de su caja: se agranda para que llenen el círculo.
  const h = r * 1.15;
  let layers = [];
  try { layers = motif.fn(rng, { x0: x - h, y0: y - h, x1: x + h, y1: y + h }, cfg) || []; } catch (e) { layers = []; }
  const tf = rot ? `rotate(${fmt(rot)} ${fmt(x)} ${fmt(y)})` : null;
  // backing: disco blanco que tapa el tangle de fondo del anillo detrás del icono.
  const disc = backing ? `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(r)}" fill="#fff" stroke="none"/>` : "";
  return `<g data-motif="${motif.id}">${disc}${iconLayers(layers, o.strokeMm, tf, defs, id)}</g>`;
}

// Mayor círculo que cabe entre dos copias vecinas de un anillo (centros a
// distancia d, radio rr, n copias) y por dentro del círculo Ri.
function interleave(d, rr, n, Ri, gap) {
  for (let r = Ri * 0.2; r >= 6; r -= 0.25) {
    const d2 = Ri - gap - r;
    const dx = d2 - d * Math.cos(Math.PI / n), dy = d * Math.sin(Math.PI / n);
    const ok = Math.hypot(dx, dy) >= rr + r + gap && 2 * d2 * Math.sin(Math.PI / n) >= 2 * r + gap;
    if (ok) return { d: d2, r };
  }
  return null;
}

// Cenefa entre dos círculos: zigzag, cuentas o festón.
function band(kind, cx, cy, r0, r1, o, rng) {
  const b = new PathBuilder({ sketchy: o.sketchy * 0.5, rng });
  const w = r1 - r0, mid = (r0 + r1) / 2;
  if (kind === "beads") {
    const rb = w * 0.3, n = Math.max(12, Math.floor((TAU * mid) / (rb * 2 + o.minGapMm * 1.5)));
    for (let k = 0; k < n; k++) { const t = (k / n) * TAU; b.circle(cx + Math.cos(t) * mid, cy + Math.sin(t) * mid, rb); }
  } else if (kind === "scallops") {
    const n = Math.max(12, Math.floor((TAU * r0) / (w * 1.1)));
    for (let k = 0; k < n; k++) {
      const t0 = (k / n) * TAU, t1 = ((k + 1) / n) * TAU, tm = (t0 + t1) / 2;
      b.moveTo(cx + Math.cos(t0) * r0, cy + Math.sin(t0) * r0)
        .quadTo(cx + Math.cos(tm) * (r1 + w * 0.15), cy + Math.sin(tm) * (r1 + w * 0.15), cx + Math.cos(t1) * r0, cy + Math.sin(t1) * r0);
    }
  } else {
    const n = Math.max(16, Math.floor((TAU * mid) / (w * 0.95)));
    for (let k = 0; k <= n * 2; k++) {
      const t = (k / (n * 2)) * TAU, rr = k % 2 ? r1 - w * 0.12 : r0 + w * 0.12;
      const x = cx + Math.cos(t) * rr, y = cy + Math.sin(t) * rr;
      if (k) b.lineTo(x, y); else b.moveTo(x, y);
    }
  }
  return b.d;
}

export async function generateIconMandala(doc, opts) {
  const o = baseOpts(opts);
  const { a, rng } = o;
  const defs = [];
  const cx = a.x + a.w / 2, cy = a.y + a.h / 2;
  const R = Math.min(a.w, a.h) / 2 - o.borderMm;
  const bandW = Math.max(8, R * 0.11);
  const Ri = R - bandW;                      // interior de la mandala
  const gap = o.minGapMm * 1.8;
  const pick = (exclude) => {
    const ids = MANDALA_ICONS.filter((id) => !exclude.includes(id));
    const id = ids[Math.floor(rng() * ids.length)];
    return ICONS.find((m) => m.id === id);
  };
  const main = pick([]), ring = rng() < 0.5 ? main : pick([main.id]);
  const body = [];

  // Icono central.
  const r0 = Ri * rFloat(rng, 0.27, 0.32);
  body.push(drawIcon(main, createRNG(hash(o.seed, 1)), cx, cy, r0, 0, o, defs, `${o.prefix}m0`));

  // Anillos: en cada anillo se busca el radio de copia más grande que deje
  // al menos 5 copias sin solaparse; si la copia quedaría bajo el mínimo
  // coloreable del icono, el anillo se vuelve una cenefa decorativa.
  let rin = r0 + gap, ringNo = 0;
  const kinds = ["zigzag", "beads", "scallops"];
  while (Ri - rin > 6) {
    // Del segundo anillo en adelante se prefiere un icono que quepa a ese tamaño.
    let motif = ringNo === 0 ? ring : pick([ring.id]);
    if (ringNo > 0 && REPEATABLE[motif.id] / 2 * 0.8 > (Ri - rin - gap) / 2) {
      const fit = MANDALA_ICONS.filter((id) => REPEATABLE[id] / 2 * 0.8 <= (Ri - rin - gap) / 2);
      if (fit.length) { const fid = fit[Math.floor(rng() * fit.length)]; motif = ICONS.find((m) => m.id === fid); }
    }
    const rMin = REPEATABLE[motif.id] / 2 * 0.8;
    // El primer anillo deja sitio para un anillo intercalado de copias chicas.
    const rr = Math.min((Ri - rin - gap) / 2, Ri * (ringNo === 0 ? 0.21 : 0.24));
    const d = rin + rr;
    const n = Math.floor(Math.PI / Math.asin(Math.min(1, (rr + gap / 2) / d)));
    if (rr < rMin || n < 5) {
      const w = Math.min(Ri - rin - gap * 0.5, bandW * 0.9);
      if (w > 5) body.push(pathEl(band(kinds[ringNo % 3], cx, cy, rin, rin + w, o, rng), o.strokeMm));
      rin += w + gap * 0.6;
      if (w <= 5) break;
    } else {
      const t0 = rng() * TAU;
      // Fondo del anillo: un tangle suave (sección Zentangle) detrás de los iconos.
      {
        const ra = Math.max(rin - gap * 0.5, 0), rb = Math.min(d + rr + gap * 0.5, Ri);
        const cb = new PathBuilder({ sketchy: 0, rng });
        cb.circle(cx, cy, rb); if (ra > 0) cb.circle(cx, cy, ra);
        const tp = ringTangles(), tm = tp[Math.floor(rng() * tp.length)];
        body.push(tangleRegion(tm, createRNG(hash(o.seed, 300 + ringNo)), { x0: cx - rb, y0: cy - rb, x1: cx + rb, y1: cy + rb },
          (x, y, ov) => { const q = Math.hypot(x - cx, y - cy); return q <= rb + ov && q >= ra - ov; }, cb.d, o, defs, `${o.prefix}rb${ringNo}`, true, 1.8));
      }
      // Cn: la misma copia girada; todas miran hacia afuera.
      for (let k = 0; k < n; k++) {
        const t = t0 + (k / n) * TAU, x = cx + Math.cos(t) * d, y = cy + Math.sin(t) * d;
        // Cada copia usa el mismo generador: son idénticas salvo por el giro.
        const crng = createRNG(hash(o.seed, 100 + ringNo));
        body.push(drawIcon(motif, crng, x, y, rr, (t * 180) / Math.PI + 90, o, defs, `${o.prefix}r${ringNo}_${k}`, true));
      }
      // Anillo intercalado: copias chicas en los huecos entre las del anillo,
      // pegadas a la cenefa (como las mariposas entre las ranas).
      const inter = interleave(d, rr, n, Ri, gap);
      const small = inter && MANDALA_ICONS.filter((id) => id !== motif.id && REPEATABLE[id] / 2 * 0.8 <= inter.r);
      if (small && small.length) {
        const imId = small[Math.floor(rng() * small.length)];
        const im = ICONS.find((m) => m.id === imId);
        for (let k = 0; k < n; k++) {
          const t = t0 + ((k + 0.5) / n) * TAU, x = cx + Math.cos(t) * inter.d, y = cy + Math.sin(t) * inter.d;
          body.push(drawIcon(im, createRNG(hash(o.seed, 500 + ringNo)), x, y, inter.r, (t * 180) / Math.PI + 90, o, defs, `${o.prefix}i${ringNo}_${k}`, true));
        }
        rin = Math.max(d + rr, inter.d + inter.r) + gap;
      } else {
        // Separador fino entre anillos.
        const sep = new PathBuilder({ sketchy: o.sketchy * 0.5, rng });
        sep.circle(cx, cy, d + rr + gap * 0.5);
        body.push(pathEl(sep.d, o.strokeMm));
        rin = d + rr + gap;
      }
    }
    ringNo++;
  }

  // Cenefa exterior y orla.
  body.push(pathEl(band(kinds[rInt(rng, 0, 2)], cx, cy, Ri, R, o, rng), o.strokeMm));
  const frame = new PathBuilder({ sketchy: o.sketchy * 0.4, rng });
  frame.circle(cx, cy, R).circle(cx, cy, Ri);
  body.push(pathEl(frame.d, o.borderMm));

  // Esquinas de la página: como en un tile Zentangle, el string (círculo + ejes)
  // divide lo que queda fuera de la mandala en cuatro secciones con tangles
  // clásicos (cadent, florz, crescent moon...).
  const classic = POOLS.classic;
  const used = new Set();
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sy], k) => {
    const ex = sx < 0 ? a.x : a.x + a.w, ey = sy < 0 ? a.y : a.y + a.h;
    const poly = [{ x: cx, y: ey }, { x: ex, y: ey }, { x: ex, y: cy }];
    // Arco del círculo exterior de vuelta al eje vertical.
    const tA = Math.atan2(0, sx), tB = Math.atan2(sy, 0);
    for (let i = 0; i <= 24; i++) {
      let t = tA + ((tB - tA) * i) / 24;
      if (Math.abs(tB - tA) > Math.PI) t = tA + ((tB - tA + (tB < tA ? TAU : -TAU)) * i) / 24;
      poly.push({ x: cx + Math.cos(t) * (R + o.borderMm / 2), y: cy + Math.sin(t) * (R + o.borderMm / 2) });
    }
    let area = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; area += p.x * q.y - q.x * p.y; }
    if (Math.abs(area) / 2 < 150) return;
    let tm = classic[Math.floor(rng() * classic.length)];
    for (let tries = 0; used.has(tm.id) && tries < 6; tries++) tm = classic[Math.floor(rng() * classic.length)];
    used.add(tm.id);
    const d = polyPath(poly);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of poly) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const side = Math.max(x1 - x0, y1 - y0);
    const box = { x0: (x0 + x1) / 2 - side / 2, y0: (y0 + y1) / 2 - side / 2, x1: (x0 + x1) / 2 + side / 2, y1: (y0 + y1) / 2 + side / 2 };
    body.unshift(tangleRegion(tm, createRNG(hash(o.seed, 800 + k)), box, insidePoly(poly), d, o, defs, `${o.prefix}c${k}`, false, 1.2));
    body.push(pathEl(d, o.borderMm));
  });

  pushDefs(doc, defs);
  doc.body.push(...body);
}

// ---------------------------------------------------------------------------
// Estrella subdividida
// ---------------------------------------------------------------------------

// Bisección por la arista más larga: el triángulo se parte desde el punto medio
// de su lado mayor hacia el vértice opuesto, hasta que el lado mayor baja del
// tamaño objetivo (que se achica hacia las puntas de la estrella).
export function bisect(tri, target, out, minSide, depth = 0) {
  const [A, B, C] = tri;
  const ab = Math.hypot(B.x - A.x, B.y - A.y), bc = Math.hypot(C.x - B.x, C.y - B.y), ca = Math.hypot(A.x - C.x, A.y - C.y);
  const longest = Math.max(ab, bc, ca);
  const cx = (A.x + B.x + C.x) / 3, cy = (A.y + B.y + C.y) / 3;
  // Lado menor del hijo ~ mitad del mayor actual: no bajar del mínimo coloreable.
  if (depth > 14 || longest <= target(cx, cy) || longest / 2 < minSide) { out.push(tri); return; }
  let P, Q, R;
  if (longest === ab) { P = A; Q = B; R = C; } else if (longest === bc) { P = B; Q = C; R = A; } else { P = C; Q = A; R = B; }
  const M = { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 };
  bisect([P, M, R], target, out, minSide, depth + 1);
  bisect([M, Q, R], target, out, minSide, depth + 1);
}

export function starTriangles(cx, cy, Ro, Ri, n, rot) {
  const outer = [], inner = [];
  for (let k = 0; k < n; k++) {
    const t = rot + (k / n) * TAU, u = t + Math.PI / n;
    outer.push({ x: cx + Math.cos(t) * Ro, y: cy + Math.sin(t) * Ro });
    inner.push({ x: cx + Math.cos(u) * Ri, y: cy + Math.sin(u) * Ri });
  }
  const C = { x: cx, y: cy }, tris = [];
  for (let k = 0; k < n; k++) {
    const prev = inner[(k + n - 1) % n];
    tris.push([prev, outer[k], inner[k]]);   // punta
    tris.push([C, prev, inner[k]]);          // núcleo
  }
  return { tris, outer, inner, outline: outer.flatMap((p, k) => [p, inner[k]]) };
}

// Estrella como string Zentangle: celdas = triángulos bisecados de la estrella
// (más finos hacia las puntas) + una región de fondo alrededor de cada punta,
// cortada por rayos que salen de los vértices interiores hasta el borde. El motor de
// zentangleCells rellena cada celda con un tangle.
export function starCells(rng, rect, count, clipToRect) {
  const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
  const cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2;
  const n = rInt(rng, 5, 8);
  const Ro = Math.min(w, h) * rFloat(rng, 0.44, 0.48);
  const { tris, outer, inner } = starTriangles(cx, cy, Ro, Ro * rFloat(rng, 0.4, 0.5), n, -Math.PI / 2);
  // Escala del objetivo de bisección para acercarse a ~count celdas en total.
  const minSide = 9;
  let best = null;
  for (let f = 0.25; f <= 1.2; f += 0.05) {
    const target = (x, y) => Ro * f * (1 - 0.6 * Math.min(1, Math.hypot(x - cx, y - cy) / Ro));
    const out = [];
    for (const t of tris) bisect(t, target, out, minSide);
    const err = Math.abs(out.length + n - count);
    if (!best || err < best.err) best = { err, out };
  }
  const cells = best.out.map((poly) => poly.map((p) => ({ x: p.x, y: p.y })));
  const far = Math.hypot(w, h) * 2;
  for (let k = 0; k < n; k++) {
    // Región de fondo que envuelve la punta k: limitada por los rayos que salen
    // de los vértices interiores vecinos (así no se prolongan los picos).
    const I0 = inner[(k + n - 1) % n], I1 = inner[k], T = outer[k];
    const ray = (p) => {
      const dx = p.x - cx, dy = p.y - cy, L = Math.hypot(dx, dy) || 1;
      return { x: cx + (dx / L) * far, y: cy + (dy / L) * far };
    };
    const tA = Math.atan2(T.y - cy, T.x - cx);
    const M = { x: cx + Math.cos(tA) * far * 1.5, y: cy + Math.sin(tA) * far * 1.5 };
    const poly = clipToRect([I0, ray(I0), M, ray(I1), I1, T], rect);
    if (poly && poly.length >= 3) cells.push(poly);
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Pétalos facetados en espiral
// ---------------------------------------------------------------------------

// Un pétalo de cristal: polígono base→hombro→punta→hombro, partido en facetas
// (cuñas desde la base hacia el borde exterior). Cada faceta es una sección
// Zentangle: se alternan dos tangles y facetas en blanco. El relleno blanco del
// pétalo tapa lo que quedó detrás (las flores se encimen).
function petalFacets(base, ang, L, w, twist, nFacets) {
  const pt = (t, r) => ({ x: base.x + Math.cos(t) * r, y: base.y + Math.sin(t) * r });
  const s1 = pt(ang - w, L * 0.55), tip = pt(ang + twist, L), s2 = pt(ang + w * 0.8, L * 0.7);
  const edge = [s1, tip, s2];
  const along = (t) => {
    const seg = t < 0.5 ? 0 : 1, u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    const p = edge[seg], q = edge[seg + 1];
    return { x: p.x + (q.x - p.x) * u, y: p.y + (q.y - p.y) * u };
  };
  const wedges = [];
  for (let k = 0; k < nFacets; k++) {
    const t0 = k / nFacets, t1 = (k + 1) / nFacets;
    const poly = [base, along(t0)];
    if (t0 < 0.5 && t1 > 0.5) poly.push(tip);
    poly.push(along(t1));
    wedges.push(poly);
  }
  return { outline: [base, s1, tip, s2], wedges };
}

const polyPath = (poly) => poly.map((p, i) => `${i ? "L" : "M"}${fmt(p.x)} ${fmt(p.y)}`).join(" ") + " Z";

function insidePoly(poly) {
  return (x, y, over) => {
    let inside = false, m = Infinity;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const A = poly[i], B = poly[j];
      if ((A.y > y) !== (B.y > y) && x < ((B.x - A.x) * (y - A.y)) / (B.y - A.y) + A.x) inside = !inside;
      const dx = B.x - A.x, dy = B.y - A.y;
      const t = Math.max(0, Math.min(1, ((x - A.x) * dx + (y - A.y) * dy) / (dx * dx + dy * dy || 1)));
      m = Math.min(m, Math.hypot(x - (A.x + t * dx), y - (A.y + t * dy)));
    }
    return (inside ? -m : m) <= over;
  };
}

// Tangles livianos para facetas: se leen a tamaño chico y dejan zonas amplias.
const FACET_TANGLES = ["polka", "wavesDots", "diagStripes", "bubbles", "scales", "honeycomb", "zigzag", "triangles", "asterisks", "bricks"];

export async function generateFacetSpiral(doc, opts) {
  const o = baseOpts(opts);
  const { a, rng } = o;
  const defs = [];
  const clipId = `${o.prefix}page`;
  defs.push(`<clipPath id="${clipId}"><rect x="${fmt(a.x)}" y="${fmt(a.y)}" width="${fmt(a.w)}" height="${fmt(a.h)}"/></clipPath>`);
  const cx = a.x + a.w / 2 + rFloat(rng, -0.08, 0.08) * a.w, cy = a.y + a.h / 2 + rFloat(rng, -0.08, 0.08) * a.h;
  const Rmax = Math.hypot(a.w, a.h) / 2 * 1.05;
  const count = Math.round(clampN(opts.cellCount, 6, 60, 18));
  const golden = Math.PI * (3 - Math.sqrt(5));
  const flowers = [];
  for (let k = 0; k < count; k++) {
    // Espiral áurea: radio ~ sqrt(k); el tamaño crece hacia afuera (vórtice).
    const rho = Rmax * Math.sqrt((k + 1.5) / (count + 1.5));
    const t = k * golden + rFloat(rng, -0.15, 0.15);
    const size = Rmax * (0.2 + 0.32 * (rho / Rmax)) * rFloat(rng, 0.85, 1.1);
    flowers.push({ x: cx + Math.cos(t) * rho, y: cy + Math.sin(t) * rho, L: size, rot: rng() * TAU });
  }
  // Pintor: las chicas (centro) primero; las grandes las tapan.
  flowers.sort((p, q) => p.L - q.L);
  const tangles = MOTIFS.filter((m) => FACET_TANGLES.includes(m.id) && (o.solids || !m.heavy));
  const minFacet = Math.max(11, o.minGapMm * 6);
  const body = [];
  // Fondo: un tangle amplio en toda la página; los pétalos (relleno blanco) lo
  // tapan, así el vórtice del centro no queda como un hueco vacío.
  const bgPool = MOTIFS.filter((m) => ["bubbles", "polka", "wavesDots", "honeycomb", "scales"].includes(m.id));
  const bg = bgPool[Math.floor(rng() * bgPool.length)];
  const side = Math.max(a.w, a.h), mx = a.x + a.w / 2, my = a.y + a.h / 2;
  const bgBox = { x0: mx - side / 2, y0: my - side / 2, x1: mx + side / 2, y1: my + side / 2 };
  const bgCfg = {
    minGapMm: o.minGapMm * 2.2, patternStrokeMm: o.strokeMm * 0.85, sketchy: o.sketchy, solids: false,
    inside: (x, y, over) => x >= a.x - over && x <= a.x + a.w + over && y >= a.y - over && y <= a.y + a.h + over,
  };
  let bgLayers = [];
  try { bgLayers = (bg.fn(createRNG(hash(o.seed, 6000)), bgBox, bgCfg) || []).filter((l) => l && l.d); } catch (e) { bgLayers = []; }
  if (bgLayers.length) body.push(`<g data-motif="bg-${bg.id}">${iconLayers(bgLayers, o.strokeMm * 0.85, null, defs, `${o.prefix}bg`)}</g>`);
  let nid = 0;
  for (const fl of flowers) {
    const nP = rInt(rng, 5, 7), dir = rng() < 0.5 ? 1 : -1;
    // Dos tangles por flor: el mismo par en todos sus pétalos (unidad visual).
    const tA = tangles[Math.floor(rng() * tangles.length)];
    let tB = tangles[Math.floor(rng() * tangles.length)];
    if (tB === tA) tB = tangles[(tangles.indexOf(tA) + 1) % tangles.length];
    let g = "";
    for (let i = 0; i < nP; i++) {
      const ang = fl.rot + (i / nP) * TAU;
      const w = (Math.PI / nP) * rFloat(rng, 0.75, 0.95);
      const nF = Math.max(2, Math.min(5, Math.floor((fl.L * 1.6) / minFacet)));
      const { outline, wedges } = petalFacets({ x: fl.x, y: fl.y }, ang, fl.L, w, dir * w * 0.45, nF);
      // Pétalos y facetas fuera de la página: no se dibujan (un recorte vacío
      // dentro del recorte de la página además rompe a resvg).
      const offPage = (poly) => poly.every((p) => p.x < a.x) || poly.every((p) => p.x > a.x + a.w) ||
        poly.every((p) => p.y < a.y) || poly.every((p) => p.y > a.y + a.h);
      if (offPage(outline)) continue;
      g += `<path d="${polyPath(outline)}" fill="#fff" stroke="none"/>`;
      wedges.forEach((wd, k) => {
        // Patrón de facetas: A, blanco, B, blanco... (las blancas dan respiro).
        if (k % 2 || offPage(wd)) return;
        // Facetas degeneradas (área ~0) rompen el recorte en algunos renderizadores.
        let ar = 0;
        for (let i = 0; i < wd.length; i++) { const p = wd[i], q = wd[(i + 1) % wd.length]; ar += p.x * q.y - q.x * p.y; }
        if (Math.abs(ar) / 2 < 4) return;
        const motif = k % 4 === 0 ? tA : tB;
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of wd) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
        const side = Math.max(x1 - x0, y1 - y0), mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const box = { x0: mx - side / 2, y0: my - side / 2, x1: mx + side / 2, y1: my + side / 2 };
        const cfg = { minGapMm: o.minGapMm * 1.4, patternStrokeMm: o.strokeMm * 0.85, sketchy: o.sketchy, solids: o.solids, inside: insidePoly(wd) };
        let layers = [];
        try { layers = (motif.fn(createRNG(hash(o.seed, 7000 + nid)), box, cfg) || []).filter((l) => l && l.d); } catch (e) { layers = []; }
        if (!layers.length) return;
        const id = `${o.prefix}f${nid++}`;
        defs.push(`<clipPath id="${id}"><path d="${polyPath(wd)}"/></clipPath>`);
        // La propia faceta en blanco (invisible sobre el pétalo) garantiza que el
        // grupo recortado nunca quede vacío: resvg falla con recortes sin contenido.
        g += `<g clip-path="url(#${id})"><path d="${polyPath(wd)}" fill="#fff" stroke="none"/>${iconLayers(layers, o.strokeMm * 0.85, null, defs, id)}</g>`;
      });
      const lines = new PathBuilder({ sketchy: o.sketchy * 0.4, rng });
      for (const wd of wedges) { lines.moveTo(wd[0].x, wd[0].y).lineTo(wd[1].x, wd[1].y); }
      g += pathEl(polyPath(outline), o.strokeMm * 1.3) + pathEl(lines.d, o.strokeMm);
    }
    // Centro: tapa la convergencia de las facetas (allí no habría espacio para colorear).
    const dot = new PathBuilder({ sketchy: 0, rng });
    dot.circle(fl.x, fl.y, Math.max(3, fl.L * 0.16));
    g += pathEl(dot.d, o.strokeMm, o.solids ? "#000" : "#fff");
    body.push(`<g data-motif="facetFlower">${g}</g>`);
  }
  pushDefs(doc, defs);
  doc.body.push(`<g clip-path="url(#${clipId})">${body.join("")}</g>`);
  doc.body.push(`<rect x="${fmt(a.x)}" y="${fmt(a.y)}" width="${fmt(a.w)}" height="${fmt(a.h)}" fill="none" stroke="#000" stroke-width="${fmt(o.borderMm)}" stroke-linejoin="round"/>`);
}

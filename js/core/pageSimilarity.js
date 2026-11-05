// pageSimilarity.js
// Parecido visual entre páginas de un libro. Huella: densidad de tinta en una
// rejilla 24×24 del área de dibujo; parecido: correlación de Pearson entre
// huellas (1 = misma composición). Es la medida de _samples/bookAudit.mjs.
// En origami el relleno es casi liso y una figura repetida en espejo daba
// pares de 0.84–0.90: el lector los ve como la misma página.

export const NEAR_DUP = 0.8;
const G = 24;

// raster: { data, width, height } RGBA. pxPerMm: resolución. marginMm: margen.
export function pageFingerprint(r, pxPerMm, marginMm) {
  const out = new Float32Array(G * G);
  const x0 = Math.round(marginMm * pxPerMm), y0 = x0;
  const w = r.width - 2 * x0, h = r.height - 2 * y0;
  if (w <= G || h <= G) return out;
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) {
    let ink = 0, n = 0;
    for (let y = y0 + Math.floor((gy * h) / G); y < y0 + Math.floor(((gy + 1) * h) / G); y += 2)
      for (let x = x0 + Math.floor((gx * w) / G); x < x0 + Math.floor(((gx + 1) * w) / G); x += 2) { n++; if (r.data[(y * r.width + x) * 4] < 128) ink++; }
    out[gy * G + gx] = n ? ink / n : 0;
  }
  return out;
}

export function fingerprintCorr(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) { ma += a[i]; mb += b[i]; }
  ma /= a.length; mb /= b.length;
  let s = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.length; i++) { const da = a[i] - ma, db = b[i] - mb; s += da * db; sa += da * da; sb += db * db; }
  return s / Math.sqrt(sa * sb || 1);
}

// Mayor parecido de `fp` con las huellas de `others` (se saltan las vacías).
export function maxSimilarity(fp, others) {
  let best = 0, at = -1;
  others.forEach((o, k) => { const s = fingerprintCorr(fp, o); if (s > best) { best = s; at = k; } });
  return { sim: best, at };
}

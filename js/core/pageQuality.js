// pageQuality.js
// Control de calidad de una página para colorear, sobre su raster RGBA:
//   - bad:   regiones blancas visibles (≥ 0.5 mm²) donde no cabe la punta de
//            un rotulador (~1.2 mm): área < 3 mm² o grosor máximo < 1.2 mm
//   - micro: regiones < 0.5 mm² (se leen como manchitas de tinta)
//   - ink:   % de la página en negro
// Es la misma métrica que _samples/colorability.mjs y la compuerta de
// `npm test`; aquí se usa en la app para revisar cada página del libro.

// Umbrales del veredicto. `bad` se mide por dm² de área de dibujo para que
// valga igual en 8.5×11 que en 6×9 o en una doble página: 13/dm² son ~63
// zonas en una página Letter con margen de 12.7 mm. En un libro típico marca
// 1 o 2 de cada 10 páginas (las de más astillas).
export const QUALITY_LIMITS = { badPerDm2: 13, inkPct: 25 };

// rgba: { data, width, height } (como ImageData). pxPerMm: resolución.
// Con mark = true devuelve además una máscara (1 = región problemática).
export function analyzeColorability({ data, width: w, height: h }, pxPerMm, { mark = false } = {}) {
  const N = w * h;
  const white = new Uint8Array(N);
  let ink = 0;
  for (let i = 0; i < N; i++) { if (data[i * 4] > 128) white[i] = 1; else ink++; }
  // Distancia a la tinta (chamfer 3-4); el grosor de una región es su máximo.
  const dist = new Float32Array(N);
  for (let i = 0; i < N; i++) dist[i] = white[i] ? 1e9 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x; if (!dist[k]) continue;
    if (x > 0) dist[k] = Math.min(dist[k], dist[k - 1] + 3);
    if (y > 0) dist[k] = Math.min(dist[k], dist[k - w] + 3);
    if (x > 0 && y > 0) dist[k] = Math.min(dist[k], dist[k - w - 1] + 4);
    if (x < w - 1 && y > 0) dist[k] = Math.min(dist[k], dist[k - w + 1] + 4);
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const k = y * w + x; if (!dist[k]) continue;
    if (x < w - 1) dist[k] = Math.min(dist[k], dist[k + 1] + 3);
    if (y < h - 1) dist[k] = Math.min(dist[k], dist[k + w] + 3);
    if (x < w - 1 && y < h - 1) dist[k] = Math.min(dist[k], dist[k + w + 1] + 4);
    if (x > 0 && y < h - 1) dist[k] = Math.min(dist[k], dist[k + w - 1] + 4);
  }
  const seen = new Uint8Array(N), st = new Int32Array(N);
  const members = mark ? new Int32Array(N) : null;
  const mask = mark ? new Uint8Array(N) : null;
  let bad = 0, micro = 0, regions = 0;
  for (let i = 0; i < N; i++) {
    if (!white[i] || seen[i]) continue;
    let sp = 0, a = 0, md = 0, mc = 0;
    st[sp++] = i; seen[i] = 1;
    while (sp) {
      const k = st[--sp]; a++; if (dist[k] > md) md = dist[k];
      if (members) members[mc++] = k;
      const x = k % w;
      if (x > 0 && white[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; st[sp++] = k - 1; }
      if (x < w - 1 && white[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; st[sp++] = k + 1; }
      if (k >= w && white[k - w] && !seen[k - w]) { seen[k - w] = 1; st[sp++] = k - w; }
      if (k < N - w && white[k + w] && !seen[k + w]) { seen[k + w] = 1; st[sp++] = k + w; }
    }
    const mm2 = a / (pxPerMm * pxPerMm), thick = md / 3 / pxPerMm;
    regions++;
    if (mm2 < 0.5) micro++;
    else if (mm2 < 3 || thick < 0.6) { bad++; if (mask) for (let q = 0; q < mc; q++) mask[members[q]] = 1; }
  }
  return { ink: (100 * ink) / N, bad, micro, regions, ...(mask ? { mask } : {}) };
}

// Veredicto de una página. artAreaMm2: área del dibujo (sin márgenes).
export function qualityVerdict(q, artAreaMm2, limits = QUALITY_LIMITS) {
  const maxBad = Math.round((limits.badPerDm2 * artAreaMm2) / 10000);
  const reasons = [];
  if (q.bad > maxBad) reasons.push(`${q.bad} zonas diminutas (máx. ${maxBad})`);
  if (q.ink > limits.inkPct) reasons.push(`${Math.round(q.ink)} % de tinta (máx. ${limits.inkPct} %)`);
  return { ok: reasons.length === 0, reasons, maxBad };
}

// Peor es mayor: sirve para quedarse con el mejor de varios intentos.
export const qualityScore = (q, maxBad) => q.bad / Math.max(1, maxBad) + Math.max(0, q.ink - QUALITY_LIMITS.inkPct) / 5;

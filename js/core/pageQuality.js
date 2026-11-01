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
export function analyzeColorability({ data, width: w, height: h }, pxPerMm, { mark = false, inner = null } = {}) {
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
  // Mayor hueco vacío: radio (mm) del mayor círculo blanco dentro de `inner`
  // (caja del dibujo en px). Un hueco grande sin nada que colorear lo delata.
  let blank = 0;
  if (inner) for (let y = Math.max(0, inner.y0); y < Math.min(h, inner.y1); y++) for (let x = Math.max(0, inner.x0); x < Math.min(w, inner.x1); x++) {
    const v = dist[y * w + x]; if (v > blank && v < 1e9) blank = v;
  }
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
  return { ink: (100 * ink) / N, bad, micro, regions, blankMm: blank / 3 / pxPerMm, ...(mask ? { mask } : {}) };
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

// ===================== Cobertura y contraste (M2, M10) =====================
// Auditoría de composición: la figura debe ocupar un mínimo del marco y tener
// más tinta que el fondo para que se lea bien.

// Umbrales de cobertura mínima por encuadre. «center» exige más porque la
// figura es el protagonista; «offset» y «zoom» permiten menos (se compensa
// con la posición o el recorte).
export const COVERAGE_LIMITS = { center: 0.35, offset: 0.30, zoom: 0.30 };

// Extrae la cobertura y el path de la silueta del SVG (atributos data-coverage
// y data-sil-d del grupo data-figure). Devuelve null si no hay figura.
export function extractFigureMetrics(svg) {
  const mCov = svg.match(/data-figure="[^"]+"\s+data-layout="([^"]+)"[^>]*data-coverage="([^"]+)"/);
  if (!mCov) return null;
  const layout = mCov[1];
  const coverage = parseFloat(mCov[2]) / 100; // estaba en %
  const mSil = svg.match(/data-sil-d="([^"]+)"/);
  const silD = mSil ? mSil[1] : null;
  return { layout, coverage, silD };
}

// Contraste figura/fondo: densidad de tinta dentro vs fuera de la silueta.
// raster: { data, width, height } (RGBA de la página rasterizada).
// silD: path SVG de la silueta en coordenadas mm (data-sil-d).
// wMm, hMm: dimensiones de la página en mm.
// Devuelve { densityInside, densityOutside, contrast, ok, reason }.
export function analyzeContrast(raster, silD, wMm, hMm) {
  if (!silD) return null;
  const { data, width: w, height: h } = raster;
  const N = w * h;
  // Crear máscara de la silueta: 1 = dentro, 0 = fuera.
  // Se rasteriza el path de la silueta en un canvas auxiliar con la misma
  // transformación que la página (mm → px).
  const mask = _rasterizeSilhouetteMask(silD, w, h, wMm, hMm);
  if (!mask) return null;
  let inkIn = 0, areaIn = 0, inkOut = 0, areaOut = 0;
  for (let i = 0; i < N; i++) {
    const isInk = data[i * 4] <= 128; // R <= 128 → tinta
    if (mask[i]) { areaIn++; if (isInk) inkIn++; }
    else { areaOut++; if (isInk) inkOut++; }
  }
  const densityInside = areaIn > 0 ? inkIn / areaIn : 0;
  const densityOutside = areaOut > 0 ? inkOut / areaOut : 0;
  const contrast = densityInside - densityOutside;
  return {
    densityInside: Math.round(densityInside * 1000) / 1000,
    densityOutside: Math.round(densityOutside * 1000) / 1000,
    contrast: Math.round(contrast * 1000) / 1000,
    ok: contrast >= 0,
    reason: contrast < 0 ? `Contraste negativo: fondo más denso (${Math.round(densityOutside * 100)}%) que figura (${Math.round(densityInside * 100)}%)` : null,
  };
}

// Rasteriza el path de la silueta a una máscara binaria (Uint8Array).
// Usa Path2D (disponible en navegadores modernos) para convertir el path SVG
// a píxeles. Devuelve null si no se puede crear el canvas.
function _rasterizeSilhouetteMask(silD, wPx, hPx, wMm, hMm) {
  // Esta función se ejecuta en el navegador (measurePage usa canvas).
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = wPx;
  canvas.height = hPx;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // Fondo negro (fuera de la silueta = 0).
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, wPx, hPx);
  // Escalar de mm a px y dibujar la silueta en blanco (dentro = 1).
  const sx = wPx / wMm;
  const sy = hPx / hMm;
  ctx.setTransform(sx, 0, 0, sy, 0, 0);
  ctx.fillStyle = "#fff";
  try {
    const path = new Path2D(silD);
    ctx.fill(path);
  } catch {
    canvas.width = 0; canvas.height = 0;
    return null;
  }
  const imgData = ctx.getImageData(0, 0, wPx, hPx);
  canvas.width = 0; canvas.height = 0;
  // Canal rojo > 128 → dentro de la silueta.
  const mask = new Uint8Array(wPx * hPx);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = imgData.data[i * 4] > 128 ? 1 : 0;
  }
  return mask;
}

// Veredicto de cobertura: la figura debe cubrir al menos el umbral del marco.
// coverage: fracción (0–1), layout: "center"|"offset"|"zoom".
export function coverageVerdict(coverage, layout) {
  if (coverage == null || isNaN(coverage)) return { ok: true, reason: null };
  const threshold = COVERAGE_LIMITS[layout] ?? COVERAGE_LIMITS.offset;
  if (coverage >= threshold) return { ok: true, reason: null };
  const pct = Math.round(coverage * 100);
  const thrPct = Math.round(threshold * 100);
  return { ok: false, reason: `Cobertura baja: ${pct}% del marco (mínimo ${thrPct}% para «${layout}»)` };
}

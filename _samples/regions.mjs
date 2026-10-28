// Regiones blancas de un raster RGBA (resvg): cuántas no se pueden colorear.
//   micro  < 0.5 mm²  (se leen como manchas de tinta)
//   bad    0.5–3 mm² o con un grosor máximo < 1.2 mm (no cabe la punta de un marcador)
// Misma métrica que colorability.mjs; aquí se separa para medir un patrón suelto.
export function whiteRegions(pixels, w, h, pxPerMm) {
  const N = w * h;
  const white = new Uint8Array(N);
  let ink = 0;
  for (let i = 0; i < N; i++) { if (pixels[i * 4] > 128) white[i] = 1; else ink++; }
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
  let bad = 0, micro = 0, regions = 0;
  for (let i = 0; i < N; i++) {
    if (!white[i] || seen[i]) continue;
    let sp = 0, a = 0, md = 0;
    st[sp++] = i; seen[i] = 1;
    while (sp) {
      const k = st[--sp]; a++; if (dist[k] > md) md = dist[k];
      const x = k % w;
      if (x > 0 && white[k - 1] && !seen[k - 1]) { seen[k - 1] = 1; st[sp++] = k - 1; }
      if (x < w - 1 && white[k + 1] && !seen[k + 1]) { seen[k + 1] = 1; st[sp++] = k + 1; }
      if (k >= w && white[k - w] && !seen[k - w]) { seen[k - w] = 1; st[sp++] = k - w; }
      if (k < N - w && white[k + w] && !seen[k + w]) { seen[k + w] = 1; st[sp++] = k + w; }
    }
    const mm2 = a / (pxPerMm * pxPerMm), thick = md / 3 / pxPerMm;
    regions++;
    if (mm2 < 0.5) micro++; else if (mm2 < 3 || thick < 0.6) bad++;
  }
  return { ink: (100 * ink) / N, bad, micro, regions };
}

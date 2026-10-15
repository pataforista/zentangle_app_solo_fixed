// deadSpace.js
// Relleno de huecos muertos: tras generar la página, se rasteriza el área de
// arte, se buscan las zonas blancas amplias y se llenan con burbujas (círculos
// y anillos) que nunca tocan una línea. Así la página queda completa sin
// alterar el diseño: las burbujas solo ocupan espacio que estaba vacío.
//
// Qué se rellena y qué no:
//   - Solo regiones blancas que tocan una línea GRUESA (borde de celda,
//     string, marco) o el borde del área: el fondo de una unidad, los huecos
//     entre contenedores, las esquinas que un teselado no alcanza.
//   - Los interiores de iconos y motivos (cara del gato, cuerpo del pez) están
//     cerrados por líneas finas y quedan intactos.
//   - Las canaletas entre teselas (5 mm) no admiten la burbuja mínima con su
//     hueco a cada lado, así que siguen limpias.
//
// La rasterización la aporta quien llama (canvas en el navegador, resvg en
// Node): rasterize(svgString, wPx, hPx) => Promise<{ data, width, height }>
// con data en RGBA (el tamaño real puede diferir en 1 px por redondeo). Sin
// rasterizador no se hace nada.
import { createRNG, hash } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";

const fmt = (n) => (Math.round(Number(n) * 1000) / 1000).toString();

// Transformada de distancia euclídea exacta (Felzenszwalb & Huttenlocher),
// en píxeles: 0 en la tinta, distancia al píxel de tinta más cercano fuera.
function edt(ink, w, h) {
  const INF = 1e20;
  const f = new Float64Array(Math.max(w, h));
  const d = new Float64Array(Math.max(w, h));
  const v = new Int32Array(Math.max(w, h));
  const z = new Float64Array(Math.max(w, h) + 1);
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = ink[i] ? 0 : INF;
  const pass = (n) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
  };
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    pass(h);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    pass(w);
    for (let x = 0; x < w; x++) grid[y * w + x] = Math.sqrt(d[x]);
  }
  return grid;
}

// SVG del área de arte. frameOnly: solo los trazos gruesos (marcos/strings).
function areaSvg(doc, a, frameOnly, thr) {
  let body = doc.body.join("\n");
  if (frameOnly) {
    body = body.replace(/<(path|rect|circle|ellipse|polygon|polyline)\b[^>]*?\/>/gs, (el) => {
      const m = el.match(/stroke-width="([0-9.]+)"/);
      const stroked = !/stroke="none"/.test(el);
      return m && stroked && +m[1] >= thr ? el.replace(/fill="[^"]*"/, 'fill="none"') : "";
    });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(a.x)} ${fmt(a.y)} ${fmt(a.w)} ${fmt(a.h)}" width="${fmt(a.w)}mm" height="${fmt(a.h)}mm"><defs>${(doc.defs || []).join("\n")}</defs><rect x="${fmt(a.x - 1)}" y="${fmt(a.y - 1)}" width="${fmt(a.w + 2)}" height="${fmt(a.h + 2)}" fill="#fff"/>${body}</svg>`;
}

/**
 * Rellena los huecos muertos de una página ya generada.
 * @returns {Promise<{ bubbles: number }>}
 */
export async function fillDeadSpace(doc, {
  areaMm, seed = 1, rasterize,
  pxPerMm = 3,
  gapMm = 1.8,         // hueco mínimo entre burbuja y cualquier línea
  rMaxMm = 9,
  rMinMm = 2.4,
  strokeMm = 0.45,
} = {}) {
  if (typeof rasterize !== "function" || !areaMm || !doc?.body?.length) return { bubbles: 0 };
  const a = areaMm;

  // Umbral de "línea gruesa": los marcos y strings van al menos ~1.3x más
  // gruesos que los trazos internos en todos los estilos.
  const widths = [...doc.body.join("").matchAll(/stroke-width="([0-9.]+)"/g)].map((m) => +m[1]);
  if (!widths.length) return { bubbles: 0 };
  const thr = Math.max(...widths) * 0.78;

  const wReq = Math.max(8, Math.round(a.w * pxPerMm)), hReq = Math.max(8, Math.round(a.h * pxPerMm));
  const [full, frame] = await Promise.all([
    rasterize(areaSvg(doc, a, false, thr), wReq, hReq),
    rasterize(areaSvg(doc, a, true, thr), wReq, hReq),
  ]);
  if (!full?.data || !frame?.data || full.width !== frame.width || full.height !== frame.height) return { bubbles: 0 };
  const w = full.width, h = full.height, N = w * h;
  pxPerMm = w / a.w;
  const ink = new Uint8Array(N), fr = new Uint8Array(N);
  for (let i = 0; i < N; i++) { ink[i] = full.data[i * 4] < 160 ? 1 : 0; fr[i] = frame.data[i * 4] < 160 ? 1 : 0; }

  // Regiones blancas (4-conexas). Una región es "fondo" si toca el borde del
  // área o un trazo grueso (a 2 px o menos). Además se mide qué parte de su
  // contorno es marco: el hueco entre círculos o una celda vacía están
  // rodeados casi solo de marco (se llenan del todo); el fondo de una unidad
  // con motivos está rodeado sobre todo de motivos (solo se rellenan sus
  // vacíos grandes, con más aire, para no romper el ritmo del patrón).
  const label = new Int32Array(N).fill(-1);
  const eligible = [];
  const frameRatio = [];
  const stack = new Int32Array(N);
  const nearFrame = (k) => {
    const x = k % w, y = (k - x) / w;
    if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) return true;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (fr[k + dy * w + dx]) return true;
    return false;
  };
  for (let s = 0; s < N; s++) {
    if (ink[s] || label[s] >= 0) continue;
    const id = eligible.length;
    let sp = 0, edge = 0, edgeFrame = 0;
    stack[sp++] = s; label[s] = id;
    while (sp) {
      const k = stack[--sp];
      const x = k % w;
      const isEdge = x === 0 || x === w - 1 || k < w || k >= N - w || ink[k - 1] || ink[k + 1] || ink[k - w] || ink[k + w];
      if (isEdge) { edge++; if (nearFrame(k)) edgeFrame++; }
      if (x > 0 && !ink[k - 1] && label[k - 1] < 0) { label[k - 1] = id; stack[sp++] = k - 1; }
      if (x < w - 1 && !ink[k + 1] && label[k + 1] < 0) { label[k + 1] = id; stack[sp++] = k + 1; }
      if (k >= w && !ink[k - w] && label[k - w] < 0) { label[k - w] = id; stack[sp++] = k - w; }
      if (k < N - w && !ink[k + w] && label[k + w] < 0) { label[k + w] = id; stack[sp++] = k + w; }
    }
    eligible.push(edgeFrame > 0);
    frameRatio.push(edge ? edgeFrame / edge : 0);
  }
  // Hueco extra exigido según el contorno: 0 si es casi todo marco, hasta
  // +3.2 mm (y burbuja de 4 mm o más) si es casi todo motivo.
  const extraOf = (id) => (frameRatio[id] >= 0.55 ? 0 : 3.2 * (1 - frameRatio[id] / 0.55));

  // Distancia (mm) a la tinta o al borde del área.
  const D = edt(ink, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x;
    D[k] = Math.min(D[k], x + 0.5, y + 0.5, w - x - 0.5, h - y - 0.5) / pxPerMm;
  }

  const rng = createRNG(hash(seed >>> 0, 0xdead));
  for (let i = 0; i < 8; i++) rng();
  const bubbles = [];
  const sep = gapMm * 0.9; // hueco entre burbujas
  for (let r = rMaxMm; r >= rMinMm - 1e-6; r *= 0.84) {
    const need = r + gapMm;
    const step = Math.max(1, Math.round(r * 0.45 * pxPerMm));
    const cand = [];
    for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
      const k = y * w + x;
      if (ink[k] || !eligible[label[k]]) continue;
      const extra = extraOf(label[k]);
      if (extra > 0 && r < 4) continue;
      if (D[k] >= need + extra) cand.push(k);
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    for (const k0 of cand) {
      // Se sube por el gradiente de distancia unos pasos: centra la burbuja en
      // su hueco en vez de dejarla pegada a un lado.
      let k = k0;
      for (let it = 0; it < 6; it++) {
        const x = k % w, y = (k - x) / w;
        let best = k;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
          const nx = x + dx * step, ny = y + dy * step;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const nk = ny * w + nx;
          if (label[nk] === label[k0] && D[nk] > D[best]) best = nk;
        }
        if (best === k) break;
        k = best;
      }
      if (D[k] < need + extraOf(label[k0])) continue;
      const x = k % w, y = (k - x) / w;
      const cx = (x + 0.5) / pxPerMm, cy = (y + 0.5) / pxPerMm;
      bubbles.push({ x: a.x + cx, y: a.y + cy, r });
      // La burbuja pasa a ser tinta (disco sólido) para las siguientes.
      const reach = Math.ceil((r + rMaxMm + gapMm + sep) * pxPerMm);
      const x0 = Math.max(0, x - reach), x1 = Math.min(w - 1, x + reach);
      const y0 = Math.max(0, y - reach), y1 = Math.min(h - 1, y + reach);
      for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
        const q = yy * w + xx;
        const dd = Math.hypot((xx + 0.5) / pxPerMm - cx, (yy + 0.5) / pxPerMm - cy) - r - (sep - gapMm);
        if (dd < D[q]) D[q] = Math.max(0, dd);
      }
    }
  }
  if (!bubbles.length) return { bubbles: 0 };

  const b = new PathBuilder({ sketchy: 0, rng });
  for (const c of bubbles) {
    b.circle(c.x, c.y, c.r);
    // Las grandes llevan un anillo interior (corona >= 2.4 mm, coloreable).
    if (c.r >= 5.5 && rng() < 0.6) b.circle(c.x, c.y, c.r * 0.5);
  }
  doc.body.push(`<path d="${b.d}" fill="none" stroke="#000" stroke-width="${fmt(strokeMm)}" stroke-linecap="round" stroke-linejoin="round" data-filler="bubbles"/>`);
  return { bubbles: bubbles.length };
}

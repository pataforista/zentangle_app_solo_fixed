// Métrica de colorabilidad por preset (libros para colorear).
// Renderiza 3 semillas por preset y mide sobre las regiones blancas:
//   - tinta: % de página en negro
//   - no-coloreables: regiones visibles (>=0.5 mm²) donde no cabe la punta de
//     un marcador (~1.2 mm): área < 3 mm² o grosor máximo < 1.2 mm
//   - manchitas: regiones < 0.5 mm² (se leen como manchas de tinta)
// Uso: npm run colorability [-- preset1,preset2]   (DBG=1 guarda dbg_<preset>.png
// con las regiones problemáticas en rojo)
const ROOT = new URL("..", import.meta.url).href.replace(/\/$/, "");
const { generateZentangleCells } = await import(ROOT + "/js/generators/zentangleCells.js");
const { ZENTANGLE_PRESETS } = await import(ROOT + "/js/generators/zentangle.presets.js");
import { Resvg } from "@resvg/resvg-js";
console.warn = () => {};
const PX = 8, W = 210, H = 297;
function analyze(svg, outPng) {
  const img = new Resvg(svg, { fitTo: { mode: "width", value: W * PX } }).render();
  const w = img.width, h = img.height, px = img.pixels, N = w * h;
  const white = new Uint8Array(N); let ink = 0;
  for (let i = 0; i < N; i++) { if (px[i * 4] > 128) white[i] = 1; else ink++; }
  const dist = new Float32Array(N);
  for (let i = 0; i < N; i++) dist[i] = white[i] ? 1e9 : 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = y*w+x; if (!dist[k]) continue;
    if (x>0) dist[k]=Math.min(dist[k],dist[k-1]+3); if (y>0) dist[k]=Math.min(dist[k],dist[k-w]+3);
    if (x>0&&y>0) dist[k]=Math.min(dist[k],dist[k-w-1]+4); if (x<w-1&&y>0) dist[k]=Math.min(dist[k],dist[k-w+1]+4); }
  for (let y = h-1; y >= 0; y--) for (let x = w-1; x >= 0; x--) { const k = y*w+x; if (!dist[k]) continue;
    if (x<w-1) dist[k]=Math.min(dist[k],dist[k+1]+3); if (y<h-1) dist[k]=Math.min(dist[k],dist[k+w]+3);
    if (x<w-1&&y<h-1) dist[k]=Math.min(dist[k],dist[k+w+1]+4); if (x>0&&y<h-1) dist[k]=Math.min(dist[k],dist[k+w-1]+4); }
  const seen = new Uint8Array(N), st = new Int32Array(N), mark = outPng ? new Uint8Array(N) : null, memb = new Int32Array(N); let bad = 0, micro = 0, regions = 0;
  for (let i = 0; i < N; i++) if (white[i] && !seen[i]) {
    let sp = 0, a = 0, md = 0; st[sp++] = i; seen[i] = 1; let mc = 0;
    while (sp) { const k = st[--sp]; a++; memb[mc++] = k; if (dist[k] > md) md = dist[k]; const x = k % w;
      if (x>0&&white[k-1]&&!seen[k-1]){seen[k-1]=1;st[sp++]=k-1;} if (x<w-1&&white[k+1]&&!seen[k+1]){seen[k+1]=1;st[sp++]=k+1;}
      if (k>=w&&white[k-w]&&!seen[k-w]){seen[k-w]=1;st[sp++]=k-w;} if (k<N-w&&white[k+w]&&!seen[k+w]){seen[k+w]=1;st[sp++]=k+w;} }
    const mm2 = a / (PX*PX), thick = md / 3 / PX; regions++;
    if (mm2 < 0.5) micro++; else if (mm2 < 3 || thick < 0.6) { bad++; if (mark) for (let q = 0; q < mc; q++) mark[memb[q]] = 1; }
  }
  if (mark) { const out = Buffer.alloc(N * 4); for (let i = 0; i < N; i++) { const m = mark[i]; out[i*4] = m ? 255 : px[i*4]; out[i*4+1] = m ? 0 : px[i*4+1]; out[i*4+2] = m ? 0 : px[i*4+2]; out[i*4+3] = 255; }
globalThis.__dbg = { w, h, out }; }
  return { ink: 100 * ink / N, bad, micro, regions };
}
const names = process.argv[2] ? process.argv[2].split(",") : Object.keys(ZENTANGLE_PRESETS);
const tot = { ink: 0, bad: 0, micro: 0, n: 0 };
for (const name of names) {
  const acc = { ink: 0, bad: 0, micro: 0, regions: 0 }; const seeds = [1, 7, 23];
  for (const seed of seeds) {
    const doc = { body: [], defs: [] };
    await generateZentangleCells(doc, { ...ZENTANGLE_PRESETS[name], seed, areaMm: { x: 12, y: 12, w: 186, h: 273 } });
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><defs>${doc.defs.join("")}</defs><rect width="${W}" height="${H}" fill="#fff"/>${doc.body.join("")}</svg>`;
    const m = analyze(svg, process.env.DBG && seed === 1);
    if (process.env.DBG && seed === 1) { const { w, h, out } = globalThis.__dbg; const { writeFileSync } = await import('node:fs'); const zlib = await import('node:zlib'); writeFileSync(`_samples/dbg_${name}.png`, png(w, h, out, zlib)); } for (const k in acc) acc[k] += m[k] / seeds.length;
  }
  tot.ink += acc.ink; tot.bad += acc.bad; tot.micro += acc.micro; tot.n++;
  console.log(`${name.padEnd(22)} tinta ${acc.ink.toFixed(1).padStart(5)}%  no-coloreables ${acc.bad.toFixed(0).padStart(4)}  manchitas ${acc.micro.toFixed(0).padStart(5)}  regiones ${acc.regions.toFixed(0)}`);
}
console.log(`PROMEDIO tinta ${(tot.ink/tot.n).toFixed(1)}%  no-coloreables ${(tot.bad/tot.n).toFixed(1)}  manchitas ${(tot.micro/tot.n).toFixed(1)}`);

function png(w, h, rgba, zlib) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const crc = (buf) => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let x = 0xffffffff; for (const b of buf) x = t[(x ^ b) & 0xff] ^ (x >>> 8); return (x ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

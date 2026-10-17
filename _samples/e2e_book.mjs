// Prueba de punta a punta en el navegador (Chromium): prepara un libro con
// todas las opciones, descarga el PDF y la ficha de KDP y los verifica.
// Uso: npm run e2e   (DESIGNS=40 BLANK=0 npm run e2e para otras variantes)
// Requiere las dependencias de desarrollo playwright y jspdf (npm install).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { readFileSync, mkdtempSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { tmpdir } from "node:os";

const ROOT = new URL("..", import.meta.url).pathname;
let chromium;
try { ({ chromium } = await import("playwright")); } catch {
  console.log("⚠ playwright no está instalado: ejecuta «npm install» para la prueba en navegador.");
  process.exit(0);
}
const JSPDF = join(ROOT, "node_modules/jspdf/dist/jspdf.umd.min.js");

const N = Number(process.env.DESIGNS || 12);
const BLANK = process.env.BLANK === "0" ? "0" : "1";
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json" };

// Servidor estático mínimo (los módulos ES no cargan desde file://).
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  try {
    const body = await readFile(join(ROOT, path === "/" ? "index.html" : path));
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream" });
    res.end(body);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

const fail = (msg) => { console.error(`❌ ${msg}`); process.exitCode = 1; };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // jsPDF desde node_modules (el sandbox o una red lenta no deben tumbar la prueba).
  await page.route("**/jspdf.umd.min.js", (r) => r.fulfill({ contentType: "text/javascript", body: readFileSync(JSPDF) }));
  await page.route("**/d3-delaunay*", (r) => r.fulfill({ contentType: "text/javascript", body: "" }));
  await page.goto(`${base}/index.html`);
  await page.waitForFunction(() => window.jspdf, null, { timeout: 30000 });
  await page.evaluate(({ n, blank }) => {
    const set = (id, v) => { const e = document.getElementById(id); if (e.type === "checkbox") e.checked = v; else e.value = v; e.dispatchEvent(new Event("change", { bubbles: true })); };
    set("bookPages", String(n)); set("bookBlank", blank);
    ["bookProgressive", "bookGuide", "bookSpreads", "bookTurn"].forEach((id) => set(id, true));
  }, { n: N, blank: BLANK });

  await page.click("#btnBook");
  await page.waitForFunction(() => /Descargar libro/.test(document.getElementById("btnBook").textContent), null, { timeout: 600000 });
  const expected = Number((await page.textContent("#btnBook")).match(/(\d+) págs/)[1]);
  const tiles = await page.$$eval(".book-tile .gallery-label", (els) => els.map((e) => e.textContent));
  if (tiles.filter((t) => /^Guía/.test(t)).length < 3) fail("la revisión no muestra la guía.");
  if (!tiles.some((t) => /Pasaporte/.test(t)) || !tiles.some((t) => /Tu turno/.test(t))) fail("faltan pasaporte o «Tu turno» en la revisión.");
  if (!tiles.some((t) => /doble página/.test(t))) fail("falta la doble página en la revisión.");

  const dir = mkdtempSync(join(tmpdir(), "e2e-book-"));
  const pdfDl = page.waitForEvent("download", { timeout: 1800000 });
  await page.click("#btnBook");
  const pdfPath = join(dir, "libro.pdf");
  await (await pdfDl).saveAs(pdfPath);
  const pdf = readFileSync(pdfPath, "latin1");
  const pages = (pdf.match(/\/Type \/Page\b(?!s)/g) || []).length;
  if (pages !== expected) fail(`el PDF tiene ${pages} páginas y el botón anunciaba ${expected}.`);

  const txtDl = page.waitForEvent("download");
  await page.click("#btnKdpListing");
  const txtPath = join(dir, "ficha.txt");
  await (await txtDl).saveAs(txtPath);
  const txt = readFileSync(txtPath, "utf8");
  const title = txt.split("DESCRIPCIÓN:")[0];
  if (/zentangle|zendoodle|zendala/i.test(title)) fail("la ficha de KDP usa una marca en título o subtítulo.");
  if (!/Zentangle® es una marca registrada/.test(txt)) fail("la ficha de KDP no lleva la atribución.");

  if (errors.length) fail(`errores en la página: ${errors.join(" | ")}`);
  if (!process.exitCode) console.log(`✓ Libro de ${N} diseños (${BLANK === "1" ? "con" : "sin"} hojas en blanco): ${pages} páginas en el PDF, revisión completa y ficha KDP correcta.`);
} finally {
  await browser.close();
  server.close();
}

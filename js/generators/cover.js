// cover.js
// Generador de portada PDF para KDP. Incluye portada, lomo y contraportada
// en un solo PDF con las dimensiones exactas que pide KDP.
import { coverSpec, BLOCKED_TERMS, containsBlocked } from "../core/kdpListing.js";
import { textWidthMm, wrapText, fits } from "./frontMatter.js";

const fmt = (n) => (Math.round(Number(n) * 100) / 100).toString();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = `font-family="Helvetica, Arial, sans-serif"`;

// Limpia el texto de términos bloqueados (marcas registradas ajenas).
function cleanText(text) {
  if (!text) return "";
  let cleaned = text;
  BLOCKED_TERMS.forEach((term) => {
    const regex = new RegExp(`\\b${term}\\b`, "gi");
    cleaned = cleaned.replace(regex, "");
  });
  return cleaned.trim();
}

// Genera el SVG de la portada completa (contraportada + lomo + portada).
// Devuelve un SVG con las dimensiones exactas de coverSpec.
export function generateCoverSvg({ pages, trimWmm, trimHmm, paper = "white", title = "Libro para colorear", author = "", series = "" }) {
  const spec = coverSpec({ pages, trimWmm, trimHmm, paper });
  const { widthMm, heightMm, spineMm } = spec;
  
  // Limpiar texto de términos bloqueados
  const cleanTitle = cleanText(title);
  const cleanAuthor = cleanText(author);
  const cleanSeries = cleanText(series);
  
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}">`];
  
  // Fondo blanco
  out.push(`<rect width="${widthMm}" height="${heightMm}" fill="#fff"/>`);
  
  // Dimensiones de cada sección
  const bleed = 3.175; // 0.125" = 3.175mm
  const backWidth = trimWmm;
  const frontWidth = trimWmm;
  
  // Posiciones X de cada sección. El PDF lleva el sangrado a los lados
  // (coverSpec lo suma al ancho): sin él el lomo quedaba 3.2 mm a la izquierda
  // del lomo real y su texto se salía en libros finos.
  const backStart = bleed;
  const spineStart = bleed + backWidth;
  const frontStart = bleed + backWidth + spineMm;

  // === CONTRAPORTADA (izquierda) ===
  const backCenterX = backStart + backWidth / 2;
  
  // Texto de descripción (placeholder)
  const descY = 30;
  out.push(`<text x="${fmt(backCenterX)}" y="${fmt(descY)}" ${FONT} font-size="4" text-anchor="middle" font-weight="bold">${esc(cleanTitle || "Libro para colorear")}</text>`);
  
  if (cleanAuthor) {
    out.push(`<text x="${fmt(backCenterX)}" y="${fmt(descY + 8)}" ${FONT} font-size="3.5" text-anchor="middle">por ${esc(cleanAuthor)}</text>`);
  }
  
  // Descripción placeholder
  const descLines = [
    "Diseños originales para colorear,",
    "llenos de patrones de líneas,",
    "curvas y círculos.",
    "",
    "Ideal para relajarse y",
    "concentrarse.",
  ];
  descLines.forEach((line, i) => {
    out.push(`<text x="${fmt(backCenterX)}" y="${fmt(descY + 20 + i * 5)}" ${FONT} font-size="3" text-anchor="middle">${esc(line)}</text>`);
  });
  
  // Zona de código de barras (abajo a la derecha de la contraportada)
  // KDP requiere que esta zona esté libre: 2 × 1.2 in, a 0.25 in del lomo y
  // del corte inferior (ahí imprime su código, que tapa el recuadro entero).
  const barcodeWidth = 50.8;
  const barcodeHeight = 30.5;
  const barcodeX = spineStart - 6.35 - barcodeWidth;
  const barcodeY = heightMm - bleed - 6.35 - barcodeHeight;
  out.push(`<rect x="${fmt(barcodeX)}" y="${fmt(barcodeY)}" width="${fmt(barcodeWidth)}" height="${fmt(barcodeHeight)}" fill="none" stroke="#ccc" stroke-width="0.2" stroke-dasharray="1 1"/>`);
  out.push(`<text x="${fmt(barcodeX + barcodeWidth / 2)}" y="${fmt(barcodeY + barcodeHeight / 2)}" ${FONT} font-size="2.5" text-anchor="middle" fill="#999">Código de barras</text>`);
  
  // === LOMO (centro) ===
  const spineCenterX = spineStart + spineMm / 2;
  
  // Texto en el lomo solo si hay más de 79 páginas
  if (spec.spineText && cleanTitle) {
    // Rotar texto 90 grados para que se lea de arriba a abajo
    const spineTextY = heightMm / 2;
    const fontSize = Math.min(6, spineMm * 0.7, (heightMm - 40) / Math.max(1, textWidthMm(cleanTitle, 1)));
    out.push(`<text x="${fmt(spineCenterX)}" y="${fmt(spineTextY)}" ${FONT} font-size="${fmt(fontSize)}" text-anchor="middle" transform="rotate(-90 ${fmt(spineCenterX)} ${fmt(spineTextY)})">${esc(cleanTitle)}</text>`);
  }
  
  // === PORTADA (derecha) ===
  const frontCenterX = frontStart + frontWidth / 2;
  
  // Título principal: la parte antes de «:» en hasta 3 líneas grandes y el
  // resto como subtítulo (como en la portadilla). Antes iba en una sola línea
  // y un título largo quedaba diminuto. 15 mm libres por lado.
  const availW = frontWidth - 30;
  const [main, ...rest] = String(cleanTitle || "Libro para colorear").split(/:\s+/);
  const subtitle = rest.join(": ");
  let size = 14, lines = wrapText(main, availW, size);
  while ((lines.length > 3 || !fits(lines, availW, size)) && size > 6) { size -= 0.5; lines = wrapText(main, availW, size); }
  let subSize = Math.min(7, size * 0.55);
  let subLines = subtitle ? wrapText(subtitle, availW, subSize) : [];
  while ((subLines.length > 3 || !fits(subLines, availW, subSize)) && subSize > 3.5) { subSize -= 0.25; subLines = wrapText(subtitle, availW, subSize); }
  let ty = heightMm / 3 - ((lines.length - 1) * size * 1.2) / 2;
  lines.forEach((line) => {
    out.push(`<text x="${fmt(frontCenterX)}" y="${fmt(ty)}" ${FONT} font-size="${fmt(size)}" text-anchor="middle" font-weight="bold">${esc(line)}</text>`);
    ty += size * 1.2;
  });
  ty += subSize * 0.6;
  subLines.forEach((line) => {
    out.push(`<text x="${fmt(frontCenterX)}" y="${fmt(ty)}" ${FONT} font-size="${fmt(subSize)}" text-anchor="middle">${esc(line)}</text>`);
    ty += subSize * 1.35;
  });
  
  // Autor
  if (cleanAuthor) {
    out.push(`<text x="${fmt(frontCenterX)}" y="${fmt(ty + 10)}" ${FONT} font-size="5" text-anchor="middle">${esc(cleanAuthor)}</text>`);
  }
  
  // Serie (si aplica)
  if (cleanSeries) {
    out.push(`<text x="${fmt(frontCenterX)}" y="${fmt(heightMm - 30)}" ${FONT} font-size="3.5" text-anchor="middle" font-style="italic">${esc(cleanSeries)}</text>`);
  }
  
  // Marco decorativo sutil
  const margin = 10;
  out.push(`<rect x="${fmt(frontStart + margin)}" y="${fmt(margin)}" width="${fmt(frontWidth - 2 * margin)}" height="${fmt(heightMm - 2 * margin)}" fill="none" stroke="#000" stroke-width="0.3"/>`);
  
  out.push("</svg>");
  return out.join("");
}

// Genera y descarga el PDF de la portada.
export async function downloadCoverPdf({ pages, trimWmm, trimHmm, paper = "white", title = "Libro para colorear", author = "", series = "" }) {
  if (typeof window === "undefined" || !window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("La librería jsPDF no está cargada. Verifica que js/vendor/jspdf.umd.min.js existe.");
  }
  const { jsPDF } = window.jspdf;
  
  const spec = coverSpec({ pages, trimWmm, trimHmm, paper });
  const { widthMm, heightMm } = spec;
  
  const svgString = generateCoverSvg({ pages, trimWmm, trimHmm, paper, title, author, series });
  
  // Renderizar SVG a PNG
  const pixelRatio = 300 / 25.4;
  const width = widthMm * pixelRatio;
  const height = heightMm * pixelRatio;
  
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  
  const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  
  await new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
  
  const dataUrl = canvas.toDataURL("image/png");
  canvas.width = 0;
  canvas.height = 0;
  
  // Crear PDF
  // putOnlyUsedFonts: sin él jsPDF declara 14 fuentes sin incrustar y KDP
  // puede rechazar la portada (la página es una imagen, no usa ninguna).
  const doc = new jsPDF({ orientation: widthMm > heightMm ? "l" : "p", unit: "mm", format: [widthMm, heightMm], putOnlyUsedFonts: true });
  doc.addImage(dataUrl, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST");
  
  const filename = `portada_${pages}pag_${trimWmm}x${trimHmm}mm.pdf`;
  doc.save(filename);
  
  return { spec, filename };
}

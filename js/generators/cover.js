// cover.js
// Generador de portada PDF para KDP. Incluye portada, lomo y contraportada
// en un solo PDF con las dimensiones exactas que pide KDP.
import { coverSpec, BLOCKED_TERMS, containsBlocked } from "../core/kdpListing.js";

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
  
  // Posiciones X de cada sección
  const backStart = 0;
  const spineStart = backWidth;
  const frontStart = backWidth + spineMm;
  
  // === CONTRAPORTADA (izquierda) ===
  const backCenterX = backWidth / 2;
  
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
  // KDP requiere que esta zona esté libre
  const barcodeWidth = 50;
  const barcodeHeight = 25;
  const barcodeX = backWidth - barcodeWidth - 10;
  const barcodeY = heightMm - barcodeHeight - 15;
  out.push(`<rect x="${fmt(barcodeX)}" y="${fmt(barcodeY)}" width="${fmt(barcodeWidth)}" height="${fmt(barcodeHeight)}" fill="none" stroke="#ccc" stroke-width="0.2" stroke-dasharray="1 1"/>`);
  out.push(`<text x="${fmt(barcodeX + barcodeWidth / 2)}" y="${fmt(barcodeY + barcodeHeight / 2)}" ${FONT} font-size="2.5" text-anchor="middle" fill="#999">Código de barras</text>`);
  
  // === LOMO (centro) ===
  const spineCenterX = spineStart + spineMm / 2;
  
  // Texto en el lomo solo si hay más de 79 páginas
  if (spec.spineText && cleanTitle) {
    // Rotar texto 90 grados para que se lea de arriba a abajo
    const spineTextY = heightMm / 2;
    const fontSize = Math.min(6, spineMm * 0.7);
    out.push(`<text x="${fmt(spineCenterX)}" y="${fmt(spineTextY)}" ${FONT} font-size="${fmt(fontSize)}" text-anchor="middle" transform="rotate(-90 ${fmt(spineCenterX)} ${fmt(spineTextY)})">${esc(cleanTitle)}</text>`);
  }
  
  // === PORTADA (derecha) ===
  const frontCenterX = frontStart + frontWidth / 2;
  
  // Título principal
  const titleY = heightMm / 3;
  const titleFontSize = Math.min(12, frontWidth / (cleanTitle.length * 0.4));
  out.push(`<text x="${fmt(frontCenterX)}" y="${fmt(titleY)}" ${FONT} font-size="${fmt(titleFontSize)}" text-anchor="middle" font-weight="bold">${esc(cleanTitle || "Libro para colorear")}</text>`);
  
  // Autor
  if (cleanAuthor) {
    out.push(`<text x="${fmt(frontCenterX)}" y="${fmt(titleY + 15)}" ${FONT} font-size="5" text-anchor="middle">${esc(cleanAuthor)}</text>`);
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
  const doc = new jsPDF(widthMm > heightMm ? "l" : "p", "mm", [widthMm, heightMm]);
  doc.addImage(dataUrl, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST");
  
  const filename = `portada_${pages}pag_${trimWmm}x${trimHmm}mm.pdf`;
  doc.save(filename);
  
  return { spec, filename };
}

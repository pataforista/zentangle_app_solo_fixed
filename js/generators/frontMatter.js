// frontMatter.js
// Páginas preliminares del libro: portada, copyright, "este libro pertenece a"
// y página de prueba de color. Todas devuelven SVG en texto, en mm.
import { scaleStrokeForProfile } from "../core/thicknessProfiles.js";

const fmt = (n) => (Math.round(Number(n) * 100) / 100).toString();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = `font-family="Helvetica, Arial, sans-serif"`;

const pageOpen = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>`;

// Página de título: título del libro centrado, autor opcional debajo.
// Diseño limpio y profesional, con buen uso del espacio vertical.
export function titlePage({ w, h, m }, { title = "Libro para colorear", author = "", lineThicknessProfile = "standard" } = {}) {
  const out = [pageOpen(w, h)];
  const sw = scaleStrokeForProfile(0.5, lineThicknessProfile);
  
  // Marco decorativo sutil (doble línea)
  const margin = Math.max(m, 15);
  out.push(`<rect x="${fmt(margin)}" y="${fmt(margin)}" width="${fmt(w - 2 * margin)}" height="${fmt(h - 2 * margin)}" fill="none" stroke="#000" stroke-width="${sw}"/>`);
  out.push(`<rect x="${fmt(margin + 2)}" y="${fmt(margin + 2)}" width="${fmt(w - 2 * margin - 4)}" height="${fmt(h - 2 * margin - 4)}" fill="none" stroke="#000" stroke-width="${scaleStrokeForProfile(0.25, lineThicknessProfile)}"/>`);
  
  // Título centrado vertical y horizontalmente
  const centerY = h / 2;
  const titleY = author ? centerY - 8 : centerY;
  
  // Dividir título en líneas si es muy largo
  const maxCharsPerLine = Math.floor((w - 2 * margin) / 3.5);
  const titleLines = wrapText(title, maxCharsPerLine);
  const lineHeight = 12;
  const startY = titleY - ((titleLines.length - 1) * lineHeight) / 2;
  
  titleLines.forEach((line, i) => {
    out.push(`<text x="${fmt(w / 2)}" y="${fmt(startY + i * lineHeight)}" ${FONT} font-size="10" font-weight="bold" text-anchor="middle">${esc(line)}</text>`);
  });
  
  // Autor debajo del título
  if (author) {
    out.push(`<text x="${fmt(w / 2)}" y="${fmt(titleY + 15)}" ${FONT} font-size="5" text-anchor="middle">${esc(author)}</text>`);
  }
  
  out.push("</svg>");
  return out.join("");
}

// Página de copyright: año, derechos reservados, atribución Zentangle.
// Se coloca en el verso (página izquierda) después de la portada.
export function copyrightPage({ w, h, m }, { title = "Libro para colorear", author = "", lineThicknessProfile = "standard" } = {}) {
  const out = [pageOpen(w, h)];
  const year = new Date().getFullYear();
  
  // Texto en la parte inferior de la página, centrado
  const bottomY = h - m - 30;
  const lineHeight = 4.5;
  let y = bottomY;
  
  // Título y autor
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(y)}" ${FONT} font-size="4" text-anchor="middle">${esc(title)}</text>`);
  y += lineHeight;
  
  if (author) {
    out.push(`<text x="${fmt(w / 2)}" y="${fmt(y)}" ${FONT} font-size="3.5" text-anchor="middle">${esc(`© ${year} ${author}`)}</text>`);
    y += lineHeight;
  } else {
    out.push(`<text x="${fmt(w / 2)}" y="${fmt(y)}" ${FONT} font-size="3.5" text-anchor="middle">${esc(`© ${year}`)}</text>`);
    y += lineHeight;
  }
  
  // Derechos reservados
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(y)}" ${FONT} font-size="3" text-anchor="middle">Todos los derechos reservados.</text>`);
  y += lineHeight;
  
  // Atribución Zentangle (obligatoria por uso del método)
  y += 3;
  const attribution = "Inspirado en el método Zentangle® de dibujo de patrones.";
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(y)}" ${FONT} font-size="2.8" text-anchor="middle" font-style="italic">${esc(attribution)}</text>`);
  y += lineHeight;
  
  const attribution2 = "Zentangle® es una marca registrada de Zentangle, Inc.";
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(y)}" ${FONT} font-size="2.8" text-anchor="middle" font-style="italic">${esc(attribution2)}</text>`);
  y += lineHeight;
  
  const attribution3 = "Este libro no es un producto oficial ni está afiliado a la empresa.";
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(y)}" ${FONT} font-size="2.8" text-anchor="middle" font-style="italic">${esc(attribution3)}</text>`);
  
  out.push("</svg>");
  return out.join("");
}

// Página "Este libro pertenece a": campo para que el propietario escriba su nombre.
// Diseño amigable con líneas para escribir.
export function belongsToPage({ w, h, m }, { lineThicknessProfile = "standard" } = {}) {
  const out = [pageOpen(w, h)];
  const sw = scaleStrokeForProfile(0.6, lineThicknessProfile);
  
  // Título centrado en el tercio superior
  const titleY = h / 3;
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(titleY)}" ${FONT} font-size="7" font-weight="bold" text-anchor="middle">Este libro pertenece a</text>`);
  
  // Línea para escribir el nombre (decorada con pequeños círculos en los extremos)
  const lineY = titleY + 20;
  const lineX1 = m + 20;
  const lineX2 = w - m - 20;
  const dotR = 1.5;
  
  out.push(`<circle cx="${fmt(lineX1)}" cy="${fmt(lineY)}" r="${dotR}" fill="#000"/>`);
  out.push(`<line x1="${fmt(lineX1)}" y1="${fmt(lineY)}" x2="${fmt(lineX2)}" y2="${fmt(lineY)}" stroke="#000" stroke-width="${sw}" stroke-linecap="round"/>`);
  out.push(`<circle cx="${fmt(lineX2)}" cy="${fmt(lineY)}" r="${dotR}" fill="#000"/>`);
  
  // Decoración sutil: pequeños patrones en las esquinas (opcional, muy sutil)
  const cornerSize = 8;
  const cornerOffset = m + 5;
  const cornerSw = scaleStrokeForProfile(0.3, lineThicknessProfile);
  
  // Esquina superior izquierda
  out.push(`<path d="M ${cornerOffset} ${cornerOffset + cornerSize} L ${cornerOffset} ${cornerOffset} L ${cornerOffset + cornerSize} ${cornerOffset}" fill="none" stroke="#000" stroke-width="${cornerSw}" stroke-linecap="round"/>`);
  // Esquina superior derecha
  out.push(`<path d="M ${w - cornerOffset - cornerSize} ${cornerOffset} L ${w - cornerOffset} ${cornerOffset} L ${w - cornerOffset} ${cornerOffset + cornerSize}" fill="none" stroke="#000" stroke-width="${cornerSw}" stroke-linecap="round"/>`);
  // Esquina inferior izquierda
  out.push(`<path d="M ${cornerOffset} ${h - cornerOffset - cornerSize} L ${cornerOffset} ${h - cornerOffset} L ${cornerOffset + cornerSize} ${h - cornerOffset}" fill="none" stroke="#000" stroke-width="${cornerSw}" stroke-linecap="round"/>`);
  // Esquina inferior derecha
  out.push(`<path d="M ${w - cornerOffset - cornerSize} ${h - cornerOffset} L ${w - cornerOffset} ${h - cornerOffset} L ${w - cornerOffset} ${h - cornerOffset - cornerSize}" fill="none" stroke="#000" stroke-width="${cornerSw}" stroke-linecap="round"/>`);
  
  out.push("</svg>");
  return out.join("");
}

// Página de prueba de color: pequeño diseño para verificar calidad de impresión
// antes de empezar el libro. Incluye líneas de diferentes grosores y formas simples.
export function colorTestPage({ w, h, m }, { lineThicknessProfile = "standard" } = {}) {
  const out = [pageOpen(w, h)];
  
  // Título
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(m + 10)}" ${FONT} font-size="6" font-weight="bold" text-anchor="middle">Página de prueba</text>`);
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(m + 17)}" ${FONT} font-size="3.5" text-anchor="middle">Verifica la calidad de impresión antes de continuar</text>`);
  
  const testAreaTop = m + 25;
  const testAreaHeight = h - testAreaTop - m;
  const testAreaWidth = w - 2 * m;
  
  // Sección 1: Líneas de diferentes grosores
  const section1Y = testAreaTop;
  out.push(`<text x="${fmt(m)}" y="${fmt(section1Y + 5)}" ${FONT} font-size="3.5" font-weight="bold">Líneas de grosor variable:</text>`);
  
  const lineStartX = m + 5;
  const lineEndX = m + testAreaWidth / 2 - 5;
  const lineSpacing = 8;
  let y = section1Y + 12;
  
  // Líneas de fino a grueso
  [0.2, 0.4, 0.6, 0.8, 1.0].forEach((thickness, i) => {
    const sw = scaleStrokeForProfile(thickness, lineThicknessProfile);
    out.push(`<line x1="${fmt(lineStartX)}" y1="${fmt(y)}" x2="${fmt(lineEndX)}" y2="${fmt(y)}" stroke="#000" stroke-width="${sw}" stroke-linecap="round"/>`);
    out.push(`<text x="${fmt(lineEndX + 3)}" y="${fmt(y + 1)}" ${FONT} font-size="2.5">${thickness} mm</text>`);
    y += lineSpacing;
  });
  
  // Sección 2: Formas simples para probar curvas y esquinas
  const section2X = m + testAreaWidth / 2 + 5;
  const section2Y = testAreaTop;
  out.push(`<text x="${fmt(section2X)}" y="${fmt(section2Y + 5)}" ${FONT} font-size="3.5" font-weight="bold">Formas de prueba:</text>`);
  
  const shapeSw = scaleStrokeForProfile(0.5, lineThicknessProfile);
  const shapeSize = 15;
  const shapeY = section2Y + 12;
  
  // Círculo
  out.push(`<circle cx="${fmt(section2X + shapeSize)}" cy="${fmt(shapeY + shapeSize)}" r="${fmt(shapeSize)}" fill="none" stroke="#000" stroke-width="${shapeSw}"/>`);
  
  // Cuadrado
  out.push(`<rect x="${fmt(section2X + shapeSize * 2.5)}" y="${fmt(shapeY)}" width="${fmt(shapeSize * 2)}" height="${fmt(shapeSize * 2)}" fill="none" stroke="#000" stroke-width="${shapeSw}"/>`);
  
  // Curva suave
  const curveX = section2X;
  const curveY = shapeY + shapeSize * 2.5;
  out.push(`<path d="M ${curveX} ${curveY} Q ${curveX + 20} ${curveY - 10}, ${curveX + 40} ${curveY} T ${curveX + 80} ${curveY}" fill="none" stroke="#000" stroke-width="${shapeSw}" stroke-linecap="round"/>`);
  
  // Sección 3: Patrón repetido simple (para probar consistencia)
  const section3Y = Math.max(y, curveY + 15);
  out.push(`<text x="${fmt(m)}" y="${fmt(section3Y + 5)}" ${FONT} font-size="3.5" font-weight="bold">Patrón repetido:</text>`);
  
  const patternY = section3Y + 12;
  const patternSw = scaleStrokeForProfile(0.4, lineThicknessProfile);
  const patternSpacing = 12;
  
  for (let i = 0; i < 5; i++) {
    const px = m + 5 + i * patternSpacing;
    // Pequeño motivo repetido (onda simple)
    out.push(`<path d="M ${px} ${patternY} Q ${px + 3} ${patternY - 4}, ${px + 6} ${patternY} T ${px + 12} ${patternY}" fill="none" stroke="#000" stroke-width="${patternSw}" stroke-linecap="round"/>`);
  }
  
  // Nota al pie
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(h - m - 5)}" ${FONT} font-size="3" text-anchor="middle" font-style="italic">Si las líneas y formas se ven claras, tu impresión es correcta.</text>`);
  
  out.push("</svg>");
  return out.join("");
}

// Genera todas las páginas de front matter en orden:
// [portada, copyright, pertenece a, prueba de color]
// Todas son páginas simples (no dobles) y ocupan una cara cada una.
export function generateFrontMatter(geo, opts = {}) {
  return [
    titlePage(geo, opts),
    copyrightPage(geo, opts),
    belongsToPage(geo, opts),
    colorTestPage(geo, opts),
  ];
}

// Utilidad: dividir texto en líneas de máximo maxChars caracteres, cortando por palabras.
function wrapText(text, maxChars) {
  if (!text || text.length <= maxChars) return [text || ""];
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";
  
  for (const word of words) {
    if ((currentLine + " " + word).trim().length > maxChars && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word;
    } else {
      currentLine = (currentLine + " " + word).trim();
    }
  }
  if (currentLine) lines.push(currentLine.trim());
  
  return lines;
}

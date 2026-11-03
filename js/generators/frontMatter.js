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
  
  // Título: la parte antes de «:» grande y el resto como subtítulo. Las líneas
  // se parten midiendo el ancho en mm (textWidthMm), no contando caracteres:
  // así ningún título se sale de la hoja.
  const availW = w - 2 * margin - 12;
  const [main, ...rest] = String(title).split(/:\s+/);
  const subtitle = rest.join(": ");
  let size = 10, mainLines = wrapText(main, availW, size);
  while ((mainLines.length > 3 || !fits(mainLines, availW, size)) && size > 5) { size -= 0.5; mainLines = wrapText(main, availW, size); }
  let subSize = Math.min(6, size * 0.6);
  let subLines = subtitle ? wrapText(subtitle, availW, subSize) : [];
  while (!fits(subLines, availW, subSize) && subSize > 3) { subSize -= 0.25; subLines = wrapText(subtitle, availW, subSize); }
  const lh = size * 1.25, slh = subSize * 1.35;
  const blockH = mainLines.length * lh + (subLines.length ? 4 + subLines.length * slh : 0) + (author ? 12 : 0);
  let y = h / 2 - blockH / 2 + size;
  mainLines.forEach((line) => {
    out.push(`<text x="${fmt(w / 2)}" y="${fmt(y)}" ${FONT} font-size="${size}" font-weight="bold" text-anchor="middle">${esc(line)}</text>`);
    y += lh;
  });
  if (subLines.length) {
    y += 4 - lh + slh;
    subLines.forEach((line) => {
      out.push(`<text x="${fmt(w / 2)}" y="${fmt(y)}" ${FONT} font-size="${fmt(subSize)}" text-anchor="middle">${esc(line)}</text>`);
      y += slh;
    });
  }
  if (author) {
    out.push(`<text x="${fmt(w / 2)}" y="${fmt(y + 8)}" ${FONT} font-size="5" text-anchor="middle">${esc(author)}</text>`);
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
  for (const line of wrapText(String(title), w - 2 * m - 6, 4)) {
    out.push(`<text x="${fmt(w / 2)}" y="${fmt(y)}" ${FONT} font-size="4" text-anchor="middle">${esc(line)}</text>`);
    y += lineHeight;
  }
  
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
  // Hueco de 18 mm para la etiqueta («0.8 mm») antes de la columna de formas.
  const lineEndX = m + testAreaWidth / 2 - 18;
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

// Ancho aproximado de un texto en mm con letra de `size` mm (negrita, prudente:
// mayúsculas y «m/w» anchas, «i/l/.» estrechas). Sirve para partir líneas sin
// que ningún título se salga de la hoja.
export function textWidthMm(text, size) {
  let em = 0;
  for (const ch of String(text)) {
    if (/[mwMW@]/.test(ch)) em += 0.95;
    else if (/[A-ZÁÉÍÓÚÑÜ0-9]/.test(ch)) em += 0.78;
    else if (/[ijlI.,:;'!|]/.test(ch)) em += 0.34;
    else if (ch === " ") em += 0.32;
    else em += 0.64;
  }
  return em * size;
}

// Parte `text` en líneas de como mucho `maxWidthMm` (una palabra más larga que
// la línea queda sola; quien llama reduce la letra si hace falta).
function wrapText(text, maxWidthMm, size) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidthMm(next, size) > maxWidthMm) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
const fits = (lines, maxWidthMm, size) => lines.every((l) => textWidthMm(l, size) <= maxWidthMm);

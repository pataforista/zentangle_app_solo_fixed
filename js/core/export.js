// js/core/export.js
export function downloadTextFile(filename, text, type = "image/svg+xml;charset=utf-8") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Genera un DataURL de un PNG a partir de un SVG.
 */
export async function generatePngDataUrl(svgString, widthMm, heightMm) {
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

  return new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      const out = canvas.toDataURL("image/png");
      canvas.width = 0; canvas.height = 0; // libera memoria (importante en libros de muchas páginas)
      resolve(out);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Descarga el contenido SVG como PNG de alta resolución.
 */
export async function downloadPng(filename, svgString, widthMm, heightMm) {
  const dataUrl = await generatePngDataUrl(svgString, widthMm, heightMm);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/**
 * Descarga el contenido SVG como PDF de alta resolución (KDP ready).
 */
export async function downloadPdf(filename, svgString, widthMm, heightMm) {
  if (typeof window === "undefined" || !window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("La librería jsPDF no está cargada. Verifica que js/vendor/jspdf.umd.min.js existe.");
  }
  const { jsPDF } = window.jspdf;
  const orientation = widthMm > heightMm ? "l" : "p";
  const doc = new jsPDF(orientation, "mm", [widthMm, heightMm]);

  const dataUrl = await generatePngDataUrl(svgString, widthMm, heightMm);
  
  // Añadimos la imagen al PDF ocupando toda la página (con compresión rápida para reducir peso sin perder calidad)
  doc.addImage(dataUrl, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST");
  doc.save(filename);
}

/**
 * Arma un PDF multipágina (un diseño por página, con hoja en blanco opcional
 * entre diseños, como piden los libros de colorear de una cara en KDP).
 * - getSvg(i): devuelve el SVG (string) del diseño i. Puede ser async.
 * - onProgress(i, count): se llama tras cada diseño.
 * - isCancelled(): si devuelve true se aborta y se retorna null.
 * El caller guarda el resultado con doc.save(nombre).
 */
// Con `sequence` (ver core/bookPlan.js) cada entrada es una página: null = en
// blanco; si no, getEntrySvg(entrada) da su SVG. Sin ella, el modo clásico.
export async function buildBookPdf({ widthMm, heightMm, count, blankBetween = true, title = "Libro para colorear", getSvg, onProgress, isCancelled, sequence = null, getEntrySvg = null }) {
  if (typeof window === "undefined" || !window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("La librería jsPDF no está cargada. Verifica que js/vendor/jspdf.umd.min.js existe y recarga.");
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF(widthMm > heightMm ? "l" : "p", "mm", [widthMm, heightMm]);
  doc.setProperties({ title });

  const orient = widthMm > heightMm ? "l" : "p";
  if (sequence) {
    for (let i = 0; i < sequence.length; i++) {
      if (isCancelled && isCancelled()) return null;
      if (i > 0) doc.addPage([widthMm, heightMm], orient);
      const e = sequence[i];
      if (e) {
        const png = await generatePngDataUrl(await getEntrySvg(e), widthMm, heightMm);
        doc.addImage(png, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST");
      }
      if (onProgress) onProgress(i + 1, sequence.length);
      await new Promise((r) => setTimeout(r, 0));
    }
    return doc;
  }
  let first = true;
  for (let i = 0; i < count; i++) {
    if (isCancelled && isCancelled()) return null;
    const svg = await getSvg(i);
    const png = await generatePngDataUrl(svg, widthMm, heightMm);
    if (!first) doc.addPage([widthMm, heightMm], widthMm > heightMm ? "l" : "p");
    first = false;
    doc.addImage(png, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST");
    // Diseño a la derecha (impar), blanco a la izquierda (par): evita que la tinta traspase al siguiente diseño.
    if (blankBetween) doc.addPage([widthMm, heightMm], widthMm > heightMm ? "l" : "p");
    if (onProgress) onProgress(i + 1, count);
    await new Promise((r) => setTimeout(r, 0)); // deja respirar a la UI
  }
  return doc;
}

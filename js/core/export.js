// js/core/export.js
export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Flatten SVG: convierte <use> en copias reales del contenido referenciado,
// removiendo IDs duplicados para mantener SVG válido.
export function flattenSvgElement(svgEl) {
  if (!svgEl) return null;

  const svg = svgEl.cloneNode(true);

  const idMap = new Map();
  svg.querySelectorAll("[id]").forEach((el) => idMap.set(el.getAttribute("id"), el));

  const uses = Array.from(svg.querySelectorAll("use"));
  for (const use of uses) {
    const href = use.getAttribute("href") || use.getAttribute("xlink:href");
    if (!href || !href.startsWith("#")) continue;

    const ref = idMap.get(href.slice(1));
    if (!ref) continue;

    const clone = ref.cloneNode(true);

    // Evita IDs duplicados (MUY importante para impresión/conversión)
    stripIdsDeep(clone);

    // Aplica transform del <use>
    const tUse = use.getAttribute("transform");
    const tClone = clone.getAttribute("transform");
    if (tUse && tClone) clone.setAttribute("transform", `${tUse} ${tClone}`);
    else if (tUse) clone.setAttribute("transform", tUse);

    use.replaceWith(clone);
  }

  return svg;
}

function stripIdsDeep(node) {
  if (node.nodeType !== 1) return;
  if (node.hasAttribute("id")) node.removeAttribute("id");
  const all = node.querySelectorAll?.("[id]");
  if (all && all.length) all.forEach(el => el.removeAttribute("id"));
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
      resolve(canvas.toDataURL("image/png"));
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
  const { jsPDF } = window.jspdf;
  const orientation = widthMm > heightMm ? "l" : "p";
  const doc = new jsPDF(orientation, "mm", [widthMm, heightMm]);

  const dataUrl = await generatePngDataUrl(svgString, widthMm, heightMm);
  
  // Añadimos la imagen al PDF ocupando toda la página (con compresión rápida para reducir peso sin perder calidad)
  doc.addImage(dataUrl, "PNG", 0, 0, widthMm, heightMm, undefined, "FAST");
  doc.save(filename);
}

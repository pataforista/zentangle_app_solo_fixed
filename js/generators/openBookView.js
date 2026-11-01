// openBookView.js
// Vista de libro abierto: muestra el libro como pliegos dobles (páginas
// izquierda y derecha juntas), como un libro abierto sobre una mesa.
// Útil para previsualizar cómo quedará el libro impreso.

const fmt = (n) => (Math.round(Number(n) * 100) / 100).toString();

// Genera un SVG con dos páginas lado a lado (vista de libro abierto).
// leftSvg y rightSvg son los SVGs de cada página. Si alguno es null, se
// muestra una página en blanco.
export function openBookSpread(leftSvg, rightSvg, { w, h, m }) {
  const spreadW = w * 2;
  const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${spreadW}mm" height="${h}mm" viewBox="0 0 ${spreadW} ${h}">`];
  
  // Fondo blanco
  out.push(`<rect width="${spreadW}" height="${h}" fill="#fff"/>`);
  
  // Línea central (lomo)
  out.push(`<line x1="${w}" y1="0" x2="${w}" y2="${h}" stroke="#ccc" stroke-width="0.3" stroke-dasharray="2 2"/>`);
  
  // Página izquierda
  if (leftSvg) {
    // Extraer el contenido del SVG (todo lo que está dentro de <svg>...</svg>)
    const content = extractSvgContent(leftSvg);
    out.push(`<g transform="translate(0 0)">${content}</g>`);
  }
  
  // Página derecha
  if (rightSvg) {
    const content = extractSvgContent(rightSvg);
    out.push(`<g transform="translate(${w} 0)">${content}</g>`);
  }
  
  out.push("</svg>");
  return out.join("");
}

// Extrae el contenido interno de un SVG (sin la etiqueta <svg> exterior).
function extractSvgContent(svgString) {
  if (!svgString) return "";
  // Quitar la etiqueta <svg ... > de apertura y </svg> de cierre
  return svgString.replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");
}

// Genera todos los pliegos de un libro a partir de la secuencia de páginas.
// Devuelve un array de SVGs, cada uno con dos páginas lado a lado.
export function generateOpenBookView(sequence, { w, h, m }, getEntrySvg) {
  const spreads = [];
  
  // Agrupar páginas en pares (izquierda, derecha)
  for (let i = 0; i < sequence.length; i += 2) {
    const leftEntry = sequence[i] || null;
    const rightEntry = sequence[i + 1] || null;
    
    // Generar SVGs de forma asíncrona (el caller debe esperar las promesas)
    const leftSvg = leftEntry ? getEntrySvg(leftEntry) : null;
    const rightSvg = rightEntry ? getEntrySvg(rightEntry) : null;
    
    spreads.push({ leftSvg, rightSvg, leftIndex: i, rightIndex: i + 1 });
  }
  
  return spreads;
}

// Descarga un PDF con la vista de libro abierto (todos los pliegos).
export async function downloadOpenBookPdf(sequence, { w, h, m }, getEntrySvg, title = "Libro para colorear") {
  if (typeof window === "undefined" || !window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("La librería jsPDF no está cargada.");
  }
  const { jsPDF } = window.jspdf;
  
  const spreadW = w * 2;
  const doc = new jsPDF(spreadW > h ? "l" : "p", "mm", [spreadW, h]);
  doc.setProperties({ title: `${title} - Vista de libro abierto` });
  
  const pixelRatio = 300 / 25.4;
  const canvasW = Math.round(spreadW * pixelRatio);
  const canvasH = Math.round(h * pixelRatio);
  
  for (let i = 0; i < sequence.length; i += 2) {
    const leftEntry = sequence[i] || null;
    const rightEntry = sequence[i + 1] || null;
    
    const leftSvg = leftEntry ? await getEntrySvg(leftEntry) : null;
    const rightSvg = rightEntry ? await getEntrySvg(rightEntry) : null;
    
    const spreadSvg = openBookSpread(leftSvg, rightSvg, { w, h, m });
    
    // Renderizar a PNG
    const svgBlob = new Blob([spreadSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    
    await new Promise((resolve, reject) => {
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvasW, canvasH);
        ctx.drawImage(img, 0, 0, canvasW, canvasH);
        URL.revokeObjectURL(url);
        
        const dataUrl = canvas.toDataURL("image/png");
        canvas.width = 0;
        canvas.height = 0;
        
        if (i > 0) doc.addPage([spreadW, h], spreadW > h ? "l" : "p");
        doc.addImage(dataUrl, "PNG", 0, 0, spreadW, h, undefined, "FAST");
        resolve();
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      };
      img.src = url;
    });
    
    await new Promise((r) => setTimeout(r, 0));
  }
  
  const filename = `libro_abierto_${title.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
  return filename;
}

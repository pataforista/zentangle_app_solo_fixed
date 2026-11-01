// mockupExport.js
// Helper para exportar páginas como imágenes de alta resolución para mockups.
// Útil para crear contenido A+ de Amazon y mockups en Canva.

// ===================== CONFIGURACIÓN =====================

// Resoluciones recomendadas para diferentes usos
export const MOCKUP_RESOLUTIONS = {
  // Para Amazon A+ Content (módulos de imagen)
  aplus: { width: 970, height: 600, dpi: 72, label: "A+ Content (970×600)" },
  // Para mockups de portada (alta resolución)
  cover: { width: 3000, height: 3900, dpi: 300, label: "Portada HD (3000×3900)" },
  // Para redes sociales (Instagram, Facebook)
  social: { width: 1080, height: 1080, dpi: 72, label: "Social Media (1080×1080)" },
  // Para impresión de muestra (calidad fotográfica)
  print: { width: 2550, height: 3300, dpi: 300, label: "Impresión (2550×3300)" },
  // Personalizado
  custom: null,
};

// ===================== EXPORTACIÓN DE PÁGINAS =====================

/**
 * Exporta una página SVG como PNG de alta resolución.
 * @param {string} svg - SVG de la página
 * @param {Object} opts - Opciones de exportación
 * @param {number} opts.width - Ancho en píxeles
 * @param {number} opts.height - Alto en píxeles
 * @param {string} opts.format - Formato: "png" | "jpeg"
 * @param {number} opts.quality - Calidad (0-1) para JPEG
 * @returns {Promise<Blob>} Blob de la imagen
 */
export async function exportPageAsImage(svg, opts = {}) {
  const {
    width = 1200,
    height = 1554,
    format = "png",
    quality = 0.95,
    backgroundColor = "#ffffff",
  } = opts;

  // Crear canvas
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Fondo blanco
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  // Cargar SVG como imagen
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("No se pudo cargar el SVG"));
      img.src = url;
    });

    // Dibujar la imagen en el canvas manteniendo aspect ratio
    const imgAspect = img.width / img.height;
    const canvasAspect = width / height;

    let drawWidth, drawHeight, offsetX, offsetY;

    if (imgAspect > canvasAspect) {
      // La imagen es más ancha que el canvas
      drawWidth = width;
      drawHeight = width / imgAspect;
      offsetX = 0;
      offsetY = (height - drawHeight) / 2;
    } else {
      // La imagen es más alta que el canvas
      drawHeight = height;
      drawWidth = height * imgAspect;
      offsetX = (width - drawWidth) / 2;
      offsetY = 0;
    }

    ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

    // Convertir a blob
    const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
    const blob = await new Promise((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });

    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Exporta múltiples páginas como imágenes.
 * @param {Array<string>} svgs - Array de SVGs
 * @param {Object} opts - Opciones de exportación
 * @param {Function} onProgress - Callback de progreso
 * @returns {Promise<Array<Blob>>} Array de blobs
 */
export async function exportMultiplePages(svgs, opts = {}, onProgress = null) {
  const results = [];

  for (let i = 0; i < svgs.length; i++) {
    if (onProgress) {
      onProgress(i, svgs.length);
    }

    const blob = await exportPageAsImage(svgs[i], opts);
    results.push(blob);

    // Permitir que la UI se actualice
    await new Promise((r) => setTimeout(r, 10));
  }

  if (onProgress) {
    onProgress(svgs.length, svgs.length);
  }

  return results;
}

/**
 * Descarga una imagen con el nombre especificado.
 */
export function downloadImage(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ===================== PÁGINAS DESTACADAS =====================

/**
 * Obtiene las mejores páginas del libro para usar en mockups.
 * Selecciona las 4-6 páginas con mejor puntuación de calidad.
 * @param {Object} review - Book review con las páginas
 * @param {number} count - Número de páginas a seleccionar
 * @returns {Array} Array de {pageIndex, page, score}
 */
export function getBestPagesForMockup(review, count = 6) {
  if (!review?.pages?.length) return [];

  // Calcular score para cada página
  const scored = review.pages.map((page, idx) => {
    const q = page.quality || {};
    const coverage = q.coverage ?? 0;
    const contrast = q.contrast ?? 0;
    const ink = q.ink ?? 0;

    // Score compuesto: cobertura y contraste positivos, penalizar tinta excesiva
    const normalizedContrast = Math.max(0, Math.min(1, (contrast + 0.5) / 1.5));
    const inkPenalty = ink > 25 ? (ink - 25) / 100 : 0;
    const score = coverage * 0.5 + normalizedContrast * 0.4 + (1 - inkPenalty) * 0.1;

    return { pageIndex: idx, page, score };
  });

  // Ordenar por score y tomar las mejores
  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, count);
}

/**
 * Exporta las mejores páginas como imágenes para mockups.
 */
export async function exportBestPages(review, opts = {}, onProgress = null) {
  const bestPages = getBestPagesForMockup(review, opts.count || 6);
  const svgs = bestPages.map((bp) => bp.page.svg).filter(Boolean);

  if (svgs.length === 0) {
    throw new Error("No hay SVGs disponibles para exportar");
  }

  return exportMultiplePages(svgs, opts, onProgress);
}

// ===================== INSTRUCCIONES PARA CANVA =====================

/**
 * Genera instrucciones para usar las imágenes en Canva.
 */
export function getCanvaInstructions() {
  return `
═══════════════════════════════════════════════════════════════
CÓMO USAR LAS IMÁGENES EN CANVA PARA MOCKUPS Y CONTENIDO A+
═══════════════════════════════════════════════════════════════

1. SUBIR LAS IMÁGENES A CANVA
   • Ve a canva.com y crea un nuevo diseño
   • Para A+ Content: usa "Dimensiones personalizadas" 970×600 px
   • Para portada mockup: usa 3000×3900 px o el tamaño que necesites
   • Sube las imágenes PNG exportadas desde la app

2. CREAR MOCKUP DE PORTADA
   • Busca "book mockup" en Elementos de Canva
   • Elige una plantilla de mockup de libro
   • Sube tu portada (cover.pdf exportado como imagen)
   • Ajusta la portada al mockup usando las guías

3. CREAR CONTENIDO A+ PARA AMAZON
   • Módulo 1: Portada del libro + título (970×600 px)
   • Módulo 2: 3-4 páginas interiores en grid (970×300 px cada una)
   • Módulo 3: Descripción con beneficios (texto + imagen)
   • Módulo 4: Comparación con otros libros (opcional)
   • Módulo 5: Llamada a la acción (texto grande)

4. DIMENSIONES RECOMENDADAS PARA A+ CONTENT
   • Header: 970×600 px
   • Standard image: 970×300 px
   • Standard single image: 300×400 px
   • Standard comparison chart: 970×600 px

5. CONSEJOS PARA MOCKUPS PROFESIONALES
   • Usa fondos neutros (blanco, gris claro, madera)
   • Añade elementos contextuales (lápices de colores, gafas, café)
   • Muestra varias páginas abiertas para dar idea de contenido
   • Usa sombras sutiles para dar realismo
   • Mantén la coherencia visual en todos los mockups

6. EXPORTAR DESDE CANVA
   • Para web: PNG o JPG a 72 DPI
   • Para impresión: PDF o PNG a 300 DPI
   • Comprueba que los colores se ven bien antes de subir

═══════════════════════════════════════════════════════════════
RECURSOS ADICIONALES
═══════════════════════════════════════════════════════════════

• Plantillas de mockup gratuitas: Canva, Placeit, Smartmockups
• Generador de mockups 3D: Amazon KDP Cover Calculator
• Iconos y elementos: Canva (gratis), Flaticon, Freepik
• Colores para A+: usa los colores de tu portada para coherencia

═══════════════════════════════════════════════════════════════
`.trim();
}

// ===================== PRESETS DE EXPORTACIÓN =====================

/**
 * Presets de exportación para diferentes usos.
 */
export const EXPORT_PRESETS = {
  // Para Amazon A+ Content
  aplus: {
    width: 970,
    height: 600,
    format: "png",
    quality: 0.95,
    count: 6,
    label: "Amazon A+ Content",
  },
  // Para mockups de portada
  coverMockup: {
    width: 3000,
    height: 3900,
    format: "png",
    quality: 0.98,
    count: 1,
    label: "Mockup de portada",
  },
  // Para redes sociales
  socialMedia: {
    width: 1080,
    height: 1080,
    format: "png",
    quality: 0.95,
    count: 4,
    label: "Redes sociales",
  },
  // Para impresión de muestra
  printSample: {
    width: 2550,
    height: 3300,
    format: "png",
    quality: 0.98,
    count: 6,
    label: "Muestra de impresión",
  },
  // Preview rápido (baja resolución)
  quickPreview: {
    width: 800,
    height: 1034,
    format: "jpeg",
    quality: 0.85,
    count: 6,
    label: "Vista previa rápida",
  },
};

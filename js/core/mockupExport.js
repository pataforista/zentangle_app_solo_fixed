import { SimpleZip } from "./zip.js";
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

// ===================== MOCKUPS 3D Y MÓDULOS A+ (FASE 4.3) =====================

/**
 * Genera mockup en perspectiva 3D de libro abierto.
 */
export function generate3DOpenBookSvg(leftSvg, rightSvg, { width = 1200, height = 800, title = "Libro de Arte Zen" } = {}) {
  const cleanLeft = (leftSvg || "").replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");
  const cleanRight = (rightSvg || "").replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <filter id="bookShadow" x="-20%" y="-20%" width="150%" height="150%">
      <feDropShadow dx="0" dy="18" stdDeviation="15" flood-color="#000" flood-opacity="0.25"/>
    </filter>
    <linearGradient id="spineShadow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#000" stop-opacity="0.3"/>
      <stop offset="50%" stop-color="#000" stop-opacity="0.0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.3"/>
    </linearGradient>
    <linearGradient id="pageCurl" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#fff"/>
      <stop offset="90%" stop-color="#fdfdfd"/>
      <stop offset="100%" stop-color="#ececec"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="#f8fafc"/>
  <g transform="translate(${width / 2}, ${height / 2})" filter="url(#bookShadow)">
    <path d="M -430 -290 L 430 -290 L 435 295 L -435 295 Z" fill="#1e293b"/>
    <g transform="translate(-10, 0)">
      <path d="M -410 -280 Q -210 -285 0 -275 L 0 275 Q -210 285 -410 280 Z" fill="url(#pageCurl)"/>
      <g transform="translate(-390, -260) scale(1.75)">
        ${cleanLeft}
      </g>
    </g>
    <g transform="translate(10, 0)">
      <path d="M 0 -275 Q 210 -285 410 -280 L 410 280 Q 210 285 0 275 Z" fill="url(#pageCurl)"/>
      <g transform="translate(30, -260) scale(1.75)">
        ${cleanRight}
      </g>
    </g>
    <rect x="-25" y="-280" width="50" height="560" fill="url(#spineShadow)" pointer-events="none"/>
  </g>
</svg>`;
}

/**
 * Módulo 1 A+ Content: Cabecera Hero (970 × 600 px).
 */
export function generateAplusHeaderSvg(bookTitle = "Libro de Arte y Relajación", sampleSvg = "") {
  const cleanSample = (sampleSvg || "").replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 970 600" width="970" height="600">
  <defs>
    <linearGradient id="heroBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
    <filter id="cardShadow">
      <feDropShadow dx="0" dy="12" stdDeviation="10" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="970" height="600" fill="url(#heroBg)"/>
  <circle cx="900" cy="100" r="250" fill="#6366f1" opacity="0.15"/>
  <circle cx="100" cy="500" r="180" fill="#a855f7" opacity="0.1"/>
  
  <text x="70" y="160" font-family="'Space Grotesk', sans-serif" font-size="44" font-weight="700" fill="#ffffff">${bookTitle}</text>
  <text x="70" y="220" font-family="'Outfit', sans-serif" font-size="22" font-weight="400" fill="#cbd5e1">Arte meditativo de alta precisión con tecnología anti-traspaso</text>
  
  <g transform="translate(70, 290)">
    <rect width="210" height="42" rx="21" fill="#6366f1"/>
    <text x="105" y="27" font-family="'Outfit', sans-serif" font-size="16" font-weight="600" fill="#ffffff" text-anchor="middle">✓ KDP READY</text>
  </g>

  <g transform="translate(560, 80)" filter="url(#cardShadow)">
    <rect width="340" height="440" rx="12" fill="#ffffff"/>
    <g transform="translate(20, 20) scale(1.4)">
      ${cleanSample}
    </g>
  </g>
</svg>`;
}

/**
 * Módulo 2 A+ Content: Muestrario de 3 páginas (970 × 300 px).
 */
export function generateAplusGridSvg(svgList = []) {
  const s1 = (svgList[0] || "").replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");
  const s2 = (svgList[1] || "").replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");
  const s3 = (svgList[2] || "").replace(/<svg[^>]*>/, "").replace(/<\/svg>/, "");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 970 300" width="970" height="300">
  <defs>
    <filter id="tileShadow">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="970" height="300" fill="#f8fafc"/>
  
  <g transform="translate(45, 25)" filter="url(#tileShadow)">
    <rect width="260" height="250" rx="8" fill="#ffffff"/>
    <g transform="translate(15, 15) scale(1.05)">${s1}</g>
  </g>

  <g transform="translate(355, 25)" filter="url(#tileShadow)">
    <rect width="260" height="250" rx="8" fill="#ffffff"/>
    <g transform="translate(15, 15) scale(1.05)">${s2}</g>
  </g>

  <g transform="translate(665, 25)" filter="url(#tileShadow)">
    <rect width="260" height="250" rx="8" fill="#ffffff"/>
    <g transform="translate(15, 15) scale(1.05)">${s3}</g>
  </g>
</svg>`;
}

/**
 * Módulo 3 A+ Content: Beneficios clave (970 × 600 px).
 */
export function generateAplusFeatureSvg(bookTitle = "Libro de Arte Zen") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 970 600" width="970" height="600">
  <rect width="970" height="600" fill="#ffffff"/>
  <rect x="0" y="0" width="970" height="100" fill="#f1f5f9"/>
  <text x="485" y="60" font-family="'Space Grotesk', sans-serif" font-size="28" font-weight="700" fill="#0f172a" text-anchor="middle">¿POR QUÉ ELEGIR NUESTROS LIBROS?</text>

  <g transform="translate(80, 160)">
    <rect width="370" height="170" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="30" y="50" font-family="'Space Grotesk', sans-serif" font-size="20" font-weight="700" fill="#6366f1">📄 Dorso en Blanco</text>
    <text x="30" y="90" font-family="'Outfit', sans-serif" font-size="15" fill="#475569">Cada diseño cuenta con su reverso en</text>
    <text x="30" y="115" font-family="'Outfit', sans-serif" font-size="15" fill="#475569">blanco para evitar traspasos de tinta.</text>
  </g>

  <g transform="translate(520, 160)">
    <rect width="370" height="170" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="30" y="50" font-family="'Space Grotesk', sans-serif" font-size="20" font-weight="700" fill="#6366f1">🎯 Calidad Algorítmica</text>
    <text x="30" y="90" font-family="'Outfit', sans-serif" font-size="15" fill="#475569">Superficies calculadas para que quepa</text>
    <text x="30" y="115" font-family="'Outfit', sans-serif" font-size="15" fill="#475569">la punta de rotuladores y lápices.</text>
  </g>

  <g transform="translate(80, 370)">
    <rect width="370" height="170" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="30" y="50" font-family="'Space Grotesk', sans-serif" font-size="20" font-weight="700" fill="#6366f1">📐 Medidas KDP Exactas</text>
    <text x="30" y="90" font-family="'Outfit', sans-serif" font-size="15" fill="#475569">Márgenes interiores dinámicos para</text>
    <text x="30" y="115" font-family="'Outfit', sans-serif" font-size="15" fill="#475569">colorear cómodamente cerca del lomo.</text>
  </g>

  <g transform="translate(520, 370)">
    <rect width="370" height="170" rx="10" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="30" y="50" font-family="'Space Grotesk', sans-serif" font-size="20" font-weight="700" fill="#6366f1">🧘 Relajación Progresiva</text>
    <text x="30" y="90" font-family="'Outfit', sans-serif" font-size="15" fill="#475569">Dificultad de trazos ordenada para</text>
    <text x="30" y="115" font-family="'Outfit', sans-serif" font-size="15" fill="#475569">una experiencia meditativa fluida.</text>
  </g>
</svg>`;
}

/**
 * Empaqueta todos los mockups 3D y módulos A+ en un ZIP con un solo clic.
 */
export async function exportAplusPackageZip(review, zipFilename = "mockups_y_aplus.zip") {
  const best = getBestPagesForMockup(review, 6);
  const svgs = best.map((b) => b.page.svg).filter(Boolean);
  const title = review?.g?.zPresetKey || "Libro Zentangle";

  const zip = new SimpleZip();
  const mockup3d = generate3DOpenBookSvg(svgs[0], svgs[1], { title });
  zip.addFile("mockup_3d_libro_abierto.svg", mockup3d);

  zip.addFile("aplus_modulo_1_hero.svg", generateAplusHeaderSvg(title, svgs[0]));
  zip.addFile("aplus_modulo_2_grid.svg", generateAplusGridSvg([svgs[0], svgs[1], svgs[2]]));
  zip.addFile("aplus_modulo_3_caracteristicas.svg", generateAplusFeatureSvg(title));

  for (let i = 0; i < svgs.length; i++) {
    zip.addFile(`paginas_destacadas/pagina_${best[i].pageIndex + 1}.svg`, svgs[i]);
  }

  zip.addFile("INSTRUCCIONES_A_PLUS_AMAZON.txt", getCanvaInstructions());

  zip.download(zipFilename);
  return zip;
}

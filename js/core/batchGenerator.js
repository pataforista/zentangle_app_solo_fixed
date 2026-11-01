// batchGenerator.js
// Generador de lotes de libros para producción en serie.
// Genera N libros con diferentes semillas y los empaqueta en un ZIP.
// Cada libro incluye: interior PDF, cover PDF, listing TXT, recipe JSON.

import { generateBilingualListing, generateFullListingText, calculateRoyaltyTable } from "../generators/bookListing.js";

// ===================== CONFIGURACIÓN =====================

// Configuración por defecto para generación en lote
export const BATCH_DEFAULTS = {
  count: 5, // Número de libros a generar
  baseName: "libro", // Nombre base para los archivos
  theme: "adult", // Tema por defecto
  pages: 50, // Páginas por libro
  paperKey: "LETTER", // Tamaño de papel
  printType: "blackWhite", // Tipo de impresión
  channel: "amazon", // Canal de venta
};

// ===================== GENERADOR DE LOTES =====================

/**
 * Genera un lote de libros con diferentes semillas.
 * @param {Object} opts - Opciones del lote
 * @param {Function} generateBook - Función para generar un libro individual
 * @param {Function} onProgress - Callback de progreso (current, total, bookName)
 * @returns {Array} Array de libros generados
 */
export async function generateBatch(opts, generateBook, onProgress = null) {
  const config = { ...BATCH_DEFAULTS, ...opts };
  const { count, baseName, theme, pages, paperKey } = config;

  const books = [];

  for (let i = 0; i < count; i++) {
    const seed = Math.floor(Math.random() * 2147483647); // Semilla aleatoria
    const bookName = `${baseName}_${i + 1}`;

    if (onProgress) {
      onProgress(i, count, bookName);
    }

    try {
      // Generar el libro usando la función proporcionada
      const book = await generateBook({
        seed,
        name: bookName,
        theme,
        pages,
        paperKey,
        ...config,
      });

      books.push(book);

      // Permitir que la UI se actualice
      await new Promise((r) => setTimeout(r, 10));
    } catch (err) {
      console.error(`Error generando libro ${bookName}:`, err);
      // Continuar con el siguiente libro
    }
  }

  if (onProgress) {
    onProgress(count, count, "Completado");
  }

  return books;
}

/**
 * Genera la ficha de KDP para un libro del lote.
 */
export function generateBookListing(bookData) {
  const { theme, pages, paperKey, designs, flags, blank } = bookData;

  const listing = generateBilingualListing({
    theme,
    designs: designs || pages,
    pages,
    paperLabel: paperKey,
    flags: flags || {},
    blank: blank !== false,
  });

  const royaltyTable = calculateRoyaltyTable(pages, bookData.printType || "blackWhite", bookData.channel || "amazon");

  return {
    ...listing,
    royaltyTable,
    fullText: generateFullListingText({
      theme,
      designs: designs || pages,
      pages,
      paperLabel: paperKey,
      flags: flags || {},
      blank: blank !== false,
      printType: bookData.printType || "blackWhite",
      channel: bookData.channel || "amazon",
    }),
  };
}

/**
 * Genera el recipe JSON para un libro.
 */
export function generateBookRecipe(bookData) {
  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    seed: bookData.seed,
    theme: bookData.theme,
    pages: bookData.pages,
    paperKey: bookData.paperKey,
    preset: bookData.preset || "bestseller",
    flags: bookData.flags || {},
    marginMm: bookData.marginMm || 12.7,
    blank: bookData.blank !== false,
    // Metadatos adicionales
    metadata: {
      generator: "zentangle-app-batch",
      batchId: bookData.batchId || null,
      bookIndex: bookData.bookIndex || 0,
    },
  };
}

/**
 * Estructura de archivos para un libro en el ZIP.
 */
export function getBookFileStructure(bookName, bookData) {
  return {
    folder: bookName,
    files: [
      { name: "interior.pdf", type: "pdf", data: bookData.interiorPdf },
      { name: "cover.pdf", type: "pdf", data: bookData.coverPdf },
      { name: "listing.txt", type: "text", data: bookData.listingText },
      { name: "recipe.json", type: "json", data: bookData.recipe },
    ],
  };
}

// ===================== EXPORTACIÓN =====================

/**
 * Descarga un archivo de texto.
 */
export function downloadTextFile(filename, content, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Descarga un archivo JSON.
 */
export function downloadJsonFile(filename, data) {
  downloadTextFile(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}

/**
 * Genera y descarga todos los archivos de un lote (sin ZIP).
 * Útil cuando JSZip no está disponible.
 */
export async function downloadBatchFiles(books, baseName = "lote") {
  for (let i = 0; i < books.length; i++) {
    const book = books[i];
    const bookName = `${baseName}_${i + 1}`;

    // Descargar listing
    if (book.listingText) {
      downloadTextFile(`${bookName}_listing.txt`, book.listingText);
      await new Promise((r) => setTimeout(r, 500)); // Esperar entre descargas
    }

    // Descargar recipe
    if (book.recipe) {
      downloadJsonFile(`${bookName}_recipe.json`, book.recipe);
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// ===================== VALIDACIÓN =====================

/**
 * Valida la configuración del lote.
 */
export function validateBatchConfig(config) {
  const errors = [];

  if (!config.count || config.count < 1) {
    errors.push("El número de libros debe ser al menos 1");
  }
  if (config.count > 20) {
    errors.push("El máximo recomendado es 20 libros por lote");
  }
  if (!config.baseName || config.baseName.trim() === "") {
    errors.push("El nombre base no puede estar vacío");
  }
  if (!config.pages || config.pages < 24) {
    errors.push("El mínimo de páginas es 24 (requisito de KDP)");
  }
  if (config.pages > 828) {
    errors.push("El máximo de páginas es 828 (límite de KDP)");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Calcula estadísticas del lote.
 */
export function calculateBatchStats(books) {
  const totalPages = books.reduce((sum, b) => sum + (b.pages || 0), 0);
  const avgPages = books.length > 0 ? totalPages / books.length : 0;

  return {
    totalBooks: books.length,
    totalPages,
    avgPages: Math.round(avgPages),
    themes: [...new Set(books.map((b) => b.theme))],
    seeds: books.map((b) => b.seed),
  };
}

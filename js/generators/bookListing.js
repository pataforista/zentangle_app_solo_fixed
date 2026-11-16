// bookListing.js
// Generador de ficha bilingüe (inglés/español) para publicación en KDP.
// Incluye: título, subtítulo, 7 palabras clave, 3 categorías y tabla de regalías.
// Las palabras clave siguen las reglas de KDP: máximo 50 caracteres por casilla,
// sin repetir palabras del título ni usar marcas registradas.

import { BLOCKED_TERMS, ATTRIBUTION_ES, ATTRIBUTION_EN } from "../core/kdpListing.js";

// ===================== CONFIGURACIÓN DE KDP =====================
// Límites de KDP para palabras clave
export const KDP_KEYWORD_MAX_LENGTH = 50;
export const KDP_KEYWORD_COUNT = 7;
export const KDP_CATEGORY_COUNT = 3;

// Costes y regalías de KDP: viven en js/core/kdpRates.js (con fuentes y fecha).
import { printCostUsd, royaltyPerSaleUsd, minPriceForPositiveRoyalty, KDP_RATES_AS_OF, KDP_PRINT_COSTS } from "../core/kdpRates.js";

// Precios sugeridos para libros para colorear (USD)
export const SUGGESTED_PRICES = {
  small: { min: 6.99, default: 8.99, max: 12.99 }, // 50-80 páginas
  medium: { min: 8.99, default: 10.99, max: 14.99 }, // 80-120 páginas
  large: { min: 10.99, default: 12.99, max: 16.99 }, // 120+ páginas
};

// ===================== TÍTULOS BILINGÜES =====================
// Títulos en español e inglés, optimizados para SEO en KDP.
// Sin marcas registradas (Zentangle®, Zendala, etc.)

export const BILINGUAL_TITLES = {
  adult: {
    es: [
      "Figuras con patrones: libro para colorear para adultos",
      "Arte de patrones: diseños intrincados para relajarse",
      "Mandalas y figuras: libro antiestrés para adultos",
    ],
    en: [
      "Patterned Figures: Adult Coloring Book",
      "Pattern Art: Intricate Designs for Relaxation",
      "Mandalas and Figures: Stress Relief Coloring Book for Adults",
    ],
  },
  glass: {
    es: [
      "Vitrales para colorear: libro relajante para adultos",
      "Mosaicos de vitral: diseños grandes para colorear",
      "Colorea un vitral: patrones sencillos y relajantes",
    ],
    en: [
      "Stained Glass Coloring Book: Relaxing Designs for Adults",
      "Stained Glass Mosaics: Large Piece Designs to Color",
      "Color a Stained Glass: Simple and Relaxing Patterns",
    ],
  },
  dino: {
    es: [
      "Dinosaurios para colorear: patrones prehistóricos",
      "Mundo prehistórico: triceratops, estegosaurio y más",
      "Dinosaurios con patrones: de fácil a difícil",
    ],
    en: [
      "Dinosaur Coloring Book: Prehistoric Patterns",
      "Prehistoric World: Triceratops, Stegosaurus and More",
      "Patterned Dinosaurs: Easy to Difficult Coloring",
    ],
  },
  bio: {
    es: [
      "Biología para colorear: células, ADN y neuronas",
      "La vida al microscopio: ciencia para colorear",
      "Anatomía y células: patrones para colorear",
    ],
    en: [
      "Biology Coloring Book: Cells, DNA and Neurons",
      "Life Under the Microscope: Science Coloring Book",
      "Anatomy and Cells: Patterns to Color",
    ],
  },
  cryptids: {
    es: [
      "Críptidos para colorear: Pie Grande, Nessie y más",
      "Criaturas misteriosas del mundo: libro para colorear",
      "Monstruos legendarios: patrones para colorear",
    ],
    en: [
      "Cryptids Coloring Book: Bigfoot, Nessie and More",
      "Mysterious Creatures of the World: Coloring Book",
      "Legendary Monsters: Patterns to Color",
    ],
  },
  kids: {
    es: [
      "Animales tiernos para colorear: búhos, gatos y más",
      "Animalitos con patrones: libro para colorear",
      "Animales con patrones: de fácil a difícil",
    ],
    en: [
      "Cute Animals Coloring Book: Owls, Cats and More",
      "Patterned Animals: Coloring Book for Kids",
      "Animals with Patterns: Easy to Difficult",
    ],
  },
  ocean: {
    es: [
      "Océano para colorear: tortugas, medusas y ballenas",
      "Vida marina: patrones oceánicos para colorear",
      "Criaturas del mar: libro de patrones marinos",
    ],
    en: [
      "Ocean Coloring Book: Turtles, Jellyfish and Whales",
      "Marine Life: Ocean Patterns to Color",
      "Sea Creatures: Marine Pattern Coloring Book",
    ],
  },
  cats: {
    es: [
      "Gatos para colorear: patrones felinos relajantes",
      "Mundo gatuno: gatos con patrones para colorear",
      "Gatos y patrones: libro antiestrés para amantes de gatos",
    ],
    en: [
      "Cats Coloring Book: Relaxing Feline Patterns",
      "Cat World: Patterned Cats to Color",
      "Cats and Patterns: Stress Relief for Cat Lovers",
    ],
  },
  birds: {
    es: [
      "Aves para colorear: patrones de aves exóticas",
      "Mundo de las aves: libro de patrones para colorear",
      "Pájaros con patrones: colibríes, loros y más",
    ],
    en: [
      "Birds Coloring Book: Exotic Bird Patterns",
      "Bird World: Pattern Coloring Book",
      "Patterned Birds: Hummingbirds, Parrots and More",
    ],
  },
  christmas: {
    es: [
      "Navidad para colorear: patrones navideños relajantes",
      "Mundo navideño: árbol, estrellas y adornos para colorear",
      "Navidad con patrones: libro festivo para colorear",
    ],
    en: [
      "Christmas Coloring Book: Relaxing Holiday Patterns",
      "Christmas World: Trees, Stars and Ornaments to Color",
      "Patterned Christmas: Festive Coloring Book",
    ],
  },
};

// ===================== PALABRAS CLAVE =====================
// 7 palabras clave por libro, máximo 50 caracteres cada una.
// Sin repetir palabras del título ni usar marcas registradas.

export const KEYWORD_SUGGESTIONS = {
  adult: [
    "libro colorear adultos patrones",
    "colorear relajarse antiestrés",
    "mandalas figuras intrincadas",
    "doodle art adultos",
    "mindfulness colorear",
    "aprender dibujar patrones",
    "regalo adultos colorear",
  ],
  glass: [
    "vitrales colorear adultos",
    "libro colorear fácil relajante",
    "mosaicos colorear",
    "piezas grandes letra grande",
    "principiantes adultos",
    "relajarse antiestrés",
    "regalo adultos mayores",
  ],
  dino: [
    "dinosaurios colorear",
    "libro dinosaurios niños adultos",
    "prehistoria colorear",
    "triceratops estegosaurio",
    "regalo amantes dinosaurios",
    "paleontología colorear",
    "dinosaurios patrones zen",
  ],
  bio: [
    "biología colorear",
    "libro ciencia colorear",
    "células ADN colorear",
    "regalo estudiantes medicina",
    "anatomía colorear",
    "neurociencia regalo",
    "estudiar biología colorear",
  ],
  cryptids: [
    "críptidos colorear",
    "pie grande libro colorear",
    "monstruos legendarios",
    "misterio folclore colorear",
    "regalo paranormal",
    "ovnis aliens colorear",
    "criaturas míticas adultos",
  ],
  kids: [
    "libro colorear niños animales",
    "animales tiernos colorear",
    "niños 6 a 10 años",
    "libro fácil animales",
    "regalo niños colorear",
    "animales patrones",
    "actividades niños colorear",
  ],
  ocean: [
    "océano colorear adultos",
    "vida marina colorear",
    "tortugas medusas ballenas",
    "mundo submarino patrones",
    "criaturas marinas colorear",
    "relajación acuática",
    "regalo amantes mar",
  ],
  cats: [
    "gatos colorear adultos",
    "gatos patrones relajante",
    "felinos colorear",
    "gatitos tiernos patrones",
    "regalo amantes gatos",
    "gatos antiestrés",
    "mundo felino colorear",
  ],
  birds: [
    "aves colorear adultos",
    "pájaros exóticos patrones",
    "colibríes loros aves",
    "mundo aves colorear",
    "ornitología regalo",
    "aves tropicales patrones",
    "pajaros relajante",
  ],
  christmas: [
    "navidad colorear adultos",
    "patrones navideños",
    "arbol estrellas adornos",
    "libro festivo colorear",
    "regalo navideño",
    "navidad relajante",
    "holiday patterns coloring",
  ],
};

// Versión en inglés de las palabras clave
export const KEYWORD_SUGGESTIONS_EN = {
  adult: [
    "adult coloring book patterns",
    "stress relief coloring",
    "intricate mandalas figures",
    "doodle art adults",
    "mindfulness coloring",
    "learn draw patterns",
    "gift adults coloring",
  ],
  glass: [
    "stained glass coloring adults",
    "easy relaxing coloring book",
    "mosaics to color",
    "large pieces large print",
    "beginners adults",
    "relaxation stress relief",
    "gift seniors",
  ],
  dino: [
    "dinosaur coloring book",
    "dinosaur book kids adults",
    "prehistoric coloring",
    "triceratops stegosaurus",
    "gift dinosaur lovers",
    "paleontology coloring",
    "dinosaurs zen patterns",
  ],
  bio: [
    "biology coloring book",
    "science coloring book",
    "cells DNA coloring",
    "gift medical students",
    "anatomy coloring",
    "neuroscience gift",
    "study biology coloring",
  ],
  cryptids: [
    "cryptids coloring book",
    "bigfoot coloring book",
    "legendary monsters",
    "mystery folklore coloring",
    "paranormal gift",
    "UFO aliens coloring",
    "mythical creatures adults",
  ],
  kids: [
    "kids animal coloring book",
    "cute animals coloring",
    "kids 6 to 10 years",
    "easy animal coloring book",
    "gift kids coloring",
    "animals with patterns",
    "activities kids coloring",
  ],
  ocean: [
    "ocean coloring adults",
    "marine life coloring",
    "turtles jellyfish whales",
    "underwater world patterns",
    "sea creatures coloring",
    "aquatic relaxation",
    "gift ocean lovers",
  ],
  cats: [
    "cats coloring adults",
    "cat patterns relaxing",
    "felines coloring",
    "cute kittens patterns",
    "gift cat lovers",
    "cats stress relief",
    "feline world coloring",
  ],
  birds: [
    "birds coloring adults",
    "exotic birds patterns",
    "hummingbirds parrots birds",
    "bird world coloring",
    "ornithology gift",
    "tropical birds patterns",
    "birds relaxing",
  ],
  christmas: [
    "christmas coloring adults",
    "holiday patterns",
    "tree stars ornaments",
    "festive coloring book",
    "christmas gift",
    "holiday relaxation",
    "christmas patterns coloring",
  ],
};

// ===================== CATEGORÍAS =====================
// 3 categorías BISAC recomendadas para libros para colorear

export const CATEGORY_SUGGESTIONS = {
  adult: [
    { code: "CRA001000", name: "Crafts & Hobbies / Coloring Books" },
    { code: "SEL000000", name: "Self-Help / General" },
    { code: "ART015000", name: "Art / Techniques / Color" },
  ],
  glass: [
    { code: "CRA001000", name: "Crafts & Hobbies / Coloring Books" },
    { code: "ART028000", name: "Art / Subjects & Themes / Religious" },
    { code: "SEL030000", name: "Self-Help / Stress Management" },
  ],
  dino: [
    { code: "CRA001000", name: "Crafts & Hobbies / Coloring Books" },
    { code: "JNF033000", name: "Juvenile Nonfiction / Science & Nature / Dinosaurs" },
    { code: "JNF003000", name: "Juvenile Nonfiction / Animals / General" },
  ],
  bio: [
    { code: "CRA001000", name: "Crafts & Hobbies / Coloring Books" },
    { code: "SCI002000", name: "Science / Biological Sciences" },
    { code: "EDU008000", name: "Education / Subjects / Science" },
  ],
  cryptids: [
    { code: "CRA001000", name: "Crafts & Hobbies / Coloring Books" },
    { code: "GAM001000", name: "Games & Activities / Fantasy" },
    { code: "OCC006000", name: "Body, Mind & Spirit / Paranormal" },
  ],
  kids: [
    { code: "JNF003000", name: "Juvenile Nonfiction / Animals / General" },
    { code: "CRA001000", name: "Crafts & Hobbies / Coloring Books" },
    { code: "JNF005000", name: "Juvenile Nonfiction / Activity Books" },
  ],
  ocean: [
    { code: "CRA001000", name: "Crafts & Hobbies / Coloring Books" },
    { code: "JNF031000", name: "Juvenile Nonfiction / Science & Nature / Marine Life" },
    { code: "NAT015000", name: "Nature / Ocean & Seas" },
  ],
  cats: [
    { code: "CRA001000", name: "Crafts & Hobbies / Coloring Books" },
    { code: "HOM007000", name: "House & Home / Pets" },
    { code: "JNF003000", name: "Juvenile Nonfiction / Animals / Cats" },
  ],
  birds: [
    { code: "CRA001000", name: "Crafts & Hobbies / Coloring Books" },
    { code: "NAT043000", name: "Nature / Birds & Birdwatching" },
    { code: "JNF003000", name: "Juvenile Nonfiction / Animals / Birds" },
  ],
  christmas: [
    { code: "CRA001000", name: "Crafts & Hobbies / Coloring Books" },
    { code: "HOL004000", name: "Holiday / Christmas & Advent" },
    { code: "SEL030000", name: "Self-Help / Stress Management" },
  ],
};

// ===================== FUNCIONES PRINCIPALES =====================

/**
 * Valida que una palabra clave cumpla las reglas de KDP.
 * - Máximo 50 caracteres
 * - No contiene palabras bloqueadas (marcas registradas)
 * - No está vacía
 */
export function validateKeyword(keyword) {
  const trimmed = keyword.trim();
  if (!trimmed) return { valid: false, reason: "Vacía" };
  if (trimmed.length > KDP_KEYWORD_MAX_LENGTH) {
    return { valid: false, reason: `Excede ${KDP_KEYWORD_MAX_LENGTH} caracteres (${trimmed.length})` };
  }
  const lower = trimmed.toLowerCase();
  const blocked = BLOCKED_TERMS.find((t) => lower.includes(t));
  if (blocked) return { valid: false, reason: `Contiene término bloqueado: "${blocked}"` };
  return { valid: true };
}

/**
 * Filtra palabras clave para evitar repetir palabras del título.
 * Devuelve las 7 palabras clave válidas.
 */
export function filterKeywordsByTitle(keywords, title) {
  const titleWords = new Set(
    title.toLowerCase().split(/\s+/).filter((w) => w.length > 3)
  );
  return keywords
    .filter((kw) => {
      const kwWords = kw.toLowerCase().split(/\s+/);
      // Permitir si al menos la mitad de las palabras no están en el título
      const newWords = kwWords.filter((w) => !titleWords.has(w));
      return newWords.length >= kwWords.length / 2;
    })
    .slice(0, KDP_KEYWORD_COUNT);
}

/**
 * Genera la ficha bilingüe completa para un libro.
 * @param {Object} opts - Opciones del libro
 * @param {string} opts.theme - Tema del libro (adult, dino, ocean, etc.)
 * @param {number} opts.designs - Número de diseños
 * @param {number} opts.pages - Número total de páginas
 * @param {string} opts.paperLabel - Etiqueta del tamaño de papel
 * @param {Object} opts.flags - Banderas (progressive, guide, spreads, turn)
 * @param {boolean} opts.blank - Si tiene reverso en blanco
 * @returns {Object} Ficha bilingüe completa
 */
export function generateBilingualListing(opts) {
  const { theme = "adult", designs, pages, paperLabel, flags = {}, blank = true } = opts;

  // Obtener títulos bilingües
  const titles = BILINGUAL_TITLES[theme] || BILINGUAL_TITLES.adult;
  const selectedTitleEs = titles.es[0];
  const selectedTitleEn = titles.en[0];

  // Subtítulo
  const subtitleEs = flags.progressive
    ? `${designs} diseños de fácil a difícil, con guía paso a paso`
    : `${designs} diseños originales para relajarse y concentrarse`;
  const subtitleEn = flags.progressive
    ? `${designs} designs from easy to difficult, with step-by-step guide`
    : `${designs} original designs to relax and focus`;

  // Palabras clave (filtradas para no repetir palabras del título)
  const keywordsEs = filterKeywordsByTitle(KEYWORD_SUGGESTIONS[theme] || KEYWORD_SUGGESTIONS.adult, selectedTitleEs);
  const keywordsEn = filterKeywordsByTitle(KEYWORD_SUGGESTIONS_EN[theme] || KEYWORD_SUGGESTIONS_EN.adult, selectedTitleEn);

  // Categorías
  const categories = CATEGORY_SUGGESTIONS[theme] || CATEGORY_SUGGESTIONS.adult;

  // Descripción bilingüe
  const descriptionEs = generateDescription(opts, "es");
  const descriptionEn = generateDescription(opts, "en");

  return {
    title: { es: selectedTitleEs, en: selectedTitleEn },
    subtitle: { es: subtitleEs, en: subtitleEn },
    description: { es: descriptionEs, en: descriptionEn },
    keywords: { es: keywordsEs, en: keywordsEn },
    categories,
    attribution: { es: ATTRIBUTION_ES, en: ATTRIBUTION_EN },
  };
}

/**
 * Genera la descripción del libro en el idioma especificado.
 */
function generateDescription(opts, lang = "es") {
  const { theme = "adult", designs, pages, paperLabel, flags = {}, blank = true } = opts;

  const leads = {
    es: {
      adult: `${designs} ilustraciones originales para adultos: koi, colibrí, pluma, nautilus, rosa, lobo, pavo real y composiciones abstractas, llenas de patrones de líneas, curvas y círculos.`,
      glass: `${designs} diseños estilo vitral: cada figura y su fondo se dividen en piezas grandes y lisas, rápidas y relajantes de colorear.`,
      dino: `${designs} ilustraciones de criaturas prehistóricas: triceratops, estegosaurio, braquiosaurio, pterosaurio, plesiosaurio, amonite y más, cada una llena de patrones.`,
      bio: `${designs} ilustraciones de biología: neurona, cerebro, ADN, célula vegetal y animal, mitocondria, virus, bacteria, corazón, ojo y más, llenas de patrones para colorear.`,
      cryptids: `${designs} ilustraciones de criaturas legendarias del folclore: Pie Grande, Nessie, Mothman, kraken, yeti, ovni, Wendigo, jackalope y más.`,
      kids: `${designs} animales tiernos para colorear: búho, gato, oso, conejo, pingüino, zorro, ballena, tortuga y más, con zonas amplias para colorear.`,
      ocean: `${designs} criaturas marinas para colorear: tortuga, medusa, ballena, raya, pulpo, caballito de mar y más, llenas de patrones oceánicos.`,
      cats: `${designs} gatos con patrones para colorear: diferentes poses y razas, cada una llena de patrones relajantes para colorear.`,
      birds: `${designs} aves exóticas para colorear: colibrí, loro, águila, búho, pavo real, flamenco y más, llenas de patrones detallados.`,
      christmas: `${designs} diseños navideños para colorear: árboles, estrellas, adornos, regalos, renos y más, con patrones festivos relajantes.`,
    },
    en: {
      adult: `${designs} original illustrations for adults: koi, hummingbird, feather, nautilus, rose, wolf, peacock and abstract compositions, filled with patterns of lines, curves and circles.`,
      glass: `${designs} stained glass style designs: each figure and background divided into large, smooth pieces, quick and relaxing to color.`,
      dino: `${designs} prehistoric creature illustrations: triceratops, stegosaurus, brachiosaurus, pterosaur, plesiosaur, ammonite and more, each filled with patterns.`,
      bio: `${designs} biology illustrations: neuron, brain, DNA, plant and animal cells, mitochondria, virus, bacteria, heart, eye and more, filled with coloring patterns.`,
      cryptids: `${designs} legendary folklore creature illustrations: Bigfoot, Nessie, Mothman, kraken, yeti, UFO, Wendigo, jackalope and more.`,
      kids: `${designs} cute animals to color: owl, cat, bear, rabbit, penguin, fox, whale, turtle and more, with large areas to color.`,
      ocean: `${designs} sea creatures to color: turtle, jellyfish, whale, ray, octopus, seahorse and more, filled with ocean patterns.`,
      cats: `${designs} patterned cats to color: different poses and breeds, each filled with relaxing patterns to color.`,
      birds: `${designs} exotic birds to color: hummingbird, parrot, eagle, owl, peacock, flamingo and more, filled with detailed patterns.`,
      christmas: `${designs} Christmas designs to color: trees, stars, ornaments, gifts, reindeer and more, with relaxing festive patterns.`,
    },
  };

  const lead = leads[lang]?.[theme] || leads[lang]?.adult;

  const extras = [];
  if (flags.progressive) {
    extras.push(lang === "es"
      ? "• Dificultad progresiva: cada página indica su nivel (1 a 5) y tiempo aproximado."
      : "• Progressive difficulty: each page shows its level (1 to 5) and estimated time.");
  }
  if (flags.guide) {
    extras.push(lang === "es"
      ? "• Guía paso a paso al inicio, con recuadros para practicar y pasaporte para marcar los completados."
      : "• Step-by-step guide at the beginning, with practice boxes and passport to mark completed ones.");
  }
  if (blank) {
    extras.push(lang === "es"
      ? "• Impreso por una sola cara: reverso en blanco para que los rotuladores no traspasen."
      : "• Single-sided printing: blank back to prevent marker bleed-through.");
  }

  const parts = [
    lead,
    "",
    ...(lang === "es"
      ? ["• Figuras escondidas: busca animalitos y objetos en cada ilustración."]
      : ["• Hidden figures: find animals and objects in each illustration."]),
    ...extras,
    lang === "es"
      ? `• ${pages} páginas, tamaño ${paperLabel}.`
      : `• ${pages} pages, ${paperLabel} size.`,
  ];

  return parts.join("\n");
}

// ===================== TABLA DE REGALÍAS =====================

/**
 * Calcula la tabla de regalías para diferentes configuraciones de página y precio.
 * @param {number} pages - Número de páginas
 * @param {string} printType - Tipo de impresión: "blackWhite" | "colorPremium" | "colorStandard"
 * @param {string} channel - Canal: "amazon" | "expanded"
 * @returns {Array} Tabla de regalías con diferentes precios
 */
export function calculateRoyaltyTable(pages, printType = "blackWhite", channel = "amazon", trim = "large") {
  const printCost = printCostUsd(pages, printType, trim);
  // Sin tarifa verificada (color, canal expandido): no se inventan cifras.
  if (printCost === null) return [];

  // Precios sugeridos según el número de páginas
  const priceRange = pages < 80 ? SUGGESTED_PRICES.small : pages < 120 ? SUGGESTED_PRICES.medium : SUGGESTED_PRICES.large;

  const prices = [
    priceRange.min,
    (priceRange.min + priceRange.default) / 2,
    priceRange.default,
    (priceRange.default + priceRange.max) / 2,
    priceRange.max,
  ];

  return prices.map((price) => {
    const royalty = royaltyPerSaleUsd(price, printCost, channel);
    const margin = (royalty / price) * 100;
    return {
      price: price.toFixed(2),
      printCost: printCost.toFixed(2),
      royalty: royalty.toFixed(2),
      margin: margin.toFixed(1),
      rate: price < 9.99 ? "50%" : "60%",
    };
  });
}

/**
 * Genera el texto de la tabla de regalías para mostrar o exportar.
 */
export function formatRoyaltyTable(pages, printType = "blackWhite", channel = "amazon") {
  const printTypeLabel = {
    blackWhite: "B/N papel blanco",
    colorPremium: "Color prémium",
    colorStandard: "Color estándar",
  }[printType];
  const head = `TABLA DE REGALÍAS (${pages} páginas, ${printTypeLabel}, ${channel === "amazon" ? "Amazon.com" : "canal expandido"})`;
  if (channel !== "amazon" || printCostUsd(pages, printType) === null) {
    return [head, "=".repeat(60), "", `Sin tarifa verificada para esta combinación (${printTypeLabel}, ${channel}).`,
      "Consulta la calculadora de KDP antes de fijar el precio."].join("\n");
  }
  const table = calculateRoyaltyTable(pages, printType, channel);
  const minPrice = minPriceForPositiveRoyalty(printCostUsd(pages, printType), channel);

  const lines = [head, "=".repeat(64), "", "Precio USD | Impresión | Tarifa | Regalía | Margen %", "-".repeat(64)];
  table.forEach((row) => {
    lines.push(`$${row.price.padStart(7)} | $${row.printCost.padStart(7)} | ${row.rate.padStart(6)} | $${row.royalty.padStart(6)} | ${row.margin.padStart(6)}%`);
  });
  lines.push("");
  lines.push(`Precio mínimo para regalía positiva: $${minPrice.toFixed(2)}`);
  const c = KDP_PRINT_COSTS[printType];
  lines.push(`Impresión (tamaño grande): $${c.short.large.toFixed(2)} fijo con menos de 110 páginas; desde 110, $${c.fixedCost.toFixed(2)} + $${c.perPage.large}/página`);
  lines.push("Coste de impresión tomado de guías de terceros, sin confirmar en la página oficial de KDP.");
  lines.push("Regalía = tarifa × precio de lista − impresión (fórmula de KDP).");
  lines.push(`Tarifas consultadas el ${KDP_RATES_AS_OF}: comprueba la calculadora de KDP antes de publicar.`);
  return lines.join("\n");
}

// ===================== EXPORTAR FICHA COMPLETA =====================

/**
 * Genera el texto completo de la ficha bilingüe para copiar o exportar.
 */
export function generateFullListingText(opts) {
  const listing = generateBilingualListingListing(opts);
  const royaltyTable = formatRoyaltyTable(opts.pages, opts.printType || "blackWhite", opts.channel || "amazon");

  const lines = [
    "═══════════════════════════════════════════════════════════════",
    "FICHA BILINGÜE PARA KDP (ESPAÑOL / INGLÉS)",
    "═══════════════════════════════════════════════════════════════",
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "TÍTULO / TITLE",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "🇪🇸 ESPAÑOL:",
    `  ${listing.title.es}`,
    "",
    "🇺🇸 ENGLISH:",
    `  ${listing.title.en}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "SUBTÍTULO / SUBTITLE",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "🇪🇸 ESPAÑOL:",
    `  ${listing.subtitle.es}`,
    "",
    "🇺🇸 ENGLISH:",
    `  ${listing.subtitle.en}`,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "DESCRIPCIÓN / DESCRIPTION",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "🇪🇸 ESPAÑOL:",
    listing.description.es,
    "",
    "🇺🇸 ENGLISH:",
    listing.description.en,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "PALABRAS CLAVE (7 casillas, máx. 50 caracteres cada una)",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "🇪🇸 ESPAÑOL:",
    ...listing.keywords.es.map((kw, i) => `  ${i + 1}. ${kw} (${kw.length} caracteres)`),
    "",
    "🇺🇸 ENGLISH:",
    ...listing.keywords.en.map((kw, i) => `  ${i + 1}. ${kw} (${kw.length} caracteres)`),
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "CATEGORÍAS (3 categorías BISAC)",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    ...listing.categories.map((cat, i) => `  ${i + 1}. ${cat.code} - ${cat.name}`),
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "TABLA DE REGALÍAS",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    royaltyTable,
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "ATRIBUCIÓN / ATTRIBUTION",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "🇪🇸 ESPAÑOL:",
    `  ${listing.attribution.es}`,
    "",
    "🇺🇸 ENGLISH:",
    `  ${listing.attribution.en}`,
    "",
    "═══════════════════════════════════════════════════════════════",
    "RECUERDA:",
    "  ✓ No uses «Zentangle», «Zendala» en título, subtítulo ni palabras clave",
    "  ✓ «Zentangle®» solo en la descripción como atribución",
    "  ✓ Valida las medidas de portada con la calculadora de KDP",
    "═══════════════════════════════════════════════════════════════",
  ];

  return lines.join("\n");
}

// Alias para mantener compatibilidad
export function generateBilingualListingListing(opts) {
  return generateBilingualListing(opts);
}

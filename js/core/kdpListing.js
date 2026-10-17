// kdpListing.js
// Texto para la ficha de KDP (título, descripción, palabras clave) que respeta
// la propiedad intelectual:
//   - Sin «Zentangle» en título, subtítulo ni palabras clave: es marca
//     registrada de Zentangle, Inc. y no se puede sugerir un producto oficial.
//     Solo aparece en la descripción, con ® y como frase de atribución.
//   - Sin «Zendoodle», «Zendala» ni otros nombres de series o marcas ajenas
//     (Zendala es marca de Zentangle, Inc.; «Zendoodle Coloring» es una serie
//     de otra editorial).
//   - Todo el arte lineal es original de la app; nada se copia de otros libros.

// Palabras que nunca deben ir en título, subtítulo ni palabras clave.
export const BLOCKED_TERMS = ["zentangle", "zendala", "zendoodle", "czt", "certified zentangle", "bijou", "zentomology"];

export const containsBlocked = (text) => BLOCKED_TERMS.find((t) => String(text).toLowerCase().includes(t)) || null;

export const ATTRIBUTION_ES = "Inspirado en el método Zentangle® de dibujo de patrones. Zentangle® es una marca registrada de Zentangle, Inc. (zentangle.com); este libro no es un producto oficial ni está afiliado a la empresa.";
export const ATTRIBUTION_EN = "Inspired by the Zentangle® Method of pattern drawing.";

export function kdpListing({ designs, pages, paperLabel = "8.5×11 in", flags = {}, spreads = 0, turnPages = 0, blank = true }) {
  const titles = [
    "Figuras con patrones: libro para colorear para adultos",
    "Patrones intrincados para colorear: búhos, gatos, mariposas y más",
    "Doodle Art para colorear: figuras llenas de patrones",
  ];
  const subtitle = flags.progressive
    ? `${designs} diseños de fácil a difícil, con guía paso a paso de patrones`
    : `${designs} diseños originales para relajarse y concentrarse`;
  const extras = [];
  if (flags.progressive) extras.push("• Dificultad progresiva: cada página indica su nivel (1 a 5) y un tiempo aproximado.");
  if (flags.guide) extras.push("• Guía paso a paso al inicio, de patrones básicos a avanzados, con recuadros para practicar y un pasaporte para marcar los que ya coloreaste.");
  if (spreads) extras.push(`• ${spreads} ilustraciones a doble página que continúan de una página a la otra.`);
  if (turnPages) extras.push(`• ${turnPages} página${turnPages > 1 ? "s" : ""} «Tu turno» para dibujar tus propios patrones.`);
  const description = [
    `${designs} ilustraciones originales para colorear: figuras grandes (búho, gato, pez, mariposa, tortuga, flor, hoja, corazón) llenas de patrones de líneas, curvas y círculos, más mandalas y composiciones geométricas.`,
    "",
    blank
      ? "• Impreso por una sola cara: cada diseño lleva el reverso en blanco para que los rotuladores no traspasen."
      : "• Diseños por ambas caras en papel grueso, sin hojas en blanco: más ilustraciones por libro. Con rotuladores al agua, prueba antes en una esquina.",
    "• Líneas limpias, sin rellenos negros: espacio para lápices, rotuladores o gel.",
    ...extras,
    `• ${pages} páginas, tamaño ${paperLabel}.`,
    "",
    ATTRIBUTION_ES,
  ].join("\n");
  const keywords = [
    "libro para colorear adultos patrones",
    "doodle art para colorear",
    "mandalas y figuras para colorear",
    "colorear para relajarse antiestrés",
    "patrones intrincados animales",
    "aprender a dibujar patrones paso a paso",
    "libro colorear dificultad progresiva",
  ];
  return { titles, subtitle, description, keywords };
}

export function kdpListingText(opts) {
  const l = kdpListing(opts);
  return [
    "FICHA PARA KDP (revisa antes de publicar)",
    "========================================",
    "",
    "TÍTULO (elige uno):",
    ...l.titles.map((t) => `  - ${t}`),
    "",
    `SUBTÍTULO: ${l.subtitle}`,
    "",
    "DESCRIPCIÓN:",
    l.description,
    "",
    "PALABRAS CLAVE (7 casillas de KDP):",
    ...l.keywords.map((k) => `  - ${k}`),
    "",
    "REGLAS DE PROPIEDAD INTELECTUAL",
    "  ✓ No pongas «Zentangle», «Zendala» ni el logotipo en el título, el subtítulo, la portada ni las palabras clave.",
    "  ✓ «Zentangle®» solo en la descripción y en la página «Antes de empezar», como atribución.",
    "  ✓ Evita «Zendoodle»: es el nombre de una serie de libros de otra editorial.",
    "  ✓ No escanees ni copies páginas o «paso a paso» de otros libros o artistas: todo el arte de este libro lo genera la app.",
    "  ✓ Los patrones con autor individual no verificado llevan nombres propios del libro (Anillos, Cubos, Perlas en ondas, Rombos en red, Escamas).",
    "  ✓ Ante la duda, escribe a Zentangle, Inc. (zentangle.com) o consulta a un abogado de propiedad intelectual.",
  ].join("\n");
}

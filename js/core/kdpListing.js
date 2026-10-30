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

// content: "figures" (solo figuras), "mixed" (figuras + mandalas y otros) u
// "other" (estilos sin figuras). noBlack: ningún diseño tiene rellenos negros.
export function kdpListing({ designs, pages, paperLabel = "8.5×11 in", flags = {}, spreads = 0, turnPages = 0, blank = true, content = "mixed", noBlack = true }) {
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
  if (spreads) extras.push(spreads === 1 ? "• 1 ilustración a doble página que continúa de una página a la otra." : `• ${spreads} ilustraciones a doble página que continúan de una página a la otra.`);
  if (turnPages) extras.push(`• ${turnPages} página${turnPages > 1 ? "s" : ""} «Tu turno» para dibujar tus propios patrones.`);
  const description = [
    content === "other"
      ? `${designs} ilustraciones originales para colorear, llenas de patrones de líneas, curvas y círculos.`
      : `${designs} ilustraciones originales para colorear: figuras grandes (búho, gato, oso, conejo, zorro, pingüino, elefante, ballena, mariposa, flor y más) llenas de patrones de líneas, curvas y círculos${content === "mixed" ? ", más mandalas y composiciones geométricas" : ""}.`,
    "",
    ...(content === "other" ? [] : ["• Figuras escondidas: en cada ilustración de figura se esconden animalitos y objetos para buscar (el pie de página dice cuántos)."]),
    blank
      ? "• Impreso por una sola cara: cada diseño lleva el reverso en blanco para que los rotuladores no traspasen."
      : "• Diseños por ambas caras en papel grueso, sin hojas en blanco: más ilustraciones por libro. Con rotuladores al agua, prueba antes en una esquina.",
    noBlack ? "• Líneas limpias, sin rellenos negros: espacio para lápices, rotuladores o gel." : "• Líneas limpias con algunos detalles en negro.",
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

// Medidas de la portada completa (contraportada + lomo + portada) para tapa
// blanda en KDP. Grosor por página según el papel: blanco B/N 0.002252",
// color prémium 0.002347". Sangrado de portada: 0.125" por lado. KDP solo
// admite texto en el lomo con más de 79 páginas.
export const SPINE_IN_PER_PAGE = { white: 0.002252, premium: 0.002347 };
export function coverSpec({ pages, trimWmm, trimHmm, paper = "white" }) {
  const IN = 25.4, bleed = 0.125;
  const spineIn = pages * (SPINE_IN_PER_PAGE[paper] ?? SPINE_IN_PER_PAGE.white);
  const wIn = bleed + trimWmm / IN + spineIn + trimWmm / IN + bleed;
  const hIn = bleed + trimHmm / IN + bleed;
  const r = (x, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
  return {
    paper, spineIn: r(spineIn), spineMm: r(spineIn * IN, 1),
    widthIn: r(wIn), heightIn: r(hIn), widthMm: r(wIn * IN, 1), heightMm: r(hIn * IN, 1),
    widthPx: Math.ceil(wIn * 300), heightPx: Math.ceil(hIn * 300),
    spineText: pages > 79,
  };
}

export function kdpListingText(opts) {
  const l = kdpListing(opts);
  const cover = opts.trimWmm && opts.trimHmm ? coverSpec({ pages: opts.pages, trimWmm: opts.trimWmm, trimHmm: opts.trimHmm, paper: opts.blank === false ? "premium" : "white" }) : null;
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
    `FRASE OFICIAL EN INGLÉS (si publicas también en Amazon.com en inglés): ${ATTRIBUTION_EN}`,
    "",
    "PALABRAS CLAVE (7 casillas de KDP):",
    ...l.keywords.map((k) => `  - ${k}`),
    "",
    ...(cover ? [
      `PORTADA (tapa blanda, ${opts.pages} páginas, papel ${cover.paper === "premium" ? "color prémium" : "blanco, tinta B/N"}):`,
      `  - Lomo: ${cover.spineIn} in (${cover.spineMm} mm)${cover.spineText ? "" : " · sin texto en el lomo: KDP lo exige con más de 79 páginas"}`,
      `  - Portada completa con sangrado: ${cover.widthIn} × ${cover.heightIn} in (${cover.widthMm} × ${cover.heightMm} mm) · ${cover.widthPx} × ${cover.heightPx} px a 300 ppp`,
      "  - Confirma las medidas con la plantilla oficial de KDP (Cover Calculator) antes de subirla: el lomo cambia si añades o quitas páginas.",
      "",
    ] : []),
    "REGLAS DE PROPIEDAD INTELECTUAL",
    "  ✓ No pongas «Zentangle», «Zendala» ni el logotipo en el título, el subtítulo, la portada ni las palabras clave.",
    "  ✓ «Zentangle®» solo en la descripción y en la página «Antes de empezar», como atribución.",
    "  ✓ Evita «Zendoodle»: es el nombre de una serie de libros de otra editorial.",
    "  ✓ No escanees ni copies páginas o «paso a paso» de otros libros o artistas: todo el arte de este libro lo genera la app.",
    "  ✓ Los patrones con autor individual no verificado llevan nombres propios del libro (Anillos, Cubos, Perlas en ondas, Rombos en red, Escamas).",
    "  ✓ Ante la duda, escribe a Zentangle, Inc. (zentangle.com) o consulta a un abogado de propiedad intelectual.",
  ].join("\n");
}

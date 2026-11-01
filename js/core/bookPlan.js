// bookPlan.js
// Orden de las páginas del libro. En KDP la página 1 es una página derecha
// (recto): índice 0, 2, 4… = derecha; 1, 3, 5… = izquierda (verso).
//
// Unidades de diseño: { kind: "single" } o { kind: "spread" } (doble página).
// Con `blank` (libro de una cara) cada diseño va a la derecha con su reverso en
// blanco; la doble página va en verso + recto y sus dos reversos quedan en
// blanco, así nada traspasa sobre otro diseño.
//
// Secuencia: [{ type: "design"|"spreadL"|"spreadR"|"guide"|"passport"|"turn", i }, null = página en blanco]

// Una doble página cada `every` diseños (nunca la primera: abre el libro un
// diseño de una sola página).
export function designUnits(n, { spreads = false, every = 8 } = {}) {
  return Array.from({ length: n }, (_, i) => ({ kind: spreads && n >= 4 && i % every === Math.min(4, every - 1) ? "spread" : "single" }));
}

export function planSequence(units, { blank = true, guidePages = 0, passport = false, turnPages = 0, frontMatterPages = 0, hiddenSolutions = false } = {}) {
  const seq = [];
  const isRecto = () => seq.length % 2 === 0;
  const toRecto = () => { if (!isRecto()) seq.push(null); };
  const toVerso = () => { if (isRecto()) seq.push(null); };
  const single = (entry) => {
    if (blank) { toRecto(); seq.push(entry); seq.push(null); } else seq.push(entry);
  };
  // Front matter abre el libro (portada, copyright, pertenece a, prueba de color).
  // Son páginas de texto: no necesitan reverso en blanco (excepto copyright que va en verso).
  for (let k = 0; k < frontMatterPages; k++) seq.push({ type: "frontMatter", i: k });
  // La guía abre el libro (se ve en «Leer muestra» de Amazon): es lo que
  // distingue al libro. Son páginas de texto: no necesitan reverso en blanco.
  for (let k = 0; k < guidePages; k++) seq.push({ type: "guide", i: k });
  // Sin hojas en blanco, una doble página que caería en página derecha espera
  // al siguiente diseño simple (así no hace falta meter una página en blanco).
  const pending = [];
  const spread = (i) => {
    if (blank) { toRecto(); seq.push(null); } // reverso en blanco de la izquierda
    toVerso();
    seq.push({ type: "spreadL", i }, { type: "spreadR", i });
    if (blank) seq.push(null);
  };
  units.forEach((u, i) => {
    if (u.kind === "spread") {
      if (!blank && isRecto()) pending.push(i); else spread(i);
      return;
    }
    single({ type: "design", i });
    while (!blank && pending.length && !isRecto()) spread(pending.shift());
  });
  pending.forEach(spread);
  if (passport) { if (blank) toRecto(); seq.push({ type: "passport", i: 0 }); if (blank) seq.push(null); }
  // Página de soluciones de figuras escondidas (antes de "Tu turno")
  if (hiddenSolutions) { if (blank) toRecto(); seq.push({ type: "hiddenSolutions", i: 0 }); if (blank) seq.push(null); }
  for (let k = 0; k < turnPages; k++) single({ type: "turn", i: k });
  // Sin páginas en blanco sobrantes al final.
  while (seq.length && seq[seq.length - 1] === null) seq.pop();
  return seq;
}

// Dificultad del diseño i (0 fácil … 1 difícil) en un libro progresivo.
export const difficultyAt = (i, n) => (n <= 1 ? 0.5 : i / (n - 1));

// Margen interior (lomo) mínimo de KDP en tapa blanda, en mm, según el número
// de páginas: 0.375" hasta 150, 0.5" hasta 300, 0.625" hasta 500, 0.75" hasta
// 700 y 0.875" hasta 828.
export function kdpInsideMarginMm(pages) {
  const inches = pages <= 150 ? 0.375 : pages <= 300 ? 0.5 : pages <= 500 ? 0.625 : pages <= 700 ? 0.75 : 0.875;
  // Redondeo hacia arriba: el mínimo nunca debe quedar corto.
  return Math.ceil(inches * 254 - 1e-9) / 10;
}

// Opciones de pantalla que nunca deben llegar a una página impresa: las guías
// de zona segura (líneas rojas), la textura de papel y el sombreado (grises
// que ensucian el coloreado). Pueden venir activadas desde la URL o los
// ajustes finos; el libro y las descargas de página las apagan siempre.
export const printSafeOpts = (opts = {}) => ({ ...opts, showSafeZone: false, paperTextureEnabled: false, cellShadowEnabled: false });

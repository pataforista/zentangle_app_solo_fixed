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

export function planSequence(units, { blank = true, guidePages = 0, passport = false, turnPages = 0 } = {}) {
  const seq = [];
  const isRecto = () => seq.length % 2 === 0;
  const toRecto = () => { if (!isRecto()) seq.push(null); };
  const toVerso = () => { if (isRecto()) seq.push(null); };
  const single = (entry) => {
    if (blank) { toRecto(); seq.push(entry); seq.push(null); } else seq.push(entry);
  };
  // La guía abre el libro (se ve en «Leer muestra» de Amazon): es lo que
  // distingue al libro. Son páginas de texto: no necesitan reverso en blanco.
  for (let k = 0; k < guidePages; k++) seq.push({ type: "guide", i: k });
  units.forEach((u, i) => {
    if (u.kind !== "spread") return single({ type: "design", i });
    if (blank) { toRecto(); seq.push(null); } // reverso en blanco de la izquierda
    toVerso();
    seq.push({ type: "spreadL", i }, { type: "spreadR", i });
    if (blank) seq.push(null);
  });
  if (passport) { toRecto(); seq.push({ type: "passport", i: 0 }); if (blank) seq.push(null); }
  for (let k = 0; k < turnPages; k++) single({ type: "turn", i: k });
  // Sin páginas en blanco sobrantes al final.
  while (seq.length && seq[seq.length - 1] === null) seq.pop();
  return seq;
}

// Dificultad del diseño i (0 fácil … 1 difícil) en un libro progresivo.
export const difficultyAt = (i, n) => (n <= 1 ? 0.5 : i / (n - 1));

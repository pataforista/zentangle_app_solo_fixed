// bookSeeds.js
// Semillas de las páginas de un libro. Viven aquí (no en app.js) para que la
// app, las pruebas y la auditoría de libros (_samples/bookAudit.mjs) generen
// exactamente las mismas páginas.

// Semilla de la página i: la del libro + el índice.
export const bookPageSeed = (base, i) => ((base >>> 0) + Math.imul(i, 0x9e3779b1)) >>> 0;

// Semilla del reemplazo número `tries` de la página i. tries = 0 es la semilla
// original del libro (misma semilla = mismo libro); los reemplazos derivan de ella.
export const pageSeed = (base, i, tries) => {
  const s0 = bookPageSeed(base, i);
  return tries ? (Math.imul(s0 ^ (tries * 0x85ebca6b), 0xc2b2ae35) ^ (tries + 0x27d4eb2f)) >>> 0 : s0;
};

// Figura de la n-ésima doble página del libro: del repertorio del estilo (un
// libro de dinosaurios no lleva mariposas) y en orden, para no repetirse seguidas.
export function spreadFigureFor(themeFigs, spreadFigures, baseSeed, nth) {
  const wide = themeFigs ? spreadFigures.filter((f) => themeFigs.includes(f)) : spreadFigures;
  const pool = wide.length ? wide : themeFigs;
  return pool[(nth + (baseSeed >>> 0)) % pool.length];
}

// Nº de páginas simples antes del diseño i: las dobles páginas llevan sus
// propias figuras y no deben saltarse figuras del repertorio de las simples
// (con una doble cada 8 diseños, un libro de 40 dejaba fuera 2 de 28 figuras).
export const singlesBefore = (units, i) => units.slice(0, i).filter((u) => u.kind !== "spread").length;

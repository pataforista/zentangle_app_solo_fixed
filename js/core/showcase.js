// showcase.js
// Modo escaparate (R24): las mejores páginas van al principio, que es lo que se ve en
// «Leer muestra». Función pura (sin navegador) para poder probarla.

// Puntuación de composición de una página: cobertura de la figura y contraste figura/fondo.
export function showcaseScore(q = {}) {
  const coverage = q.coverage ?? 0;
  const contrast = q.contrast ?? 0;
  const normalizedContrast = Math.max(0, Math.min(1, (contrast + 0.5) / 1.5));
  return coverage * 0.6 + normalizedContrast * 0.4;
}

// items: [{ score, pinned }] en el orden actual. Devuelve el nuevo orden como índices
// del orden actual.
//  - Las `count` mejores páginas libres pasan al principio (las más puntuadas primero).
//  - Las páginas fijadas (📌) no se mueven.
//  - El resto conserva su orden (no se mezcla: así siguen sin figuras vecinas repetidas).
//  - windowFraction < 1 limita de dónde se eligen las mejores (libros con dificultad
//    progresiva: solo del primer tercio, para no adelantar páginas difíciles).
export function showcaseOrder(items, { count = 4, windowFraction = 1 } = {}) {
  const n = items.length;
  const free = [];
  for (let i = 0; i < n; i++) if (!items[i].pinned) free.push(i);
  const windowSize = Math.max(Math.min(count, free.length), Math.ceil(n * windowFraction));
  const candidates = free.filter((i) => i < windowSize);
  const top = [...candidates].sort((a, b) => items[b].score - items[a].score || a - b).slice(0, Math.min(count, candidates.length));
  const topSet = new Set(top);
  const ordered = [...top, ...free.filter((i) => !topSet.has(i))];
  const out = Array.from({ length: n }, (_, i) => i);
  free.forEach((slot, k) => { out[slot] = ordered[k]; });
  return out;
}

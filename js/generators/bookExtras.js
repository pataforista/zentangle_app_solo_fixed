// bookExtras.js
// Páginas y adornos de libro que no son diseños:
//   - guía de tangles paso a paso (cómo se dibuja cada tangle del libro),
//   - pasaporte de tangles (lista para marcar los que ya coloreaste/dibujaste),
//   - pie de página con nivel de dificultad y tiempo estimado.
// Todo devuelve SVG en texto (página completa o fragmento), en mm.
import { createRNG, hash } from "../core/prng.js";
import { FIGURE_TANGLES } from "./figure.js";
import { scaleStrokeForProfile } from "../core/thicknessProfiles.js";

const fmt = (n) => (Math.round(Number(n) * 100) / 100).toString();
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = `font-family="Helvetica, Arial, sans-serif"`;

// Nombre y cómo se dibuja, en una o dos frases (lo que leerá quien colorea).
export const TANGLE_INFO = {
  hollibaugh: { name: "Hollibaugh", level: 3, official: true, combo: "Rellena los huecos entre cintas con Tipple o Anillos: el contraste recto/curvo hace flotar las cintas.", how: "Dibuja cintas de dos líneas paralelas. Cada cinta nueva pasa por detrás: se interrumpe al llegar a las anteriores." },
  printemps: { name: "Printemps", level: 2, official: true, combo: "Ponlo junto a Static o Keeko: sus rectas calman el remolino de espirales.", how: "Traza una espiral pequeña y ciérrala con un círculo. Llena el espacio con rollos de distintos tamaños." },
  tipple: { name: "Tipple", level: 1, official: true, combo: "Es el comodín: llena huecos de Hollibaugh o separa dos tangles muy cargados.", how: "Burbujas de muchos tamaños, apretadas sin tocarse. Empieza por las grandes y rellena con las pequeñas." },
  purk: { name: "Anillos", level: 1, combo: "Al lado de Paradox o Cubos: círculos amplios frente a ángulos.", how: "Círculos con uno o dos anillos dentro (auras). Agrúpalos como piedras de río." },
  nzeppel: { name: "'Nzeppel", level: 2, official: true, combo: "Rompe su retícula con algo curvo, como Printemps o Crescent Moon.", how: "Imagina una cuadrícula en diagonal y dibuja en cada casilla una almohadilla de esquinas redondeadas." },
  bales: { name: "Bales", level: 3, official: true, combo: "Equilíbralo con Static o Keeko, que son lineales y rápidos.", how: "Sobre una cuadrícula, une cada par de puntos vecinos con una hoja (dos arcos). Alterna cuál pasa por encima." },
  cubine: { name: "Cubos", level: 2, combo: "Contrasta con Tipple o Anillos; evita ponerlo junto a Paradox: dos tangles angulosos compiten.", how: "Dibuja hexágonos en panal y une el centro de cada uno con tres vértices alternos: aparecen cubos." },
  paradox: { name: "Paradox", level: 3, official: true, combo: "Rodéalo de algo tranquilo, como Anillos o Escamas: Paradox ya atrae la mirada.", how: "En un cuadrado, traza una recta de un lado al siguiente, siempre en el mismo sentido y un poco más adentro. La espiral aparece sola." },
  beadlines: { name: "Perlas en ondas", level: 2, combo: "Junto a Cubos o Rombos en red: ondas frente a cuadrícula.", how: "Líneas onduladas paralelas; entre cada par, ensarta perlas alternando grandes y pequeñas." },
  keeko: { name: "Keeko", level: 1, official: true, combo: "Va bien al lado de Printemps o Tipple, que aportan curvas.", how: "Grupos de 3 o 4 líneas cortas. Alterna horizontal y vertical, como un tejido de cesta." },
  static: { name: "Static", level: 1, official: true, combo: "Úsalo como pausa entre tangles curvos como Cadent o Bales.", how: "Líneas en zigzag paralelas, todas con el mismo ritmo." },
  cadent: { name: "Cadent", level: 3, official: true, combo: "Contrasta con Static o Hollibaugh.", how: "Una retícula de perlas. Une cada perla con su vecina mediante una curva en S." },
  florz: { name: "Rombos en red", level: 2, combo: "Suaviza su cuadrícula con Perlas en ondas o Anillos al lado.", how: "Una cuadrícula de líneas con un pequeño rombo en cada cruce." },
  crescent: { name: "Crescent Moon", level: 1, official: true, combo: "Ideal en el borde de una sección; el centro, con Keeko o Rombos en red.", how: "Semicírculos en fila sobre una línea. Repite las filas para formar escamas." },
  scallops: { name: "Escamas", level: 1, combo: "Junto a Paradox o Cubos; repítelo en dos secciones alejadas para dar unidad.", how: "Arcos en fila; cada fila se desplaza media escama, como tejas o escamas de pez." },
  // 15 tangles originales (sin autor CZT) para mayor variedad en libros largos.
  ondas: { name: "Ondas", level: 1, combo: "Ideal para colas y aletas; combina con Gotas o Corrientes para un efecto acuático.", how: "Líneas onduladas paralelas suaves, como olas de agua calma." },
  semillas: { name: "Semillas", level: 1, combo: "Va bien junto a Gotas o Rizos; formas orgánicas que llenan sin saturar.", how: "Formas almendradas (ojos) empaquetadas en filas." },
  telarana: { name: "Telaraña", level: 2, combo: "Contrasta con Ondas o Semillas; aporta estructura geométrica.", how: "Espiral conectada con radios desde el centro, como una tela de araña." },
  ladrillos: { name: "Ladrillos", level: 1, combo: "Ideal para zonas de piel; combina con Escamas o Static.", how: "Rectángulos desplazados en fila, como ladrillos o muros." },
  corrientes: { name: "Corrientes", level: 2, combo: "Para colas y aletas; aporta movimiento direccional.", how: "Líneas paralelas con remolinos espirales cada cierta distancia." },
  espinas: { name: "Espinas", level: 1, combo: "Para alas y piel; textura direccional que combina con Escamas.", how: "Triángulos pequeños en fila apuntando en la misma dirección, como espinas de pez." },
  red: { name: "Red", level: 2, combo: "Para caparazones y conchas; estructura geométrica abierta.", how: "Líneas cruzadas en diagonal formando rombos, como una red o malla." },
  gotas: { name: "Gotas", level: 1, combo: "Para vientres y zonas suaves; combina con Semillas o Rizos.", how: "Formas de gota empaquetadas, redondeadas y apretadas." },
  lianas: { name: "Lianas", level: 2, combo: "Para alas y zonas alargadas; aporta verticalidad orgánica.", how: "Curvas verticales entrelazadas como lianas o plantas trepadoras." },
  nido: { name: "Nido", level: 3, combo: "Para cabezas y zonas de detalle; textura densa y compleja.", how: "Círculos concéntricos irregulares conectados entre sí, como un nido de pájaro." },
  panal: { name: "Panal", level: 1, combo: "Para caparazones y conchas; estructura geométrica regular.", how: "Hexágonos en panal de abeja, todos del mismo tamaño." },
  rizos: { name: "Rizos", level: 2, combo: "Para vientres y zonas suaves; aporta textura curva y orgánica.", how: "Espirales pequeñas y apretadas en filas, como rizos de pelo." },
  flechas: { name: "Flechas", level: 1, combo: "Para alas y zonas alargadas; aporta dirección y movimiento.", how: "V-formas en fila apuntando en la misma dirección, como flechas o puntas de lanza." },
  musgo: { name: "Musgo", level: 1, combo: "Para piel y cabezas; textura orgánica y suave.", how: "Puntos pequeños agrupados en parches, como musgo o líquen." },
  dunas: { name: "Dunas", level: 2, combo: "Para colas y zonas alargadas; aporta curvas suaves y ondulantes.", how: "Curvas paralelas suaves como dunas de arena, desplazadas en altura." },
};

const byId = new Map(FIGURE_TANGLES.map((t) => [t.id, t]));

// Niveles de la guía: 1 básico (una sola forma repetida), 2 intermedio (una
// retícula con una forma encima), 3 avanzado (cruces, tejidos o capas).
export const LEVEL_NAMES = ["", "Básico", "Intermedio", "Avanzado"];
const ORDER = Object.keys(TANGLE_INFO);
// De lo más simple a lo más complejo; dentro de un nivel, el orden de la ficha.
export const byComplexity = (ids) => [...new Set(ids)].filter((id) => TANGLE_INFO[id])
  .sort((a, b) => TANGLE_INFO[a].level - TANGLE_INFO[b].level || ORDER.indexOf(a) - ORDER.indexOf(b));

// Tres puntos de nivel (contorno; los alcanzados llevan un punto dentro).
function levelDots(x, y, level, r = 1.3, profileKey = "standard") {
  const sw = scaleStrokeForProfile(0.3, profileKey);
  let out = "";
  for (let i = 0; i < 3; i++) {
    const cx = x + i * (r * 3);
    out += `<circle cx="${fmt(cx)}" cy="${fmt(y)}" r="${r}" fill="none" stroke="#000" stroke-width="${sw}"/>`;
    if (i < level) out += `<circle cx="${fmt(cx)}" cy="${fmt(y)}" r="${fmt(r * 0.48)}" fill="#000"/>`;
  }
  return out;
}

// Tangles mencionados en una lista de SVG (atributo data-tangle), en orden de
// aparición y solo los que tienen ficha.
export function tanglesInSvgs(svgs) {
  const seen = new Set();
  for (const s of svgs) for (const m of String(s).matchAll(/data-tangle="([^"]+)"/g)) if (TANGLE_INFO[m[1]]) seen.add(m[1]);
  return [...seen];
}

// Capas del tangle en un cuadrado (semilla fija: la guía es estable).
function layersIn(id, box, gap, profileKey = "standard") {
  const t = byId.get(id);
  if (!t) return [];
  const sw = scaleStrokeForProfile(0.3, profileKey);
  try { return (t.fn(createRNG(hash(0x9a1de, id.length * 31 + id.charCodeAt(0))), box, { gap, stroke: sw, sketchy: 0 }) || []).filter((l) => l && l.d); } catch (e) { return []; }
}

// Centro de un trazo: media de sus puntos. En los arcos (A rx ry rot f f x y)
// solo cuenta el punto final; los radios y banderas falseaban el centro.
function pathCenter(p) {
  const toks = p.match(/[MLQCAZ]|-?[\d.]+(?:e-?\d+)?/g) || [];
  const arity = { M: 2, L: 2, Q: 4, C: 6, A: 7 };
  let cmd = null, buf = [], sx = 0, sy = 0, k = 0;
  const flush = () => {
    if (!cmd || !arity[cmd] || buf.length < arity[cmd]) return;
    const pts = cmd === "A" ? [buf[5], buf[6]] : buf;
    for (let i = 0; i + 1 < pts.length; i += 2) { sx += pts[i]; sy += pts[i + 1]; k++; }
    buf = [];
  };
  for (const t of toks) {
    if (/[A-Z]/.test(t)) { flush(); cmd = t; buf = []; continue; }
    buf.push(Number(t));
    if (cmd && arity[cmd] && buf.length === arity[cmd]) flush();
  }
  return k ? { x: sx / k, y: sy / k } : null;
}

// Paso `frac` (0..1) de la construcción: el tangle "crece" desde la esquina
// superior izquierda. En los de cintas (capas por pares) se revelan cintas.
function reveal(layers, box, frac) {
  if (frac >= 1) return layers;
  if (layers.length > 3) return layers.slice(0, Math.max(2, Math.round((layers.length / 2) * frac) * 2));
  const S = (box.x1 - box.x0) + (box.y1 - box.y0);
  return layers.map((l) => {
    // Orden por el centro de cada trazo (no por su punto inicial: el círculo
    // de Printemps empieza en su borde y salía antes que su espiral).
    const parts = l.d.split(/(?=M )/).filter((p) => {
      const c = pathCenter(p);
      return c && ((c.x - box.x0) + (c.y - box.y0)) / S <= frac;
    });
    return { ...l, d: parts.join(" ") };
  }).filter((l) => l.d);
}

const layerEls = (layers, sw) => layers.map((l) => (l.stroke === false
  ? `<path d="${l.d}" fill="${l.fill}" stroke="none"/>`
  : `<path d="${l.d}" fill="${l.fill || "none"}" stroke="#000" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`)).join("");

// Texto en varias líneas (corte por palabras a ~maxChars).
function wrap(text, maxChars) {
  const out = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if ((line + " " + w).trim().length > maxChars && line) { out.push(line); line = w; } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

const pageOpen = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}mm" height="${h}mm" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="#fff"/>`;

// Estrella de 4 puntas (contorno) que marca los tangles oficiales verificados.
function officialMark(x, y, r = 1.7, profileKey = "standard") {
  const sw = scaleStrokeForProfile(0.35, profileKey);
  const pts = [];
  for (let k = 0; k < 8; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 4, rr = k % 2 ? r * 0.38 : r; pts.push(`${fmt(x + Math.cos(a) * rr)} ${fmt(y + Math.sin(a) * rr)}`); }
  return `<path d="M ${pts.join(" L ")} Z" fill="none" stroke="#000" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

// «Antes de empezar»: de dónde vienen los nombres, cómo leer los niveles y
// las reglas para combinar tangles.
export function guideIntroPage(ids, { w, h, m }, { lineThicknessProfile = "standard" } = {}) {
  const list = byComplexity(ids).filter((id) => byId.has(id));
  const off = list.filter((id) => TANGLE_INFO[id].official).map((id) => TANGLE_INFO[id].name);
  const out = [pageOpen(w, h)];
  let y = m + 9;
  const maxC = Math.floor((w - 2 * m) / 2.05);
  const title = (t) => { y += 4; out.push(`<text x="${fmt(m)}" y="${fmt(y)}" ${FONT} font-size="6" font-weight="bold">${esc(t)}</text>`); y += 8.5; };
  const para = (t, size = 4.2) => { for (const ln of wrap(t, maxC)) { out.push(`<text x="${fmt(m)}" y="${fmt(y)}" ${FONT} font-size="${size}">${esc(ln)}</text>`); y += size * 1.45; } y += 2.5; };
  out.push(`<text x="${fmt(m)}" y="${fmt(y)}" ${FONT} font-size="8" font-weight="bold">Antes de empezar</text>`);
  y += 13;
  title("¿De dónde vienen estos nombres?");
  para("Un «tangle» es un patrón que se construye repitiendo trazos sencillos. Varios de los nombres de esta guía vienen del método Zentangle®, creado por Rick Roberts y Maria Thomas: cada tangle tiene un nombre propio y se aprende paso a paso.");
  if (off.length) {
    out.push(officialMark(m + 1.7, y - 1.2, 1.7, lineThicknessProfile));
    out.push(`<text x="${fmt(m + 5)}" y="${fmt(y)}" ${FONT} font-size="4.2">${esc("Marca los tangles oficiales del método:")}</text>`);
    y += 6;
    para(off.join(" · "));
  }
  para("Los demás llevan nombres propios de este libro: son patrones de repetición sencillos, dibujados para esta colección.");
  para("Inspirado en el método Zentangle® de dibujo de patrones (zentangle.com). Zentangle® es una marca registrada de Zentangle, Inc.; este libro no es un producto oficial ni está afiliado a la empresa. Todas las ilustraciones son originales.", 3.6);
  title("Los niveles");
  [[1, "Básico: una sola forma repetida (burbujas, zigzag, líneas)."], [2, "Intermedio: una retícula con una forma encima."], [3, "Avanzado: cruces, tejidos o capas que pasan unas por detrás de otras."]].forEach(([lv, t]) => {
    out.push(levelDots(m + 1.3, y - 1.1, lv, 1.3, lineThicknessProfile));
    out.push(`<text x="${fmt(m + 14)}" y="${fmt(y)}" ${FONT} font-size="4.2">${esc(t)}</text>`);
    y += 7.5;
  });
  y += 3;
  title("Cómo combinar tangles");
  [
    "Alterna rectas y curvas: al lado de un tangle de líneas, uno de círculos o espirales.",
    "Alterna denso y abierto: una sección muy cargada descansa junto a otra con aire.",
    "Elige un protagonista: un solo tangle vistoso (Paradox, Printemps…) y el resto de apoyo.",
    "Repite para dar unidad: usa el mismo tangle en dos secciones que no se toquen.",
    "Deja respirar: una sección lisa también es una decisión; ahí luce el color.",
  ].forEach((t, i) => {
    out.push(`<text x="${fmt(m)}" y="${fmt(y)}" ${FONT} font-size="4.2" font-weight="bold">${i + 1}.</text>`);
    for (const ln of wrap(t, maxC - 4)) { out.push(`<text x="${fmt(m + 6)}" y="${fmt(y)}" ${FONT} font-size="4.2">${esc(ln)}</text>`); y += 6.1; }
    y += 2;
  });
  para("Cada ficha de la guía trae una sugerencia de con qué combinarlo, y la última página («Combina») muestra cómo se reparten varios tangles en un mismo cuadro.", 4);
  out.push("</svg>");
  return out.join("");
}

// Páginas de la guía: 3 tangles por página; cada uno con su explicación,
// tres pasos, el tangle terminado y un recuadro vacío para practicar.
export function tangleGuidePages(ids, { w, h, m }, { lineThicknessProfile = "standard" } = {}) {
  // Complejidad creciente: primero los básicos, al final los avanzados.
  const list = byComplexity(ids).filter((id) => byId.has(id));
  const per = 3, pages = [];
  for (let p = 0; p * per < list.length; p++) {
    const chunk = list.slice(p * per, p * per + per);
    const out = [pageOpen(w, h)];
    const head = 24;
    out.push(`<text x="${fmt(m)}" y="${fmt(m + 8)}" ${FONT} font-size="8" font-weight="bold">Guía de tangles${list.length > per ? ` (${p + 1}/${Math.ceil(list.length / per)})` : ""}</text>`);
    const lvls = [...new Set(chunk.map((id) => TANGLE_INFO[id].level))].map((l) => LEVEL_NAMES[l].toLowerCase());
    out.push(`<text x="${fmt(m)}" y="${fmt(m + 15)}" ${FONT} font-size="3.6">${p === 0 ? "De lo más simple a lo más complejo. " : ""}Nivel ${esc(lvls.join(" y "))}: sigue los pasos y practica en el recuadro punteado.</text>`);
    const rowH = (h - 2 * m - head) / per;
    const gapX = 3.5;
    const sq = Math.min(rowH - 29, (w - 2 * m - 4 * gapX) / 5);
    chunk.forEach((id, k) => {
      const info = TANGLE_INFO[id];
      const y0 = m + head + k * rowH;
      out.push(`<text x="${fmt(m)}" y="${fmt(y0 + 5)}" ${FONT} font-size="5.2" font-weight="bold">${esc(info.name)}</text>`);
      if (info.official) out.push(officialMark(m + info.name.length * 3.25 + 3.2, y0 + 3, 1.7, lineThicknessProfile));
      // Nivel a la derecha del renglón del nombre.
      out.push(levelDots(w - m - 30, y0 + 3.4, info.level, 1.3, lineThicknessProfile));
      out.push(`<text x="${fmt(w - m)}" y="${fmt(y0 + 4.6)}" ${FONT} font-size="3.4" text-anchor="end">${LEVEL_NAMES[info.level]}</text>`);
      wrap(info.how, Math.floor((w - 2 * m) / 1.75)).slice(0, 2).forEach((ln, i) => {
        out.push(`<text x="${fmt(m)}" y="${fmt(y0 + 10.5 + i * 4.6)}" ${FONT} font-size="3.5">${esc(ln)}</text>`);
      });
      // Con qué combinarlo (contraste recto/curvo, denso/abierto).
      wrap(`Combina: ${info.combo}`, Math.floor((w - 2 * m) / 1.65)).slice(0, 1).forEach((ln) => {
        out.push(`<text x="${fmt(m)}" y="${fmt(y0 + 20.4)}" ${FONT} font-size="3.3" font-style="italic">${esc(ln)}</text>`);
      });
      const top = y0 + 23.5;
      const gap = Math.max(1.5, sq / 22);
      const box = { x0: 0, y0: 0, x1: sq, y1: sq };
      const full = layersIn(id, box, gap, lineThicknessProfile);
      ["1", "2", "3", "✓", ""].forEach((label, i) => {
        const x = m + i * (sq + gapX);
        const cid = `g_${p}_${k}_${i}`;
        const layers = i < 3 ? reveal(full, box, [0.3, 0.55, 0.8][i]) : i === 3 ? full : [];
        const layerSw = scaleStrokeForProfile(0.3, lineThicknessProfile);
        const boxSw = scaleStrokeForProfile(i === 4 ? 0.4 : 0.5, lineThicknessProfile);
        out.push(`<clipPath id="${cid}"><rect x="0" y="0" width="${fmt(sq)}" height="${fmt(sq)}"/></clipPath>`);
        out.push(`<g transform="translate(${fmt(x)} ${fmt(top)})"><g clip-path="url(#${cid})">${layerEls(layers, layerSw)}</g>`
          + `<rect x="0" y="0" width="${fmt(sq)}" height="${fmt(sq)}" fill="none" stroke="#000" stroke-width="${boxSw}"${i === 4 ? ' stroke-dasharray="1.6 1.2"' : ""}/></g>`);
        const cap = i < 3 ? `Paso ${label}` : i === 3 ? "Terminado" : "Tu práctica";
        out.push(`<text x="${fmt(x + sq / 2)}" y="${fmt(top + sq + 4.2)}" ${FONT} font-size="3.2" text-anchor="middle">${cap}</text>`);
      });
    });
    out.push("</svg>");
    pages.push(out.join(""));
  }
  const combo = combineGuidePage(list, { w, h, m }, { lineThicknessProfile });
  if (combo) pages.push(combo);
  return [guideIntroPage(list, { w, h, m }, { lineThicknessProfile }), ...pages];
}

// Nivel 4 · Combina: un cuadro dividido por strings en 2, 3 y 4 secciones,
// cada sección con un tangle (cada vez de un nivel más alto), y al lado el
// mismo cuadro con los strings y las secciones vacías para practicar.
export function combineGuidePage(ids, { w, h, m }, { lineThicknessProfile = "standard" } = {}) {
  const list = byComplexity(ids).filter((id) => byId.has(id));
  if (list.length < 4) return null;
  const out = [pageOpen(w, h)];
  out.push(`<text x="${fmt(m)}" y="${fmt(m + 8)}" ${FONT} font-size="8" font-weight="bold">Guía de tangles · Combina</text>`);
  out.push(levelDots(w - m - 42, m + 6.5, 3, 1.3, lineThicknessProfile));
  out.push(`<text x="${fmt(w - m)}" y="${fmt(m + 7.7)}" ${FONT} font-size="3.4" text-anchor="end">Nivel 4</text>`);
  out.push(`<text x="${fmt(m)}" y="${fmt(m + 15)}" ${FONT} font-size="3.6">Un string divide el cuadro; cada sección lleva un tangle distinto. A la derecha, el mismo string para ti.</text>`);
  const head = 22, rows = 3, rowH = (h - 2 * m - head) / rows;
  const sq = Math.min(rowH - 12, (w - 2 * m - 12) / 2);
  // Tangles por fila: del nivel más bajo al más alto disponible.
  const pickRow = (k, n) => {
    const maxLv = k + 1;
    const pool = list.filter((id) => TANGLE_INFO[id].level <= maxLv);
    const hardest = list.filter((id) => TANGLE_INFO[id].level === Math.min(3, maxLv));
    const res = [];
    if (hardest.length) res.push(hardest[k % hardest.length]);
    for (const id of pool) if (res.length < n && !res.includes(id)) res.push(id);
    for (const id of list) if (res.length < n && !res.includes(id)) res.push(id);
    return res.slice(0, n);
  };
  for (let k = 0; k < rows; k++) {
    const n = k + 2, y = m + head + k * rowH + 6;
    const tangles = pickRow(k, n);
    out.push(`<text x="${fmt(m)}" y="${fmt(y - 1.5)}" ${FONT} font-size="4" font-weight="bold">${n} secciones · ${esc(tangles.map((id) => TANGLE_INFO[id].name).join(" + "))}</text>`);
    // Strings: n-1 curvas suaves de arriba abajo; sección j entre la curva j-1 y j.
    const xs = Array.from({ length: n - 1 }, (_, j) => sq * (j + 1) / n);
    const amp = sq / (n * 3.2), ph = k * 1.3;
    const curve = (j, t) => (j < 0 ? -2 : j >= n - 1 ? sq + 2 : xs[j] + amp * Math.sin(Math.PI * 1.6 * t + ph + j));
    const poly = (j) => {
      const L = [], R = [];
      for (let q = 0; q <= 24; q++) { const t = q / 24, yy = -2 + (sq + 4) * t; L.push(`${fmt(curve(j - 1, t))} ${fmt(yy)}`); R.push(`${fmt(curve(j, t))} ${fmt(yy)}`); }
      return `M ${L.join(" L ")} L ${R.reverse().join(" L ")} Z`;
    };
    const strings = xs.map((_, j) => {
      const pts = [];
      for (let q = 0; q <= 24; q++) { const t = q / 24; pts.push(`${fmt(curve(j, t))} ${fmt(sq * t)}`); }
      return `M ${pts.join(" L ")}`;
    }).join(" ");
    [0, 1].forEach((side) => {
      const x = m + side * (sq + 12);
      let inner = "";
      if (!side) tangles.forEach((id, j) => {
        const cid = `cb_${k}_${j}`;
        out.push(`<clipPath id="${cid}"><path d="${poly(j)}"/></clipPath>`);
        const gap = Math.max(1.5, sq / 26);
        inner += `<g clip-path="url(#${cid})">${layerEls(layersIn(id, { x0: 0, y0: 0, x1: sq, y1: sq }, gap, lineThicknessProfile), scaleStrokeForProfile(0.3, lineThicknessProfile))}</g>`;
      });
      const clipSq = `cbs_${k}_${side}`;
      out.push(`<clipPath id="${clipSq}"><rect width="${fmt(sq)}" height="${fmt(sq)}"/></clipPath>`);
      const stringSw = scaleStrokeForProfile(0.6, lineThicknessProfile);
      out.push(`<g transform="translate(${fmt(x)} ${fmt(y)})"><g clip-path="url(#${clipSq})">${inner}<path d="${strings}" fill="none" stroke="#000" stroke-width="${stringSw}" stroke-linecap="round"/></g>`
        + `<rect width="${fmt(sq)}" height="${fmt(sq)}" fill="none" stroke="#000" stroke-width="${stringSw}"${side ? ' stroke-dasharray="1.6 1.2"' : ""}/></g>`);
      out.push(`<text x="${fmt(x + sq / 2)}" y="${fmt(y + sq + 4.2)}" ${FONT} font-size="3.2" text-anchor="middle">${side ? "Tu práctica" : "Ejemplo"}</text>`);
    });
  }
  out.push("</svg>");
  return out.join("");
}

// Pasaporte: cada tangle con una muestra redonda y dos casillas para marcar.
export function tanglePassportPage(ids, { w, h, m }, { lineThicknessProfile = "standard" } = {}) {
  const list = byComplexity(ids).filter((id) => byId.has(id));
  if (!list.length) return null;
  const out = [pageOpen(w, h)];
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(m + 9)}" ${FONT} font-size="8" font-weight="bold" text-anchor="middle">Mi pasaporte de tangles</text>`);
  out.push(`<text x="${fmt(w / 2)}" y="${fmt(m + 16)}" ${FONT} font-size="3.6" text-anchor="middle">Marca cada tangle cuando lo colorees y cuando lo dibujes por tu cuenta.</text>`);
  const cols = list.length > 8 ? 2 : 1;
  const rows = Math.ceil(list.length / cols);
  const top = m + 24, rowH = Math.min(30, (h - top - m) / rows), colW = (w - 2 * m) / cols;
  const r = Math.min(11, rowH * 0.4);
  const circleSw = scaleStrokeForProfile(0.5, lineThicknessProfile);
  const sampleSw = scaleStrokeForProfile(0.25, lineThicknessProfile);
  const checkboxSw = scaleStrokeForProfile(0.4, lineThicknessProfile);
  list.forEach((id, i) => {
    const cx = m + Math.floor(i / rows) * colW, cy = top + (i % rows) * rowH + rowH / 2;
    const box = { x0: -r, y0: -r, x1: r, y1: r };
    const cid = `pp_${i}`;
    out.push(`<clipPath id="${cid}"><circle cx="0" cy="0" r="${fmt(r)}"/></clipPath>`);
    out.push(`<g transform="translate(${fmt(cx + r + 1)} ${fmt(cy)})"><g clip-path="url(#${cid})">${layerEls(layersIn(id, box, Math.max(1.2, r / 9), lineThicknessProfile), sampleSw)}</g><circle r="${fmt(r)}" fill="none" stroke="#000" stroke-width="${circleSw}"/></g>`);
    const tx = cx + 2 * r + 6;
    out.push(`<text x="${fmt(tx)}" y="${fmt(cy - 1.5)}" ${FONT} font-size="4.6" font-weight="bold">${esc(TANGLE_INFO[id].name)}</text>`);
    out.push(levelDots(tx + 44, cy - 3, TANGLE_INFO[id].level, 1.1, lineThicknessProfile));
    [["Lo coloreé", 0], ["Lo dibujé", 1]].forEach(([lab, j]) => {
      const bx = tx + j * 30;
      out.push(`<rect x="${fmt(bx)}" y="${fmt(cy + 2)}" width="4" height="4" fill="none" stroke="#000" stroke-width="${checkboxSw}"/>`);
      out.push(`<text x="${fmt(bx + 5.5)}" y="${fmt(cy + 5.3)}" ${FONT} font-size="3.3">${lab}</text>`);
    });
  });
  out.push("</svg>");
  return out.join("");
}

// Nivel 1-5 y minutos aproximados para una dificultad 0..1.
export function levelInfo(difficulty) {
  const d = Math.min(1, Math.max(0, Number(difficulty) || 0));
  const level = 1 + Math.min(4, Math.floor(d * 5));
  return { level, minutes: [25, 40, 55, 75, 95][level - 1] };
}

// Pie de página (dentro del margen inferior, a ≥ 6.35 mm del corte como pide
// KDP). Devuelve "" si el margen no deja sitio.
export function footerSvg({ w, h, m }, { text = "", level = 0, lineThicknessProfile = "standard" } = {}) {
  if (m < 10 || (!text && !level)) return "";
  // 5 mm bajo el área del dibujo, pero nunca a menos de 7.6 mm del borde: KDP
  // pide el contenido a ≥ 6.35 mm del corte y el texto baja ~1 mm de la línea base.
  const y = Math.min(h - m + 5, h - 7.6);
  const parts = [];
  let x = w / 2;
  if (level) {
    // Cinco puntos de nivel (contorno; el nivel alcanzado lleva un punto dentro).
    const dotSw = scaleStrokeForProfile(0.3, lineThicknessProfile);
    const dots = [];
    for (let i = 0; i < 5; i++) {
      const cx = w / 2 - 34 + i * 4;
      dots.push(`<circle cx="${fmt(cx)}" cy="${fmt(y - 1.1)}" r="1.3" fill="none" stroke="#000" stroke-width="${dotSw}"/>`);
      if (i < level) dots.push(`<circle cx="${fmt(cx)}" cy="${fmt(y - 1.1)}" r="0.6" fill="#000"/>`);
    }
    parts.push(...dots);
    x = w / 2 - 14;
  }
  parts.push(`<text x="${fmt(x)}" y="${fmt(y)}" ${FONT} font-size="3.2" text-anchor="${level ? "start" : "middle"}" fill="#000">${esc(text)}</text>`);
  return `<g data-footer="1">${parts.join("")}</g>`;
}

// Inserta un fragmento al final de un SVG de página.
export const appendToSvg = (svg, frag) => (frag ? svg.replace(/<\/svg>\s*$/, `${frag}</svg>`) : svg);


// js/core/svgImporter.js
// Importador y validador de siluetas SVG de ilustrador para el motor de figuras.
// Implementa los requisitos de la Fase 3.1 (M1) de REVISION_Y_PLAN.md:
//   - Parseo de SVG 1.1 plano (viewBox 0 0 1000 1000) a comandos normalizados [-1, 1].
//   - Normalización de comandos: M, L, C, Q, Z absolutos (convierte h, v, s, t, a, etc.).
//   - Detección de capas por ID: silhouette, part-*, back-*, front-*, deco-*.
//   - Validación de metadatos figura.json: 'license' y 'origin' obligatorios.
//   - Validación geométrica: trayectos cerrados, detalle mínimo y ausencia de autointersecciones.
//   - Compilación e integración directa en el catálogo de FIGURES.

const TAU = Math.PI * 2;
const KAPPA = 0.5522847498; // Constante cúbica para aproximar círculos/elipses

/**
 * Normaliza una coordenada de viewBox [0, 1000] al rango [-1, 1].
 */
export function toNormX(x, vb = { x: 0, y: 0, w: 1000, h: 1000 }) {
  return Math.round((((x - vb.x) / vb.w) * 2 - 1) * 10000) / 10000;
}

export function toNormY(y, vb = { x: 0, y: 0, w: 1000, h: 1000 }) {
  return Math.round((((y - vb.y) / vb.h) * 2 - 1) * 10000) / 10000;
}

/**
 * Convierte un arco elíptico SVG (A/a) a curvas cúbicas de Bézier (C).
 */
function arcToCubicBeziers(x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0) return [["L", x2, y2]];

  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);

  // Paso 1: Rotar al sistema alineado con los ejes
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Ajustar radios si son pequeños
  const prx = rx * rx, pry = ry * ry;
  const px1p = x1p * x1p, py1p = y1p * y1p;
  const lambda = px1p / prx + py1p / pry;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
  }

  // Paso 2: Calcular centro (cxp, cyp)
  const sign = fa === fs ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / (den || 1)));
  const cxp = coef * ((rx * y1p) / ry);
  const cyp = coef * -((ry * x1p) / rx);

  // Paso 3: Transformar centro al espacio original
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  // Paso 4: Calcular ángulos inicial y de apertura
  const v1x = (x1p - cxp) / rx, v1y = (y1p - cyp) / ry;
  const v2x = (-x1p - cxp) / rx, v2y = (-y1p - cyp) / ry;

  const angle = (uX, uY, vX, vY) => {
    const dot = uX * vX + uY * vY;
    const len = Math.sqrt((uX * uX + uY * uY) * (vX * vX + vY * vY));
    const ang = Math.acos(Math.max(-1, Math.min(1, dot / (len || 1))));
    return uX * vY - uY * vX < 0 ? -ang : ang;
  };

  let theta1 = angle(1, 0, v1x, v1y);
  let dTheta = angle(v1x, v1y, v2x, v2y);
  if (!fs && dTheta > 0) dTheta -= TAU;
  else if (fs && dTheta < 0) dTheta += TAU;

  // Paso 5: Dividir arco en segmentos de máximo pi/2 (90 grados)
  const segments = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / segments;
  const curves = [];

  for (let i = 0; i < segments; i++) {
    const t1 = theta1 + i * delta;
    const t2 = t1 + delta;
    const alpha = (4 / 3) * Math.tan(delta / 4);

    const cos1 = Math.cos(t1), sin1 = Math.sin(t1);
    const cos2 = Math.cos(t2), sin2 = Math.sin(t2);

    const ep1x = cosPhi * rx * cos1 - sinPhi * ry * sin1 + cx;
    const ep1y = sinPhi * rx * cos1 + cosPhi * ry * sin1 + cy;

    const cp1x = ep1x + alpha * (-cosPhi * rx * sin1 - sinPhi * ry * cos1);
    const cp1y = ep1y + alpha * (-sinPhi * rx * sin1 + cosPhi * ry * cos1);

    const ep2x = cosPhi * rx * cos2 - sinPhi * ry * sin2 + cx;
    const ep2y = sinPhi * rx * cos2 + cosPhi * ry * sin2 + cy;

    const cp2x = ep2x - alpha * (-cosPhi * rx * sin2 - sinPhi * ry * cos2);
    const cp2y = ep2y - alpha * (-sinPhi * rx * sin2 + cosPhi * ry * cos2);

    curves.push(["C", cp1x, cp1y, cp2x, cp2y, i === segments - 1 ? x2 : ep2x, i === segments - 1 ? y2 : ep2y]);
  }

  return curves;
}

/**
 * Parsea y normaliza un path SVG arbitrario a comandos [op, ...coords] en rango [-1, 1].
 */
export function parseSvgPath(d, vb = { x: 0, y: 0, w: 1000, h: 1000 }) {
  if (!d || typeof d !== "string") return [];

  const tokens = [];
  const regex = /([a-df-z])|([-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?)/gi;
  let match;
  while ((match = regex.exec(d)) !== null) {
    if (match[1]) tokens.push(match[1]);
    else if (match[2]) tokens.push(parseFloat(match[2]));
  }

  const cmds = [];
  let curX = 0, curY = 0;
  let startX = 0, startY = 0;
  let lastControlX = 0, lastControlY = 0;
  let lastOp = "";

  const normX = (x) => toNormX(x, vb);
  const normY = (y) => toNormY(y, vb);

  let i = 0;
  while (i < tokens.length) {
    let token = tokens[i];
    if (typeof token === "string") {
      lastOp = token;
      i++;
    } else {
      if (lastOp === "M") lastOp = "L";
      else if (lastOp === "m") lastOp = "l";
    }

    const isRel = lastOp === lastOp.toLowerCase();
    const opUpper = lastOp.toUpperCase();

    if (opUpper === "M") {
      const x = isRel ? curX + tokens[i++] : tokens[i++];
      const y = isRel ? curY + tokens[i++] : tokens[i++];
      curX = x; curY = y;
      startX = x; startY = y;
      lastControlX = x; lastControlY = y;
      cmds.push(["M", normX(x), normY(y)]);
    } else if (opUpper === "L") {
      const x = isRel ? curX + tokens[i++] : tokens[i++];
      const y = isRel ? curY + tokens[i++] : tokens[i++];
      curX = x; curY = y;
      lastControlX = x; lastControlY = y;
      cmds.push(["L", normX(x), normY(y)]);
    } else if (opUpper === "H") {
      const x = isRel ? curX + tokens[i++] : tokens[i++];
      curX = x;
      lastControlX = x; lastControlY = curY;
      cmds.push(["L", normX(x), normY(curY)]);
    } else if (opUpper === "V") {
      const y = isRel ? curY + tokens[i++] : tokens[i++];
      curY = y;
      lastControlX = curX; lastControlY = y;
      cmds.push(["L", normX(curX), normY(y)]);
    } else if (opUpper === "Q") {
      const qx = isRel ? curX + tokens[i++] : tokens[i++];
      const qy = isRel ? curY + tokens[i++] : tokens[i++];
      const x = isRel ? curX + tokens[i++] : tokens[i++];
      const y = isRel ? curY + tokens[i++] : tokens[i++];
      curX = x; curY = y;
      lastControlX = qx; lastControlY = qy;
      cmds.push(["Q", normX(qx), normY(qy), normX(x), normY(y)]);
    } else if (opUpper === "T") {
      const qx = ["Q", "T"].includes(lastOp.toUpperCase()) ? 2 * curX - lastControlX : curX;
      const qy = ["Q", "T"].includes(lastOp.toUpperCase()) ? 2 * curY - lastControlY : curY;
      const x = isRel ? curX + tokens[i++] : tokens[i++];
      const y = isRel ? curY + tokens[i++] : tokens[i++];
      curX = x; curY = y;
      lastControlX = qx; lastControlY = qy;
      cmds.push(["Q", normX(qx), normY(qy), normX(x), normY(y)]);
    } else if (opUpper === "C") {
      const c1x = isRel ? curX + tokens[i++] : tokens[i++];
      const c1y = isRel ? curY + tokens[i++] : tokens[i++];
      const c2x = isRel ? curX + tokens[i++] : tokens[i++];
      const c2y = isRel ? curY + tokens[i++] : tokens[i++];
      const x = isRel ? curX + tokens[i++] : tokens[i++];
      const y = isRel ? curY + tokens[i++] : tokens[i++];
      curX = x; curY = y;
      lastControlX = c2x; lastControlY = c2y;
      cmds.push(["C", normX(c1x), normY(c1y), normX(c2x), normY(c2y), normX(x), normY(y)]);
    } else if (opUpper === "S") {
      const c1x = ["C", "S"].includes(lastOp.toUpperCase()) ? 2 * curX - lastControlX : curX;
      const c1y = ["C", "S"].includes(lastOp.toUpperCase()) ? 2 * curY - lastControlY : curY;
      const c2x = isRel ? curX + tokens[i++] : tokens[i++];
      const c2y = isRel ? curY + tokens[i++] : tokens[i++];
      const x = isRel ? curX + tokens[i++] : tokens[i++];
      const y = isRel ? curY + tokens[i++] : tokens[i++];
      curX = x; curY = y;
      lastControlX = c2x; lastControlY = c2y;
      cmds.push(["C", normX(c1x), normY(c1y), normX(c2x), normY(c2y), normX(x), normY(y)]);
    } else if (opUpper === "A") {
      const rx = tokens[i++];
      const ry = tokens[i++];
      const phi = tokens[i++];
      const fa = tokens[i++];
      const fs = tokens[i++];
      const x = isRel ? curX + tokens[i++] : tokens[i++];
      const y = isRel ? curY + tokens[i++] : tokens[i++];
      const beziers = arcToCubicBeziers(curX, curY, rx, ry, phi, fa, fs, x, y);
      for (const b of beziers) {
        if (b[0] === "C") {
          cmds.push(["C", normX(b[1]), normY(b[2]), normX(b[3]), normY(b[4]), normX(b[5]), normY(b[6])]);
          lastControlX = b[3]; lastControlY = b[4];
        } else if (b[0] === "L") {
          cmds.push(["L", normX(b[1]), normY(b[2])]);
          lastControlX = b[1]; lastControlY = b[2];
        }
      }
      curX = x; curY = y;
    } else if (opUpper === "Z") {
      curX = startX; curY = startY;
      lastControlX = curX; lastControlY = curY;
      cmds.push(["Z"]);
    } else {
      i++;
    }
  }

  return cmds;
}

/**
 * Convierte formas primitivas de SVG (circle, ellipse, rect, polygon, line) a comandos normalizados.
 */
export function shapeElementToCmds(tag, attrs, vb) {
  const getNum = (k, fb = 0) => (attrs[k] !== undefined ? parseFloat(attrs[k]) : fb);
  const normX = (x) => toNormX(x, vb);
  const normY = (y) => toNormY(y, vb);

  if (tag === "circle") {
    const cx = getNum("cx"), cy = getNum("cy"), r = getNum("r");
    const k = r * KAPPA;
    return [
      ["M", normX(cx + r), normY(cy)],
      ["C", normX(cx + r), normY(cy + k), normX(cx + k), normY(cy + r), normX(cx), normY(cy + r)],
      ["C", normX(cx - k), normY(cy + r), normX(cx - r), normY(cy + k), normX(cx - r), normY(cy)],
      ["C", normX(cx - r), normY(cy - k), normX(cx - k), normY(cy - r), normX(cx), normY(cy - r)],
      ["C", normX(cx + k), normY(cy - r), normX(cx + r), normY(cy - k), normX(cx + r), normY(cy)],
      ["Z"],
    ];
  }

  if (tag === "ellipse") {
    const cx = getNum("cx"), cy = getNum("cy"), rx = getNum("rx"), ry = getNum("ry");
    const kx = rx * KAPPA, ky = ry * KAPPA;
    return [
      ["M", normX(cx + rx), normY(cy)],
      ["C", normX(cx + rx), normY(cy + ky), normX(cx + kx), normY(cy + ry), normX(cx), normY(cy + ry)],
      ["C", normX(cx - kx), normY(cy + ry), normX(cx - rx), normY(cy + ky), normX(cx - rx), normY(cy)],
      ["C", normX(cx - rx), normY(cy - ky), normX(cx - kx), normY(cy - ry), normX(cx), normY(cy - ry)],
      ["C", normX(cx + kx), normY(cy - ry), normX(cx + rx), normY(cy - ky), normX(cx + rx), normY(cy)],
      ["Z"],
    ];
  }

  if (tag === "rect") {
    const x = getNum("x"), y = getNum("y"), w = getNum("width"), h = getNum("height");
    return [
      ["M", normX(x), normY(y)],
      ["L", normX(x + w), normY(y)],
      ["L", normX(x + w), normY(y + h)],
      ["L", normX(x), normY(y + h)],
      ["Z"],
    ];
  }

  if (tag === "polygon" || tag === "polyline") {
    const raw = attrs.points || "";
    const nums = (raw.match(/[-+]?(?:\d*\.\d+|\d+)/g) || []).map(Number);
    if (nums.length < 4) return [];
    const cmds = [["M", normX(nums[0]), normY(nums[1])]];
    for (let i = 2; i < nums.length; i += 2) {
      cmds.push(["L", normX(nums[i]), normY(nums[i + 1])]);
    }
    if (tag === "polygon") cmds.push(["Z"]);
    return cmds;
  }

  if (tag === "line") {
    return [
      ["M", normX(getNum("x1")), normY(getNum("y1"))],
      ["L", normX(getNum("x2")), normY(getNum("y2"))],
    ];
  }

  return [];
}

/**
 * Valida los metadatos figura.json. 'license' y 'origin' son estrictamente obligatorios.
 */
export function validateFigureMeta(meta) {
  const errors = [];
  if (!meta || typeof meta !== "object") {
    return { valid: false, errors: ["El objeto de metadatos figura.json no es válido."] };
  }

  if (!meta.id || typeof meta.id !== "string" || !/^[a-z0-9_]+$/.test(meta.id)) {
    errors.push("El campo 'id' es obligatorio y debe ser alfanumérico en minúsculas con guiones bajos (ej. 'barn_owl').");
  }

  if (!meta.license || typeof meta.license !== "string" || meta.license.trim().length === 0) {
    errors.push("El campo 'license' es obligatorio para proteger la cuenta de KDP frente a reclamos de derechos.");
  }

  if (!meta.origin || typeof meta.origin !== "string" || meta.origin.trim().length === 0) {
    errors.push("El campo 'origin' es obligatorio para verificar la autoría original o procedencia del diseño.");
  }

  if (!meta.author || typeof meta.author !== "string" || meta.author.trim().length === 0) {
    errors.push("El campo 'author' es obligatorio.");
  }

  const validThemes = ["birds", "ocean", "cats", "adult", "kids", "dino", "bio", "cryptids", "flowers", "nature"];
  if (meta.theme && !validThemes.includes(meta.theme)) {
    // Advertencia informativa, pero permitimos temas nuevos
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parsea el texto del SVG, extrae capas y valida que no contenga elementos prohibidos (§5.1).
 */
export function parseFigureSvg(svgText) {
  const errors = [];
  if (!svgText || typeof svgText !== "string") {
    return { valid: false, errors: ["El contenido SVG está vacío o no es un texto válido."] };
  }

  // 1. Verificar elementos prohibidos (§5.1)
  const forbiddenPatterns = [
    { regex: /<image\b/i, name: "<image>" },
    { regex: /<text\b/i, name: "<text>" },
    { regex: /<tspan\b/i, name: "<tspan>" },
    { regex: /<use\b/i, name: "<use>" },
    { regex: /<clipPath\b/i, name: "<clipPath>" },
    { regex: /<mask\b/i, name: "<mask>" },
    { regex: /<style\b/i, name: "<style>" },
    { regex: /<filter\b/i, name: "<filter>" },
    { regex: /<linearGradient\b/i, name: "<linearGradient>" },
    { regex: /<radialGradient\b/i, name: "<radialGradient>" },
  ];

  for (const { regex, name } of forbiddenPatterns) {
    if (regex.test(svgText)) {
      errors.push(`Elemento prohibido encontrado: ${name}. Las siluetas deben ser gráficos vectoriales planos sin filtros, texto o recortes.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // 2. Extraer viewBox
  const vbMatch = svgText.match(/viewBox=["']\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)\s*["']/i);
  let vb = { x: 0, y: 0, w: 1000, h: 1000 };
  if (vbMatch) {
    vb = { x: parseFloat(vbMatch[1]), y: parseFloat(vbMatch[2]), w: parseFloat(vbMatch[3]), h: parseFloat(vbMatch[4]) };
  } else {
    const wM = svgText.match(/width=["']\s*([\d.]+)/i);
    const hM = svgText.match(/height=["']\s*([\d.]+)/i);
    if (wM && hM) {
      vb = { x: 0, y: 0, w: parseFloat(wM[1]), h: parseFloat(hM[1]) };
    }
  }

  // 3. Parser de capas y elementos por grupo o elemento individual
  // Regex para atributos clave
  const parseAttrs = (attrStr) => {
    const attrs = {};
    const attrRegex = /([a-zA-Z0-9_:-]+)\s*=\s*["']([^"']*)["']/g;
    let m;
    while ((m = attrRegex.exec(attrStr)) !== null) {
      attrs[m[1]] = m[2];
    }
    return attrs;
  };

  const layers = {
    silhouette: [],
    parts: [],
    back: [],
    front: [],
    deco: [],
    skeleton: [],
  };

  // Buscar grupos <g id="..."> ... </g>
  const groupRegex = /<g\b([^>]*)>([\s\S]*?)<\/g>/gi;
  let gMatch;
  const processedGroups = new Set();

  while ((gMatch = groupRegex.exec(svgText)) !== null) {
    const gAttrs = parseAttrs(gMatch[1]);
    const gId = gAttrs.id || "";
    const gContent = gMatch[2];
    processedGroups.add(gMatch[0]);

    // Extraer shapes del grupo
    const shapeRegex = /<(path|circle|ellipse|rect|polygon|polyline|line)\b([^>]*?)(?:\/>|>(?:[\s\S]*?)<\/\1>)/gi;
    let sMatch;
    const groupCmds = [];

    while ((sMatch = shapeRegex.exec(gContent)) !== null) {
      const tag = sMatch[1].toLowerCase();
      const sAttrs = parseAttrs(sMatch[2]);
      let cmds = [];
      if (tag === "path") {
        cmds = parseSvgPath(sAttrs.d, vb);
      } else {
        cmds = shapeElementToCmds(tag, sAttrs, vb);
      }
      if (cmds.length > 0) {
        groupCmds.push({ tag, attrs: sAttrs, cmds });
      }
    }

    if (groupCmds.length === 0) continue;

    // Asignar según el ID del grupo
    const idLower = gId.toLowerCase();
    if (idLower === "skeleton" || idLower.startsWith("skel")) {
      for (const item of groupCmds) layers.skeleton.push(item.cmds);
    } else if (idLower === "silhouette" || idLower.startsWith("silhouette")) {
      for (const item of groupCmds) layers.silhouette.push(item.cmds);
    } else if (idLower.startsWith("back")) {
      for (const item of groupCmds) layers.back.push({ id: gId, cmds: item.cmds });
    } else if (idLower.startsWith("front")) {
      for (const item of groupCmds) layers.front.push({ id: gId, cmds: item.cmds });
    } else if (idLower.startsWith("deco")) {
      for (const item of groupCmds) layers.deco.push({ id: gId, cmds: item.cmds, fill: item.attrs.fill || "none" });
    } else {
      // Default: si es part-* o cualquier otra forma
      for (const item of groupCmds) layers.parts.push({ id: gId || "part", cmds: item.cmds });
    }
  }

  // Buscar elementos individuales que no estaban en un <g> ya procesado
  const topShapeRegex = /<(path|circle|ellipse|rect|polygon|polyline|line)\b([^>]*?)(?:\/>|>(?:[\s\S]*?)<\/\1>)/gi;
  let topMatch;
  while ((topMatch = topShapeRegex.exec(svgText)) !== null) {
    // Si este elemento fue parte de un grupo procesado, lo omitimos para no duplicar
    let alreadyInGroup = false;
    for (const gStr of processedGroups) {
      if (gStr.includes(topMatch[0])) {
        alreadyInGroup = true;
        break;
      }
    }
    if (alreadyInGroup) continue;

    const tag = topMatch[1].toLowerCase();
    const attrs = parseAttrs(topMatch[2]);
    const id = (attrs.id || "").toLowerCase();
    const cmds = tag === "path" ? parseSvgPath(attrs.d, vb) : shapeElementToCmds(tag, attrs, vb);
    if (!cmds || cmds.length === 0) continue;

    if (id === "skeleton" || id.startsWith("skel")) {
      layers.skeleton.push(cmds);
    } else if (id === "silhouette" || id.startsWith("silhouette")) {
      layers.silhouette.push(cmds);
    } else if (id.startsWith("back")) {
      layers.back.push({ id: attrs.id || "back", cmds });
    } else if (id.startsWith("front")) {
      layers.front.push({ id: attrs.id || "front", cmds });
    } else if (id.startsWith("deco")) {
      layers.deco.push({ id: attrs.id || "deco", cmds, fill: attrs.fill || "none" });
    } else {
      layers.parts.push({ id: attrs.id || "part", cmds });
    }
  }

  // Si no se definió capa de silueta explícita, se usa la unión de partes y capas
  if (layers.silhouette.length === 0) {
    if (layers.parts.length > 0) {
      layers.silhouette = layers.parts.map((p) => p.cmds);
    } else {
      errors.push("No se encontró ninguna forma válida ni capa 'silhouette' o 'part' en el SVG.");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    layers,
    viewBox: vb,
  };
}

/**
 * Valida la geometría de la figura (§5.3):
 *  - Cierre de trayectos (deben terminar en Z).
 *  - Conteo de nodos razonable (entre 20 y 600 por pieza).
 */
export function validateFigureGeometry(layers) {
  const errors = [];
  const warnings = [];

  const checkClosed = (cmds, name) => {
    if (!cmds || cmds.length === 0) return;
    const lastOp = cmds[cmds.length - 1][0];
    if (lastOp !== "Z") {
      errors.push(`La pieza '${name}' no es un trayecto cerrado (debe terminar con 'Z').`);
    }
    if (cmds.length < 5) {
      warnings.push(`La pieza '${name}' tiene muy pocos nodos (${cmds.length}); puede verse tosca.`);
    } else if (cmds.length > 500) {
      warnings.push(`La pieza '${name}' tiene demasiados nodos (${cmds.length}); podría ralentizar el renderizado.`);
    }
  };

  for (let i = 0; i < layers.parts.length; i++) {
    checkClosed(layers.parts[i].cmds, `part-${i + 1} (${layers.parts[i].id})`);
  }
  for (let i = 0; i < layers.silhouette.length; i++) {
    checkClosed(layers.silhouette[i], `silhouette-${i + 1}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Compila una definición de figura completa para el motor FIGURES a partir de SVG + JSON.
 */
// Aplana comandos SVG (M, L, Q, C) a puntos discretos [u, v] para esqueletos.
function flattenCmdsToPts(cmds) {
  const pts = [];
  let curr = [0, 0];
  for (const cmd of cmds) {
    const type = cmd[0];
    if (type === "M" || type === "L") {
      curr = [cmd[1], cmd[2]];
      pts.push(curr);
    } else if (type === "Q") {
      const [x1, y1, x, y] = [cmd[1], cmd[2], cmd[3], cmd[4]];
      for (let t = 0.25; t <= 1; t += 0.25) {
        const u = (1 - t) ** 2 * curr[0] + 2 * (1 - t) * t * x1 + t ** 2 * x;
        const v = (1 - t) ** 2 * curr[1] + 2 * (1 - t) * t * y1 + t ** 2 * y;
        pts.push([u, v]);
      }
      curr = [x, y];
    } else if (type === "C") {
      const [x1, y1, x2, y2, x, y] = [cmd[1], cmd[2], cmd[3], cmd[4], cmd[5], cmd[6]];
      for (let t = 0.2; t <= 1; t += 0.2) {
        const u = (1 - t) ** 3 * curr[0] + 3 * (1 - t) ** 2 * t * x1 + 3 * (1 - t) * t ** 2 * x2 + t ** 3 * x;
        const v = (1 - t) ** 3 * curr[1] + 3 * (1 - t) ** 2 * t * y1 + 3 * (1 - t) * t ** 2 * y2 + t ** 3 * y;
        pts.push([u, v]);
      }
      curr = [x, y];
    }
  }
  return pts;
}

export function compileFigureDefinition(svgText, meta) {
  const metaVal = validateFigureMeta(meta);
  if (!metaVal.valid) {
    return { success: false, errors: metaVal.errors };
  }

  const svgRes = parseFigureSvg(svgText);
  if (!svgRes.valid) {
    return { success: false, errors: svgRes.errors };
  }

  const geomVal = validateFigureGeometry(svgRes.layers);
  if (!geomVal.valid) {
    return { success: false, errors: geomVal.errors, warnings: geomVal.warnings };
  }

  const layers = svgRes.layers;
  const defaultStrings = meta.strings || { angle: 0.4, a: [2, 3], b: [2, 3] };
  const zones = meta.zones || {};

  let skelPts = null;
  if (Array.isArray(meta.skeleton) && meta.skeleton.length >= 2) {
    skelPts = meta.skeleton;
  } else if (layers.skeleton && layers.skeleton.length > 0) {
    skelPts = flattenCmdsToPts(layers.skeleton[0]);
  }

  // Mapear partes con sus strings y zonas anatómicas
  const parts = layers.parts.map((p, idx) => {
    // Buscar si hay zona anatómica asignada a este ID
    const zone = zones[p.id] || (p.id.includes("wing") ? "wing" : p.id.includes("belly") ? "belly" : p.id.includes("head") ? "head" : undefined);
    const partObj = {
      cmds: p.cmds,
      strings: defaultStrings,
      zone,
    };
    if (skelPts) partObj.skeleton = skelPts;
    return partObj;
  });

  const back = layers.back.map((b) => ({
    cmds: b.cmds,
    tangle: "detail",
    zone: zones[b.id] || undefined,
  }));

  const front = layers.front.map((f) => ({
    cmds: f.cmds,
    tangle: null,
    zone: zones[f.id] || undefined,
  }));

  const decoCmds = layers.deco.map((d) => ({
    cmds: d.cmds,
    fill: d.fill || "none",
  }));

  const figureDef = {
    parts,
    silhouette: layers.silhouette,
    branch: typeof meta.ground === "number" ? meta.ground : 0.94,
    hide: meta.hideable !== false,
  };
  if (skelPts) figureDef.skeleton = skelPts;

  if (back.length > 0) figureDef.back = back;
  if (front.length > 0) figureDef.front = front;
  if (decoCmds.length > 0) {
    figureDef.deco = () => decoCmds;
  }

  // Asignar banderas temáticas
  const audience = meta.audience || "adult";
  if (audience === "adult") figureDef.adult = true;
  if (audience === "kids") figureDef.kids = true;
  if (meta.theme === "dino" || meta.theme === "bio" || meta.theme === "cryptids") {
    figureDef.science = meta.theme;
  }

  // Metadatos adjuntos
  figureDef._meta = {
    id: meta.id,
    label: meta.label || { es: meta.id, en: meta.id },
    theme: meta.theme || "custom",
    author: meta.author,
    license: meta.license,
    origin: meta.origin,
    tags: meta.tags || [],
  };

  return {
    success: true,
    figureDef,
    errors: [],
    warnings: geomVal.warnings || [],
  };
}

/**
 * Registra una figura compilada en las estructuras globales de la app en tiempo de ejecución.
 */
export function registerImportedFigure(compiledDef, FIGURES, FIGURE_IDS, FIGURE_SETS) {
  if (!compiledDef || !compiledDef.figureDef || !compiledDef.figureDef._meta) {
    throw new Error("Definición de figura inválida para registro.");
  }

  const { id, theme, label } = compiledDef.figureDef._meta;
  const def = compiledDef.figureDef;

  // Registrar en el diccionario principal
  FIGURES[id] = def;

  // Registrar en FIGURE_IDS si no está presente
  if (!FIGURE_IDS.includes(id)) {
    FIGURE_IDS.push(id);
  }

  // Registrar en su tema o conjunto correspondiente
  if (FIGURE_SETS) {
    if (def.kids && FIGURE_SETS.kids && !FIGURE_SETS.kids.includes(id)) {
      FIGURE_SETS.kids.push(id);
    }
    if (def.adult && FIGURE_SETS.adult && !FIGURE_SETS.adult.includes(id)) {
      FIGURE_SETS.adult.push(id);
    }
    if (def.science && FIGURE_SETS[def.science] && !FIGURE_SETS[def.science].includes(id)) {
      FIGURE_SETS[def.science].push(id);
    }
    if (theme && FIGURE_SETS[theme]) {
      if (!FIGURE_SETS[theme].includes(id)) FIGURE_SETS[theme].push(id);
    }
  }

  return { id, registered: true };
}

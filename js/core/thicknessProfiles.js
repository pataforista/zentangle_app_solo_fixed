// thicknessProfiles.js
// Perfiles de grosor de línea en 3 niveles: contorno (grueso), trazo interno
// (medio) y detalle (fino). Cada perfil ajusta los valores de stroke que usan
// los generadores para mantener una jerarquía visual coherente.
//
// - "standard": valores actuales, equilibrados para libros generales.
// - "bold":    trazos más gruesos, ideal para libros infantiles o de colorear
//              con marcadores (mejor visibilidad a distancia de lectura).
// - "fine":    trazos más finos, ideal para diseños detallados y adultos que
//              prefieren líneas sutiles (rotuladores 0.1–0.3 mm).

export const THICKNESS_PROFILES = {
  standard: {
    label: "Estándar",
    // Valores por defecto que coinciden con el comportamiento actual.
    cellBorderWidthMm: 0.70,   // contorno / borde de celda
    patternStrokeMm: 0.35,     // detalle / patrón interno
    stringStrokeMm: 0.55,      // trazo medio / strings (no expuesto en UI)
    minStrokeMm: 0.28,         // suelo mínimo de trazo (no expuesto en UI)
    // Límites de calidad por defecto (badPerDm2: zonas problemáticas por dm²)
    qualityLimits: { badPerDm2: 13, inkPct: 25 },
  },
  bold: {
    label: "Grueso",
    cellBorderWidthMm: 1.00,
    patternStrokeMm: 0.50,
    stringStrokeMm: 0.75,
    minStrokeMm: 0.40,
    // Perfil infantil "bold & easy": límite de calidad más estricto
    // (badPerDm2 ≤ 4 = máximo 4 zonas diminutas por dm², vs 13 del estándar)
    qualityLimits: { badPerDm2: 4, inkPct: 25 },
  },
  fine: {
    label: "Fino",
    cellBorderWidthMm: 0.50,
    patternStrokeMm: 0.25,
    stringStrokeMm: 0.40,
    minStrokeMm: 0.20,
    qualityLimits: { badPerDm2: 13, inkPct: 25 },
  },
};

// Claves válidas ordenadas para UI.
export const THICKNESS_PROFILE_KEYS = Object.keys(THICKNESS_PROFILES);

// Devuelve el perfil o "standard" si la clave no es válida.
export function getThicknessProfile(key) {
  return THICKNESS_PROFILES[key] || THICKNESS_PROFILES.standard;
}

// Aplica un perfil de grosor a un objeto opts, fijando los valores de stroke.
// No sobreescribe valores que el llamador ya haya fijado explícitamente
// (overrideMode === "only-missing"), útil para presets que definen sus propios
// valores de stroke. Por defecto (overrideMode === "always") sobreescribe.
export function applyThicknessProfile(opts, profileKey, overrideMode = "always") {
  const p = getThicknessProfile(profileKey);
  if (!p) return opts;
  const fields = ["cellBorderWidthMm", "patternStrokeMm", "stringStrokeMm", "minStrokeMm"];
  for (const f of fields) {
    if (overrideMode === "only-missing" && opts[f] !== undefined) continue;
    opts[f] = p[f];
  }
  return opts;
}

// Escala un valor de stroke hardcoded según el perfil. Útil para bookExtras.js
// y otros sitios con valores fijos que deben escalar con el perfil elegido.
// `base` es el valor en perfil "standard"; se devuelve el valor escalado.
export function scaleStrokeForProfile(base, profileKey) {
  const p = getThicknessProfile(profileKey);
  // Factor de escala derivado del ratio entre el perfil y standard, usando el
  // trazo de detalle como referencia (es el más representativo del "peso"
  // visual general del perfil).
  const ref = THICKNESS_PROFILES.standard.patternStrokeMm;
  const ratio = p.patternStrokeMm / ref;
  // Redondear a 2 decimales para evitar artefactos SVG.
  return Math.round(base * ratio * 100) / 100;
}

// Devuelve los límites de calidad asociados a un perfil de grosor.
// Útil para que el perfil "bold" use un límite más estricto (badPerDm2 ≤ 4).
export function getQualityLimitsForProfile(profileKey) {
  const p = getThicknessProfile(profileKey);
  return p.qualityLimits || { badPerDm2: 13, inkPct: 25 };
}

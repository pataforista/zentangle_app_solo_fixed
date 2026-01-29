// zentangle.presets.js
// Curated presets. You can start from one and override any field in buildZentangleOpts().

export const ZENTANGLE_PRESETS = {
  editorial_airy: {
    // "Libro para colorear" con aire: menos saturación, bordes marcados.
    cellLayout: "rect_bsp",
    cellCount: 26,
    minCellSizeMm: 16,

    cellBorderWidthMm: 0.75,
    patternStrokeMm: 0.35,
    minStrokeMm: 0.28,

    minGapMm: 1.6,

    layersPerCell: "auto",
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.22,
    whiteSpaceMm: 1.1,

    rotatePatterns: true,
    rotationSet: "ergonomic",

    enableDrawBehind: true,
    drawBehindProbability: 0.45,
    allowDrawBehindOnLayer2: false,

    // Bordes orgánicos "seguros" (no rompen el clip geométrico)
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.8,
    innerOrganicJitterMm: 0.55,
    innerOrganicRoundMm: 1.0,

    // Rect orgánico opcional (si quieres que el clip también sea orgánico)
    organicBorder: false,
  },

  dense_classic: {
    cellLayout: "rect_bsp",
    cellCount: 34,
    minCellSizeMm: 13,

    cellBorderWidthMm: 0.7,
    patternStrokeMm: 0.32,
    minStrokeMm: 0.26,

    minGapMm: 1.2,

    layersPerCell: "auto",
    maxPatternPassesPerCell: 3,
    patternSkipProb: 0.08,
    whiteSpaceMm: 0.6,

    rotatePatterns: true,
    rotationSet: "ergonomic",

    enableDrawBehind: true,
    drawBehindProbability: 0.55,
    allowDrawBehindOnLayer2: true,

    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.65,
    innerOrganicJitterMm: 0.5,
    innerOrganicRoundMm: 0.9,

    organicBorder: false,
  },

  hex_editorial: {
    // Hexágonos que rellenan la página (bordes limpios + borde interno orgánico)
    cellLayout: "hex",
    hexRadiusMm: 12, // tamaño base del hex (radio)
    cellCount: 0,    // se ignora en hex/tri
    minCellSizeMm: 0,

    cellBorderWidthMm: 0.75,
    patternStrokeMm: 0.35,
    minStrokeMm: 0.28,
    minGapMm: 1.5,

    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.20,
    whiteSpaceMm: 0.9,

    rotatePatterns: false, // en grids regulares, suele verse más limpio sin rotar
    rotationSet: "ergonomic",

    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.75,
    innerOrganicJitterMm: 0.55,
    innerOrganicRoundMm: 1.0,

    enableDrawBehind: true,
    drawBehindProbability: 0.42,
    allowDrawBehindOnLayer2: false,

    organicBorder: false,
  },

  tri_editorial: {
    cellLayout: "tri",
    triSideMm: 22,

    cellBorderWidthMm: 0.75,
    patternStrokeMm: 0.35,
    minStrokeMm: 0.28,
    minGapMm: 1.5,

    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.18,
    whiteSpaceMm: 0.9,

    rotatePatterns: false,

    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.75,
    innerOrganicJitterMm: 0.55,
    innerOrganicRoundMm: 1.0,

    enableDrawBehind: true,
    drawBehindProbability: 0.42,
    allowDrawBehindOnLayer2: false,

    organicBorder: false,
  },
};

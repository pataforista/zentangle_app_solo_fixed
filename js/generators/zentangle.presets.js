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
    patternFamily: "geometric",
    focusMode: true,
    borderStrokeMultiplier: 1.4,
  },

  commercial_print: {
    // Alto contraste para impresión/comercialización (líneas limpias y áreas coloreables).
    cellLayout: "rect_bsp",
    cellCount: 24,
    minCellSizeMm: 17,

    cellBorderWidthMm: 0.82,
    patternStrokeMm: 0.34,
    minStrokeMm: 0.3,

    minGapMm: 1.7,

    layersPerCell: "auto",
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.26,
    whiteSpaceMm: 1.25,

    rotatePatterns: true,
    rotationSet: "classic",

    enableDrawBehind: true,
    drawBehindProbability: 0.38,
    allowDrawBehindOnLayer2: false,

    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.85,
    innerOrganicJitterMm: 0.45,
    innerOrganicRoundMm: 0.95,

    organicBorder: false,
    patternFamily: "geometric",
    focusMode: true,
    borderStrokeMultiplier: 1.5,
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
    patternFamily: "dense",
    focusMode: false,
    borderStrokeMultiplier: 1.35,
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
    patternFamily: "geometric",
    focusMode: true,
    borderStrokeMultiplier: 1.4,
  },

  tri_editorial: {
    cellLayout: "tri",
    triSideMm: 45, // Triángulos masivos para máximo espacio
    cellBorderWidthMm: 0.75,
    patternStrokeMm: 0.35,
    minStrokeMm: 0.28,
    minGapMm: 4.5, // Espacio entre líneas extremo
    maxPatternPassesPerCell: 1, 
    patternSkipProb: 0.50, // 50% de las celdas vacías para un look minimalista y aireado
    whiteSpaceMm: 2.5, // Margen interno generoso

    rotatePatterns: false,

    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.75,
    innerOrganicJitterMm: 0.55,
    innerOrganicRoundMm: 1.0,

    enableDrawBehind: true,
    drawBehindProbability: 0.42,
    allowDrawBehindOnLayer2: false,

    organicBorder: false,
    patternFamily: "geometric",
    focusMode: true,
    borderStrokeMultiplier: 1.4,
  },

  voronoi_organic: {
    cellLayout: "voronoi",
    cellCount: 22, // cantidad de puntos para voronoi

    cellBorderWidthMm: 0.75,
    patternStrokeMm: 0.35,
    minStrokeMm: 0.28,
    minGapMm: 1.5,

    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.18,
    whiteSpaceMm: 1.0,

    rotatePatterns: true,
    rotationSet: "free15",

    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.8,
    innerOrganicJitterMm: 0.6,
    innerOrganicRoundMm: 1.2,

    enableDrawBehind: true,
    drawBehindProbability: 0.45,
    allowDrawBehindOnLayer2: false,

    organicBorder: false,
    patternFamily: "organic",
    focusMode: true,
    borderStrokeMultiplier: 1.4,
  },

  strings_organic: {
    cellLayout: "strings",
    cellCount: 18,

    cellBorderWidthMm: 0.70,
    patternStrokeMm: 0.32,
    minStrokeMm: 0.28,
    minGapMm: 1.4,

    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.25,
    whiteSpaceMm: 1.0,

    rotatePatterns: true,
    rotationSet: "ergonomic",

    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.7,
    innerOrganicJitterMm: 0.45,
    innerOrganicRoundMm: 0.9,

    enableDrawBehind: true,
    drawBehindProbability: 0.45,
    allowDrawBehindOnLayer2: false,

    organicBorder: false,
    patternFamily: "organic",
    focusMode: true,
    borderStrokeMultiplier: 1.5,
  },

  botanical_zen: {
    cellLayout: "voronoi",
    cellCount: 20,

    cellBorderWidthMm: 0.65,
    patternStrokeMm: 0.30,
    minStrokeMm: 0.25,
    minGapMm: 1.8,

    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.30,
    whiteSpaceMm: 1.4,

    rotatePatterns: true,
    rotationSet: "ergonomic",

    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 1.0,
    innerOrganicJitterMm: 0.7,
    innerOrganicRoundMm: 1.5,

    enableDrawBehind: true,
    drawBehindProbability: 0.50,
    allowDrawBehindOnLayer2: true,

    organicBorder: false,
    patternFamily: "organic",
    focusMode: false,
    borderStrokeMultiplier: 1.3,
  },

  bold_easy: {
    cellLayout: "rect_bsp",
    cellCount: 12, // Menos celdas = áreas más grandes para colorear
    minCellSizeMm: 22,

    cellBorderWidthMm: 1.2,
    patternStrokeMm: 0.60,
    minStrokeMm: 0.45,
    minGapMm: 4.8, // Espacio extremo para coloreado sin frustración
    maxPatternPassesPerCell: 1,
    patternSkipProb: 0.45,
    whiteSpaceMm: 3.5, // Margen interno masivo

    rotatePatterns: false,
    rotationSet: "classic",

    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 1.2,
    innerOrganicJitterMm: 0.3,
    innerOrganicRoundMm: 0.8,

    enableDrawBehind: false,
    drawBehindProbability: 0,
    allowDrawBehindOnLayer2: false,

    organicBorder: false,
    patternFamily: "geometric",
    focusMode: true,
    borderStrokeMultiplier: 1.6,
  },

  tile_90mm: {
    cellLayout: "strings",
    cellCount: 12,

    cellBorderWidthMm: 0.85,
    patternStrokeMm: 0.38,
    minStrokeMm: 0.30,
    minGapMm: 1.8,

    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.10,
    whiteSpaceMm: 1.0,

    rotatePatterns: true,
    rotationSet: "ergonomic",

    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.8,
    innerOrganicJitterMm: 0.6,
    innerOrganicRoundMm: 1.2,

    enableDrawBehind: true,
    drawBehindProbability: 0.55,
    allowDrawBehindOnLayer2: true,

    organicBorder: false,
    patternFamily: "organic",
    focusMode: true,
    borderStrokeMultiplier: 1.55,
  },

  intricate_dark: {
    cellLayout: "voronoi",
    cellCount: 30,

    cellBorderWidthMm: 0.75,
    patternStrokeMm: 0.35,
    minStrokeMm: 0.28,
    minGapMm: 2.2, // Equilibrado para detalle fino pero coloreable
    maxPatternPassesPerCell: 1, // Reducido a 1 capa para claridad
    patternSkipProb: 0.15,
    whiteSpaceMm: 1.5,

    rotatePatterns: true,
    rotationSet: "ergonomic",

    innerOrganicBorderEnabled: false,

    enableDrawBehind: true,
    drawBehindProbability: 0.65,
    allowDrawBehindOnLayer2: true,

    organicBorder: false,
    patternFamily: "dense",
    focusMode: false,
    borderStrokeMultiplier: 1.4,
  },

  classic_z_string: {
    cellLayout: "template",
    templateName: "classic_z",
    cellBorderWidthMm: 0.85,
    patternStrokeMm: 0.38,
    minGapMm: 1.8,
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.1,
    whiteSpaceMm: 1.0,
    rotatePatterns: true,
    rotationSet: "ergonomic",
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.8,
    innerOrganicJitterMm: 0.45,
    innerOrganicRoundMm: 1.0,
    patternFamily: "organic",
    focusMode: true,
    borderStrokeMultiplier: 1.5,
  },

  eye_focus: {
    cellLayout: "template",
    templateName: "eye",
    cellBorderWidthMm: 0.80,
    patternStrokeMm: 0.35,
    minGapMm: 1.6,
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.15,
    whiteSpaceMm: 1.1,
    rotatePatterns: true,
    rotationSet: "ergonomic",
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.7,
    innerOrganicJitterMm: 0.5,
    innerOrganicRoundMm: 0.9,
    patternFamily: "geometric",
    focusMode: true,
    borderStrokeMultiplier: 1.4,
  },

  classic_grid: {
    cellLayout: "template",
    templateName: "grid",
    cellBorderWidthMm: 0.80,
    patternStrokeMm: 0.35,
    minGapMm: 1.5,
    maxPatternPassesPerCell: 1,
    patternSkipProb: 0.1,
    whiteSpaceMm: 1.2,
    rotatePatterns: false,
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.8,
    innerOrganicJitterMm: 0.4,
    innerOrganicRoundMm: 0.8,
    patternFamily: "geometric",
    focusMode: true,
    borderStrokeMultiplier: 1.4,
  },

  spiral_modern: {
    cellLayout: "template",
    templateName: "spiral",
    cellBorderWidthMm: 0.90,
    patternStrokeMm: 0.40,
    minGapMm: 1.8,
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.1,
    whiteSpaceMm: 1.0,
    rotatePatterns: true,
    rotationSet: "ergonomic",
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.9,
    innerOrganicJitterMm: 0.5,
    innerOrganicRoundMm: 1.2,
    patternFamily: "organic",
    focusMode: true,
    borderStrokeMultiplier: 1.5,
  },

  kdp_masterpiece: {
    cellLayout: "voronoi",
    cellCount: 45,
    cellBorderWidthMm: 1.0,
    patternStrokeMm: 0.32,
    minGapMm: 1.3,
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.1,
    whiteSpaceMm: 0.7,
    rotatePatterns: true,
    rotationSet: "free15",
    innerOrganicBorderEnabled: false,
    enableDrawBehind: true,
    drawBehindProbability: 0.65,
    allowDrawBehindOnLayer2: false,
    organicBorder: false,
    patternFamily: "dense",
    focusMode: true,
    borderStrokeMultiplier: 1.6,
  },

  // ========== ADDITIONAL KDP-OPTIMIZED PRESETS ==========

  kdp_balanced: {
    cellLayout: "rect_bsp",
    cellCount: 28,
    minCellSizeMm: 15,
    cellBorderWidthMm: 0.80,
    patternStrokeMm: 0.36,
    minStrokeMm: 0.30,
    minGapMm: 1.5,
    layersPerCell: "auto",
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.20,
    whiteSpaceMm: 1.2,
    rotatePatterns: true,
    rotationSet: "ergonomic",
    enableDrawBehind: true,
    drawBehindProbability: 0.48,
    allowDrawBehindOnLayer2: false,
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.82,
    innerOrganicJitterMm: 0.50,
    innerOrganicRoundMm: 1.0,
    organicBorder: false,
    patternFamily: "geometric",
    focusMode: true,
    borderStrokeMultiplier: 1.45,
  },

  kdp_intricate: {
    cellLayout: "voronoi",
    cellCount: 32,
    cellBorderWidthMm: 0.78,
    patternStrokeMm: 0.33,
    minStrokeMm: 0.27,
    minGapMm: 1.3,
    maxPatternPassesPerCell: 3,
    patternSkipProb: 0.08,
    whiteSpaceMm: 0.7,
    rotatePatterns: true,
    rotationSet: "ergonomic",
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.70,
    innerOrganicJitterMm: 0.48,
    innerOrganicRoundMm: 0.95,
    enableDrawBehind: true,
    drawBehindProbability: 0.52,
    allowDrawBehindOnLayer2: true,
    organicBorder: false,
    patternFamily: "dense",
    focusMode: false,
    borderStrokeMultiplier: 1.40,
  },

  kdp_relaxed: {
    cellLayout: "hex",
    hexRadiusMm: 14,
    cellBorderWidthMm: 0.80,
    patternStrokeMm: 0.37,
    minStrokeMm: 0.30,
    minGapMm: 1.7,
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.28,
    whiteSpaceMm: 1.5,
    rotatePatterns: false,
    rotationSet: "ergonomic",
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.90,
    innerOrganicJitterMm: 0.60,
    innerOrganicRoundMm: 1.1,
    enableDrawBehind: true,
    drawBehindProbability: 0.40,
    allowDrawBehindOnLayer2: false,
    organicBorder: false,
    patternFamily: "geometric",
    focusMode: true,
    borderStrokeMultiplier: 1.42,
  },

  kdp_organic_flow: {
    cellLayout: "voronoi",
    cellCount: 24,
    cellBorderWidthMm: 0.76,
    patternStrokeMm: 0.34,
    minStrokeMm: 0.28,
    minGapMm: 1.4,
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.22,
    whiteSpaceMm: 1.3,
    rotatePatterns: true,
    rotationSet: "free15",
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.85,
    innerOrganicJitterMm: 0.65,
    innerOrganicRoundMm: 1.3,
    enableDrawBehind: true,
    drawBehindProbability: 0.50,
    allowDrawBehindOnLayer2: false,
    organicBorder: false,
    patternFamily: "organic",
    focusMode: true,
    borderStrokeMultiplier: 1.45,
  },

  kdp_geometric_art: {
    cellLayout: "hex",
    hexRadiusMm: 13,
    cellBorderWidthMm: 0.82,
    patternStrokeMm: 0.38,
    minStrokeMm: 0.31,
    minGapMm: 1.6,
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.15,
    whiteSpaceMm: 1.1,
    rotatePatterns: false,
    rotationSet: "ergonomic",
    innerOrganicBorderEnabled: false,
    enableDrawBehind: true,
    drawBehindProbability: 0.38,
    allowDrawBehindOnLayer2: false,
    organicBorder: false,
    patternFamily: "geometric",
    focusMode: true,
    borderStrokeMultiplier: 1.50,
  },

  kdp_dense_meditative: {
    cellLayout: "voronoi",
    cellCount: 35,
    cellBorderWidthMm: 0.72,
    patternStrokeMm: 0.32,
    minStrokeMm: 0.26,
    minGapMm: 1.1,
    maxPatternPassesPerCell: 3,
    patternSkipProb: 0.03,
    whiteSpaceMm: 0.4,
    rotatePatterns: true,
    rotationSet: "ergonomic",
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.65,
    innerOrganicJitterMm: 0.50,
    innerOrganicRoundMm: 0.90,
    enableDrawBehind: true,
    drawBehindProbability: 0.60,
    allowDrawBehindOnLayer2: true,
    organicBorder: false,
    patternFamily: "dense",
    focusMode: false,
    borderStrokeMultiplier: 1.38,
  },
};

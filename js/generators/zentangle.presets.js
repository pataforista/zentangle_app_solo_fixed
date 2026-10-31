// zentangle.presets.js
// Curated presets. You can start from one and override any field in buildZentangleOpts().
import { ADULT_FIGURES, FIGURE_SETS } from "./figure.js";

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
    
    // New dynamic modifiers
    focalStrength: 0.35,
    rotationJitterDeg: 2.5,
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
    // Hexágonos grandes con aire (bordes limpios + borde interno orgánico).
    // Radio amplio + whiteSpace alto: los hexágonos teselan sin huecos, así que
    // necesitan celdas grandes y patrones salteados para no entintar la página.
    cellLayout: "hex",
    hexRadiusMm: 22, // tamaño base del hex (radio)
    cellCount: 0,    // se ignora en hex/tri
    minCellSizeMm: 0,

    cellBorderWidthMm: 0.75,
    patternStrokeMm: 0.35,
    minStrokeMm: 0.28,
    minGapMm: 1.6,

    maxPatternPassesPerCell: 1,
    // 0.45 dejaba ~2/3 de los hexágonos vacíos (el skip se multiplica por la
    // densidad de página y el foco): la página dejaba de leerse como zentangle.
    patternSkipProb: 0.22,
    whiteSpaceMm: 2.8,

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
    minGapMm: 2.2, // 4.5 dejaba patrones de 3-4 trazos sueltos: no se leían como tangle
    maxPatternPassesPerCell: 1, 
    patternSkipProb: 0.25, // aire sin vaciar la página (0.50 dejaba ~60% de celdas en blanco)
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
    
    // New dynamic modifiers
    focalStrength: 0.6,
    rotationJitterDeg: 4.0,
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
    templateCellCount: 9,
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
    // Solo tangles reconocibles y sin invitados de otras familias (abanicos de
    // líneas y círculos sueltos hacían la página caótica).
    // Líneas rectas y cortes siempre horizontales/verticales (sin ondas ni
    // cambios de ángulo al azar: se leían como descuido).
    stringWarpMm: 0,
    cutJitter: 0,
    patternFamily: "tangles",
    guestPatternCount: 0,
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
    // Solo tangles reconocibles y sin invitados de otras familias (abanicos de
    // líneas y círculos sueltos hacían la página caótica).
    // Líneas rectas y cortes siempre horizontales/verticales (sin ondas ni
    // cambios de ángulo al azar: se leían como descuido).
    stringWarpMm: 0,
    cutJitter: 0,
    patternFamily: "tangles",
    guestPatternCount: 0,
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
    // Rectángulos áureos en espiral, rectos (sin deformar ni partir al azar).
    stringWarpMm: 0,
    templateCellCount: 6,
    cellBorderWidthMm: 0.90,
    patternStrokeMm: 0.40,
    minGapMm: 1.8,
    maxPatternPassesPerCell: 2,
    patternSkipProb: 0.1,
    whiteSpaceMm: 1.0,
    rotatePatterns: true,
    rotationSet: "ergonomic",
    innerOrganicBorderEnabled: false,
    innerOrganicBorderInsetMm: 0.9,
    innerOrganicJitterMm: 0.5,
    innerOrganicRoundMm: 1.2,
    // Solo tangles reconocibles y sin invitados: los abanicos de líneas y los
    // círculos sueltos de otras familias hacían la página caótica.
    patternFamily: "tangles",
    guestPatternCount: 0,
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

  kdp_tangles_classic: {
    // Tangles auténticos reconocibles (Cadent, Florz, Tipple, Printemps,
    // Crescent Moon...). Pocas celdas grandes + bordes finos => los tangles
    // lucen y la página respira (muy coloreable, look Zentangle clásico).
    cellLayout: "rect_bsp",
    cellCount: 15,
    minCellSizeMm: 26,
    cellBorderWidthMm: 0.60,
    patternStrokeMm: 0.45,
    minStrokeMm: 0.35,
    minGapMm: 1.8,
    layersPerCell: "auto",
    maxPatternPassesPerCell: 1,
    patternSkipProb: 0.06,
    whiteSpaceMm: 1.5,
    rotatePatterns: true,
    rotationSet: "ergonomic",
    enableDrawBehind: false,
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.82,
    innerOrganicJitterMm: 0.50,
    innerOrganicRoundMm: 1.0,
    organicBorder: false,
    patternFamily: "tangles",
    focusMode: false,
    borderStrokeMultiplier: 1.25,
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
    hexRadiusMm: 24,
    cellBorderWidthMm: 0.80,
    patternStrokeMm: 0.37,
    minStrokeMm: 0.30,
    minGapMm: 1.8,
    maxPatternPassesPerCell: 1,
    patternSkipProb: 0.50,
    whiteSpaceMm: 3.0,
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
    hexRadiusMm: 21,
    cellBorderWidthMm: 0.82,
    patternStrokeMm: 0.38,
    minStrokeMm: 0.31,
    minGapMm: 1.6,
    maxPatternPassesPerCell: 1,
    patternSkipProb: 0.42,
    whiteSpaceMm: 2.6,
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

  kdp_variety_mix: {
    // Máxima variedad página a página: cada seed sortea su propia paleta de
    // patrones de TODA la biblioteca (patternFamily: "mixed"), así un libro
    // de 50 páginas no repite el mismo repertorio. La celda más grande recibe
    // siempre un patrón vistoso (escaparate) que ancla la composición.
    cellLayout: "rect_bsp",
    cellCount: 22,
    minCellSizeMm: 18,
    cellBorderWidthMm: 0.78,
    patternStrokeMm: 0.36,
    minStrokeMm: 0.30,
    minGapMm: 1.5,
    maxPatternPassesPerCell: 1,
    patternSkipProb: 0.12,
    whiteSpaceMm: 1.3,
    rotatePatterns: true,
    rotationSet: "ergonomic",
    innerOrganicBorderEnabled: true,
    innerOrganicBorderInsetMm: 0.82,
    innerOrganicJitterMm: 0.50,
    innerOrganicRoundMm: 1.0,
    enableDrawBehind: true,
    drawBehindProbability: 0.45,
    allowDrawBehindOnLayer2: false,
    organicBorder: false,
    patternFamily: "mixed",
    paletteSize: 10,
    focusMode: false,
    borderStrokeMultiplier: 1.42,
  },
  // ========== MUESTRARIOS (una unidad = un motivo) ==========
  // cellCount = número aproximado de unidades; samplerSolids rellena las masas
  // negras (muestrario de tinta) o las deja en contorno (para colorear).

  sampler_circles: {
    cellLayout: "sampler",
    cellCount: 20,
    samplerShape: "circle",
    samplerSet: "all",
    samplerSolids: true,
    cellBorderWidthMm: 0.8,
    patternStrokeMm: 0.5,
    minGapMm: 1.8,
    sketchy: 0.3,
  },

  sampler_coloring: {
    cellLayout: "sampler",
    cellCount: 20,
    samplerShape: "circle",
    samplerSet: "all",
    samplerSolids: false,
    cellBorderWidthMm: 0.9,
    patternStrokeMm: 0.55,
    minGapMm: 2.0,
    sketchy: 0.25,
  },

  sampler_squares: {
    cellLayout: "sampler",
    cellCount: 20,
    samplerShape: "rounded",
    samplerSet: "all",
    samplerSolids: true,
    samplerGapMm: 4,
    cellBorderWidthMm: 0.8,
    patternStrokeMm: 0.5,
    minGapMm: 1.8,
    sketchy: 0.3,
  },

  sampler_mini: {
    cellLayout: "sampler",
    cellCount: 48,
    samplerShape: "circle",
    samplerSet: "all",
    samplerSolids: true,
    samplerGapMm: 3,
    cellBorderWidthMm: 0.6,
    patternStrokeMm: 0.38,
    minGapMm: 1.3,
    sketchy: 0.2,
  },
  // Imágenes reconocibles (estrellas, luna, sol, mariposa, peces, hongos, paraguas,
  // loto, gato...). Pocas unidades grandes: cada icono tiene áreas coloreables
  // amplias. samplerSet "iconic" mezcla iconos con texturas suaves.
  sampler_icons: {
    cellLayout: "sampler",
    cellCount: 12,
    samplerShape: "circle",
    samplerSet: "iconic",
    samplerSolids: false,
    samplerGapMm: 6,
    cellBorderWidthMm: 1.0,
    patternStrokeMm: 0.6,
    minGapMm: 2.2,
    sketchy: 0.2,
  },

  sampler_icons_ink: {
    cellLayout: "sampler",
    cellCount: 12,
    samplerShape: "circle",
    samplerSet: "iconic",
    samplerSolids: true,
    samplerGapMm: 6,
    cellBorderWidthMm: 1.0,
    patternStrokeMm: 0.6,
    minGapMm: 2.2,
    sketchy: 0.2,
  },

  // Teselados en lugar de retícula (samplerLayout): hexágonos, octógonos +
  // cuadrados (4.8²), dodecágonos + hexágonos + cuadrados (4.6.12), pentágonos de
  // El Cairo y rombos (rombille). cellCount = teselas principales aprox.; las
  // chicas y las cortadas por el borde llevan texturas.
  sampler_hex: {
    cellLayout: "sampler",
    samplerLayout: "hex",
    samplerIconMode: "mixed",
    cellCount: 14,
    samplerSet: "iconic",
    samplerSolids: false,
    samplerGapMm: 3,
    cellBorderWidthMm: 0.9,
    patternStrokeMm: 0.55,
    minGapMm: 2.0,
    sketchy: 0.2,
  },

  sampler_octagons: {
    cellLayout: "sampler",
    samplerLayout: "octagons",
    samplerIconMode: "mixed",
    cellCount: 12,
    samplerSet: "all",
    samplerSolids: false,
    samplerGapMm: 3,
    cellBorderWidthMm: 0.9,
    patternStrokeMm: 0.55,
    minGapMm: 2.0,
    sketchy: 0.2,
  },

  sampler_dodecagons: {
    cellLayout: "sampler",
    samplerLayout: "dodecagons",
    samplerIconMode: "mixed",
    cellCount: 8,
    samplerSet: "iconic",
    samplerSolids: false,
    samplerGapMm: 2.5,
    cellBorderWidthMm: 0.8,
    patternStrokeMm: 0.5,
    minGapMm: 1.9,
    sketchy: 0.2,
  },

  sampler_cairo: {
    cellLayout: "sampler",
    samplerLayout: "cairo",
    samplerIconMode: "mixed",
    cellCount: 14,
    samplerSet: "all",
    samplerSolids: false,
    samplerGapMm: 3,
    cellBorderWidthMm: 0.9,
    patternStrokeMm: 0.55,
    minGapMm: 2.0,
    sketchy: 0.2,
  },

  sampler_rhombille: {
    cellLayout: "sampler",
    samplerLayout: "rhombille",
    samplerIconMode: "mixed",
    cellCount: 14,
    samplerSet: "iconic",
    samplerSolids: true,
    samplerGapMm: 3,
    cellBorderWidthMm: 0.9,
    patternStrokeMm: 0.5,
    minGapMm: 1.9,
    sketchy: 0.2,
  },

  // Iconos convertidos en patrón: cada unidad repite su icono siguiendo un grupo
  // de simetría del plano (traslación, espejo, deslizamiento o giros).
  sampler_icon_patterns: {
    cellLayout: "sampler",
    samplerLayout: "hex",
    samplerIconMode: "pattern",
    cellCount: 6,
    samplerSet: "icons",
    samplerSolids: false,
    samplerGapMm: 3,
    cellBorderWidthMm: 0.9,
    patternStrokeMm: 0.5,
    minGapMm: 2.0,
    sketchy: 0.2,
  },

  // Iconos fractales: una copia grande y copias cada vez más chicas en los
  // huecos. Necesita unidades grandes para que la copia mínima sea coloreable.
  sampler_icon_fractal: {
    cellLayout: "sampler",
    samplerLayout: "cairo",
    samplerIconMode: "fractal",
    cellCount: 5,
    samplerSet: "icons",
    samplerSolids: false,
    samplerGapMm: 3,
    cellBorderWidthMm: 0.9,
    patternStrokeMm: 0.5,
    minGapMm: 2.0,
    sketchy: 0.2,
  },

  // ========== COMPOSICIONES DE PÁGINA COMPLETA ==========
  // Figura zentangle (figure.js): búho, gato, pez, mariposa, corazón, tortuga,
  // flor u hoja a página completa; el interior se divide con strings y cada
  // sección lleva un tangle clásico denso. Auras alrededor y fondo de
  // secciones con tangles más abiertos. Es el formato de los libros de
  // zentangle más vendidos.
  zen_figure: {
    cellLayout: "zen_figure",
    // Figuras para adultos y composiciones abstractas (las tiernas van en zen_figure_kids).
    figures: ADULT_FIGURES,
    cellCount: 1,
    cellBorderWidthMm: 1.2,
    patternStrokeMm: 0.35,
    stringStrokeMm: 0.75,
    minGapMm: 1.9,
    sketchy: 0.3,
    fillDeadSpace: false,
  },
  // Animales tiernos (búho, gato, oso, conejo…): para libros infantiles.
  zen_figure_kids: {
    cellLayout: "zen_figure",
    figures: FIGURE_SETS.kids,
    cellCount: 1,
    cellBorderWidthMm: 1.2,
    patternStrokeMm: 0.35,
    stringStrokeMm: 0.75,
    minGapMm: 1.9,
    sketchy: 0.3,
    fillDeadSpace: false,
  },  // Temas de ciencia: prehistoria (dinosaurios, reptiles marinos, amonites) y biología.
  zen_figure_dino: {
    cellLayout: "zen_figure",
    figures: FIGURE_SETS.dino,
    origamiMix: FIGURE_SETS.dinoOrigamiMix, // páginas alternas en origami
    cellCount: 1,
    cellBorderWidthMm: 1.2,
    patternStrokeMm: 0.35,
    stringStrokeMm: 0.75,
    minGapMm: 1.9,
    sketchy: 0.3,
    fillDeadSpace: false,
  },  // Dinosaurios origami: contorno de pocos vértices y caras rectas, como papel doblado.
  zen_figure_dino_origami: {
    cellLayout: "zen_figure",
    figureStyle: "facet",
    figureAngular: true,
    figures: FIGURE_SETS.dinoOrigami,
    cellCount: 1,
    cellBorderWidthMm: 1.2,
    patternStrokeMm: 0.35,
    stringStrokeMm: 0.75,
    minGapMm: 1.9,
    sketchy: 0.3,
    fillDeadSpace: false,
  },  zen_figure_bio: {
    cellLayout: "zen_figure",
    figures: FIGURE_SETS.bio,
    cellCount: 1,
    cellBorderWidthMm: 1.2,
    patternStrokeMm: 0.35,
    stringStrokeMm: 0.75,
    minGapMm: 1.9,
    sketchy: 0.3,
    fillDeadSpace: false,
  },  // Críptidos del mundo (Pie Grande, Nessie, Mothman, chupacabras, kraken…).
  zen_figure_cryptids: {
    cellLayout: "zen_figure",
    figures: FIGURE_SETS.cryptids,
    // 1 de cada 4 páginas en origami: con 3 figuras origami y 9 normales, cada
    // una sale ~2,3 veces en un libro de 28 (con 1 de cada 3, las origami salían 3).
    origamiMix: FIGURE_SETS.cryptidsOrigami,
    origamiEvery: 4,
    cellCount: 1,
    cellBorderWidthMm: 1.2,
    patternStrokeMm: 0.35,
    stringStrokeMm: 0.75,
    minGapMm: 1.9,
    sketchy: 0.3,
    fillDeadSpace: false,
  },
  // La misma figura con fondo ligero (anillos sueltos): más rápida de colorear.
  zen_figure_light: {
    cellLayout: "zen_figure",
    figureBackground: "airy",
    figureAuras: [2, 4], // fondo ligero: la figura destaca (más fácil)
    figures: ADULT_FIGURES,
    cellCount: 1,
    cellBorderWidthMm: 1.2,
    patternStrokeMm: 0.38,
    stringStrokeMm: 0.75,
    minGapMm: 2.2,
    sketchy: 0.3,
    fillDeadSpace: false,
  },
  // Figura facetada (cubista / origami): cortes rectos en piezas grandes; la
  // mitad quedan lisas para colorear en bloque y el resto lleva un tangle.
  zen_figure_facet: {
    cellLayout: "zen_figure",
    figureStyle: "facet",
    figures: ADULT_FIGURES,
    cellCount: 1,
    cellBorderWidthMm: 1.2,
    patternStrokeMm: 0.36,
    stringStrokeMm: 0.7,
    minGapMm: 2.1,
    sketchy: 0.2,
    fillDeadSpace: false,
  },
  // Vitral: figura y fondo en piezas pequeñas y lisas con plomo grueso.
  zen_figure_glass: {
    cellLayout: "zen_figure",
    figureStyle: "glass",
    figures: ADULT_FIGURES,
    cellCount: 1,
    cellBorderWidthMm: 1.3,
    patternStrokeMm: 0.4,
    stringStrokeMm: 0.65,
    minGapMm: 2.2,
    sketchy: 0,
    fillDeadSpace: false,
  },
  // Mandala de iconos: uno al centro y anillos de copias giradas hacia afuera.
  icon_mandala: {
    cellLayout: "icon_mandala",
    cellCount: 1,
    samplerSolids: false,
    cellBorderWidthMm: 1.0,
    patternStrokeMm: 0.55,
    minGapMm: 2.0,
    sketchy: 0.15,
  },
  // Estrella subdividida como string: sus triángulos (más finos hacia las
  // puntas) y el fondo entre las puntas son las secciones a rellenar con tangles.
  zen_star: {
    cellLayout: "star",
    cellCount: 30,
    cellBorderWidthMm: 0.8,
    patternStrokeMm: 0.38,
    minStrokeMm: 0.28,
    minGapMm: 2.0,
    maxPatternPassesPerCell: 1,
    patternSkipProb: 0.04,
    whiteSpaceMm: 1.6,
    rotatePatterns: true,
    rotationSet: "ergonomic",
    innerOrganicBorderEnabled: false,
    enableDrawBehind: false,
    organicBorder: false,
    patternFamily: "mixed",
    paletteSize: 10,
    focusMode: false,
    borderStrokeMultiplier: 1.5,
  },
  // Pétalos facetados (cristal) en espiral áurea, encimados; cada faceta es una
  // sección con su tangle y el fondo lleva un tangle amplio.
  facet_spiral: {
    cellLayout: "facet_spiral",
    cellCount: 12,
    samplerSolids: false,
    cellBorderWidthMm: 1.0,
    patternStrokeMm: 0.5,
    minGapMm: 1.8,
    sketchy: 0,
  },
};

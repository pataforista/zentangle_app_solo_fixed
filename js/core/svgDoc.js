export const PAPER_SIZES_MM = {
  A4: { w: 210, h: 297 },
  LETTER: { w: 215.9, h: 279.4 },
  // Tamaños de corte (trim) habituales en KDP para libros de colorear
  KDP_8X10: { w: 203.2, h: 254 },
  KDP_SQUARE: { w: 215.9, h: 215.9 },
  KDP_6X9: { w: 152.4, h: 228.6 },
};

export const PAPER_LABELS = {
  A4: "A4",
  LETTER: "8.5×11 in",
  KDP_8X10: "8×10 in",
  KDP_SQUARE: "8.5×8.5 in",
  KDP_6X9: "6×9 in",
};

export function createSvgDoc({ wMm, hMm, meta = {} }) {
  return {
    wMm,
    hMm,
    defs: [],
    body: [],
    meta: {
      title: meta.title ?? "Zentangle Cells",
      generator: meta.generator ?? "zentangle",
      ...meta,
    },
  };
}

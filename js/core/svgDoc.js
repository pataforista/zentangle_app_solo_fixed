export const PAPER_SIZES_MM = {
  A4: { w: 210, h: 297 },
  LETTER: { w: 215.9, h: 279.4 },
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

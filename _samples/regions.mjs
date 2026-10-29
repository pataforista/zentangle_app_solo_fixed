// Regiones blancas de un raster RGBA (resvg): cuántas no se pueden colorear.
// La métrica vive en js/core/pageQuality.js (la usa también la app); aquí se
// conserva la firma antigua para los scripts de muestra.
import { analyzeColorability } from "../js/core/pageQuality.js";

export function whiteRegions(pixels, w, h, pxPerMm) {
  const { ink, bad, micro, regions } = analyzeColorability({ data: pixels, width: w, height: h }, pxPerMm);
  return { ink, bad, micro, regions };
}

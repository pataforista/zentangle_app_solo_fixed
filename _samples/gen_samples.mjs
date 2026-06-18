import { generateZentangleCells } from "../js/generators/zentangleCells.js";
import { renderSvgToString } from "../js/core/svgRender.js";
import { createSvgDoc } from "../js/core/svgDoc.js";
import { writeFileSync } from "node:fs";

const families = ["geometric", "organic", "dense", "tangles"];
const W = 210, H = 297, margin = 12;

for (const fam of families) {
  for (const seed of [101, 202]) {
    const doc = createSvgDoc({ wMm: W, hMm: H, meta: { title: fam, generator: "zentangle", seed } });
    await generateZentangleCells(doc, {
      seed,
      areaMm: { x: margin, y: margin, w: W - margin * 2, h: H - margin * 2 },
      cellLayout: "rect_bsp",
      cellCount: 7,
      minCellSizeMm: 22,
      sketchy: 0.4,
      patternFamily: fam,
    });
    const svg = renderSvgToString(doc);
    const name = `_samples/${fam}_${seed}.svg`;
    writeFileSync(name, svg);
    console.log("wrote", name, "body=", doc.body.length, "defs=", doc.defs.length);
  }
}

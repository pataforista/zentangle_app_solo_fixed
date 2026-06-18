import { generateZentangleCells } from "../js/generators/zentangleCells.js";
import { renderSvgToString } from "../js/core/svgRender.js";
import { createSvgDoc } from "../js/core/svgDoc.js";
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
const W=210,H=297,m=12;
const doc=createSvgDoc({wMm:W,hMm:H,meta:{seed:101}});
await generateZentangleCells(doc,{seed:101,areaMm:{x:m,y:m,w:W-2*m,h:H-2*m},cellLayout:"rect_bsp",cellCount:7,minCellSizeMm:22,sketchy:0.35,patternFamily:"tangles"});
const svg=renderSvgToString(doc);
// 300 DPI A4 = 2480 px de ancho
const img=new Resvg(svg,{background:"white",fitTo:{mode:"width",value:2480}}).render();
writeFileSync("_samples/hires_300dpi.png", img.asPng());
console.log("300 DPI:", img.width+"x"+img.height, "px");

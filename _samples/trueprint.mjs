import { generateZentangleCells } from "../js/generators/zentangleCells.js";
import { createSvgDoc } from "../js/core/svgDoc.js";
import { ZENTANGLE_PRESETS } from "../js/generators/zentangle.presets.js";
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
const W=210,H=297,m=12;
const preset=ZENTANGLE_PRESETS.kdp_tangles_classic;
const doc=createSvgDoc({wMm:W,hMm:H,meta:{seed:88}});
await generateZentangleCells(doc,{...preset,seed:88,areaMm:{x:m,y:m,w:W-2*m,h:H-2*m}});
const defs=doc.defs.length?`<defs>${doc.defs.join("")}</defs>`:"";
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="white"/>${doc.body.join("")}</svg>`;
const img=new Resvg(svg,{background:"white",fitTo:{mode:"width",value:2480}}).render();
const p=img.pixels;let bl=0;for(let k=0;k<p.length;k+=4)if(p[k]<128)bl++;
console.log("300DPI total ink:", (bl/(img.width*img.height)*100).toFixed(1)+"%");
// downscale for viewing
writeFileSync("_samples/trueprint.png", new Resvg(svg,{background:"white",fitTo:{mode:"width",value:760}}).render().asPng());

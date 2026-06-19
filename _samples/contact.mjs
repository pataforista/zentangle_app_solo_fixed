import { generateZentangleCells } from "../js/generators/zentangleCells.js";
import { createSvgDoc } from "../js/core/svgDoc.js";
import { ZENTANGLE_PRESETS } from "../js/generators/zentangle.presets.js";
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
const W=210,H=297;
const preset=ZENTANGLE_PRESETS.kdp_tangles_classic;
const seeds=[1,7,23,55,88,123,777,2024];
const thumbs=[];
for(const seed of seeds){
  const m=12;
  const doc=createSvgDoc({wMm:W,hMm:H,meta:{seed}});
  await generateZentangleCells(doc,{...preset,seed,areaMm:{x:m,y:m,w:W-2*m,h:H-2*m}});
  const defs=doc.defs.length?`<defs>${doc.defs.join("")}</defs>`:"";
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${defs}<rect width="${W}" height="${H}" fill="white"/>${doc.body.join("")}</svg>`;
  const png=new Resvg(svg,{background:"white",fitTo:{mode:"width",value:300}}).render();
  thumbs.push({png,seed,cells:doc.body.filter(s=>s.startsWith("<g clip")).length});
}
// montage 4 cols
const tw=300, th=Math.round(300*H/W), cols=4, rows=Math.ceil(seeds.length/cols), gap=12;
// Build an SVG embedding each PNG as data uri
let body=`<rect width="${cols*(tw+gap)+gap}" height="${rows*(th+gap+16)+gap}" fill="#ddd"/>`;
thumbs.forEach((t,i)=>{
  const x=gap+(i%cols)*(tw+gap), y=gap+Math.floor(i/cols)*(th+gap+16);
  const uri="data:image/png;base64,"+t.png.asPng().toString("base64");
  body+=`<image x="${x}" y="${y}" width="${tw}" height="${th}" href="${uri}"/>`;
  body+=`<text x="${x+4}" y="${y+th+12}" font-size="11" fill="#000">seed ${t.seed} · ${t.cells} celdas</text>`;
});
const MW=cols*(tw+gap)+gap, MH=rows*(th+gap+16)+gap;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${MW}" height="${MH}" viewBox="0 0 ${MW} ${MH}">${body}</svg>`;
writeFileSync("_samples/contact.png", new Resvg(svg,{background:"white"}).render().asPng());
console.log("contact sheet:", seeds.length, "seeds");

import { generateZentangleCells } from "../js/generators/zentangleCells.js";
import { renderSvgToString } from "../js/core/svgRender.js";
import { createSvgDoc } from "../js/core/svgDoc.js";
import { Resvg } from "@resvg/resvg-js";
const W=210,H=297,m=12;
async function pageCov(fam,seed){
  const doc=createSvgDoc({wMm:W,hMm:H,meta:{seed}});
  await generateZentangleCells(doc,{seed,areaMm:{x:m,y:m,w:W-2*m,h:H-2*m},cellLayout:"rect_bsp",cellCount:7,minCellSizeMm:22,sketchy:0.4,patternFamily:fam});
  const svg=renderSvgToString(doc);
  const img=new Resvg(svg,{background:"white",fitTo:{mode:"width",value:500}}).render();
  const d=img.pixels; let black=0; for(let i=0;i<d.length;i+=4){ if(d[i]<128) black++; }
  return black/(img.width*img.height)*100;
}
for(const fam of ["geometric","organic","dense"]){
  const vals=[];
  for(const seed of [1,2,3,4,5,7,11,42,77,101,202,303]) vals.push(await pageCov(fam,seed));
  const avg=vals.reduce((a,b)=>a+b,0)/vals.length, max=Math.max(...vals);
  console.log(fam.padEnd(10), "avg "+avg.toFixed(1)+"%", "max "+max.toFixed(1)+"%", "["+vals.map(v=>v.toFixed(0)).join(",")+"]");
}

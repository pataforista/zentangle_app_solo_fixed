import * as T from "../js/generators/patterns/tangles.js";
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
const fns = Object.entries(T).filter(([k,v])=>k.startsWith("fill")&&typeof v==="function");
function rngF(seed){ let s=seed; return ()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; }; }
const cfg={sketchy:0.25,minGapMm:1.4,patternStrokeMm:0.35};
const cell=Number(process.argv[2]||45), pad=6, cols=fns.length;
const W=cols*(cell+pad)+pad, H=cell+pad*2+8;
let body=`<rect width="${W}" height="${H}" fill="white"/>`;
function cov(d,size){const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="white"/><path d="${d}" fill="none" stroke="#000" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;const img=new Resvg(svg,{background:"white"}).render();const p=img.pixels;let bl=0;for(let i=0;i<p.length;i+=4)if(p[i]<128)bl++;return bl/(img.width*img.height)*100;}
fns.forEach(([name,fn],idx)=>{
  const cx=pad+idx*(cell+pad), cy=pad;
  const r={x0:cx,y0:cy,x1:cx+cell,y1:cy+cell};
  let d=""; try{d=fn(rngF(7),r,cfg)||"";}catch(e){d="";name+=" ERR:"+e.message;}
  body+=`<rect x="${cx}" y="${cy}" width="${cell}" height="${cell}" fill="none" stroke="#bbb" stroke-width="0.3"/>`;
  if(d) body+=`<path d="${d}" fill="none" stroke="#000" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round"/>`;
  const c=d?cov(d,cell).toFixed(0):"-";
  body+=`<text x="${cx+1}" y="${cy+cell+5}" font-size="3.2" fill="#c00">${name.replace('fill','')} ${c}%</text>`;
});
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm" viewBox="0 0 ${W} ${H}">${body}</svg>`;
writeFileSync(`_samples/tg_${cell}.png`, new Resvg(svg,{background:"white",fitTo:{mode:"width",value:1400}}).render().asPng());
console.log("wrote _samples/tg_"+cell+".png");

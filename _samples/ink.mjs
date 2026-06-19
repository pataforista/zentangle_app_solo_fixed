import * as G from "../js/generators/patterns/geometric.js";
import * as O from "../js/generators/patterns/organic.js";
import * as C from "../js/generators/patterns/complex.js";
import * as D from "../js/generators/patterns/dense.js";
import { Resvg } from "@resvg/resvg-js";
const all = { ...G, ...O, ...C, ...D };
const fns = Object.entries(all).filter(([k,v]) => k.startsWith("fill") && typeof v==="function");
function rngFactory(seed){ let s=seed; return ()=>{ s=(s*1103515245+12345)&0x7fffffff; return s/0x7fffffff; }; }
const cfg = { sketchy:0, minGapMm:1.4, patternStrokeMm:0.35 };
const sizes = [20, 45, 80];
const px = 300; // render each cell at 300px
function coverage(d, size){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="white"/><path d="${d}" fill="none" stroke="#000" stroke-width="0.35" stroke-linecap="round"/></svg>`;
  const png=new Resvg(svg,{background:"white"}).render();
  const buf=png.asPng();
  // decode via resvg pixels? use render().pixels
  return null;
}
// Use pixels buffer
function cov(d, size){
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="white"/><path d="${d}" fill="none" stroke="#000" stroke-width="0.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const r=new Resvg(svg,{background:"white"});
  const img=r.render();
  const data=img.pixels; // RGBA
  let black=0, total=img.width*img.height;
  for(let i=0;i<data.length;i+=4){ if(data[i]<128) black++; }
  return black/total;
}
const rows=[];
for(const [name,fn] of fns){
  const out=[name.padEnd(20)];
  for(const size of sizes){
    const rng=rngFactory(999);
    const r={x0:0,y0:0,x1:size,y1:size};
    let d=""; try{ d=fn(rng,r,cfg)||""; }catch(e){ d=""; }
    out.push((cov(d,size)*100).toFixed(1).padStart(6));
  }
  rows.push(out.join(" "));
}
console.log("PATTERN".padEnd(20), sizes.map(s=>(s+"mm").padStart(6)).join(" "));
console.log(rows.join("\n"));

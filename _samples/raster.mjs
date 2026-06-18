import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

for (const f of readdirSync("_samples").filter(f => f.endsWith(".svg"))) {
  const svg = readFileSync(`_samples/${f}`, "utf8");
  const r = new Resvg(svg, { background: "white", fitTo: { mode: "width", value: 700 } });
  const png = r.render().asPng();
  const out = `_samples/${f.replace(".svg", ".png")}`;
  writeFileSync(out, png);
  console.log("rendered", out);
}

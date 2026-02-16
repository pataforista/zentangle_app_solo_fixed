
import { generateZentangleCells } from "./js/generators/zentangleCells.js";
import { PathBuilder } from "./js/core/pathBuilder.js";

console.log("Starting verification...");

const doc = {
    body: [],
    defs: [],
    meta: { title: "Test", generator: "test", seed: 1 }
};

const opts = {
    seed: 12345,
    areaMm: { x: 0, y: 0, w: 100, h: 100 },
    cellLayout: "rect_bsp",
    cellCount: 5,
    minCellSizeMm: 10,
    sketchy: 0.5,
    patternFamily: "geometric" // Test geometric patterns
};

try {
    generateZentangleCells(doc, opts);
    console.log("Generated cells successfully.");
    console.log("Body length:", doc.body.length);
    console.log("Defs length:", doc.defs.length);

    if (doc.body.length > 0) {
        console.log("Verification Passed!");
    } else {
        console.error("Verification Failed: No output generated.");
        process.exit(1);
    }
} catch (error) {
    console.error("Verification Error:", error);
    process.exit(1);
}

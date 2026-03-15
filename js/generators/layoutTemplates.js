/**
 * layoutTemplates.js
 * Predefined geometric structures for Zentangle layout.
 * Polygons are defined in normalized coordinates (0.0 to 1.0).
 */

export const LAYOUT_TEMPLATES = {
  classic_z: [
    // A Z-shape string typically creates 3 or 4 major regions
    {
      name: "Top-Left Triangle",
      poly: [{ x: 0, y: 0 }, { x: 0.9, y: 0.1 }, { x: 0.1, y: 0.9 }]
    },
    {
      name: "Bottom-Right Triangle",
      poly: [{ x: 1, y: 1 }, { x: 0.1, y: 0.9 }, { x: 0.9, y: 0.1 }]
    },
    {
      name: "Top-Right Strip",
      poly: [{ x: 0.9, y: 0.1 }, { x: 1, y: 0 }, { x: 1, y: 1 }]
    },
    {
      name: "Bottom-Left Strip",
      poly: [{ x: 0.1, y: 0.9 }, { x: 0, y: 1 }, { x: 0, y: 0 }]
    }
  ],

  classic_s: [
    // S-curve partitions
    {
      name: "S-Left",
      poly: [
        { x: 0, y: 0 }, 
        { x: 0.5, y: 0 }, 
        { x: 0.6, y: 0.3 }, 
        { x: 0.4, y: 0.7 }, 
        { x: 0.5, y: 1 }, 
        { x: 0, y: 1 }
      ]
    },
    {
      name: "S-Right",
      poly: [
        { x: 1, y: 0 }, 
        { x: 0.5, y: 0 }, 
        { x: 0.6, y: 0.3 }, 
        { x: 0.4, y: 0.7 }, 
        { x: 0.5, y: 1 }, 
        { x: 1, y: 1 }
      ]
    }
  ],

  eye: [
    // Central lens shape
    {
      name: "Center Lens",
      poly: [
        { x: 0.2, y: 0.5 }, { x: 0.35, y: 0.3 }, { x: 0.65, y: 0.3 }, 
        { x: 0.8, y: 0.5 }, { x: 0.65, y: 0.7 }, { x: 0.35, y: 0.7 }
      ]
    },
    {
      name: "Top",
      poly: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.8, y: 0.5 }, { x: 0.65, y: 0.3 }, { x: 0.35, y: 0.3 }, { x: 0.2, y: 0.5 }]
    },
    {
      name: "Bottom",
      poly: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 0.8, y: 0.5 }, { x: 0.65, y: 0.7 }, { x: 0.35, y: 0.7 }, { x: 0.2, y: 0.5 }]
    }
  ],

  burst: [
    // 4 Slices from center
    { poly: [{ x: 0.5, y: 0.5 }, { x: 0, y: 0 }, { x: 1, y: 0 }] },
    { poly: [{ x: 0.5, y: 0.5 }, { x: 1, y: 0 }, { x: 1, y: 1 }] },
    { poly: [{ x: 0.5, y: 0.5 }, { x: 1, y: 1 }, { x: 0, y: 1 }] },
    { poly: [{ x: 0.5, y: 0.5 }, { x: 0, y: 1 }, { x: 0, y: 0 }] }
  ],

  grid: [
    // Standard 3x3 grid
    { poly: [{x:0, y:0}, {x:0.33, y:0}, {x:0.33, y:0.33}, {x:0, y:0.33}] },
    { poly: [{x:0.33, y:0}, {x:0.66, y:0}, {x:0.66, y:0.33}, {x:0.33, y:0.33}] },
    { poly: [{x:0.66, y:0}, {x:1, y:0}, {x:1, y:0.33}, {x:0.66, y:0.33}] },
    { poly: [{x:0, y:0.33}, {x:0.33, y:0.33}, {x:0.33, y:0.66}, {x:0, y:0.66}] },
    { poly: [{x:0.33, y:0.33}, {x:0.66, y:0.33}, {x:0.66, y:0.66}, {x:0.33, y:0.66}] },
    { poly: [{x:0.66, y:0.33}, {x:1, y:0.33}, {x:1, y:0.66}, {x:0.66, y:0.66}] },
    { poly: [{x:0, y:0.66}, {x:0.33, y:0.66}, {x:0.33, y:1}, {x:0, y:1}] },
    { poly: [{x:0.33, y:0.66}, {x:0.66, y:0.66}, {x:0.66, y:1}, {x:0.33, y:1}] },
    { poly: [{x:0.66, y:0.66}, {x:1, y:0.66}, {x:1, y:1}, {x:0.66, y:1}] }
  ],

  spiral: [
    // A Fibonacci-ish spiral block layout
    { poly: [{x:0, y:0}, {x:0.6, y:0}, {x:0.6, y:0.6}, {x:0, y:0.6}] },
    { poly: [{x:0.6, y:0}, {x:1, y:0}, {x:1, y:1}, {x:0.6, y:1}] },
    { poly: [{x:0, y:0.6}, {x:0.6, y:0.6}, {x:0.6, y:1}, {x:0, y:1}] },
    { poly: [{x:0.2, y:0.2}, {x:0.4, y:0.2}, {x:0.4, y:0.4}, {x:0.2, y:0.4}] }
  ]
};

export function getTemplateCells(templateName, rect) {
  const template = LAYOUT_TEMPLATES[templateName] || LAYOUT_TEMPLATES.classic_z;
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;

  return template.map(t => {
    const poly = t.poly.map(p => ({
      x: rect.x0 + p.x * w,
      y: rect.y0 + p.y * h
    }));
    return { kind: "poly", bbox: _bbox(poly), poly };
  });
}

function _bbox(poly) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of poly) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

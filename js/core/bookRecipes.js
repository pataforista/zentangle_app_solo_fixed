// bookRecipes.js
// Tipos de libro de un clic: cada receta fija el estilo y las opciones del
// libro que mejor le van, y el tema de la ficha de KDP. Después todo se
// puede ajustar a mano.
//
// designs: los temas con pocas figuras se quedan en ~2 vueltas (la segunda
// vuelta va en espejo y con otra paleta), así no se notan repeticiones.

export const BOOK_RECIPES = [
  { id: "adult", label: "🪶 Zentangle para adultos", hint: "Koi, colibrí, nautilus, rosa, pavo real y abstractas. Guía de tangles y dobles páginas.",
    style: "zen_figure", designs: 40, progressive: false, guide: true, spreads: true, turn: true },
  { id: "mix", label: "💰 Mezcla más vendida", hint: "Figuras, mandalas, muestrarios y mosaicos repartidos. Lo más variado.",
    style: "best_sellers", designs: 50, progressive: false, guide: true, spreads: false, turn: false },
  { id: "glass", label: "🪟 Vitral relajante", hint: "Piezas grandes y lisas: el más fácil y rápido de colorear.",
    style: "zen_figure_glass", designs: 30, progressive: false, guide: false, spreads: false, turn: false },
  { id: "dino", label: "🦖 Dinosaurios", hint: "T. rex, braquiosaurio, pterosaurio, plesiosaurio… con patrones, y estegosaurio y triceratops en origami; de fácil a difícil.",
    style: "zen_figure_dino", designs: 22, progressive: true, guide: true, spreads: false, turn: false },
  { id: "origami", label: "🦕 Solo origami", hint: "Dinosaurios como papel doblado: líneas rectas y caras grandes, fáciles de colorear. Los bípedos (T. rex…) llegarán con silueta ilustrada.",
    style: "zen_figure_dino_origami", designs: 20, progressive: false, guide: false, spreads: false, turn: false },
  { id: "bio", label: "🧬 Biología", hint: "Neurona, ADN, células, ameba, tardígrado, escarabajo, matraz, brote… ciencia para colorear.",
    style: "zen_figure_bio", designs: 26, progressive: true, guide: false, spreads: false, turn: false },
  { id: "cryptids", label: "👣 Críptidos", hint: "Nessie, Mothman, kraken, alien gris, ovni, hombre rana, duende, hombre búho y Wendigo.",
    style: "zen_figure_cryptids", designs: 18, progressive: false, guide: false, spreads: false, turn: true },
  { id: "flow", label: "🌀 Flujo de patrones", hint: "Página completa sin figura: bandas curvas o estallido radial, cada región con un patrón distinto. De fácil a difícil.",
    style: "zen_flow_mix", designs: 30, progressive: true, guide: true, spreads: false, turn: false },
  { id: "kids", label: "🧸 Infantil", hint: "Animales tiernos con huecos amplios, de fácil a difícil.",
    style: "zen_figure_kids", designs: 28, progressive: true, guide: false, spreads: false, turn: false },
];

// Tema de la ficha de KDP según el estilo elegido.
export const STYLE_THEME = {
  zen_figure: "adult", zen_figure_light: "adult", zen_figure_facet: "adult", zen_figure_glass: "glass",
  zen_figure_dino: "dino", zen_figure_dino_origami: "dino", zen_figure_bio: "bio", zen_figure_cryptids: "cryptids", zen_figure_kids: "kids", zen_flow_mix: "flow", zen_flow_bands: "flow", zen_flow_radial: "flow",
};

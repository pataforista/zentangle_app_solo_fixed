// bookRecipes.js
// Tipos de libro de un clic: cada receta fija el estilo y las opciones del
// libro que mejor le van, y el tema de la ficha de KDP. Después todo se
// puede ajustar a mano.
//
// designs: los temas con pocas figuras se quedan en ~2 vueltas (la segunda
// vuelta va en espejo y con otra paleta), así no se notan repeticiones.

export const BOOK_RECIPES = [
  { id: "adult", label: "🪶 Zentangle para adultos", hint: "Koi, colibrí, nautilus, rosa, lobo y abstractas. Guía de tangles y dobles páginas.",
    style: "zen_figure", designs: 40, progressive: false, guide: true, spreads: true, turn: true },
  { id: "mix", label: "💰 Mezcla más vendida", hint: "Figuras, mandalas, muestrarios y mosaicos repartidos. Lo más variado.",
    style: "best_sellers", designs: 50, progressive: false, guide: true, spreads: false, turn: false },
  { id: "glass", label: "🪟 Vitral relajante", hint: "Piezas grandes y lisas: el más fácil y rápido de colorear.",
    style: "zen_figure_glass", designs: 30, progressive: false, guide: false, spreads: false, turn: false },
  { id: "dino", label: "🦖 Dinosaurios", hint: "Mitad origami (T. rex, raptor, triceratops…) y mitad con patrones (braquiosaurio, pterosaurio, plesiosaurio…), de fácil a difícil.",
    style: "zen_figure_dino", designs: 34, progressive: true, guide: true, spreads: false, turn: false },
  { id: "origami", label: "🦕 Solo origami", hint: "Todos los dinosaurios como papel doblado: líneas rectas y caras grandes, fáciles de colorear.",
    style: "zen_figure_dino_origami", designs: 34, progressive: false, guide: false, spreads: false, turn: false },
  { id: "bio", label: "🧬 Biología", hint: "Neurona, ADN, células, virus, corazón… ciencia para colorear.",
    style: "zen_figure_bio", designs: 26, progressive: true, guide: false, spreads: false, turn: false },
  { id: "cryptids", label: "👣 Críptidos", hint: "Pie Grande, Nessie, Mothman, kraken, yeti, ovni y más; 1 de cada 4 páginas en origami.",
    style: "zen_figure_cryptids", designs: 28, progressive: false, guide: false, spreads: false, turn: true },
  { id: "kids", label: "🧸 Infantil", hint: "Animales tiernos con huecos amplios, de fácil a difícil.",
    style: "zen_figure_kids", designs: 28, progressive: true, guide: false, spreads: false, turn: false },
];

// Tema de la ficha de KDP según el estilo elegido.
export const STYLE_THEME = {
  zen_figure: "adult", zen_figure_light: "adult", zen_figure_facet: "adult", zen_figure_glass: "glass",
  zen_figure_dino: "dino", zen_figure_dino_origami: "dino", zen_figure_bio: "bio", zen_figure_cryptids: "cryptids", zen_figure_kids: "kids",
};

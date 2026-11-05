// figureNames.js
// Nombre en español de cada figura, para el texto que se imprime en el libro
// (página de soluciones). Los ids internos (trex, barn_owl…) no deben llegar
// al lector. Una figura sin nombre aquí (p. ej. importada) se muestra con su
// id legible: «barn_owl» → «barn owl».
export const FIGURE_NAMES_ES = {
  owl: "búho", cat: "gato", fish: "pez", butterfly: "mariposa", heart: "corazón",
  turtle: "tortuga", flower: "flor", leaf: "hoja", elephant: "elefante", snail: "caracol",
  bird: "pájaro", whale: "ballena", dragonfly: "libélula", mushroom: "hongo", tree: "árbol",
  moon: "luna", bear: "oso", rabbit: "conejo", penguin: "pingüino", fox: "zorro",
  koi: "pez koi", hummingbird: "colibrí", feather: "pluma", nautilus: "nautilus",
  lunamoth: "polilla luna", hamsa: "hamsa", vase: "jarrón", lotus: "loto", ribbons: "cintas",
  drops: "gotas", orbs: "esferas", crystals: "cristales", neuron: "neurona", brain: "cerebro",
  dna: "ADN", plantcell: "célula vegetal", animalcell: "célula animal",
  mitochondrion: "mitocondria", virus: "virus", chromosome: "cromosoma",
  trex: "tiranosaurio", spinosaurus: "espinosaurio", parasaurolophus: "parasaurolofo",
  stegosaurus: "estegosaurio", triceratops: "triceratops", brachiosaurus: "braquiosaurio",
  ankylosaurus: "anquilosaurio", pterosaur: "pterosaurio", allosaurus: "alosaurio",
  velociraptor: "velocirraptor", pachycephalosaurus: "paquicefalosaurio", iguanodon: "iguanodonte",
  diplodocus: "diplodocus", dimetrodon: "dimetrodon", plesiosaur: "plesiosaurio",
  mosasaurus: "mosasaurio", ammonite: "amonite", bacterium: "bacteria", jellyfish: "medusa",
  heartorgan: "corazón humano", eyeball: "ojo", diatom: "diatomea", rose: "rosa",
  succulent: "suculenta", seahorse: "caballito de mar", octopus: "pulpo", wolf: "lobo",
  horse: "caballo", peacock: "pavo real", sittingcat: "gato sentado", teapot: "tetera",
  sun: "sol", bigfoot: "Pie Grande", greyalien: "extraterrestre", seaserpent: "serpiente marina",
  wendigo: "wendigo", flatwoods: "monstruo de Flatwoods", nessie: "Nessie", mothman: "Mothman",
  chupacabra: "chupacabras", kraken: "kraken", yeti: "yeti", ufo: "ovni",
  jerseydevil: "diablo de Jersey", thunderbird: "pájaro del trueno", jackalope: "jackalope",
  beetle: "escarabajo", flask: "matraz", sprout: "brote", amoeba: "ameba",
  tardigrade: "tardígrado", deathworm: "gusano de la muerte", frogman: "hombre rana",
  goblin: "duende", owlman: "hombre búho", snowflake: "copo de nieve", bell: "campana",
  candle: "vela", reindeer: "reno", sleepycat: "gato dormido", playfulcat: "gato juguetón",
};

export const figureNameEs = (id) => FIGURE_NAMES_ES[id] || String(id || "").replace(/[_-]+/g, " ").trim();

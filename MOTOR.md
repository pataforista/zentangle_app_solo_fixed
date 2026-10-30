# Cómo funciona el motor de figuras

Mapa corto para revisar y decidir mejoras. El motor vive casi entero en
`js/generators/figure.js` (~2300 líneas); el resto lo orquesta.

## Recorrido de una página

```
app.js ──► zentangle.generator.js ──► figure.js (generateZenFigure) ──► SVG
 (libro)     elige figura, paleta,       dibuja la página                │
             espejo; relleno de huecos                                    ▼
                                                     pageQuality.js: control de calidad
```

1. **Elección** (`zentangle.generator.js`): el estilo trae un repertorio
   (`figures`: adultas, dinos, biología, críptidos, infantil). En un libro,
   `figureForPage` recorre todo el repertorio antes de repetir; la repetida
   va en espejo y con otra **paleta de 8 tangles** (`figurePalette`).
2. **Encaje** (`generateZenFigure`): la silueta se escala al marco y se
   coloca según el **encuadre** sorteado: centrada (40 %), más pequeña en un
   lado (35 %) o en primer plano recortada (25 %).
3. **Fondo**: rayos, strings o facetas, con tangles amplios (`BG_POOL`).
4. **Auras**: 1–2 ecos del contorno (2–4 en «fondo ligero»).
5. **Figuritas escondidas** en el fondo: 2–3 siluetas del mismo tema.
6. **Figura**: `back` (piezas detrás) → `parts` (se subdividen) → `front`
   (piezas delante, con halo blanco) → copia escondida dentro → `deco`
   (ojos, picos, líneas).
7. **Subdivisión de cada parte** (`makeSections`): dos familias de cuerdas
   curvas (A y B) cortan la parte en secciones; cada sección lleva un
   tangle, a veces una banda de eco o un orbe; pocas quedan lisas.
   Facetado/vitral usan `facetSections` (cortes rectos).
8. **Calidad** (`pageQuality.js`): cuenta zonas donde no cabe la punta del
   rotulador y el mayor hueco vacío.

## Cómo se define una figura

Coordenadas en unidades de figura (x, y de −1 a 1, y hacia abajo):

```js
trex: {
  parts:  [{ cmds: TREX2, strings: { angle: 0.35, a: [2, 3], b: [2, 3] } }], // se subdivide
  back:   [{ cmds: FAR_LEG2, tangle: "round" }],    // detrás, con un tangle amplio
  front:  [{ cmds: NEAR_LEG2, tangle: "round" }, { cmds: ARM2, tangle: null }], // delante
  deco:   () => [{ cmds: ell(0.74, -0.46, 0.028), fill: W }],             // ojo
  silhouette: [TREX2, FAR_LEG2],  // contorno exterior (auras, encaje)
  branch: 0.9,                    // suelo a esta altura
  science: "dino", hide: true,    // tema; puede esconderse como figurita
}
```

Formas: `smoothPoly(puntos)` (contorno suave), `taper(puntos, w0, w1)`
(ramas, patas, tentáculos), `ell(cx, cy, rx, ry)`, `xform(...)` (mover,
girar, escalar), comandos `M/L/Q/C/Z`.

## Perillas principales

| Qué | Dónde | Valor actual |
|---|---|---|
| Cuántos cortes por parte | `strings.a` / `strings.b` de cada figura | 1–5 |
| Tamaño mínimo de sección con tangle | `partSvg`: `gap * gap * 14` | ~50 mm² |
| Secciones lisas | `partSvg`: 1 por parte, < 12 % | 25 % de prob. |
| Encuadres | `layouts` en `generateZenFigure` | 40/35/25 % |
| Auras | `figureAuras` del estilo | 1–2 |
| Figuritas escondidas | `nHidden` | 2–3 |
| Márgenes antiastillas | `gap * 1.5` en cuerdas, aristas, marco, piezas con tangle y orbes | — |
| Secciones muy alargadas | `partSvg`: proporción > 4.5 y ancho < 5 huecos quedan lisas | — |
| Límite de calidad | `QUALITY_LIMITS` en `pageQuality.js` | 13 zonas/dm², 25 % tinta |

## Ideas de mejora (para decidir juntos)

1. **Siluetas dibujadas a mano**: importar SVG de un ilustrador para las
   figuras clave (el motor ya acepta cualquier contorno cerrado). Es el
   salto de calidad más grande: las formas por puntos tienen techo.
2. **Cuerdas que siguen la anatomía**: hoy cortan en ángulo fijo; podrían
   seguir el eje del cuerpo (cuello, cola, patas) como en los libros hechos
   a mano.
3. **Tangle según la zona**: escamas en el lomo, rayas en la cola, puntos en
   el vientre, en vez de sorteo libre.
4. **Escenas**: 2–3 figuras del mismo tema en una página (manada, arrecife).
5. **Fondos temáticos**: helechos y volcanes en prehistoria, estrellas en
   críptidos, moléculas en biología.
6. **Grosor de línea variable**: contorno grueso, detalles finos (más
   «hecho a mano»).
7. **Página de soluciones** para las figuritas escondidas.

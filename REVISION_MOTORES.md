# Revisión de motores y plan (14 nov 2026)

Revisión de `main` (`5372ab2`) hecha generando páginas, no releyendo código:
hojas de contacto de los 8 tipos de libro (12 páginas cada uno), una página de
cada uno de los 55 estilos, medición de contraste figura/fondo en 148 páginas,
páginas de cortesía, guía, portada y doble página, ficha y regalías, las tres
auditorías del proyecto y recorrido de la interfaz en Chromium (incluidos los
botones secundarios). No se cambió código y ninguna reparación está empezada.

**Para quién:** quien mantiene la app y decide qué construir a continuación.
**Qué decide:** el orden de trabajo para que los libros compitan por aspecto,
no solo por cumplir KDP.

## 1. Estado comprobado

| Comprobación | Resultado |
|---|---|
| `npm test` (23 pruebas + golden de 168 páginas) | Pasa (7 min 22 s) |
| `npm run e2e` (libro de 12 diseños, PDF de 47 páginas, ficha) | Pasa (46 s) |
| Interfaz en escritorio (1400 px) y móvil (390 px) | Sin errores de consola |
| `npm run audit:books` (8 libros completos) | Pasa: 0 pares casi iguales, huecos dentro de lo prometido |
| `npm run audit:patterns` | Ejecutado: ver T1 |
| Botones secundarios con un libro preparado (libro abierto, ficha, biblioteca, PDF) | Funcionan, sin errores de consola |
| `bd` (Beads) | No instalado en este entorno: no se crearon tareas |
| `npm run colorability` | No ejecutado (la prueba 18 cubre lo mismo) |

La parte de producción (receta, revisión, PDF, ficha, portada borrador) funciona.
Los problemas que quedan son de **aspecto de la página**, y las pruebas actuales
no los ven porque miden colorabilidad, no legibilidad de la figura.

## 2. Medición nueva: contraste y cobertura

Tinta dentro de la silueta frente a tinta fuera, y parte del marco que ocupa la
figura (semilla 20261031, primeras 20 páginas de cada tipo; «mezcla» solo tiene
8 páginas con figura).

| Libro | Cobertura media (mín.) | Tinta dentro / fuera | Razón media | Páginas con razón < 1.25 | Páginas con cobertura < 20 % |
|---|---|---|---|---|---|
| Infantil | 33 % (14 %) | 15.3 / 6.3 % | 2.59 | 0/20 | 2/20 |
| Adultos | 25 % (9 %) | 20.2 / 10.4 % | 2.02 | 0/20 | 9/20 |
| Mezcla | 27 % (7 %) | 19.3 / 10.0 % | 1.98 | 0/8 | 3/8 |
| Biología | 25 % (6 %) | 16.9 / 9.4 % | 1.80 | 0/20 | 8/20 |
| Críptidos | 20 % (8 %) | 19.1 / 11.6 % | 1.68 | 3/20 | 12/20 |
| Dinosaurios | 15 % (7 %) | 16.4 / 10.7 % | 1.59 | 5/20 | 18/20 |
| Vitral | 30 % (11 %) | 12.7 / 9.0 % | 1.43 | 4/20 | 6/20 |
| Solo origami | 13 % (7 %) | 16.3 / 12.7 % | 1.28 | 7/20 | 19/20 |

El orden de la tabla coincide con la impresión visual: el infantil es el libro
que mejor se lee y el origami el que peor. En vitral la razón baja es parte del
estilo (mismas piezas dentro y fuera; la figura se separa por el contorno grueso).

## 3. Hallazgos

### Defectos (llegan al papel)

| # | Hallazgo | Evidencia | Causa |
|---|---|---|---|
| D1 | **Las escenas salen rotas**: el fondo aparece en parches rectangulares cortados, con la mitad de la página vacía | `zen_scene`, `zen_scene_dino`, `zen_scene_ocean`, 6 de 6 páginas, en resvg y en Chromium | `generateZenScene` llama a `generateZenFigure` por figura con su `subArea`; el fondo temático y las figuritas escondidas se recortan a ese rectángulo (`figure.js:3344`) |
| D2 | **Figuritas de otro tema en las escenas**: dinosaurios escondidos en el océano | Mismas páginas | La reserva de figuritas sale de `science` de cada figura (`figure.js:2922`), no del tema de la escena |
| D3 | **Origami: la figura se pierde en el fondo** | Razón 1.28; T. rex 1.04, triceratops 1.06, diplodoco 1.06 | Figura y fondo usan las mismas facetas y los mismos tangles; solo cambia el grosor del contorno |
| D4 | **Bípedos en origami ilegibles** (T. rex, alosaurio, espinosaurio, parasaurolofus, diablo de Jersey, chupacabras) | Hojas de dinosaurios, origami y críptidos | Silueta de trazos delgados simplificada a pocos vértices: cobertura 11–13 % |

Las escenas no están en ninguna receta de un clic, pero sí en «Ver todos los
estilos». La prueba 22 comprueba que la escena se compone, no cómo se ve.

### Oportunidades de calidad (lo que separa de un libro ilustrado)

| # | Hallazgo | Evidencia |
|---|---|---|
| Q1 | **Figuras pequeñas**: en dinosaurios 18 de 20 páginas tienen la figura por debajo del 20 % del marco; en críptidos 12 de 20; en adultos 9 de 20 | Tabla §2; página 5 de adultos (loto en una esquina) |
| Q2 | **Siluetas que no se reconocen**: el caballo parece una pieza de ajedrez, el reno un cristal, el gato dormido un octágono | Hojas de adultos y de estilos sin receta |
| Q3 | **El importador de siluetas existe y casi no se usa**: 1 figura importada (`figures/birds/barn_owl`) frente a 101 dibujadas por puntos | `figures/` |
| Q4 | **Figuritas escondidas sin relación con la página**: magdalenas y teteras junto al lobo; copia de la figura dentro de sí misma | Hoja de adultos; `HIDEABLE_ADULT` |
| Q5 | **El infantil no usa el perfil grueso**: trazo de patrón 0.35 mm y secciones pequeñas dentro de la figura | `zen_figure_kids` y receta `kids`; el perfil `bold` solo se aplica desde el menú |
| Q6 | **Temas con ficha pero sin libro**: océano (10 figuras), aves (6), gatos (4), Navidad (5) | `FIGURE_SETS`; `bookListing.js` ya trae sus fichas |
| Q7 | **24 estilos geométricos casi iguales** (`kdp_*`, `*_editorial`, `classic_*`) | Hoja de estilos heredados |

### Patrones, doble página, portada y cortesía

| # | Hallazgo | Evidencia |
|---|---|---|
| T1 | **Algunos patrones dejan manchitas en ciertas formas de celda**: Printemps en hexágono (132 manchitas por celda), Paradox en cuadrado (32), Flux (23), Circuit en banda (19), Crosses (8–10) | `npm run audit:patterns`; la prueba 18 solo vigila la suma (195 de un techo de 250) |
| S1 | **La doble página parte la figura por el lomo**: el centro del dibujo, la zona con más detalle, cae en la encuadernación | `generateSpread`, semilla 77; `SPREAD_FIGURES` centra la figura en la unión |
| C1 | **La portada es texto negro sobre blanco**: sin arte, sin color, contraportada sin miniaturas | `generateCoverSvg`; la app la llama «borrador» |
| C2 | **Páginas de cortesía planas**: portadilla sin ornamento, créditos en letra muy pequeña, página de prueba casi vacía (sin casillas para probar colores), sin página final de reseña | `frontMatter.js`; no hay ninguna mención a «reseña» en el código |
| C3 | **Repeticiones por encima de lo que dice la receta**: dinosaurios y origami tienen 15 figuras para 34 páginas (alguna sale 3 veces) | `audit:books`: «repetición máx 3»; `bookRecipes.js` promete ~2 vueltas |

### Ficha y venta

| # | Hallazgo | Evidencia |
|---|---|---|
| L1 | **La tabla de regalías usa tarifas que no coinciden con las de KDP**: 60 % siempre y coste de 0.85 USD + 0.01 por página | `bookListing.js:17–40`. KDP paga 50 % por debajo de 9.99 USD desde el 10 de junio de 2025 y publica otro coste fijo y por página [1][2]. Para 8.99 USD la app muestra 4.40 USD de regalía; con el 50 % sería menos |
| L2 | **Faltan palabras clave**: 6 de 7 en español y 5 de 7 en inglés | Ficha bilingüe de dinosaurios: el filtro quita las que repiten el título y no repone |
| L3 | **Palabras clave genéricas** («libro», «book») | KDP aconseja evitar términos comunes a toda la categoría [3] |
| L4 | **Dos motores de ficha distintos**: `kdpListing.js` (español) y `bookListing.js` (bilingüe, regalías) con textos y palabras clave diferentes para el mismo libro | «Descargar todo» usa el primero; el botón bilingüe, el segundo |
| L5 | **Sin recordatorio de la declaración de contenido de IA** | KDP pide declarar imágenes creadas por una herramienta de IA [4]. Insufficient data sobre cómo clasifica KDP el arte procedural |
| L6 | **Categorías infantiles** (Juvenile Nonfiction) en un libro que la ficha vende «para niños y adultos» | Ficha bilingüe de dinosaurios. Insufficient data sobre qué categorías convierten mejor |

### Interfaz

| # | Hallazgo | Evidencia |
|---|---|---|
| U1 | **«Descargar todo» no baja todo**: deja fuera la portada, la ficha bilingüe y las maquetas | `bookExport.js:102` (PDF, ficha en español y receta) |
| U2 | **La vista de libro abierto tarda más de 15 s** con 29 páginas y no muestra avance | Recorrido en Chromium |
| U3 | **Ficha bilingüe y maquetas escondidas** en apartados plegados del paso 4 | `index.html:891–960` |
| U4 | En móvil, el aviso de estado tapa miniaturas | Pendiente de la revisión anterior |

### Oportunidades de ingeniería

| # | Hallazgo | Evidencia |
|---|---|---|
| I1 | **El contraste solo se mide en el navegador** y con un umbral que casi nunca salta (`contraste ≥ 0`) | `analyzeContrast` usa `Path2D`; `audit:books` y `npm test` no lo ven. El T. rex de 1.04 pasa |
| I2 | **`npm test` tarda más de 7 minutos** | Medido. Insufficient data: no se midió qué pruebas pesan más |
| I3 | **`figure.js` pesa 221 KB** (figuras, motor, fondos y escenas juntos) | Pendiente M12 de `REVISION_Y_PLAN.md`, sin hacer |
| I4 | Nombre «Zentangle Creator» en la interfaz (marca registrada) | Pendiente de decisión desde la revisión anterior |
| I5 | La versión del motor está escrita en dos sitios | `review.js:555` y `batchGenerator.js:113` (`"2.1.0"` a mano) |

### Sin datos

- **Comparación con la competencia**: Insufficient data. No se midió ningún
  libro de terceros; «mejor que la competencia» necesita un patrón de
  referencia (paso 0.2 del plan).
- **Pruebas con personas que colorean**: Insufficient data.

## 4. Plan de reparación

Nada de esto está empezado. Cada reparación dice qué se toca, cómo se arregla,
qué cambia en los libros y cómo se comprueba que quedó resuelta. Van en el
orden en que conviene hacerlas; las dependencias están en §5.

Tamaño: **S** ≤ 1 día · **M** 2–4 días · **L** 1–2 semanas.

### Reglas para todas las reparaciones

1. **Una reparación, una rama, un PR.** Así cada cambio de dibujo se revisa
   con su propia hoja de contacto.
2. **Antes y después.** Guardar la hoja de contacto (`npm run sheet -- <tipo> 24`)
   y la tabla de contraste (R0) antes de tocar; repetirlas al terminar y
   adjuntar ambas al PR.
3. **Golden.** Si la reparación cambia el dibujo, `npm run golden -- --update`
   va en un commit aparte, después de revisar la hoja a ojo. Si no debía
   cambiar el dibujo y el golden cambia, es un fallo.
4. **Versión del motor.** Toda reparación que cambie el dibujo sube
   `ENGINE_VERSION` (una vez unificada, R1). Las recetas antiguas siguen
   abriendo, con el aviso de versión que ya existe.
5. **Compuerta.** `npm run check` en verde y `npm run audit:books` sin
   promesas incumplidas antes de fusionar.

---

### R0 — Medir contraste y cobertura en la auditoría (S) · resuelve I1

**Problema.** Ninguna prueba ve si la figura destaca. `analyzeContrast`
(`js/core/pageQuality.js:148`) solo funciona en el navegador y da por buena
cualquier página con contraste ≥ 0.

**Cómo se repara.**
1. Sacar de `analyzeContrast` el cálculo puro a una función
   `contrastFromMask(raster, mask, box)` que recibe la máscara ya rasterizada
   y la caja del dibujo (sin márgenes). Devuelve `densityInside`,
   `densityOutside`, `ratio` y `coverage`.
2. En el navegador, `analyzeContrast` sigue creando la máscara con `Path2D` y
   llama a la función nueva. En Node, `_samples/bookAudit.mjs` crea la máscara
   con resvg (`<path d="silD" fill="#fff">` sobre negro) y llama a la misma.
   Leer `pixels` una sola vez por imagen: el acceso copia el búfer entero.
3. `bookAudit.mjs` añade por libro: cobertura media y mínima, razón media,
   páginas con razón < 1.25 y páginas con cobertura < 15 %.
4. Añadir esas cifras a `fails` (línea 154) con umbrales **de partida iguales
   a lo medido hoy** (§2), para que la auditoría no empeore. Cada reparación
   posterior aprieta su umbral.
5. En la app, `review.js:181` marca la página si `ratio < 1.25` (hoy solo si
   el fondo es más denso que la figura). Vitral queda fuera: su razón baja es
   del estilo.

**Qué cambia en los libros.** Nada. Solo se mide.

**Cómo se verifica.**
- `npm run audit:books -- adult,origami` imprime las cifras de §2 (± 0.05 en
  la razón).
- Prueba nueva en `test_verify.mjs`: una página sintética con figura rayada y
  fondo liso da razón > 3; la inversa da razón < 1.
- Golden sin cambios.

---

### R1 — Una sola versión del motor (S) · resuelve I5

**Cómo se repara.** Mover `ENGINE_VERSION` a `js/core/engineVersion.js` e
importarla en `review.js` y `batchGenerator.js`.

**Cómo se verifica.** `grep -rn '"2\.1\.0"' js` solo encuentra el archivo
nuevo. Receta de lote y receta de revisión llevan la misma versión (prueba).

---

### R2 — Retirar las escenas del selector mientras están rotas (S) · contiene D1

**Cómo se repara.** En `js/ui/stylePicker.js`, excluir `zen_scene`,
`zen_scene_dino` y `zen_scene_ocean` de la lista visible. Los presets siguen
existiendo: una receta guardada con ese estilo sigue abriendo.

**Cómo se verifica.** e2e: el selector no contiene esos tres valores. Abrir
una receta con `style: "zen_scene"` no da el error «ya no está disponible».
Se deshace en R3.

---

### R3 — Escenas: un solo fondo para toda la página (M) · resuelve D1, D2

**Problema.** Fondo en parches rectangulares y media página vacía;
dinosaurios escondidos en el océano.

**Causa.** `generateZenScene` (`figure.js:3298`) genera cada figura con
`generateZenFigure` dentro de su `subArea`. Esa llamada dibuja el fondo
temático, las auras y las figuritas recortados a su propio rectángulo
(`frameClip`, `figure.js:2800` y `2887`). Los rectángulos se solapan y cada
uno corta el fondo del otro. Las figuritas salen de `def.science` de cada
figura (`figure.js:2922`), no del tema de la escena.

**Cómo se repara.**
1. Nueva opción `figureOnly: true` en `generateZenFigure`: no dibuja fondo,
   capa temática, figuritas ni suelo; devuelve la figura con sus auras y
   expone en el resultado la silueta en mm (`silD`) y su caja.
2. `generateZenScene` llama a las figuras con `figureOnly` y después compone
   en este orden: fondo de página → suelo/horizonte → figuritas → figuras
   (la de más abajo, al final) → marco.
3. El fondo de página usa el mismo código que una figura sola (rayos o
   strings con `BG_POOL`, más la capa temática), recortado al marco entero.
   Para no duplicar ese bloque, extraerlo de `generateZenFigure`
   (`figure.js:2786–2889`) a una función `drawBackground(ctx, frame, opts)`.
4. Las siluetas de todas las figuras se pasan a `drawBackground` como zonas
   a respetar: halo blanco de `gap * 2.4` bajo cada una, igual que hace
   `unionShape` hoy.
5. Figuritas: una sola tanda de 3–4 para la página, con reserva por tema de
   la escena (`ocean` → peces, tortuga, caballito; `dino` → dinosaurios;
   `nature` → hoja, seta, pájaro). Se colocan con la misma prueba de
   distancia (`near`), contra todas las siluetas.
6. Reparto: sustituir las `subAreas` fijas por un reparto que use toda la
   página. Con 2 figuras, diagonal (abajo-izquierda grande, arriba-derecha
   menor); con 3, triángulo. Cada figura se encaja por área (ver R6) y se
   comprueba que las siluetas no se pisan más de un 5 %.
7. Suelo: quitar las barras flotantes (`branch` de cada figura). Un solo
   horizonte de `generateSceneEnvironment`; las figuras con `branch` se
   apoyan en él y las que nadan o vuelan van por encima.
8. Sacar `plesiosaur`, `mosasaurus` y `ammonite` de la reserva `ocean`
   (`figure.js:3310`): son del tema prehistórico.
9. Volver a mostrar los tres estilos en el selector (deshace R2).

**Qué cambia en los libros.** Solo las páginas de escena. Ninguna receta de
un clic las usa.

**Cómo se verifica.**
- Prueba nueva (sustituye la parte de escenas de la prueba 22), sobre 12
  semillas por tema:
  - ningún `clipPath` del SVG es un rectángulo menor que el marco;
  - hay exactamente un grupo de fondo;
  - toda figurita (`data-hidden`) pertenece al tema de la escena;
  - hueco vacío (`blankMm`) < 20 mm;
  - cobertura combinada ≥ 25 %;
  - solape entre siluetas ≤ 5 %.
- Hoja de 12 escenas por tema revisada a ojo: sin cortes rectos, sin barras
  flotantes, sin mitad vacía.
- Golden: las figuras solas no cambian (la extracción de `drawBackground` no
  debe mover el sorteo). Si cambian, la extracción está mal.

**Riesgo.** La extracción del fondo puede alterar el orden de llamadas al
generador aleatorio y cambiar todos los libros. Hacerla en un commit propio y
comprobar el golden antes de seguir.

---

### R4 — Origami: que la figura destaque del fondo (M) · resuelve D3

**Problema.** Razón media 1.28; 7 de 20 páginas por debajo de 1.25.

**Causa.** Con `figureStyle: "facet"`, el fondo es `facets` siempre
(`figure.js:2798`): piezas del mismo tamaño que las de la figura (`target`
1100 mm², línea 2859), 70 % de ellas con tangle del mismo `BG_POOL`. La
figura solo se distingue por el grosor del contorno.

**Cómo se repara.** Tres cambios, medidos por separado para quedarse con los
que hagan falta:
1. **Fondo más ligero.** En origami, `target` del fondo a ~2600 mm² (piezas
   2–3 veces mayores que las de la figura) y tangle en 1 de cada 3 piezas,
   con separación `BG_GAP × 1.4`. Las piezas lisas grandes se parten en dos
   para no superar 20 mm de hueco vacío.
2. **Halo.** Una franja blanca de 3 mm alrededor de la silueta, con un eco
   del contorno a 3 mm (una aura fija en origami). Separa figura y fondo sin
   añadir tinta.
3. **Contorno.** Trazo exterior de 1.6–2.0 mm en origami (hoy
   `cellBorderWidthMm` 1.2), con unión en inglete como ahora.
4. Parámetros nuevos en los presets `zen_figure_dino_origami` y en
   `origamiMix`, no constantes sueltas en `figure.js`.

**Qué cambia en los libros.** «Solo origami», la mitad de «Dinosaurios» y 1
de cada 5 páginas de «Críptidos».

**Cómo se verifica.**
- `audit:books -- origami,dino,cryptids`: razón ≥ 1.5 en **todas** las
  páginas de origami y media ≥ 1.8; hueco vacío máx. < 20 mm; zonas
  difíciles no peores que hoy.
- Umbral nuevo en `fails`: origami con alguna página < 1.5 falla.
- Hoja de 24 páginas: la figura se reconoce en la miniatura de 260 px.
- Golden de los estilos origami actualizado a propósito.

---

### R5 — Bípedos fuera del origami hasta tener silueta nueva (S) · contiene D4

**Problema.** T. rex, alosaurio, espinosaurio, parasaurolofus, velocirráptor,
diablo de Jersey y chupacabras salen como trazos rotos (cobertura 11–13 %).

**Causa.** Son siluetas por esqueleto con patas y brazos delgados;
`angularize` (`figure.js:2605`, tolerancia 0.04) las reduce a pocos vértices
y las extremidades pierden forma.

**Cómo se repara.**
1. Quitar esas figuras de `FIGURE_SETS.dinoOrigami`, `dinoOrigamiMix` y
   `cryptidsOrigami`.
2. Ajustar `designs` de «Solo origami» para que no pase de 2 vueltas del
   repertorio que queda (cuadrúpedos, marinos, amonites).
3. Vuelven con R8, con silueta ilustrada.

**Qué cambia en los libros.** «Solo origami» y «Dinosaurios» pierden esas
figuras por ahora. El T. rex es la figura que más vende del tema: R8 debe
empezar por él.

**Cómo se verifica.** `audit:books -- origami,dino`: ninguna página de
origami con cobertura < 12 %; ninguna figura sale más de 2 veces.

---

### R6 — Encaje por área: figuras más grandes (M) · resuelve Q1

**Problema.** En dinosaurios, 18 de 20 páginas tienen la figura por debajo
del 20 % del marco; en críptidos 12 de 20; en adultos 9 de 20.

**Causa.** `sFit` (`figure.js:2675`) encaja la caja de la silueta en el
marco. Una figura alargada (diplodoco, neurona) llena el ancho y deja el
resto vacío. Además, «offset» la encoge al 66–80 % (línea 2708) y el loto de
la página 5 de adultos acaba en una esquina.

**Cómo se repara.**
1. Calcular la cobertura que daría `sFit`. Si queda por debajo de 18 %:
   - aumentar la escala hasta alcanzar 18 %, con tope de 1.35 × `sFit`;
   - si con eso la figura sale del marco, usar encuadre «zoom» recortando
     **solo por la cola o las extremidades**: cada figura declara
     `anchor` (punto que nunca se recorta, por defecto la cabeza o el centro);
   - girar hasta ±20° las figuras alargadas sin suelo para aprovechar la
     diagonal de la página.
2. «offset» solo si la cobertura resultante es ≥ 15 %; si no, pasa a
   «center». Sustituye el parche actual de `SMALL_FIGURE_COVER`.
3. Origami sigue sin «zoom» (línea 2703), pero sí usa la escala y el giro.
4. Añadir `anchor` a las ~25 figuras alargadas (dinosaurios, marinos,
   neurona, ADN, gusano, Nessie).

**Qué cambia en los libros.** Todos los de figura. Es el cambio de dibujo
más amplio del plan.

**Cómo se verifica.**
- `audit:books` (los 8 tipos): cobertura < 15 % en menos del 10 % de las
  páginas de cada libro; mediana ≥ 20 % en dinosaurios y críptidos.
- Prueba nueva: en 200 páginas, el punto `anchor` de cada figura queda
  dentro del marco con 5 mm de margen (ninguna cabeza cortada).
- La prueba 23 de cobertura sigue pasando.
- Hoja de 24 páginas por libro, a ojo.

---

### R7 — Infantil con trazo grueso de verdad (S) · resuelve Q5

**Problema.** El libro infantil dibuja los patrones a 0.35 mm, con secciones
pequeñas dentro de la figura.

**Causa.** `zen_figure_kids` (`zentangle.presets.js:905`) fija
`patternStrokeMm: 0.35` y `minGapMm: 1.9`. El perfil `bold` solo se aplica
desde el menú (`lineThicknessProfile`), y la receta `kids` no lo toca.

**Cómo se repara.**
1. En el preset: `lineThicknessProfile: "bold"`, `patternStrokeMm: 0.6`,
   `stringStrokeMm: 0.9`, `cellBorderWidthMm: 1.6`, `minGapMm: 3.5`.
2. Limitar las cuerdas de cada parte a 1–2 por familia en infantil (opción
   `maxStrings` en el preset, aplicada en `makeSections`).
3. Al pulsar la receta, la interfaz muestra «Grueso» en el menú de grosor.
4. La revisión usa los límites del perfil (`badPerDm2: 4`), que ya existen.

**Qué cambia en los libros.** Solo «Infantil».

**Cómo se verifica.**
- `audit:books -- kids`: 95 % de las páginas con ≤ 4 zonas difíciles por
  dm²; ninguna región coloreable < 20 mm² dentro de la figura.
- Prueba: el SVG de una página infantil no contiene `stroke-width` menor
  de 0.5.
- La razón de contraste no baja de 2.0 (hoy 2.59).

---

### R8 — Siluetas ilustradas por el importador (L) · resuelve Q2, Q3, D4

**Problema.** Varias figuras no se reconocen (caballo, reno, gato dormido,
lobo, bípedos). El importador existe y solo tiene una figura.

**Cómo se repara.** No es trabajo de código, salvo el paso 4.
1. Encargar o dibujar 40 siluetas con los requisitos de
   `REVISION_Y_PLAN.md` §5.1 (SVG plano, capas `silhouette`, `part-*`,
   `back-*`, `front-*`, `deco-*`, ficha `.json` con licencia y origen).
2. Orden: bípedos (T. rex, velocirráptor, alosaurio, espinosaurio,
   parasaurolofus, diablo de Jersey) → adultos (caballo, lobo, ciervo, búho,
   zorro, elefante, tigre, colibrí) → gatos (10) → Navidad (10) → aves (6).
3. Cada una entra con `npm run import:figures` y sustituye a la figura por
   puntos del mismo id (la antigua se conserva como `<id>_v1` para recetas
   viejas).
4. Añadir al importador la capa `anchor` (R6) y las etiquetas de tema (R9).

**Qué cambia en los libros.** Las figuras sustituidas, en todos los libros
que las usan.

**Cómo se verifica.**
- Cada figura pasa el validador (trayectos cerrados, grosor mínimo, 3
  encuadres × 3 semillas con veredicto de calidad correcto).
- Prueba de reconocimiento: la silueta sola, en negro, a 40 mm; 4 de 5
  personas la nombran sin ayuda. Se anota en la ficha `.json`.
- Tras los bípedos: vuelven al origami (deshace R5) solo si cada uno da
  cobertura ≥ 15 % y razón ≥ 1.5.

**Sin datos.** Insufficient data sobre coste y plazo del encargo.

---

### R9 — Figuritas escondidas con sentido (S) · resuelve Q4

**Problema.** Magdalenas y teteras junto al lobo; una copia del gato dentro
del gato.

**Causa.** La reserva es temática solo si la figura tiene `science` o
`cryptid` (`figure.js:2922`); el resto usa una lista fija
(`HIDEABLE_ADULT`, línea 2323). La copia interior se dibuja siempre
(`figure.js:~3060`).

**Cómo se repara.**
1. Añadir `tags` a cada figura (`naturaleza`, `mar`, `cielo`, `casa`,
   `símbolo`, además de los temas actuales).
2. La reserva de figuritas es: figuras ocultables que comparten al menos una
   etiqueta con la principal; si hay menos de 3, se completa con `símbolo`
   (luna, corazón, gota, hoja).
3. La copia interior pasa a ser opción del preset (`innerCopy`), activa en
   infantil («busca a la cría») y apagada en adultos.
4. El pie de página y la página de soluciones ya leen `data-hidden`: no
   cambian.

**Qué cambia en los libros.** Adultos y mezcla (otras figuritas, sin copia
interior).

**Cómo se verifica.** Prueba: en 100 páginas, toda figurita comparte
etiqueta con la figura principal o es de `símbolo`; en adultos no hay
`data-hidden` igual al `data-figure` de la página. La página de soluciones
sigue cuadrando (prueba 23).

---

### R10 — Libros de océano, gatos, aves y Navidad (M) · resuelve Q6

**Problema.** Hay estilos y fichas para esos temas, pero pocas figuras:
océano 10, aves 6, gatos 4, Navidad 5. Un libro de 28 repetiría cada gato 7
veces.

**Cómo se repara.**
1. Depende de R8: cada tema necesita ≥ 14 figuras.
2. Añadir la receta en `js/core/bookRecipes.js` (estilo, 28 diseños,
   opciones) y su entrada en `STYLE_THEME`.
3. Incluir el tema en `audit:books` y en el golden.

**Cómo se verifica.** `audit:books -- ocean,cats,birds,christmas`: ninguna
figura más de 2 veces; 0 pares casi iguales; contraste y cobertura dentro de
los umbrales de adultos. e2e con una de las recetas nuevas.

---

### R11 — Menos estilos geométricos (S) · resuelve Q7

**Problema.** 24 estilos de celdas (`kdp_*`, `*_editorial`, `classic_*`…) que
a la vista son 6 o 7.

**Cómo se repara.**
1. Medir el parecido entre estilos con `pageSimilarity` (10 semillas por
   estilo) y agrupar los que superen 0.8.
2. Dejar visible uno por grupo (el de mejor colorabilidad); los demás quedan
   en el código, fuera del selector y de «Mezcla más vendida».
3. No borrar presets: las recetas guardadas deben seguir abriendo.

**Cómo se verifica.** Tabla de parecido en el PR; el selector baja a ~8
estilos de celdas; una receta con un estilo retirado abre y reproduce su
golden.

---

### R12 — Pruebas rápidas (S) · resuelve I2

**Cómo se repara.**
1. Medir cuánto tarda cada prueba de `test_verify.mjs` (hoy no se sabe).
2. `npm run test:fast`: las pruebas de lógica y un golden reducido (una
   página por estilo). `npm test` sigue siendo el completo.

**Cómo se verifica.** `test:fast` < 60 s; `npm test` ejecuta las mismas 23
pruebas y 168 páginas que hoy.

---

### R13 — Partir `figure.js` (M) · resuelve I3

**Cómo se repara.** Sin cambiar el dibujo: `figures/<tema>.js`
(definiciones), `figureEngine.js` (encaje, secciones, tangles),
`backgrounds.js` (lo extraído en R3) y `scene.js`. `figure.js` queda como
reexportador para no romper imports.

**Cómo se verifica.** Golden idéntico **sin** `--update`; `npm run check` en
verde. Hacerla al final: antes chocaría con todas las reparaciones de dibujo.

---

### R15 — Patrones sin manchitas (M) · resuelve T1

**Problema.** Printemps, Paradox, Flux, Circuit y Crosses dejan regiones
menores de 0.5 mm² en ciertas formas de celda. En papel se ven como motas de
tinta.

**Causa.** Cada relleno se dibuja igual en cualquier celda; al recortarlo
contra un hexágono o un triángulo, los bordes dejan restos. La prueba 18
vigila la suma de todas las combinaciones, así que una combinación mala se
esconde entre las buenas.

**Cómo se repara.**
1. Fijar un techo **por combinación** relleno × forma: 2 zonas no
   coloreables y 6 manchitas por celda.
2. Para cada combinación por encima del techo, por este orden: (a) margen
   interior del relleno respecto al borde de la celda, igual al que ya usan
   las cuerdas (`gap * 1.5`); (b) descartar los elementos del patrón cuyo
   centro quede a menos de medio elemento del borde; (c) si sigue por encima,
   vetar esa combinación (como ya se hace con Triangles y Cadent en triángulo
   y hexágono).
3. Printemps y Paradox, además: aumentar el paso mínimo entre vueltas a
   1.2 mm para que el centro no se cierre en negro.

**Qué cambia en los libros.** Mezcla y estilos de celdas; las figuras que
usen esos tangles.

**Cómo se verifica.**
- `npm run audit:patterns`: ninguna celda de la tabla por encima de 2 / 6.
- La prueba 18 pasa a comprobar el techo por combinación, además de la suma.
- `audit:books -- mix,adult`: zonas difíciles no peores que hoy.

---

### R16 — Doble página que respeta el lomo (M) · resuelve S1

**Problema.** La figura se centra en la unión de las dos páginas y su parte
más detallada se pierde en la encuadernación.

**Causa.** `generateSpread` (`js/generators/spread.js`) genera una figura a
doble ancho y la parte por la mitad.

**Cómo se repara.**
1. Componer la doble página con la figura desplazada: su centro en una de
   las dos páginas (a un tercio del ancho total) y solo extremidades, cola,
   alas o cintas cruzando el lomo.
2. Reservar a cada lado del lomo una franja igual al margen interior de KDP
   para ese número de páginas (`kdpInsideMarginMm`), donde solo puede haber
   fondo y líneas largas, sin secciones pequeñas.
3. Usar el punto `anchor` de R6: nunca a menos de 25 mm del lomo.
4. Ampliar `SPREAD_FIGURES` con figuras alargadas (diplodoco, Nessie, koi,
   pluma, cintas), que son las que ganan con el formato.

**Qué cambia en los libros.** Las dobles páginas (hoy solo en «Adultos»).

**Cómo se verifica.**
- Prueba: en 30 dobles páginas, el `anchor` queda a ≥ 25 mm del lomo y la
  franja del lomo no contiene regiones coloreables < 20 mm².
- Vista de libro abierto (`btnOpenBook`) revisada a ojo.
- Prueba impresa de un libro con dobles páginas antes de publicar: es lo
  único que confirma cuánto se come la encuadernación.

---

### R17 — Portada con arte (L) · resuelve C1

**Problema.** La portada es texto sobre blanco. La portada y su miniatura
deciden el clic; hoy hay que hacerla fuera.

**Cómo se repara.**
1. **Elegir la página.** La de mejor puntuación compuesta del libro
   (calidad + contraste + cobertura de R0), entre las de encuadre «center» o
   «zoom».
2. **Colorearla.** Relleno por regiones: las regiones blancas ya se detectan
   en `analyzeColorability`. Asignar a cada región un color de una paleta
   armónica de 5–6 tonos (una por tema), con la regla de que dos regiones
   vecinas no repitan tono y que el fondo use los tonos más apagados para
   que la figura destaque.
3. **Maquetar.** Arte a sangre en la portada; banda de color sólido con el
   título en hasta 3 líneas; subtítulo y autor. Contraportada con 4–6
   miniaturas del interior en blanco y negro, texto de venta y hueco del
   código de barras. Lomo con texto solo por encima de 79 páginas (ya
   resuelto en `coverSpec`).
4. **Exportar** como imagen a 300 ppp dentro del PDF de portada, con las
   medidas que ya calcula `coverSpec`.
5. Mantener la portada actual como opción «solo texto».

**Cómo se verifica.**
- Prueba: el PDF mide lo que dice `coverSpec`; el hueco del código de barras
  queda sin arte ni texto; ningún término bloqueado en la portada.
- Legibilidad: en la miniatura de 160 px de ancho, la altura de letra del
  título es ≥ 10 px y su contraste con la banda ≥ 4.5 : 1 (se calcula).
- Coloreado: ninguna región sin color; ningún par de regiones vecinas con el
  mismo tono (prueba sobre el grafo de regiones).
- Previsualizador de portadas de KDP sin avisos.
- A ojo: la portada, junto a 5 portadas líderes del nicho, no desentona
  (parte de R14).

**Sin datos.** Insufficient data sobre qué paletas venden mejor por nicho.

---

### R18 — Páginas de cortesía con oficio (M) · resuelve C2

**Cómo se repara.**
1. **Portadilla:** marco hecho con un tangle del libro y una figura pequeña
   del tema bajo el título.
2. **Créditos:** letra de 3.2 mm como mínimo; año, autor, «todos los
   derechos reservados» y la atribución que ya existe.
3. **Página de prueba:** rejilla de 24 casillas para probar colores, una
   franja para degradados y la nota de poner una hoja debajo.
4. **Página final:** «¿Te gustó? Deja tu reseña», con un dibujo pequeño; sin
   enlaces ni promesas de recompensa (KDP no permite incentivar reseñas).
5. **Coherencia de serie:** mismo marco y misma tipografía en todos los
   libros.

**Cómo se verifica.** Prueba: ninguna página de cortesía con texto menor de
3 mm; `planSequence` cuenta la página de reseña y el total sigue siendo par;
e2e comprueba que el PDF las incluye. Hoja de contacto de cortesía a ojo.

---

### R19 — Regalías con las tarifas de KDP (S) · resuelve L1

**Problema.** La tabla de regalías aplica 60 % a cualquier precio y un coste
de impresión que no coincide con el publicado por KDP. Quien fije el precio
con esa tabla calcula mal su margen.

**Cómo se repara.**
1. Sacar las tarifas de `bookListing.js` a un archivo de datos
   (`js/core/kdpRates.js`) con fecha de consulta y enlace a la página oficial:
   coste fijo, coste por página, tramo de páginas, tamaño normal o grande y
   tinta, por tienda.
2. Regalía por tramos: 50 % por debajo del umbral de la tienda (9.99 USD en
   Amazon.com) y 60 % desde ahí [2].
3. 8.5×11 in cuenta como tamaño grande: usar su tarifa por página.
4. La ficha muestra la fecha de las tarifas y el aviso «comprueba en la
   calculadora de KDP antes de fijar el precio».
5. Calcular también el precio mínimo que deja regalía positiva.

**Cómo se verifica.**
- Prueba: tres casos calculados a mano con la calculadora oficial de KDP
  (24, 80 y 200 páginas; un precio por debajo y otro por encima del umbral)
  coinciden al céntimo.
- La tabla marca el salto de 50 % a 60 %.

**Sin datos.** Los valores exactos por tramo deben leerse de la página
oficial el día que se haga: las páginas de ayuda encontradas tienen fechas
distintas y no dan una tabla única [1].

---

### R20 — Una sola ficha, completa (M) · resuelve L2, L3, L4, L5, L6

**Cómo se repara.**
1. Un solo motor: `bookListing.js` pasa a construir sobre `kdpListing.js`
   (mismos títulos, descripción y reglas de marca); la ficha bilingüe es la
   misma ficha en dos idiomas.
2. Palabras clave: reserva de 12 por tema e idioma; tras quitar las que
   repiten el título se rellenan hasta 7; cada una ≤ 50 caracteres.
3. Validador: avisa de «libro», «book», «colorear» sueltos, de palabras
   repetidas entre casillas y de términos bloqueados.
4. Categorías: dos juegos por tema (adultos / infantil) según la receta.
5. Recordatorio fijo al final: revisar la declaración de contenido de IA al
   publicar, con el enlace a la ayuda de KDP.

**Cómo se verifica.** Prueba para cada tema e idioma: 7 palabras clave,
≤ 50 caracteres, sin términos bloqueados ni palabras del título, sin
duplicados; la ficha de «Descargar todo» y la bilingüe dan el mismo título.

---

### R21 — «Descargar todo» baja todo (S) · resuelve U1, U3

**Cómo se repara.** Un ZIP (ya existe `js/core/zip.js`) con interior,
portada, ficha bilingüe, receta y las 6 imágenes de maqueta. Los botones
sueltos se quedan para quien quiera una sola pieza.

**Cómo se verifica.** e2e: el ZIP contiene los 5 tipos de archivo y el PDF
interior es idéntico al del botón suelto.

---

### R22 — Libro abierto con avance (S) · resuelve U2

**Cómo se repara.** Generar la vista por pliegos, cediendo el control entre
uno y otro, con barra de avance y botón de cancelar (el mismo patrón que
`buildBookPdf` con `onProgress`).

**Cómo se verifica.** e2e: durante la generación el estado cambia al menos
una vez por pliego y la página responde a clics.

---

### R23 — Revisión en móvil (S) · resuelve U4

**Cómo se repara.** El aviso de estado pasa a una línea fija bajo la vista
previa en pantallas de menos de 600 px; la vista previa se pliega tras
elegir el tipo de libro.

**Cómo se verifica.** Captura a 390 px con un libro preparado: ninguna
miniatura tapada; botones de al menos 44 px.

---

### R24 — Las mejores páginas primero (S)

**Para qué.** «Leer muestra» enseña las primeras páginas. El modo escaparate
ya existe (`showcaseMode`), pero ordena solo por colorabilidad.

**Cómo se repara.** La puntuación del escaparate suma contraste y cobertura
(R0); el modo queda activado por defecto en las recetas de un clic, sin
romper la dificultad progresiva (elige entre las páginas del primer tercio).

**Cómo se verifica.** Prueba: las 4 primeras ilustraciones tienen una
puntuación compuesta mayor o igual que la mediana del libro.

---

### R25 — Repertorio suficiente por libro (S) · resuelve C3

**Cómo se repara.** Regla en `bookRecipes.js`: `designs` ≤ 2 × figuras del
repertorio. Dinosaurios y origami bajan a 30 o esperan a las figuras de R8.

**Cómo se verifica.** `audit:books` falla si «repetición máx» > 2.

---

### R14 — Referencia de la competencia (S, fuera del código)

**Cómo se hace.** Escanear a 300 ppp 20 páginas de 3–5 libros líderes de
cada nicho (comprados; solo para medir, no se copian). Marcar la silueta a
mano y pasarles la medición de R0.

**Para qué.** Los umbrales de R4 y R6 (razón 1.5, cobertura 18 %) son
estimaciones propias. Con esta tabla se sustituyen por los valores de los
libros que venden.

**Cómo se verifica.** Tabla con cobertura y razón por libro, añadida a este
documento; umbrales de `audit:books` ajustados a ella.

## 5. Orden y dependencias

Cuatro bloques. Dentro de cada uno, el orden es el de la tabla.

**Bloque A — Medir y contener (≈ 1 semana).** No cambia el dibujo, salvo R5.

| Orden | Reparación | Tamaño | Depende de | Cambia el dibujo |
|---|---|---|---|---|
| 1 | R0 Medición en la auditoría | S | — | No |
| 2 | R1 Versión única del motor | S | — | No |
| 3 | R2 Ocultar escenas | S | — | No |
| 4 | R19 Regalías correctas | S | — | No |
| 5 | R5 Bípedos fuera del origami | S | R0 | Origami, dinosaurios |
| 6 | R25 Repertorio suficiente | S | R5 | Nº de páginas |
| 7 | R14 Referencia de la competencia | S | R0 | No (ajusta umbrales) |

**Bloque B — Que la página se lea (≈ 3–4 semanas).**

| Orden | Reparación | Tamaño | Depende de | Cambia el dibujo |
|---|---|---|---|---|
| 8 | R4 Origami con contraste | M | R0 | Origami, dinosaurios, críptidos |
| 9 | R7 Infantil grueso | S | R0 | Infantil |
| 10 | R15 Patrones sin manchitas | M | — | Mezcla, celdas, figuras |
| 11 | R6 Encaje por área | M | R0 | Todos los de figura |
| 12 | R3 Escenas | M | R6 | Escenas |
| 13 | R16 Doble página | M | R6 | Dobles páginas |
| 14 | R9 Figuritas con sentido | S | — | Adultos, mezcla |

**Bloque C — Que el libro se venda (≈ 3–4 semanas, más el encargo de siluetas).**

| Orden | Reparación | Tamaño | Depende de | Cambia el dibujo |
|---|---|---|---|---|
| 15 | R8 Siluetas ilustradas | L | R6, R9 | Figuras sustituidas |
| 16 | R17 Portada con arte | L | R0 | Solo portada |
| 17 | R18 Páginas de cortesía | M | — | Solo cortesía |
| 18 | R24 Mejores páginas primero | S | R0 | Orden |
| 19 | R20 Ficha única y completa | M | R19 | No |
| 20 | R21 «Descargar todo» completo | S | R17, R20 | No |
| 21 | R10 Libros nuevos | M | R8 | Libros nuevos |

**Bloque D — Mantenimiento (≈ 1–2 semanas).**

| Orden | Reparación | Tamaño | Depende de | Cambia el dibujo |
|---|---|---|---|---|
| 22 | R11 Menos estilos | S | — | Mezcla |
| 23 | R22 Libro abierto con avance | S | — | No |
| 24 | R23 Móvil | S | — | No |
| 25 | R12 Pruebas rápidas | S | — | No |
| 26 | R13 Partir `figure.js` | M | R3–R16 | No |

Los plazos son estimaciones mías a partir del tamaño de cada tarea, no
compromisos. R8 depende de un encargo externo: conviene lanzarlo al empezar
el bloque B para que las siluetas lleguen a tiempo.

I4 (nombre «Zentangle Creator») no es una reparación: es una decisión del
dueño y no bloquea nada.

## 6. De hallazgo a reparación

| Hallazgo | Reparación | Comprobación que lo cierra |
|---|---|---|
| D1, D2 Escenas rotas | R2 (contención), R3 | Sin recortes rectangulares; figuritas del tema |
| D3 Origami camuflado | R4 | Razón ≥ 1.5 en todas las páginas |
| D4 Bípedos ilegibles | R5 (contención), R8 | Cobertura ≥ 15 % y reconocimiento 4 de 5 |
| Q1 Figuras pequeñas | R6 | Menos del 10 % de páginas bajo el 15 % |
| Q2, Q3 Siluetas | R8 | Validador y reconocimiento |
| Q4 Figuritas sin sentido | R9 | Etiqueta compartida |
| Q5 Infantil fino | R7 | ≤ 4 zonas difíciles por dm² en el 95 % |
| Q6 Temas sin libro | R10 | Ninguna figura más de 2 veces |
| Q7 Estilos casi iguales | R11 | Parecido < 0.8 entre los visibles |
| T1 Manchitas | R15 | Tabla de patrones bajo 2 / 6 |
| S1 Lomo | R16 | `anchor` a ≥ 25 mm del lomo; prueba impresa |
| C1 Portada | R17 | Medidas, legibilidad a 160 px, previsualizador de KDP |
| C2 Cortesía | R18 | Texto ≥ 3 mm; página de reseña en el plan |
| C3 Repeticiones | R25 | Repetición máx ≤ 2 |
| L1 Regalías | R19 | Tres casos iguales a la calculadora de KDP |
| L2–L6 Ficha | R20 | 7 palabras clave válidas por tema e idioma |
| U1, U3 Descarga | R21 | ZIP con las 5 piezas |
| U2 Libro abierto | R22 | Avance por pliego |
| U4 Móvil | R23 | Captura a 390 px sin solapes |
| I1 Contraste sin vigilar | R0 | La auditoría falla bajo umbral |
| I2 Pruebas lentas | R12 | `test:fast` < 60 s |
| I3 `figure.js` | R13 | Golden idéntico |
| I5 Versión duplicada | R1 | Una sola constante |
| Competencia sin medir | R14 | Tabla de referencia |

## 7. Pruebas nuevas que deja el plan

| Prueba | Dónde | La añade |
|---|---|---|
| Contraste y cobertura por libro, con umbrales | `audit:books` | R0 |
| Razón de contraste en página sintética | `test_verify.mjs` | R0 |
| Escenas: recortes, tema de figuritas, solape, hueco vacío | `test_verify.mjs` | R3 |
| `anchor` dentro del marco | `test_verify.mjs` | R6 |
| Trazo mínimo en infantil | `test_verify.mjs` | R7 |
| Figuritas con etiqueta compartida | `test_verify.mjs` | R9 |
| Techo por combinación relleno × forma | prueba 18 | R15 |
| Doble página: `anchor` y franja del lomo | `test_verify.mjs` | R16 |
| Portada: medidas, hueco de código de barras, regiones coloreadas | `test_verify.mjs` | R17 |
| Regalías frente a tres casos de la calculadora | `test_verify.mjs` | R19 |
| Ficha: 7 palabras clave válidas por tema e idioma | `test_verify.mjs` | R20 |
| ZIP completo | `e2e_book.mjs` | R21 |
| Repetición máx ≤ 2 | `audit:books` | R25 |

Tres comprobaciones no se pueden automatizar y quedan como paso manual:
reconocimiento de siluetas por personas (R8), prueba impresa de dobles
páginas (R16) y previsualizador de KDP para la portada (R17).

## 8. Riesgos

| Riesgo | Dónde aparece | Cómo se controla |
|---|---|---|
| Un cambio de motor altera libros ya publicados | R3–R9, R15, R16 | Versión del motor en la receta; la receta antigua avisa; el commit anterior reproduce el libro exacto |
| Extraer el fondo cambia el sorteo de todas las páginas | R3 | Commit propio; el golden debe quedar idéntico antes de seguir |
| Ampliar figuras corta cabezas | R6 | Punto `anchor` y su prueba |
| El fondo ligero del origami deja huecos vacíos | R4 | Límite de 20 mm ya vigilado por `audit:books` |
| Siluetas con derechos ajenos | R8 | Licencia y origen obligatorios en la ficha de la figura (ya lo exige el importador) |
| Portada coloreada que parece hecha por máquina | R17 | Comparación con portadas líderes (R14); opción «solo texto» |
| Tarifas de KDP que cambian | R19 | Archivo de datos con fecha y aviso en la ficha |
| Umbrales propios (1.5 y 18 %) mal calibrados | R4, R6 | R14 los sustituye por cifras de libros que venden |
| Incentivar reseñas incumple las normas de KDP | R18 | Página sin enlaces ni recompensas |

## 9. Cuándo se da por terminado

| Meta | Hoy | Objetivo |
|---|---|---|
| Estilos con defecto visible | 3 (escenas) | 0 |
| Razón de contraste mínima en origami | 1.04 | ≥ 1.5 |
| Páginas con figura pequeña (peor libro, origami) | 19 de 20 bajo el 20 % del marco; con el corte de 15 % no está medido | Menos del 10 % bajo el 15 % |
| Infantil: zonas difíciles por dm² | hasta 13 | ≤ 4 en el 95 % |
| Combinaciones relleno × forma con más de 6 manchitas por celda | 21 (de 101) | 0 |
| Figuras ilustradas | 1 | ≥ 40 |
| Repetición máxima de una figura en un libro | 3 | 2 |
| Temas con libro de un clic | 8 | 12 |
| Portada | Texto sobre blanco | Arte coloreado, legible a 160 px |
| Regalías | No coinciden con KDP | Iguales a la calculadora en 3 casos |
| Palabras clave por ficha | 5–6 de 7 | 7 de 7 |
| Contraste y cobertura vigilados por `audit:books` | No | Sí |

## 10. Lo que esta revisión no cubre

- **Competencia:** Insufficient data. No se midió ningún libro de terceros (R14).
- **Personas que colorean:** Insufficient data. Ninguna prueba con usuarios.
- **Papel:** Insufficient data. No se revisó ninguna prueba impresa; el
  grosor de línea y el lomo solo se confirman en papel.
- **Ventas:** Insufficient data sobre volúmenes de búsqueda, categorías y
  paletas que convierten mejor.
- **Tarifas exactas de KDP por tramo:** Insufficient data; hay que leerlas
  de la página oficial al hacer R19.
- **Accesibilidad con lector de pantalla** y **`npm run colorability`**: no
  ejecutados.
- **Importar una imagen** (`imageProcessor.js`) y **lotes**
  (`batchGenerator.js`): no probados en esta revisión.

## Fuentes

1. [KDP — Coste de impresión de tapa blanda](https://kdp.amazon.com/en_US/help/topic/G201834340)
2. [KDP — Regalías de tapa blanda](https://kdp.amazon.com/en_US/help/topic/G201834330)
3. [KDP — Palabras clave](https://kdp.amazon.com/en_US/help/topic/G201298500)
4. [KDP — Directrices de contenido (contenido de IA)](https://kdp.amazon.com/en_US/help/topic/G200672390)

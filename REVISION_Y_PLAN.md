# Revisión completa y plan de mejora (31 oct 2026)

Revisión de la app tal como está en `main` (commit `ddf2b25`): interfaz, motores,
repertorio de figuras y lo que separa sus libros de los más vendidos de KDP.
Se generaron hojas de contacto (`npm run sheet`) de los tipos adultos, infantil,
dinosaurios y críptidos, y capturas de la interfaz en escritorio (1400 px) y
móvil (390 px).

**Objetivo del documento:** decidir qué construir para pasar de «genera
interiores correctos» a «produce libros completos que compiten en Amazon».
**Público:** quien mantiene la app y quien la usa a diario para publicar.

---

## 1. Diagnóstico en una página

La app ya resuelve bien lo difícil: un motor reproducible (semillas), control de
colorabilidad por página, plan de páginas compatible con KDP, ficha sin marcas
ajenas y libros variados sin repeticiones vecinas. Lo que falta está alrededor
del interior. Un libro que vende en Amazon se compra por **la portada, la
miniatura y las primeras páginas de «Leer muestra»**, y la app no produce
ninguna de las tres cosas con calidad de mercado.

Tres hallazgos pesan más que el resto:

1. **El libro termina en el interior.** No hay portada, ni página de título, ni
   créditos/copyright, ni «Este libro pertenece a», ni página de prueba de
   color. Todo eso se hace fuera, a mano, cada vez.
2. **Las siluetas tienen techo.** Las 95 figuras salen de 20–30 puntos por
   contorno; leen bien como iconos, pero junto a un libro ilustrado a mano se
   ven «de juguete» (lo reconoce `MOTOR.md`). Varias figuras quedan pequeñas
   y el fondo compite con ellas (lobo, plesiosaurio, mosasaurio en las hojas
   de contacto).
3. **El producto infantil no es infantil.** El libro 🧸 usa fondos llenos de
   tangles finos (0.35 mm) iguales a los de adultos. El mercado infantil y el
   segmento «bold & easy» piden líneas gruesas y zonas grandes.

---

## 2. Estado actual (inventario medido)

| Elemento | Cantidad | Nota |
|---|---|---|
| Figuras | 95 | adultas 24, abstractas 4, infantil 14, dino 15, bio 18, críptidos 16 |
| Tangles en figuras | 15 | 11 clásicos + 4 heredados; la guía explica esos 15 |
| Iconos (muestrarios) | 22 | |
| Estilos | ~50 | muchos heredados (`kdp_*`, plantillas) que no usan las recetas |
| Recetas de libro (1 clic) | 8 | adultos, mezcla, vitral, dino, origami, bio, críptidos, infantil |
| Tamaños de página | 5 | Letter, 8×10, 8.5×8.5, 6×9, A4 |
| Pruebas | `npm test` (34 pruebas + golden), e2e en Chromium, auditoría de libros | |
| Código | `app.js` 1739 líneas, `figure.js` 2718 líneas | dos monolitos |

Al abrir la app sin conexión a los CDN, la consola registra dos
`ERR_TUNNEL_CONNECTION_FAILED`: **jsPDF y d3-delaunay se cargan de internet**.
Sin ellos no hay PDF y los estilos Voronoi fallan.

---

## 3. Huecos de UIX para la producción diaria

Ordenados por cuánto tiempo hacen perder a quien publica varios libros por semana.

### P0 — bloquean o hacen perder trabajo

| # | Hueco | Efecto hoy | Propuesta |
|---|---|---|---|
| U1 | **No se puede cargar una receta** | La receta solo se descarga; rehacer o corregir un libro publicado es imposible desde la app | Botón «Abrir receta (.json)» que restaura estilo, opciones, semillas y reemplazos (`tries` por página) y regenera la revisión |
| U2 | **La revisión vive solo en memoria** | Recargar la pestaña o cerrar el móvil borra el libro preparado y los ↻ elegidos | Guardar la revisión (semillas + `tries`, no los SVG) en IndexedDB; «Continuar el último libro» al abrir |
| U3 | **Dependencia de CDN** | Sin red no hay PDF | Copiar `jspdf.umd.min.js` y `d3-delaunay.min.js` a `js/vendor/` y cargarlos en local |
| U4 | **Sin páginas de cortesía** | Título, copyright, «Este libro pertenece a» y prueba de color se arman en otro programa y se fusionan a mano | Generador de *front matter* (ver §6) dentro del plan de páginas |

### P1 — fricción diaria

| # | Hueco | Propuesta |
|---|---|---|
| U5 | **No hay biblioteca de proyectos.** Un libro = una sesión | Lista «Mis libros» (nombre, tipo, fecha, estado: borrador / revisado / publicado, ASIN) en IndexedDB |
| U6 | **Sin deshacer en la revisión.** ↻ reemplaza la página sin vuelta atrás | Historial por página (`tries` anteriores) con ← para recuperar la versión previa |
| U7 | **Reordenar páginas imposible.** El orden lo fija la semilla | Arrastrar miniaturas en la revisión; «Fijar» una página para que no cambie al regenerar |
| U8 | **Sin vista de doble página** | El visor muestra página a página; las dobles y los reversos en blanco no se ven como en el libro impreso. Añadir vista «libro abierto» con el lomo |
| U9 | **Sin control de figuras por libro** | Elegir/excluir figuras del repertorio (p. ej. «sin pulpo») antes de preparar |
| U10 | **Lotes** | Preparar varios libros (p. ej. 5 semillas del mismo tipo) y descargar todo en un ZIP |
| U11 | **El selector de estilos mezcla ~50 opciones** con nombres heredados (`KDP Masterpiece`, `Tile (90mm)`) | Ocultar los que ninguna receta usa tras «Estilos clásicos»; dejar visibles los 8 tipos y sus variantes |
| U12 | **«Integrar una imagen»** pone una foto en gris con opacidad: produce grises, no líneas, y no entra en el libro | Retirarlo o sustituirlo por el importador de siluetas SVG (§5) |
| U13 | **Peso y tiempo del PDF.** Cada página va como PNG a 300 ppp | Medir el peso real de un libro de 100 páginas (Insufficient data: no medido en esta revisión). Opción de PDF vectorial (`svg2pdf.js`): líneas más nítidas y archivo menor |
| U14 | **Sin sangrado real.** El PDF sale siempre a tamaño de corte | Opción «Con sangrado (0.125 in)» que amplía la página y lleva el fondo hasta el borde; muchos libros líderes usan diseños a sangre |

### P2 — pulido

- Atajos de teclado en la revisión (R = reemplazar, F = fijar, ←/→ ya existen).
- Contador de tiempo estimado de preparación antes de pulsar el botón.
- Documentación: 7 archivos `.md` describen un editor Electron que nunca se
  construyó (`ARCHITECTURE.md`, `IMPLEMENTATION_GUIDE.md`, `QUICK_START.md`,
  `README_PARA_DESARROLLO.md`, `INDICE.md`, `RESUMEN_EJECUTIVO.md`,
  `PR_DETAILS.md`). Moverlos a `docs/archivo/` evita confusiones.
- En móvil, la vista previa ocupa la mitad de la pantalla antes del paso 1;
  plegarla tras el primer toque deja el flujo más corto.

---

## 4. Huecos en los motores

### 4.1 Motor de figuras (`figure.js`)

| # | Hueco | Evidencia | Propuesta |
|---|---|---|---|
| M1 | **Siluetas por puntos** | Contornos de 20–30 puntos; bípedos solo funcionan en origami | Importador de siluetas SVG (§5). Es el mayor salto de calidad posible |
| M2 | **Figura pequeña frente al fondo** | Lobo, plesiosaurio, mosasaurio y pez ocupan < 20 % del marco | Cobertura mínima de la silueta por encuadre (≥ 35 % en «centrado») y fondo con menos contraste (tangles más abiertos o más secciones lisas) cuando la figura es delgada |
| M3 | **Grosor de línea uniforme** | Contorno, cuerdas y tangles comparten casi el mismo trazo | Tres niveles: contorno 0.9–1.2 mm, cuerdas 0.6 mm, tangles 0.3 mm. Da jerarquía visual y aspecto «hecho a mano» |
| M4 | **Cuerdas en ángulo fijo** | Cortan cuello y cola en diagonal | Cuerdas que sigan el eje del cuerpo (esqueleto de la silueta) |
| M5 | **Tangle sin relación con la anatomía** | Escamas en alas, cuadrícula en vientres | Etiquetas de zona por parte (`skin`, `wing`, `belly`, `shell`) → familia de tangles |
| M6 | **Sin escenas** | Una figura por página | 2–3 figuras del tema (manada, arrecife, bosque) con suelo y horizonte |
| M7 | **Fondos genéricos** | Rayos, strings, facetas para todos los temas | Fondos temáticos: helechos y volcanes (dino), burbujas y algas (océano), estrellas y luna (críptidos), moléculas (bio) |
| M8 | **Figuras escondidas sin soluciones** | El pie dice «busca 3», pero no hay respuestas | Página de soluciones al final con miniaturas y las figuritas resaltadas (los SVG ya llevan `data-hidden`) |

### 4.2 Motor de libro y calidad

| # | Hueco | Propuesta |
|---|---|---|
| M9 | **Modo infantil real** | Perfil «bold»: trazo ≥ 1 mm, sin tangles finos en el fondo, zonas ≥ 8 mm, límite de calidad más estricto (`badPerDm2` ≈ 4) |
| M10 | **Calidad mide colorabilidad, no atractivo** | Añadir métricas de composición: cobertura de la figura, contraste figura/fondo (densidad de tinta dentro y fuera de la silueta), y marcar páginas donde el fondo es más denso que la figura |
| M11 | **15 tangles para todo** | En un libro de 50 páginas el ojo empieza a reconocerlos. Meta: 30 tangles originales con nombre propio (sin autores CZT), cada uno con su paso a paso para la guía |
| M12 | **Monolitos** | Separar `figure.js` en `figures/` (definiciones por tema), `figureEngine.js` (subdivisión) y `backgrounds.js`; separar `app.js` en revisión, visor, exportación y estado |

### 4.3 Motor de ficha (`kdpListing.js`)

| # | Hueco | Propuesta |
|---|---|---|
| L1 | Solo español | Ficha en inglés para Amazon.com (el mercado más grande) con sus propias palabras clave |
| L2 | Palabras clave fijas por tema | Plantillas con variables (nº de páginas, edad, ocasión: regalo, Navidad) y validación de 50 caracteres por casilla |
| L3 | Sin categorías ni precio | Sugerir 3 categorías por tema y calcular regalías: 60 % del precio − coste de impresión (fijo + por página, según marketplace y tinta). Las tarifas de KDP cambian: leerlas de una tabla editable, no fijarlas en código |
| L4 | Sin aviso de contenido IA | KDP pide declarar imágenes generadas con IA. Este arte es procedural (algoritmos propios), no generado por un modelo de IA, pero conviene que la ficha recuerde revisar la declaración en el momento de publicar. *Insufficient data* sobre cómo clasifica KDP el arte procedural: consultar la ayuda oficial |

---

## 5. ¿Hacen falta imágenes prediseñadas? Sí, y con estas características

El motor ya acepta cualquier contorno cerrado; lo que falta es una vía de
entrada. Recomendación: **siluetas SVG de ilustrador para las figuras clave de
cada tema** (empezar por 10–15 por tema), no páginas completas. Así el motor
sigue haciendo lo suyo (subdivisión, tangles, fondo, calidad) y la variedad
se conserva.

### 5.1 Requisitos del archivo SVG (silueta para el motor)

| Requisito | Valor | Motivo |
|---|---|---|
| Formato | SVG 1.1 plano, UTF-8 | El parser será pequeño y determinista |
| `viewBox` | Cuadrado, `0 0 1000 1000`; figura centrada, tocando al menos dos bordes con un margen de 20 | El motor normaliza a −1…1 |
| Comandos | Solo `M L C Q Z` absolutos (mayúsculas) | Coinciden con el formato `cmds` actual. Arcos (`A`), `H/V/S/T` y relativos se convierten antes de importar (Inkscape: *Trayecto → Objeto a trayecto*, guardar como «SVG plano» con coordenadas absolutas) |
| Forma | Trayectos **cerrados** y rellenos (`fill`), sin trazo (`stroke="none"`) | El motor dibuja su propio contorno con el grosor correcto |
| Prohibido | `<image>`, `<text>`, `<use>`, `clipPath`, `mask`, degradados, filtros, `transform` anidados (aplanar), estilos CSS | No se pueden subdividir ni controlar |
| Huecos | `fill-rule="evenodd"` dentro del mismo trayecto | Ojos, asas, espacios entre patas |
| Autointersecciones | Ninguna | Rompen la subdivisión |
| Nodos | 40–400 por trayecto | Pocos = juguete; demasiados = lento y con astillas |
| Detalle mínimo | Ninguna parte más estrecha que 25 unidades (≈ 5 mm en una figura de 200 mm) | Por debajo no cabe un tangle ni la punta del rotulador |
| Capas (`<g id>`) | `silhouette` (obligatoria, contorno exterior unido) · `part-*` (se subdividen con tangles) · `back-*` (detrás) · `front-*` (delante, con halo) · `deco-*` (ojos, líneas; trazo abierto permitido solo aquí) | Mapean 1:1 a `parts / back / front / deco / silhouette` de `FIGURES` |
| Orientación | Mirando a la derecha, de pie sobre `y = 1000` si tiene suelo | El motor ya hace espejos y coloca el suelo (`branch`) |

### 5.2 Ficha que acompaña cada SVG (`figura.json`)

```json
{
  "id": "barn_owl",
  "label": { "es": "Lechuza", "en": "Barn owl" },
  "theme": "birds",
  "tags": ["animal", "nocturno"],
  "audience": "adult",
  "hideable": true,
  "ground": 0.92,
  "strings": { "angle": 0.4, "a": [2, 3], "b": [2, 3] },
  "zones": { "part-wings": "wing", "part-body": "belly" },
  "author": "Nombre del ilustrador",
  "license": "Cesión comercial exclusiva / CC0",
  "origin": "Dibujo original, sin calcar fotos ni obras con derechos"
}
```

`license` y `origin` son obligatorios: sin ellos el importador rechaza el
archivo. Protege la cuenta de KDP frente a reclamaciones de derechos.

### 5.3 Validación automática al importar

1. Parseo y conversión a `cmds` normalizados.
2. Cierre de trayectos, ausencia de autointersecciones y grosor mínimo
   (transformada de distancia sobre el raster, la misma de `pageQuality.js`).
3. Render de prueba en 3 encuadres y 3 semillas: debe pasar `qualityVerdict`.
4. Hoja de contacto automática para aprobación humana antes de entrar al
   repertorio.

### 5.4 Qué pedir al ilustrador (prioridad)

| Tema | Figuras sugeridas | Por qué |
|---|---|---|
| Dinosaurios bípedos | T. rex, raptor, espinosaurio, alosaurio | Hoy solo funcionan en origami |
| Adultos | Lobo, caballo, búho, elefante, tigre, ciervo, zorro, colibrí | Animales majestuosos: el núcleo del mercado adulto |
| Infantil | 15 animales tiernos con cara expresiva | El perfil «bold» necesita formas limpias |
| Nuevos temas | Océano (tortuga, medusa, ballena, raya), aves, gatos, insectos, Navidad | Ver §6.3 |

### 5.5 Arte de línea completo (página entera) — opcional

Si algún día se importan páginas completas (no siluetas): SVG con trazos de
0.5–1.5 mm a tamaño de impresión, regiones cerradas de ≥ 3 mm², sin grises ni
negros sólidos > 5 % de la página, dentro del área segura. Deben pasar el mismo
control de calidad. No se recomienda como vía principal: pierde la ventaja del
motor (variedad infinita y reproducible).

---

## 6. Qué hace falta para que los libros sean muy vendibles

Lo que decide la venta, en orden: **portada → título y nicho → muestra
interior → reseñas → precio**. La app hoy solo cubre bien el interior.

### 6.1 Portada (hoy: no existe)

- **Generador de portada** con las medidas que ya calcula `coverSpec`:
  contraportada + lomo + portada, sangrado 0.125 in, zona del código de barras
  (2 × 1.2 in, abajo a la derecha de la contraportada).
- Portada = la mejor página del libro **coloreada** (relleno automático por
  regiones con una paleta armónica) + título grande legible en miniatura de
  160 px de ancho.
- Contraportada con 4–6 miniaturas del interior: es lo que mira quien compra.
- Exportar PDF de portada a 300 ppp.
- Alternativa con plugin: el conector de **Canva** (disponible en esta sesión)
  puede crear la portada a partir de las medidas y las páginas exportadas,
  redimensionar a mockups y generar imágenes A+. Se recomienda como paso
  intermedio mientras no exista el generador propio.

### 6.2 Interior que convence en «Leer muestra»

- Página de título, copyright (con año y «todos los derechos reservados»),
  «Este libro pertenece a», prueba de colores y, al final, soluciones de
  figuras escondidas y una página de «¿Te gustó? Deja tu reseña».
- **Las 3–4 primeras ilustraciones deben ser las mejores** del libro: ordenar
  por una puntuación de composición (M10) y fijar esas páginas al principio.
- Coherencia de serie: mismo marco, misma tipografía del pie, mismo logotipo
  de editorial en todos los libros.

### 6.3 Nichos y temporada

Los datos de ventas disponibles son parciales. En Australia, dos de los diez
libros más vendidos de 2025 fueron libros de colorear «cozy» de Coco Wyo
(*Cozy Corner*, *Cozy Cuties*) [nzcity]; las afirmaciones sobre tendencias de
nostalgia o porcentajes de conversión por subnicho vienen de blogs sin fuente
primaria y no se pueden verificar. Con esa cautela, nichos compatibles con el
motor actual (figura grande + patrones):

| Nicho | Encaje con el motor | Comentario |
|---|---|---|
| Animales majestuosos (lobo, león, búho, elefante) | Alto, con siluetas importadas | Núcleo del mercado adulto |
| Océano | Alto | Fondos temáticos naturales (burbujas, algas) |
| Gatos | Alto | Público fiel |
| Navidad / Halloween / Día de la Madre | Medio | Picos de demanda; preparar con 8–10 semanas de antelación |
| Bold & easy / letra grande | Alto tras M9 | Adultos mayores y principiantes |
| Escenas «cozy» (interiores, cafés) | Bajo | Requiere ilustración de escena, fuera del alcance del motor |

### 6.4 Ficha y precio

- Ficha bilingüe (L1), 7 casillas de palabras clave sin repetir palabras del
  título, 3 categorías, rango de precio sugerido según páginas y regalías (L3).
- *Insufficient data* sobre volúmenes de búsqueda reales: la app no tiene
  acceso a datos de Amazon. Validar palabras clave en la barra de búsqueda de
  Amazon o con una herramienta de terceros antes de publicar.

### 6.5 Cumplimiento

- KDP exige declarar contenido generado con IA (texto, imágenes, traducciones),
  y su control de calidad retira libros repetitivos o de bajo esfuerzo
  [KDP Help; inkfluenceai]. La variedad y la revisión página a página de la
  app son la mejor defensa; mantener la auditoría de libros como paso previo.
- Las reglas de marca (`BLOCKED_TERMS`) ya funcionan; extenderlas a la portada
  generada.

---

## 7. Plan detallado por fases

Tamaño: **S** ≤ 1 día · **M** 2–4 días · **L** 1–2 semanas.

### Fase 0 — Cimientos (S–M, primero)

| Tarea | Archivos | Criterio de aceptación |
|---|---|---|
| 0.1 Librerías en local (U3) | `js/vendor/`, `index.html` | PDF y Voronoi funcionan sin red; e2e pasa con red bloqueada |
| 0.2 Archivar docs obsoletos | `docs/archivo/` | README enlaza solo docs vigentes |
| 0.3 Separar `app.js` en módulos | `js/ui/review.js`, `viewer.js`, `bookExport.js`, `state.js` | `npm test` y `npm run e2e` sin cambios; golden idénticos |

### Fase 1 — Producción diaria sin pérdidas (M)

| Tarea | Criterio |
|---|---|
| 1.1 Abrir receta (U1) | Receta descargada → abrir → mismo PDF byte a byte (o mismas huellas golden por página) |
| 1.2 Autoguardado en IndexedDB (U2) | Recargar a mitad de la revisión y recuperar el libro con sus ↻ |
| 1.3 Biblioteca «Mis libros» (U5) | Lista con estado y ASIN; duplicar un libro para hacer el volumen 2 con otra semilla |
| 1.4 Deshacer y fijar páginas (U6, U7) | ↻ reversible; páginas fijadas sobreviven a «Preparar» |
| 1.5 Elegir/excluir figuras (U9) | Libro sin las figuras excluidas; prueba automática |

### Fase 2 — Libro completo (M–L)

| Tarea | Criterio |
|---|---|
| 2.1 Front matter (U4, §6.2) | Título, copyright, «pertenece a», prueba de color; entran en `planSequence` y en el recuento de páginas y margen interior |
| 2.2 Soluciones de figuras escondidas (M8) | Página final con cada figurita resaltada; prueba que compara con `data-hidden` |
| 2.3 Generador de portada (§6.1) | PDF a medidas de `coverSpec`; texto del lomo solo con > 79 páginas; zona de código de barras libre; sin términos bloqueados |
| 2.4 Vista de libro abierto (U8) | Dobles páginas y reversos visibles como en papel |
| 2.5 Opción con sangrado (U14) | PDF de 8.625 × 11.25 in con fondo a sangre; aviso de elegir «Con sangrado» en KDP |

### Fase 3 — Calidad visual del motor (L)

| Tarea | Criterio |
|---|---|
| 3.1 Importador de siluetas SVG (§5, M1) | Parser `M L C Q Z`, validación y hoja de contacto; una figura importada pasa `npm test` |
| 3.2 Grosor de línea en 3 niveles (M3) | Golden actualizados con revisión visual; colorabilidad igual o mejor |
| 3.3 Cobertura mínima de figura y contraste figura/fondo (M2, M10) | Auditoría: ninguna figura < 30 % de cobertura en «centrado» |
| 3.4 Perfil infantil «bold» (M9) | Trazo ≥ 1 mm; `badPerDm2` ≤ 4 en el 95 % de las páginas |
| 3.5 Tangles por zona (M5) y 15 tangles nuevos (M11) | Guía y pasaporte actualizados; nombres propios sin marcas |
| 3.6 Fondos temáticos (M7) | Un fondo propio por tema |

### Fase 4 — Venta (M)

| Tarea | Criterio |
|---|---|
| 4.1 Ficha bilingüe + categorías + regalías (L1–L3) | Ficha EN válida; casillas ≤ 50 caracteres; tabla de tarifas editable |
| 4.2 Orden «escaparate» (§6.2) | Las 4 primeras ilustraciones son las de mejor puntuación |
| 4.3 Mockups y A+ con Canva | Plantilla de mockup 3D y 3 módulos A+ a partir de páginas del libro |
| 4.4 Lotes y ZIP (U10) | 5 libros en una tanda, ZIP con interior, portada, ficha y receta |
| 4.5 Nuevos temas: océano, gatos, aves, Navidad | Requieren siluetas de §5.4 |

### Fase 5 — Escenas (L, opcional)

Escenas de 2–3 figuras (M6) y cuerdas que siguen el esqueleto (M4). Alto
impacto visual, alto riesgo técnico: abordar solo con la Fase 3 estable.

### Riesgos

- **Cambiar el motor rompe libros publicados.** Mantener `overrides.seedScheme`
  y versionar el motor dentro de la receta (`engineVersion`).
- **Siluetas importadas con derechos ajenos.** Exigir `license` y `origin`.
- **Rendimiento en móvil** al guardar revisiones grandes: guardar semillas, no SVG.

---

## 8. Comparación de las dos vías para el repertorio

| Criterio | Opción A: solo procedural (mejorar el código actual) | Opción B: híbrido (siluetas SVG de ilustrador + motor) |
|---|---|---|
| Calidad de silueta | Limitada por 20–30 puntos; bípedos ilegibles | Nivel de ilustración profesional |
| Coste | Solo tiempo de desarrollo | Encargo de ilustración por figura + importador (Fase 3.1) |
| Variedad y reproducibilidad | Total | Total: el motor sigue subdividiendo y sorteando |
| Velocidad para abrir un nicho nuevo | Lenta (dibujar en código) | Rápida (10–15 SVG + `figura.json`) |
| Riesgo legal | Bajo | Bajo si se exigen licencia y origen |
| Encaje con libros líderes | Bajo–medio | Alto |

**Veredicto.** A basta para seguir publicando nichos geométricos, vitral y
origami, donde el contorno simple es parte del estilo. B es la vía para
competir en animales, infantil y temas de regalo, donde la silueta vende el
libro. Orden recomendado: Fases 0–2 (sin pérdidas y libro completo), luego B.

---

## Fuentes

- [nzcity — libros más vendidos en Australia 2025](https://home.nzcity.co.nz/news/article.aspx?id=439736)
- [KDP Help — contenido generado con IA](https://kdp.amazon.com/help/topic/G200672390)
- [inkfluenceai — reglas KDP 2026 para libros de colorear con IA](https://www.inkfluenceai.com/blog/sell-ai-coloring-books-on-kdp-2026) (blog de proveedor; tomar con cautela)
- [kdpeasy — tendencias 2026](https://www.kdpeasy.com/guides/coloring-book-trends-2026) (sin fuente primaria)

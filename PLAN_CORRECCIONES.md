# Revisión de producción y plan de correcciones (3 nov 2026)

Revisión de la rama tras la Fase 5 (commit `b95aa86`). Objetivo: confirmar que
la app produce interiores que KDP acepta sin fallos y dejar un plan para lo que
aún no está a la altura.

**Cómo se revisó.** No basta con que las pruebas pasen; hay que mirar el libro.
Se ejecutaron `npm test` (22 pruebas + golden), la prueba de punta a punta en
Chromium con 12 y 40 diseños, `audit:books` y `audit:patterns`. Después se
abrieron los PDF descargados con `pdfinfo`, `pdffonts` y `pypdf`, y se
renderizaron página a página para verlos.

---

## 1. Errores encontrados y ya corregidos

| # | Error | Efecto en un libro real | Corrección | Prueba que lo impide |
|---|---|---|---|---|
| E1 | **La portadilla cortaba títulos de más de ~30 caracteres.** El ajuste de línea suponía letras de 3.5 mm; a 10 mm en negrita miden ~6 mm | Título impreso cortado por ambos lados («nosaurios para colorear: patrones prehistóric») | Medición del ancho letra a letra; lo que va tras «:» pasa a subtítulo; la letra baja si no cabe. Igual en créditos, portada y lomo | `test_verify` renderiza la portadilla con 4 títulos (hasta 80 caracteres, en mayúsculas) en 2 tamaños y exige que la tinta no salga del marco |
| E2 | **Sin título, el libro salía como «Libro para colorear»**, aunque la ficha proponía «Dinosaurios para colorear…» | Portadilla, créditos y metadatos del PDF genéricos | Elegir un tipo de libro rellena el título del tema (si el campo está vacío o lo puso la app). Aviso ⚠ al descargar sin título. Metadatos del PDF con el título real | e2e: tras elegir «Dinosaurios» el título debe contener «Dinosaurios» |
| E3 | **El PDF declaraba 14 fuentes sin incrustar** (Helvetica, Courier…) aunque no las usa: todas las páginas son imágenes | El control de KDP puede rechazar el interior por «fuentes no incrustadas» | `putOnlyUsedFonts: true` en los tres `new jsPDF` | e2e: el PDF no debe contener `/Type /Font` y todas las páginas deben tener el mismo tamaño |
| E4 | **Esquinas en «L» en «Este libro pertenece a»** | Se parecen a marcas de corte; KDP rechaza interiores con marcas de impresora | Eliminadas | `test_verify`: la página no lleva trazos en L |
| E5 | **Etiquetas encimadas en la página de prueba** («0.6 mm», «0.8 mm», «1 mm» sobre el círculo) | Defecto visible en la página 4 de todos los libros | Las líneas terminan 18 mm antes de la columna de formas | `test_verify`: cada etiqueta termina antes del borde del círculo, en 3 tamaños de página |
| E6 | **Lomo calculado con páginas impares** (47, 65). KDP añade una página en blanco a los interiores impares | Lomo 0.002 in más estrecho que la plantilla de KDP | `coverSpec` redondea al par siguiente | `test_verify`: 65 y 66 páginas dan el mismo lomo |
| E7 | **Aviso de margen interior fijo en 24 páginas.** KDP exige más margen al crecer el libro (9.6 mm hasta 150 págs, 12.7 mm hasta 300…) | Un libro de 300 págs con 10 mm de margen no avisaba al descargar | `kdpWarning` recibe el total real de páginas | — (la revisión ya usaba el total real) |
| E8 | **La prueba e2e no arrancaba** en entornos con otra versión de Chromium | Fallo de herramienta, no del libro, pero dejaba la app sin prueba en navegador | Si falta el Chromium de playwright usa `PW_EXEC` o `/opt/pw-browsers/chromium` | La propia e2e |
| E9 | **`PRODUCCION.md` desactualizado**: decía que jsPDF se cargaba de internet y que la receta no se podía abrir | Quien publica hace pasos que ya no hacen falta | Filas corregidas; añadido «título escrito» a la lista previa | — |

Resultado tras las correcciones: `npm test` y golden en verde; e2e en verde con
12 diseños (47 págs) y 40 diseños (65 págs); `pdffonts` no lista ninguna fuente.

---

## 2. Lo que sigue pendiente (plan)

Ordenado por riesgo para un libro publicado. Ninguno bloquea la subida a KDP si
se sigue la lista «Antes de subir» de `PRODUCCION.md`, pero todos pueden llegar
a la reseña de un cliente.

### P1 — Páginas que «Arreglar» no consigue sanear

`audit:books` (semilla 20261031), con el umbral real:

| Tipo | Marcadas | Tras «Arreglar» |
|---|---|---|
| Biología | 3 | 2 |
| Críptidos | 2 | 1 |
| Infantil | 8 | 2 |
| Origami | 0 | 0 |

Hoy esas páginas se pueden descargar con solo un aviso. **Plan:**
1. Escalar el arreglo: tras N intentos con otra semilla, probar otro encuadre
   (`center`) y después un tangle más abierto de la paleta.
2. Si aún falla, sustituir el diseño por otra figura del tema.
3. Bloquear «Descargar PDF» mientras quede alguna marcada, salvo que se acepte
   página a página en el visor (queda anotado en la receta).
4. Prueba: `audit:books` debe terminar con 0 marcadas en los 8 tipos; si no,
   `npm run check` falla.

### P2 — Páginas casi iguales en el libro de origami

5 pares con parecido ≥ 0.8 (espinosaurio 0.90 y 0.84, velocirraptor 0.90,
anquilosaurio 0.83). En origami el relleno es casi liso y el espejo no basta
para diferenciar. **Plan:** compuerta de parecido en el lote (rehacer la
segunda página si supera 0.8) y, para origami, cambiar encuadre o escala en la
segunda vuelta. Prueba: `audit:books` exige «pares casi iguales 0».

### P3 — Peso del PDF en libros grandes

Las páginas se incrustan como PNG RGB a 300 ppp: ~0.65 MB por página. Un libro
de 828 páginas rondaría 540 MB; el límite de KDP es 650 MB. **Plan:** incrustar
en escala de grises (o 1 bit para línea pura) y medir. Prueba: e2e con un tope
de MB por página.

### P4 — Hueco vacío en origami

La guía promete «mayor hueco < 15 mm de radio», pero `audit:books` mide en
origami un hueco medio de 46 mm (máx. 63.5). Insufficient data para saber si
la cifra es diámetro o radio y si la promesa aplica a origami (caras grandes a
propósito). **Plan:** aclarar la métrica en `bookAudit.mjs` y ajustar la guía o
el motor.

### P5 — Borrador de portada

El título de la portada cabe ya, pero en una sola línea y a veces pequeño.
**Plan:** reutilizar el ajuste de líneas de la portadilla. Prioridad baja: la
portada de venta se hace fuera.

### P6 — Rellenos con muchas manchitas en hexágono

`audit:patterns`: `fillPrintemps` 132 manchitas por celda hexagonal,
`fillParadox` 32 en cuadrada. La Prueba 18 mantiene la suma bajo su techo,
pero conviene confirmar que esas combinaciones no salen en libros infantiles.

---

## 3. Cómo evitar que se repitan

Los errores E1–E5 tienen la misma raíz: **las páginas de texto nunca se
miraban renderizadas.** Las pruebas comprobaban que el SVG existía, no cómo
quedaba en la hoja. La regla nueva:

1. **Toda página que lleve texto se prueba renderizada**, con un título largo y
   en mayúsculas, en al menos dos tamaños de página. La prueba de portadilla
   (E1) es la plantilla.
2. **El PDF descargado se inspecciona en la e2e** (fuentes, tamaños de página,
   nº de páginas), no solo se cuenta.
3. **`npm run check` antes de publicar** con una versión nueva de la app:
   pruebas, golden y libro de punta a punta. Un rojo = no se publica.
4. **Toda promesa de la ficha o de la guía tiene su prueba** (como ya ocurre
   con «sin negros» y «una sola cara»). P4 es un ejemplo de promesa sin prueba.
5. **Tras cada fase grande, una revisión visual**: generar un libro de cada
   tipo y hojearlo completo, como en esta revisión.

---

## 4. Seguimiento en Beads

Las correcciones ya integradas y las mejoras pendientes de la sección 2 están registradas en Beads (`bd`):

### Cerradas (entregadas en `main`)
- `zentangle_app_solo_fixed-b5i` (P1, bug) — Portadilla sin títulos cortados, PDF sin fuentes declaradas y páginas de cortesía aptas para KDP (`e83aa6e`)
- `zentangle_app_solo_fixed-67v` (P1, bug) — Fondo temático como capa sobre el fondo de tangles (`443b397`)
- `zentangle_app_solo_fixed-6oo` (P2, feature) — UI/UX: barra lateral con navegación de pasos en scroll, interruptores descriptivos y herramientas agrupadas (`2f985e0`)

### Abiertas (plan de mejoras §2)
- `zentangle_app_solo_fixed-mx0` (P1, task) — Arreglar: escalar hasta 0 páginas marcadas y bloquear PDF
- `zentangle_app_solo_fixed-hom` (P1, task) — Compuerta de parecido entre páginas (origami)
- `zentangle_app_solo_fixed-o7q` (P2, task) — PDF en escala de grises para libros grandes
- `zentangle_app_solo_fixed-khc` (P2, task) — Aclarar métrica de hueco vacío en origami
- `zentangle_app_solo_fixed-edh` (P3, task) — Portada: título en varias líneas
- `zentangle_app_solo_fixed-2nc` (P3, task) — Revisar fillPrintemps/fillParadox en libros infantiles

---

## 5. Revisión final antes de uso (5 nov 2026)

Recorrido completo en Chromium: 59 estilos, los 8 tipos de libro, todas las
descargas (SVG, PNG, PDF, JSON, libro, ficha, portada, libro abierto, mockups,
receta, «Descargar todo», ficha bilingüe, lote ZIP), biblioteca, receta,
importación de siluetas, modo imagen y recarga. Después, `pdfinfo`/`pdffonts`
y renderizado de portada y páginas finales.

| # | Error | Efecto | Corrección | Prueba |
|---|---|---|---|---|
| R1 | **La regla de cobertura marcaba casi todo** (35/30 % del marco). Mide el área de la silueta, y una figura delgada encajada a página completa cubre ~9 % | 88/90 páginas de dinosaurios y 89/90 de origami salían «⚠ revisar»; «Arreglar» no podía corregirlas | Umbrales 6/5/6 % (center/offset/zoom): solo atrapan figuras diminutas. Mínimo medido en 650 páginas: 6.4 % | Prueba 23: 30 figuras delgadas sin marca; una de 2 % sí se marca |
| R2 | **Portada sin sangrado en las posiciones**: lomo y portada desplazados 3.2 mm | Texto del lomo fuera del lomo en libros finos (KDP lo rechaza) | Secciones desde el sangrado; hueco del código de barras a la medida de KDP (2 × 1.2 in, a 0.25 in) | Prueba 23: texto del lomo centrado |
| R3 | **Portada con 14 fuentes sin incrustar** (igual que E3) | KDP puede rechazar la portada | `putOnlyUsedFonts` | `pdffonts` vacío |
| R4 | **Receta cargada nunca quedaba «lista»**: `seedScheme` entraba en la huella del libro | El botón pedía preparar de nuevo y se perdían los diseños cambiados con ↻ | Huella tomada antes de fijar `seedScheme` | Recorrido: tras cargar la receta el botón dice «Descargar libro» |
| R5 | **Soluciones con ids en inglés** («barn_owl») y número de diseño en vez de página; en libros grandes faltaban páginas | Página impresa poco profesional y confusa | Nombres en español (`js/core/figureNames.js`), página real y figura principal; lista guardada por página | Prueba 23: todas las figuras tienen nombre |
| R6 | PDF de libro abierto bajaba como «download» (título con «:» y acentos) | Archivo sin nombre ni extensión | Nombre de archivo saneado | Recorrido |
| R7 | 404 de `favicon.ico` en consola | Ruido en consola | Favicon vacío en línea | Recorrido sin errores |

Pendientes de §2 sin cambios (P2–P6). P1 cambia de escala: tras R1 las páginas
marcadas son pocas y «Arreglar» resuelve la mayoría.

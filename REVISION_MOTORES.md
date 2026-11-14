# Revisión de motores y plan (14 nov 2026)

Revisión de `main` (`5372ab2`) hecha generando páginas, no releyendo código:
hojas de contacto de los 8 tipos de libro (12 páginas cada uno), una página de
cada uno de los 55 estilos, medición de contraste figura/fondo en 148 páginas y
recorrido de la interfaz en Chromium. No se cambió código.

**Para quién:** quien mantiene la app y decide qué construir a continuación.
**Qué decide:** el orden de trabajo para que los libros compitan por aspecto,
no solo por cumplir KDP.

## 1. Estado comprobado

| Comprobación | Resultado |
|---|---|
| `npm test` (23 pruebas + golden de 168 páginas) | Pasa (7 min 22 s) |
| `npm run e2e` (libro de 12 diseños, PDF de 47 páginas, ficha) | Pasa (46 s) |
| Interfaz en escritorio (1400 px) y móvil (390 px) | Sin errores de consola |
| `bd` (Beads) | No instalado en este entorno: no se crearon tareas |
| `audit:books`, `colorability` | No ejecutados en esta revisión |

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

### Oportunidades de ingeniería

| # | Hallazgo | Evidencia |
|---|---|---|
| I1 | **El contraste solo se mide en el navegador** y con un umbral que casi nunca salta (`contraste ≥ 0`) | `analyzeContrast` usa `Path2D`; `audit:books` y `npm test` no lo ven. El T. rex de 1.04 pasa |
| I2 | **`npm test` tarda más de 7 minutos** | Medido. Insufficient data: no se midió qué pruebas pesan más |
| I3 | **`figure.js` pesa 221 KB** (figuras, motor, fondos y escenas juntos) | Pendiente M12 de `REVISION_Y_PLAN.md`, sin hacer |
| I4 | Nombre «Zentangle Creator» en la interfaz (marca registrada) | Pendiente de decisión desde la revisión anterior |

### Sin datos

- **Comparación con la competencia**: Insufficient data. No se midió ningún
  libro de terceros; «mejor que la competencia» necesita un patrón de
  referencia (paso 0.2 del plan).
- **Pruebas con personas que colorean**: Insufficient data.

## 4. Plan

Tamaño: **S** ≤ 1 día · **M** 2–4 días · **L** 1–2 semanas.

### Fase 0 — Medir antes de tocar (S)

| Tarea | Cómo se verifica |
|---|---|
| 0.1 Pasar la medición de contraste y cobertura a Node (`_samples/contrastAudit.mjs`, máscara con resvg) y añadirla a `audit:books` | `npm run audit:books` imprime la tabla de §2 y falla si un libro baja de sus umbrales |
| 0.2 Patrón de referencia: medir las mismas dos cifras en 20 páginas escaneadas de 3–5 libros líderes del nicho (compradas, solo para medir) | Tabla con cobertura y razón de cada libro; los umbrales de las fases 1–2 se ajustan a esas cifras |
| 0.3 Instalar `bd` en el entorno y crear una tarea por fila de este plan | `bd list --status=open` las muestra |

### Fase 1 — Defectos (M)

| Tarea | Archivos | Cómo se verifica |
|---|---|---|
| 1.1 Escenas (D1, D2): dibujar fondo y figuritas una sola vez a nivel de página, recortados al marco menos las siluetas; subfiguras sin fondo propio; figuritas del tema de la escena | `figure.js` (`generateZenScene`) | Prueba nueva: ningún `clip-path` de fondo coincide con una `subArea`; todas las figuritas comparten tema con la escena; hueco vacío < 20 mm. Hoja de 12 escenas por tema revisada a ojo |
| 1.2 Hasta que 1.1 pase, quitar los 3 estilos de escena del selector | `stylePicker.js` | Recorrido: no aparecen |
| 1.3 Origami (D3): fondo más ligero que la figura (facetas mayores y sin tangle en 1 de cada 2, o tangles solo dentro), halo blanco de 3 mm y contorno de 1.6–2 mm | `figure.js`, presets `*_origami` | Razón ≥ 1.5 en todas las páginas y media ≥ 1.8 en 34 páginas; golden actualizado a propósito |
| 1.4 Bípedos (D4): sacarlos del origami hasta tener silueta nueva (2.2) | `FIGURE_SETS.dinoOrigami*`, `cryptidsOrigami` | Ninguna página de origami con cobertura < 12 % |

### Fase 2 — Figura protagonista (L)

| Tarea | Cómo se verifica |
|---|---|
| 2.1 Encaje por área (Q1): las figuras delgadas se amplían y recortan en vez de encogerse; «offset» prohibido si la cobertura queda < 15 % | Cobertura < 15 % en menos del 10 % de las páginas de cada libro; mediana ≥ 20 % en dinosaurios y críptidos |
| 2.2 Siluetas ilustradas (Q2, Q3): 40 SVG por el importador, en este orden: bípedos (6), adultos (caballo, lobo, ciervo, búho, zorro, elefante, tigre, colibrí), gatos (10), Navidad (10), aves (6) | Cada figura pasa el validador del importador; prueba de reconocimiento: la silueta sola, en negro, se nombra bien por 4 de 5 personas |
| 2.3 Figuritas con sentido (Q4): reserva por etiquetas de tema; quitar la copia de la figura dentro de sí misma en adultos | Prueba: cada figurita comparte etiqueta con la figura principal |
| 2.4 Infantil grueso (Q5): la receta fija el perfil `bold`, separación mínima de 3.5 mm y como máximo 4 secciones por parte | 95 % de las páginas con ≤ 4 zonas difíciles por dm²; ninguna región coloreable < 20 mm² dentro de la figura |

### Fase 3 — Catálogo (M)

| Tarea | Cómo se verifica |
|---|---|
| 3.1 Recetas de océano, gatos, aves y Navidad cuando cada tema tenga ≥ 14 figuras (Q6) | `audit:books` las incluye; ninguna figura sale más de 2 veces en un libro de 28 |
| 3.2 Reducir los estilos geométricos a los 8 que más se distinguen (Q7); el resto queda accesible solo por receta antigua | Parecido entre estilos < 0.8 con `pageSimilarity`; las recetas guardadas siguen abriendo |

### Fase 4 — Mantenimiento (M)

| Tarea | Cómo se verifica |
|---|---|
| 4.1 Separar `npm test` en rápido (< 60 s) y completo (I2) | `npm run test:fast` < 60 s; `npm test` cubre lo mismo que hoy |
| 4.2 Partir `figure.js` en definiciones por tema, motor, fondos y escenas (I3) | Golden idéntico sin `--update` |
| 4.3 Decidir el nombre de la app (I4) | Decisión del dueño |

### Compuerta de cada fase

`npm run check` en verde, `npm run audit:books` dentro de umbrales (con la
tabla de contraste de 0.1) y hoja de contacto (`npm run sheet -- <tipo> 24`)
de cada libro afectado revisada a ojo. Cambiar el motor altera libros ya
publicados: subir `engineVersion` en la receta en cada fase que toque el dibujo.

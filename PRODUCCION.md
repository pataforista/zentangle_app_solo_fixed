# Proceso de producción de un libro para colorear

Guía práctica para pasar de la app a un interior aprobado en KDP sin
sorpresas. Cada paso dice qué hacer, qué hace la app sola y qué tienes que
mirar tú. Al final está la lista de control y los huecos que la app todavía
no cubre.

---

## El proceso en 7 pasos

### 0. Atajo: un clic

En **① Elige un estilo**, el recuadro **⚡ ¿Qué libro quieres hacer?** trae
tipos de libro listos: Zentangle para adultos, Mezcla más vendida, Vitral
relajante, Dinosaurios, Biología, Críptidos e Infantil. Un clic elige el
estilo, el nº de diseños y las opciones (dificultad, guía, dobles páginas).
Después pulsa **📖 Preparar libro**: con «🛠 Arreglar solas…» marcado, las
páginas con zonas difíciles se rehacen sin más clics. La revisión muestra
**Para terminar: Revisar → ⬇ PDF → 📝 Ficha KDP → 🧾 Receta** y marca cada
paso con ✓. La ficha usa el tema del libro (títulos y palabras clave de
dinosaurios, críptidos…). Los pasos 1–7 explican cada decisión por si
quieres ajustarla a mano.

### 1. Decide el libro antes de abrir la app

| Decisión | Recomendado | Por qué |
|---|---|---|
| Tamaño | 8.5×11 in | El más habitual en libros para colorear de KDP. |
| Estilo | «Más vendidos» o «Figura zentangle» | Sin rellenos negros y probados con la compuerta de colorabilidad. «Aleatorio (todos)» puede meter páginas con tinta negra. |
| Reverso | Hoja en blanco | Evita que el rotulador traspase al diseño siguiente. «Otro diseño» exige papel color prémium en KDP. |
| Nº de diseños | 30–50 | El libro tiene que llegar a 24 páginas como mínimo. |

### 2. Configura la página (②)

- **Margen**: deja 12.7 mm o más. La app avisa si queda por debajo del
  margen interior mínimo de KDP para el número de páginas (9.6 mm hasta 150
  páginas, 12.7 mm hasta 300…).
- **Sangrado**: «Sin sangrado». El PDF sale a tamaño de corte exacto; en KDP
  elige *No bleed*.
- Las **guías de zona segura**, la **textura de papel** y el **sombreado**
  son solo para la pantalla: la app los quita siempre del libro y de las
  descargas de página.

### 3. Configura el libro (③) y lee el resumen

El resumen verde dice cuántas páginas saldrán. Si aparece ⚠, corrígelo antes
de seguir: páginas de menos, margen interior insuficiente o más de 828
páginas.

### 4. Prepara el libro y deja que la app lo revise

1. Pulsa **📖 Preparar libro (revisar páginas)**. Cada página pasa un
   **control de calidad**: la app cuenta las zonas donde no cabe la punta de
   un rotulador (~1.2 mm) y mide la tinta. La miniatura lleva **✓** o
   **⚠ revisar**, y la cabecera dice cuántas quedaron marcadas.
2. Si hay marcadas, pulsa **🛠 Arreglar las marcadas**: cada una se regenera
   hasta 3 veces y la app se queda con el mejor intento. Mantiene el estilo
   y la figura de la página.
3. Toca una página para abrirla en el **visor**: la ves como vector, nítida a
   **tamaño real** o al **200 %**, con las zonas difíciles **en rojo**. Pasa
   de página con ← → y cambia la que no te guste con **↻ Cambiar**.
4. Mira además, a ojo:
   - dos páginas seguidas que se parezcan demasiado;
   - en dobles páginas, que nada importante caiga en el lomo.

> Unas pocas esquinas rojas en una figura son normales (donde los cortes
> internos tocan el contorno). Lo que conviene cambiar son las páginas con
> muchas zonas rojas juntas.

### 5. Guarda la receta y descarga

- **🧾 Receta del libro**: un JSON con el tamaño, el margen, el estilo, la
  semilla base y la semilla de cada página (incluidos los ↻). Guárdalo junto
  al PDF: es la única forma de saber después qué se imprimió.
- **⬇ Descargar PDF**: arma el interior con exactamente las páginas
  aprobadas.

### 6. Hojea el PDF

La calidad de cada dibujo ya la revisaste en el visor. En el PDF comprueba
el armado:

- el número de páginas coincide con el que anunciaba el botón;
- los diseños quedan en página derecha y su reverso en blanco (si elegiste
  hoja en blanco);
- la guía, el pasaporte y las páginas «Tu turno» se leen bien (el texto usa
  la fuente del equipo: Helvetica o Arial);
- no hay líneas rojas punteadas, fondos grises ni sombras;
- el pie de nivel no se corta en el borde inferior.

### 7. Ficha y portada

- **📝 Texto para la ficha de KDP**: títulos, descripción y 7 palabras clave
  sin marcas ajenas, más las medidas de la portada: grosor del lomo y tamaño
  total con sangrado a 300 ppp.
- Genera la portada con KDP Cover Creator o con su plantilla, y confirma las
  medidas en la calculadora oficial de KDP: el lomo cambia si añades o
  quitas páginas.
- Al subir: interior **sin sangrado**, tinta **blanco y negro** en papel
  blanco (o **color prémium** si elegiste «Otro diseño» como reverso).
- Antes de publicar, usa el visor de KDP y, si puedes, pide una prueba
  impresa.

---

## Lista de control antes de subir

- [ ] Resumen del libro sin ⚠ y con «✓ Cumple los límites de KDP».
- [ ] Control de calidad sin páginas marcadas (o las que quedan, vistas en el
      visor y aceptadas).
- [ ] Receta JSON guardada junto al PDF.
- [ ] PDF hojeado: sin guías, grises ni pies cortados.
- [ ] Nº de páginas del PDF = nº anunciado en el botón.
- [ ] Ficha sin «Zentangle», «Zendala» ni «Zendoodle» en título, subtítulo,
      portada o palabras clave.
- [ ] Portada con las medidas de la ficha, comprobadas en la calculadora de KDP.
- [ ] Opción de papel en KDP coherente con el reverso elegido.
- [ ] Vista previa de KDP aprobada (y prueba impresa si es el primer libro de
      una serie).

---

## Qué hace la app sola

| Riesgo | Protección |
|---|---|
| Diseño que traspasa al siguiente | Con «Hoja en blanco», cada diseño va en página derecha con el reverso vacío. |
| Margen insuficiente | Aviso en el resumen según el nº de páginas. |
| Guías, textura o sombreado impresos | Se quitan del libro y de las descargas de página. |
| Pie de nivel fuera de la zona segura | Nunca a menos de 7.6 mm del borde. |
| Regiones imposibles de colorear | Control de calidad en cada página del libro, «🛠 Arreglar» y visor con zonas en rojo; además, compuerta por relleno y celda en `npm test`. |
| Páginas casi negras | El control marca las páginas con más del 25 % de tinta. |
| Estilos repetidos | Secuencia sin vecinas repetidas; las figuras no se repiten hasta agotarlas. |
| Astillas junto a cuerdas y contornos | Margen blanco fino (sin línea) junto a cuerdas, auras y marco: los trozos cortados del tangle se unen a él. |
| Figuras que se parecen | Cada página de figura usa su propia paleta de 8 tangles (en 3 páginas salen los 15), y cuando una figura vuelve a salir va en espejo. |
| Marcas registradas | Ficha y páginas con la marca solo como atribución. |
| Libro irreproducible | Semillas deterministas + receta JSON. |

---

## Huecos pendientes

Ordenados por el daño que pueden causar en un libro publicado.

| Prioridad | Hueco | Efecto | Qué hacer mientras tanto |
|---|---|---|---|
| Baja | 20 figuras y 22 iconos. Un libro «Más vendidos» de 50 diseños tiene unas 20 páginas de figura: puede repetir alguna al final (en espejo, con otra paleta y quizá en otro estilo: facetado o vitral). | Solo se nota en libros muy largos de una sola figura. | Para libros de más de 50 diseños, mezclar «Figura zentangle», «Figura facetada» y «Vitral». |
| Baja | Las figuras dejan esquinas diminutas donde los cortes internos tocan el contorno (de 20 a 90 por página). | Se notan poco al colorear, pero son la causa de casi todas las páginas marcadas. | «🛠 Arreglar» y el visor. Corregirlo en origen exige recortar los cortes junto al contorno. |
| Media | La receta se exporta pero no se puede cargar. | Rehacer un libro exige poner la semilla y los ajustes a mano y repetir los ↻. Repetirlo idéntico exige además el mismo commit de la app. | Guardar la receta y anotar el commit usado. |
| Media | La app no genera portada ni página de créditos/copyright ni «Este libro pertenece a». | Hay que hacerlas fuera. | KDP Cover Creator y un editor de PDF. |
| Media | jsPDF (y la librería del estilo orgánico) se cargan desde internet. | Sin conexión no se puede armar el PDF. | Trabajar con conexión. |
| Baja | La dificultad progresiva, fuera de las figuras, solo abre o cierra el espaciado. | La progresión es suave en mandalas y mosaicos. | Usar «Figura zentangle» si la progresión es el argumento de venta. |
| Baja | El tiempo por página es una estimación por nivel, no una medición. | — | No prometer tiempos en la ficha. |
| Baja | El modo «Integrar una imagen» pone una foto gris de fondo y no entra en el libro. | — | Usarlo solo para pruebas o marketing. |

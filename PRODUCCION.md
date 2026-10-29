# Proceso de producción de un libro para colorear

Guía práctica para pasar de la app a un interior aprobado en KDP sin
sorpresas. Cada paso dice qué hacer, qué hace la app sola y qué tienes que
mirar tú. Al final está la lista de control y los huecos que la app todavía
no cubre.

---

## El proceso en 7 pasos

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

### 4. Prepara y revisa página por página

1. Pulsa **📖 Preparar libro (revisar páginas)**.
2. Haz clic en cada miniatura para ampliarla. Pulsa **↻ Cambiar** en las que
   no te convenzan; el reemplazo es inmediato y reproducible.
3. Mira en especial:
   - zonas tan pequeñas que no cabe la punta de un rotulador (~1.2 mm);
   - líneas que se tocan formando manchas negras;
   - dos páginas seguidas que se parecen demasiado;
   - en dobles páginas, que nada importante caiga en el lomo.

> Las miniaturas no tienen resolución suficiente para ver astillas finas.
> La revisión definitiva se hace en el PDF (paso 6).

### 5. Guarda la receta y descarga

- **🧾 Receta del libro**: un JSON con el tamaño, el margen, el estilo, la
  semilla base y la semilla de cada página (incluidos los ↻). Guárdalo junto
  al PDF: es la única forma de saber después qué se imprimió.
- **⬇ Descargar PDF**: arma el interior con exactamente las páginas
  aprobadas.

### 6. Revisa el PDF a 200 %

Ábrelo en un visor de PDF y recórrelo entero:

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
- [ ] Todas las páginas revisadas; las dudosas cambiadas con ↻.
- [ ] Receta JSON guardada junto al PDF.
- [ ] PDF revisado a 200 %: sin guías, grises ni pies cortados.
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
| Regiones imposibles de colorear | Compuerta de colorabilidad en las pruebas (`npm test`) por relleno y celda. |
| Estilos repetidos | Secuencia sin vecinas repetidas; las figuras no se repiten hasta agotarlas. |
| Marcas registradas | Ficha y páginas con la marca solo como atribución. |
| Libro irreproducible | Semillas deterministas + receta JSON. |

---

## Huecos pendientes

Ordenados por el daño que pueden causar en un libro publicado.

| Prioridad | Hueco | Efecto | Qué hacer mientras tanto |
|---|---|---|---|
| Alta | No hay control de calidad automático por página dentro de la app. La colorabilidad solo se mide en los scripts de desarrollo (`npm run colorability`). | Una página con muchas astillas puede pasar la revisión visual. | Revisar el PDF a 200 %; usar estilos con compuerta («Más vendidos», figura). |
| Alta | Las miniaturas de la revisión rondan los 75 ppp. | No se ven defectos finos al aprobar páginas. | Revisión final en el PDF. |
| Media | La receta se exporta pero no se puede cargar. | Rehacer un libro exige poner la semilla y los ajustes a mano y repetir los ↻. Repetirlo idéntico exige además el mismo commit de la app. | Guardar la receta y anotar el commit usado. |
| Media | La app no genera portada ni página de créditos/copyright ni «Este libro pertenece a». | Hay que hacerlas fuera. | KDP Cover Creator y un editor de PDF. |
| Media | jsPDF (y la librería del estilo orgánico) se cargan desde internet. | Sin conexión no se puede armar el PDF. | Trabajar con conexión. |
| Baja | La dificultad progresiva, fuera de las figuras, solo abre o cierra el espaciado. | La progresión es suave en mandalas y mosaicos. | Usar «Figura zentangle» si la progresión es el argumento de venta. |
| Baja | El tiempo por página es una estimación por nivel, no una medición. | — | No prometer tiempos en la ficha. |
| Baja | El modo «Integrar una imagen» pone una foto gris de fondo y no entra en el libro. | — | Usarlo solo para pruebas o marketing. |

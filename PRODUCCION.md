# Cómo hacer un libro para colorear (de cero a KDP)

Guía de uso. Dos minutos para configurar, el resto es revisar y subir.

## En 4 pasos

### ① Elige qué libro quieres hacer

En **¿Qué libro quieres hacer?** hay tipos de libro listos. Un clic elige el
estilo, el nº de diseños y las opciones que mejor le van:

| Tipo de libro | Qué lleva | Diseños |
|---|---|---|
| 🪶 Zentangle para adultos | Koi, colibrí, nautilus, rosa, lobo, abstractas. Guía de tangles, dobles páginas y «Tu turno» | 40 |
| 💰 Mezcla más vendida | Figuras, mandalas, muestrarios y mosaicos repartidos. Lo más variado | 50 |
| 🪟 Vitral relajante | Piezas grandes y lisas: el más fácil y rápido de colorear | 30 |
| 🦖 Dinosaurios | Mitad origami (T. rex, raptor, triceratops…) y mitad con patrones (braquiosaurio, pterosaurio, plesiosaurio…), de fácil a difícil | 34 |
| 🦕 Solo origami | Todos los dinosaurios como papel doblado | 34 |
| 🧬 Biología | Neurona, ADN, células, virus, corazón… | 26 |
| 👣 Críptidos | Pie Grande, Nessie, Mothman, kraken, yeti, ovni; 1 de cada 4 páginas en origami | 28 |
| 🧸 Infantil | Animales tiernos con huecos amplios, de fácil a difícil | 28 |

¿Quieres otro estilo? **🎨 Ver todos los estilos** los muestra con miniatura.
Después puedes ajustar cualquier cosa a mano.

### ② Página y ③ Opciones (revisa el resumen)

- **Tamaño**: 8.5×11 in es el más habitual en KDP. **Margen**: 12.7 mm o más.
- **Reverso**: «Hoja en blanco» evita que el rotulador traspase. «Otro diseño»
  exige papel color prémium en KDP.
- El **resumen verde** dice cuántas páginas saldrán y avisa si algo no cumple
  KDP (menos de 24 páginas, margen interior corto, más de 828 páginas).
  Si aparece ⚠, corrígelo antes de seguir.
- Las guías de zona segura, la textura y el sombreado son solo de pantalla:
  la app los quita siempre del libro.

### ④ Prepara, revisa y descarga

1. **📖 Preparar libro**. Cada página pasa un control de calidad (zonas donde
   no cabe la punta de un rotulador, tinta). Con «🛠 Arreglar solas…»
   marcado (por defecto), las marcadas se rehacen solas.
2. **Revisa**: toca una página para verla a tamaño real, con las zonas
   difíciles en rojo (← → para pasar de página). **↻ Cambiar** la sustituye
   por otra al instante.
3. **📦 Descargar todo**: baja el PDF del interior, la ficha de KDP y la
   receta del libro. (Si prefieres, cada una tiene su botón en
   «Para terminar: Revisar → PDF → Ficha KDP → Receta», con ✓ al hacerla.)
4. **En KDP**: sube el PDF como interior **sin sangrado**, tinta **blanco y
   negro** (o **color prémium** si el reverso es «otro diseño»), pega título,
   descripción y palabras clave de la ficha, y haz la portada con las
   medidas que trae la ficha (comprueba el lomo en la calculadora de KDP).

## Antes de subir

- [ ] Resumen sin ⚠ y con «✓ Cumple los límites de KDP».
- [ ] Control de calidad sin páginas marcadas (o las que quedan, vistas en el
      visor y aceptadas).
- [ ] Receta guardada junto al PDF (es la única forma de saber después qué
      se imprimió).
- [ ] PDF hojeado: páginas en orden, sin líneas rojas, grises ni pies cortados.
- [ ] Ficha sin «Zentangle», «Zendala» ni «Zendoodle» en título, subtítulo,
      portada o palabras clave.
- [ ] Portada con las medidas de la ficha.
- [ ] Vista previa de KDP aprobada (y prueba impresa si es el primer libro de
      una serie).

## Qué hace la app sola

| Riesgo | Protección |
|---|---|
| Rotulador que traspasa | Reverso en blanco, diseños en página derecha |
| Margen insuficiente | Aviso según el nº de páginas |
| Guías, textura o sombreado impresos | Se quitan del libro |
| Zonas imposibles de colorear | Control por página, «Arreglar», visor con zonas en rojo, márgenes blancos junto a cuerdas y contornos |
| Huecos vacíos | Solo quedan lisas secciones pequeñas; una prueba exige que el mayor hueco mida < 15 mm de radio |
| Páginas casi negras | Se marcan las de más del 25 % de tinta |
| Estilos o figuras repetidas | Sin vecinas repetidas; cada figura sale una vez por vuelta (la repetida va en espejo y con otra paleta de tangles) |
| Marcas registradas | La ficha usa «Zentangle®» solo como atribución |
| Libro irreproducible | Semillas fijas y receta |

## Qué no cubre la app (hazlo fuera)

| Prioridad | Qué | Cómo |
|---|---|---|
| Media | Portada, página de créditos/copyright y «Este libro pertenece a» | KDP Cover Creator y un editor de PDF |
| Media | Cargar una receta para rehacer un libro | Hoy solo se guarda: anota la semilla, el estilo y el commit de la app |
| Media | Subir el PDF a KDP | A mano; la ficha trae el texto y las medidas |
| Baja | Palabras clave de la ficha | Son una propuesta; compruébalas en la búsqueda de Amazon |
| Baja | PDF sin conexión | jsPDF se carga de internet |
| Baja | Siluetas hechas a mano | Las figuras salen de código; con SVG de un ilustrador la calidad subiría (ver `MOTOR.md`) |

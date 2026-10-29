# Generador de libros de patrones para colorear

App web (sin servidor ni compilación) que genera diseños para colorear con
patrones de líneas —figuras grandes llenas de tangles, mandalas, estrellas,
muestrarios— y arma el libro completo en PDF listo para Amazon KDP.

## Cómo usarla

Los módulos ES no cargan desde `file://`: sirve la carpeta con cualquier
servidor estático y abre `index.html`.

```bash
python3 -m http.server 8000   # o: npx serve .
# http://localhost:8000
```

1. **Estilo**: «Más vendidos» (mezcla por defecto), «Figura zentangle» u otro.
2. **Página**: tamaño de papel, margen, semilla.
3. **Tu libro**: nº de diseños (50 por defecto, hasta 300), reverso en blanco
   o papel grueso sin hojas en blanco, y opciones: dificultad progresiva, guía
   de tangles y pasaporte, dobles páginas (con franja segura en el lomo) y
   páginas «Tu turno».
4. **Preparar libro** → revisa y cambia páginas con ↻ → **🧾 Receta del libro**
   (semillas de cada página) → **Descargar PDF**.
5. **📝 Texto para la ficha de KDP**: título, descripción, palabras clave sin
   marcas ajenas y medidas de la portada (lomo y tamaño total).

El proceso completo, con la lista de control antes de subir a KDP y los huecos
que la app aún no cubre, está en **[PRODUCCION.md](PRODUCCION.md)**.

El PDF se genera en el navegador (jsPDF desde CDN: hace falta conexión).

## Desarrollo

```bash
npm install
npm test             # pruebas de generadores, libro y propiedad intelectual (Node)
npm run e2e          # libro completo en Chromium: revisión, receta, PDF y ficha KDP
                     # (PW_EXEC=/ruta/a/chromium para usar un Chromium ya instalado)
npm run colorability # regiones no coloreables por estilo
npm run golden       # huellas de salida por (estilo, semilla); -- --update tras un cambio intencionado
```

`npm test` ejecuta las pruebas (incluida la compuerta de colorabilidad por relleno) y las
huellas golden. `npm run audit:patterns` muestra, por relleno y forma de celda, cuántas
regiones blancas no se pueden colorear.

`overrides.seedScheme: 1` conserva el reparto de semillas anterior a la semilla por celda
(un flujo por página). No deshace las correcciones de geometría posteriores (Cadent,
Scallops, rejillas a 0°/90°): para repetir un libro antiguo exacto hay que usar su commit.

## Estructura

| Carpeta / archivo | Qué hace |
|---|---|
| `index.html`, `js/app.js` | Interfaz, revisión del libro, descarga de PDF |
| `js/core/bookPlan.js` | Orden de páginas, dificultad, margen interior de KDP |
| `js/core/kdpListing.js` | Ficha de KDP y términos de marca bloqueados |
| `js/core/export.js` | PNG a 300 ppp y PDF por secuencia de páginas |
| `js/generators/zentangle.generator.js` | Punto de entrada: elige el estilo y lo dibuja |
| `js/generators/figure.js` | Figuras grandes subdivididas con strings y tangles |
| `js/generators/spread.js` | Dobles páginas |
| `js/generators/bookExtras.js` | Guía, pasaporte, pie de página |
| `js/generators/patterns/classicTangles.js` | Tangles clásicos densos |
| `js/generators/randomStyle.js` | Modo «Más vendidos» y aleatorio |
| `test_verify.mjs` | Pruebas automáticas |
| `_samples/` | Scripts de muestra, colorabilidad y prueba e2e |

`KDP_GUIDE.md` explica los ajustes para KDP y las reglas de propiedad
intelectual. `ARCHITECTURE.md`, `IMPLEMENTATION_GUIDE.md`, `QUICK_START.md`,
`README_PARA_DESARROLLO.md`, `INDICE.md`, `RESUMEN_EJECUTIVO.md` y
`PR_DETAILS.md` son planes antiguos (un editor Electron que no se construyó)
y no describen la app actual.

## Propiedad intelectual

Zentangle® es una marca registrada de Zentangle, Inc. Los libros solo la
mencionan como atribución («Inspirado en el método Zentangle®…»), nunca en el
título ni en las palabras clave. Todo el arte lo genera la app. Detalles en
`KDP_GUIDE.md`.

# Arquitectura - Zentangle Editor Electron

## Diagrama de Flujo Principal

```
┌─────────────────────────────────────────────────────────────────┐
│                    USUARIO / INTERFAZ (UI)                      │
│                     src/ui/App.js                                │
└────────────┬─────────────────────────────────────────────────────┘
             │
             ├─── TOOLBAR (Herramientas) ──────────┬──────────────┐
             │                                       │              │
             ▼                                       ▼              ▼
    ┌────────────────────┐          ┌────────────────────┐  ┌──────────┐
    │ CanvasManager      │          │ Properties Panel   │  │ Layers   │
    │ src/editor/        │          │ Color, Grosor     │  │ Panel    │
    │ canvasManager.js   │          └────────────────────┘  └──────────┘
    └─────────┬──────────┘
              │
         CONTROLA
              │
         ┌────┴────────┬────────────┬─────────┐
         │             │            │         │
         ▼             ▼            ▼         ▼
    ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐
    │  Tools  │  │ Layers  │  │ History  │  │ Rendering│
    │         │  │         │  │          │  │          │
    │ Pencil  │  │ Layer 1 │  │ Undo/Redo│  │ Canvas   │
    │ Brush   │  │ Layer 2 │  │ Cmd Stk  │  │ requestA-│
    │ Eraser  │  │ Layer N │  │          │  │ Frame    │
    │ Shapes  │  └─────────┘  └──────────┘  └──────────┘
    │ Bezier  │
    └─────────┘
         │
    EVENTO MOUSEDOWN/MOVE/UP
         │
         ▼
    ┌──────────────────────────────────────┐
    │ Tool.onMouseDown/Move/Up()           │
    │ → Devuelve DrawCommand               │
    │ → CommandStack.execute()             │
    │ → Layer.addStroke()                  │
    │ → canvas.isDirty = true              │
    └──────────────────────────────────────┘
         │
         ▼
    ┌──────────────────────────────────────┐
    │ requestAnimationFrame → render()     │
    │ • Limpia canvas                      │
    │ • Dibuja todas las capas             │
    │ • Dibuja preview de tool             │
    │ • Aplica zoom/pan                    │
    └──────────────────────────────────────┘
```

---

## Estructura de Datos - Proyecto

```javascript
Project {
  id: "uuid",
  name: "Mi Zentangle",
  createdAt: Date,
  paperSize: "A4",
  preset: "editorial_airy",
  seed: 12345,

  // Generado por generator
  partition: [
    Cell {
      id: 0,
      polygon: [{x, y}, ...],      // Vértices de celda
      centroid: {x, y},
      seed: 12346
    },
    Cell { ... },
    ...
  ],

  // Contenido del editor
  layers: [
    Layer {
      name: "Base",
      visible: true,
      opacity: 1.0,
      strokes: [
        {
          path: Path2D,
          style: {
            color: "#000000",
            strokeWidth: 2,
            type: "pencil"
          }
        },
        ...
      ]
    },
    Layer { ... }
  ],

  metadata: {
    lastEdited: Date,
    // ...
  }
}
```

---

## Flujo de Uso Típico

### Escenario 1: Crear Proyecto Nuevo

```
Usuario clickea "Nuevo Proyecto"
        ↓
ProjectCreationWizard.show()
        ↓
Usuario selecciona:
  • Tamaño papel (A4/Letter)
  • Preset (Editorial/Comercial/etc.)
  • Cantidad de celdas
        ↓
async generateZentangle(doc, opts) [EXISTENTE]
        ↓
Genera partition (array de celdas)
        ↓
GridRenderer renderiza celdas en canvas
        ↓
Project creado, listo para dibujar
```

### Escenario 2: Dibujar en Canvas

```
Usuario selecciona herramienta "Lápiz"
        ↓
currentTool = PencilTool
canvas.cursor = "crosshair"
        ↓
Usuario presiona MOUSE DOWN en celda
        ↓
PencilTool.onMouseDown({ x, y })
  • isDrawing = true
  • points = [{ x, y }]
        ↓
Usuario mueve mouse mientras presiona
        ↓
PencilTool.onMouseMove({ x, y })
  • points.push({ x, y })
  • canvas.isDirty = true
        ↓
requestAnimationFrame → render()
  • PencilTool.preview(ctx) dibuja línea suave
        ↓
Usuario suelta MOUSE UP
        ↓
PencilTool.onMouseUp()
  • smoothPath = suavizar(points)
  • DrawCommand = crear comando
  • return DrawCommand
        ↓
CanvasManager.executeCommand(DrawCommand)
  • DrawCommand.execute()
    → activeLayer.addStroke(path, style)
    → CommandStack.push(DrawCommand)
        ↓
render() dibuja stroke permanentemente
```

### Escenario 3: Copiar Patrón

```
Usuario abre "Panel de Patrones"
        ↓
PatternLibrary.loadPatterns()
  • Carga SVGs de src/patterns/patterns/
  • Organiza por categoría
        ↓
Usuario ve grid de patrones
        ↓
Usuario selecciona patrón "Mandala 01"
        ↓
Usuario clickea en celda destino
        ↓
PatternTool.onMouseUp()
  • SVG se escala a tamaño de celda
  • Se convierte a Path2D
  • DrawCommand con patrón
        ↓
Patrón copiado en canvas
```

### Escenario 4: Exportar para Amazon KDP

```
Usuario clickea "Exportar PDF"
        ↓
ProjectExporter.generateFullSVG()
  • Combina: grid de celdas + strokes + patrones
  • Genera SVG vectorial de alta calidad
        ↓
ProjectExporter.exportToPDF()
  • Usa Puppeteer para renderizar SVG
  • Aplica DPI 300
  • Agrega márgenes de sangre (3.175mm)
        ↓
AmazonKDPValidator.validateBook()
  • Verifica: resolución, márgenes, color space
  • Genera reporte de validación
        ↓
Guarda PDF en ~/Documents/
Usuario listo para subir a Amazon KDP
```

---

## Integración IPC (Electron/Renderer)

### Main Process (electron/main.js)
```
Responsabilidades:
- Crear ventanas
- Manejar filesystem
- Llamadas de sistema
- Exportar (PDF/PNG requiere node-canvas, sharp)
```

### Renderer Process (src/ui/App.js)
```
Responsabilidades:
- Dibujar en canvas
- Interacción del usuario
- Edición en tiempo real
- Llamadas a Main vía IPC
```

### Comunicación IPC

```javascript
// Desde Renderer (UI)
await window.api.exportPDF(projectData, 'libro.pdf');

// Va a Main (electron/main.js)
ipcMain.handle('export-pdf', async (event, projectData, filename) => {
  // Exportar PDF usando filesystem + PDFKit
  // Retorna resultado
});

// Vuelve a Renderer
const result = await window.api.exportPDF(...);
```

---

## Dependencias Externas

### Canvas Rendering
- **Canvas 2D nativo**: Brushstrokes, rendering en tiempo real
- **Fabric.js**: (Opcional futuro) Objetos complejos, transformaciones

### Exportación
- **Puppeteer**: Renderizar SVG → PDF a alta resolución
- **PDF-lib**: Manipulación de PDFs
- **PDFKit**: Generar PDFs desde cero
- **Sharp**: Redimensionar/optimizar imágenes PNG

### Almacenamiento
- **Electron filesystem**: Guardar/cargar proyectos locales
- **localStorage**: Datos temporales de sesión

### Utilidades
- **UUID**: Generar IDs únicos
- **Webpack**: Bundler para módulos

---

## Performance Considerations

### Rendering
```javascript
// ✅ BUENO: Dirty flag + requestAnimationFrame
if (canvas.isDirty) {
  render();
  canvas.isDirty = false;
}
requestAnimationFrame(animate);

// ❌ MALO: Redraw cada frame
ctx.clearRect(...);  // Cada frame = lento
ctx.stroke(...);
```

### Canvas Layers
```javascript
// ✅ BUENO: Cada capa en su propio canvas buffer
Layer {
  canvas: OffscreenCanvas
  render(ctx) {
    ctx.drawImage(this.canvas, 0, 0);
  }
}

// ❌ MALO: Redibujar todos los strokes cada frame
for (stroke of allStrokes) {
  ctx.stroke(stroke.path);
}
```

### History
```javascript
// ✅ BUENO: Limitar a últimos 100 comandos
if (commandStack.length > 100) {
  commandStack.shift();
}

// ❌ MALO: Guardar todo en memoria infinitamente
commandStack.push(command); // Sin límite
```

### Pattern Cache
```javascript
// ✅ BUENO: LRU cache de patrones SVG
const cache = new SVGPatternCache(maxSize: 50);
const pattern = cache.get(id, scale) || loadPattern(id);

// ❌ MALO: Cargar todos los patrones al inicio
patternLibrary.loadAllPatterns(); // Memory overhead
```

---

## Módulos Clave

### CanvasManager (Orquestador)
```
Responsabilidades:
- Controlar herramientas activas
- Manejar eventos mouse/keyboard
- Coordinar renderizado
- Zoom/pan
- Undo/redo

Usa:
- tools/ (herramientas)
- layers/ (capas)
- history/ (comandos)
- rendering/ (renderizadores)
```

### BaseTool (Clase base para herramientas)
```
Responsabilidades:
- Implementar interfaz de herramienta
- Manejar mouseDown/Move/Up
- Generar DrawCommand

Derivadas:
- PencilTool
- BrushTool
- EraserTool
- ShapesTool
- BezierTool
- SelectionTool
```

### Layer (Capa de dibujo)
```
Responsabilidades:
- Almacenar strokes
- Renderizar strokes
- Manejo de opacidad/blend mode

Datos:
- strokes: [] (path + style)
- visible: boolean
- opacity: 0-1
- blendMode: 'source-over', etc.
```

### DrawCommand (Comando)
```
Responsabilidades:
- Ejecutar (agregar stroke a capa)
- Deshacer (remover stroke)

Datos:
- layer reference
- pathData (Path2D)
- style (color, grosor, etc.)
```

### PatternLibrary (Librería de patrones)
```
Responsabilidades:
- Cargar SVG patterns
- Caché de patrones
- Conversión SVG → Path2D

Datos:
- patterns: Map<id, SVGPattern>
- cache: LRU cache
- categories: Map<category, id[]>
```

### ProjectExporter (Exportador)
```
Responsabilidades:
- Generar SVG desde proyecto
- Exportar PDF 300 DPI
- Exportar PNG
- Validar Amazon KDP
```

---

## Flujo de Desarrollo Recomendado

### Sprint 1: Core Canvas (Days 1-3)
```
1. Electron setup + webpack
2. CanvasManager + BaseTool
3. PencilTool + Layer
4. DrawCommand + History
```
✅ Resultado: Puedes dibujar y deshacer

### Sprint 2: Herramientas (Days 4-6)
```
1. BrushTool
2. EraserTool
3. ShapesTool
4. BezierTool
5. SelectionTool
```
✅ Resultado: Suite completa de herramientas

### Sprint 3: Integración (Days 7-9)
```
1. ProjectCreationWizard
2. GridRenderer
3. Integrar generador existente
4. Guardar/cargar proyectos
```
✅ Resultado: Proyecto completo desde generador

### Sprint 4: Patrones (Days 10-12)
```
1. SVG patterns (crear colección)
2. PatternLibrary
3. PatternTool
4. PatternsPanel UI
```
✅ Resultado: Copiar/pegar patrones reutilizables

### Sprint 5: Exportación (Days 13-15)
```
1. ProjectExporter
2. PDF generation (Puppeteer)
3. PNG generation
4. Amazon KDP validation
```
✅ Resultado: Exportar libros profesionales

### Sprint 6: Polish (Days 16-20)
```
1. Keyboard shortcuts
2. Performance optimization
3. Error handling
4. Testing + bugfixes
5. Packaging for Windows
```
✅ Resultado: App lista para producción

---

## Testing Checklist

```
Canvas Rendering:
[ ] Dibuja líneas suaves
[ ] Colores correctos
[ ] Zoom/pan funcionan
[ ] No hay lag visual

Undo/Redo:
[ ] Ctrl+Z deshace
[ ] Ctrl+Y rehace
[ ] Historial limitado a 100
[ ] No hay memory leaks

Exportación:
[ ] PDF generado (300 DPI)
[ ] PNG generado correctamente
[ ] Validación Amazon KDP pasa
[ ] Márgenes de sangre incluidos

Patrón s:
[ ] SVG patrones cargan
[ ] Se pueden copiar a canvas
[ ] Escalan correctamente
[ ] Cache funciona

Proyecto:
[ ] Guardar/cargar funciona
[ ] Se mantiene estado
[ ] No se pierden datos

Performance:
[ ] No hay freezes al dibujar
[ ] Canvas renderiza 60 FPS
[ ] Memoria estable
```

---

## Documentación de Referencia

**Archivos existentes (NO MODIFICAR):**
- `/js/core/` - Toda la lógica geométrica y SVG
- `/js/generators/` - Generación de particiones

**Archivos nuevos (CREAR según guía):**
- `electron/` - Proceso de Electron
- `src/editor/` - Editor canvas
- `src/ui/` - Interfaz
- `src/project/` - Gestión proyectos
- `src/patterns/` - Librería patrones

**Punto de entrada:**
- `public/index.html` - HTML principal
- `src/ui/App.js` - Lógica de aplicación
- `electron/main.js` - Proceso principal Electron

---

Este documento es tu "mapa" de cómo todo se conecta.
Refiere aquí cuando tengas dudas de arquitectura.

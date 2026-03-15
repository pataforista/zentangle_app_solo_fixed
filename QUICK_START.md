# Quick Start - Zentangle Editor Electron

## En 5 minutos: Configuración inicial

### Paso 1: Instalar dependencias (5 min)
```bash
cd /home/user/zentangle_app_solo_fixed

# Instalar Node y npm (si no los tienes)
npm --version

# Instalar todas las dependencias
npm install --save-dev electron electron-builder webpack webpack-cli webpack-dev-server babel-loader @babel/core @babel/preset-env css-loader style-loader concurrently wait-on

npm install --save fabric pdf-lib pdfkit canvas sharp uuid
```

### Paso 2: Copiar archivo package.json mejorado (2 min)

Reemplaza tu `package.json` actual con el de `IMPLEMENTATION_GUIDE.md` (sección 1.3).

Esto agrega los scripts necesarios:
```bash
npm start          # Desarrollo
npm run build:win  # Compilar para Windows
```

### Paso 3: Crear 5 archivos principales (10 min)

1. **electron/main.js** - Ver IMPLEMENTATION_GUIDE.md sección 2.1
2. **electron/preload.js** - Ver IMPLEMENTATION_GUIDE.md sección 2.2
3. **electron/ipc-handlers.js** - Ver IMPLEMENTATION_GUIDE.md sección 2.3
4. **public/index.html** - Ver IMPLEMENTATION_GUIDE.md sección 2.4
5. **webpack.config.js** - Ver IMPLEMENTATION_GUIDE.md sección 1.4

### Paso 4: Crear estructura de carpetas

```bash
mkdir -p electron
mkdir -p src/editor/tools
mkdir -p src/editor/history
mkdir -p src/editor/layers
mkdir -p src/editor/rendering
mkdir -p src/ui/components
mkdir -p src/ui/css
mkdir -p src/project
mkdir -p src/patterns/patterns/{geometric,organic,celtic}
mkdir -p public/assets
```

Luego copiar:
```bash
cp -r js/core src/
cp -r js/generators src/
```

### Paso 5: Crear archivos del editor (15 min)

Seguir este orden:

1. `src/editor/canvasManager.js` (IMPLEMENTATION_GUIDE.md 3.1)
2. `src/editor/tools/BaseTool.js` (IMPLEMENTATION_GUIDE.md 3.2)
3. `src/editor/tools/PencilTool.js` (IMPLEMENTATION_GUIDE.md 3.3)
4. `src/editor/layers/Layer.js` (IMPLEMENTATION_GUIDE.md 3.4)
5. `src/editor/history/DrawCommand.js` (IMPLEMENTATION_GUIDE.md 3.5)
6. `src/ui/App.js` (IMPLEMENTATION_GUIDE.md 3.6)

### Paso 6: Ejecutar en desarrollo (2 min)

```bash
npm start
```

**Esto hace:**
1. Webpack compila `src/ui/App.js` → `dist/bundle.js`
2. Electron carga `http://localhost:3000`
3. Ves la interfaz con toolbar y canvas

---

## Checklist Rápido

```
✅ npm install completado
✅ package.json actualizado
✅ electron/ carpeta con main.js, preload.js, ipc-handlers.js
✅ public/index.html creado
✅ webpack.config.js creado
✅ src/editor/ carpeta estructura creada
✅ src/editor/canvasManager.js ✅
✅ src/editor/tools/*.js (BaseTool, PencilTool)
✅ src/editor/layers/Layer.js
✅ src/editor/history/DrawCommand.js
✅ src/ui/App.js
✅ npm start funciona y abre Electron
```

---

## Primer Test

1. Abre app con `npm start`
2. Verás toolbar a la izquierda con "Lápiz" activo
3. Dibuja en el canvas
4. Presiona Ctrl+Z para deshacer
5. Cambia color con el color picker
6. Cambia grosor con el slider

**Si todo funciona, ¡la Fase 1 está completa! ✅**

---

## Próximos pasos después de Fase 1

### Fase 2: Agregar más herramientas (copy/paste template)
```javascript
// src/editor/tools/BrushTool.js - COPIAR estructura de PencilTool.js
import { BaseTool } from './BaseTool.js';
import { DrawCommand } from '../history/DrawCommand.js';

export class BrushTool extends BaseTool {
  constructor() {
    super({ id: 'brush', name: 'Pincel', cursor: 'crosshair' });
    this.points = [];
    this.strokeWidth = 5; // Más grueso que lápiz
    this.color = '#000000';
  }

  // Mismo código que PencilTool por ahora
  // Diferencia: strokeWidth mayor, podría tener presión variable
  // TODO: agregar pressure-sensitive support
}
```

Registrar en `src/ui/App.js`:
```javascript
const brushTool = new BrushTool();
this.canvasManager.registerTool(brushTool);
```

### Fase 3: Integrar generador existente

Crear archivo `src/editor/ProjectCreationWizard.js`:
```javascript
import { generateZentangle } from '../generators/zentangle.generator.js';
import { ZENTANGLE_PRESETS } from '../generators/zentangle.presets.js';

export async function createProjectFromPreset(presetKey, paperSize) {
  const doc = createSvgDoc({ /* ... */ });
  const partition = await generateZentangle(doc, {
    presetName: presetKey,
    // ...
  });
  return { partition, doc };
}
```

---

## Troubleshooting

### "Module not found"
→ Asegúrate que el `import` usa ruta correcta
→ Por ej: `import { Layer } from '../layers/Layer.js'` (con .js)

### "Canvas is undefined"
→ El HTML no está cargando correctamente
→ Verifica que webpack output es `dist/bundle.js` en index.html

### Electron no abre
→ Revisa console con F12
→ Verifica que `preload.js` path es correcto en `main.js`

### Hot reload no funciona
→ webpack-dev-server debe estar en puerto 3000
→ Electron debe cargar `http://localhost:3000`

---

## Archivos Clave para Referencia

**Código existente que NO toques (son bases sólidas):**
- `/js/core/` - Geometría, SVG, RNG
- `/js/generators/` - Particiones y patrones

**Nuevos archivos que sí creas:**
- `electron/` - Proceso principal y IPC
- `src/editor/` - Motor del editor
- `src/ui/` - Interfaz de usuario

---

## Para anti-gravity o tu equipo

**Paso a paso para implementar:**

1. Clonar repo
2. Leer IMPLEMENTATION_GUIDE.md sección por sección
3. Crear carpeta/archivo, copiar código
4. `npm install` después del primer cambio
5. `npm start` para probar
6. Avanzar al siguiente archivo

**Tiempo estimado por Fase:**
- Fase 1 (Setup + Canvas): 1-2 días
- Fase 2 (Herramientas): 2-3 días
- Fase 3 (Generador integrado): 2-3 días
- Fase 4 (Patrones): 2-3 días
- Fase 5 (Exportación): 2-3 días
- Fase 6 (Polish): 1-2 días

**Total: 2-3 semanas de desarrollo activo**

---

Usa `IMPLEMENTATION_GUIDE.md` como referencia completa.
Este archivo es solo para entender el flujo rápido.

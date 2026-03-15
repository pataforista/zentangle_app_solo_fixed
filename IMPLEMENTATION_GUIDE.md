# Guía de Implementación - Zentangle Editor Electron

## Resumen General

Migración de PWA a aplicación Electron de escritorio con editor vectorial profesional para crear libros para colorear vendibles en Amazon KDP.

**Tecnología Stack:**
- **Desktop**: Electron 27+
- **Editor Canvas**: Canvas 2D nativo + Fabric.js
- **Patrones**: SVG predibujados
- **Exportación**: PDF/PNG 300 DPI
- **Almacenamiento**: Electron filesystem + localStorage

**Duración estimada:** 6-8 semanas (40-60 horas de desarrollo)

---

## PARTE 1: PREPARACIÓN INICIAL (1-2 días)

### 1.1 Instalar Dependencias

```bash
# En la carpeta raíz del proyecto
npm init -y

npm install --save-dev electron electron-builder webpack webpack-cli webpack-dev-server
npm install --save-dev babel-loader @babel/core @babel/preset-env css-loader style-loader
npm install --save-dev electron-devtools-installer

npm install --save fabric pdf-lib pdfkit canvas sharp uuid
npm install --save pdfkit puppeteer

# Opcional pero recomendado para desarrollo
npm install --save-dev nodemon concurrently
```

### 1.2 Estructura de Carpetas

Crear esta estructura desde raíz:

```
zentangle-app-electron/
├── electron/
│   ├── main.js                    # CREAR: Proceso principal Electron
│   ├── preload.js                 # CREAR: Seguridad IPC
│   ├── ipc-handlers.js            # CREAR: Manejadores de IPC
│   └── menu.js                    # CREAR: Menú de aplicación
│
├── src/
│   ├── core/                      # COPIAR EXISTENTE (sin cambios)
│   │   ├── geometryCore.js
│   │   ├── pathBuilder.js
│   │   ├── prng.js
│   │   ├── svgDoc.js
│   │   ├── export.js
│   │   └── urlState.js
│   │
│   ├── generators/                # COPIAR EXISTENTE (sin cambios)
│   │   ├── partitionEngine.js
│   │   ├── zentangle.generator.js
│   │   ├── zentangleCells.js
│   │   ├── zentangle.presets.js
│   │   └── patterns/
│   │
│   ├── editor/                    # CREAR: Core del editor
│   │   ├── canvasManager.js       # Orquestador del canvas
│   │   ├── tools/
│   │   │   ├── BaseTool.js
│   │   │   ├── PencilTool.js
│   │   │   ├── BrushTool.js
│   │   │   ├── EraserTool.js
│   │   │   ├── ShapesTool.js
│   │   │   ├── BezierTool.js
│   │   │   ├── SelectionTool.js
│   │   │   └── PatternTool.js
│   │   ├── history/
│   │   │   ├── CommandStack.js
│   │   │   ├── DrawCommand.js
│   │   │   └── TransformCommand.js
│   │   ├── rendering/
│   │   │   ├── CanvasRenderer.js
│   │   │   ├── GridRenderer.js
│   │   │   └── PatternPreview.js
│   │   └── layers/
│   │       ├── LayerManager.js
│   │       └── Layer.js
│   │
│   ├── patterns/                  # CREAR: Librería de patrones
│   │   ├── patternLibrary.js
│   │   ├── svgPatternCache.js
│   │   └── patterns/              # SVG predibujados
│   │       ├── geometric/
│   │       ├── organic/
│   │       └── celtic/
│   │
│   ├── project/                   # CREAR: Gestión de proyectos
│   │   ├── Project.js
│   │   ├── ProjectManager.js
│   │   └── ProjectExporter.js
│   │
│   ├── ui/                        # CREAR: Interfaz de usuario
│   │   ├── components/
│   │   │   ├── ToolBar.js
│   │   │   ├── PropertiesPanel.js
│   │   │   ├── LayersPanel.js
│   │   │   ├── PatternsPanel.js
│   │   │   └── StatusBar.js
│   │   ├── css/
│   │   │   ├── main.css
│   │   │   ├── editor.css
│   │   │   └── panels.css
│   │   └── App.js
│   │
│   └── utils/
│       ├── validation.js
│       ├── constants.js
│       └── logger.js
│
├── public/
│   ├── index.html                 # CREAR: Punto de entrada
│   └── assets/
│
├── package.json                   # ACTUALIZAR
├── webpack.config.js              # CREAR: Configuración Webpack
├── electron-builder.json          # CREAR: Config de empaquetado
└── IMPLEMENTATION_GUIDE.md        # Este archivo
```

### 1.3 Actualizar package.json

```json
{
  "name": "zentangle-editor",
  "version": "0.1.0",
  "main": "electron/main.js",
  "homepage": "./",
  "scripts": {
    "start": "concurrently \"npm run webpack:dev\" \"wait-on http://localhost:3000 && electron .\"",
    "webpack:dev": "webpack serve --mode development --config webpack.config.js",
    "webpack:build": "webpack --mode production --config webpack.config.js",
    "build": "npm run webpack:build && electron-builder",
    "build:win": "npm run webpack:build && electron-builder --win --publish never",
    "build:mac": "npm run webpack:build && electron-builder --mac --publish never",
    "build:linux": "npm run webpack:build && electron-builder --linux --publish never"
  },
  "devDependencies": {
    "electron": "^27.0.0",
    "electron-builder": "^24.6.4",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "webpack-dev-server": "^4.15.1",
    "babel-loader": "^9.1.3",
    "@babel/core": "^7.23.0",
    "@babel/preset-env": "^7.23.0",
    "css-loader": "^6.8.1",
    "style-loader": "^3.3.3",
    "concurrently": "^8.2.1",
    "wait-on": "^7.0.1"
  },
  "dependencies": {
    "fabric": "^5.3.0",
    "pdf-lib": "^1.17.0",
    "pdfkit": "^0.13.0",
    "canvas": "^2.11.2",
    "sharp": "^0.32.6",
    "uuid": "^9.0.0"
  },
  "build": {
    "appId": "com.zentangle.editor",
    "productName": "Zentangle Editor",
    "win": {
      "target": ["nsis", "portable"]
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### 1.4 Crear webpack.config.js

```javascript
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/ui/App.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },
  devServer: {
    port: 3000,
    hot: true,
    historyApiFallback: true,
    static: {
      directory: path.join(__dirname, 'public'),
    },
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
          },
        },
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js'],
  },
};
```

---

## PARTE 2: FASE 1 - CONFIGURACIÓN ELECTRON (Días 1-3)

### 2.1 Crear electron/main.js

```javascript
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const isDev = require('electron-is-dev');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  const startUrl = isDev
    ? 'http://localhost:3000'
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Importar handlers IPC
require('./ipc-handlers');
```

### 2.2 Crear electron/preload.js

```javascript
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Generador
  generatePartition: (opts) => ipcRenderer.invoke('generate-partition', opts),

  // Proyecto
  createProject: (data) => ipcRenderer.invoke('create-project', data),
  saveProject: (data) => ipcRenderer.invoke('save-project', data),
  loadProject: (path) => ipcRenderer.invoke('load-project', path),

  // Exportación
  exportPDF: (projectData, filename) => ipcRenderer.invoke('export-pdf', projectData, filename),
  exportPNG: (projectData, filename) => ipcRenderer.invoke('export-png', projectData, filename),

  // Archivo
  selectFile: () => ipcRenderer.invoke('select-file'),
  saveFile: (data, filename) => ipcRenderer.invoke('save-file', data, filename),

  // Patrones
  loadPatterns: () => ipcRenderer.invoke('load-patterns'),

  // Listeners
  onStatusUpdate: (callback) => ipcRenderer.on('status-update', (event, data) => callback(data)),
});
```

### 2.3 Crear electron/ipc-handlers.js

```javascript
const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');

// Handlers básicos que serán expandidos en cada fase

ipcMain.handle('generate-partition', async (event, opts) => {
  try {
    // Será implementado en Fase 3 cuando integres el generador
    console.log('Generating partition with opts:', opts);
    // const partition = await generateZentangle(opts);
    // return partition;
    return { status: 'pending' };
  } catch (error) {
    console.error('Error generating partition:', error);
    throw error;
  }
});

ipcMain.handle('create-project', async (event, data) => {
  try {
    // Será implementado en Fase 5
    const project = {
      id: require('uuid').v4(),
      name: data.name,
      createdAt: new Date(),
      partition: data.partition || [],
      layers: [],
    };
    return project;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
});

ipcMain.handle('save-project', async (event, projectData) => {
  try {
    const projectsDir = path.join(process.env.HOME || process.env.USERPROFILE, 'ZentangleProjects');
    await fs.mkdir(projectsDir, { recursive: true });

    const filename = path.join(projectsDir, `${projectData.name}_${Date.now()}.json`);
    await fs.writeFile(filename, JSON.stringify(projectData, null, 2));

    return { success: true, filename };
  } catch (error) {
    console.error('Error saving project:', error);
    throw error;
  }
});

ipcMain.handle('load-project', async (event, filename) => {
  try {
    const data = await fs.readFile(filename, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading project:', error);
    throw error;
  }
});

ipcMain.handle('select-file', async () => {
  try {
    const result = await dialog.showOpenDialog({
      filters: [
        { name: 'Zentangle Projects', extensions: ['zproj'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    return result.filePaths[0] || null;
  } catch (error) {
    console.error('Error selecting file:', error);
    throw error;
  }
});

ipcMain.handle('save-file', async (event, data, filename) => {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath: filename,
      filters: [
        { name: 'JSON', extensions: ['json'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (!result.canceled) {
      await fs.writeFile(result.filePath, data);
      return { success: true, path: result.filePath };
    }
    return { success: false };
  } catch (error) {
    console.error('Error saving file:', error);
    throw error;
  }
});

ipcMain.handle('export-pdf', async (event, projectData, filename) => {
  try {
    // Será implementado en Fase 6
    console.log('Exporting PDF:', filename);
    return { success: true, message: 'PDF export pending implementation' };
  } catch (error) {
    console.error('Error exporting PDF:', error);
    throw error;
  }
});

ipcMain.handle('export-png', async (event, projectData, filename) => {
  try {
    // Será implementado en Fase 6
    console.log('Exporting PNG:', filename);
    return { success: true, message: 'PNG export pending implementation' };
  } catch (error) {
    console.error('Error exporting PNG:', error);
    throw error;
  }
});

ipcMain.handle('load-patterns', async (event) => {
  try {
    // Será implementado en Fase 5
    return { patterns: [] };
  } catch (error) {
    console.error('Error loading patterns:', error);
    throw error;
  }
});
```

### 2.4 Crear public/index.html

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zentangle Editor</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
    }

    #root {
      width: 100vw;
      height: 100vh;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <script src="/bundle.js"></script>
</body>
</html>
```

---

## PARTE 3: FASE 2 - EDITOR CANVAS BÁSICO (Días 4-8)

### 3.1 Crear src/editor/canvasManager.js

```javascript
export class CanvasManager {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    this.tools = new Map();
    this.currentTool = null;
    this.layers = [];
    this.history = [];
    this.historyIndex = -1;

    // Estado del canvas
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.isDirty = true;

    this.setupEventListeners();
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

    window.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  registerTool(tool) {
    this.tools.set(tool.id, tool);
    tool.setCanvas(this);
  }

  selectTool(toolId) {
    if (this.currentTool) {
      this.currentTool.deactivate();
    }
    this.currentTool = this.tools.get(toolId);
    if (this.currentTool) {
      this.currentTool.activate();
      this.canvas.style.cursor = this.currentTool.cursor;
    }
  }

  getCanvasCoordinates(event) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - this.pan.x) / this.zoom;
    const y = (event.clientY - rect.top - this.pan.y) / this.zoom;
    return { x, y };
  }

  onMouseDown(event) {
    if (!this.currentTool) return;
    const point = this.getCanvasCoordinates(event);
    this.currentTool.onMouseDown(point, event);
    this.isDirty = true;
  }

  onMouseMove(event) {
    if (!this.currentTool) return;
    const point = this.getCanvasCoordinates(event);
    this.currentTool.onMouseMove(point, event);
    this.isDirty = true;
  }

  onMouseUp(event) {
    if (!this.currentTool) return;
    const point = this.getCanvasCoordinates(event);
    const command = this.currentTool.onMouseUp(point, event);

    if (command) {
      this.executeCommand(command);
    }
    this.isDirty = true;
  }

  onWheel(event) {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    this.zoom *= factor;
    this.zoom = Math.max(0.1, Math.min(5, this.zoom)); // Limitar zoom
    this.isDirty = true;
  }

  onKeyDown(event) {
    if (event.ctrlKey || event.metaKey) {
      if (event.key === 'z') {
        this.undo();
      } else if (event.key === 'y' || (event.shiftKey && event.key === 'z')) {
        this.redo();
      }
    }
  }

  executeCommand(command) {
    // Ejecutar comando
    command.execute();

    // Agregar al historial
    this.historyIndex++;
    this.history = this.history.slice(0, this.historyIndex);
    this.history.push(command);

    // Limitar historial a 100 comandos
    if (this.history.length > 100) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  undo() {
    if (this.historyIndex >= 0) {
      this.history[this.historyIndex].undo();
      this.historyIndex--;
      this.isDirty = true;
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.history[this.historyIndex].execute();
      this.isDirty = true;
    }
  }

  render() {
    if (!this.isDirty) return;

    // Limpiar canvas
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Aplicar transformaciones
    this.ctx.save();
    this.ctx.translate(this.pan.x, this.pan.y);
    this.ctx.scale(this.zoom, this.zoom);

    // Renderizar capas
    for (const layer of this.layers) {
      if (layer.visible) {
        layer.render(this.ctx);
      }
    }

    // Renderizar preview de herramienta
    if (this.currentTool?.preview) {
      this.currentTool.preview(this.ctx);
    }

    this.ctx.restore();

    this.isDirty = false;
  }

  animate() {
    this.render();
    requestAnimationFrame(() => this.animate());
  }

  start() {
    this.animate();
  }
}
```

### 3.2 Crear src/editor/tools/BaseTool.js

```javascript
export class BaseTool {
  constructor(options = {}) {
    this.id = options.id || 'base';
    this.name = options.name || 'Base Tool';
    this.cursor = options.cursor || 'default';
    this.canvas = null;
    this.isDrawing = false;
  }

  setCanvas(canvasManager) {
    this.canvas = canvasManager;
  }

  activate() {
    console.log(`Tool activated: ${this.name}`);
  }

  deactivate() {
    console.log(`Tool deactivated: ${this.name}`);
  }

  onMouseDown(point, event) {}
  onMouseMove(point, event) {}
  onMouseUp(point, event) {
    return null; // Retorna Command o null
  }

  preview(ctx) {}

  getActiveLayer() {
    return this.canvas.layers[this.canvas.layers.length - 1];
  }
}
```

### 3.3 Crear src/editor/tools/PencilTool.js

```javascript
import { BaseTool } from './BaseTool.js';
import { DrawCommand } from '../history/DrawCommand.js';

export class PencilTool extends BaseTool {
  constructor() {
    super({
      id: 'pencil',
      name: 'Lápiz',
      cursor: 'crosshair'
    });
    this.points = [];
    this.strokeWidth = 2;
    this.color = '#000000';
  }

  onMouseDown(point) {
    this.isDrawing = true;
    this.points = [point];
  }

  onMouseMove(point) {
    if (!this.isDrawing) return;
    this.points.push(point);
    this.canvas.isDirty = true;
  }

  onMouseUp(point) {
    this.isDrawing = false;

    if (this.points.length < 2) {
      this.points = [];
      return null;
    }

    const smoothPath = this.smoothPath(this.points);
    const command = new DrawCommand(
      this.getActiveLayer(),
      smoothPath,
      {
        strokeWidth: this.strokeWidth,
        color: this.color,
        type: 'pencil'
      }
    );

    this.points = [];
    return command;
  }

  smoothPath(points) {
    // Simplificado: retornar Path2D
    const path = new Path2D();
    if (points.length === 0) return path;

    path.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      path.lineTo(points[i].x, points[i].y);
    }
    return path;
  }

  preview(ctx) {
    if (!this.isDrawing || this.points.length === 0) return;

    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const path = this.smoothPath(this.points);
    ctx.stroke(path);
  }
}
```

### 3.4 Crear src/editor/layers/Layer.js

```javascript
export class Layer {
  constructor(name, index) {
    this.name = name;
    this.index = index;
    this.visible = true;
    this.opacity = 1.0;
    this.blendMode = 'source-over';
    this.strokes = [];
  }

  addStroke(pathData, style) {
    this.strokes.push({
      path: pathData,
      style: style,
      id: Date.now()
    });
  }

  removeStroke(id) {
    this.strokes = this.strokes.filter(s => s.id !== id);
  }

  render(ctx) {
    ctx.globalAlpha = this.opacity;
    ctx.globalCompositeOperation = this.blendMode;

    for (const stroke of this.strokes) {
      ctx.strokeStyle = stroke.style.color;
      ctx.lineWidth = stroke.style.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.stroke(stroke.path);
    }

    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';
  }

  clear() {
    this.strokes = [];
  }
}
```

### 3.5 Crear src/editor/history/DrawCommand.js

```javascript
export class DrawCommand {
  constructor(layer, pathData, style) {
    this.layer = layer;
    this.pathData = pathData;
    this.style = style;
    this.strokeId = null;
  }

  execute() {
    this.layer.addStroke(this.pathData, this.style);
    // Guardar el ID para poder hacer undo
    this.strokeId = this.layer.strokes[this.layer.strokes.length - 1].id;
  }

  undo() {
    if (this.strokeId) {
      this.layer.removeStroke(this.strokeId);
    }
  }
}
```

### 3.6 Crear src/ui/App.js

```javascript
import { CanvasManager } from '../editor/canvasManager.js';
import { PencilTool } from '../editor/tools/PencilTool.js';
import { Layer } from '../editor/layers/Layer.js';

export class App {
  constructor() {
    this.canvasManager = null;
    this.init();
  }

  init() {
    this.render();
    this.setupCanvas();
  }

  render() {
    const root = document.getElementById('root');
    root.innerHTML = `
      <div class="app-container">
        <aside class="toolbar">
          <div class="toolbar-header">Herramientas</div>
          <button class="tool-btn active" data-tool="pencil">🖉 Lápiz</button>
          <button class="tool-btn" data-tool="brush">🖌 Pincel</button>
          <button class="tool-btn" data-tool="eraser">🗑 Borrador</button>
          <button class="tool-btn" data-tool="shapes">🔷 Formas</button>
          <button class="tool-btn" data-tool="bezier">✒ Pluma</button>

          <div class="toolbar-separator"></div>

          <div class="color-picker">
            <label>Color</label>
            <input type="color" id="colorInput" value="#000000">
          </div>

          <div class="stroke-size">
            <label>Grosor</label>
            <input type="range" id="strokeSize" min="1" max="20" value="2">
          </div>

          <div class="toolbar-separator"></div>

          <button id="undoBtn">↶ Deshacer</button>
          <button id="redoBtn">↷ Rehacer</button>

          <div class="toolbar-separator"></div>

          <button id="newProjectBtn">+ Nuevo</button>
          <button id="saveProjectBtn">💾 Guardar</button>
          <button id="exportPdfBtn">📄 Exportar PDF</button>
        </aside>

        <main class="editor-container">
          <canvas id="editorCanvas"></canvas>
          <div class="status-bar" id="statusBar">Listo</div>
        </main>
      </div>
    `;

    this.addStyles();
    this.setupEventListeners();
  }

  addStyles() {
    const style = document.createElement('style');
    style.innerHTML = `
      .app-container {
        display: flex;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
      }

      .toolbar {
        width: 120px;
        background: #f8f8f8;
        border-right: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        padding: 10px;
        gap: 10px;
        overflow-y: auto;
      }

      .toolbar-header {
        font-weight: bold;
        font-size: 12px;
        text-transform: uppercase;
        color: #666;
        margin-bottom: 10px;
      }

      .tool-btn {
        padding: 8px;
        border: 1px solid #ddd;
        background: white;
        cursor: pointer;
        border-radius: 4px;
        font-size: 12px;
        transition: all 0.2s;
      }

      .tool-btn:hover {
        background: #f0f0f0;
      }

      .tool-btn.active {
        background: #6366f1;
        color: white;
        border-color: #6366f1;
      }

      .toolbar-separator {
        height: 1px;
        background: #ddd;
        margin: 5px 0;
      }

      .color-picker, .stroke-size {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      .color-picker label, .stroke-size label {
        font-size: 11px;
        font-weight: 600;
        color: #666;
      }

      .color-picker input[type="color"],
      .stroke-size input[type="range"] {
        width: 100%;
      }

      .editor-container {
        flex: 1;
        position: relative;
        background: #fff;
        overflow: hidden;
      }

      #editorCanvas {
        display: block;
        width: 100%;
        height: 100%;
        cursor: crosshair;
      }

      .status-bar {
        position: absolute;
        bottom: 10px;
        right: 10px;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
  }

  setupCanvas() {
    const canvas = document.getElementById('editorCanvas');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    this.canvasManager = new CanvasManager(canvas);

    // Crear capa base
    const baseLayer = new Layer('Base', 0);
    this.canvasManager.layers.push(baseLayer);

    // Registrar herramientas
    const pencilTool = new PencilTool();
    this.canvasManager.registerTool(pencilTool);
    this.canvasManager.selectTool('pencil');

    // Iniciar animación
    this.canvasManager.start();
  }

  setupEventListeners() {
    // Cambio de herramientas
    document.querySelectorAll('.tool-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const toolId = btn.dataset.tool;
        this.canvasManager.selectTool(toolId);
      });
    });

    // Color y grosor
    document.getElementById('colorInput').addEventListener('change', (e) => {
      if (this.canvasManager.currentTool) {
        this.canvasManager.currentTool.color = e.target.value;
      }
    });

    document.getElementById('strokeSize').addEventListener('change', (e) => {
      if (this.canvasManager.currentTool) {
        this.canvasManager.currentTool.strokeWidth = parseInt(e.target.value);
      }
    });

    // Undo/Redo
    document.getElementById('undoBtn').addEventListener('click', () => {
      this.canvasManager.undo();
    });

    document.getElementById('redoBtn').addEventListener('click', () => {
      this.canvasManager.redo();
    });

    // Proyectos
    document.getElementById('newProjectBtn').addEventListener('click', () => {
      this.newProject();
    });

    document.getElementById('saveProjectBtn').addEventListener('click', () => {
      this.saveProject();
    });

    document.getElementById('exportPdfBtn').addEventListener('click', () => {
      this.exportPDF();
    });
  }

  async newProject() {
    const name = prompt('Nombre del proyecto:', 'Mi Zentangle');
    if (!name) return;

    this.canvasManager.layers.forEach(l => l.clear());
    this.canvasManager.history = [];
    this.canvasManager.historyIndex = -1;
    this.canvasManager.isDirty = true;

    this.updateStatus(`Nuevo proyecto: ${name}`);
  }

  async saveProject() {
    // Será implementado cuando tengamos IPC funcionando
    this.updateStatus('Guardando proyecto...');
    alert('Guardar proyecto - próximamente');
  }

  async exportPDF() {
    // Será implementado en Fase 6
    alert('Exportar PDF - próximamente');
  }

  updateStatus(message) {
    document.getElementById('statusBar').textContent = message;
  }
}

// Iniciar app cuando DOM está listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new App();
  });
} else {
  new App();
}
```

---

## PARTE 4: FASES 3-6 (Estructura)

### 4.1 Fase 3 - Integración del Generador

Crear archivo `src/editor/ProjectCreationWizard.js` que use:
- El generador existente de `generators/zentangle.generator.js`
- Mostrar UI wizard para seleccionar preset
- Cargar particiones en el canvas

**Archivos a crear:**
- `src/editor/ProjectCreationWizard.js`
- `src/ui/components/NewProjectDialog.js`

### 4.2 Fase 4 - Herramientas Avanzadas

Seguir mismo patrón que `PencilTool.js`:
- `src/editor/tools/BrushTool.js`
- `src/editor/tools/EraserTool.js`
- `src/editor/tools/ShapesTool.js`
- `src/editor/tools/BezierTool.js`

Cada una extiende `BaseTool` e implementa `onMouseDown`, `onMouseMove`, `onMouseUp`.

### 4.3 Fase 5 - Librería de Patrones

**Estructura:**
- Crear carpeta `src/patterns/patterns/` con SVGs predibujados
- Implementar `src/patterns/patternLibrary.js`
- Crear `src/ui/components/PatternsPanel.js` para UI

**Flujo:**
1. Usuario selecciona patrón del panel
2. Click en celda para colocar patrón
3. Patrón se convierte a strokes en la capa

### 4.4 Fase 6 - Exportación

Implementar en `src/project/ProjectExporter.js`:
- `exportToPDF()` - Usar Puppeteer + PDF-lib
- `exportToPNG()` - Usar canvas → sharp
- Validación Amazon KDP

---

## PARTE 5: COMANDOS DE EJECUCIÓN

### Desarrollo
```bash
npm start
# Abre Electron con hot-reload de webpack
```

### Build para Windows
```bash
npm run build:win
# Crea instalador en /dist/
```

### Build producción
```bash
npm run webpack:build
# Bundlea código a /dist/
```

---

## PARTE 6: CHECKLIST DE DESARROLLO

### Semana 1: Setup + Canvas Básico
- [ ] npm install todas las dependencias
- [ ] Electron main.js + preload.js funcionando
- [ ] Canvas renderiza sin errores
- [ ] PencilTool dibuja y renderiza
- [ ] Undo/Redo funciona

### Semana 2: Más herramientas
- [ ] BrushTool implementada
- [ ] EraserTool implementada
- [ ] ShapesTool (círculo, rectángulo, línea)
- [ ] SelectionTool
- [ ] Cambio de color y grosor

### Semana 3: Integración Generador
- [ ] Generador de particiones integrado
- [ ] GridRenderer muestra celdas
- [ ] Wizard de nuevo proyecto
- [ ] Guardar/cargar proyectos locales

### Semana 4: Librería de Patrones
- [ ] SVG patterns cargados
- [ ] Panel de patrones en UI
- [ ] Colocar patrones en celdas
- [ ] Editar patrones copiados

### Semana 5: Exportación
- [ ] Exportar a PDF 300 DPI
- [ ] Exportar a PNG
- [ ] Validador Amazon KDP
- [ ] Testing con archivos reales

### Semana 6: Polish
- [ ] Keyboard shortcuts completos
- [ ] Performance optimization
- [ ] Manejo de errores robusto
- [ ] Testing y bugfixes

---

## PARTE 7: RECURSOS Y REFERENCIAS

- **Fabric.js Docs**: http://fabricjs.com/docs/
- **PDF-lib**: https://pdfjs.express/api/pdf-lib/
- **Electron Best Practices**: https://www.electronjs.org/docs
- **Canvas 2D API**: https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D

---

## NOTAS IMPORTANTES

1. **Separación Electron/Renderer**: Todo código que use `fs`, `path`, etc. debe ser en IPC handlers, no en el renderer.

2. **Performance**: Canvas 2D nativo es mucho más rápido que Fabric.js para brushstrokes. Usa Fabric solo para objetos complejos.

3. **SVG a Canvas**: Cuando importes patrones SVG, convierte a Path2D para mejor performance.

4. **Historial**: Limita a 100 comandos para no saturar memoria.

5. **Testing**: Prueba exportar PDFs reales y validar con Amazon KDP antes de vender.

---

**¿Necesitas aclaraciones o quieres que expanda alguna sección?**

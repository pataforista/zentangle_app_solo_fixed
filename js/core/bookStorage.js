// bookStorage.js
// Persistencia en IndexedDB para la revisión del libro en curso (autoguardado)
// y biblioteca de libros terminados. Dos object stores:
//   - "current": un único libro en revisión (se sobrescribe en cada ↻).
//   - "library": libros guardados por el usuario (con nombre, estado, ASIN).
//
// El libro actual guarda sus páginas con seed, tries, presetName, figure,
// tangles y quality, de modo que al recargar la página se puede restaurar
// exactamente donde se dejó la revisión.

const DB_NAME = "zentangle-books";
const DB_VERSION = 1;
const STORE_CURRENT = "current";
const STORE_LIBRARY = "library";

// Abre la BD y crea los stores si no existen. Resuelve con la instancia.
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CURRENT)) {
        db.createObjectStore(STORE_CURRENT, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_LIBRARY)) {
        const lib = db.createObjectStore(STORE_LIBRARY, { keyPath: "id" });
        lib.createIndex("date", "date");
        lib.createIndex("state", "state");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- Autoguardado del libro en curso ----------

// Clave fija del libro actual en el store "current". Solo hay uno a la vez.
const CURRENT_ID = "current-book";

// Guarda el libro en curso tras cada cambio de página (↻).
// Serializa solo lo necesario para restaurar: semillas, tries, calidad, etc.
// No guarda los SVG completos (se regeneran con su semilla al restaurar).
export async function saveCurrentBook(review) {
  if (!review) return;
  try {
    const db = await openDB();
    const data = {
      id: CURRENT_ID,
      savedAt: new Date().toISOString(),
      key: review.key,
      g: {
        paperKey: review.g.paperKey,
        paper: review.g.paper,
        marginMm: review.g.marginMm,
        inner: review.g.inner,
        zPresetKey: review.g.zPresetKey,
        opts: review.g.opts,
      },
      n: review.n,
      blank: review.blank,
      flags: review.flags,
      units: review.units,
      turnPages: review.turnPages,
      baseSeed: review.baseSeed,
      total: review.total,
      pages: review.pages.map((p) => ({
        kind: p.kind,
        seed: p.seed,
        tries: p.tries || 0,
        presetName: p.presetName,
        figure: p.figure || null,
        tangles: p.tangles || [],
        quality: p.quality ? {
          bad: p.quality.bad,
          ink: p.quality.ink,
          ok: p.quality.ok,
          reasons: p.quality.reasons,
          maxBad: p.quality.maxBad,
          ...(p.quality.coverage != null ? { coverage: p.quality.coverage, layout: p.quality.layout } : {}),
          ...(p.quality.contrast != null ? { contrast: p.quality.contrast, densityInside: p.quality.densityInside, densityOutside: p.quality.densityOutside } : {}),
        } : null,
        // Historial de undo: las últimas semillas antes del ↻ actual.
        history: p.history || [],
        // Página fijada: sobrevive a «Preparar libro».
        pinned: !!p.pinned,
      })),
    };
    const tx = db.transaction(STORE_CURRENT, "readwrite");
    tx.objectStore(STORE_CURRENT).put(data);
    await txDone(tx);
    db.close();
  } catch (err) {
    console.warn("No se pudo autoguardar el libro:", err);
  }
}

// Carga el libro guardado en curso, o null si no hay ninguno.
export async function loadCurrentBook() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CURRENT, "readonly");
    const req = tx.objectStore(STORE_CURRENT).get(CURRENT_ID);
    const result = await reqPromise(req);
    db.close();
    return result || null;
  } catch {
    return null;
  }
}

// Borra el libro en curso (cuando se empieza uno nuevo con «Preparar libro»).
export async function clearCurrentBook() {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_CURRENT, "readwrite");
    tx.objectStore(STORE_CURRENT).delete(CURRENT_ID);
    await txDone(tx);
    db.close();
  } catch { /* no pasa nada */ }
}

// ---------- Biblioteca «Mis libros» ----------

// Guarda un libro terminado (o en revisión) en la biblioteca.
// Devuelve el id asignado para poder referenciarlo después.
export async function saveBookToLibrary({ name, state = "draft", asin = "", recipe }) {
  const db = await openDB();
  const id = `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry = {
    id,
    name: name || `Libro ${new Date().toLocaleDateString("es")}`,
    type: recipe?.style || "unknown",
    date: new Date().toISOString(),
    state, // draft | reviewed | published
    asin,
    recipe, // receta completa (bookRecipe) con las páginas
  };
  const tx = db.transaction(STORE_LIBRARY, "readwrite");
  tx.objectStore(STORE_LIBRARY).put(entry);
  await txDone(tx);
  db.close();
  return id;
}

// Lista todos los libros de la biblioteca, ordenados por fecha (más reciente primero).
export async function listLibraryBooks() {
  const db = await openDB();
  const tx = db.transaction(STORE_LIBRARY, "readonly");
  const req = tx.objectStore(STORE_LIBRARY).getAll();
  const all = await reqPromise(req);
  db.close();
  return (all || []).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// Obtiene un libro concreto de la biblioteca por su id.
export async function getLibraryBook(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_LIBRARY, "readonly");
  const req = tx.objectStore(STORE_LIBRARY).get(id);
  const result = await reqPromise(req);
  db.close();
  return result || null;
}

// Renombra un libro de la biblioteca.
export async function renameLibraryBook(id, newName) {
  const db = await openDB();
  const tx = db.transaction(STORE_LIBRARY, "readwrite");
  const store = tx.objectStore(STORE_LIBRARY);
  const req = store.get(id);
  const entry = await reqPromise(req);
  if (entry) {
    entry.name = newName;
    store.put(entry);
  }
  await txDone(tx);
  db.close();
}

// Actualiza el estado y/o ASIN de un libro de la biblioteca.
export async function updateLibraryBookState(id, { state, asin }) {
  const db = await openDB();
  const tx = db.transaction(STORE_LIBRARY, "readwrite");
  const store = tx.objectStore(STORE_LIBRARY);
  const req = store.get(id);
  const entry = await reqPromise(req);
  if (entry) {
    if (state !== undefined) entry.state = state;
    if (asin !== undefined) entry.asin = asin;
    store.put(entry);
  }
  await txDone(tx);
  db.close();
}

// Duplica un libro de la biblioteca con una semilla nueva (para «Volumen 2»).
// Devuelve el id del nuevo libro.
export async function duplicateLibraryBook(id) {
  const original = await getLibraryBook(id);
  if (!original) throw new Error("Libro no encontrado");
  const newRecipe = { ...original.recipe };
  // Semilla nueva: el volumen 2 tiene diseños distintos.
  newRecipe.baseSeed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  newRecipe.createdAt = new Date().toISOString();
  return saveBookToLibrary({
    name: `${original.name} (copia)`,
    state: "draft",
    recipe: newRecipe,
  });
}

// Borra un libro de la biblioteca.
export async function deleteLibraryBook(id) {
  const db = await openDB();
  const tx = db.transaction(STORE_LIBRARY, "readwrite");
  tx.objectStore(STORE_LIBRARY).delete(id);
  await txDone(tx);
  db.close();
}

// ---------- Utilidades ----------

function reqPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error("Transacción abortada"));
  });
}

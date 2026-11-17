// collector.js
// Mientras «Descargar todo» corre, los archivos (PDF, textos) no se bajan sueltos:
// se guardan aquí y al final salen en un solo ZIP (R21). Fuera de ese flujo, todo
// se descarga como siempre.
let files = null;

export const beginCollect = () => { files = []; };
export const collecting = () => files !== null;
export function collect(name, data) { if (files) files.push({ name, data }); }
// Devuelve lo recogido y deja de recoger (también si hubo un error: usar en finally).
export function endCollect() { const out = files || []; files = null; return out; }

// Guarda un PDF de jsPDF: al colector si está activo; si no, descarga directa.
export function savePdf(doc, name) {
  if (files) collect(name, new Uint8Array(doc.output("arraybuffer")));
  else doc.save(name);
}

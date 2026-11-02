// zip.js
// Generador de archivos ZIP estándar (PKZIP 2.0 / Store) sin dependencias externas.
// Compatible con navegador (Blob y descarga directa) y Node.js (Uint8Array).

/**
 * Cálculo rápido de CRC32 según IEEE 802.3.
 */
export function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[i] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Empaquetador ZIP en memoria.
 */
export class SimpleZip {
  constructor() {
    this.entries = [];
    this._dirs = new Set();
  }

  /**
   * Añade un archivo al archivo ZIP.
   * @param {string} name Ruta relativa dentro del ZIP (usa barras /).
   * @param {string|Uint8Array|ArrayBuffer|Object} content Contenido (texto, binario o JSON).
   */
  addFile(name, content) {
    let data;
    if (typeof content === "string") {
      data = new TextEncoder().encode(content);
    } else if (content instanceof Uint8Array) {
      data = content;
    } else if (content instanceof ArrayBuffer) {
      data = new Uint8Array(content);
    } else {
      data = new TextEncoder().encode(JSON.stringify(content, null, 2));
    }

    const cleanName = name.replace(/\\/g, "/").replace(/^\/+/, "");
    // Asegurar que las carpetas intermedias existan
    const parts = cleanName.split("/");
    if (parts.length > 1) {
      let dirPath = "";
      for (let i = 0; i < parts.length - 1; i++) {
        dirPath += parts[i] + "/";
        if (!this._dirs.has(dirPath)) {
          this._dirs.add(dirPath);
          const dirBytes = new TextEncoder().encode(dirPath);
          this.entries.push({
            name: dirPath,
            nameBytes: dirBytes,
            data: new Uint8Array(0),
            crc: 0,
            size: 0,
            isDir: true,
          });
        }
      }
    }

    const nameBytes = new TextEncoder().encode(cleanName);
    this.entries.push({
      name: cleanName,
      nameBytes,
      data,
      crc: crc32(data),
      size: data.length,
      isDir: false,
    });
  }

  /**
   * Genera el binario ZIP completo como Uint8Array.
   */
  toUint8Array() {
    const localHeaders = [];
    let offset = 0;
    const offsets = [];

    // 1. Cabeceras locales y cuerpos
    for (const e of this.entries) {
      offsets.push(offset);
      const h = new Uint8Array(30 + e.nameBytes.length);
      const dv = new DataView(h.buffer);
      dv.setUint32(0, 0x04034b50, true); // Local file header signature
      dv.setUint16(4, 20, true);         // Version needed to extract (2.0)
      dv.setUint16(6, 0x0800, true);     // General purpose bit flag (UTF-8)
      dv.setUint16(8, 0, true);          // Compression method (0 = Store)
      dv.setUint16(10, 0, true);         // File last mod time
      dv.setUint16(12, 0, true);         // File last mod date
      dv.setUint32(14, e.crc, true);     // CRC-32
      dv.setUint32(18, e.size, true);    // Compressed size
      dv.setUint32(22, e.size, true);    // Uncompressed size
      dv.setUint16(26, e.nameBytes.length, true); // File name length
      dv.setUint16(28, 0, true);         // Extra field length
      h.set(e.nameBytes, 30);
      localHeaders.push(h, e.data);
      offset += h.length + e.data.length;
    }

    const cdOffset = offset;
    const cdHeaders = [];

    // 2. Cabeceras del Directorio Central (Central Directory)
    for (let i = 0; i < this.entries.length; i++) {
      const e = this.entries[i];
      const off = offsets[i];
      const h = new Uint8Array(46 + e.nameBytes.length);
      const dv = new DataView(h.buffer);
      dv.setUint32(0, 0x02014b50, true); // Central directory signature
      dv.setUint16(4, 20, true);         // Version made by
      dv.setUint16(6, 20, true);         // Version needed to extract
      dv.setUint16(8, 0x0800, true);     // UTF-8 flag
      dv.setUint16(10, 0, true);         // Method (0 = Store)
      dv.setUint16(12, 0, true);         // Mod time
      dv.setUint16(14, 0, true);         // Mod date
      dv.setUint32(16, e.crc, true);     // CRC-32
      dv.setUint32(20, e.size, true);    // Compressed size
      dv.setUint32(24, e.size, true);    // Uncompressed size
      dv.setUint16(28, e.nameBytes.length, true); // Name len
      dv.setUint16(30, 0, true);         // Extra len
      dv.setUint16(32, 0, true);         // Comment len
      dv.setUint16(34, 0, true);         // Disk start
      dv.setUint16(36, 0, true);         // Internal attrs
      dv.setUint32(38, e.isDir ? 0x10 : 0, true); // External attrs (0x10 = directorio)
      dv.setUint32(42, off, true);       // Local header offset
      h.set(e.nameBytes, 46);
      cdHeaders.push(h);
      offset += h.length;
    }

    const cdSize = offset - cdOffset;

    // 3. Registro final de directorio central (EOCD)
    const eocd = new Uint8Array(22);
    const dv = new DataView(eocd.buffer);
    dv.setUint32(0, 0x06054b50, true);   // EOCD signature
    dv.setUint16(4, 0, true);            // Disk number
    dv.setUint16(6, 0, true);            // Disk with CD
    dv.setUint16(8, this.entries.length, true);  // Number of CD records on disk
    dv.setUint16(10, this.entries.length, true); // Total number of CD records
    dv.setUint32(12, cdSize, true);      // CD size
    dv.setUint32(16, cdOffset, true);    // CD offset
    dv.setUint16(20, 0, true);           // Comment len

    const allParts = [...localHeaders, ...cdHeaders, eocd];
    const totalBytes = allParts.reduce((acc, p) => acc + p.length, 0);
    const result = new Uint8Array(totalBytes);
    let p = 0;
    for (const part of allParts) {
      result.set(part, p);
      p += part.length;
    }
    return result;
  }

  /**
   * Genera un Blob descargable en el navegador.
   */
  toBlob() {
    return new Blob([this.toUint8Array()], { type: "application/zip" });
  }

  /**
   * Descarga el archivo ZIP en el navegador con un solo clic.
   */
  download(filename = "archivo.zip") {
    if (typeof document === "undefined") return;
    const blob = this.toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

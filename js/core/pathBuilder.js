// Batching: construye un único d=... grande usando Array.join (más rápido en bucles masivos).
export class PathBuilder {
  constructor() {
    this._chunks = [];
  }

  moveTo(x, y) { this._chunks.push(`M ${fmt(x)} ${fmt(y)}`); return this; }
  lineTo(x, y) { this._chunks.push(`L ${fmt(x)} ${fmt(y)}`); return this; }
  quadTo(cx, cy, x, y) { this._chunks.push(`Q ${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)}`); return this; }
  cubicTo(cx1, cy1, cx2, cy2, x, y) {
    this._chunks.push(`C ${fmt(cx1)} ${fmt(cy1)} ${fmt(cx2)} ${fmt(cy2)} ${fmt(x)} ${fmt(y)}`);
    return this;
  }
  close() { this._chunks.push("Z"); return this; }

  get d() { return this._chunks.join(" ").trim(); }

  circle(cx, cy, r) {
    if (r <= 0) return this;
    // 2 arcs
    this.moveTo(cx - r, cy);
    // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
    this._chunks.push(`A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)}`);
    this._chunks.push(`A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)}`);
    return this;
  }

  arcTo(rx, ry, xRot, largeArc, sweep, x, y) {
    this._chunks.push(`A ${fmt(rx)} ${fmt(ry)} ${fmt(xRot)} ${largeArc} ${sweep} ${fmt(x)} ${fmt(y)}`);
    return this;
  }

  taperedLine(x1, y1, x2, y2, w) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 0.2) return this.lineTo(x2, y2);

    const nx = -dy / len;
    const ny = dx / len;

    const wMid = w * 0.5;

    // Añadimos puntos intermedios con fluctuaciones aleatorias sutiles
    const midX = x1 + dx * 0.5;
    const midY = y1 + dy * 0.5;
    const jitter = (Math.random() - 0.5) * w * 0.15;

    this.moveTo(x1, y1);
    this.lineTo(midX + nx * wMid + jitter, midY + ny * wMid + jitter);
    this.lineTo(x2, y2);
    this.lineTo(midX - nx * wMid + jitter, midY - ny * wMid + jitter);
    this.close();
    return this;
  }

  toPath({ stroke = "#000", strokeWidthMm = 0.6, fill = "none", linecap = "round", linejoin = "round" } = {}) {
    const d = this.d;
    return `<path d="${esc(d)}" fill="${fill}" stroke="${stroke}" stroke-width="${fmt(strokeWidthMm)}" stroke-linecap="${linecap}" stroke-linejoin="${linejoin}" />`;
  }
}

function fmt(n) {
  // SVG con mm; 2-3 decimales es suficiente para impresión sin inflar el archivo
  return (Math.round(n * 1000) / 1000).toString();
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

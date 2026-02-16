// Batching: construye un único d=... grande usando Array.join (más rápido en bucles masivos).
export class PathBuilder {
  constructor(options = {}) {
    this._chunks = [];
    this.sketchy = options.sketchy || 0; // 0..1 (0=clean, 1=very rough)
    this.rng = options.rng || Math.random;
    this._currX = 0;
    this._currY = 0;
  }

  moveTo(x, y) {
    this._chunks.push(`M ${fmt(x)} ${fmt(y)}`);
    this._currX = x;
    this._currY = y;
    return this;
  }

  lineTo(x, y) {
    if (this.sketchy > 0) {
      this._roughLine(this._currX, this._currY, x, y);
    } else {
      this._chunks.push(`L ${fmt(x)} ${fmt(y)}`);
    }
    this._currX = x;
    this._currY = y;
    return this;
  }

  quadTo(cx, cy, x, y) {
    // TODO: Rough quadratic? For now keep smooth or implement simplifiction
    if (this.sketchy > 0) {
      // Approximation via lines? Or just minimal jitter? 
      // Let's keep smooth logic for curves but maybe add a duplicate stroke if very sketchy?
      // For simplicity in this iteration, we keep curves clean or add simple jitter.
      this._chunks.push(`Q ${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)}`);
    } else {
      this._chunks.push(`Q ${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)}`);
    }
    this._currX = x;
    this._currY = y;
    return this;
  }

  cubicTo(cx1, cy1, cx2, cy2, x, y) {
    this._chunks.push(`C ${fmt(cx1)} ${fmt(cy1)} ${fmt(cx2)} ${fmt(cy2)} ${fmt(x)} ${fmt(y)}`);
    this._currX = x;
    this._currY = y;
    return this;
  }

  close() { this._chunks.push("Z"); return this; }

  get d() { return this._chunks.join(" ").trim(); }

  circle(cx, cy, r) {
    if (r <= 0) return this;
    if (this.sketchy > 0) {
      // Rough circle: approximated by ellipses/blob
      const steps = 8;
      const angleStep = (Math.PI * 2) / steps;
      const j = this.sketchy * r * 0.1;

      let xStart, yStart;
      for (let i = 0; i <= steps; i++) {
        const theta = i * angleStep;
        // Jitter radius
        const rad = r + (this.rng() - 0.5) * j;
        const x = cx + Math.cos(theta) * rad;
        const y = cy + Math.sin(theta) * rad;

        if (i === 0) {
          this.moveTo(x, y);
          xStart = x; yStart = y;
        } else {
          // straight lines for rough feel
          this.lineTo(x, y);
        }
      }
      this.lineTo(xStart, yStart); // close manually
      return this;
    }

    // 2 arcs
    this.moveTo(cx - r, cy);
    // A rx ry x-axis-rotation large-arc-flag sweep-flag x y
    this._chunks.push(`A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)}`);
    this._chunks.push(`A ${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)}`);
    return this;
  }

  arcTo(rx, ry, xRot, largeArc, sweep, x, y) {
    this._chunks.push(`A ${fmt(rx)} ${fmt(ry)} ${fmt(xRot)} ${largeArc} ${sweep} ${fmt(x)} ${fmt(y)}`);
    this._currX = x;
    this._currY = y;
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
    // Use injected RNG or default
    const jitter = (this.rng() - 0.5) * w * 0.15;

    this.moveTo(x1, y1);
    this.lineTo(midX + nx * wMid + jitter, midY + ny * wMid + jitter);
    this.lineTo(x2, y2);
    this.lineTo(midX - nx * wMid + jitter, midY - ny * wMid + jitter);
    this.close();
    return this;
  }

  _roughLine(x0, y0, x1, y1) {
    // Simple implementation of "sketchy" line
    // Draw main line with slight bow + overshoot?
    // Or just 2 lines near each other?

    // Let's do a single line with slight displacement for now, 
    // effectively "wobbly".

    // If sketchy is high, maybe 2 passes?
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const bow = (this.rng() - 0.5) * this.sketchy * 0.5; // slight curve
    // Mid point
    const mx = (x0 + x1) / 2 + (this.rng() - 0.5) * this.sketchy * 0.2;
    const my = (y0 + y1) / 2 + (this.rng() - 0.5) * this.sketchy * 0.2; // + bow?

    // Simulate quadratic
    // Q control point...
    // Let's just do L for now to keep it simple but separate
    // Actually, let's just do a slightly targeted L

    // Overshoot
    const over = Math.min(0.5, this.sketchy * 0.2);
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const ox = Math.cos(angle) * over;
    const oy = Math.sin(angle) * over;

    // We are already at x0, y0 (this._currX, this._currY)
    // We want to go to x1, y1.

    // Let's push a Q to the slightly offset mid point
    this._chunks.push(`Q ${fmt(mx)} ${fmt(my)} ${fmt(x1 + ox)} ${fmt(y1 + oy)}`);

    // If very sketchy, maybe draw back?
    if (this.sketchy > 0.5 && this.rng() < 0.3) {
      // faint return stroke
      const rmx = (x0 + x1) / 2 + (this.rng() - 0.5) * this.sketchy * 0.4;
      const rmy = (y0 + y1) / 2 + (this.rng() - 0.5) * this.sketchy * 0.4;
      this._chunks.push(`M ${fmt(x1)} ${fmt(y1)} Q ${fmt(rmx)} ${fmt(rmy)} ${fmt(x0)} ${fmt(y0)} M ${fmt(x1)} ${fmt(y1)}`);
    }
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

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
    if (this._chunks.length === 0) {
      this.moveTo(x, y);
      return this;
    }
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

  rect(x, y, w, h) {
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.close();
    return this;
  }

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
    const wMid = w * 0.5;
    if (len < 0.2) return this.moveTo(x1, y1).lineTo(x2, y2);

    const nx = -dy / len;
    const ny = dx / len;
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
    // Advanced Sketchy Line v2
    // Draws multiple passes with subtle offsets and "overshoots"
    const dist = Math.hypot(x1 - x0, y1 - y0);
    if (dist < 0.1) return;

    const angle = Math.atan2(y1 - y0, x1 - x0);
    const passes = this.sketchy > 0.6 ? 2 : 1;
    
    for (let p = 0; p < passes; p++) {
      // Jitter start and end slightly for a "loose" feel
      const js = p * this.sketchy * 0.25;
      const startX = x0 + (this.rng() - 0.5) * js;
      const startY = y0 + (this.rng() - 0.5) * js;
      
      // Overshoot: common in quick hand-drawn lines
      const over = (this.rng() * 1.5) * this.sketchy * (p === 0 ? 1 : 0.5);
      const endX = x1 + Math.cos(angle) * over;
      const endY = y1 + Math.sin(angle) * over;

      // Midpoint displacement for "bowing" or "wobble"
      // Multiple segments for longer lines to avoid perfect straightness
      const segments = dist > 20 ? 3 : 2;
      
      if (p > 0 || this._chunks.length === 0) {
        this._chunks.push(`M ${fmt(startX)} ${fmt(startY)}`);
      } else if (p === 0 && (startX !== x0 || startY !== y0)) {
        this._chunks.push(`M ${fmt(startX)} ${fmt(startY)}`);
      }

      for (let s = 1; s <= segments; s++) {
        const t = s / segments;
        const targetX = startX + (endX - startX) * t;
        const targetY = startY + (endY - startY) * t;
        
        // Jitter intermediate points
        const jitter = (this.rng() - 0.5) * this.sketchy * 0.4;
        const midX = targetX + Math.cos(angle + Math.PI/2) * jitter;
        const midY = targetY + Math.sin(angle + Math.PI/2) * jitter;

        this._chunks.push(`L ${fmt(midX)} ${fmt(midY)}`);
      }
      
      // Return to original end if doing multi-pass to keep following logic sane
      if (p < passes - 1) {
          // move back or just let next pass start with M
      }
    }

    // Reset current point to original intended destination for following strokes
    this._currX = x1;
    this._currY = y1;
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

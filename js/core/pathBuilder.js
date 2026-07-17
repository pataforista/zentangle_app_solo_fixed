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
    if (this.sketchy > 0) {
      const x0 = this._currX, y0 = this._currY;
      const approxLen = Math.hypot(cx - x0, cy - y0) + Math.hypot(x - cx, y - cy);
      const pts = this._sampleCurve(approxLen, (t) => {
        const mt = 1 - t;
        return {
          x: mt * mt * x0 + 2 * mt * t * cx + t * t * x,
          y: mt * mt * y0 + 2 * mt * t * cy + t * t * y,
        };
      });
      this._emitRoughCurve(pts, approxLen);
    } else {
      this._chunks.push(`Q ${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)}`);
    }
    this._currX = x;
    this._currY = y;
    return this;
  }

  cubicTo(cx1, cy1, cx2, cy2, x, y) {
    if (this.sketchy > 0) {
      const x0 = this._currX, y0 = this._currY;
      const approxLen = Math.hypot(cx1 - x0, cy1 - y0) + Math.hypot(cx2 - cx1, cy2 - cy1) + Math.hypot(x - cx2, y - cy2);
      const pts = this._sampleCurve(approxLen, (t) => {
        const mt = 1 - t;
        return {
          x: mt * mt * mt * x0 + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * x,
          y: mt * mt * mt * y0 + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * y,
        };
      });
      this._emitRoughCurve(pts, approxLen);
    } else {
      this._chunks.push(`C ${fmt(cx1)} ${fmt(cy1)} ${fmt(cx2)} ${fmt(cy2)} ${fmt(x)} ${fmt(y)}`);
    }
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
      // Rough circle: anillo cerrado y suave con radio tembloroso
      const steps = Math.max(10, Math.min(22, Math.round((Math.PI * 2 * r) / 2.2)));
      const j = this.sketchy * r * 0.1;
      const p = [];
      for (let i = 0; i < steps; i++) {
        const theta = (i / steps) * Math.PI * 2;
        const rad = r + (this.rng() - 0.5) * j;
        p.push({ x: cx + Math.cos(theta) * rad, y: cy + Math.sin(theta) * rad });
      }
      // Cadena de cuadráticas por puntos medios: cierra sin esquinas
      this.moveTo((p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2);
      for (let i = 1; i <= steps; i++) {
        const a = p[i % steps];
        const b = p[(i + 1) % steps];
        this._chunks.push(`Q ${fmt(a.x)} ${fmt(a.y)} ${fmt((a.x + b.x) / 2)} ${fmt((a.y + b.y) / 2)}`);
      }
      this.close();
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
    if (this.sketchy > 0) {
      const sampler = _arcSampler(this._currX, this._currY, rx, ry, xRot, largeArc, sweep, x, y);
      if (sampler) {
        const pts = this._sampleCurve(sampler.approxLen, sampler.point);
        this._emitRoughCurve(pts, sampler.approxLen);
        this._currX = x;
        this._currY = y;
        return this;
      }
      // Arco degenerado (radios ~0 o puntos coincidentes): cae al trazo exacto
    }
    this._chunks.push(`A ${fmt(rx)} ${fmt(ry)} ${fmt(xRot)} ${largeArc} ${sweep} ${fmt(x)} ${fmt(y)}`);
    this._currX = x;
    this._currY = y;
    return this;
  }

  // Muestrea una curva paramétrica (t en 0..1, extremos incluidos) con densidad según longitud
  _sampleCurve(approxLen, pointAt) {
    const segments = Math.max(2, Math.min(10, Math.round(approxLen / 4)));
    const pts = [];
    for (let s = 0; s <= segments; s++) pts.push(pointAt(s / segments));
    return pts;
  }

  // Reemplaza una curva lisa por su versión "a mano": jitter perpendicular en los
  // puntos interiores y re-suavizado con cuadráticas. Los extremos no se mueven,
  // así el trazo empalma exacto con los comandos anterior y siguiente.
  _emitRoughCurve(pts, approxLen) {
    const n = pts.length;
    if (n < 2) return;
    if (this._chunks.length === 0) this.moveTo(pts[0].x, pts[0].y);
    const amp = this.sketchy * Math.min(0.35, approxLen * 0.06);
    const out = [pts[0]];
    for (let i = 1; i < n - 1; i++) {
      const dx = pts[i + 1].x - pts[i - 1].x;
      const dy = pts[i + 1].y - pts[i - 1].y;
      const dl = Math.hypot(dx, dy) || 1;
      const j = (this.rng() - 0.5) * amp;
      out.push({ x: pts[i].x - (dy / dl) * j, y: pts[i].y + (dx / dl) * j });
    }
    out.push(pts[n - 1]);
    if (out.length === 2) {
      this._chunks.push(`L ${fmt(out[1].x)} ${fmt(out[1].y)}`);
      return;
    }
    for (let i = 1; i < out.length - 1; i++) {
      const last = i === out.length - 2;
      const ex = last ? out[i + 1].x : (out[i].x + out[i + 1].x) / 2;
      const ey = last ? out[i + 1].y : (out[i].y + out[i + 1].y) / 2;
      this._chunks.push(`Q ${fmt(out[i].x)} ${fmt(out[i].y)} ${fmt(ex)} ${fmt(ey)}`);
    }
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

// Conversión endpoint -> centro de un arco SVG (spec W3C) para poder muestrearlo.
// Devuelve null en casos degenerados (radios ~0 o extremos coincidentes).
function _arcSampler(x0, y0, rx, ry, xRotDeg, largeArc, sweep, x1, y1) {
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx < 1e-6 || ry < 1e-6) return null;
  if (Math.hypot(x1 - x0, y1 - y0) < 1e-6) return null;

  const phi = (xRotDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  const dx2 = (x0 - x1) / 2, dy2 = (y0 - y1) / 2;
  const x1p = cosPhi * dx2 + sinPhi * dy2;
  const y1p = -sinPhi * dx2 + cosPhi * dy2;

  // Radios insuficientes: la spec manda escalarlos hasta que el arco exista
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s; ry *= s;
  }

  const sign = largeArc !== sweep ? 1 : -1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * rx * y1p) / ry;
  const cyp = (-coef * ry * x1p) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x0 + x1) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y0 + y1) / 2;

  const angleOf = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.max(-1, Math.min(1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const ux = (x1p - cxp) / rx, uy = (y1p - cyp) / ry;
  const theta1 = angleOf(1, 0, ux, uy);
  let dTheta = angleOf(ux, uy, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dTheta > 0) dTheta -= Math.PI * 2;
  if (sweep && dTheta < 0) dTheta += Math.PI * 2;

  return {
    approxLen: Math.abs(dTheta) * Math.max(rx, ry),
    point(t) {
      const theta = theta1 + t * dTheta;
      const ct = Math.cos(theta), st = Math.sin(theta);
      return {
        x: cx + rx * ct * cosPhi - ry * st * sinPhi,
        y: cy + rx * ct * sinPhi + ry * st * cosPhi,
      };
    },
  };
}

function fmt(n) {
  // SVG con mm; 2-3 decimales es suficiente para impresión sin inflar el archivo
  return (Math.round(n * 1000) / 1000).toString();
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

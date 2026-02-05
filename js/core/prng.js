// sfc32 - Simple Fast Counter (period ~2^128)
// Más robusto que mulberry32 para semillas largas y arte generativo.
export function sfc32(a, b, c, d) {
  return function () {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = c << 21 | c >>> 11;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  };
}

// Helper para inicializar sfc32 desde un único seed de 32 bits
export function createRNG(seed) {
  let x = seed >>> 0;
  // Mezcla simple para cebar los 4 estados
  let a = x ^ 0xDEADBEEF;
  let b = (x ^ 0x12345678) << 5;
  let c = (x ^ 0x87654321) >>> 3;
  let d = x + 0xABCDEFFF;
  return sfc32(a, b, c, d);
}

export function rFloat(rng, min, max) {
  return rng() * (max - min) + min;
}

export function rInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

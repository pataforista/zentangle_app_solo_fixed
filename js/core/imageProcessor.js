/**
 * Image Processing Module - Sobel Edge Detection
 * Converts images to zentangle-compatible edge-detected versions
 */

/**
 * Apply Sobel edge detection to an image
 * @param {HTMLImageElement} image - The image to process
 * @param {number} threshold - Edge detection threshold (higher = fewer lines)
 * @returns {HTMLCanvasElement} Canvas with edge-detected image
 */
export function applySobelEdgeDetection(image, threshold = 40) {
  // Optimize size for performance
  const MAX_SIZE = 800;
  let w = image.width;
  let h = image.height;

  if (w > MAX_SIZE || h > MAX_SIZE) {
    const ratio = Math.min(MAX_SIZE / w, MAX_SIZE / h);
    w = Math.floor(w * ratio);
    h = Math.floor(h * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // Draw original image
  ctx.drawImage(image, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const outputData = new ImageData(w, h);
  const out = outputData.data;

  // 1. Convert to grayscale
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }

  // 2. Apply Sobel operator
  const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let px = 0,
        py = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = gray[(y + ky) * w + (x + kx)];
          const weightX = kernelX[(ky + 1) * 3 + (kx + 1)];
          const weightY = kernelY[(ky + 1) * 3 + (kx + 1)];
          px += val * weightX;
          py += val * weightY;
        }
      }

      const magnitude = Math.sqrt(px * px + py * py);
      const isEdge = magnitude > threshold;
      const color = isEdge ? 0 : 255;

      const idx = (y * w + x) * 4;
      out[idx] = color;
      out[idx + 1] = color;
      out[idx + 2] = color;
      out[idx + 3] = 255;
    }
  }

  ctx.putImageData(outputData, 0, 0);
  return canvas;
}

/**
 * Load an image from a File object
 * @param {File} file - Image file
 * @returns {Promise<HTMLImageElement>} Loaded image
 */
export function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = event.target.result;
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

/**
 * Convert processed image canvas to SVG paths for integration with zentangle
 * @param {HTMLCanvasElement} canvas - Processed image canvas
 * @param {number} scaleFactor - Scale the image
 * @returns {string} SVG path data
 */
export function canvasToSVGPaths(canvas, scaleFactor = 1) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let paths = [];
  const visited = new Set();

  // Simple edge tracing - find connected black pixels
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] === 0 && !visited.has(i / 4)) {
      // Black pixel
      const path = traceEdge(imageData, i / 4, visited);
      if (path.length > 2) {
        paths.push(path);
      }
    }
  }

  return pathsToSVG(paths, scaleFactor);
}

function traceEdge(imageData, startIdx, visited) {
  const w = imageData.width;
  const data = imageData.data;
  const path = [];
  const queue = [startIdx];
  const localVisited = new Set();

  while (queue.length > 0) {
    const idx = queue.shift();
    if (visited.has(idx) || localVisited.has(idx)) continue;

    localVisited.add(idx);
    visited.add(idx);

    const x = idx % w;
    const y = Math.floor(idx / w);
    path.push({ x, y });

    // Check neighbors
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < imageData.height) {
          const nIdx = ny * w + nx;
          if (!visited.has(nIdx) && !localVisited.has(nIdx)) {
            const pixelIdx = nIdx * 4;
            if (data[pixelIdx] === 0) {
              queue.push(nIdx);
            }
          }
        }
      }
    }
  }

  return path;
}

function pathsToSVG(paths, scaleFactor) {
  if (paths.length === 0) return "";

  let svg = '';
  for (const path of paths) {
    if (path.length < 2) continue;

    svg += `M ${path[0].x * scaleFactor} ${path[0].y * scaleFactor}`;
    for (let i = 1; i < path.length; i++) {
      svg += ` L ${path[i].x * scaleFactor} ${path[i].y * scaleFactor}`;
    }
  }

  return svg;
}

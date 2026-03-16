/**
 * Image Processing Module - Advanced Preprocessing for Zentangle Patterns
 * Includes edge detection, contrast normalization, and feature extraction
 */

/**
 * Normalize contrast using histogram equalization
 * @param {Uint8ClampedArray} gray - Grayscale pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} Equalized grayscale data
 */
function contrastNormalize(gray, width, height) {
  // Build histogram
  const hist = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    hist[gray[i]]++;
  }

  // Compute cumulative histogram
  const cumHist = new Uint32Array(256);
  cumHist[0] = hist[0];
  for (let i = 1; i < 256; i++) {
    cumHist[i] = cumHist[i - 1] + hist[i];
  }

  // Normalize
  const normalized = new Uint8ClampedArray(gray.length);
  const pixelCount = width * height;
  for (let i = 0; i < gray.length; i++) {
    const normalized_val = (cumHist[gray[i]] * 255) / pixelCount;
    normalized[i] = Math.min(255, Math.round(normalized_val));
  }

  return normalized;
}

/**
 * Apply Gaussian blur for noise reduction
 * @param {Uint8ClampedArray} gray - Grayscale pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {number} iterations - Number of blur passes (default 1)
 * @returns {Uint8ClampedArray} Blurred grayscale data
 */
function gaussianBlur(gray, width, height, iterations = 1) {
  let current = gray;

  for (let iter = 0; iter < iterations; iter++) {
    const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
    const factor = 16;
    const blurred = new Uint8ClampedArray(current.length);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = (y + ky) * width + (x + kx);
            const weight = kernel[(ky + 1) * 3 + (kx + 1)];
            sum += current[idx] * weight;
          }
        }
        blurred[y * width + x] = Math.round(sum / factor);
      }
    }

    // Copy edges
    for (let x = 0; x < width; x++) {
      blurred[x] = current[x];
      blurred[(height - 1) * width + x] = current[(height - 1) * width + x];
    }
    for (let y = 0; y < height; y++) {
      blurred[y * width] = current[y * width];
      blurred[y * width + (width - 1)] = current[y * width + (width - 1)];
    }

    current = blurred;
  }

  return current;
}

/**
 * Extract gradient magnitude map (for density mapping)
 * @param {Uint8ClampedArray} gray - Grayscale pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} Gradient magnitude map
 */
function extractGradientMap(gray, width, height) {
  const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  const gradients = new Uint8ClampedArray(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let px = 0, py = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = gray[(y + ky) * width + (x + kx)];
          const weightX = kernelX[(ky + 1) * 3 + (kx + 1)];
          const weightY = kernelY[(ky + 1) * 3 + (kx + 1)];
          px += val * weightX;
          py += val * weightY;
        }
      }
      const magnitude = Math.sqrt(px * px + py * py);
      gradients[y * width + x] = Math.min(255, Math.round(magnitude));
    }
  }

  return gradients;
}

/**
 * Apply advanced edge detection with preprocessing to an image
 * @param {HTMLImageElement} image - The image to process
 * @param {number} threshold - Edge detection threshold (higher = fewer lines)
 * @param {Object} options - Processing options
 * @returns {HTMLCanvasElement} Canvas with edge-detected image
 */
export function applySobelEdgeDetection(image, threshold = 40, options = {}) {
  const {
    normalize = true,    // Normalize contrast for better edge detection
    blurPasses = 2,      // Number of blur iterations
    invertEdges = false  // Invert black/white for pattern generation
  } = options;

  // Optimize size for performance
  const MAX_SIZE = 1000;
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

  // 2. Normalize contrast for better feature detection
  let processed = normalize ? contrastNormalize(gray, w, h) : gray;

  // 3. Apply Gaussian blur to reduce noise
  processed = gaussianBlur(processed, w, h, blurPasses);

  // 4. Apply Sobel operator for edge detection
  const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let px = 0, py = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = processed[(y + ky) * w + (x + kx)];
          const weightX = kernelX[(ky + 1) * 3 + (kx + 1)];
          const weightY = kernelY[(ky + 1) * 3 + (kx + 1)];
          px += val * weightX;
          py += val * weightY;
        }
      }

      const magnitude = Math.sqrt(px * px + py * py);
      const isEdge = magnitude > threshold;
      const color = invertEdges ? (isEdge ? 255 : 0) : (isEdge ? 0 : 255);

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
 * Generate a density map from image for pattern guidance
 * @param {HTMLImageElement} image - The image to process
 * @returns {HTMLCanvasElement} Canvas with density map (darker = more detail)
 */
export function generateDensityMap(image) {
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

  ctx.drawImage(image, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const outputData = new ImageData(w, h);
  const out = outputData.data;

  // Convert to grayscale
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  }

  // Normalize contrast
  const normalized = contrastNormalize(gray, w, h);

  // Smooth
  const blurred = gaussianBlur(normalized, w, h, 2);

  // Extract gradient map (areas with more edges = darker in density map)
  const gradients = extractGradientMap(blurred, w, h);

  // Convert gradients to density map (inverted for pattern density)
  for (let i = 0; i < w * h; i++) {
    const density = 255 - gradients[i]; // Invert: high gradient -> low density
    const idx = i * 4;
    out[idx] = density;     // R
    out[idx + 1] = density; // G
    out[idx + 2] = density; // B
    out[idx + 3] = 255;     // A
  }

  ctx.putImageData(outputData, 0, 0);
  return canvas;
}

/**
 * Get image statistics for UI feedback
 * @param {HTMLImageElement} image - The image to analyze
 * @returns {Object} Statistics object
 */
export function getImageStats(image) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.min(image.width, 200);
  canvas.height = Math.min(image.height, 200);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  let sumBrightness = 0;
  let sumContrast = 0;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    sumBrightness += gray;
  }

  const avgBrightness = Math.round(sumBrightness / (data.length / 4));
  const contrast = avgBrightness < 128 ? "oscura" : "clara";

  return {
    width: image.width,
    height: image.height,
    brightness: avgBrightness,
    contrast: contrast,
    aspectRatio: (image.width / image.height).toFixed(2)
  };
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
 * Draw image with radial symmetry (zentangle style)
 * @param {HTMLCanvasElement} svgCanvas - Target SVG canvas
 * @param {HTMLCanvasElement} imageCanvas - Processed image canvas
 * @param {number} slices - Number of symmetry slices
 * @param {number} zoom - Zoom factor
 * @param {number} offsetX - Horizontal offset
 * @param {number} offsetY - Vertical offset
 */
export function drawImageWithSymmetry(
  svgCanvas,
  imageCanvas,
  slices = 12,
  zoom = 1.5,
  offsetX = 0,
  offsetY = 0
) {
  // Create temporary canvas for the symmetric pattern
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = svgCanvas.width;
  tempCanvas.height = svgCanvas.height;
  const ctx = tempCanvas.getContext("2d");

  // Fill with white background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  const cx = tempCanvas.width / 2;
  const cy = tempCanvas.height / 2;
  const radius = Math.max(cx, cy) * 1.5;
  const angle = (Math.PI * 2) / slices;
  const anglePadding = 0.005;

  // Draw image slices with symmetry
  for (let i = 0; i < slices; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i * angle);
    if (i % 2 === 1) {
      ctx.scale(1, -1);
    }

    // Create clipping path for this slice
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, radius, -(angle / 2) - anglePadding, (angle / 2) + anglePadding);
    ctx.closePath();
    ctx.clip();

    // Apply transformations and draw image
    ctx.translate(offsetX, offsetY);
    ctx.scale(zoom, zoom);

    const imgW = imageCanvas.width;
    const imgH = imageCanvas.height;
    ctx.drawImage(imageCanvas, -imgW / 2, -imgH / 2);

    ctx.restore();
  }

  return tempCanvas;
}

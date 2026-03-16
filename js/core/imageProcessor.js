/**
 * Image Processing Module - Sobel Edge Detection with Smoothing
 * Converts images to zentangle-compatible edge-detected versions
 */

/**
 * Apply Gaussian blur for noise reduction
 * @param {Uint8ClampedArray} gray - Grayscale pixel data
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @returns {Uint8ClampedArray} Blurred grayscale data
 */
function gaussianBlur(gray, width, height) {
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
  const factor = 16;
  const blurred = new Uint8ClampedArray(gray.length);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = (y + ky) * width + (x + kx);
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];
          sum += gray[idx] * weight;
        }
      }
      blurred[y * width + x] = Math.round(sum / factor);
    }
  }

  // Copy edges
  for (let x = 0; x < width; x++) {
    blurred[x] = gray[x];
    blurred[(height - 1) * width + x] = gray[(height - 1) * width + x];
  }
  for (let y = 0; y < height; y++) {
    blurred[y * width] = gray[y * width];
    blurred[y * width + (width - 1)] = gray[y * width + (width - 1)];
  }

  return blurred;
}

/**
 * Apply Sobel edge detection to an image
 * @param {HTMLImageElement} image - The image to process
 * @param {number} threshold - Edge detection threshold (higher = fewer lines)
 * @returns {HTMLCanvasElement} Canvas with edge-detected image
 */
export function applySobelEdgeDetection(image, threshold = 40) {
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

  // 2. Apply Gaussian blur to reduce noise
  const blurred = gaussianBlur(gray, w, h);

  // 3. Apply Sobel operator
  const kernelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const kernelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let px = 0,
        py = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const val = blurred[(y + ky) * w + (x + kx)];
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

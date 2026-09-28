/**
 * image-processor.js
 * Motor profesional de remoción de fondo con detección de cavidades interiores
 * (huecos de letras O, A, 0, B, etc.) y suavizado de bordes (anti-aliasing).
 * 100% libre, local y sin dependencias externas.
 */

export function removeBackgroundAdvanced(imageSource, options = {}) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        const tolerance = options.tolerance !== undefined ? options.tolerance : 32;

        // 1. Detectar color de fondo analizando las 4 esquinas y bordes
        const cornerSamples = [
          getPixel(data, width, 0, 0),
          getPixel(data, width, width - 1, 0),
          getPixel(data, width, 0, height - 1),
          getPixel(data, width, width - 1, height - 1),
          getPixel(data, width, Math.floor(width / 2), 0),
          getPixel(data, width, Math.floor(width / 2), height - 1),
          getPixel(data, width, 0, Math.floor(height / 2)),
          getPixel(data, width, width - 1, Math.floor(height / 2))
        ];

        let bgR = 0, bgG = 0, bgB = 0, validSamples = 0;
        cornerSamples.forEach(c => {
          if (c.a > 50) {
            bgR += c.r; bgG += c.g; bgB += c.b;
            validSamples++;
          }
        });

        if (validSamples === 0) {
          resolve(canvas.toDataURL('image/png'));
          return;
        }

        bgR = Math.round(bgR / validSamples);
        bgG = Math.round(bgG / validSamples);
        bgB = Math.round(bgB / validSamples);

        const isBgColor = (r, g, b, tol = tolerance) => {
          const diff = Math.sqrt(
            Math.pow(r - bgR, 2) * 0.299 +
            Math.pow(g - bgG, 2) * 0.587 +
            Math.pow(b - bgB, 2) * 0.114
          );
          return diff <= tol;
        };

        const totalPixels = width * height;
        const mask = new Uint8Array(totalPixels);

        // 2. Flood Fill desde el perímetro exterior
        const queue = new Int32Array(totalPixels);
        let qHead = 0;
        let qTail = 0;

        const pushQueue = (idx) => {
          mask[idx] = 1;
          queue[qTail++] = idx;
        };

        for (let x = 0; x < width; x++) {
          const topIdx = x;
          const botIdx = (height - 1) * width + x;
          const topP = getPixel(data, width, x, 0);
          const botP = getPixel(data, width, x, height - 1);
          if (mask[topIdx] === 0 && isBgColor(topP.r, topP.g, topP.b)) pushQueue(topIdx);
          if (mask[botIdx] === 0 && isBgColor(botP.r, botP.g, botP.b)) pushQueue(botIdx);
        }

        for (let y = 0; y < height; y++) {
          const leftIdx = y * width;
          const rightIdx = y * width + (width - 1);
          const leftP = getPixel(data, width, 0, y);
          const rightP = getPixel(data, width, width - 1, y);
          if (mask[leftIdx] === 0 && isBgColor(leftP.r, leftP.g, leftP.b)) pushQueue(leftIdx);
          if (mask[rightIdx] === 0 && isBgColor(rightP.r, rightP.g, rightP.b)) pushQueue(rightIdx);
        }

        while (qHead < qTail) {
          const idx = queue[qHead++];
          const x = idx % width;
          const y = Math.floor(idx / width);

          const neighbors = [
            x > 0 ? idx - 1 : -1,
            x < width - 1 ? idx + 1 : -1,
            y > 0 ? idx - width : -1,
            y < height - 1 ? idx + width : -1
          ];

          for (let i = 0; i < 4; i++) {
            const nIdx = neighbors[i];
            if (nIdx !== -1 && mask[nIdx] === 0) {
              const pOffset = nIdx * 4;
              if (isBgColor(data[pOffset], data[pOffset + 1], data[pOffset + 2])) {
                pushQueue(nIdx);
              }
            }
          }
        }

        // 3. Detección y vaciado de cavidades interiores (letras O, A, 0, etc.)
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (mask[idx] === 0) {
              const pOffset = idx * 4;
              if (isBgColor(data[pOffset], data[pOffset + 1], data[pOffset + 2], tolerance * 0.95)) {
                const cavityQueue = [idx];
                mask[idx] = 2;
                let cHead = 0;
                let touchesBorder = false;

                while (cHead < cavityQueue.length) {
                  const cIdx = cavityQueue[cHead++];
                  const cx = cIdx % width;
                  const cy = Math.floor(cIdx / width);

                  if (cx === 0 || cx === width - 1 || cy === 0 || cy === height - 1) {
                    touchesBorder = true;
                  }

                  const cNeighbors = [
                    cx > 0 ? cIdx - 1 : -1,
                    cx < width - 1 ? cIdx + 1 : -1,
                    cy > 0 ? cIdx - width : -1,
                    cy < height - 1 ? cIdx + width : -1
                  ];

                  for (let j = 0; j < 4; j++) {
                    const cnIdx = cNeighbors[j];
                    if (cnIdx !== -1 && mask[cnIdx] === 0) {
                      const cnOffset = cnIdx * 4;
                      if (isBgColor(data[cnOffset], data[cnOffset + 1], data[cnOffset + 2], tolerance * 0.95)) {
                        mask[cnIdx] = 2;
                        cavityQueue.push(cnIdx);
                      }
                    }
                  }
                }

                if (!touchesBorder) {
                  for (let k = 0; k < cavityQueue.length; k++) {
                    mask[cavityQueue[k]] = 1;
                  }
                }
              }
            }
          }
        }

        // 4. Suavizado Alfa Perimetral (Anti-Aliasing)
        const alphaChannel = new Uint8Array(totalPixels);
        for (let i = 0; i < totalPixels; i++) {
          alphaChannel[i] = mask[i] === 1 ? 0 : 255;
        }

        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            if (mask[idx] === 0) {
              const nTop = mask[idx - width];
              const nBot = mask[idx + width];
              const nLeft = mask[idx - 1];
              const nRight = mask[idx + 1];

              if (nTop === 1 || nBot === 1 || nLeft === 1 || nRight === 1) {
                const pOff = idx * 4;
                const diff = Math.sqrt(
                  Math.pow(data[pOff] - bgR, 2) * 0.299 +
                  Math.pow(data[pOff + 1] - bgG, 2) * 0.587 +
                  Math.pow(data[pOff + 2] - bgB, 2) * 0.114
                );
                if (diff < tolerance * 1.5) {
                  const factor = Math.min(1, Math.max(0.15, (diff - (tolerance * 0.35)) / (tolerance * 1.15)));
                  alphaChannel[idx] = Math.round(255 * factor);
                }
              }
            }
          }
        }

        for (let i = 0; i < totalPixels; i++) {
          data[i * 4 + 3] = Math.min(data[i * 4 + 3], alphaChannel[i]);
        }

        ctx.putImageData(imgData, 0, 0);
        const croppedCanvas = cropTransparentCanvas(canvas);
        resolve(croppedCanvas.toDataURL('image/png'));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('No se pudo cargar la imagen para procesamiento'));
    img.src = imageSource;
  });
}

/**
 * Recorta automáticamente todos los márgenes vacíos/transparentes
 * para que el logotipo ocupe el 100% de la caja visible sin bordes fantasma.
 */
export function cropTransparentCanvas(canvas) {
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = data[(y * width + x) * 4 + 3];
        if (a > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX === -1 || minX > maxX || minY > maxY) {
      return canvas;
    }

    const pad = 4;
    const startX = Math.max(0, minX - pad);
    const startY = Math.max(0, minY - pad);
    const endX = Math.min(width - 1, maxX + pad);
    const endY = Math.min(height - 1, maxY + pad);

    const cropW = endX - startX + 1;
    const cropH = endY - startY + 1;

    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = cropW;
    croppedCanvas.height = cropH;
    const croppedCtx = croppedCanvas.getContext('2d');
    croppedCtx.drawImage(canvas, startX, startY, cropW, cropH, 0, 0, cropW, cropH);

    return croppedCanvas;
  } catch (e) {
    console.error('Error recortando lienzo transparente:', e);
    return canvas;
  }
}

export function autoTrimImage(imageSource) {
  return new Promise((resolve) => {
    if (!imageSource) return resolve(imageSource);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0);
        const cropped = cropTransparentCanvas(canvas);
        resolve(cropped.toDataURL('image/png'));
      } catch (err) {
        resolve(imageSource);
      }
    };
    img.onerror = () => resolve(imageSource);
    img.src = imageSource;
  });
}

function getPixel(data, width, x, y) {
  const offset = (y * width + x) * 4;
  return {
    r: data[offset],
    g: data[offset + 1],
    b: data[offset + 2],
    a: data[offset + 3]
  };
}

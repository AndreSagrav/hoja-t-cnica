/**
 * color-extractor.js
 * Extractor cromático 100% fiel a los píxeles reales del logotipo corporativo.
 * No inyecta colores inventados ni tonos oscuros fijos a menos que estén
 * presentes en la imagen subida por el usuario.
 */

export function extractPaletteFromImage(imageSource) {
  return new Promise((resolve) => {
    if (!imageSource) {
      resolve(getDefaultPalette());
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        const maxDim = 150;
        let w = img.naturalWidth || img.width || 100;
        let h = img.naturalHeight || img.height || 100;
        if (w > h) {
          if (w > maxDim) { h = Math.round((h * maxDim) / w); w = maxDim; }
        } else {
          if (h > maxDim) { h = Math.round((w * maxDim) / h); h = maxDim; }
        }

        canvas.width = w;
        canvas.height = h;
        ctx.drawImage(img, 0, 0, w, h);

        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const colorBuckets = {};

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 60) continue; // Píxel transparente o casi transparente

          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          // Filtrar únicamente fondo blanco puro / cuasi blanco del lienzo
          if (r > 244 && g > 244 && b > 244) continue;

          // Agrupación de color con paso de 16 para capturar tonos exactos sin saturar clusters
          const qr = Math.min(255, Math.floor(r / 16) * 16 + 8);
          const qg = Math.min(255, Math.floor(g / 16) * 16 + 8);
          const qb = Math.min(255, Math.floor(b / 16) * 16 + 8);

          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const delta = max - min;
          const sat = max === 0 ? 0 : delta / max;
          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

          const key = `${qr},${qg},${qb}`;
          if (!colorBuckets[key]) {
            colorBuckets[key] = { r: qr, g: qg, b: qb, count: 0, sat, lum };
          }
          colorBuckets[key].count++;
        }

        const buckets = Object.values(colorBuckets);
        if (buckets.length === 0) {
          resolve(getDefaultPalette());
          return;
        }

        // Ordenar por presencia real en la imagen con ligero peso a la saturación
        buckets.sort((a, b) => (b.count * (1 + b.sat * 1.5)) - (a.count * (1 + a.sat * 1.5)));

        // Agrupar muestras perceptualmente distintas encontradas en la imagen
        const distinctBuckets = [];
        for (const b of buckets) {
          const isTooClose = distinctBuckets.some(db => {
            const dr = (db.r - b.r) * 0.3;
            const dg = (db.g - b.g) * 0.59;
            const db_ = (db.b - b.b) * 0.11;
            const dist = Math.sqrt(dr*dr + dg*dg + db_*db_);
            return dist < 28;
          });
          if (!isTooClose) {
            distinctBuckets.push(b);
          }
          if (distinctBuckets.length >= 8) break;
        }

        const muestras = distinctBuckets.map(b => rgbToHex(b.r, b.g, b.b));

        // Color primario: el color cromático más relevante de la imagen (o el más frecuente si es monocromático)
        const primaryBucket = distinctBuckets.find(b => b.sat > 0.2) || distinctBuckets[0];
        const primario = rgbToHex(primaryBucket.r, primaryBucket.g, primaryBucket.b);

        // Color secundario: el segundo color real de la imagen con distancia visual
        let secondBucket = distinctBuckets.find(b => {
          const hex = rgbToHex(b.r, b.g, b.b);
          return colorDistance(primario, hex) >= 40;
        });
        let secundario = secondBucket ? rgbToHex(secondBucket.r, secondBucket.g, secondBucket.b) : null;
        if (!secundario) {
          // Si el logotipo solo tiene un tono único, crear variante más oscura del mismo tono real
          secundario = shadeColor(primario, -35);
        }

        // Color de acento: tercer color real o variante luminosa de la imagen
        let thirdBucket = distinctBuckets.find(b => {
          const hex = rgbToHex(b.r, b.g, b.b);
          return colorDistance(primario, hex) >= 35 && colorDistance(secundario, hex) >= 35;
        });
        let acento = thirdBucket ? rgbToHex(thirdBucket.r, thirdBucket.g, thirdBucket.b) : null;
        if (!acento) {
          acento = shadeColor(primario, 25);
        }

        if (!muestras.includes(primario)) muestras.unshift(primario);
        if (!muestras.includes(secundario) && muestras.length < 8) muestras.push(secundario);
        if (!muestras.includes(acento) && muestras.length < 8) muestras.push(acento);

        const basePalette = { primario, secundario, acento };
        const schemes = generateSchemes(basePalette);

        resolve({
          colores: basePalette,
          muestras: muestras,
          esquemas: schemes
        });
      } catch (err) {
        console.error('Error extrayendo paleta de imagen:', err);
        resolve(getDefaultPalette());
      }
    };
    img.onerror = () => resolve(getDefaultPalette());
    img.src = imageSource;
  });
}

/**
 * Genera esquemas del sistema 100% basados en los colores extraídos de la imagen.
 * Sin colores negros ni grafitos fijos que no pertenezcan al logo.
 */
export function generateSchemes(colores) {
  const p = colores.primario || '#00a651';
  const s = colores.secundario || '#005baa';
  const a = colores.acento || shadeColor(p, 20);

  return {
    institucional: {
      id: 'institucional',
      nombre: 'Identidad Institucional',
      descripcion: 'Basado en los colores dominantes del logotipo',
      sidebarBg: `linear-gradient(180deg, ${shadeColor(s, -35)} 0%, ${s} 50%, ${shadeColor(s, -45)} 100%)`,
      accent: p,
      accentDark: shadeColor(p, -20),
      navy: shadeColor(s, -25),
      sample: [shadeColor(s, -35), p, s]
    },
    moderno_bicolor: {
      id: 'moderno_bicolor',
      nombre: 'Moderno Bicolor',
      descripcion: 'Contraste dinámico entre los tonos del logo',
      sidebarBg: `linear-gradient(180deg, ${shadeColor(p, -45)} 0%, ${shadeColor(s, -45)} 100%)`,
      accent: a,
      accentDark: shadeColor(a, -20),
      navy: shadeColor(s, -35),
      sample: [shadeColor(p, -45), a, s]
    },
    marca_profunda: {
      id: 'marca_profunda',
      nombre: 'Contraste de Marca',
      descripcion: 'Fondo oscuro derivado del color secundario del logo',
      sidebarBg: `linear-gradient(180deg, ${shadeColor(s, -55)} 0%, ${shadeColor(s, -40)} 100%)`,
      accent: p,
      accentDark: shadeColor(p, -20),
      navy: shadeColor(s, -30),
      sample: [shadeColor(s, -55), p, a]
    },
    luminoso: {
      id: 'luminoso',
      nombre: 'Variante Primaria',
      descripcion: 'Profundidad visual derivada del color primario del logo',
      sidebarBg: `linear-gradient(180deg, ${shadeColor(p, -50)} 0%, ${shadeColor(p, -35)} 100%)`,
      accent: s,
      accentDark: shadeColor(s, -20),
      navy: shadeColor(p, -40),
      sample: [shadeColor(p, -50), s, p]
    }
  };
}

function getDefaultPalette() {
  const base = { primario: '#00a651', secundario: '#005baa', acento: '#22c55e' };
  return {
    colores: base,
    muestras: ['#00a651', '#005baa', '#00833e', '#003d73', '#22c55e', '#38bdf8'],
    esquemas: generateSchemes(base)
  };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16) || 0,
    g: parseInt(clean.substring(2, 4), 16) || 0,
    b: parseInt(clean.substring(4, 6), 16) || 0
  };
}

function colorDistance(hex1, hex2) {
  const c1 = hexToRgb(hex1);
  const c2 = hexToRgb(hex2);
  return Math.sqrt((c1.r - c2.r)**2 + (c1.g - c2.g)**2 + (c1.b - c2.b)**2);
}

export function shadeColor(hex, percent) {
  const rgb = hexToRgb(hex);
  const factor = 1 + percent / 100;
  const r = Math.min(255, Math.max(0, Math.round(rgb.r * factor)));
  const g = Math.min(255, Math.max(0, Math.round(rgb.g * factor)));
  const b = Math.min(255, Math.max(0, Math.round(rgb.b * factor)));
  return rgbToHex(r, g, b);
}

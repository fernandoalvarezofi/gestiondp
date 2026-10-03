/** Controles de calidad de una foto de documento o selfie, hechos en el navegador antes de subirla. */
export type GrayStats = { sharpness: number; brightness: number; glare: number };
export type PhotoQuality = GrayStats & { width: number; height: number; problems: string[]; ok: boolean };

export const MIN_LONG_SIDE = 720;
const MIN_SHARPNESS = 35;
const MIN_BRIGHTNESS = 55;
const MAX_BRIGHTNESS = 215;
const MAX_GLARE = 0.12;

/** Nitidez (varianza del laplaciano), brillo medio y proporción de píxeles quemados por reflejos. */
export function analyzeGray(gray: Uint8ClampedArray, width: number, height: number): GrayStats {
  let sum = 0;
  let burnt = 0;
  for (let index = 0; index < gray.length; index++) {
    sum += gray[index];
    if (gray[index] >= 250) burnt++;
  }
  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width];
      lapSum += lap;
      lapSq += lap * lap;
      count++;
    }
  }
  const mean = count ? lapSum / count : 0;
  return { sharpness: count ? lapSq / count - mean * mean : 0, brightness: gray.length ? sum / gray.length : 0, glare: gray.length ? burnt / gray.length : 0 };
}

/** Traduce las métricas a problemas concretos que la persona pueda corregir. */
export function judgeQuality(stats: GrayStats, width: number, height: number): PhotoQuality {
  const problems: string[] = [];
  if (Math.max(width, height) < MIN_LONG_SIDE) problems.push("La foto es muy chica: acercate o usá la cámara trasera.");
  if (stats.brightness < MIN_BRIGHTNESS) problems.push("Hay muy poca luz: buscá un lugar más iluminado.");
  else if (stats.brightness > MAX_BRIGHTNESS) problems.push("Hay demasiada luz: evitá el sol directo.");
  if (stats.glare > MAX_GLARE) problems.push("Hay reflejos que tapan datos: inclinalo un poco para evitarlos.");
  if (stats.sharpness < MIN_SHARPNESS) problems.push("La foto salió borrosa: sostené quieto el teléfono y enfocá.");
  return { ...stats, width, height, problems, ok: problems.length === 0 };
}

/** Analiza una imagen ya dibujada en un canvas (se reduce a 320 px de ancho para que sea rápido). */
export function analyzeCanvas(source: HTMLCanvasElement): PhotoQuality {
  const targetWidth = 320;
  const scale = Math.min(1, targetWidth / source.width);
  const width = Math.max(8, Math.round(source.width * scale));
  const height = Math.max(8, Math.round(source.height * scale));
  const small = document.createElement("canvas");
  small.width = width;
  small.height = height;
  const context = small.getContext("2d", { willReadFrequently: true });
  if (!context) return judgeQuality({ sharpness: 999, brightness: 128, glare: 0 }, source.width, source.height);
  context.drawImage(source, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
  return judgeQuality(analyzeGray(gray, width, height), source.width, source.height);
}

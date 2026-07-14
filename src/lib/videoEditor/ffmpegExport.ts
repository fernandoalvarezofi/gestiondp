import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import type { Timeline, Proyecto } from "./types";

let ffmpegInst: FFmpeg | null = null;

async function getFFmpeg(onLog?: (l: string) => void) {
  if (ffmpegInst) return ffmpegInst;
  const ff = new FFmpeg();
  if (onLog) ff.on("log", ({ message }) => onLog(message));
  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";
  await ff.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });
  ffmpegInst = ff;
  return ff;
}

/**
 * Exporta la timeline: captura el <canvas> de preview cuadro a cuadro (via MediaRecorder o
 * pipeline manual), y combina con audio de los clips. Estrategia MVP:
 *   1) Renderizamos preview a MediaRecorder (canvas.captureStream) mientras corre la timeline.
 *   2) Con FFmpeg re-empaquetamos a MP4 h264+aac.
 */
export async function exportarTimeline(opts: {
  proyecto: Proyecto;
  canvas: HTMLCanvasElement;
  onProgress?: (p: number) => void;
  onLog?: (l: string) => void;
  playFn: () => Promise<void>;
  stopFn: () => void;
  duracion: number;
}): Promise<Blob> {
  const { canvas, onProgress, onLog, playFn, stopFn, duracion } = opts;

  const stream = canvas.captureStream(opts.proyecto.fps);
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream, {
    mimeType: "video/webm;codecs=vp9",
    videoBitsPerSecond: 6_000_000,
  });
  rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const done = new Promise<void>((res) => (rec.onstop = () => res()));

  rec.start(100);
  const startedAt = performance.now();
  const tick = setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    onProgress?.(Math.min(90, (elapsed / duracion) * 90));
  }, 200);

  await playFn();
  // Esperamos que termine
  await new Promise((r) => setTimeout(r, duracion * 1000 + 200));
  stopFn();
  rec.stop();
  clearInterval(tick);
  await done;

  const webm = new Blob(chunks, { type: "video/webm" });
  onProgress?.(92);

  // Reencode a MP4 (h264) para máxima compatibilidad
  try {
    const ff = await getFFmpeg(onLog);
    await ff.writeFile("in.webm", await fetchFile(webm));
    await ff.exec([
      "-i", "in.webm",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "22",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "128k",
      "-movflags", "+faststart",
      "out.mp4",
    ]);
    const data = await ff.readFile("out.mp4");
    onProgress?.(100);
    return new Blob([data], { type: "video/mp4" });
  } catch (e) {
    console.warn("FFmpeg fallback a WebM:", e);
    onProgress?.(100);
    return webm;
  }
}

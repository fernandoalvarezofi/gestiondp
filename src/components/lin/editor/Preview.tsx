import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import type { Proyecto } from "@/lib/videoEditor/types";

export type PreviewHandle = {
  canvas: HTMLCanvasElement | null;
  play: () => Promise<void>;
  pause: () => void;
  seek: (t: number) => void;
  getTime: () => number;
};

type Props = {
  proyecto: Proyecto;
  currentTime: number;
  playing: boolean;
  onTimeChange: (t: number) => void;
  onEnded: () => void;
  duracion: number;
};

export const Preview = forwardRef<PreviewHandle, Props>(function Preview(
  { proyecto, currentTime, playing, onTimeChange, onEnded, duracion },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videosRef = useRef<Record<string, HTMLVideoElement>>({});
  const audiosRef = useRef<Record<string, HTMLAudioElement>>({});
  const imagesRef = useRef<Record<string, HTMLImageElement>>({});
  const rafRef = useRef<number>();
  const startWallRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  // Precarga de elementos multimedia
  const media = useMemo(() => {
    const list: { key: string; url: string; tipo: string }[] = [];
    for (const t of proyecto.timeline.tracks)
      for (const c of t.clips)
        if (c.assetUrl && c.assetTipo) list.push({ key: c.id, url: c.assetUrl, tipo: c.assetTipo });
    return list;
  }, [proyecto.timeline]);

  useEffect(() => {
    // Crear elementos faltantes
    for (const m of media) {
      if (m.tipo === "video" && !videosRef.current[m.key]) {
        const v = document.createElement("video");
        v.src = m.url; v.crossOrigin = "anonymous"; v.playsInline = true; v.muted = false; v.preload = "auto";
        videosRef.current[m.key] = v;
      } else if (m.tipo === "audio" && !audiosRef.current[m.key]) {
        const a = document.createElement("audio");
        a.src = m.url; a.crossOrigin = "anonymous"; a.preload = "auto";
        audiosRef.current[m.key] = a;
      } else if (m.tipo === "imagen" && !imagesRef.current[m.key]) {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.src = m.url;
        imagesRef.current[m.key] = i;
      }
    }
    // Limpieza de sobrantes
    const keys = new Set(media.map((m) => m.key));
    for (const k of Object.keys(videosRef.current)) if (!keys.has(k)) { videosRef.current[k].pause(); delete videosRef.current[k]; }
    for (const k of Object.keys(audiosRef.current)) if (!keys.has(k)) { audiosRef.current[k].pause(); delete audiosRef.current[k]; }
    for (const k of Object.keys(imagesRef.current)) if (!keys.has(k)) delete imagesRef.current[k];
  }, [media]);

  const drawFrame = (t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar tracks de video/imagen en orden inverso (primer track arriba)
    const tracks = [...proyecto.timeline.tracks].reverse();
    for (const track of tracks) {
      if (track.tipo === "audio") continue;
      for (const c of track.clips) {
        if (t < c.inicio || t >= c.inicio + c.duracion) continue;
        const localT = c.trimIn + (t - c.inicio);
        if (track.tipo === "video" && c.assetTipo === "video") {
          const v = videosRef.current[c.id];
          if (v && v.readyState >= 2) {
            drawCover(ctx, v, canvas.width, canvas.height);
          }
        } else if (track.tipo === "video" && c.assetTipo === "imagen") {
          const i = imagesRef.current[c.id];
          if (i && i.complete) drawCover(ctx, i, canvas.width, canvas.height);
        } else if (track.tipo === "texto") {
          const size = c.tamano || 64;
          ctx.font = `bold ${size}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const x = (c.x ?? 0.5) * canvas.width;
          const y = (c.y ?? 0.5) * canvas.height;
          if (c.fondo && c.fondo !== "none") {
            const m = ctx.measureText(c.texto || "");
            const padX = size * 0.4, padY = size * 0.25;
            ctx.fillStyle = c.fondo;
            ctx.fillRect(x - m.width / 2 - padX, y - size / 2 - padY, m.width + padX * 2, size + padY * 2);
          }
          ctx.fillStyle = c.color || "#fff";
          ctx.shadowColor = "rgba(0,0,0,.5)";
          ctx.shadowBlur = 8;
          ctx.fillText(c.texto || "", x, y);
          ctx.shadowBlur = 0;
        }
        void localT;
      }
    }
  };

  const syncMediaAt = (t: number, isPlaying: boolean) => {
    for (const track of proyecto.timeline.tracks) {
      for (const c of track.clips) {
        const inside = t >= c.inicio && t < c.inicio + c.duracion;
        const localT = c.trimIn + (t - c.inicio);
        if (c.assetTipo === "video") {
          const v = videosRef.current[c.id];
          if (!v) continue;
          if (inside) {
            if (Math.abs(v.currentTime - localT) > 0.25) v.currentTime = localT;
            v.muted = !!track.mute;
            if (isPlaying && v.paused) v.play().catch(() => {});
            if (!isPlaying && !v.paused) v.pause();
          } else if (!v.paused) v.pause();
        } else if (c.assetTipo === "audio") {
          const a = audiosRef.current[c.id];
          if (!a) continue;
          if (inside) {
            if (Math.abs(a.currentTime - localT) > 0.25) a.currentTime = localT;
            a.muted = !!track.mute;
            a.volume = c.volumen ?? 1;
            if (isPlaying && a.paused) a.play().catch(() => {});
            if (!isPlaying && !a.paused) a.pause();
          } else if (!a.paused) a.pause();
        }
      }
    }
  };

  // Loop de reproducción
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      syncMediaAt(currentTime, false);
      drawFrame(currentTime);
      return;
    }
    startWallRef.current = performance.now();
    startTimeRef.current = currentTime;
    const step = () => {
      const t = startTimeRef.current + (performance.now() - startWallRef.current) / 1000;
      if (t >= duracion) {
        onTimeChange(duracion);
        onEnded();
        return;
      }
      onTimeChange(t);
      syncMediaAt(t, true);
      drawFrame(t);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  // Redraw cuando cambian tiempo o timeline manualmente
  useEffect(() => {
    if (!playing) {
      syncMediaAt(currentTime, false);
      drawFrame(currentTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, proyecto.timeline]);

  useImperativeHandle(ref, () => ({
    canvas: canvasRef.current,
    async play() { /* handled by state */ },
    pause() { /* handled by state */ },
    seek(t: number) { onTimeChange(t); },
    getTime: () => currentTime,
  }), [currentTime, onTimeChange]);

  return (
    <div className="flex h-full items-center justify-center bg-black p-4">
      <canvas
        ref={canvasRef}
        width={proyecto.ancho}
        height={proyecto.alto}
        className="max-h-full max-w-full rounded-lg shadow-2xl"
        style={{ aspectRatio: `${proyecto.ancho}/${proyecto.alto}` }}
      />
    </div>
  );
});

function drawCover(ctx: CanvasRenderingContext2D, src: CanvasImageSource, w: number, h: number) {
  const sw = (src as any).videoWidth || (src as any).naturalWidth || w;
  const sh = (src as any).videoHeight || (src as any).naturalHeight || h;
  const sr = sw / sh, dr = w / h;
  let dw = w, dh = h, dx = 0, dy = 0;
  if (sr > dr) { dh = h; dw = h * sr; dx = (w - dw) / 2; }
  else { dw = w; dh = w / sr; dy = (h - dh) / 2; }
  ctx.drawImage(src, dx, dy, dw, dh);
}

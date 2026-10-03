import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { analyzeCanvas, PhotoQuality } from "@/lib/imageQuality";
import { cn } from "@/lib/utils";

type Props = {
  /** "documento": cámara trasera y marco de tarjeta. "rostro": cámara frontal y marco ovalado. */
  modo: "documento" | "rostro";
  titulo: string;
  consejo: string;
  onCapture: (file: File, quality: PhotoQuality) => void;
  onClose: () => void;
};

/** Cámara a pantalla completa con marco guía; controla la calidad de la foto antes de aceptarla. */
export function CameraCapture({ modo, titulo, consejo, onCapture, onClose }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [shot, setShot] = useState<{ url: string; file: File; quality: PhotoQuality } | null>(null);

  const stop = useCallback(() => { stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null; }, []);

  const start = useCallback(async () => {
    setError(null); setReady(false);
    if (!navigator.mediaDevices?.getUserMedia) { setError("Este navegador no permite usar la cámara. Probá desde el celular con Chrome o Safari."); return; }
    try {
      stop();
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: modo === "rostro" ? "user" : "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } } });
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play().catch(() => undefined); }
      setReady(true);
    } catch (cause) {
      const name = (cause as DOMException).name;
      setError(name === "NotAllowedError" ? "Bloqueaste el permiso de la cámara. Habilitalo desde el candado del navegador y volvé a intentar." : name === "NotFoundError" ? "No encontramos una cámara en este dispositivo." : "No pudimos abrir la cámara. Cerrá otras apps que la estén usando y reintentá.");
    }
  }, [modo, stop]);

  useEffect(() => { start(); return stop; }, [start, stop]);
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url); }, [shot]);

  const take = () => {
    const element = video.current;
    if (!element || !element.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    canvas.getContext("2d")?.drawImage(element, 0, 0, canvas.width, canvas.height);
    const quality = analyzeCanvas(canvas);
    canvas.toBlob((blob) => {
      if (!blob) return setError("No pudimos sacar la foto. Probá de nuevo.");
      const file = new File([blob], `${modo}.jpg`, { type: "image/jpeg" });
      setShot({ url: URL.createObjectURL(blob), file, quality });
    }, "image/jpeg", 0.9);
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="flex items-center gap-2 p-3">
        <button type="button" onClick={() => { stop(); onClose(); }} aria-label="Cerrar la cámara" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15"><X className="h-5 w-5" /></button>
        <p className="font-extrabold">{titulo}</p>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {error ? (
          <div className="max-w-sm px-6 text-center">
            <Camera className="mx-auto h-10 w-10 text-white/60" />
            <p className="mt-3 text-sm">{error}</p>
            <Button className="mt-4 rounded-full" onClick={start}>Reintentar</Button>
          </div>
        ) : shot ? (
          <img src={shot.url} alt="Foto sacada" className="max-h-full max-w-full object-contain" />
        ) : (
          <>
            <video ref={video} playsInline muted className={cn("h-full w-full object-cover", modo === "rostro" && "-scale-x-100")} />
            {!ready && <Loader2 className="absolute h-8 w-8 animate-spin" />}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className={cn("border-[3px] border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]", modo === "documento" ? "aspect-[1.586] w-[88%] max-w-xl rounded-2xl" : "h-[62%] aspect-[3/4] rounded-[50%]")} />
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {shot ? (
          <>
            {shot.quality.ok
              ? <p className="rounded-xl bg-success/20 p-3 text-center text-sm font-bold text-white">Se ve bien. ¿Usamos esta foto?</p>
              : <ul className="space-y-1 rounded-xl bg-destructive/30 p-3 text-sm font-semibold">{shot.quality.problems.map((problem) => <li key={problem}>• {problem}</li>)}</ul>}
            <div className="flex gap-2">
              <Button variant="secondary" className="h-12 flex-1 rounded-full font-bold" onClick={() => setShot(null)}><RotateCcw className="h-4 w-4" />Repetir</Button>
              <Button className="h-12 flex-1 rounded-full font-bold" disabled={!shot.quality.ok} onClick={() => { stop(); onCapture(shot.file, shot.quality); }}>Usar esta foto</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-center text-sm text-white/85">{consejo}</p>
            <div className="flex justify-center">
              <button type="button" onClick={take} disabled={!ready} aria-label="Sacar foto" className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 disabled:opacity-40"><span className="h-11 w-11 rounded-full bg-white" /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Send, X, Trash2, Play, Pause, Square } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onSend: (blob: Blob, duracionSeg: number) => void | Promise<void>;
  onCancel: () => void;
}

// Grabador con MediaRecorder: graba → previsualiza → envía o descarta.
export function AudioRecorder({ onSend, onCancel }: Props) {
  const [fase, setFase] = useState<"grabando" | "preview">("grabando");
  const [segs, setSegs] = useState(0);
  const [niveles, setNiveles] = useState<number[]>([]);
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const [progresoReproduccion, setProgresoReproduccion] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => { iniciar(); return () => detener(); }, []);
  useEffect(() => { return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }; }, [previewUrl]);

  const iniciar = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.start();

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setNiveles((n) => [...n.slice(-40), avg]);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();

      timerRef.current = window.setInterval(() => setSegs((s) => s + 1), 1000);
    } catch (e: any) {
      toast.error("No se pudo acceder al micrófono");
      onCancel();
    }
  };

  const detenerGrabacion = () => {
    const rec = recRef.current;
    if (!rec || rec.state === "inactive") return;
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: rec.mimeType });
      setPreviewBlob(blob);
      setPreviewUrl(URL.createObjectURL(blob));
      setFase("preview");
    };
    rec.stop();
    rec.stream.getTracks().forEach((t) => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close();
  };

  const detener = () => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close();
  };

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (reproduciendo) { a.pause(); setReproduciendo(false); }
    else { a.play(); setReproduciendo(true); }
  };

  const enviar = () => {
    if (!previewBlob) return;
    onSend(previewBlob, segs);
  };

  const descartar = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    onCancel();
  };

  const fmtSegs = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  if (fase === "grabando") {
    return (
      <div className="flex w-full items-center gap-2 rounded-full bg-secondary/60 px-2 py-1">
        <button onClick={() => { detener(); onCancel(); }} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary" aria-label="Cancelar">
          <X className="h-5 w-5" />
        </button>
        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
          <span className="text-xs font-medium tabular-nums">{fmtSegs(segs)}</span>
          <div className="flex flex-1 items-center gap-[2px] overflow-hidden">
            {niveles.slice(-30).map((n, i) => (
              <span key={i} className="w-[2px] rounded-full bg-primary/70" style={{ height: `${Math.max(4, (n / 255) * 24)}px` }} />
            ))}
          </div>
        </div>
        <button onClick={detenerGrabacion} disabled={segs < 1} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" aria-label="Detener y previsualizar" title="Detener">
          <Square className="h-4 w-4 fill-current" />
        </button>
      </div>
    );
  }

  // fase === "preview"
  return (
    <div className="flex w-full items-center gap-2 rounded-full bg-secondary/60 px-2 py-1">
      <button onClick={descartar} className="flex h-9 w-9 items-center justify-center rounded-full text-destructive hover:bg-destructive/10" aria-label="Descartar">
        <Trash2 className="h-4 w-4" />
      </button>
      <button onClick={togglePlay} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary" aria-label={reproduciendo ? "Pausar" : "Reproducir"}>
        {reproduciendo ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="flex flex-1 items-center gap-[2px] overflow-hidden">
        {niveles.slice(-30).map((n, i) => (
          <span
            key={i}
            className={`w-[2px] rounded-full ${(i / 30) <= progresoReproduccion ? "bg-primary" : "bg-primary/30"}`}
            style={{ height: `${Math.max(4, (n / 255) * 24)}px` }}
          />
        ))}
      </div>
      <span className="text-xs font-medium tabular-nums text-muted-foreground">{fmtSegs(segs)}</span>
      {previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          onEnded={() => { setReproduciendo(false); setProgresoReproduccion(0); }}
          onTimeUpdate={(e) => {
            const el = e.currentTarget;
            if (el.duration > 0) setProgresoReproduccion(el.currentTime / el.duration);
          }}
          className="hidden"
        />
      )}
      <button onClick={enviar} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label="Enviar audio">
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}

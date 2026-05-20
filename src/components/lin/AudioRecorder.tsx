import { useEffect, useRef, useState } from "react";
import { Mic, Send, X, Square } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onSend: (blob: Blob, duracionSeg: number) => void | Promise<void>;
  onCancel: () => void;
}

// Grabador con MediaRecorder. Muestra timer en vivo y waveform simple.
export function AudioRecorder({ onSend, onCancel }: Props) {
  const [grabando, setGrabando] = useState(false);
  const [segs, setSegs] = useState(0);
  const [niveles, setNiveles] = useState<number[]>([]);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => { iniciar(); return () => detener(false); }, []);

  const iniciar = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      recRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.start();
      setGrabando(true);

      // Visualización
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

      const t = setInterval(() => setSegs((s) => s + 1), 1000);
      (rec as any)._timer = t;
    } catch (e: any) {
      toast.error("No se pudo acceder al micrófono");
      onCancel();
    }
  };

  const detener = (enviar: boolean) => {
    const rec = recRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = () => {
        if (enviar) {
          const blob = new Blob(chunksRef.current, { type: rec.mimeType });
          onSend(blob, segs);
        }
      };
      rec.stop();
      rec.stream.getTracks().forEach((t) => t.stop());
    }
    if ((rec as any)?._timer) clearInterval((rec as any)._timer);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close();
    setGrabando(false);
  };

  return (
    <div className="flex w-full items-center gap-2 rounded-full bg-secondary/60 px-2 py-1">
      <button onClick={() => { detener(false); onCancel(); }} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary" aria-label="Cancelar">
        <X className="h-5 w-5" />
      </button>
      <div className="flex flex-1 items-center gap-2 overflow-hidden">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
        <span className="text-xs font-medium tabular-nums">
          {Math.floor(segs / 60).toString().padStart(2, "0")}:{(segs % 60).toString().padStart(2, "0")}
        </span>
        <div className="flex flex-1 items-center gap-[2px] overflow-hidden">
          {niveles.slice(-30).map((n, i) => (
            <span key={i} className="w-[2px] rounded-full bg-primary/70" style={{ height: `${Math.max(4, (n / 255) * 24)}px` }} />
          ))}
        </div>
      </div>
      <button onClick={() => detener(true)} disabled={!grabando || segs < 1} className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50" aria-label="Enviar">
        <Send className="h-4 w-4" />
      </button>
    </div>
  );
}

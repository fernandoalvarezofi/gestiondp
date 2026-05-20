import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

interface Props { url: string; duracion?: number; mio?: boolean; }

export function AudioPlayer({ url, duracion, mio }: Props) {
  const ref = useRef<HTMLAudioElement>(null);
  const [play, setPlay] = useState(false);
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(duracion || 0);

  useEffect(() => {
    const a = ref.current;
    if (!a) return;
    const onTime = () => setPos(a.currentTime);
    const onMeta = () => setDur(a.duration || duracion || 0);
    const onEnd = () => { setPlay(false); setPos(0); };
    a.addEventListener("timeupdate", onTime);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnd);
    return () => {
      a.removeEventListener("timeupdate", onTime);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnd);
    };
  }, [duracion]);

  const toggle = () => {
    const a = ref.current; if (!a) return;
    if (a.paused) { a.play(); setPlay(true); } else { a.pause(); setPlay(false); }
  };

  const pct = dur > 0 ? (pos / dur) * 100 : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className={`flex w-[220px] items-center gap-2.5 rounded-[20px] px-3 py-2 ${mio ? "bg-primary/90 text-primary-foreground" : "bg-secondary"}`}>
      <audio ref={ref} src={url} preload="metadata" />
      <button onClick={toggle} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${mio ? "bg-white/20" : "bg-primary text-primary-foreground"}`} aria-label={play ? "Pausar" : "Reproducir"}>
        {play ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
      <div className="flex flex-1 flex-col gap-1">
        <div className={`flex h-1 items-center overflow-hidden rounded-full ${mio ? "bg-white/20" : "bg-background"}`}>
          <span className={`h-full ${mio ? "bg-white" : "bg-primary"}`} style={{ width: `${pct}%` }} />
        </div>
        <span className={`text-[10px] tabular-nums ${mio ? "text-white/80" : "text-muted-foreground"}`}>{fmt(play ? pos : dur)}</span>
      </div>
    </div>
  );
}

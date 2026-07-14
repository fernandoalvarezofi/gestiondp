import { useRef, useState } from "react";
import type { Clip, Timeline as TL, Track, TrackTipo } from "@/lib/videoEditor/types";
import { nuevoId } from "@/lib/videoEditor/types";
import { Film, Music, Type, Trash2, Scissors, Plus, VolumeX, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PX_POR_SEG = 60;
const ALTO_TRACK = 56;

export function TimelinePanel({
  timeline,
  duracion,
  currentTime,
  selectedClipId,
  onSelectClip,
  onChange,
  onSeek,
  onDropAsset,
}: {
  timeline: TL;
  duracion: number;
  currentTime: number;
  selectedClipId: string | null;
  onSelectClip: (id: string | null) => void;
  onChange: (t: TL) => void;
  onSeek: (t: number) => void;
  onDropAsset: (assetId: string, inicio: number, trackId?: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<null | {
    clipId: string; mode: "mover" | "trim-l" | "trim-r"; startX: number; startClip: Clip;
  }>(null);

  const totalPx = Math.max(duracion, 30) * PX_POR_SEG + 200;

  const agregarTrack = (tipo: TrackTipo) => {
    const t: Track = { id: nuevoId(), tipo, nombre: tipo, clips: [] };
    onChange({ tracks: [...timeline.tracks, t] });
  };

  const eliminarTrack = (id: string) => {
    onChange({ tracks: timeline.tracks.filter((t) => t.id !== id) });
  };

  const toggleMute = (id: string) => {
    onChange({ tracks: timeline.tracks.map((t) => t.id === id ? { ...t, mute: !t.mute } : t) });
  };

  const eliminarClip = (id: string) => {
    onChange({
      tracks: timeline.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== id) })),
    });
    onSelectClip(null);
  };

  const partirClip = () => {
    if (!selectedClipId) return;
    onChange({
      tracks: timeline.tracks.map((t) => {
        const idx = t.clips.findIndex((c) => c.id === selectedClipId);
        if (idx < 0) return t;
        const c = t.clips[idx];
        if (currentTime <= c.inicio || currentTime >= c.inicio + c.duracion) return t;
        const off = currentTime - c.inicio;
        const c1: Clip = { ...c, duracion: off };
        const c2: Clip = { ...c, id: nuevoId(), inicio: c.inicio + off, duracion: c.duracion - off, trimIn: c.trimIn + off };
        return { ...t, clips: [...t.clips.slice(0, idx), c1, c2, ...t.clips.slice(idx + 1)] };
      }),
    });
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;
    const dx = (e.clientX - dragState.startX) / PX_POR_SEG;
    const c0 = dragState.startClip;
    onChange({
      tracks: timeline.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== dragState.clipId) return c;
          if (dragState.mode === "mover") return { ...c, inicio: Math.max(0, c0.inicio + dx) };
          if (dragState.mode === "trim-l") {
            const nuevo = Math.max(0, c0.inicio + dx);
            const delta = nuevo - c0.inicio;
            const nuevaDur = c0.duracion - delta;
            if (nuevaDur < 0.1) return c;
            return { ...c, inicio: nuevo, duracion: nuevaDur, trimIn: Math.max(0, c0.trimIn + delta) };
          }
          if (dragState.mode === "trim-r") {
            return { ...c, duracion: Math.max(0.1, c0.duracion + dx) };
          }
          return c;
        }),
      })),
    });
  };

  const onMouseUp = () => setDragState(null);

  const rulerClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft || 0);
    onSeek(Math.max(0, x / PX_POR_SEG));
  };

  return (
    <div
      className="flex h-full flex-col border-t bg-card"
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button size="sm" variant="outline" onClick={() => agregarTrack("video")}><Plus className="mr-1 h-3 w-3" />Video</Button>
        <Button size="sm" variant="outline" onClick={() => agregarTrack("audio")}><Plus className="mr-1 h-3 w-3" />Audio</Button>
        <Button size="sm" variant="outline" onClick={() => agregarTrack("texto")}><Plus className="mr-1 h-3 w-3" />Texto</Button>
        <div className="mx-2 h-4 w-px bg-border" />
        <Button size="sm" variant="ghost" onClick={partirClip} disabled={!selectedClipId}>
          <Scissors className="mr-1 h-3 w-3" />Partir
        </Button>
        <Button size="sm" variant="ghost" onClick={() => selectedClipId && eliminarClip(selectedClipId)} disabled={!selectedClipId}>
          <Trash2 className="mr-1 h-3 w-3" />Eliminar clip
        </Button>
        <div className="ml-auto text-xs tabular-nums text-muted-foreground">
          {fmt(currentTime)} / {fmt(duracion)}
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Columna de tracks */}
        <div className="w-40 shrink-0 border-r">
          <div className="h-6 border-b bg-muted/50" />
          {timeline.tracks.map((t) => (
            <div key={t.id} className="flex items-center gap-1 border-b px-2" style={{ height: ALTO_TRACK }}>
              {t.tipo === "video" && <Film className="h-3 w-3" />}
              {t.tipo === "audio" && <Music className="h-3 w-3" />}
              {t.tipo === "texto" && <Type className="h-3 w-3" />}
              <span className="flex-1 truncate text-xs">{t.nombre}</span>
              {t.tipo !== "texto" && (
                <button onClick={() => toggleMute(t.id)} className="text-muted-foreground hover:text-foreground">
                  {t.mute ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
                </button>
              )}
              <button onClick={() => eliminarTrack(t.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {timeline.tracks.length === 0 && (
            <div className="p-3 text-center text-[10px] text-muted-foreground">
              Agregá una pista arriba
            </div>
          )}
        </div>

        {/* Área con clips */}
        <div ref={scrollRef} className="relative flex-1 overflow-auto">
          <div style={{ width: totalPx }}>
            {/* regla */}
            <div className="sticky top-0 z-10 h-6 border-b bg-muted/50" onClick={rulerClick}>
              {Array.from({ length: Math.ceil(totalPx / PX_POR_SEG) }).map((_, i) => (
                <div key={i} className="absolute h-full border-l text-[9px] text-muted-foreground" style={{ left: i * PX_POR_SEG }}>
                  <span className="pl-1">{i}s</span>
                </div>
              ))}
            </div>
            {/* tracks */}
            {timeline.tracks.map((t) => (
              <div
                key={t.id}
                className="relative border-b"
                style={{ height: ALTO_TRACK }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData("application/x-asset");
                  if (!id) return;
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  onDropAsset(id, Math.max(0, x / PX_POR_SEG), t.id);
                }}
              >
                {t.clips.map((c) => (
                  <div
                    key={c.id}
                    onMouseDown={(e) => {
                      onSelectClip(c.id);
                      setDragState({ clipId: c.id, mode: "mover", startX: e.clientX, startClip: c });
                    }}
                    className={cn(
                      "absolute top-1 flex items-center overflow-hidden rounded-md border text-[10px] text-white",
                      t.tipo === "video" && "bg-blue-600 border-blue-400",
                      t.tipo === "audio" && "bg-emerald-600 border-emerald-400",
                      t.tipo === "texto" && "bg-orange-500 border-orange-300",
                      selectedClipId === c.id && "ring-2 ring-yellow-400"
                    )}
                    style={{ left: c.inicio * PX_POR_SEG, width: c.duracion * PX_POR_SEG, height: ALTO_TRACK - 8 }}
                  >
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDragState({ clipId: c.id, mode: "trim-l", startX: e.clientX, startClip: c });
                      }}
                      className="h-full w-1.5 cursor-ew-resize bg-white/40"
                    />
                    <div className="flex-1 truncate px-2">
                      {t.tipo === "texto" ? (c.texto || "Texto") : (c.assetTipo || "clip")}
                    </div>
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDragState({ clipId: c.id, mode: "trim-r", startX: e.clientX, startClip: c });
                      }}
                      className="h-full w-1.5 cursor-ew-resize bg-white/40"
                    />
                  </div>
                ))}
              </div>
            ))}
            {/* playhead */}
            <div
              className="pointer-events-none absolute top-0 z-20 h-full w-px bg-red-500"
              style={{ left: currentTime * PX_POR_SEG }}
            >
              <div className="absolute -left-1.5 top-0 h-3 w-3 rotate-45 bg-red-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return `${m}:${sec.toString().padStart(2, "0")}.${ms}`;
}

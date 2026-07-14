import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Play, Pause, Save, Download, Loader2, Type as TypeIcon } from "lucide-react";
import { toast } from "sonner";
import { MediaPanel } from "@/components/lin/editor/MediaPanel";
import { Preview, type PreviewHandle } from "@/components/lin/editor/Preview";
import { TimelinePanel } from "@/components/lin/editor/Timeline";
import type { Asset, Clip, Proyecto, Timeline, Track } from "@/lib/videoEditor/types";
import { computarDuracion, nuevoId } from "@/lib/videoEditor/types";
import { exportarTimeline } from "@/lib/videoEditor/ffmpegExport";

const ASPECT_MAP: Record<string, { w: number; h: number }> = {
  "16:9": { w: 1920, h: 1080 },
  "9:16": { w: 1080, h: 1920 },
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
};

export default function EditorProyecto() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const previewRef = useRef<PreviewHandle>(null);

  const [proyecto, setProyecto] = useState<Proyecto | null>(null);
  const [assets, setAssets] = useState<Record<string, Asset>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data: p } = await (supabase as any).from("video_proyectos").select("*").eq("id", id).single();
      if (!p) { toast.error("Proyecto no encontrado"); nav("/lin/editor"); return; }
      const { data: a } = await (supabase as any).from("video_assets").select("*").eq("proyecto_id", id);
      const assetMap: Record<string, Asset> = {};
      for (const x of a || []) assetMap[x.id] = { ...x } as Asset;
      // Renueva URLs firmadas
      for (const x of Object.values(assetMap)) {
        const { data: s } = await supabase.storage.from("video-editor").createSignedUrl(x.storage_path, 60 * 60 * 24);
        if (s?.signedUrl) x.url = s.signedUrl;
      }
      setAssets(assetMap);
      // Rellenar assetUrl en clips
      const tl: Timeline = p.timeline || { tracks: [] };
      for (const t of tl.tracks) for (const c of t.clips) {
        if (c.assetId && assetMap[c.assetId]) {
          c.assetUrl = assetMap[c.assetId].url;
          c.assetTipo = assetMap[c.assetId].tipo;
        }
      }
      setProyecto({
        id: p.id, nombre: p.nombre, aspect_ratio: p.aspect_ratio, fps: p.fps,
        ancho: p.ancho, alto: p.alto, duracion_s: p.duracion_s, timeline: tl,
        thumbnail_url: p.thumbnail_url,
      });
      setLoading(false);
    })();
  }, [id, user, nav]);

  const duracion = useMemo(() => proyecto ? Math.max(1, computarDuracion(proyecto.timeline)) : 0, [proyecto]);

  const setTimeline = (t: Timeline) => setProyecto((p) => p ? { ...p, timeline: t } : p);

  const agregarAssetATimeline = (a: Asset, inicio?: number, trackId?: string) => {
    setProyecto((p) => {
      if (!p) return p;
      let tracks = [...p.timeline.tracks];
      const targetTipo = a.tipo === "audio" ? "audio" : "video";
      let track = trackId ? tracks.find((t) => t.id === trackId) : tracks.find((t) => t.tipo === targetTipo);
      if (!track) {
        track = { id: nuevoId(), tipo: targetTipo, nombre: targetTipo, clips: [] };
        tracks.push(track);
      }
      const dur = a.duracion_s ?? (a.tipo === "imagen" ? 3 : 5);
      const clip: Clip = {
        id: nuevoId(), assetId: a.id, assetUrl: a.url, assetTipo: a.tipo,
        inicio: inicio ?? currentTime, duracion: dur, trimIn: 0, volumen: 1,
      };
      const newTracks = tracks.map((t) => t.id === track!.id ? { ...t, clips: [...t.clips, clip] } : t);
      return { ...p, timeline: { tracks: newTracks } };
    });
  };

  const agregarTexto = () => {
    setProyecto((p) => {
      if (!p) return p;
      let tracks = [...p.timeline.tracks];
      let track = tracks.find((t) => t.tipo === "texto");
      if (!track) {
        track = { id: nuevoId(), tipo: "texto", nombre: "texto", clips: [] };
        tracks.push(track);
      }
      const clip: Clip = {
        id: nuevoId(), inicio: currentTime, duracion: 3, trimIn: 0,
        texto: "Tu texto acá", color: "#ffffff", tamano: 96, x: 0.5, y: 0.5, fondo: "none",
      };
      const newTracks = tracks.map((t) => t.id === track!.id ? { ...t, clips: [...t.clips, clip] } : t);
      setSelectedClipId(clip.id);
      return { ...p, timeline: { tracks: newTracks } };
    });
  };

  const onDropAsset = (assetId: string, inicio: number, trackId?: string) => {
    const a = assets[assetId];
    if (!a) return;
    agregarAssetATimeline(a, inicio, trackId);
  };

  const guardar = async () => {
    if (!proyecto || !id) return;
    setSaving(true);
    // Limpiamos assetUrl para no persistirla (se regenera al abrir)
    const clean = {
      tracks: proyecto.timeline.tracks.map((t) => ({
        ...t,
        clips: t.clips.map(({ assetUrl, ...rest }) => rest),
      })),
    };
    const { error } = await (supabase as any).from("video_proyectos").update({
      nombre: proyecto.nombre,
      aspect_ratio: proyecto.aspect_ratio,
      fps: proyecto.fps,
      ancho: proyecto.ancho,
      alto: proyecto.alto,
      duracion_s: duracion,
      timeline: clean,
    }).eq("id", id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Guardado");
  };

  const cambiarAspecto = (v: string) => {
    const dim = ASPECT_MAP[v];
    if (!dim) return;
    setProyecto((p) => p ? { ...p, aspect_ratio: v, ancho: dim.w, alto: dim.h } : p);
  };

  const selectedClip = useMemo(() => {
    if (!proyecto || !selectedClipId) return null;
    for (const t of proyecto.timeline.tracks)
      for (const c of t.clips) if (c.id === selectedClipId) return c;
    return null;
  }, [proyecto, selectedClipId]);

  const updateClip = (patch: Partial<Clip>) => {
    if (!selectedClipId) return;
    setProyecto((p) => {
      if (!p) return p;
      return {
        ...p, timeline: {
          tracks: p.timeline.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => c.id === selectedClipId ? { ...c, ...patch } : c),
          })),
        },
      };
    });
  };

  const exportar = async () => {
    if (!proyecto || !previewRef.current?.canvas) return;
    setExporting(true);
    setExportProgress(0);
    try {
      const canvas = previewRef.current.canvas;
      setCurrentTime(0);
      await new Promise((r) => setTimeout(r, 200));
      const blob = await exportarTimeline({
        proyecto, canvas, duracion,
        onProgress: setExportProgress,
        playFn: async () => { setCurrentTime(0); setPlaying(true); },
        stopFn: () => setPlaying(false),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proyecto.nombre.replace(/[^\w-]+/g, "_")}.${blob.type.includes("mp4") ? "mp4" : "webm"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportado");
    } catch (e: any) {
      toast.error(e.message || "Error al exportar");
    } finally {
      setExporting(false);
      setExportOpen(false);
    }
  };

  if (loading || !proyecto) {
    return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => nav("/lin/editor")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={proyecto.nombre}
          onChange={(e) => setProyecto((p) => p ? { ...p, nombre: e.target.value } : p)}
          className="h-8 max-w-xs"
        />
        <Select value={proyecto.aspect_ratio} onValueChange={cambiarAspecto}>
          <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="16:9">16:9</SelectItem>
            <SelectItem value="9:16">9:16</SelectItem>
            <SelectItem value="1:1">1:1</SelectItem>
            <SelectItem value="4:5">4:5</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={agregarTexto}><TypeIcon className="mr-1 h-3.5 w-3.5" />Texto</Button>
          <Button variant="outline" size="sm" onClick={guardar} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-1">Guardar</span>
          </Button>
          <Button size="sm" onClick={() => setExportOpen(true)}>
            <Download className="mr-1 h-4 w-4" />Exportar
          </Button>
        </div>
      </div>

      {/* Cuerpo */}
      <div className="flex min-h-0 flex-1">
        <div className="w-64 shrink-0">
          <MediaPanel proyectoId={proyecto.id} onAdd={(a) => {
            setAssets((prev) => ({ ...prev, [a.id]: a }));
            agregarAssetATimeline(a);
          }} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative flex-1 min-h-0">
            <Preview
              ref={previewRef}
              proyecto={proyecto}
              currentTime={currentTime}
              playing={playing}
              duracion={duracion}
              onTimeChange={setCurrentTime}
              onEnded={() => setPlaying(false)}
            />
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full border bg-card/90 px-3 py-1.5 backdrop-blur">
              <button onClick={() => { setCurrentTime(0); }} className="text-xs">⏮</button>
              <Button size="sm" onClick={() => setPlaying((v) => !v)} className="h-8 w-8 p-0 rounded-full">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              <span className="text-[11px] tabular-nums">{currentTime.toFixed(1)}s</span>
            </div>
          </div>

          {selectedClip && (
            <ClipInspector clip={selectedClip} onChange={updateClip} />
          )}

          <div className="h-72 shrink-0">
            <TimelinePanel
              timeline={proyecto.timeline}
              duracion={duracion}
              currentTime={currentTime}
              selectedClipId={selectedClipId}
              onSelectClip={setSelectedClipId}
              onChange={(t) => setTimeline(t)}
              onSeek={(t) => { setPlaying(false); setCurrentTime(t); }}
              onDropAsset={onDropAsset}
            />
          </div>
        </div>
      </div>

      {/* Export dialog */}
      <Dialog open={exportOpen} onOpenChange={(o) => !exporting && setExportOpen(o)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Exportar video</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p>Se va a reproducir la timeline y grabar el resultado. No cambies de pestaña.</p>
            <p className="text-muted-foreground">
              Duración: {duracion.toFixed(1)}s · {proyecto.ancho}×{proyecto.alto} · {proyecto.fps}fps
            </p>
            {exporting && <Progress value={exportProgress} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)} disabled={exporting}>Cancelar</Button>
            <Button onClick={exportar} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Exportar MP4"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClipInspector({ clip, onChange }: { clip: Clip; onChange: (p: Partial<Clip>) => void }) {
  const esTexto = clip.texto !== undefined;
  return (
    <div className="border-t bg-muted/30 p-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {esTexto ? (
          <>
            <div className="flex items-center gap-1">
              <Label className="text-[10px]">Texto</Label>
              <Input value={clip.texto || ""} onChange={(e) => onChange({ texto: e.target.value })} className="h-7 w-48" />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-[10px]">Color</Label>
              <input type="color" value={clip.color || "#ffffff"} onChange={(e) => onChange({ color: e.target.value })} />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-[10px]">Tamaño</Label>
              <Input type="number" value={clip.tamano || 64} onChange={(e) => onChange({ tamano: Number(e.target.value) })} className="h-7 w-16" />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-[10px]">X</Label>
              <Input type="number" step="0.05" value={clip.x ?? 0.5} onChange={(e) => onChange({ x: Number(e.target.value) })} className="h-7 w-16" />
              <Label className="text-[10px]">Y</Label>
              <Input type="number" step="0.05" value={clip.y ?? 0.5} onChange={(e) => onChange({ y: Number(e.target.value) })} className="h-7 w-16" />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1">
              <Label className="text-[10px]">Volumen</Label>
              <input type="range" min={0} max={1} step={0.05} value={clip.volumen ?? 1}
                onChange={(e) => onChange({ volumen: Number(e.target.value) })} />
            </div>
            <div className="text-[10px] text-muted-foreground">
              Inicio {clip.inicio.toFixed(2)}s · dur {clip.duracion.toFixed(2)}s · trim {clip.trimIn.toFixed(2)}s
            </div>
          </>
        )}
      </div>
    </div>
  );
}

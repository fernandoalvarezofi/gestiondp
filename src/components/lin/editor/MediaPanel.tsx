import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Upload, Film, Music, Image as ImgIcon, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Asset } from "@/lib/videoEditor/types";

async function probeMedia(file: File): Promise<{ duracion?: number; ancho?: number; alto?: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => {
        resolve({ duracion: v.duration, ancho: v.videoWidth, alto: v.videoHeight });
        URL.revokeObjectURL(url);
      };
      v.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
      v.src = url;
    } else if (file.type.startsWith("audio/")) {
      const a = document.createElement("audio");
      a.preload = "metadata";
      a.onloadedmetadata = () => { resolve({ duracion: a.duration }); URL.revokeObjectURL(url); };
      a.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
      a.src = url;
    } else if (file.type.startsWith("image/")) {
      const i = new Image();
      i.onload = () => { resolve({ ancho: i.width, alto: i.height }); URL.revokeObjectURL(url); };
      i.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
      i.src = url;
    } else resolve({});
  });
}

export function MediaPanel({
  proyectoId,
  onAdd,
}: {
  proyectoId: string;
  onAdd: (a: Asset) => void;
}) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const cargar = async () => {
    const { data } = await (supabase as any)
      .from("video_assets")
      .select("*")
      .eq("proyecto_id", proyectoId)
      .order("created_at", { ascending: false });
    setAssets((data || []).map(mapAsset));
  };

  useEffect(() => { cargar(); }, [proyectoId]);

  const subir = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const tipo: Asset["tipo"] = file.type.startsWith("video/") ? "video"
        : file.type.startsWith("audio/") ? "audio" : "imagen";
      const meta = await probeMedia(file);
      const path = `${user.id}/${proyectoId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from("video-editor").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data: signed } = await supabase.storage.from("video-editor").createSignedUrl(path, 60 * 60 * 24 * 7);
      const url = signed?.signedUrl || "";
      const { data: row, error: e2 } = await (supabase as any).from("video_assets").insert({
        perfil_id: user.id,
        proyecto_id: proyectoId,
        nombre: file.name,
        tipo,
        storage_path: path,
        url,
        duracion_s: meta.duracion ?? null,
        ancho: meta.ancho ?? null,
        alto: meta.alto ?? null,
        tamano_bytes: file.size,
        mime: file.type,
      }).select().single();
      if (e2) throw e2;
      const a = mapAsset(row);
      setAssets((prev) => [a, ...prev]);
      toast.success("Media importada");
    } catch (e: any) {
      toast.error(e.message || "Error al subir");
    } finally {
      setUploading(false);
    }
  };

  const eliminar = async (a: Asset) => {
    await supabase.storage.from("video-editor").remove([a.storage_path]);
    await (supabase as any).from("video_assets").delete().eq("id", a.id);
    setAssets((p) => p.filter((x) => x.id !== a.id));
  };

  return (
    <div className="flex h-full flex-col border-r bg-card">
      <div className="border-b p-3">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">Media</h3>
        <input
          ref={fileRef}
          type="file"
          accept="video/*,audio/*,image/*"
          className="hidden"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            files.forEach(subir);
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
        <Button
          size="sm"
          className="w-full"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span className="ml-2">Importar</span>
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-2">
        {assets.length === 0 && (
          <p className="p-4 text-center text-xs text-muted-foreground">
            Subí videos, audios o imágenes.
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {assets.map((a) => (
            <div
              key={a.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("application/x-asset", a.id);
                e.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onAdd(a)}
              className="group relative aspect-video cursor-grab overflow-hidden rounded-md border bg-muted active:cursor-grabbing"
              title={a.nombre}
            >
              {a.tipo === "video" && (
                <video src={a.url} className="h-full w-full object-cover" muted preload="metadata" />
              )}
              {a.tipo === "imagen" && (
                <img src={a.url} className="h-full w-full object-cover" alt={a.nombre} />
              )}
              {a.tipo === "audio" && (
                <div className="flex h-full w-full items-center justify-center">
                  <Music className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {a.tipo === "video" ? <Film className="mr-1 inline h-3 w-3" /> :
                 a.tipo === "audio" ? <Music className="mr-1 inline h-3 w-3" /> :
                 <ImgIcon className="mr-1 inline h-3 w-3" />}
                {a.nombre}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); eliminar(a); }}
                className="absolute right-1 top-1 hidden rounded bg-black/60 p-1 text-white group-hover:block"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function mapAsset(r: any): Asset {
  return {
    id: r.id, nombre: r.nombre, tipo: r.tipo, url: r.url,
    storage_path: r.storage_path, duracion_s: r.duracion_s,
    ancho: r.ancho, alto: r.alto, mime: r.mime,
  };
}

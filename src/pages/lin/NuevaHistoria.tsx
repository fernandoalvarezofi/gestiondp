import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, ImagePlus, Loader2, Type } from "lucide-react";
import { toast } from "sonner";
import { BackHeader } from "@/components/lin/BackHeader";

const COLORES = [
  "linear-gradient(135deg,#FD5F35,#FF8A65)",
  "linear-gradient(135deg,#7C3AED,#EC4899)",
  "linear-gradient(135deg,#0EA5E9,#22D3EE)",
  "linear-gradient(135deg,#10B981,#34D399)",
  "linear-gradient(135deg,#1F2937,#374151)",
];

export default function NuevaHistoria() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"foto" | "video">("foto");
  const [texto, setTexto] = useState("");
  const [colorIdx, setColorIdx] = useState(0);
  const [modo, setModo] = useState<"media" | "texto">("media");
  const [subiendo, setSubiendo] = useState(false);

  const pick = (f: File) => {
    const esVideo = f.type.startsWith("video/");
    setTipo(esVideo ? "video" : "foto");
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setModo("media");
  };

  const publicar = async () => {
    if (!user) return;
    if (modo === "media" && !file) return toast.error("Elegí una foto o video");
    if (modo === "texto" && !texto.trim()) return toast.error("Escribí algo");
    setSubiendo(true);
    try {
      let media_url = "";
      let tipoFinal: "foto" | "video" = "foto";
      if (modo === "media" && file) {
        const ext = file.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await (supabase as any).storage.from("historias").upload(path, file);
        if (upErr) throw upErr;
        const { data: pub } = (supabase as any).storage.from("historias").getPublicUrl(path);
        media_url = pub.publicUrl;
        tipoFinal = tipo;
      } else {
        // historia tipo texto: guardamos un placeholder pixel y usamos color_fondo
        media_url = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxIiBoZWlnaHQ9IjEiLz4=";
      }
      const { error } = await (supabase as any).from("historias").insert({
        perfil_id: user.id,
        tipo: tipoFinal,
        media_url,
        texto: texto.trim() || null,
        color_fondo: modo === "texto" ? COLORES[colorIdx] : null,
      });
      if (error) throw error;
      toast.success("Historia publicada");
      navigate("/lin");
    } catch (e: any) {
      toast.error(e.message || "Error al publicar");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <>
      <BackHeader title="Nueva historia" />
      <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar">
          <X className="h-5 w-5" />
        </button>
        <div className="flex gap-1 rounded-full bg-white/10 p-1 text-xs">
          <button onClick={() => setModo("media")} className={`rounded-full px-3 py-1 ${modo === "media" ? "bg-white text-black" : ""}`}>Media</button>
          <button onClick={() => setModo("texto")} className={`rounded-full px-3 py-1 ${modo === "texto" ? "bg-white text-black" : ""}`}>Texto</button>
        </div>
        <Button
          onClick={publicar}
          disabled={subiendo || (modo === "media" && !file) || (modo === "texto" && !texto.trim())}
          size="sm"
          className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {subiendo ? <Loader2 className="h-4 w-4 animate-spin" /> : "Compartir"}
        </Button>
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        {modo === "media" ? (
          preview ? (
            <div className="relative h-full max-h-[70vh] w-full max-w-md overflow-hidden rounded-2xl bg-neutral-900">
              {tipo === "video"
                ? <video src={preview} className="h-full w-full object-contain" controls />
                : <img src={preview} className="h-full w-full object-contain" />}
              {texto && (
                <div className="absolute inset-x-4 bottom-8 rounded-xl bg-black/40 p-3 text-center text-lg font-semibold backdrop-blur-sm">
                  {texto}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="flex h-72 w-72 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/30 hover:border-white"
            >
              <ImagePlus className="h-12 w-12" />
              <span className="text-sm">Tocá para elegir foto o video</span>
            </button>
          )
        ) : (
          <div
            className="flex h-[70vh] w-full max-w-md items-center justify-center rounded-2xl p-8"
            style={{ background: COLORES[colorIdx] }}
          >
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Escribí algo…"
              maxLength={200}
              className="w-full resize-none border-0 bg-transparent text-center text-2xl font-bold leading-tight text-white placeholder-white/60 outline-none"
              rows={6}
              autoFocus
            />
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 py-3">
        {modo === "media" && preview && (
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Agregar texto…"
            maxLength={120}
            className="border-white/20 bg-white/10 text-white placeholder:text-white/50"
          />
        )}
        {modo === "texto" && (
          <div className="flex justify-center gap-2">
            {COLORES.map((c, i) => (
              <button
                key={i}
                onClick={() => setColorIdx(i)}
                className={`h-8 w-8 rounded-full ring-2 transition-all ${colorIdx === i ? "ring-white scale-110" : "ring-transparent"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}
        {modo === "media" && (
          <div className="flex justify-center gap-2">
            <Button onClick={() => fileRef.current?.click()} variant="ghost" size="sm" className="rounded-full text-white hover:bg-white/10">
              <ImagePlus className="h-4 w-4" /> {preview ? "Cambiar" : "Elegir media"}
            </Button>
            {preview && <Button onClick={() => { setPreview(null); setFile(null); }} variant="ghost" size="sm" className="rounded-full text-white hover:bg-white/10">Quitar</Button>}
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && pick(e.target.files[0])}
        />
      </div>
    </div>
    </>
  );
}

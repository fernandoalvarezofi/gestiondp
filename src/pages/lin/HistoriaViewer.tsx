import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { X, ChevronLeft, ChevronRight, Heart, Send, Eye, Trash2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";

const DURACION_FOTO = 5000;

export default function HistoriaViewer() {
  const { perfilId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [historias, setHistorias] = useState<any[]>([]);
  const [perfil, setPerfil] = useState<any>(null);
  const [idx, setIdx] = useState(0);
  const [progreso, setProgreso] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [respuesta, setRespuesta] = useState("");
  const [verVistas, setVerVistas] = useState(false);
  const [vistas, setVistas] = useState<any[]>([]);
  const [videoDur, setVideoDur] = useState(DURACION_FOTO);
  const timerRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!perfilId) return;
    (async () => {
      const { data: p } = await (supabase as any).from("perfiles").select("id,nombre,username,avatar_url").eq("id", perfilId).single();
      setPerfil(p);
      const { data: h } = await (supabase as any).from("historias")
        .select("*").eq("perfil_id", perfilId)
        .gt("expira_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      setHistorias(h || []);
      if (!h?.length) navigate(-1);
    })();
  }, [perfilId]);

  const actual = historias[idx];
  const esMia = user?.id === perfilId;

  // Registrar vista
  useEffect(() => {
    if (!actual || !user || esMia) return;
    (supabase as any).from("historia_vistas")
      .upsert({ historia_id: actual.id, perfil_id: user.id }, { onConflict: "historia_id,perfil_id", ignoreDuplicates: true });
  }, [actual?.id, user, esMia]);

  // Progreso
  useEffect(() => {
    if (!actual || pausado || verVistas) return;
    const duracion = actual.tipo === "video" ? videoDur : DURACION_FOTO;
    setProgreso(0);
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(100, (elapsed / duracion) * 100);
      setProgreso(pct);
      if (pct >= 100) avanzar();
      else timerRef.current = window.setTimeout(tick, 50);
    };
    timerRef.current = window.setTimeout(tick, 50);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [actual?.id, pausado, verVistas, videoDur]);

  const avanzar = () => {
    if (idx < historias.length - 1) setIdx(idx + 1);
    else navigate(-1);
  };
  const retroceder = () => { if (idx > 0) setIdx(idx - 1); else setProgreso(0); };

  const cargarVistas = async () => {
    if (!actual) return;
    const { data } = await (supabase as any).from("historia_vistas")
      .select("*, perfil:perfiles!perfil_id(id,nombre,username,avatar_url)")
      .eq("historia_id", actual.id).order("created_at", { ascending: false });
    setVistas(data || []);
    setVerVistas(true);
  };

  const responder = async () => {
    if (!respuesta.trim() || !user || !actual || esMia) return;
    const { data: conv } = await (supabase as any).rpc("get_or_create_conversacion", { user_a: user.id, user_b: actual.perfil_id });
    await (supabase as any).from("mensajes").insert({
      conversacion_id: conv,
      remitente_id: user.id,
      contenido: `↪️ Respondió a tu historia: ${respuesta}`,
    });
    setRespuesta("");
    toast.success("Respuesta enviada");
  };

  const borrar = async () => {
    if (!actual || !esMia) return;
    await (supabase as any).from("historias").delete().eq("id", actual.id);
    toast.success("Historia eliminada");
    if (historias.length === 1) navigate(-1);
    else {
      setHistorias(historias.filter((_, i) => i !== idx));
      if (idx >= historias.length - 1) setIdx(Math.max(0, idx - 1));
    }
  };

  if (!actual || !perfil) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black"><Loader2 className="h-6 w-6 animate-spin text-white" /></div>;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Barras de progreso */}
      <div className="flex gap-1 px-3 pt-3">
        {historias.map((_, i) => (
          <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
            <div className="h-full bg-white transition-all" style={{ width: `${i < idx ? 100 : i === idx ? progreso : 0}%` }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar className="h-9 w-9 ring-2 ring-white/30">
          <AvatarImage src={perfil.avatar_url || ""} className="object-cover" />
          <AvatarFallback>{initials(perfil.nombre)}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm font-semibold leading-tight">{perfil.nombre}</p>
          <p className="text-[11px] text-white/70">{formatTime(actual.created_at)}</p>
        </div>
        {esMia && (
          <button onClick={borrar} className="rounded-full p-2 hover:bg-white/10" aria-label="Borrar">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-white/10" aria-label="Cerrar">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Contenido */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        onPointerDown={() => setPausado(true)}
        onPointerUp={() => setPausado(false)}
        onPointerLeave={() => setPausado(false)}
      >
        {actual.color_fondo ? (
          <div className="flex h-full w-full items-center justify-center p-8" style={{ background: actual.color_fondo }}>
            <p className="text-center text-3xl font-bold leading-tight">{actual.texto}</p>
          </div>
        ) : actual.tipo === "video" ? (
          <video
            src={actual.media_url}
            className="max-h-full max-w-full object-contain"
            autoPlay
            playsInline
            onLoadedMetadata={(e) => setVideoDur(Math.min((e.currentTarget.duration || 5) * 1000, 30000))}
            muted={false}
          />
        ) : (
          <img src={actual.media_url} className="max-h-full max-w-full object-contain" alt="" />
        )}

        {actual.texto && !actual.color_fondo && (
          <div className="absolute inset-x-6 bottom-20 rounded-xl bg-black/40 p-3 text-center text-lg font-semibold backdrop-blur-sm">
            {actual.texto}
          </div>
        )}

        {/* Zonas de navegación */}
        <button onClick={retroceder} className="absolute inset-y-0 left-0 w-1/3" aria-label="Anterior">
          <ChevronLeft className="absolute left-2 top-1/2 h-6 w-6 -translate-y-1/2 opacity-0 hover:opacity-60" />
        </button>
        <button onClick={avanzar} className="absolute inset-y-0 right-0 w-1/3" aria-label="Siguiente">
          <ChevronRight className="absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2 opacity-0 hover:opacity-60" />
        </button>
      </div>

      {/* Footer */}
      <div className="px-4 py-3">
        {esMia ? (
          <button onClick={cargarVistas} className="flex w-full items-center justify-center gap-2 rounded-full bg-white/10 py-2 text-sm hover:bg-white/20">
            <Eye className="h-4 w-4" />
            {actual.total_vistas} vista{actual.total_vistas === 1 ? "" : "s"}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={respuesta}
              onChange={(e) => setRespuesta(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && responder()}
              placeholder={`Responder a ${perfil.nombre.split(" ")[0]}…`}
              className="rounded-full border-white/30 bg-transparent text-white placeholder:text-white/60"
            />
            <button onClick={() => toast.success("❤️")} className="rounded-full p-2 hover:bg-white/10"><Heart className="h-5 w-5" /></button>
            <button onClick={responder} disabled={!respuesta.trim()} className="rounded-full p-2 hover:bg-white/10 disabled:opacity-40"><Send className="h-5 w-5" /></button>
          </div>
        )}
      </div>

      {/* Drawer vistas */}
      {verVistas && (
        <div className="absolute inset-x-0 bottom-0 z-10 max-h-[60vh] overflow-y-auto rounded-t-3xl bg-background p-4 text-foreground">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">Vistas ({vistas.length})</h3>
            <button onClick={() => setVerVistas(false)} className="rounded-full p-1.5 hover:bg-secondary"><X className="h-4 w-4" /></button>
          </div>
          {vistas.length === 0 ? <p className="text-sm text-muted-foreground">Nadie vio esta historia todavía.</p>
            : vistas.map((v) => (
              <div key={v.id} className="flex items-center gap-3 py-2">
                <Avatar className="h-9 w-9"><AvatarImage src={v.perfil?.avatar_url || ""} /><AvatarFallback>{initials(v.perfil?.nombre)}</AvatarFallback></Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium">{v.perfil?.nombre}</p>
                  <p className="text-xs text-muted-foreground">@{v.perfil?.username}</p>
                </div>
                <span className="text-xs text-muted-foreground">{formatTime(v.created_at)}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

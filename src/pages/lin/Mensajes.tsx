import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  Send, ArrowLeft, Phone, Video, Info, Pencil, ImageIcon, Loader2, X,
  Mic, Smile, Reply, Heart, Check, CheckCheck, Trash2,
} from "lucide-react";
import { initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { AudioRecorder } from "@/components/lin/AudioRecorder";
import { AudioPlayer } from "@/components/lin/AudioPlayer";
import { useCallCtx } from "@/contexts/CallContext";
import { usePresenciaDe } from "@/hooks/usePresencia";
import { cn } from "@/lib/utils";

const EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

export default function Mensajes() {
  const { user } = useAuth();
  const { id: convId } = useParams();
  const navigate = useNavigate();
  const { iniciarLlamada } = useCallCtx();

  const [convs, setConvs] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [reacciones, setReacciones] = useState<Record<string, any[]>>({});
  const [otro, setOtro] = useState<any>(null);
  const [txt, setTxt] = useState("");
  const [showChat, setShowChat] = useState(!!convId);
  const [escribiendo, setEscribiendo] = useState(false);
  const [pickerMsg, setPickerMsg] = useState<string | null>(null);
  const [subiendoImg, setSubiendoImg] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [grabandoAudio, setGrabandoAudio] = useState(false);
  const [replyA, setReplyA] = useState<any>(null);
  const [pendingImg, setPendingImg] = useState<{ file: File; preview: string } | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const presenceRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const presencia = usePresenciaDe(otro?.id);

  useEffect(() => { setShowChat(!!convId); }, [convId]);

  const cargarConvs = async () => {
    if (!user) return;
    const { data } = await (supabase as any).rpc("get_mis_conversaciones", { user_id: user.id });
    const ids = new Set<string>();
    (data || []).forEach((c: any) => { ids.add(c.perfil_a_id); ids.add(c.perfil_b_id); });
    const { data: perfiles } = await (supabase as any).from("perfiles").select("id,nombre,username,avatar_url").in("id", Array.from(ids));
    const pMap = new Map((perfiles || []).map((p: any) => [p.id, p]));
    const conPerfiles = (data || []).map((c: any) => ({ ...c, a: pMap.get(c.perfil_a_id), b: pMap.get(c.perfil_b_id) }));
    conPerfiles.sort((a: any, b: any) => new Date(b.ultimo_mensaje_at || b.created_at).getTime() - new Date(a.ultimo_mensaje_at || a.created_at).getTime());
    setConvs(conPerfiles);
  };

  useEffect(() => {
    cargarConvs();
    if (!user) return;
    const ch = (supabase as any).channel("convs-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, () => cargarConvs())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user]);

  const cargarReacciones = async (msgIds: string[]) => {
    if (msgIds.length === 0) return;
    const { data } = await (supabase as any).from("mensaje_reacciones").select("*").in("mensaje_id", msgIds);
    const map: Record<string, any[]> = {};
    (data || []).forEach((r: any) => { (map[r.mensaje_id] ||= []).push(r); });
    setReacciones(map);
  };

  useEffect(() => {
    if (!convId || !user) return;
    (async () => {
      const { data: m } = await (supabase as any).from("mensajes").select("*").eq("conversacion_id", convId).order("created_at", { ascending: true });
      const list = m || [];
      setMsgs(list);
      cargarReacciones(list.map((x: any) => x.id));
      const { data: c } = await (supabase as any).from("conversaciones")
        .select("*, a:perfiles!perfil_a_id(id,nombre,username,avatar_url), b:perfiles!perfil_b_id(id,nombre,username,avatar_url)").eq("id", convId).single();
      if (c) setOtro(c.perfil_a_id === user.id ? c.b : c.a);
      await (supabase as any).rpc("marcar_conversacion_leida", { p_conversacion_id: convId });
    })();

    const ch = (supabase as any).channel(`m-${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${convId}` },
        (p: any) => setMsgs((s) => s.some((x) => x.id === p.new.id) ? s : [...s, p.new]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${convId}` },
        (p: any) => setMsgs((prev) => prev.map((m) => m.id === p.new.id ? { ...m, ...p.new } : m)))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${convId}` },
        (p: any) => setMsgs((prev) => prev.filter((m) => m.id !== p.old.id)))
      .on("postgres_changes", { event: "*", schema: "public", table: "mensaje_reacciones" },
        () => { setMsgs((curr) => { cargarReacciones(curr.map((x: any) => x.id)); return curr; }); })
      .subscribe();

    const presence = (supabase as any).channel(`typing-${convId}`, { config: { presence: { key: user.id } } });
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState();
        setEscribiendo(Object.keys(state).filter((k) => k !== user.id).some((k) => state[k][0]?.typing));
      })
      .subscribe((status: string) => { if (status === "SUBSCRIBED") presence.track({ typing: false }); });
    presenceRef.current = presence;

    return () => { (supabase as any).removeChannel(ch); (supabase as any).removeChannel(presence); };
  }, [convId, user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, escribiendo]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTxt(e.target.value);
    presenceRef.current?.track({ typing: e.target.value.length > 0 });
  };

  const enviar = async (opts?: { imagen_url?: string; audio_url?: string; audio_dur?: number }) => {
    if ((!txt.trim() && !opts?.imagen_url && !opts?.audio_url) || !user || !convId) return;
    presenceRef.current?.track({ typing: false });
    const tipo = opts?.audio_url ? "audio" : opts?.imagen_url ? "imagen" : "texto";
    const contenido = opts?.audio_url ? "" : opts?.imagen_url ? (txt.trim() || "") : txt;
    const tmpId = `tmp-${Date.now()}`;
    const optimistic: any = {
      id: tmpId, conversacion_id: convId, remitente_id: user.id, tipo,
      contenido, imagen_url: opts?.imagen_url || null, audio_url: opts?.audio_url || null,
      audio_duracion: opts?.audio_dur || null, respuesta_a: replyA?.id || null,
      created_at: new Date().toISOString(), leido: false,
    };
    setMsgs((s) => [...s, optimistic]);
    setTxt("");
    setReplyA(null);
    setEnviando(true);
    const { data, error } = await (supabase as any).from("mensajes").insert({
      conversacion_id: convId, remitente_id: user.id, tipo, contenido,
      imagen_url: opts?.imagen_url || null, audio_url: opts?.audio_url || null,
      audio_duracion: opts?.audio_dur || null, respuesta_a: replyA?.id || null,
    }).select().single();
    setEnviando(false);
    if (error) { setMsgs((s) => s.filter((m) => m.id !== tmpId)); toast.error("No se pudo enviar"); }
    else setMsgs((s) => s.map((m) => m.id === tmpId ? data : m));
  };

  const seleccionarImagen = (file: File) => {
    const ALLOWED = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!ALLOWED.includes(file.type)) return toast.error("Tipo no permitido. Usá JPG, PNG, GIF o WebP.");
    if (file.size > 10 * 1024 * 1024) return toast.error("La imagen supera los 10 MB.");
    setPendingImg({ file, preview: URL.createObjectURL(file) });
  };

  const cancelarImagen = () => {
    if (pendingImg) URL.revokeObjectURL(pendingImg.preview);
    setPendingImg(null);
  };

  const subirYEnviarImagen = async () => {
    if (!user || !convId || !pendingImg) return;
    setSubiendoImg(true);
    try {
      const ext = pendingImg.file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${convId}/${Date.now()}.${ext}`;
      const { error } = await (supabase as any).storage.from("mensajes-media").upload(path, pendingImg.file);
      if (error) throw error;
      const { data } = (supabase as any).storage.from("mensajes-media").getPublicUrl(path);
      await enviar({ imagen_url: data.publicUrl });
      URL.revokeObjectURL(pendingImg.preview);
      setPendingImg(null);
    } catch (e: any) { toast.error(e.message || "Error subiendo imagen"); }
    finally { setSubiendoImg(false); }
  };

  const eliminarMensaje = async (id: string) => {
    if (!confirm("¿Eliminar este mensaje?")) return;
    const backup = msgs;
    setMsgs((s) => s.filter((m) => m.id !== id));
    const { error } = await (supabase as any).from("mensajes").delete().eq("id", id);
    if (error) { setMsgs(backup); toast.error("No se pudo eliminar"); }
  };

  const subirAudio = async (blob: Blob, segs: number) => {
    if (!user || !convId) return;
    setGrabandoAudio(false);
    try {
      const path = `${user.id}/${convId}/${Date.now()}.webm`;
      const { error } = await (supabase as any).storage.from("audio-mensajes").upload(path, blob, { contentType: blob.type });
      if (error) throw error;
      const { data: signed } = await (supabase as any).storage.from("audio-mensajes").createSignedUrl(path, 60 * 60 * 24 * 365);
      await enviar({ audio_url: signed.signedUrl, audio_dur: segs });
    } catch (e: any) { toast.error(e.message || "Error subiendo audio"); }
  };

  const reaccionar = async (mensajeId: string, emoji: string) => {
    if (!user) return;
    const existente = (reacciones[mensajeId] || []).find((r) => r.perfil_id === user.id && r.emoji === emoji);
    if (existente) {
      await (supabase as any).from("mensaje_reacciones").delete().eq("id", existente.id);
    } else {
      await (supabase as any).from("mensaje_reacciones").insert({ mensaje_id: mensajeId, perfil_id: user.id, emoji });
    }
    setPickerMsg(null);
  };

  const enviados = msgs.filter((x) => x.remitente_id === user?.id);
  const ultimoEnviadoId = enviados.at(-1)?.id;

  return (
    <div className="mx-auto -mt-4 grid h-[calc(100dvh-130px)] max-w-6xl gap-0 overflow-hidden md:-mt-6 md:h-[calc(100vh-4rem)] md:grid-cols-[340px_1fr] md:rounded-2xl md:border">
      {/* Lista */}
      <aside className={`flex flex-col overflow-hidden border-r bg-background ${showChat ? "hidden md:flex" : "flex"}`}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-bold tracking-tight">Mensajes</h2>
          <button onClick={() => navigate("/lin/buscar")} className="rounded-full p-2 hover:bg-secondary" aria-label="Nueva conversación">
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Sin conversaciones. Buscá gente y enviá el primer mensaje.</p>
          ) : convs.map((c) => {
            const other = c.perfil_a_id === user?.id ? c.b : c.a;
            const noLeidos = c.perfil_a_id === user?.id ? c.no_leidos_a : c.no_leidos_b;
            return (
              <button key={c.id}
                onClick={() => { navigate(`/lin/mensajes/${c.id}`); setShowChat(true); }}
                className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary/40 ${convId === c.id ? "bg-secondary/60" : ""}`}>
                <Avatar className="h-12 w-12">
                  <AvatarImage src={other?.avatar_url || ""} className="object-cover" />
                  <AvatarFallback>{initials(other?.nombre)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-sm ${noLeidos > 0 ? "font-semibold" : "font-medium"}`}>{other?.nombre}</p>
                    {c.ultimo_mensaje_at && <span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(c.ultimo_mensaje_at)}</span>}
                  </div>
                  <p className={`truncate text-xs ${noLeidos > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                    {c.ultimo_mensaje || "Iniciá una conversación"}
                  </p>
                </div>
                {noLeidos > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {noLeidos > 9 ? "9+" : noLeidos}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Chat */}
      <section className={`flex flex-col overflow-hidden bg-background ${showChat ? "flex" : "hidden md:flex"}`}>
        {!convId ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-foreground/20"><Send className="h-8 w-8 stroke-[1.5]" /></div>
            <p className="text-base font-medium text-foreground">Tus mensajes</p>
            <p className="text-xs">Enviá fotos, audios y llamadas privadas.</p>
          </div>
        ) : (
          <>
            {otro && (
              <header className="flex items-center gap-2 border-b px-3 py-2.5">
                <button onClick={() => { setShowChat(false); navigate("/lin/mensajes"); }} className="rounded-full p-1.5 hover:bg-secondary md:hidden" aria-label="Volver">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Link to={`/lin/perfil/${otro.username}`} className="flex items-center gap-2.5">
                  <div className="relative">
                    <Avatar className="h-9 w-9"><AvatarImage src={otro.avatar_url || ""} /><AvatarFallback>{initials(otro.nombre)}</AvatarFallback></Avatar>
                    {presencia.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{otro.nombre}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {presencia.online ? "Activo ahora" : presencia.ultimo_visto ? `Activo ${formatTime(presencia.ultimo_visto)}` : `@${otro.username}`}
                    </p>
                  </div>
                </Link>
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => iniciarLlamada(otro.id, "audio")} className="rounded-full p-2 text-primary hover:bg-primary/10" aria-label="Llamar"><Phone className="h-5 w-5" /></button>
                  <button onClick={() => iniciarLlamada(otro.id, "video")} className="rounded-full p-2 text-primary hover:bg-primary/10" aria-label="Videollamada"><Video className="h-5 w-5" /></button>
                  <button className="rounded-full p-2 hover:bg-secondary" aria-label="Info"><Info className="h-5 w-5" /></button>
                </div>
              </header>
            )}

            <div className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {msgs.map((m, i) => {
                const mio = m.remitente_id === user?.id;
                const prev = msgs[i - 1];
                const consecutivo = prev && prev.remitente_id === m.remitente_id && (new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60_000;
                const reps = reacciones[m.id] || [];
                const grupos: Record<string, number> = {};
                reps.forEach((r: any) => { grupos[r.emoji] = (grupos[r.emoji] || 0) + 1; });
                const respondido = m.respuesta_a ? msgs.find((x) => x.id === m.respuesta_a) : null;

                return (
                  <div key={m.id} className={cn("group/m flex items-end gap-2", mio ? "justify-end" : "justify-start", consecutivo ? "mt-0.5" : "mt-3")}>
                    {!mio && (
                      consecutivo ? <div className="w-7" /> :
                      <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={otro?.avatar_url || ""} /><AvatarFallback className="text-[10px]">{initials(otro?.nombre)}</AvatarFallback></Avatar>
                    )}

                    {/* Acciones propias — siempre visibles (mobile-friendly) */}
                    {mio && !String(m.id).startsWith("tmp-") && (
                      <div className="flex items-center gap-0.5 opacity-40 transition-opacity group-hover/m:opacity-100 md:opacity-0">
                        <button onClick={() => eliminarMensaje(m.id)} className="rounded-full p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Eliminar mensaje"><Trash2 className="h-4 w-4" /></button>
                        <button onClick={() => setPickerMsg(pickerMsg === m.id ? null : m.id)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary" aria-label="Reaccionar"><Smile className="h-4 w-4" /></button>
                        <button onClick={() => setReplyA(m)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary" aria-label="Responder"><Reply className="h-4 w-4" /></button>
                      </div>
                    )}

                    <div className="relative max-w-[75%]">
                      {respondido && (
                        <div className={cn("mb-1 rounded-2xl border-l-2 border-primary bg-secondary/40 px-2.5 py-1 text-[11px] text-muted-foreground", mio ? "ml-auto" : "")}>
                          <p className="font-medium text-foreground/70">{respondido.remitente_id === user?.id ? "Vos" : otro?.nombre}</p>
                          <p className="line-clamp-1">{respondido.contenido || (respondido.audio_url ? "🎤 Audio" : respondido.imagen_url ? "📷 Imagen" : "")}</p>
                        </div>
                      )}

                      {m.audio_url ? (
                        <AudioPlayer url={m.audio_url} duracion={m.audio_duracion} mio={mio} />
                      ) : (
                        <>
                          {m.imagen_url && (
                            <img
                              src={m.imagen_url}
                              loading="lazy"
                              onClick={(e) => { e.stopPropagation(); window.open(m.imagen_url, "_blank", "noopener,noreferrer"); }}
                              className="mb-1 max-h-72 cursor-pointer rounded-2xl object-cover transition hover:opacity-90"
                              alt=""
                            />
                          )}
                          {m.contenido && (
                            <div className={cn(
                              "px-3.5 py-2 text-[14px] leading-snug",
                              mio ? "bg-primary text-primary-foreground" : "bg-secondary",
                              mio ? "rounded-[20px_20px_4px_20px]" : "rounded-[20px_20px_20px_4px]"
                            )}>
                              <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
                            </div>
                          )}
                        </>
                      )}

                      {/* Reacciones */}
                      {Object.keys(grupos).length > 0 && (
                        <div className={cn("relative -mt-1.5 flex flex-wrap gap-0.5", mio ? "justify-end" : "justify-start")}>
                          {Object.entries(grupos).map(([emoji, n]) => (
                            <button key={emoji} onClick={() => reaccionar(m.id, emoji)}
                              className="flex items-center gap-0.5 rounded-full border-2 border-background bg-secondary px-1.5 py-0.5 text-[11px] shadow-sm hover:bg-secondary/80">
                              <span>{emoji}</span>{n > 1 && <span className="text-muted-foreground">{n}</span>}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Picker emojis */}
                      {pickerMsg === m.id && (
                        <div className={cn("absolute -top-10 z-20 flex gap-0.5 rounded-full border bg-background p-1 shadow-lg", mio ? "right-0" : "left-0")}>
                          {EMOJIS.map((e) => (
                            <button key={e} onClick={() => reaccionar(m.id, e)} className="rounded-full px-1.5 py-0.5 text-base transition-transform hover:scale-125">{e}</button>
                          ))}
                        </div>
                      )}

                      <p className={cn("mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground", mio ? "justify-end" : "justify-start")}>
                        <span>{formatTime(m.created_at)}</span>
                        {mio && m.id === ultimoEnviadoId && !String(m.id).startsWith("tmp-") && (
                          m.leido
                            ? <span className="flex items-center gap-0.5 text-primary"><CheckCheck className="h-3 w-3" />Visto</span>
                            : <span className="flex items-center gap-0.5"><Check className="h-3 w-3" />Enviado</span>
                        )}
                        {mio && String(m.id).startsWith("tmp-") && <span>Enviando…</span>}
                      </p>
                    </div>

                    {!mio && (
                      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/m:opacity-100">
                        <button onClick={() => setReplyA(m)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary" aria-label="Responder"><Reply className="h-4 w-4" /></button>
                        <button onClick={() => setPickerMsg(pickerMsg === m.id ? null : m.id)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary" aria-label="Reaccionar"><Smile className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                );
              })}

              {escribiendo && (
                <div className="flex items-end gap-2">
                  <Avatar className="h-7 w-7"><AvatarImage src={otro?.avatar_url || ""} /><AvatarFallback className="text-[10px]">{initials(otro?.nombre)}</AvatarFallback></Avatar>
                  <div className="rounded-[20px_20px_20px_4px] bg-secondary px-3.5 py-2.5">
                    <div className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Reply preview */}
            {replyA && (
              <div className="flex items-center gap-2 border-t bg-secondary/30 px-3 py-2">
                <Reply className="h-4 w-4 text-primary" />
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-medium">Respondiendo a {replyA.remitente_id === user?.id ? "vos mismo" : otro?.nombre}</p>
                  <p className="truncate text-muted-foreground">{replyA.contenido || (replyA.audio_url ? "🎤 Audio" : "📷 Imagen")}</p>
                </div>
                <button onClick={() => setReplyA(null)} className="rounded-full p-1 hover:bg-secondary"><X className="h-4 w-4" /></button>
              </div>
            )}

            {/* Image preview antes de enviar */}
            {pendingImg && (
              <div className="flex items-center gap-3 border-t bg-secondary/30 px-3 py-2.5">
                <div className="relative">
                  <img src={pendingImg.preview} alt="preview" className="h-16 w-16 rounded-xl object-cover" />
                  <button
                    onClick={cancelarImagen}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-background p-0.5 shadow ring-1 ring-border hover:bg-secondary"
                    aria-label="Descartar imagen"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-medium">Imagen lista para enviar</p>
                  <p className="truncate text-muted-foreground">{pendingImg.file.name}</p>
                </div>
                <button
                  onClick={subirYEnviarImagen}
                  disabled={subiendoImg}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {subiendoImg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  Enviar
                </button>
              </div>
            )}

            {/* Composer */}
            <div className="flex items-center gap-2 border-t px-3 py-2.5">
              {grabandoAudio ? (
                <AudioRecorder onSend={subirAudio} onCancel={() => setGrabandoAudio(false)} />
              ) : (
                <>
                  <button onClick={() => fileRef.current?.click()} disabled={subiendoImg || !!pendingImg} className="rounded-full p-2 text-primary hover:bg-primary/10 disabled:opacity-50" aria-label="Imagen">
                    {subiendoImg ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImageIcon className="h-5 w-5" />}
                  </button>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) seleccionarImagen(f); e.target.value = ""; }} />
                  <Input
                    value={txt} onChange={handleTyping}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), enviar())}
                    onFocus={() => setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 350)}
                    placeholder="Mensaje…"
                    className="rounded-full border-transparent bg-secondary/60 px-4 transition-all focus-visible:bg-background focus-visible:ring-1"
                  />
                  {txt.trim() ? (
                    <button onClick={() => enviar()} disabled={enviando}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40" aria-label="Enviar">
                      <Send className="h-4 w-4" />
                    </button>
                  ) : (
                    <>
                      <button onClick={() => setGrabandoAudio(true)} className="rounded-full p-2 text-primary hover:bg-primary/10" aria-label="Grabar audio">
                        <Mic className="h-5 w-5" />
                      </button>
                      <button onClick={() => enviar({ imagen_url: undefined })} disabled className="rounded-full p-2 text-primary opacity-40" aria-label="Like" onMouseDown={async (e) => {
                        e.preventDefault();
                        if (!convId || !user) return;
                        const { data } = await (supabase as any).from("mensajes").insert({ conversacion_id: convId, remitente_id: user.id, contenido: "❤️", tipo: "texto" }).select().single();
                        if (data) setMsgs((s) => [...s, data]);
                      }}>
                        <Heart className="h-5 w-5" />
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

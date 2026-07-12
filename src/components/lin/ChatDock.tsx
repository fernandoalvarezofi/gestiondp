import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MessageSquare, Minus, X, Send, Paperclip, Settings as SettingsIcon,
  Search, ChevronUp, Trash2, Pencil, Circle, ArrowLeft, Mic,
} from "lucide-react";
import { initials } from "@/lib/worefHelpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AudioRecorder } from "@/components/lin/AudioRecorder";
import { AudioPlayer } from "@/components/lin/AudioPlayer";

/**
 * ChatDock — barra estilo LinkedIn (desktop). Mobile usa /lin/mensajes (no se renderiza aquí).
 *
 * Layout:
 *  - Barra principal: fixed bottom-0 right-24px, width 300px, height 450px expanded / 48px minimized.
 *  - Cada conversación abierta: ventana 280x400 (48px minimized), apilada a la izquierda.
 *  - Settings panel: dropdown sobre la barra principal (presencia, sonido, limpiar).
 *
 * Persistencia (localStorage):
 *  - woref:chat:mainOpen  (boolean)
 *  - woref:chat:windows   ([{id, minimized}])
 *  - woref:chat:presence  ('online' | 'away' | 'offline')
 *  - woref:chat:sound     (boolean)
 */

type Presence = "online" | "away" | "offline";
const LS = {
  mainOpen: "woref:chat:mainOpen",
  windows: "woref:chat:windows",
  presence: "woref:chat:presence",
  sound: "woref:chat:sound",
};
const presenceColor: Record<Presence, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-muted-foreground",
};
const presenceLabel: Record<Presence, string> = {
  online: "Disponible",
  away: "Ausente",
  offline: "Sin conexión",
};
const PRIVATE_IMAGE_BUCKET = "mensajes-media";
const PRIVATE_AUDIO_BUCKET = "audio-mensajes";

const getStoragePath = (value?: string | null, bucket = PRIVATE_IMAGE_BUCKET) => {
  if (!value) return null;
  if (/^(blob:|data:)/i.test(value)) return null;
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, "");
  try {
    const url = new URL(value);
    const publicMarker = `/storage/v1/object/public/${bucket}/`;
    const signedMarker = `/storage/v1/object/sign/${bucket}/`;
    if (url.pathname.includes(publicMarker)) return decodeURIComponent(url.pathname.split(publicMarker)[1] || "");
    if (url.pathname.includes(signedMarker)) return decodeURIComponent((url.pathname.split(signedMarker)[1] || "").split("?")[0]);
  } catch {}
  return null;
};

const signedMediaUrl = async (value?: string | null, bucket = PRIVATE_IMAGE_BUCKET) => {
  if (!value) return null;
  const path = getStoragePath(value, bucket);
  if (!path) return value;
  const { data } = await (supabase as any).storage.from(bucket).createSignedUrl(path, 60 * 60 * 24 * 7);
  return data?.signedUrl || value;
};

function loadLS<T>(k: string, fallback: T): T {
  try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); }
  catch { return fallback; }
}
function saveLS(k: string, v: any) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

function playPing() {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = "sine"; o.frequency.value = 880;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.start(); o.stop(ctx.currentTime + 0.28);
  } catch {}
}

export default function ChatDock() {
  const { user } = useAuth();
  const [mainOpen, setMainOpen] = useState<boolean>(() => loadLS(LS.mainOpen, false));
  const [showSettings, setShowSettings] = useState(false);
  const [presence, setPresence] = useState<Presence>(() => loadLS<Presence>(LS.presence, "online"));
  const [sound, setSound] = useState<boolean>(() => loadLS(LS.sound, true));
  const [windows, setWindows] = useState<{ id: string; minimized: boolean }[]>(
    () => loadLS<{ id: string; minimized: boolean }[]>(LS.windows, [])
  );
  const [convs, setConvs] = useState<any[]>([]);
  const [q, setQ] = useState("");

  // Persist
  useEffect(() => saveLS(LS.mainOpen, mainOpen), [mainOpen]);
  useEffect(() => saveLS(LS.presence, presence), [presence]);
  useEffect(() => saveLS(LS.sound, sound), [sound]);
  useEffect(() => saveLS(LS.windows, windows), [windows]);

  // Reflect presence to server (best-effort)
  useEffect(() => {
    if (!user) return;
    (supabase as any).from("presencia").upsert(
      { perfil_id: user.id, online: presence === "online", ultimo_visto: new Date().toISOString() },
      { onConflict: "perfil_id" }
    );
  }, [presence, user]);

  // Load conversations
  const loadConvs = useCallback(async () => {
    if (!user) return;
    const { data } = await (supabase as any).rpc("get_mis_conversaciones", { user_id: user.id });
    const ids = new Set<string>();
    (data || []).forEach((c: any) => { ids.add(c.perfil_a_id); ids.add(c.perfil_b_id); });
    const { data: perfiles } = await (supabase as any).from("perfiles")
      .select("id,nombre,username,avatar_url").in("id", Array.from(ids));
    const pMap = new Map((perfiles || []).map((p: any) => [p.id, p]));
    const mapped = (data || []).map((c: any) => ({
      ...c, a: pMap.get(c.perfil_a_id), b: pMap.get(c.perfil_b_id),
    }));
    mapped.sort((a: any, b: any) =>
      new Date(b.ultimo_mensaje_at || b.created_at).getTime() -
      new Date(a.ultimo_mensaje_at || a.created_at).getTime()
    );
    setConvs(mapped);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    loadConvs();
    const ch = (supabase as any).channel("chatdock-convs")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, () => loadConvs())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user, loadConvs]);

  // Global new-message sound: subscribe to all my mensajes where remitente != me
  useEffect(() => {
    if (!user) return;
    const ch = (supabase as any).channel("chatdock-pings")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes" }, (p: any) => {
        const m = p.new;
        if (!m || m.remitente_id === user.id) return;
        // verify conversation belongs to me
        const isMine = convs.some((c) =>
          c.id === m.conversacion_id && (c.perfil_a_id === user.id || c.perfil_b_id === user.id)
        );
        if (!isMine) return;
        if (sound && presence !== "offline") playPing();
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user, convs, sound, presence]);

  const totalNoLeidos = useMemo(() =>
    convs.reduce((acc, c) => acc + (c.perfil_a_id === user?.id ? (c.no_leidos_a || 0) : (c.no_leidos_b || 0)), 0),
  [convs, user]);

  const filteredConvs = useMemo(() => {
    if (!q.trim()) return convs;
    const t = q.toLowerCase();
    return convs.filter((c) => {
      const other = c.perfil_a_id === user?.id ? c.b : c.a;
      return other?.nombre?.toLowerCase().includes(t) || other?.username?.toLowerCase().includes(t);
    });
  }, [convs, q, user]);

  const openConv = (convId: string) => {
    setWindows((prev) => {
      if (prev.some((w) => w.id === convId)) {
        return prev.map((w) => w.id === convId ? { ...w, minimized: false } : w);
      }
      const next = [...prev, { id: convId, minimized: false }];
      // cap to 3 windows
      return next.slice(-3);
    });
  };
  const closeConv = (convId: string) => setWindows((p) => p.filter((w) => w.id !== convId));
  const toggleMinConv = (convId: string) =>
    setWindows((p) => p.map((w) => w.id === convId ? { ...w, minimized: !w.minimized } : w));

  const clearLocal = () => {
    setWindows([]);
    setMainOpen(false);
    saveLS(LS.windows, []);
    toast.success("Chats locales limpiados");
  };

  const location = useLocation();
  const hiddenRoutes = ["/lin/mensajes", "/lin/publicar", "/lin/reels", "/lin/nueva-historia", "/lin/historia"];
  const shouldHide = hiddenRoutes.some((r) => location.pathname.startsWith(r));

  if (!user || shouldHide) return null;

  return (
    <div className="hidden md:block">
      {/* Conversation windows (stack to the LEFT of main bar) */}
      <div className="pointer-events-none fixed bottom-0 right-[342px] z-[9998] flex items-end gap-3">
        {windows.map((w) => {
          const conv = convs.find((c) => c.id === w.id);
          if (!conv) return null;
          return (
            <ConvWindow
              key={w.id}
              conv={conv}
              meId={user.id}
              minimized={w.minimized}
              onMinimize={() => toggleMinConv(w.id)}
              onClose={() => closeConv(w.id)}
              soundOn={sound && presence !== "offline"}
            />
          );
        })}
      </div>

      {/* MAIN BAR */}
      <div
        className="fixed bottom-0 right-6 z-[9999] flex w-[300px] flex-col overflow-hidden rounded-t-xl border border-b-0 border-border bg-card shadow-2xl"
        style={{ height: mainOpen ? 450 : 48 }}
      >
        {/* Header (click to expand/collapse) */}
        <button
          onClick={() => setMainOpen((v) => !v)}
          className="flex h-12 w-full shrink-0 items-center gap-2 border-b border-border bg-card px-3 text-left transition-colors hover:bg-secondary/50"
        >
          <div className="relative">
            <MessageSquare className="h-5 w-5 text-foreground" strokeWidth={2.2} />
            {totalNoLeidos > 0 && !mainOpen && (
              <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {totalNoLeidos > 9 ? "9+" : totalNoLeidos}
              </span>
            )}
          </div>
          <span className="flex-1 text-sm font-bold tracking-tight">Mensajería</span>
          <span className={cn("h-2 w-2 rounded-full ring-2 ring-card", presenceColor[presence])} />
          {mainOpen ? <Minus className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </button>

        {/* Body */}
        {mainOpen && (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-1.5 border-b border-border bg-card px-2 py-1.5">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar"
                  className="h-7 rounded-full border-border bg-secondary/50 pl-7 text-xs"
                />
              </div>
              <Link to="/lin/buscar" className="rounded-md p-1.5 hover:bg-secondary" title="Nuevo mensaje">
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                onClick={() => setShowSettings((v) => !v)}
                className={cn("rounded-md p-1.5 hover:bg-secondary", showSettings && "bg-secondary")}
                title="Ajustes"
              >
                <SettingsIcon className="h-4 w-4" />
              </button>
            </div>

            {/* Content: settings OR conv list */}
            {showSettings ? (
              <SettingsPanel
                presence={presence}
                onPresence={setPresence}
                sound={sound}
                onSound={setSound}
                onClear={clearLocal}
                onBack={() => setShowSettings(false)}
              />
            ) : (
              <ScrollArea className="flex-1">
                {filteredConvs.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 px-4 py-10 text-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary">
                      <MessageSquare className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-xs font-medium">Sin conversaciones</p>
                    <Link to="/lin/buscar" className="text-[11px] font-semibold text-primary hover:underline">
                      Iniciar una
                    </Link>
                  </div>
                ) : (
                  <ul>
                    {filteredConvs.map((c) => {
                      const other = c.perfil_a_id === user.id ? c.b : c.a;
                      const noLeidos = c.perfil_a_id === user.id ? c.no_leidos_a : c.no_leidos_b;
                      return (
                        <li key={c.id}>
                          <button
                            onClick={() => openConv(c.id)}
                            className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary/50"
                          >
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={other?.avatar_url || ""} className="object-cover" />
                              <AvatarFallback className="text-[10px]">{initials(other?.nombre)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className={cn("truncate text-xs", noLeidos > 0 ? "font-bold" : "font-medium")}>
                                {other?.nombre || "Sin nombre"}
                              </p>
                              <p className={cn("truncate text-[11px]", noLeidos > 0 ? "text-foreground" : "text-muted-foreground")}>
                                {c.ultimo_mensaje || "Iniciá una conversación"}
                              </p>
                            </div>
                            {noLeidos > 0 && (
                              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                                {noLeidos > 9 ? "9+" : noLeidos}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </ScrollArea>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* -------- Settings -------- */

function SettingsPanel({
  presence, onPresence, sound, onSound, onClear, onBack,
}: {
  presence: Presence;
  onPresence: (p: Presence) => void;
  sound: boolean;
  onSound: (v: boolean) => void;
  onClear: () => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <button onClick={onBack} className="rounded-md p-1 hover:bg-secondary">
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <p className="text-xs font-bold">Ajustes</p>
      </div>

      <div className="space-y-1 px-3 py-3">
        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Disponibilidad</p>
        {(["online", "away", "offline"] as Presence[]).map((p) => (
          <button
            key={p}
            onClick={() => onPresence(p)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
              presence === p ? "bg-secondary font-semibold" : "hover:bg-secondary/60"
            )}
          >
            <Circle className={cn("h-2.5 w-2.5 fill-current", {
              "text-emerald-500": p === "online",
              "text-amber-500": p === "away",
              "text-muted-foreground": p === "offline",
            })} />
            <span className="flex-1">{presenceLabel[p]}</span>
          </button>
        ))}
      </div>

      <Separator />

      <div className="flex items-center justify-between px-3 py-2.5">
        <div>
          <p className="text-xs font-semibold">Sonido al recibir</p>
          <p className="text-[10px] text-muted-foreground">Alerta sonora en mensajes nuevos</p>
        </div>
        <Switch checked={sound} onCheckedChange={onSound} />
      </div>

      <Separator />

      <div className="px-3 py-2.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full text-xs"
          onClick={onClear}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Limpiar chats locales
        </Button>
        <p className="mt-1.5 text-[10px] leading-tight text-muted-foreground">
          Cierra todas las ventanas abiertas. No borra mensajes del servidor.
        </p>
      </div>
    </div>
  );
}

/* -------- Conversation Window -------- */

function ConvWindow({
  conv, meId, minimized, onMinimize, onClose, soundOn,
}: {
  conv: any;
  meId: string;
  minimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
  soundOn: boolean;
}) {
  const other = conv.perfil_a_id === meId ? conv.b : conv.a;
  const [msgs, setMsgs] = useState<any[]>([]);
  const [txt, setTxt] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingImg, setPendingImg] = useState<{ file: File; preview: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const signMessages = useCallback(async (list: any[]) => {
    return Promise.all((list || []).map(async (m: any) => ({
      ...m,
      imagen_url: m?.imagen_url ? await signedMediaUrl(m.imagen_url, PRIVATE_IMAGE_BUCKET) : m?.imagen_url,
      audio_url: m?.audio_url ? await signedMediaUrl(m.audio_url, PRIVATE_AUDIO_BUCKET) : m?.audio_url,
    })));
  }, []);

  // Load + subscribe
  useEffect(() => {
    let cancel = false;
    (async () => {
      const { data } = await (supabase as any).from("mensajes")
        .select("*").eq("conversacion_id", conv.id)
        .order("created_at", { ascending: true }).limit(80);
      const signed = await signMessages(data || []);
      if (!cancel) setMsgs(signed);
      await (supabase as any).rpc("marcar_conversacion_leida", { p_conversacion_id: conv.id });
    })();
    const ch = (supabase as any).channel(`cw-${conv.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${conv.id}` },
        async (p: any) => {
          const [msg] = await signMessages([p.new]);
          setMsgs((s) => s.some((x) => x.id === msg.id) ? s : [...s, msg]);
          if (p.new.remitente_id !== meId) {
            if (soundOn) playPing();
            if (!minimized) (supabase as any).rpc("marcar_conversacion_leida", { p_conversacion_id: conv.id });
          }
        }
      )
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${conv.id}` },
        async (p: any) => {
          const [msg] = await signMessages([p.new]);
          setMsgs((s) => s.map((m) => m.id === msg.id ? { ...m, ...msg } : m));
        }
      )
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${conv.id}` },
        (p: any) => setMsgs((s) => s.filter((m) => m.id !== p.old.id))
      ).subscribe();
    return () => { cancel = true; (supabase as any).removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.id, meId, signMessages]);

  useEffect(() => {
    if (!minimized) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, minimized]);

  const send = async (opts?: { imagen_url?: string; imagen_preview?: string; audio_url?: string; audio_preview?: string; audio_dur?: number }) => {
    const contenido = txt.trim();
    if ((!contenido && !opts?.imagen_url && !opts?.audio_url) || sending) return;
    setSending(true);
    const tipo = opts?.audio_url ? "audio" : opts?.imagen_url ? "imagen" : "texto";
    const tmp: any = {
      id: `tmp-${Date.now()}`, conversacion_id: conv.id, remitente_id: meId,
      tipo, contenido: opts?.audio_url ? "" : contenido,
      imagen_url: opts?.imagen_preview || opts?.imagen_url || null,
      audio_url: opts?.audio_preview || opts?.audio_url || null,
      audio_duracion: opts?.audio_dur || null,
      created_at: new Date().toISOString(),
    };
    setMsgs((s) => [...s, tmp]);
    setTxt("");
    const { data, error } = await (supabase as any).from("mensajes").insert({
      conversacion_id: conv.id, remitente_id: meId, tipo, contenido: opts?.audio_url ? "" : contenido,
      imagen_url: opts?.imagen_url || null,
      audio_url: opts?.audio_url || null,
      audio_duracion: opts?.audio_dur || null,
    }).select().single();
    setSending(false);
    if (error) {
      setMsgs((s) => s.filter((m) => m.id !== tmp.id));
      toast.error("No se pudo enviar");
    } else {
      const [msg] = await signMessages([data]);
      setMsgs((s) => s.map((m) => m.id === tmp.id ? msg : m));
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowed.includes(file.type)) { toast.error("Usá JPG, PNG, GIF o WebP"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Máximo 10MB"); return; }
    if (pendingImg) URL.revokeObjectURL(pendingImg.preview);
    setPendingImg({ file, preview: URL.createObjectURL(file) });
  };

  const cancelPendingImage = () => {
    if (pendingImg) URL.revokeObjectURL(pendingImg.preview);
    setPendingImg(null);
  };

  const uploadPendingImage = async () => {
    if (!pendingImg) return;
    setUploading(true);
    try {
      const ext = pendingImg.file.name.split(".").pop() || "jpg";
      const path = `${meId}/${conv.id}/${Date.now()}.${ext}`;
      const { error } = await (supabase as any).storage.from(PRIVATE_IMAGE_BUCKET).upload(path, pendingImg.file);
      if (error) throw error;
      await send({ imagen_url: path, imagen_preview: pendingImg.preview });
      URL.revokeObjectURL(pendingImg.preview);
      setPendingImg(null);
    } catch (err: any) {
      toast.error(err.message || "Error subiendo");
    } finally {
      setUploading(false);
    }
  };

  const uploadAudio = async (blob: Blob, seconds: number) => {
    setRecording(false);
    setUploading(true);
    try {
      const path = `${meId}/${conv.id}/${Date.now()}.webm`;
      const { error } = await (supabase as any).storage.from(PRIVATE_AUDIO_BUCKET).upload(path, blob, { contentType: blob.type });
      if (error) throw error;
      const preview = URL.createObjectURL(blob);
      await send({ audio_url: path, audio_preview: preview, audio_dur: seconds });
      URL.revokeObjectURL(preview);
    } catch (err: any) {
      toast.error(err.message || "Error subiendo audio");
    } finally {
      setUploading(false);
    }
  };

  const deleteMsg = async (id: string) => {
    if (!confirm("¿Eliminar este mensaje?")) return;
    const backup = msgs;
    setMsgs((s) => s.filter((m) => m.id !== id));
    const { error } = await (supabase as any).from("mensajes").delete().eq("id", id).eq("remitente_id", meId);
    if (error) {
      setMsgs(backup);
      toast.error(error.message || "No se pudo eliminar");
    }
  };

  return (
    <div
      className="pointer-events-auto flex w-[280px] flex-col overflow-hidden rounded-t-xl border border-b-0 border-border bg-card shadow-2xl"
      style={{ height: minimized ? 48 : 400 }}
    >
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-2.5">
        <button
          onClick={onMinimize}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <Avatar className="h-7 w-7">
            <AvatarImage src={other?.avatar_url || ""} className="object-cover" />
            <AvatarFallback className="text-[9px]">{initials(other?.nombre)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold leading-tight">{other?.nombre || "Sin nombre"}</p>
            <p className="truncate text-[10px] text-muted-foreground">@{other?.username || "—"}</p>
          </div>
        </button>
        <button onClick={onMinimize} className="rounded p-1 text-muted-foreground hover:bg-secondary" title="Minimizar">
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-secondary" title="Cerrar">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div className="flex-1 space-y-1.5 overflow-y-auto bg-background/40 px-2.5 py-2">
            {msgs.length === 0 ? (
              <p className="py-6 text-center text-[11px] text-muted-foreground">
                Saludá a {other?.nombre?.split(" ")[0] || "tu contacto"}.
              </p>
            ) : msgs.map((m) => {
              const mio = m.remitente_id === meId;
              return (
                <div key={m.id} className={cn("group/cw flex items-end gap-1", mio ? "justify-end" : "justify-start")}>
                  {mio && !String(m.id).startsWith("tmp-") && (
                    <button
                      onClick={() => deleteMsg(m.id)}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border bg-background text-destructive opacity-80 shadow-sm hover:bg-destructive/10"
                      title="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <div className={cn(
                    "max-w-[80%] rounded-2xl text-[12px] leading-snug",
                    m.audio_url ? "p-0" : "px-3 py-1.5",
                    mio ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  )}>
                    {m.audio_url ? (
                      <AudioPlayer url={m.audio_url} duracion={m.audio_duracion} mio={mio} />
                    ) : m.imagen_url ? (
                      <img
                        src={m.imagen_url}
                        alt="Imagen enviada"
                        loading="lazy"
                        onClick={() => window.open(m.imagen_url, "_blank", "noopener,noreferrer")}
                        className="mb-1 max-h-40 cursor-pointer rounded-lg object-cover"
                      />
                    ) : null}
                    {m.contenido && (
                      <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {pendingImg && (
            <div className="flex items-center gap-2 border-t border-border bg-card px-2 py-1.5">
              <img src={pendingImg.preview} alt="Vista previa" className="h-10 w-10 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium">Imagen lista</p>
                <p className="truncate text-[10px] text-muted-foreground">{pendingImg.file.name}</p>
              </div>
              <button onClick={cancelPendingImage} className="rounded-full p-1 text-muted-foreground hover:bg-secondary" title="Descartar">
                <X className="h-3.5 w-3.5" />
              </button>
              <button onClick={uploadPendingImage} disabled={uploading} className="rounded-full bg-primary p-1.5 text-primary-foreground disabled:opacity-40" title="Enviar imagen">
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Composer */}
          <div className="flex shrink-0 items-center gap-1.5 border-t border-border bg-card px-2 py-1.5">
            {recording ? (
              <AudioRecorder onSend={uploadAudio} onCancel={() => setRecording(false)} />
            ) : (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || !!pendingImg}
                  className="rounded p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-50"
                  title="Adjuntar imagen"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onPickFile} />
                <Input
                  value={txt}
                  onChange={(e) => setTxt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                  placeholder="Escribí un mensaje…"
                  className="h-7 rounded-full border-border bg-secondary/40 text-xs"
                />
                {txt.trim() ? (
                  <button
                    onClick={() => send()}
                    disabled={sending}
                    className="rounded-full bg-primary p-1.5 text-primary-foreground transition-opacity disabled:opacity-40"
                    title="Enviar"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => setRecording(true)}
                    disabled={uploading}
                    className="rounded-full p-1.5 text-primary hover:bg-primary/10 disabled:opacity-50"
                    title="Grabar audio"
                  >
                    <Mic className="h-4 w-4" />
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

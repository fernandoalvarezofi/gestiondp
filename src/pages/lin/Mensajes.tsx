import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, Phone, Info, Pencil, ImageIcon } from "lucide-react";
import { initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";

const EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

export default function Mensajes() {
  const { user } = useAuth();
  const { id: convId } = useParams();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [otro, setOtro] = useState<any>(null);
  const [txt, setTxt] = useState("");
  const [showChat, setShowChat] = useState(!!convId);
  const [escribiendo, setEscribiendo] = useState(false);
  const [reaccionMsg, setReaccionMsg] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const presenceRef = useRef<any>(null);

  useEffect(() => { setShowChat(!!convId); }, [convId]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).rpc("get_mis_conversaciones", { user_id: user.id });
      const convsConPerfiles = await Promise.all((data || []).map(async (c: any) => {
        const [{ data: a }, { data: b }] = await Promise.all([
          (supabase as any).from("perfiles").select("id,nombre,username,avatar_url").eq("id", c.perfil_a_id).single(),
          (supabase as any).from("perfiles").select("id,nombre,username,avatar_url").eq("id", c.perfil_b_id).single(),
        ]);
        return { ...c, a, b };
      }));
      setConvs(convsConPerfiles);
    })();
  }, [user]);

  useEffect(() => {
    if (!convId || !user) return;
    (async () => {
      const { data: m } = await (supabase as any).from("mensajes").select("*").eq("conversacion_id", convId).order("created_at", { ascending: true });
      setMsgs(m || []);
      const { data: c } = await (supabase as any).from("conversaciones")
        .select("*, a:perfiles!perfil_a_id(id,nombre,username,avatar_url), b:perfiles!perfil_b_id(id,nombre,username,avatar_url)").eq("id", convId).single();
      if (c) setOtro(c.perfil_a_id === user.id ? c.b : c.a);
      // Marcar como leídos
      await (supabase as any).from("mensajes")
        .update({ leido: true, leido_at: new Date().toISOString() })
        .eq("conversacion_id", convId)
        .neq("remitente_id", user.id)
        .eq("leido", false);
    })();

    const ch = (supabase as any).channel(`m-${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${convId}` },
        (p: any) => setMsgs((s) => [...s, p.new]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${convId}` },
        (p: any) => setMsgs((prev) => prev.map((m) => m.id === p.new.id ? { ...m, ...p.new } : m)))
      .subscribe();

    const presence = (supabase as any).channel(`typing-${convId}`, { config: { presence: { key: user.id } } });
    presence
      .on("presence", { event: "sync" }, () => {
        const state = presence.presenceState();
        const otrosEscribiendo = Object.keys(state).filter((k) => k !== user.id).some((k) => state[k][0]?.typing);
        setEscribiendo(otrosEscribiendo);
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

  const enviar = async () => {
    if (!txt.trim() || !user || !convId) return;
    presenceRef.current?.track({ typing: false });
    const contenido = txt;
    setTxt("");
    await (supabase as any).from("mensajes").insert({ conversacion_id: convId, remitente_id: user.id, contenido });
  };

  const enviados = msgs.filter((x) => x.remitente_id === user?.id);
  const ultimoEnviadoId = enviados.at(-1)?.id;

  return (
    <div className="mx-auto grid h-[calc(100vh-8rem)] max-w-5xl gap-0 overflow-hidden rounded-2xl border md:grid-cols-[320px_1fr] md:gap-4 md:border-0">
      {/* Lista de conversaciones */}
      <div className={`flex flex-col overflow-hidden border-r bg-background ${showChat ? "hidden md:flex" : "flex"}`}>
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold">Mensajes</h2>
          <button className="rounded-full p-2 hover:bg-secondary" aria-label="Nueva conversación">
            <Pencil className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Sin conversaciones aún.</p>
            : convs.map((c) => {
              const other = c.perfil_a_id === user?.id ? c.b : c.a;
              const noLeidos = c.perfil_a_id === user?.id ? c.no_leidos_a : c.no_leidos_b;
              return (
                <button
                  key={c.id}
                  onClick={() => { navigate(`/lin/mensajes/${c.id}`); setShowChat(true); }}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-secondary/40 ${convId === c.id ? "bg-secondary/60" : ""}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={other?.avatar_url || ""} />
                    <AvatarFallback>{initials(other?.nombre)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{other?.nombre}</p>
                      {c.ultimo_mensaje_at && (
                        <span className="shrink-0 text-[10px] text-muted-foreground">{formatTime(c.ultimo_mensaje_at)}</span>
                      )}
                    </div>
                    <p className={`truncate text-xs ${noLeidos > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {c.ultimo_mensaje || "Iniciar chat"}
                    </p>
                  </div>
                  {noLeidos > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })}
        </div>
      </div>

      {/* Ventana de chat */}
      <div className={`flex flex-col overflow-hidden bg-background ${showChat ? "flex" : "hidden md:flex"}`}>
        {!convId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Elegí una conversación</div>
        ) : (
          <>
            {otro && (
              <div className="flex items-center gap-2 border-b px-3 py-2.5">
                <button onClick={() => { setShowChat(false); navigate("/lin/mensajes"); }} className="rounded-full p-1.5 hover:bg-secondary md:hidden" aria-label="Volver">
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <Link to={`/lin/perfil/${otro.username}`} className="flex items-center gap-2">
                  <Avatar className="h-9 w-9"><AvatarImage src={otro.avatar_url || ""} /><AvatarFallback>{initials(otro.nombre)}</AvatarFallback></Avatar>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{otro.nombre}</p>
                    <p className="text-xs text-muted-foreground">@{otro.username}</p>
                  </div>
                </Link>
                <div className="ml-auto flex items-center gap-1">
                  <button className="rounded-full p-2 hover:bg-secondary" aria-label="Llamar"><Phone className="h-4 w-4" /></button>
                  <button className="rounded-full p-2 hover:bg-secondary" aria-label="Info"><Info className="h-4 w-4" /></button>
                </div>
              </div>
            )}

            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
              {msgs.map((m, i) => {
                const mio = m.remitente_id === user?.id;
                const prev = msgs[i - 1];
                const consecutivo = prev && prev.remitente_id === m.remitente_id;
                return (
                  <div key={m.id} className={`flex ${mio ? "justify-end" : "justify-start"} ${consecutivo ? "mt-0.5" : "mt-2"}`}>
                    <div
                      className="group relative max-w-[75%]"
                      onMouseEnter={() => setReaccionMsg(m.id)}
                      onMouseLeave={() => setReaccionMsg(null)}
                    >
                      <div className={`px-3.5 py-2 text-sm ${mio ? "bg-primary text-primary-foreground rounded-[20px_20px_4px_20px]" : "bg-secondary rounded-[20px_20px_20px_4px]"}`}>
                        <p className="whitespace-pre-wrap break-words">{m.contenido}</p>
                      </div>
                      {reaccionMsg === m.id && (
                        <div className={`absolute -top-9 z-10 flex gap-0.5 rounded-full border bg-background p-1 shadow-md ${mio ? "right-0" : "left-0"}`}>
                          {EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              onClick={() => { toast.success(`Reaccionaste con ${emoji}`); setReaccionMsg(null); }}
                              className="rounded-full px-1.5 text-base transition-transform hover:scale-125"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      )}
                      <p className={`mt-0.5 text-[10px] text-muted-foreground ${mio ? "text-right" : "text-left"}`}>
                        {formatTime(m.created_at)}
                        {mio && m.id === ultimoEnviadoId && (
                          <span className="ml-1.5">· {m.leido ? `Visto ${m.leido_at ? formatTime(m.leido_at) : ""}` : "Enviado"}</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}

              {escribiendo && (
                <div className="flex justify-start">
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

            <div className="flex items-center gap-2 border-t px-3 py-2.5">
              <button className="rounded-full p-2 hover:bg-secondary md:hidden" aria-label="Imagen">
                <ImageIcon className="h-5 w-5 text-primary" />
              </button>
              <Input
                value={txt}
                onChange={handleTyping}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                placeholder="Mensaje…"
                className="rounded-full border-secondary bg-secondary/40 px-4 transition-all focus-visible:bg-background"
              />
              <button
                onClick={enviar}
                disabled={!txt.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
                aria-label="Enviar"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

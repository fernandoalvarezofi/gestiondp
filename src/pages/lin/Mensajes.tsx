import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";
import { initials, formatTime } from "@/lib/worefHelpers";

export default function Mensajes() {
  const { user } = useAuth();
  const { id: convId } = useParams();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [otro, setOtro] = useState<any>(null);
  const [txt, setTxt] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("conversaciones")
        .select("*, a:perfiles!perfil_a_id(id,nombre,username,avatar_url), b:perfiles!perfil_b_id(id,nombre,username,avatar_url)")
        .or(`perfil_a_id.eq.${user.id},perfil_b_id.eq.${user.id}`)
        .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false });
      setConvs(data || []);
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
    })();
    const ch = (supabase as any).channel(`m-${convId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${convId}` },
      (p: any) => setMsgs((s) => [...s, p.new])).subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [convId, user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const enviar = async () => {
    if (!txt.trim() || !user || !convId) return;
    await (supabase as any).from("mensajes").insert({ conversacion_id: convId, remitente_id: user.id, contenido: txt });
    setTxt("");
  };

  return (
    <div className="mx-auto grid h-[calc(100vh-8rem)] max-w-5xl gap-4 md:grid-cols-[300px_1fr]">
      <Card className="flex flex-col overflow-hidden">
        <div className="border-b p-3"><h2 className="font-semibold">Mensajes</h2></div>
        <div className="flex-1 overflow-y-auto">
          {convs.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Sin conversaciones aún.</p>
            : convs.map((c) => {
              const other = c.perfil_a_id === user?.id ? c.b : c.a;
              return (
                <button key={c.id} onClick={() => navigate(`/lin/mensajes/${c.id}`)} className={`flex w-full items-center gap-2 border-b p-3 text-left hover:bg-secondary/40 ${convId === c.id ? "bg-secondary/60" : ""}`}>
                  <Avatar className="h-9 w-9"><AvatarImage src={other.avatar_url || ""} /><AvatarFallback>{initials(other.nombre)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{other.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.ultimo_mensaje || "Iniciar chat"}</p>
                  </div>
                </button>
              );
            })}
        </div>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        {!convId ? <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Elegí una conversación</div> : (
          <>
            {otro && <div className="flex items-center gap-2 border-b p-3">
              <Link to={`/lin/perfil/${otro.username}`} className="flex items-center gap-2">
                <Avatar className="h-8 w-8"><AvatarImage src={otro.avatar_url || ""} /><AvatarFallback>{initials(otro.nombre)}</AvatarFallback></Avatar>
                <div><p className="text-sm font-medium">{otro.nombre}</p><p className="text-xs text-muted-foreground">@{otro.username}</p></div>
              </Link>
            </div>}
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {msgs.map((m) => (
                <div key={m.id} className={`flex ${m.remitente_id === user?.id ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.remitente_id === user?.id ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    <p className="whitespace-pre-wrap">{m.contenido}</p>
                    <p className="mt-1 text-[10px] opacity-70">{formatTime(m.created_at)}</p>
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
            <div className="flex gap-2 border-t p-3">
              <Input value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()} placeholder="Escribí un mensaje…" />
              <Button onClick={enviar}><Send className="h-4 w-4" /></Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

import { useEffect, useState, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send, ArrowLeft } from "lucide-react";
import { initials, timeAgo } from "@/lib/linquenoHelpers";

export default function LinMensajes() {
  const { user } = useAuth();
  const { id: convId } = useParams();
  const navigate = useNavigate();
  const [convs, setConvs] = useState<any[]>([]);
  const [mensajes, setMensajes] = useState<any[]>([]);
  const [otro, setOtro] = useState<any>(null);
  const [texto, setTexto] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("conversaciones")
        .select(`id,perfil_a_id,perfil_b_id,ultimo_mensaje,ultimo_mensaje_at,no_leidos_a,no_leidos_b,
          a:perfiles!perfil_a_id(id,nombre,slug,avatar_url),
          b:perfiles!perfil_b_id(id,nombre,slug,avatar_url)`)
        .or(`perfil_a_id.eq.${user.id},perfil_b_id.eq.${user.id}`)
        .order("ultimo_mensaje_at", { ascending: false, nullsFirst: false });
      setConvs(data || []);
    })();
  }, [user]);

  useEffect(() => {
    if (!convId || !user) return;
    cargar();
    const ch = (supabase as any).channel(`conv:${convId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensajes", filter: `conversacion_id=eq.${convId}` },
        (p: any) => setMensajes((m) => [...m, p.new]))
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [convId, user]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [mensajes]);

  const cargar = async () => {
    const { data: c } = await (supabase as any).from("conversaciones")
      .select(`id,perfil_a_id,perfil_b_id,a:perfiles!perfil_a_id(id,nombre,slug,avatar_url),b:perfiles!perfil_b_id(id,nombre,slug,avatar_url)`)
      .eq("id", convId).single();
    if (c) setOtro(c.perfil_a_id === user?.id ? c.b : c.a);
    const { data: ms } = await (supabase as any).from("mensajes")
      .select("*").eq("conversacion_id", convId).order("created_at", { ascending: true });
    setMensajes(ms || []);
  };

  const enviar = async () => {
    if (!texto.trim() || !user || !convId) return;
    await (supabase as any).from("mensajes").insert({
      conversacion_id: convId, remitente_id: user.id, contenido: texto.trim(),
    });
    setTexto("");
  };

  if (!convId) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <h1 className="text-2xl font-bold tracking-tight">Mensajes</h1>
        {convs.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Sin conversaciones todavía.</CardContent></Card>
        ) : convs.map((c) => {
          const o = c.perfil_a_id === user?.id ? c.b : c.a;
          const noLeidos = c.perfil_a_id === user?.id ? c.no_leidos_a : c.no_leidos_b;
          return (
            <Link key={c.id} to={`/lin/mensajes/${c.id}`}>
              <Card className="hover:bg-secondary/40">
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar><AvatarImage src={o?.avatar_url || ""} className="object-cover" /><AvatarFallback>{initials(o?.nombre)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{o?.nombre}</p>
                      {c.ultimo_mensaje_at && <span className="text-[10px] text-muted-foreground">{timeAgo(c.ultimo_mensaje_at)}</span>}
                    </div>
                    <p className="line-clamp-1 text-xs text-muted-foreground">{c.ultimo_mensaje || "Sin mensajes"}</p>
                  </div>
                  {noLeidos > 0 && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">{noLeidos}</span>}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col">
      <div className="flex items-center gap-2 border-b pb-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/lin/mensajes")}><ArrowLeft className="h-4 w-4" /></Button>
        {otro && (
          <Link to={`/lin/perfil/${otro.slug}`} className="flex items-center gap-2 hover:opacity-80">
            <Avatar className="h-9 w-9"><AvatarImage src={otro.avatar_url || ""} className="object-cover" /><AvatarFallback>{initials(otro.nombre)}</AvatarFallback></Avatar>
            <span className="font-semibold">{otro.nombre}</span>
          </Link>
        )}
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto py-4">
        {mensajes.map((m) => {
          const mine = m.remitente_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                {m.contenido}
                <div className={`mt-0.5 text-[10px] ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{timeAgo(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2 border-t pt-3">
        <Input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && enviar()} placeholder="Escribí un mensaje..." />
        <Button onClick={enviar} size="icon"><Send className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ESTADO_PROYECTO, initials } from "@/lib/worefHelpers";
import { toast } from "sonner";

export default function ProyectoDetalle() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [p, setP] = useState<any>(null);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [siguiendo, setSiguiendo] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("proyectos").select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url)").or(`slug.eq.${slug},id.eq.${slug}`).single();
      if (!data) return;
      setP(data);
      const [{ data: m }, { data: u }] = await Promise.all([
        (supabase as any).from("proyecto_miembros").select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url)").eq("proyecto_id", data.id),
        (supabase as any).from("proyecto_updates").select("*").eq("proyecto_id", data.id).order("created_at", { ascending: false }),
      ]);
      setMiembros(m || []); setUpdates(u || []);
      if (user) {
        const { data: s } = await (supabase as any).from("proyecto_seguidores").select("id").eq("proyecto_id", data.id).eq("perfil_id", user.id).maybeSingle();
        setSiguiendo(!!s);
      }
    })();
  }, [slug, user]);

  const toggleSeguir = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (siguiendo) await (supabase as any).from("proyecto_seguidores").delete().eq("proyecto_id", p.id).eq("perfil_id", user.id);
    else await (supabase as any).from("proyecto_seguidores").insert({ proyecto_id: p.id, perfil_id: user.id });
    setSiguiendo(!siguiendo);
  };

  if (!p) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const est = ESTADO_PROYECTO[p.estado];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {p.portada_url && <img src={p.portada_url} className="h-48 w-full rounded-2xl object-cover" alt="" />}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{p.nombre}</h1>
          <p className="text-sm text-muted-foreground">por <Link className="hover:text-primary" to={`/lin/perfil/${p.perfil?.username}`}>{p.perfil?.nombre}</Link></p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {est && <Badge className={est.color}>{est.label}</Badge>}
            {p.categoria && <Badge variant="outline">{p.categoria}</Badge>}
          </div>
        </div>
        <Button variant={siguiendo ? "outline" : "default"} onClick={toggleSeguir}>{siguiendo ? "Siguiendo" : "Seguir proyecto"}</Button>
      </div>
      {p.descripcion && <Card><CardContent className="whitespace-pre-wrap p-5 text-sm">{p.descripcion}</CardContent></Card>}
      {p.buscando?.length > 0 && (
        <Card><CardContent className="space-y-2 p-4"><p className="text-sm font-semibold">Buscando</p>
          <div className="flex flex-wrap gap-1.5">{p.buscando.map((b: string) => <Badge key={b} variant="secondary">{b}</Badge>)}</div>
        </CardContent></Card>
      )}
      <div className="grid gap-2 sm:grid-cols-3 text-xs">
        {p.sitio_web && <a href={p.sitio_web} target="_blank" rel="noreferrer" className="rounded-md border bg-secondary/40 p-2 hover:text-primary">Sitio web</a>}
        {p.demo_url && <a href={p.demo_url} target="_blank" rel="noreferrer" className="rounded-md border bg-secondary/40 p-2 hover:text-primary">Demo</a>}
        {p.repo_url && <a href={p.repo_url} target="_blank" rel="noreferrer" className="rounded-md border bg-secondary/40 p-2 hover:text-primary">Repositorio</a>}
      </div>
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Equipo ({miembros.length})</h2>
        {miembros.length === 0 ? <p className="text-xs text-muted-foreground">Aún sin miembros.</p>
          : <div className="flex flex-wrap gap-2">{miembros.map((m) => (
            <Link key={m.id} to={`/lin/perfil/${m.perfil.username}`} className="flex items-center gap-2 rounded-full border bg-secondary/40 px-2 py-1">
              <Avatar className="h-6 w-6"><AvatarImage src={m.perfil.avatar_url || ""} /><AvatarFallback className="text-[10px]">{initials(m.perfil.nombre)}</AvatarFallback></Avatar>
              <span className="text-xs">{m.perfil.nombre}</span>
            </Link>
          ))}</div>}
      </CardContent></Card>
      <Card><CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Updates ({updates.length})</h2>
        {updates.length === 0 ? <p className="text-xs text-muted-foreground">Sin updates aún.</p>
          : updates.map((u) => <div key={u.id} className="border-t pt-2 first:border-0 first:pt-0"><p className="text-sm font-medium">{u.titulo}</p><p className="text-sm text-muted-foreground">{u.contenido}</p></div>)}
      </CardContent></Card>
    </div>
  );
}

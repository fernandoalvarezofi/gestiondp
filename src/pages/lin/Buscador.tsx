import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PostCard } from "@/components/lin/PostCard";
import { initials, TIPO_USUARIO } from "@/lib/worefHelpers";

const PUB_SELECT = `id,tipo,formato,titulo,cuerpo,imagen_url,video_url,tags,
  vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url,tipo,verificado),
  media:media_publicacion(url,es_portada,orden)`;

export default function Buscador() {
  const [q, setQ] = useState("");
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [pubs, setPubs] = useState<any[]>([]);
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [comunidades, setComunidades] = useState<any[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setPerfiles([]); setPubs([]); setProyectos([]); setComunidades([]); return; }
      const term = `%${q}%`;
      const [a, b, c, d] = await Promise.all([
        (supabase as any).from("perfiles").select("id,nombre,username,avatar_url,tipo,verificado,bio").or(`nombre.ilike.${term},username.ilike.${term},bio.ilike.${term}`).limit(20),
        (supabase as any).from("publicaciones").select(PUB_SELECT).eq("estado", "activa").or(`titulo.ilike.${term},cuerpo.ilike.${term}`).limit(20),
        (supabase as any).from("proyectos").select("id,nombre,slug,descripcion,portada_url,estado,categoria").or(`nombre.ilike.${term},descripcion.ilike.${term}`).limit(20),
        (supabase as any).from("comunidades").select("id,nombre,slug,descripcion,avatar_url,total_miembros").eq("privada", false).or(`nombre.ilike.${term},descripcion.ilike.${term}`).limit(20),
      ]);
      setPerfiles(a.data || []); setPubs(b.data || []); setProyectos(c.data || []); setComunidades(d.data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscá personas, publicaciones, proyectos, comunidades…" className="pl-9" />
      </div>

      <Tabs defaultValue="todo">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="todo">Todo</TabsTrigger>
          <TabsTrigger value="gente">Gente</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="proy">Proyectos</TabsTrigger>
          <TabsTrigger value="com">Comunidades</TabsTrigger>
        </TabsList>

        <TabsContent value="todo" className="mt-4 space-y-5">
          {perfiles.length > 0 && <Section title="Gente">{perfiles.slice(0, 4).map((p) => <PerfilRow key={p.id} p={p} />)}</Section>}
          {pubs.length > 0 && <Section title="Publicaciones">{pubs.slice(0, 3).map((p) => <PostCard key={p.id} pub={p} />)}</Section>}
          {proyectos.length > 0 && <Section title="Proyectos">{proyectos.slice(0, 3).map((p) => <ProyectoRow key={p.id} p={p} />)}</Section>}
          {comunidades.length > 0 && <Section title="Comunidades">{comunidades.slice(0, 3).map((c) => <ComunidadRow key={c.id} c={c} />)}</Section>}
        </TabsContent>
        <TabsContent value="gente" className="mt-4 space-y-2">{perfiles.map((p) => <PerfilRow key={p.id} p={p} />)}</TabsContent>
        <TabsContent value="posts" className="mt-4 space-y-4">{pubs.map((p) => <PostCard key={p.id} pub={p} />)}</TabsContent>
        <TabsContent value="proy" className="mt-4 space-y-2">{proyectos.map((p) => <ProyectoRow key={p.id} p={p} />)}</TabsContent>
        <TabsContent value="com" className="mt-4 space-y-2">{comunidades.map((c) => <ComunidadRow key={c.id} c={c} />)}</TabsContent>
      </Tabs>
    </div>
  );
}

function Section({ title, children }: any) {
  return <div className="space-y-2"><h2 className="text-sm font-semibold text-muted-foreground">{title}</h2>{children}</div>;
}
function PerfilRow({ p }: any) {
  return <Link to={`/lin/perfil/${p.username}`}><Card><CardContent className="flex items-center gap-3 p-3">
    <Avatar className="h-10 w-10"><AvatarImage src={p.avatar_url || ""} /><AvatarFallback>{initials(p.nombre)}</AvatarFallback></Avatar>
    <div className="min-w-0 flex-1">
      <p className="font-medium truncate">{p.nombre}</p>
      <p className="text-xs text-muted-foreground truncate">@{p.username} · {TIPO_USUARIO[p.tipo]}</p>
    </div>
  </CardContent></Card></Link>;
}
function ProyectoRow({ p }: any) {
  return <Link to={`/lin/proyectos/${p.slug || p.id}`}><Card><CardContent className="flex items-center gap-3 p-3">
    {p.portada_url ? <img src={p.portada_url} className="h-10 w-10 rounded object-cover" alt="" /> : <div className="h-10 w-10 rounded bg-secondary" />}
    <div className="min-w-0 flex-1">
      <p className="font-medium truncate">{p.nombre}</p>
      <p className="text-xs text-muted-foreground truncate">{p.descripcion}</p>
    </div>
  </CardContent></Card></Link>;
}
function ComunidadRow({ c }: any) {
  return <Link to={`/lin/comunidades/${c.slug}`}><Card><CardContent className="flex items-center gap-3 p-3">
    {c.avatar_url ? <img src={c.avatar_url} className="h-10 w-10 rounded object-cover" alt="" /> : <div className="h-10 w-10 rounded bg-secondary" />}
    <div className="min-w-0 flex-1">
      <p className="font-medium truncate">{c.nombre}</p>
      <p className="text-xs text-muted-foreground truncate">{c.total_miembros} miembros · {c.descripcion}</p>
    </div>
  </CardContent></Card></Link>;
}

import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/lin/PostCard";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, Rocket, Users, MessagesSquare, Briefcase } from "lucide-react";

const SELECT = `id,tipo,formato,titulo,cuerpo,imagen_url,video_url,tags,
  vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url,tipo,verificado),
  media:media_publicacion(url,es_portada,orden)`;

export default function Landing() {
  const { user, loading } = useAuth();
  const [pubs, setPubs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("publicaciones").select(SELECT)
        .eq("estado", "activa").order("destacada", { ascending: false }).order("created_at", { ascending: false }).limit(6);
      setPubs(data || []);
    })();
  }, []);

  if (loading) return null;
  if (user) return <Navigate to="/lin" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-primary" /><span className="text-lg font-bold tracking-tight">Woref</span></Link>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Iniciar sesión</Link></Button>
            <Button asChild size="sm"><Link to="/auth">Crear cuenta</Link></Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
        <div className="space-y-6 text-center">
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
            La red profesional para construir, conectar y crecer
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Woref reúne emprendedores, empresas, inversores, freelancers y creadores en un solo lugar. Compartí lo que estás haciendo, encontrá socios, conseguí oportunidades.
          </p>
          <div className="flex justify-center gap-3">
            <Button asChild size="lg"><Link to="/auth">Sumarme</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/lin">Explorar feed</Link></Button>
          </div>
        </div>

        <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { i: Sparkles, t: "Match", d: "Encontrá gente afín por skills e industria" },
            { i: Rocket, t: "Proyectos", d: "Mostrá lo que construís y sumá equipo" },
            { i: Users, t: "Comunidades", d: "Espacios temáticos con canales y debate" },
            { i: MessagesSquare, t: "Foro", d: "Preguntá, respondé, compartí recursos" },
            { i: Briefcase, t: "Oportunidades", d: "Hiring, colaboraciones y socios" },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border bg-card p-4">
              <x.i className="mb-2 h-5 w-5 text-primary" />
              <p className="font-semibold">{x.t}</p><p className="text-xs text-muted-foreground">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-2xl px-4 pb-24">
        <h2 className="mb-4 text-2xl font-bold tracking-tight">Lo último en la red</h2>
        {pubs.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay publicaciones. Sé el primero.</p>
          : <div className="space-y-4">{pubs.map((p) => <PostCard key={p.id} pub={p} />)}</div>}
      </section>
    </div>
  );
}

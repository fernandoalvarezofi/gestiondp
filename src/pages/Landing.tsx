import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PostCard } from "@/components/lin/PostCard";
import { supabase } from "@/integrations/supabase/client";
import {
  Rocket, Building2, TrendingUp, Sparkles, Briefcase, Trophy,
  UserPlus, Send, LineChart,
} from "lucide-react";
import { InstallAppCTA } from "@/components/InstallAppCTA";

const SELECT = `id,tipo,formato,titulo,cuerpo,imagen_url,video_url,tags,
  vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url,tipo,verificado),
  media:media_publicacion(url,es_portada,orden)`;

const PUBLIC_PLACEHOLDERS = [
  {
    id: "ph1", tipo: "lanzamiento", formato: "texto",
    titulo: "Lanzamos nuestra primera versión",
    cuerpo: "Lanzamos nuestra primera versión de la app después de 6 meses de desarrollo. Buscamos early adopters.",
    total_likes: 24, total_comentarios: 8, total_repostes: 3, vistas: 410,
    created_at: new Date().toISOString(),
    perfil: { id: "x", nombre: "María García", username: "mariagarcia", avatar_url: "", tipo: "emprendedor", verificado: true },
    media: [],
  },
  {
    id: "ph2", tipo: "busco_socio", formato: "texto",
    titulo: "Buscamos CTO cofundador",
    cuerpo: "Buscamos CTO con experiencia en IA para unirse como cofundador. Proyecto con tracción.",
    total_likes: 41, total_comentarios: 15, total_repostes: 6, vistas: 820,
    created_at: new Date().toISOString(),
    perfil: { id: "y", nombre: "TechFlow", username: "techflow", avatar_url: "", tipo: "empresa", verificado: true },
    media: [],
  },
  {
    id: "ph3", tipo: "logro", formato: "texto",
    titulo: "Primer contrato cerrado",
    cuerpo: "Cerré mi primer contrato de USD 5.000 trabajando de forma independiente. Gracias a todos los que me apoyaron.",
    total_likes: 89, total_comentarios: 22, total_repostes: 11, vistas: 1200,
    created_at: new Date().toISOString(),
    perfil: { id: "z", nombre: "Lucas Fernández", username: "lucasf", avatar_url: "", tipo: "freelancer", verificado: false },
    media: [],
  },
];

export default function Landing() {
  const { user, loading } = useAuth();
  const [pubs, setPubs] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("publicaciones").select(SELECT)
        .eq("estado", "activa").order("destacada", { ascending: false }).order("created_at", { ascending: false }).limit(3);
      setPubs(data && data.length ? data : []);
    })();
  }, []);

  if (loading) return null;
  if (user) return <Navigate to="/lin" replace />;

  const shown = pubs.length ? pubs : PUBLIC_PLACEHOLDERS;

  return (
    <div className="min-h-screen bg-background">
      {/* NAV */}
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-lg font-bold tracking-tight">Woref</span>
          </Link>
          <div className="flex gap-2">
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Iniciar sesión</Link></Button>
            <Button asChild size="sm"><Link to="/auth">Crear cuenta</Link></Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <div className="space-y-6">
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Donde los que construyen se encuentran
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              La red profesional para emprendedores, empresas, inversores y creadores. Mostrá lo que hacés, encontrá socios, conseguí oportunidades reales.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg"><Link to="/auth">Empezar gratis</Link></Button>
              <Button asChild size="lg" variant="outline"><Link to="/lin">Ver la red</Link></Button>
              <InstallAppCTA variant="hero" />
            </div>
          </div>

          {/* SVG NETWORK ILLUSTRATION */}
          <div className="relative flex items-center justify-center">
            <svg viewBox="0 0 400 400" className="h-72 w-full max-w-md text-primary sm:h-96">
              <defs>
                <radialGradient id="nodeG" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.4" />
                </radialGradient>
              </defs>
              <g stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5">
                <line x1="200" y1="200" x2="80" y2="90" />
                <line x1="200" y1="200" x2="330" y2="100" />
                <line x1="200" y1="200" x2="70" y2="280" />
                <line x1="200" y1="200" x2="320" y2="310" />
                <line x1="200" y1="200" x2="200" y2="40" />
                <line x1="200" y1="200" x2="200" y2="360" />
                <line x1="80" y1="90" x2="200" y2="40" />
                <line x1="330" y1="100" x2="200" y2="40" />
                <line x1="70" y1="280" x2="200" y2="360" />
                <line x1="320" y1="310" x2="200" y2="360" />
              </g>
              <g fill="url(#nodeG)">
                <circle cx="200" cy="200" r="28" style={{ animation: "worefPulse 3s ease-in-out infinite" }} />
                <circle cx="80" cy="90" r="14" style={{ animation: "worefFloat 5s ease-in-out infinite" }} />
                <circle cx="330" cy="100" r="14" style={{ animation: "worefFloat 6s ease-in-out infinite", animationDelay: "1s" }} />
                <circle cx="70" cy="280" r="14" style={{ animation: "worefFloat 5.5s ease-in-out infinite", animationDelay: "0.5s" }} />
                <circle cx="320" cy="310" r="14" style={{ animation: "worefFloat 6.5s ease-in-out infinite", animationDelay: "1.5s" }} />
                <circle cx="200" cy="40" r="10" style={{ animation: "worefFloat 4s ease-in-out infinite", animationDelay: "0.3s" }} />
                <circle cx="200" cy="360" r="10" style={{ animation: "worefFloat 4.5s ease-in-out infinite", animationDelay: "1.2s" }} />
              </g>
              <style>{`
                @keyframes worefPulse { 0%,100%{transform:scale(1);transform-origin:200px 200px} 50%{transform:scale(1.08);transform-origin:200px 200px} }
                @keyframes worefFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
              `}</style>
            </svg>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y bg-secondary/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 md:grid-cols-4">
          {[
            { n: "10K+", l: "Miembros" },
            { n: "500+", l: "Proyectos" },
            { n: "200+", l: "Oportunidades" },
            { n: "50+", l: "Comunidades" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-3xl font-bold tracking-tight sm:text-4xl">{s.n}</p>
              <p className="mt-1 text-sm text-muted-foreground">{s.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PARA QUIÉN */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Para quién es Woref</h2>
          <p className="mt-2 text-muted-foreground">Una red pensada para los que mueven la aguja.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { i: Rocket, t: "Emprendedores", d: "Compartí tu proyecto, sumá equipo y conseguí los primeros usuarios." },
            { i: Building2, t: "Empresas y Pymes", d: "Mostrá lo que hacés, contratá talento y abrí nuevos negocios." },
            { i: TrendingUp, t: "Inversores", d: "Descubrí proyectos con tracción antes que nadie." },
            { i: Sparkles, t: "Creadores", d: "Construí audiencia, monetizá y colaborá con marcas." },
            { i: Briefcase, t: "Freelancers", d: "Conseguí clientes y mostrá tu trabajo en un solo lugar." },
            { i: Trophy, t: "Atletas y marcas", d: "Comunicá logros, sumá sponsors y conectá con tu comunidad." },
          ].map((c) => (
            <Card key={c.t} className="group transition-all hover:bg-gradient-to-br hover:from-primary/5 hover:to-secondary">
              <CardContent className="p-6">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <c.i className="h-5 w-5" />
                </div>
                <p className="font-semibold">{c.t}</p>
                <p className="mt-1 text-sm text-muted-foreground">{c.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section className="bg-secondary/40 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Cómo funciona</h2>
            <p className="mt-2 text-muted-foreground">Tres pasos. Sin vueltas.</p>
          </div>
          <div className="relative grid gap-8 md:grid-cols-3">
            <div className="absolute left-0 right-0 top-7 hidden h-px bg-border md:block" />
            {[
              { n: 1, i: UserPlus, t: "Creá tu perfil", d: "Describí quién sos y qué construís." },
              { n: 2, i: Send, t: "Publicá y conectá", d: "Compartí proyectos, oportunidades y logros." },
              { n: 3, i: LineChart, t: "Crecé", d: "Encontrá socios, clientes e inversores." },
            ].map((p) => (
              <div key={p.n} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-background text-primary">
                  <p.i className="h-6 w-6" />
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Paso {p.n}</p>
                <p className="mt-1 text-lg font-semibold">{p.t}</p>
                <p className="mt-1 max-w-xs text-sm text-muted-foreground">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEED */}
      <section className="mx-auto max-w-2xl px-4 py-16">
        <h2 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">Esto está pasando en Woref ahora mismo</h2>
        <div className="space-y-4">
          {shown.map((p) => <PostCard key={p.id} pub={p as any} />)}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">¿Listo para hacer crecer tu negocio?</h2>
          <p className="mx-auto mt-3 max-w-xl text-primary-foreground/80">
            Sumate gratis y empezá a conectar con los que están construyendo.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6 bg-background text-foreground hover:bg-background/90">
            <Link to="/auth">Crear cuenta gratis</Link>
          </Button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row">
          <p>Woref · La red donde los negocios crecen</p>
          <div className="flex gap-4">
            <Link to="/" className="hover:text-foreground">Términos</Link>
            <Link to="/" className="hover:text-foreground">Privacidad</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

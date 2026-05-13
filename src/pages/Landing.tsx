import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostCard } from "@/components/lin/PostCard";
import { supabase } from "@/integrations/supabase/client";
import {
  MapPin,
  Search,
  CheckCircle,
  Camera,
  Users,
  Home,
  Briefcase,
  Wrench,
  Calendar,
  Tag,
  Wheat,
} from "lucide-react";
import casaImg from "@/assets/inmo-casa-lincoln.jpg";
import campoImg from "@/assets/inmo-campo-lincoln.jpg";
import plazaImg from "@/assets/inmo-plaza-lincoln.jpg";
import localImg from "@/assets/inmo-local-lincoln.jpg";

const CATEGORIAS = [
  { value: "all", label: "Todo", icon: Search },
  { value: "propiedad", label: "Propiedades", icon: Home },
  { value: "empleo", label: "Empleos", icon: Briefcase },
  { value: "servicio", label: "Servicios", icon: Wrench },
  { value: "evento", label: "Eventos", icon: Calendar },
  { value: "venta_objeto", label: "Ventas", icon: Tag },
  { value: "agro", label: "Agro", icon: Wheat },
];

const BARRIOS = [
  "Centro",
  "Sagrado Corazón",
  "La Rural",
  "Barrio Norte",
  "San José",
  "Barrio Jardín",
];

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-2 rounded-full bg-green-500" />
      <span className="font-bold text-lg tracking-tight text-foreground">
        Linqueño
      </span>
    </div>
  );
}

export default function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [showNav, setShowNav] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [categoria, setCategoria] = useState("all");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const onScroll = () => setShowNav(window.scrollY > 100);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    (async () => {
      setPostsLoading(true);
      const { data } = await (supabase as any)
        .from("publicaciones")
        .select(`
          id,tipo,titulo,descripcion,tipo_operacion,tipo_propiedad,precio,moneda,precio_negociable,
          ambientes,dormitorios,banos,cochera,superficie_total,hectareas,
          vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,referencia,
          perfil:perfiles!perfil_id(id,nombre,slug,avatar_url,tipo,verificado,whatsapp),
          barrio:barrios!barrio_id(nombre,zona),
          media:media_publicacion(url,es_portada,orden)
        `)
        .eq("estado", "activa")
        .order("destacada", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6);
      setPosts(data || []);
      setPostsLoading(false);
    })();
  }, []);

  if (!loading && session) return <Navigate to="/lin" replace />;

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (busqueda.trim()) params.set("q", busqueda.trim());
    if (categoria !== "all") params.set("tipo", categoria);
    navigate(`/lin/buscar?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* ─── Nav ─── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 md:px-12 bg-white/95 backdrop-blur-sm shadow-sm transition-all duration-300 ${
          showNav ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        <Logo />
        <div className="flex items-center gap-3">
          {session ? (
            <Link to="/lin">
              <Button size="sm" className="rounded-full px-5">
                Ir al feed
              </Button>
            </Link>
          ) : (
            <>
              <Link to="/auth">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                >
                  Iniciar sesión
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="rounded-full px-5">
                  Publicar gratis
                </Button>
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden min-h-[600px] md:min-h-[700px]">
        {/* Collage background */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
          <img
            src={casaImg}
            alt="Casa en Lincoln"
            className="h-full w-full object-cover"
          />
          <img
            src={campoImg}
            alt="Campo en Lincoln"
            className="h-full w-full object-cover"
          />
          <img
            src={plazaImg}
            alt="Plaza de Lincoln"
            className="h-full w-full object-cover"
          />
          <img
            src={localImg}
            alt="Local comercial en Lincoln"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-black/60" />

        <div className="relative z-10 px-6 md:px-12 lg:px-20 py-24 md:py-36">
          <div className="mx-auto max-w-3xl text-center text-white">
            <div className="mb-6 flex items-center justify-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
              <span className="font-bold text-xl tracking-tight">Linqueño</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
              Todo lo que pasa en Lincoln, en un solo lugar
            </h1>
            <p className="text-lg md:text-xl text-white/80 max-w-xl mx-auto mb-10">
              Propiedades, empleos, servicios, eventos y más — de tu ciudad, para
              tu ciudad.
            </p>

            {/* Buscador */}
            <form
              onSubmit={handleBuscar}
              className="mx-auto flex max-w-xl flex-col gap-3 sm:flex-row"
            >
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="h-11 rounded-xl border-0 bg-white/20 px-4 text-sm text-white backdrop-blur-md outline-none ring-1 ring-white/30 focus:ring-white/60 [&>option]:text-foreground"
              >
                {CATEGORIAS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="¿Qué estás buscando?"
                  className="h-11 border-0 bg-white/20 pl-9 text-white placeholder:text-white/50 backdrop-blur-md ring-1 ring-white/30 focus:ring-white/60"
                />
              </div>
              <Button
                type="submit"
                className="h-11 bg-white text-foreground hover:bg-white/90 rounded-xl px-6 font-semibold"
              >
                Buscar
              </Button>
            </form>

            {/* Chips barrios */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              {BARRIOS.map((b) => (
                <Link
                  key={b}
                  to={`/lin?barrio=${encodeURIComponent(b)}`}
                  className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/90 backdrop-blur-sm transition hover:bg-white/20"
                >
                  <MapPin className="h-3 w-3" />
                  {b}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Lo último en Lincoln ─── */}
      <section className="px-6 md:px-12 lg:px-20 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
              Lo último en Lincoln
            </h2>
            <Link
              to="/lin"
              className="text-sm font-medium text-primary hover:underline"
            >
              Ver todo →
            </Link>
          </div>

          {postsLoading ? (
            <p className="text-center text-sm text-muted-foreground">
              Cargando publicaciones...
            </p>
          ) : posts.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              Todavía no hay publicaciones. ¡Sé el primero en publicar!
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {posts.map((p) => (
                <PostCard key={p.id} pub={p} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ─── Cómo funciona ─── */}
      <section className="px-6 md:px-12 lg:px-20 py-16 md:py-24 bg-secondary/30">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-center mb-12">
            Cómo funciona
          </h2>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <CheckCircle className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Creá tu perfil gratis
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                En segundos, sin costo.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Camera className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Publicá lo que querás
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Propiedades, empleos, eventos, lo que sea.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Users className="h-7 w-7" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Conectate con Lincoln
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Seguí vecinos, comentá, mandá mensajes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Para negocios e inmobiliarias ─── */}
      <section className="px-6 md:px-12 lg:px-20 py-16 md:py-24">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center gap-10 rounded-3xl bg-secondary p-8 md:flex-row md:p-12">
            <div className="flex-1 space-y-5">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Para negocios e inmobiliarias
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Si tenés un negocio, inmobiliaria o servicio en Lincoln, Linqueño
                es tu vidriera digital. Sin intermediarios.
              </p>
              <Link to="/auth">
                <Button className="rounded-full px-6">
                  Quiero mi perfil verificado
                </Button>
              </Link>
            </div>
            <div className="w-full max-w-sm md:w-auto">
              <img
                src={localImg}
                alt="Negocio en Lincoln"
                className="rounded-2xl object-cover w-full aspect-[4/3]"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t px-6 md:px-12 lg:px-20 py-8">
        <div className="mx-auto max-w-5xl flex flex-col items-center gap-4 md:flex-row md:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm font-medium">
              Linqueño · Lincoln, Buenos Aires
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link to="/auth" className="hover:text-foreground transition">
              Términos
            </Link>
            <Link to="/auth" className="hover:text-foreground transition">
              Privacidad
            </Link>
            <span>Hecho en Lincoln para Lincoln.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

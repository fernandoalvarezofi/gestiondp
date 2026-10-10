import { Link } from "react-router-dom";
import { ArrowRight, Check, ChevronDown, Globe, Inbox, LayoutTemplate, Loader2, PencilRuler, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAbrirNegocio, useMisNegocios } from "@/hooks/useMisNegocios";
import { cn } from "@/lib/utils";

const PUNTOS = [
  { icon: LayoutTemplate, tono: "tono-azul", titulo: "Un punto de partida para tu actividad", texto: "Profesionales, estudios, salud, servicios, gastronomía, comercios y portfolios." },
  { icon: PencilRuler, tono: "tono-violeta", titulo: "Editor visual con páginas y secciones", texto: "Cambiás textos, fotos, colores y menú, y publicás cuando quieras." },
  { icon: Inbox, tono: "tono-naranja", titulo: "Consultas directo a tu CRM", texto: "Cada mensaje del formulario queda en Clientes, con aviso y seguimiento." },
];

/**
 * Acciones del creador de sitios según quién mira: crear (sin cuenta lleva a ingresar y vuelve), administrar su sitio
 * o elegir entre varios. Es una entrada real al producto: cada botón abre el alta o el panel del sitio.
 */
export function SitioWebAcciones({ explorar = true, className }: { explorar?: boolean; className?: string }) {
  const { sitios, negocios, cargando } = useMisNegocios();
  const abrir = useAbrirNegocio();
  const crearTienda = negocios.length ? "/app/comercio/nuevo" : "/app/comercio";
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2.5">
        {cargando ? (
          <Button disabled className="rounded-full px-6 font-bold"><Loader2 className="h-4 w-4 animate-spin" />Crear sitio web</Button>
        ) : sitios.length === 1 ? (
          <>
            <Button type="button" className="rounded-full px-6 font-bold" onClick={() => abrir(sitios[0].id)}><Globe className="h-4 w-4" />Administrar mi sitio</Button>
            <Button asChild variant="outline" className="rounded-full font-bold"><Link to="/app/sitio-web/nuevo"><Plus className="h-4 w-4" />Crear otro</Link></Button>
          </>
        ) : sitios.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" className="rounded-full px-6 font-bold"><Globe className="h-4 w-4" />Administrar mis sitios<ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuLabel>¿Qué sitio querés abrir?</DropdownMenuLabel>
              {sitios.map((s) => (
                <DropdownMenuItem key={s.id} onClick={() => abrir(s.id)} className="gap-2.5">
                  <span className="tono-suave tono-azul grid h-8 w-8 shrink-0 place-items-center rounded-lg"><Globe className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{s.nombre}</span><span className="block text-[11px] text-muted-foreground">{s.aprobado ? "Publicado" : "En revisión"}{s.negocio && s.negocio !== s.nombre ? ` · ${s.negocio}` : ""}</span></span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild><Link to="/app/sitio-web/nuevo" className="font-bold"><Plus className="h-4 w-4" />Crear otro sitio</Link></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button asChild className="rounded-full px-6 font-bold"><Link to="/app/sitio-web/nuevo">Crear sitio web<ArrowRight className="h-4 w-4" /></Link></Button>
        )}
        {explorar && <Button asChild variant="ghost" className="rounded-full font-bold"><Link to="/app/sitio-web">Ver qué podés armar</Link></Button>}
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">¿Vendés productos? <Link to={crearTienda} className="font-bold text-foreground underline-offset-4 hover:underline">Creá una tienda online</Link> con catálogo, carrito y pedidos.</p>
    </div>
  );
}

/** Composición ilustrativa: una página de negocio en el navegador, el panel de secciones del editor y una consulta que entra al CRM. */
function Composicion() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[460px] select-none">
      <div className="overflow-hidden rounded-2xl border bg-card shadow-pop">
        <div className="flex items-center gap-1.5 border-b bg-muted/60 px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#F87171]" /><span className="h-2.5 w-2.5 rounded-full bg-brand-yellow" /><span className="h-2.5 w-2.5 rounded-full bg-primary" />
          <span className="ml-2 truncate rounded-full bg-card px-3 py-0.5 text-[10px] font-semibold text-muted-foreground">woref.app/t/estudio-lopez</span>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="flex items-center gap-2"><span className="h-5 w-5 rounded-full bg-[hsl(var(--ink))]" /><span className="h-2 w-16 rounded-full bg-foreground/80" /></span>
          <span className="flex gap-2">{["w-8", "w-10", "w-9"].map((w) => <span key={w} className={cn("h-1.5 rounded-full bg-muted-foreground/40", w)} />)}</span>
        </div>
        <div className="mx-3 rounded-xl bg-[linear-gradient(135deg,hsl(var(--ink))_0%,hsl(var(--primary))_100%)] px-4 py-5 text-white">
          <span className="block h-1.5 w-14 rounded-full bg-brand-yellow" />
          <span className="mt-2.5 block h-3 w-44 rounded-full bg-white/90" />
          <span className="mt-1.5 block h-3 w-32 rounded-full bg-white/90" />
          <span className="mt-3 block h-1.5 w-40 rounded-full bg-white/50" />
          <span className="mt-3.5 inline-flex h-6 items-center rounded-full bg-white px-3 text-[9px] font-extrabold text-foreground">Hacé tu consulta</span>
        </div>
        <div className="grid grid-cols-3 gap-2 p-3">
          {["tono-azul", "tono-violeta", "tono-menta"].map((t) => (
            <div key={t} className="rounded-lg border p-2">
              <span className={cn("tono-suave block h-5 w-5 rounded-md", t)} />
              <span className="mt-2 block h-1.5 w-12 rounded-full bg-foreground/70" />
              <span className="mt-1 block h-1 w-full rounded-full bg-muted-foreground/30" />
              <span className="mt-1 block h-1 w-3/4 rounded-full bg-muted-foreground/30" />
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -right-2 top-14 hidden w-40 rounded-xl border bg-card p-2.5 shadow-pop sm:block lg:-right-6">
        <p className="px-1 text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Secciones</p>
        {["Portada", "Servicios", "Preguntas", "Formulario"].map((s, i) => (
          <p key={s} className={cn("mt-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] font-semibold", i === 3 && "bg-brand-yellow/15 ring-1 ring-brand-yellow")}>
            <span className={cn("h-1.5 w-1.5 rounded-full", i === 3 ? "bg-brand-yellow" : "bg-muted-foreground/40")} />{s}
          </p>
        ))}
      </div>
      <div className="absolute -bottom-4 -left-2 flex items-center gap-2 rounded-xl border bg-card px-3 py-2 shadow-pop lg:-left-6">
        <span className="tono tono-naranja grid h-7 w-7 place-items-center rounded-lg"><Inbox className="h-3.5 w-3.5" /></span>
        <span><span className="block text-[10px] font-extrabold">Nueva consulta</span><span className="flex items-center gap-1 text-[9px] text-muted-foreground"><Check className="h-2.5 w-2.5 text-primary" />Guardada en Clientes</span></span>
      </div>
    </div>
  );
}

/** Bloque destacado de la Home: presenta el creador de sitios web como una función propia de Woref y lleva al producto real. */
export function SitioWebCluster({ className }: { className?: string }) {
  return (
    <section aria-labelledby="sitio-web-titulo" className={cn("overflow-hidden rounded-3xl border bg-card shadow-soft", className)}>
      <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
        <div className="p-6 sm:p-8 lg:py-10 lg:pl-10 lg:pr-2">
          <p className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-muted-foreground">
            <span className="tono tono-azul grid h-7 w-7 place-items-center rounded-lg"><Globe className="h-4 w-4" /></span>Para negocios
          </p>
          <h2 id="sitio-web-titulo" className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-[32px]">Creador de sitios web</h2>
          <p className="mt-2 max-w-xl text-[15px] text-muted-foreground sm:text-base">Creá la página web de tu negocio y administrá tu presencia online desde Woref, con tus clientes y consultas en el mismo lugar.</p>
          <ul className="mt-5 space-y-3">
            {PUNTOS.map(({ icon: Icon, tono, titulo, texto }) => (
              <li key={titulo} className="flex gap-3">
                <span className={cn("tono-suave grid h-9 w-9 shrink-0 place-items-center rounded-xl", tono)}><Icon className="h-[18px] w-[18px]" /></span>
                <span><span className="block text-sm font-extrabold">{titulo}</span><span className="block text-[13px] text-muted-foreground">{texto}</span></span>
              </li>
            ))}
          </ul>
          <SitioWebAcciones className="mt-6" />
        </div>
        <div className="relative h-full bg-muted/50 px-6 pb-10 pt-8 sm:px-10 lg:py-12">
          <Composicion />
        </div>
      </div>
    </section>
  );
}

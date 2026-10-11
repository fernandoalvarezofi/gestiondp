import { Link } from "react-router-dom";
import {
  ArrowRight, CalendarCheck, ChevronDown, Cog, FileText, Globe, Image as ImageIcon, LayoutGrid, LayoutPanelTop, Loader2, Menu, MessageSquareQuote,
  MousePointer2, MousePointerClick, Palette, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, Store, UsersRound, UtensilsCrossed, Zap, Columns2, ClipboardList, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAbrirNegocio, useMisNegocios } from "@/hooks/useMisNegocios";
import { img } from "@/lib/delivery";
import { cn } from "@/lib/utils";

/**
 * Acciones del creador según quién mira: crear (sin cuenta lleva a ingresar y vuelve), administrar su negocio o elegir entre
 * varios. Es una entrada real al producto: cada botón abre el alta o el panel de "Mi tienda".
 */
export function SitioWebAcciones({ explorar = true, className, claro = false }: { explorar?: boolean; className?: string; claro?: boolean }) {
  const { negocios, cargando } = useMisNegocios();
  const abrir = useAbrirNegocio();
  const principal = "h-12 rounded-xl px-6 text-base font-bold";
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      {cargando ? (
        <Button disabled className={principal}><Loader2 className="h-4 w-4 animate-spin" />Crear sitio web</Button>
      ) : negocios.length === 0 ? (
        <Button asChild className={principal}><Link to="/app/crear">Crear sitio web<ArrowRight className="h-5 w-5" /></Link></Button>
      ) : negocios.length === 1 ? (
        <>
          <Button type="button" className={principal} onClick={() => abrir(negocios[0].id)}><Store className="h-5 w-5" />Administrar mi sitio</Button>
          <Button asChild variant="outline" className={cn(principal, "bg-card", claro && "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white")}><Link to="/app/crear"><Plus className="h-5 w-5" />Crear otro</Link></Button>
        </>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button type="button" className={principal}><Store className="h-5 w-5" />Administrar mis sitios<ChevronDown className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel>¿Cuál querés abrir?</DropdownMenuLabel>
            {negocios.map((n) => (
              <DropdownMenuItem key={n.id} onClick={() => abrir(n.id)} className="gap-2.5">
                <span className={cn("tono-suave grid h-8 w-8 shrink-0 place-items-center rounded-lg", n.tipo_sitio === "sitio" ? "tono-azul" : "tono-verde")}>{n.tipo_sitio === "sitio" ? <Globe className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{n.nombre}</span><span className="block text-[11px] text-muted-foreground">{n.aprobado ? "Publicado" : "En revisión"}{n.negocio && n.negocio !== n.nombre ? ` · ${n.negocio}` : ""}</span></span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/app/crear" className="font-bold"><Plus className="h-4 w-4" />Crear otro sitio</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {explorar && (
        <Button asChild variant="outline" className={cn(principal, "bg-card", claro && "border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white")}>
          <Link to="/app/sitio-web"><LayoutGrid className="h-5 w-5" />Explorar plantillas</Link>
        </Button>
      )}
    </div>
  );
}

const FUNCIONES = [
  { icon: Sparkles, texto: "Diseños personalizables" },
  { icon: MousePointer2, texto: "Editor visual avanzado" },
  { icon: Users, texto: "Formularios y CRM integrado" },
  { icon: Search, texto: "SEO y dominio" },
];
const BLOQUES = [
  { icon: LayoutPanelTop, texto: "Portada" }, { icon: Columns2, texto: "Texto e imagen" }, { icon: ImageIcon, texto: "Galería" },
  { icon: UsersRound, texto: "Servicios" }, { icon: ClipboardList, texto: "Formulario" }, { icon: MessageSquareQuote, texto: "Testimonios" },
];
const MENU_EDITOR = [{ icon: FileText, texto: "Páginas" }, { icon: LayoutGrid, texto: "Bloques" }, { icon: Palette, texto: "Diseño" }, { icon: Cog, texto: "Ajustes" }];
const FOTO = img("https://images.unsplash.com/photo-1497366216548-37526070297c", 700);

/**
 * Composición ilustrativa del producto (no es la web de un cliente): el editor de Mi tienda con sus páginas y secciones, el
 * panel para agregar bloques y la misma web en el celular.
 */
function Composicion() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[600px] select-none pb-6 pt-4 lg:pb-10">
      <span className="absolute -right-6 top-6 h-56 w-72 rotate-[-12deg] rounded-[48px] bg-primary/10" />
      <span className="absolute -left-6 bottom-0 h-48 w-60 rounded-[48px] bg-primary/[0.07]" />
      <MousePointerClick className="absolute -top-1 right-[18%] hidden h-9 w-9 rotate-6 text-primary drop-shadow sm:block" />

      {/* Ventana del editor */}
      <div className="relative mr-0 overflow-hidden rounded-2xl border bg-card shadow-pop sm:mr-16">
        <div className="flex items-center gap-1.5 border-b px-3 py-2"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" /><span className="h-2 w-2 rounded-full bg-muted-foreground/30" /><span className="h-2 w-2 rounded-full bg-muted-foreground/30" /><span className="ml-3 h-2 flex-1 rounded-full bg-muted" /></div>
        <div className="flex">
          <ul className="hidden w-[92px] shrink-0 space-y-1 border-r p-2 sm:block">
            {MENU_EDITOR.map(({ icon: I, texto }, i) => <li key={texto} className={cn("flex items-center gap-1.5 rounded-lg px-1.5 py-1.5 text-[9px] font-semibold", i === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground")}><I className="h-3.5 w-3.5" />{texto}</li>)}
          </ul>
          <div className="min-w-0 flex-1 p-2.5">
            <div className="flex items-center justify-between gap-2 px-1 pb-2">
              <span className="text-[9px] font-black">Tu Negocio</span>
              <span className="flex items-center gap-2 text-[7px] text-muted-foreground"><span>Inicio</span><span>Servicios</span><span>Nosotros</span><span>Contacto</span><span className="rounded bg-[hsl(var(--ink))] px-1.5 py-0.5 font-bold text-white">Solicitar</span></span>
            </div>
            <div className="relative overflow-hidden rounded-lg bg-[hsl(var(--ink))]">
              <img src={FOTO} alt="" loading="lazy" className="absolute inset-y-0 right-0 h-full w-3/5 object-cover opacity-90 [mask-image:linear-gradient(to_right,transparent,black_35%)]" />
              <div className="relative max-w-[55%] p-3 text-white">
                <p className="text-[13px] font-black leading-tight">Tu idea, en una gran web</p>
                <p className="mt-1 text-[7px] text-white/75">Diseñá tu presencia online y hacé crecer tu negocio.</p>
                <span className="mt-2 inline-flex items-center gap-0.5 rounded bg-primary px-1.5 py-1 text-[7px] font-bold text-primary-foreground">Conocé más<ArrowRight className="h-2 w-2" /></span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {[{ i: Sparkles, t: "Profesional", x: "Diseño moderno y adaptable." }, { i: ShieldCheck, t: "Fácil de administrar", x: "Sin conocimientos técnicos." }, { i: Zap, t: "Siempre online", x: "Tu sitio disponible 24/7." }].map(({ i: I, t, x }) => (
                <div key={t} className="rounded-lg border p-1.5"><span className="grid h-4 w-4 place-items-center rounded bg-primary/10 text-primary"><I className="h-2.5 w-2.5" /></span><p className="mt-1 text-[7px] font-bold">{t}</p><p className="text-[6px] text-muted-foreground">{x}</p></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Panel "Agregar bloque" */}
      <div className="absolute -right-1 top-3 hidden w-[132px] rounded-xl border bg-card p-2 shadow-pop sm:block">
        <p className="px-0.5 text-[8px] font-bold">Agregar bloque</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1">
          {BLOQUES.map(({ icon: I, texto }) => <span key={texto} className="flex flex-col items-center gap-0.5 rounded-md border bg-muted/40 py-1.5 text-[6.5px] font-semibold text-muted-foreground"><I className="h-3 w-3 text-foreground/70" />{texto}</span>)}
        </div>
      </div>

      {/* Celular */}
      <div className="absolute -bottom-1 right-2 w-[92px] overflow-hidden rounded-[18px] border-[3px] border-[hsl(var(--ink))] bg-card shadow-pop sm:right-6 lg:-bottom-2">
        <div className="flex items-center justify-between px-2 py-1.5"><span className="text-[6.5px] font-black">Tu Negocio</span><Menu className="h-2.5 w-2.5" /></div>
        <div className="bg-[hsl(var(--ink))] p-2 text-white"><p className="text-[8px] font-black leading-tight">Tu idea, en una gran web</p><span className="mt-1 inline-block rounded bg-primary px-1 py-0.5 text-[5.5px] font-bold">Conocé más</span></div>
        <img src={FOTO} alt="" loading="lazy" className="h-12 w-full object-cover" />
      </div>
    </div>
  );
}

const TAMBIEN = [
  { tipo: "tienda", icon: ShoppingBag, texto: "Tienda online" },
  { tipo: "carta", icon: UtensilsCrossed, texto: "Carta digital con QR" },
  { tipo: "servicios", icon: CalendarCheck, texto: "Servicios con turnos" },
] as const;

/** Bloque destacado de la Home: el creador de sitios web de Woref (Mi tienda), con entrada real al alta y al panel. */
export function SitioWebCluster({ className }: { className?: string }) {
  return (
    <section aria-labelledby="sitio-web-titulo" className={cn("overflow-hidden rounded-[28px] border bg-card shadow-soft", className)}>
      <div className="grid items-center gap-6 p-6 sm:p-9 lg:grid-cols-[1.02fr_1fr] lg:gap-8 lg:p-12">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><LayoutPanelTop className="h-7 w-7" /></span>
            <span className="rounded-full bg-primary/10 px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-wider text-primary">Sitios web</span>
          </div>
          <h2 id="sitio-web-titulo" className="mt-5 text-[30px] font-black leading-[1.08] tracking-tight sm:text-[44px]">Creador de sitios web para tu negocio</h2>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">Diseñá y publicá tu página web profesional con herramientas simples y potentes. Mostrá lo que hacés, atraé nuevos clientes y gestioná todo desde Woref.</p>
          <ul className="mt-6 grid max-w-lg grid-cols-2 gap-x-6 gap-y-3.5">
            {FUNCIONES.map(({ icon: I, texto }) => (
              <li key={texto} className="flex items-center gap-2.5 text-sm font-semibold leading-snug text-muted-foreground">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><I className="h-4 w-4" /></span>{texto}
              </li>
            ))}
          </ul>
          <SitioWebAcciones className="mt-7" />
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground">
            <span>También podés crear:</span>
            {TAMBIEN.map(({ tipo, icon: I, texto }) => (
              <Link key={tipo} to={`/app/crear?tipo=${tipo}`} className="inline-flex items-center gap-1 font-bold text-foreground underline-offset-4 hover:text-primary hover:underline"><I className="h-3.5 w-3.5 text-primary" />{texto}</Link>
            ))}
          </p>
        </div>
        <Composicion />
      </div>
    </section>
  );
}

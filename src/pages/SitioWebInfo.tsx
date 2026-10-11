import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CalendarCheck, Check, CreditCard, Globe, LayoutTemplate, QrCode, Search, ShoppingBag, Users, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { NegocioPreview } from "@/components/sitio/SitioPreview";
import { SitioWebAcciones } from "@/components/sitio/SitioWebCluster";
import { Button } from "@/components/ui/button";
import { RUBROS, TIPOS_NEGOCIO, TONO_TIPO, type TipoNegocio } from "@/lib/creador";
import { cn } from "@/lib/utils";

const ICONO: Record<TipoNegocio, LucideIcon> = { tienda: ShoppingBag, carta: UtensilsCrossed, servicios: CalendarCheck, sitio: Globe };
const NOMBRE_EJEMPLO: Record<TipoNegocio, string> = { tienda: "Tu tienda", carta: "Tu restaurante", servicios: "Tu estudio", sitio: "Tu negocio" };
const MI_TIENDA: { icon: LucideIcon; titulo: string; texto: string }[] = [
  { icon: LayoutTemplate, titulo: "Editor visual tipo WordPress", texto: "Páginas, secciones, menú, encabezado y pie. Borradores, versiones y publicación cuando decidas." },
  { icon: ShoppingBag, titulo: "Catálogo completo", texto: "Productos con variantes, stock, colecciones, ofertas e importación desde archivo." },
  { icon: CreditCard, titulo: "Pedidos y cobros", texto: "Carrito, cupones, envío propio o retiro, y seguimiento para el cliente." },
  { icon: CalendarCheck, titulo: "Agenda y turnos", texto: "Reservas en línea, recordatorios, lista de espera y varios profesionales." },
  { icon: Users, titulo: "Clientes (CRM)", texto: "Fichas con historial, etiquetas, seguimientos y consultas del formulario." },
  { icon: Search, titulo: "SEO, dominio y QR", texto: "Títulos para Google, imagen para redes, dominio propio y cartel con QR." },
  { icon: BarChart3, titulo: "Estadísticas", texto: "Visitas, ventas por canal, productos más vendidos y horas pico." },
  { icon: QrCode, titulo: "Carta con QR para mesas", texto: "Tu menú con fotos, sin imprimir cartas nuevas cada vez que cambia un precio." },
];

/** Presentación del creador: qué se puede crear, cómo se ve cada punto de partida (vista previa real) y qué incluye Mi tienda. */
export default function SitioWebInfo() {
  const [tipo, setTipo] = useState<TipoNegocio>("tienda");
  const info = TIPOS_NEGOCIO.find((t) => t.id === tipo)!;
  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pb-20 pt-5 sm:px-6 lg:px-8">
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(120deg,hsl(var(--ink))_0%,hsl(var(--ink)/0.92)_45%,hsl(var(--primary))_120%)] p-6 text-white shadow-soft sm:p-10">
        <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-brand-yellow/20 blur-3xl" />
        <p className="relative inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white/85 ring-1 ring-white/15">Mi tienda · Woref para negocios</p>
        <h1 className="relative mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">Tu negocio en línea, hecho y administrado desde Woref</h1>
        <p className="relative mt-3 max-w-2xl text-base text-white/75 sm:text-lg">Elegí qué querés armar: una tienda online, la carta de tu restaurante con QR, tus servicios con turnos o una página web. Todo con el mismo editor y el mismo panel.</p>
        <SitioWebAcciones explorar={false} claro className="relative mt-6" />
      </section>

      <section aria-labelledby="tipos" className="space-y-4">
        <h2 id="tipos" className="text-xl font-black sm:text-2xl">¿Qué querés crear?</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="Tipos de negocio">
          {TIPOS_NEGOCIO.map((t) => {
            const Icon = ICONO[t.id];
            const activo = tipo === t.id;
            return (
              <button key={t.id} type="button" role="tab" aria-selected={activo} onClick={() => setTipo(t.id)}
                className={cn("rounded-2xl border-2 bg-card p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", activo ? "border-primary shadow-pop" : "border-transparent hover:border-border")}>
                <span className={cn("tono grid h-10 w-10 place-items-center rounded-xl", TONO_TIPO[t.id])}><Icon className="h-5 w-5" /></span>
                <span className="mt-3 block font-extrabold">{t.nombre}</span>
                <span className="mt-1 block text-[13px] text-muted-foreground">{t.bajada}</span>
              </button>
            );
          })}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <NegocioPreview tipo={tipo} rubro={RUBROS[tipo][0].id} datos={{ nombre: NOMBRE_EJEMPLO[tipo] }} slug="tu-negocio" alto={1500} />
          <aside className="space-y-3 rounded-3xl border bg-card p-5 lg:self-start">
            <p className="font-extrabold">{info.nombre}</p>
            <ul className="space-y-1.5 text-sm">{info.incluye.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{x}</li>)}</ul>
            <p className="text-xs text-muted-foreground">La vista previa es el punto de partida real que se crea. Los productos y textos son de ejemplo: los cambiás por los tuyos.</p>
            <Button asChild className="w-full rounded-full font-bold"><Link to={`/app/crear?tipo=${tipo}`}>Empezar<ArrowRight className="h-4 w-4" /></Link></Button>
          </aside>
        </div>
      </section>

      <section aria-labelledby="incluye" className="space-y-4">
        <div><h2 id="incluye" className="text-xl font-black sm:text-2xl">Todo lo que incluye Mi tienda</h2><p className="text-sm text-muted-foreground">Las mismas herramientas para los cuatro tipos; el panel muestra solo lo que corresponde a tu negocio.</p></div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {MI_TIENDA.map(({ icon: I, titulo, texto }) => (
            <li key={titulo} className="rounded-2xl border bg-card p-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><I className="h-[18px] w-[18px]" /></span>
              <p className="mt-3 font-extrabold">{titulo}</p>
              <p className="mt-1 text-[13px] text-muted-foreground">{texto}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="pasos" className="space-y-4">
        <h2 id="pasos" className="text-xl font-black sm:text-2xl">Cómo funciona</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {[
            ["Elegí y completá", "Qué querés crear, tu rubro, tus primeros productos o servicios y la dirección web. Unos minutos."],
            ["Editalo a tu gusto", "Arrancás con un sitio armado para tu rubro y lo cambiás en Mi tienda: textos, fotos, colores, páginas y catálogo."],
            ["Publicá y vendé", "Woref revisa cada negocio antes de que sea público. Después recibís pedidos, reservas y consultas en tu panel."],
          ].map(([t, x], i) => (
            <li key={t} className="rounded-3xl border bg-card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-yellow text-sm font-black text-brand-yellow-foreground">{i + 1}</span>
              <p className="mt-3 font-extrabold">{t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{x}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

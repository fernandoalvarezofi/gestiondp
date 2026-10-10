import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Globe, ShoppingBag } from "lucide-react";
import { SitioPreview } from "@/components/sitio/SitioPreview";
import { SitioWebAcciones } from "@/components/sitio/SitioWebCluster";
import { Button } from "@/components/ui/button";
import { useMisNegocios } from "@/hooks/useMisNegocios";
import { ACTIVIDADES, type Actividad } from "@/lib/sitioWeb";
import { cn } from "@/lib/utils";

const SITIO = [
  "Inicio y páginas propias (Servicios, Nosotros, Contacto y las que sumes)",
  "Editor visual: secciones, textos con formato, fotos, botones, menú, encabezado y pie",
  "Temas completos: tipografías, colores, estilo de botones y tarjetas",
  "Formulario de consultas que crea el contacto y una tarea en tu CRM",
  "Agenda de turnos en línea, si ofrecés servicios con reserva",
  "Borrador, versiones y publicación cuando vos decidas",
  "SEO por página, imagen para redes y solicitud de dominio propio",
];
const TIENDA = [
  "Todo lo del sitio web",
  "Catálogo con variantes, stock, colecciones y precios de oferta",
  "Carrito, checkout y pedidos con seguimiento",
  "Envíos y retiro en el local, cupones y descuentos",
  "Finanzas y liquidaciones, y tu local en el listado de Woref",
];
const PASOS = [
  { n: "1", t: "Elegí tu actividad", x: "Nombre, datos de contacto y la dirección web de tu sitio. Lleva un par de minutos." },
  { n: "2", t: "Editalo a tu gusto", x: "Arrancás con un sitio armado para tu rubro y lo cambiás con el editor visual: textos, fotos, colores y páginas." },
  { n: "3", t: "Publicá y recibí consultas", x: "Woref revisa cada negocio antes de que su sitio sea público. Después, cada consulta te llega al CRM." },
];

/** Presentación del creador de sitios: qué incluye, en qué se diferencia de una tienda online y cómo queda cada punto de partida. */
export default function SitioWebInfo() {
  const [actividad, setActividad] = useState<Actividad>("profesional");
  const { negocios } = useMisNegocios();
  const info = ACTIVIDADES.find((a) => a.id === actividad)!;
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 pb-20 pt-5 sm:px-6 lg:px-8">
      <section className="rounded-3xl border bg-card p-6 shadow-soft sm:p-10">
        <p className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-muted-foreground"><span className="tono tono-azul grid h-7 w-7 place-items-center rounded-lg"><Globe className="h-4 w-4" /></span>Creador de sitios web</p>
        <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight tracking-tight sm:text-5xl">La página web de tu negocio, hecha y administrada desde Woref</h1>
        <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">Presentá tus servicios, contá quién sos y recibí consultas que quedan guardadas en tu CRM. Sin catálogo ni carrito, salvo que quieras vender.</p>
        <SitioWebAcciones explorar={false} className="mt-6" />
      </section>

      <section aria-labelledby="comparar" className="space-y-4">
        <h2 id="comparar" className="text-xl font-black sm:text-2xl">Sitio web o tienda online</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <article className="flex flex-col rounded-3xl border-2 border-primary/40 bg-card p-6">
            <span className="tono tono-azul grid h-11 w-11 place-items-center rounded-xl"><Globe className="h-5 w-5" /></span>
            <h3 className="mt-3 text-lg font-extrabold">Sitio web</h3>
            <p className="text-sm text-muted-foreground">Para profesionales, estudios, consultorios, empresas de servicios, comercios y portfolios que quieren presencia y consultas.</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">{SITIO.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{x}</li>)}</ul>
            <Button asChild className="mt-5 w-fit rounded-full font-bold"><Link to="/app/sitio-web/nuevo">Crear sitio web<ArrowRight className="h-4 w-4" /></Link></Button>
          </article>
          <article className="flex flex-col rounded-3xl border bg-card p-6">
            <span className="tono tono-amarillo grid h-11 w-11 place-items-center rounded-xl"><ShoppingBag className="h-5 w-5" /></span>
            <h3 className="mt-3 text-lg font-extrabold">Tienda online</h3>
            <p className="text-sm text-muted-foreground">Para negocios que venden productos en línea, con o sin envío. Usa el mismo editor, temas y páginas.</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm">{TIENDA.map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{x}</li>)}</ul>
            <Button asChild variant="outline" className="mt-5 w-fit rounded-full font-bold"><Link to={negocios.length ? "/app/comercio/nuevo" : "/app/comercio"}>Crear tienda online</Link></Button>
          </article>
        </div>
        <p className="text-sm text-muted-foreground">¿Empezás con un sitio y después querés vender? Desde el panel activás la tienda online sobre el mismo sitio, sin perder páginas ni diseño.</p>
      </section>

      <section aria-labelledby="modelos" className="space-y-4">
        <div>
          <h2 id="modelos" className="text-xl font-black sm:text-2xl">Elegí un punto de partida</h2>
          <p className="text-sm text-muted-foreground">Es el sitio que se crea para tu actividad, con secciones y páginas reales que después editás. No incluye fotos ni opiniones inventadas: las pone tu negocio.</p>
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Actividades">
          {ACTIVIDADES.map((a) => (
            <button key={a.id} type="button" role="tab" aria-selected={actividad === a.id} onClick={() => setActividad(a.id)}
              className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", actividad === a.id ? "border-transparent bg-[hsl(var(--ink))] text-white" : "bg-card hover:bg-muted")}>
              {a.nombre}
            </button>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
          <SitioPreview actividad={actividad} datos={{ nombre: info.nombre }} slug="tu-negocio" alto={1500} />
          <aside className="space-y-3 rounded-3xl border bg-card p-5 lg:self-start">
            <p className="font-extrabold">{info.nombre}</p>
            <p className="text-sm text-muted-foreground">{info.detalle}.</p>
            <ul className="space-y-1.5 text-sm">
              {["Inicio con presentación, servicios, preguntas y formulario", "Páginas Servicios, Nosotros y Contacto", "Menú armado y tema a juego"].map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{x}</li>)}
            </ul>
            <Button asChild className="w-full rounded-full font-bold"><Link to={`/app/sitio-web/nuevo?actividad=${actividad}`}>Empezar con este modelo</Link></Button>
          </aside>
        </div>
      </section>

      <section aria-labelledby="pasos" className="space-y-4">
        <h2 id="pasos" className="text-xl font-black sm:text-2xl">Cómo funciona</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {PASOS.map((p) => (
            <li key={p.n} className="rounded-3xl border bg-card p-5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-yellow text-sm font-black text-brand-yellow-foreground">{p.n}</span>
              <p className="mt-3 font-extrabold">{p.t}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.x}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

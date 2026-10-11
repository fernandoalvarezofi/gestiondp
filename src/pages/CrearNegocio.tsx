import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, CalendarCheck, Check, CheckCircle2, ExternalLink, Globe, Loader2, Plus, QrCode, ShoppingBag, Trash2, UtensilsCrossed, XCircle, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { NegocioPreview } from "@/components/sitio/SitioPreview";
import { QrPoster } from "@/components/storefront/QrPoster";
import { ColorSwatches, TemplateGrid } from "@/components/storefront/TemplatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAbrirNegocio, useMisNegocios } from "@/hooks/useMisNegocios";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { db, DeliveryStore, errorMessage, slugify } from "@/lib/delivery";
import { datosAlta, type Entrega, inicioNegocio, productosValidos, RUBROS, rubroDe, TIPOS_NEGOCIO, TONO_TIPO, type TipoNegocio } from "@/lib/creador";
import { normalizeTheme, type Plantilla, storefrontPath, storefrontUrl, temaParaGuardar } from "@/lib/storefront";
import { cn } from "@/lib/utils";

const ICONO_TIPO: Record<TipoNegocio, LucideIcon> = { tienda: ShoppingBag, carta: UtensilsCrossed, servicios: CalendarCheck, sitio: Globe };
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const BORRADOR = "woref-alta-negocio";

type FilaProducto = { id: string; nombre: string; precio: string; categoria: string; descripcion: string; imagen_url: string };
type FilaServicio = { id: string; nombre: string; duracion: string; precio: string };
/** Borrador del alta. El `id` se genera una vez y viaja al servidor: reintentar o recargar nunca crea dos negocios. */
type Borrador = {
  id: string; paso: number; tipo: TipoNegocio | null; rubro: string; nombre: string; descripcion: string; telefono: string; whatsapp: string; direccion: string;
  slug: string; slugTocado: boolean; color: string | null; plantilla: Plantilla | null;
  productos: FilaProducto[]; envioPropio: boolean; retiro: boolean; pedidos: boolean; costoEnvio: string; envioDetalle: string;
  servicios: FilaServicio[]; profesional: string; dias: number[]; desde: string; hasta: string;
};
const filaProducto = (categoria = ""): FilaProducto => ({ id: crypto.randomUUID(), nombre: "", precio: "", categoria, descripcion: "", imagen_url: "" });
const filaServicio = (): FilaServicio => ({ id: crypto.randomUUID(), nombre: "", duracion: "30", precio: "" });
const nuevo = (): Borrador => ({
  id: crypto.randomUUID(), paso: 0, tipo: null, rubro: "", nombre: "", descripcion: "", telefono: "", whatsapp: "", direccion: "", slug: "", slugTocado: false, color: null, plantilla: null,
  productos: [filaProducto()], envioPropio: true, retiro: false, pedidos: true, costoEnvio: "", envioDetalle: "",
  servicios: [filaServicio()], profesional: "", dias: [1, 2, 3, 4, 5], desde: "09:00", hasta: "18:00",
});
function leer(): Borrador | null {
  try { const c = window.localStorage.getItem(BORRADOR); const b = c ? (JSON.parse(c) as Borrador) : null; return b && typeof b.id === "string" && Array.isArray(b.productos) ? b : null; } catch { return null; }
}
const limpiarSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 40);
const esTipo = (v: string | null): v is TipoNegocio => Boolean(v && TIPOS_NEGOCIO.some((t) => t.id === v));

/** Pasos según el tipo: elegir tipo, datos del negocio, lo propio de cada tipo y dirección y diseño. */
const pasosDe = (tipo: TipoNegocio | null) => ["Tipo", "Tu negocio", ...(tipo === "tienda" ? ["Productos y entregas"] : tipo === "carta" ? ["Tu carta"] : tipo === "servicios" ? ["Servicios y horarios"] : []), "Dirección y diseño"];

/** Alta de un negocio en Woref (tienda online, carta digital, servicios con turnos o página web). Termina en "Mi tienda". */
export default function CrearNegocio() {
  const [params] = useSearchParams();
  const inicial = useMemo(() => {
    const g = leer() ?? nuevo();
    const t = params.get("tipo");
    return esTipo(t) && !g.tipo ? { ...g, tipo: t, rubro: RUBROS[t][0].id, paso: 1 } : g;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [b, setB] = useState<Borrador>(inicial);
  const [slugEstado, setSlugEstado] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<{ id: string; slug: string; tipo: TipoNegocio; nombre: string; publico?: boolean } | null>(null);
  const enCurso = useRef(false);
  const arriba = useRef<HTMLDivElement>(null);
  const { negocios, recargar } = useMisNegocios();
  const roles = useDeliveryRoles();
  const abrir = useAbrirNegocio();

  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }));
  const pasos = pasosDe(b.tipo);
  const actual = pasos[b.paso] ?? pasos[0];
  const ultimo = b.paso === pasos.length - 1;

  useEffect(() => { if (!creado) try { window.localStorage.setItem(BORRADOR, JSON.stringify(b)); } catch { /* sin almacenamiento */ } }, [b, creado]);
  useEffect(() => { if (!b.slugTocado) setB((x) => ({ ...x, slug: limpiarSlug(slugify(x.nombre)) })); }, [b.nombre, b.slugTocado]);
  // Si el negocio de este borrador ya existe (se creó y la respuesta no llegó, o se recargó), se muestra como creado.
  useEffect(() => {
    const ya = negocios.find((n) => n.id === b.id);
    if (ya && !creado && b.tipo) { setCreado({ id: ya.id, slug: ya.slug ?? b.slug, tipo: b.tipo, nombre: ya.nombre, publico: Boolean(ya.aprobado) }); try { window.localStorage.removeItem(BORRADOR); } catch { /* sin almacenamiento */ } }
  }, [negocios, b.id, b.slug, b.tipo, creado]);
  useEffect(() => {
    if (actual !== "Dirección y diseño") return;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.slug) || b.slug.length < 3) { setSlugEstado(b.slug ? "invalid" : "idle"); return; }
    setSlugEstado("checking");
    let vivo = true;
    const t = window.setTimeout(async () => {
      const { data, error: falla } = await db.rpc("delivery_slug_disponible", { p_slug: b.slug });
      if (vivo) setSlugEstado(falla ? "idle" : data ? "free" : "taken");
    }, 400);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [b.slug, actual]);

  const ir = (paso: number) => { setB((x) => ({ ...x, paso: Math.max(0, Math.min(pasosDe(x.tipo).length - 1, paso)) })); window.setTimeout(() => arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30); };
  const elegirTipo = (tipo: TipoNegocio) => setB((x) => ({ ...x, tipo, rubro: x.tipo === tipo ? x.rubro : RUBROS[tipo][0].id, plantilla: x.tipo === tipo ? x.plantilla : null, retiro: tipo === "carta" ? true : x.retiro, envioPropio: tipo === "carta" ? false : x.envioPropio, pedidos: tipo === "carta" ? false : true }));

  const tipo = b.tipo ?? "tienda";
  const rubro = rubroDe(tipo, b.rubro);
  const wa = b.whatsapp.replace(/\D/g, "");
  const entrega: Entrega = useMemo(() => ({ envioPropio: b.envioPropio, retiro: b.retiro, pedidos: tipo === "tienda" ? true : b.pedidos, envioDetalle: b.envioDetalle }), [b.envioPropio, b.retiro, b.pedidos, b.envioDetalle, tipo]);
  const datos = useMemo(() => ({ nombre: b.nombre, descripcion: b.descripcion, telefono: b.telefono, whatsapp: wa, direccion: b.direccion }), [b.nombre, b.descripcion, b.telefono, wa, b.direccion]);
  const productos = useMemo(() => productosValidos(b.productos), [b.productos]);
  const servicios = useMemo(() => b.servicios.filter((s) => s.nombre.trim().length >= 2 && Number(s.duracion) >= 5).map((s) => ({ nombre: s.nombre.trim().slice(0, 80), duracion_min: Math.min(600, Math.round(Number(s.duracion))), precio: Math.max(0, Number(s.precio) || 0) })), [b.servicios]);
  const productosAMedias = b.productos.some((p) => (p.nombre.trim() || p.precio) && !(p.nombre.trim().length >= 2 && Number(p.precio) > 0));

  const problema: string | null = (() => {
    if (actual === "Tipo") return b.tipo ? null : "Elegí qué querés crear.";
    if (actual === "Tu negocio") return b.nombre.trim().length < 3 ? "Escribí el nombre del negocio (mínimo 3 letras)." : wa && (wa.length < 8 || wa.length > 15) ? "El WhatsApp va con código de país y solo números (8 a 15)." : null;
    if (actual === "Productos y entregas" || actual === "Tu carta") {
      if (productosAMedias) return "Completá nombre y precio de cada producto, o quitá los que estén a medias.";
      if ((tipo === "tienda" || b.pedidos) && !b.envioPropio && !b.retiro) return "Elegí al menos una forma de entrega: envío o retiro.";
      if (b.envioPropio && b.costoEnvio !== "" && Number(b.costoEnvio) < 0) return "Revisá el costo de envío.";
      return null;
    }
    if (actual === "Servicios y horarios") {
      if (!servicios.length) return "Cargá al menos un servicio con nombre y duración.";
      if (b.profesional.trim().length < 2) return "Escribí quién atiende.";
      if (!b.dias.length) return "Elegí los días de atención.";
      if (!(b.desde < b.hasta)) return "El horario de cierre tiene que ser después del de apertura.";
      return null;
    }
    return slugEstado === "free" ? null : slugEstado === "taken" ? "Esa dirección ya está en uso. Probá con otra." : slugEstado === "checking" ? "Verificando la dirección…" : "Elegí una dirección de 3 a 40 letras minúsculas, números o guiones.";
  })();

  const crear = async () => {
    if (enCurso.current || !b.tipo) return;
    enCurso.current = true; setCreando(true); setError(null);
    const { tema, paginas } = inicioNegocio(b.tipo, b.rubro, datos, entrega, b.plantilla ?? undefined);
    const vende = b.tipo === "tienda" || b.tipo === "carta";
    const { data, error: falla } = await db.rpc("negocio_crear", {
      p_id: b.id, p_tipo: b.tipo,
      p_datos: datosAlta(b.tipo, b.rubro, { ...datos, slug: b.slug }, entrega, Number(b.costoEnvio) || 0),
      p_tema: temaParaGuardar(normalizeTheme({ ...tema, color: b.color ?? tema.color })),
      p_paginas: paginas,
      p_productos: vende ? productos : [],
      p_servicios: b.tipo === "servicios" ? servicios : [],
      p_agenda: b.tipo === "servicios" ? { profesional: b.profesional.trim(), dias: b.dias, desde: b.desde, hasta: b.hasta } : null,
    });
    enCurso.current = false; setCreando(false);
    if (falla) {
      const msg = errorMessage(falla);
      setError(msg);
      if (/direcci[oó]n web|slug|duplicate|unique/i.test(msg)) setSlugEstado("taken");
      toast.error(msg);
      return;
    }
    const r = data as { id: string; slug: string; creado: boolean };
    try { window.localStorage.removeItem(BORRADOR); } catch { /* sin almacenamiento */ }
    // Lo que dice la pantalla sale del servidor: una página, una agenda o una carta sin pedidos ya son públicas; una tienda que vende espera la verificación.
    const { data: estado } = await db.from("delivery_comercios").select("aprobado").eq("id", r.id).maybeSingle();
    setCreado({ id: r.id, slug: r.slug, tipo: b.tipo, nombre: b.nombre.trim(), publico: Boolean((estado as { aprobado?: boolean } | null)?.aprobado) });
    toast.success(r.creado ? "¡Listo! Tu negocio quedó creado." : "Tu negocio ya estaba creado: lo abrimos.");
    void recargar(); void roles.refresh();
  };

  if (creado) {
    const url = storefrontUrl(creado.slug);
    const qrStore = { id: creado.id, slug: creado.slug, nombre: creado.nombre, logo_url: null } as unknown as DeliveryStore;
    return (
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6">
        <section className="rounded-3xl border bg-card p-6 shadow-soft sm:p-10" aria-live="polite">
          <div className="text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success"><CheckCircle2 className="h-8 w-8" /></span>
            <h1 className="mt-4 text-2xl font-black sm:text-3xl">{creado.tipo === "tienda" ? "Tu tienda online quedó creada" : creado.tipo === "carta" ? "Tu carta digital quedó creada" : creado.tipo === "servicios" ? "Tu agenda en línea quedó creada" : "Tu página web quedó creada"}</h1>
            <p className="mx-auto mt-2 max-w-xl text-muted-foreground">Se administra desde <span className="font-bold text-foreground">Mi tienda</span>: editor de páginas, temas, {creado.tipo === "servicios" ? "agenda, " : creado.tipo === "sitio" ? "" : "productos, pedidos, "}clientes y estadísticas.</p>
            {creado.publico
              ? <p className="mx-auto mt-4 max-w-lg rounded-xl border border-success/40 bg-success/10 p-3 text-sm"><span className="font-bold">Ya está publicado.</span> Cualquiera puede verlo en tu dirección. Si más adelante querés vender en línea, te vamos a pedir la verificación del titular (CUIT).</p>
              : <p className="mx-auto mt-4 max-w-lg rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm"><span className="font-bold">Todavía no es público.</span> Para vender, Woref verifica al titular antes de mostrar la tienda; mientras tanto podés editarla y verla vos. Cargá el CUIT en Configuración → Verificación.</p>}
            <p className="mt-4 truncate text-sm font-semibold text-muted-foreground">{url.replace(/^https?:\/\//, "")}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button type="button" className="rounded-full px-6 font-bold" onClick={() => abrir(creado.id, "tienda/editor")}>Abrir Mi tienda</Button>
              {(creado.tipo === "tienda" || creado.tipo === "carta") && <Button type="button" variant="outline" className="rounded-full font-bold" onClick={() => abrir(creado.id, "productos")}>{creado.tipo === "carta" ? "Cargar más platos" : "Cargar más productos"}</Button>}
              {creado.tipo === "servicios" && <Button type="button" variant="outline" className="rounded-full font-bold" onClick={() => abrir(creado.id, "turnos")}>Ver la agenda</Button>}
              <Button type="button" variant="outline" className="rounded-full font-bold" onClick={() => abrir(creado.id)}>Ir al panel</Button>
              <Button asChild variant="ghost" className="rounded-full font-bold"><a href={storefrontPath(creado.slug)} target="_blank" rel="noopener noreferrer">Ver cómo se ve<ExternalLink className="h-4 w-4" /></a></Button>
            </div>
          </div>
          {creado.tipo === "carta" && (
            <div className="mt-8 border-t pt-6">
              <h2 className="flex items-center gap-2 text-lg font-extrabold"><QrCode className="h-5 w-5" />El QR de tu carta</h2>
              <p className="mb-4 text-sm text-muted-foreground">Imprimilo y ponelo en las mesas. Lo encontrás siempre en Mi tienda → QR y suscriptores. Funciona apenas tu carta sea pública.</p>
              <QrPoster store={qrStore} url={url} color={b.color ?? rubro.color} title={creado.nombre} carta={!b.pedidos} />
            </div>
          )}
        </section>
      </div>
    );
  }

  const listaProductos = (titulo: string, ayuda: string, placeholderCat: string, conDescripcion: boolean) => (
    <div className="space-y-3">
      <div><h3 className="font-extrabold">{titulo}</h3><p className="text-sm text-muted-foreground">{ayuda}</p></div>
      <ul className="space-y-3">
        {b.productos.map((p, i) => (
          <li key={p.id} className="grid gap-3 rounded-2xl border p-3 sm:grid-cols-[auto_1fr_150px_auto] sm:items-start">
            <ImageUpload label="" folder="productos" shape="square" value={p.imagen_url} onChange={(url) => set("productos", b.productos.map((x) => (x.id === p.id ? { ...x, imagen_url: url } : x)))} className="w-24" />
            <div className="space-y-2">
              <Input aria-label={`Nombre ${i + 1}`} maxLength={120} placeholder="Nombre" value={p.nombre} onChange={(e) => set("productos", b.productos.map((x) => (x.id === p.id ? { ...x, nombre: e.target.value } : x)))} />
              <Input aria-label={`Sección ${i + 1}`} maxLength={60} placeholder={placeholderCat} value={p.categoria} onChange={(e) => set("productos", b.productos.map((x) => (x.id === p.id ? { ...x, categoria: e.target.value } : x)))} />
              {conDescripcion && <Input aria-label={`Descripción ${i + 1}`} maxLength={300} placeholder="Descripción corta (opcional)" value={p.descripcion} onChange={(e) => set("productos", b.productos.map((x) => (x.id === p.id ? { ...x, descripcion: e.target.value } : x)))} />}
            </div>
            <Input aria-label={`Precio ${i + 1}`} type="number" min={0} inputMode="decimal" placeholder="Precio ($)" value={p.precio} onChange={(e) => set("productos", b.productos.map((x) => (x.id === p.id ? { ...x, precio: e.target.value } : x)))} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${i + 1}`} onClick={() => set("productos", b.productos.filter((x) => x.id !== p.id))}><Trash2 className="h-4 w-4" /></Button>
          </li>
        ))}
      </ul>
      {b.productos.length < 40 && <Button type="button" variant="outline" className="rounded-full" onClick={() => set("productos", [...b.productos, filaProducto(b.productos[b.productos.length - 1]?.categoria ?? "")])}><Plus className="h-4 w-4" />Agregar otro</Button>}
    </div>
  );

  return (
    <div ref={arriba} className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
      <header className="rounded-3xl border bg-card p-5 shadow-soft sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Globe className="h-4 w-4" />Crear en Woref · paso {b.paso + 1} de {pasos.length}</p>
          <Link to="/app/sitio-web" className="rounded-full px-3 py-1 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Cancelar</Link>
        </div>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">{actual === "Tipo" ? "¿Qué querés crear?" : actual === "Tu negocio" ? "Contanos de tu negocio" : actual === "Dirección y diseño" ? "Elegí la dirección y el diseño" : actual}</h1>
        <ol className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${pasos.length}, minmax(0, 1fr))` }} aria-label="Pasos">
          {pasos.map((p, i) => (
            <li key={p}>
              <button type="button" disabled={i > b.paso || creando} onClick={() => ir(i)} aria-current={i === b.paso ? "step" : undefined} className={cn("w-full px-1 pb-1 text-left text-[11px] font-bold sm:text-sm", i <= b.paso ? "text-foreground" : "text-muted-foreground")}>
                <span className={cn("mb-1.5 block h-1.5 rounded-full", i < b.paso ? "bg-primary" : i === b.paso ? "bg-brand-yellow" : "bg-muted")} /><span className="line-clamp-1">{p}</span>
              </button>
            </li>
          ))}
        </ol>
      </header>

      <section className="mt-5 rounded-3xl border bg-card p-4 sm:p-7">
        {actual === "Tipo" && (
          <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Qué querés crear">
            {TIPOS_NEGOCIO.map((t) => {
              const Icon = ICONO_TIPO[t.id];
              const elegido = b.tipo === t.id;
              return (
                <button key={t.id} type="button" role="radio" aria-checked={elegido} onClick={() => elegirTipo(t.id)}
                  className={cn("flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", elegido ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:bg-muted")}>
                  <span className="flex items-start gap-3">
                    <span className={cn("tono grid h-12 w-12 shrink-0 place-items-center rounded-xl", TONO_TIPO[t.id])}><Icon className="h-6 w-6" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-lg font-extrabold">{t.nombre}</span><span className="block text-sm text-muted-foreground">{t.bajada}</span></span>
                    {elegido && <Check className="h-5 w-5 shrink-0 text-primary" />}
                  </span>
                  <ul className="grid gap-1 pl-[60px] text-[13px] text-muted-foreground">{t.incluye.map((x) => <li key={x} className="flex gap-1.5"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />{x}</li>)}</ul>
                </button>
              );
            })}
          </div>
        )}

        {actual === "Tu negocio" && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Rubro</Label>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Rubro">
                {RUBROS[tipo].map((r) => <button key={r.id} type="button" role="radio" aria-checked={b.rubro === r.id} onClick={() => setB((x) => ({ ...x, rubro: r.id, plantilla: null, color: null }))} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors", b.rubro === r.id ? "border-primary bg-primary/10" : "hover:bg-muted")}>{r.nombre}</button>)}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="cn-nombre">Nombre del negocio</Label><Input id="cn-nombre" autoFocus maxLength={80} value={b.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej.: La Esquina" /></div>
              <div className="space-y-1.5"><Label htmlFor="cn-tel">Teléfono <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="cn-tel" type="tel" maxLength={40} value={b.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="2355 123456" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="cn-desc">Qué hacés, en una o dos frases <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea id="cn-desc" maxLength={300} className="min-h-[80px]" value={b.descripcion} onChange={(e) => set("descripcion", e.target.value)} /><p className="text-xs text-muted-foreground">Va en la portada, en Google y al compartir el enlace.</p></div>
              <div className="space-y-1.5"><Label htmlFor="cn-wa">WhatsApp <span className="font-normal text-muted-foreground">(opcional, con código de país)</span></Label><Input id="cn-wa" inputMode="numeric" maxLength={20} value={b.whatsapp} onChange={(e) => set("whatsapp", e.target.value.replace(/[^\d]/g, ""))} placeholder="5492355123456" /></div>
              <div className="space-y-1.5"><Label htmlFor="cn-dir">Dirección <span className="font-normal text-muted-foreground">{tipo === "carta" || tipo === "servicios" ? "(recomendada)" : "(opcional)"}</span></Label><Input id="cn-dir" maxLength={200} value={b.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Av. Massey 123, Lincoln" /></div>
            </div>
          </div>
        )}

        {actual === "Productos y entregas" && (
          <div className="space-y-8">
            {listaProductos("Tus primeros productos", "Cargá algunos ahora (opcional). Después sumás variantes, stock, colecciones e importás desde un archivo en Productos.", "Categoría (ej.: Remeras)", false)}
            <div className="space-y-3">
              <h3 className="font-extrabold">¿Cómo entregás?</h3>
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3"><span><span className="block text-sm font-bold">Envío de la tienda</span><span className="block text-xs text-muted-foreground">Vos despachás (moto propia, correo o mensajería) con un costo fijo y cargás el seguimiento.</span></span><Switch checked={b.envioPropio} onCheckedChange={(v) => set("envioPropio", v)} /></label>
              {b.envioPropio && (
                <div className="grid gap-3 rounded-xl bg-muted/50 p-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="cn-envio">Costo del envío ($)</Label><Input id="cn-envio" type="number" min={0} value={b.costoEnvio} onChange={(e) => set("costoEnvio", e.target.value)} placeholder="0 = gratis" /></div>
                  <div className="space-y-1.5"><Label htmlFor="cn-detalle">Qué ve el cliente</Label><Input id="cn-detalle" maxLength={140} value={b.envioDetalle} onChange={(e) => set("envioDetalle", e.target.value)} placeholder="Ej.: Correo Argentino, 3 a 5 días" /></div>
                </div>
              )}
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3"><span><span className="block text-sm font-bold">Retiro en el local</span><span className="block text-xs text-muted-foreground">El cliente pasa a buscar su compra sin costo de envío.</span></span><Switch checked={b.retiro} onCheckedChange={(v) => set("retiro", v)} /></label>
              <p className="text-xs text-muted-foreground">Más adelante podés sumarte a la app de delivery de Woref para que sus repartidores lleven tus pedidos (Configuración → Entrega y zona).</p>
            </div>
          </div>
        )}

        {actual === "Tu carta" && (
          <div className="space-y-8">
            {listaProductos("Tus platos", "Cargá algunos platos con foto y sección (Entradas, Platos, Postres, Bebidas…). El resto lo sumás desde Productos.", "Sección (ej.: Platos)", true)}
            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3"><span><span className="block text-sm font-bold">Tomar pedidos en línea</span><span className="block text-xs text-muted-foreground">Apagado: la carta muestra platos y precios, ideal para las mesas con QR. Encendido: además se puede pedir.</span></span><Switch checked={b.pedidos} onCheckedChange={(v) => set("pedidos", v)} /></label>
              {b.pedidos && (
                <div className="space-y-3 rounded-xl bg-muted/50 p-3">
                  <label className="flex items-center justify-between gap-3"><span className="text-sm font-bold">Retiro en el local (take away)</span><Switch checked={b.retiro} onCheckedChange={(v) => set("retiro", v)} /></label>
                  <label className="flex items-center justify-between gap-3"><span className="text-sm font-bold">Envío propio (delivery del local)</span><Switch checked={b.envioPropio} onCheckedChange={(v) => set("envioPropio", v)} /></label>
                  {b.envioPropio && <div className="max-w-xs space-y-1.5"><Label htmlFor="cn-envio-c">Costo del envío ($)</Label><Input id="cn-envio-c" type="number" min={0} value={b.costoEnvio} onChange={(e) => set("costoEnvio", e.target.value)} /></div>}
                </div>
              )}
            </div>
          </div>
        )}

        {actual === "Servicios y horarios" && (
          <div className="space-y-8">
            <div className="space-y-3">
              <div><h3 className="font-extrabold">Tus servicios</h3><p className="text-sm text-muted-foreground">Nombre, duración y precio. Después sumás fotos, señas, cupos y más profesionales desde la agenda.</p></div>
              <ul className="space-y-2">
                {b.servicios.map((s, i) => (
                  <li key={s.id} className="grid grid-cols-[1fr_96px_120px_auto] items-center gap-2">
                    <Input aria-label={`Servicio ${i + 1}`} maxLength={80} placeholder="Ej.: Corte de pelo" value={s.nombre} onChange={(e) => set("servicios", b.servicios.map((x) => (x.id === s.id ? { ...x, nombre: e.target.value } : x)))} />
                    <Input aria-label={`Minutos ${i + 1}`} type="number" min={5} max={600} step={5} value={s.duracion} onChange={(e) => set("servicios", b.servicios.map((x) => (x.id === s.id ? { ...x, duracion: e.target.value } : x)))} />
                    <Input aria-label={`Precio ${i + 1}`} type="number" min={0} placeholder="Precio ($)" value={s.precio} onChange={(e) => set("servicios", b.servicios.map((x) => (x.id === s.id ? { ...x, precio: e.target.value } : x)))} />
                    <Button type="button" variant="ghost" size="icon" aria-label={`Quitar ${i + 1}`} onClick={() => set("servicios", b.servicios.filter((x) => x.id !== s.id))}><Trash2 className="h-4 w-4" /></Button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">La segunda columna es la duración en minutos.</p>
              {b.servicios.length < 10 && <Button type="button" variant="outline" className="rounded-full" onClick={() => set("servicios", [...b.servicios, filaServicio()])}><Plus className="h-4 w-4" />Agregar servicio</Button>}
            </div>
            <div className="space-y-3">
              <h3 className="font-extrabold">¿Quién atiende y cuándo?</h3>
              <div className="max-w-sm space-y-1.5"><Label htmlFor="cn-prof">Nombre de quien atiende</Label><Input id="cn-prof" maxLength={80} value={b.profesional} onChange={(e) => set("profesional", e.target.value)} placeholder="Ej.: Ana" /></div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Días de atención">
                {DIAS.map((d, i) => <button key={d} type="button" aria-pressed={b.dias.includes(i)} onClick={() => set("dias", b.dias.includes(i) ? b.dias.filter((x) => x !== i) : [...b.dias, i].sort())} className={cn("h-10 w-14 rounded-xl border text-sm font-bold", b.dias.includes(i) ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{d}</button>)}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1.5"><Label htmlFor="cn-desde">Desde</Label><Input id="cn-desde" type="time" value={b.desde} onChange={(e) => set("desde", e.target.value)} className="w-32" /></div>
                <div className="space-y-1.5"><Label htmlFor="cn-hasta">Hasta</Label><Input id="cn-hasta" type="time" value={b.hasta} onChange={(e) => set("hasta", e.target.value)} className="w-32" /></div>
              </div>
            </div>
          </div>
        )}

        {actual === "Dirección y diseño" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
            <div className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="cn-slug">Dirección web</Label>
                <div className="flex items-center overflow-hidden rounded-xl border bg-background pl-3 text-sm focus-within:ring-2 focus-within:ring-ring">
                  <span className="shrink-0 text-muted-foreground">{storefrontUrl("").replace(/^https?:\/\//, "")}</span>
                  <input id="cn-slug" value={b.slug} onChange={(e) => setB((x) => ({ ...x, slugTocado: true, slug: limpiarSlug(e.target.value) }))} className="h-11 min-w-0 flex-1 bg-transparent px-1 font-semibold outline-none" aria-describedby="cn-slug-estado" />
                  <span className="px-3">{slugEstado === "checking" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : slugEstado === "free" ? <CheckCircle2 className="h-5 w-5 text-success" /> : slugEstado === "taken" || slugEstado === "invalid" ? <XCircle className="h-5 w-5 text-destructive" /> : null}</span>
                </div>
                <p id="cn-slug-estado" role="status" className={cn("text-xs", slugEstado === "free" ? "text-success" : slugEstado === "taken" || slugEstado === "invalid" ? "text-destructive" : "text-muted-foreground")}>{slugEstado === "free" ? "¡Está libre!" : slugEstado === "taken" ? "Ya está en uso, probá con otra." : slugEstado === "invalid" ? "Usá de 3 a 40 letras minúsculas, números o guiones." : "Conviene no cambiarla después: se rompen los enlaces y los QR."}</p>
              </div>
              <div><p className="mb-2 text-sm font-bold">Diseño</p><TemplateGrid value={b.plantilla ?? rubro.plantilla} color={b.color ?? rubro.color} onChange={(id) => set("plantilla", id)} /></div>
              <div><p className="mb-2 text-sm font-bold">Color de tu marca</p><ColorSwatches value={b.color ?? rubro.color} onChange={(c) => set("color", c)} /></div>
              <p className="text-xs text-muted-foreground">Al crear aceptás los <Link to="/terminos" target="_blank" className="font-semibold underline">Términos y condiciones</Link> y la <Link to="/privacidad" target="_blank" className="font-semibold underline">Política de privacidad</Link>. Las tiendas que venden se publican después de verificar al titular.</p>
              {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
            </div>
            <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
              <p className="mb-2 text-sm font-bold text-muted-foreground">Así va a quedar (lo editás después en Mi tienda)</p>
              <NegocioPreview tipo={tipo} rubro={b.rubro} datos={datos} slug={b.slug} color={b.color ?? undefined} plantilla={b.plantilla ?? undefined} entrega={entrega} productos={productos} servicios={servicios} costoEnvio={Number(b.costoEnvio) || 0} />
            </div>
          </div>
        )}
      </section>

      <div className="sticky bottom-20 z-10 mt-5 flex items-center justify-between gap-3 rounded-full border bg-card/95 p-2 pl-3 shadow-pop backdrop-blur md:bottom-3">
        <Button type="button" variant="ghost" className="rounded-full font-bold" onClick={() => ir(b.paso - 1)} disabled={b.paso === 0 || creando}><ArrowLeft className="h-4 w-4" />Atrás</Button>
        <p className="hidden min-w-0 flex-1 truncate text-center text-xs font-semibold text-muted-foreground sm:block" role="status">{problema ?? "Se guarda solo: podés seguir más tarde."}</p>
        {ultimo ? (
          <Button type="button" className="rounded-full px-6 font-bold" onClick={crear} disabled={creando || slugEstado !== "free"}>{creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{creando ? "Creando…" : "Crear"}</Button>
        ) : (
          <Button type="button" className="rounded-full px-6 font-bold" onClick={() => { if (problema) { toast.error(problema); return; } ir(b.paso + 1); }}>Siguiente<ArrowRight className="h-4 w-4" /></Button>
        )}
      </div>
      {problema && <p className="mt-2 text-center text-xs font-semibold text-muted-foreground sm:hidden" role="status">{problema}</p>}
    </div>
  );
}

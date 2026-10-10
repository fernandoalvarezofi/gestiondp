import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Briefcase, Building2, Camera, Check, CheckCircle2, ExternalLink, Globe, HeartPulse, Loader2, PencilRuler, Store, UtensilsCrossed, Wrench, XCircle, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { SitioPreview } from "@/components/sitio/SitioPreview";
import { ColorSwatches } from "@/components/storefront/TemplatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAbrirNegocio, useMisNegocios } from "@/hooks/useMisNegocios";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { db, errorMessage, slugify } from "@/lib/delivery";
import { ACTIVIDADES, type Actividad, actividadInfo, datosParaCrear, sitioInicial } from "@/lib/sitioWeb";
import { normalizeTheme, storefrontPath, storefrontUrl, temaParaGuardar } from "@/lib/storefront";
import { cn } from "@/lib/utils";

const ICONOS: Record<Actividad, LucideIcon> = { profesional: Briefcase, consultora: Building2, salud: HeartPulse, servicios: Wrench, comercio: Store, gastronomia: UtensilsCrossed, portfolio: Camera };
const TONOS: Record<Actividad, string> = { profesional: "tono-tinta", consultora: "tono-violeta", salud: "tono-menta", servicios: "tono-azul", comercio: "tono-naranja", gastronomia: "tono-coral", portfolio: "tono-rosa" };
const PASOS = ["Actividad", "Datos del negocio", "Dirección y estilo"] as const;
const BORRADOR = "woref-alta-sitio";

/** Borrador del alta. El `id` se genera una sola vez y viaja al servidor: reintentar o recargar nunca crea dos sitios. */
type Borrador = { id: string; paso: number; actividad: Actividad | null; nombre: string; descripcion: string; telefono: string; whatsapp: string; direccion: string; slug: string; slugTocado: boolean; color: string | null };
const nuevoBorrador = (): Borrador => ({ id: crypto.randomUUID(), paso: 0, actividad: null, nombre: "", descripcion: "", telefono: "", whatsapp: "", direccion: "", slug: "", slugTocado: false, color: null });
function leerBorrador(): Borrador | null {
  try {
    const crudo = window.localStorage.getItem(BORRADOR);
    const b = crudo ? (JSON.parse(crudo) as Borrador) : null;
    return b && typeof b.id === "string" && typeof b.paso === "number" ? b : null;
  } catch { return null; }
}
const limpiarSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 40);
type Creado = { id: string; slug: string };

/** Alta de un sitio web: actividad, datos mínimos y dirección web, con vista previa real. Termina en el editor del sitio. */
export default function SitioWebNuevo() {
  const [params] = useSearchParams();
  const inicial = useMemo(() => {
    const guardado = leerBorrador() ?? nuevoBorrador();
    const pedida = params.get("actividad") as Actividad | null;
    return pedida && ACTIVIDADES.some((a) => a.id === pedida) && !guardado.actividad ? { ...guardado, actividad: pedida, paso: 1 } : guardado;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [b, setB] = useState<Borrador>(inicial);
  const [slugEstado, setSlugEstado] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState<Creado | null>(null);
  const enCurso = useRef(false);
  const { sitios, negocios, recargar } = useMisNegocios();
  const roles = useDeliveryRoles();
  const abrir = useAbrirNegocio();
  const arriba = useRef<HTMLDivElement>(null);

  // Si el sitio de este borrador ya existe (se creó y la respuesta no llegó, o se recargó la página), se muestra como creado.
  useEffect(() => {
    const ya = negocios.find((n) => n.id === b.id);
    if (ya && !creado) { setCreado({ id: ya.id, slug: ya.slug ?? b.slug }); try { window.localStorage.removeItem(BORRADOR); } catch { /* sin almacenamiento */ } }
  }, [negocios, b.id, b.slug, creado]);
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setB((x) => ({ ...x, [k]: v }));
  useEffect(() => { if (!creado) try { window.localStorage.setItem(BORRADOR, JSON.stringify(b)); } catch { /* sin almacenamiento */ } }, [b, creado]);
  useEffect(() => { if (!b.slugTocado) setB((x) => ({ ...x, slug: limpiarSlug(slugify(x.nombre)) })); }, [b.nombre, b.slugTocado]);
  useEffect(() => {
    if (b.paso !== 2) return;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(b.slug) || b.slug.length < 3) { setSlugEstado(b.slug ? "invalid" : "idle"); return; }
    setSlugEstado("checking");
    let vivo = true;
    const t = window.setTimeout(async () => {
      const { data, error: falla } = await db.rpc("delivery_slug_disponible", { p_slug: b.slug });
      if (vivo) setSlugEstado(falla ? "idle" : data ? "free" : "taken");
    }, 400);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [b.slug, b.paso]);

  const ir = (paso: number) => { setB((x) => ({ ...x, paso: Math.max(0, Math.min(PASOS.length - 1, paso)) })); window.setTimeout(() => arriba.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30); };
  const wa = b.whatsapp.replace(/\D/g, "");
  const problema = b.paso === 0 ? (b.actividad ? null : "Elegí a qué se dedica tu negocio.")
    : b.paso === 1 ? (b.nombre.trim().length < 3 ? "Escribí el nombre del negocio (mínimo 3 letras)." : wa && (wa.length < 8 || wa.length > 15) ? "El WhatsApp va con código de país y solo números (8 a 15)." : null)
    : slugEstado === "free" ? null : slugEstado === "taken" ? "Esa dirección ya está en uso. Probá con otra." : slugEstado === "checking" ? "Verificando la dirección…" : "Elegí una dirección de 3 a 40 letras minúsculas, números o guiones.";
  const actividad = b.actividad ?? "profesional";
  const info = actividadInfo(actividad);
  const datos = useMemo(() => ({ nombre: b.nombre, descripcion: b.descripcion, telefono: b.telefono, whatsapp: wa, direccion: b.direccion }), [b.nombre, b.descripcion, b.telefono, wa, b.direccion]);

  const crear = async () => {
    if (enCurso.current || !b.actividad) return;
    enCurso.current = true;
    setCreando(true);
    setError(null);
    const { tema, paginas } = sitioInicial(b.actividad, datos);
    const { data, error: falla } = await db.rpc("sitio_crear", {
      p_id: b.id,
      p_datos: datosParaCrear(b.actividad, { ...datos, slug: b.slug }),
      p_tema: temaParaGuardar(normalizeTheme({ ...tema, color: b.color ?? tema.color })),
      p_paginas: paginas,
    });
    enCurso.current = false;
    setCreando(false);
    if (falla) {
      const msg = errorMessage(falla);
      setError(msg);
      if (/direcci[oó]n web|slug|duplicate|unique/i.test(msg)) { setSlugEstado("taken"); }
      toast.error(msg);
      return;
    }
    const r = data as { id: string; slug: string; creado: boolean };
    try { window.localStorage.removeItem(BORRADOR); } catch { /* sin almacenamiento */ }
    setCreado({ id: r.id, slug: r.slug });
    toast.success(r.creado ? "¡Tu sitio quedó creado!" : "Tu sitio ya estaba creado: lo abrimos.");
    void recargar();
    void roles.refresh();
  };

  if (creado) {
    return (
      <div className="mx-auto max-w-2xl px-4 pb-20 pt-8 sm:px-6">
        <section className="rounded-3xl border bg-card p-6 text-center shadow-soft sm:p-10" aria-live="polite">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-success/10 text-success"><CheckCircle2 className="h-8 w-8" /></span>
          <h1 className="mt-4 text-2xl font-black sm:text-3xl">Tu sitio quedó creado</h1>
          <p className="mt-2 text-muted-foreground">Ya tiene inicio, páginas de Servicios, Nosotros y Contacto, menú y formulario de consultas conectado a tu CRM.</p>
          <p className="mx-auto mt-4 max-w-md rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm"><span className="font-bold">Todavía no es público.</span> Woref revisa cada negocio antes de mostrarlo; mientras tanto podés editarlo y verlo vos. Para la aprobación vas a necesitar completar la verificación del titular.</p>
          <p className="mt-4 truncate text-sm font-semibold text-muted-foreground">{storefrontUrl(creado.slug).replace(/^https?:\/\//, "")}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Button type="button" className="rounded-full px-6 font-bold" onClick={() => abrir(creado.id, "tienda/editor")}><PencilRuler className="h-4 w-4" />Abrir el editor</Button>
            <Button type="button" variant="outline" className="rounded-full font-bold" onClick={() => abrir(creado.id)}>Ir al panel del sitio</Button>
            <Button asChild variant="ghost" className="rounded-full font-bold"><a href={storefrontPath(creado.slug)} target="_blank" rel="noopener noreferrer">Ver cómo se ve<ExternalLink className="h-4 w-4" /></a></Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div ref={arriba} className="mx-auto max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8">
      <header className="rounded-3xl border bg-card p-5 shadow-soft sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Globe className="h-4 w-4" />Nuevo sitio web · paso {b.paso + 1} de {PASOS.length}</p>
          <Link to="/app/sitio-web" className="rounded-full px-3 py-1 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">Cancelar</Link>
        </div>
        <h1 className="mt-1 text-2xl font-black sm:text-3xl">{b.paso === 0 ? "¿A qué se dedica tu negocio?" : b.paso === 1 ? "Contanos de tu negocio" : "Elegí la dirección y el estilo"}</h1>
        <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Pasos">
          {PASOS.map((p, i) => (
            <li key={p}>
              <button type="button" disabled={i > b.paso || creando} onClick={() => ir(i)} aria-current={i === b.paso ? "step" : undefined}
                className={cn("w-full rounded-full px-1 pb-1 text-left text-xs font-bold transition-colors sm:text-sm", i <= b.paso ? "text-foreground" : "text-muted-foreground")}>
                <span className={cn("mb-1.5 block h-1.5 rounded-full", i < b.paso ? "bg-primary" : i === b.paso ? "bg-brand-yellow" : "bg-muted")} />{p}
              </button>
            </li>
          ))}
        </ol>
      </header>

      {b.paso === 0 && sitios.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center">
          <p className="min-w-0 flex-1 text-sm"><span className="font-bold">Ya administrás {sitios.length === 1 ? `el sitio “${sitios[0].nombre}”` : `${sitios.length} sitios`}.</span> Podés abrirlo o seguir para crear otro negocio.</p>
          <div className="flex flex-wrap gap-2">{sitios.slice(0, 3).map((s) => <Button key={s.id} type="button" size="sm" variant="outline" className="rounded-full" onClick={() => abrir(s.id)}>Administrar {s.nombre}</Button>)}</div>
        </div>
      )}

      <section className="mt-5 rounded-3xl border bg-card p-4 sm:p-7">
        {b.paso === 0 && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" role="radiogroup" aria-label="Actividad del negocio">
              {ACTIVIDADES.map((a) => {
                const Icon = ICONOS[a.id];
                const elegida = b.actividad === a.id;
                return (
                  <button key={a.id} type="button" role="radio" aria-checked={elegida} onClick={() => set("actividad", a.id)}
                    className={cn("flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", elegida ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:bg-muted")}>
                    <span className={cn("tono grid h-11 w-11 shrink-0 place-items-center rounded-xl", TONOS[a.id])}><Icon className="h-5 w-5" /></span>
                    <span className="min-w-0"><span className="block font-extrabold">{a.nombre}</span><span className="block text-sm text-muted-foreground">{a.detalle}</span></span>
                    {elegida && <Check className="ml-auto h-5 w-5 shrink-0 text-primary" />}
                  </button>
                );
              })}
            </div>
            <p className="rounded-2xl bg-muted/60 p-4 text-sm">¿Querés vender productos en línea, con carrito y pedidos? <Link to="/app/comercio" className="font-bold underline-offset-4 hover:underline">Creá una tienda online</Link>. Si empezás con un sitio, después podés activar la tienda sin perder nada.</p>
          </div>
        )}

        {b.paso === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="sw-nombre">Nombre del negocio</Label><Input id="sw-nombre" autoFocus maxLength={80} value={b.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej.: Estudio López & Asociados" /></div>
            <div className="space-y-1.5"><Label htmlFor="sw-tel">Teléfono <span className="font-normal text-muted-foreground">(opcional)</span></Label><Input id="sw-tel" type="tel" maxLength={40} value={b.telefono} onChange={(e) => set("telefono", e.target.value)} placeholder="2355 123456" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="sw-desc">Qué hacés, en una o dos frases <span className="font-normal text-muted-foreground">(opcional)</span></Label><Textarea id="sw-desc" maxLength={300} className="min-h-[84px]" value={b.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder={info.textos.subtitulo} /><p className="text-xs text-muted-foreground">Va en la portada, en “Nosotros” y en Google. Lo cambiás cuando quieras.</p></div>
            <div className="space-y-1.5"><Label htmlFor="sw-wa">WhatsApp <span className="font-normal text-muted-foreground">(opcional, con código de país)</span></Label><Input id="sw-wa" inputMode="numeric" maxLength={20} value={b.whatsapp} onChange={(e) => set("whatsapp", e.target.value.replace(/[^\d]/g, ""))} placeholder="5492355123456" /></div>
            <div className="space-y-1.5"><Label htmlFor="sw-dir">Dirección <span className="font-normal text-muted-foreground">(opcional, si atendés en un lugar)</span></Label><Input id="sw-dir" maxLength={200} value={b.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Av. Massey 123, Lincoln" /></div>
          </div>
        )}

        {b.paso === 2 && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
            <div className="space-y-6">
              <div className="space-y-1.5">
                <Label htmlFor="sw-slug">Dirección web</Label>
                <div className="flex items-center overflow-hidden rounded-xl border bg-background pl-3 text-sm focus-within:ring-2 focus-within:ring-ring">
                  <span className="shrink-0 text-muted-foreground">{storefrontUrl("").replace(/^https?:\/\//, "")}</span>
                  <input id="sw-slug" value={b.slug} onChange={(e) => setB((x) => ({ ...x, slugTocado: true, slug: limpiarSlug(e.target.value) }))} className="h-11 min-w-0 flex-1 bg-transparent px-1 font-semibold outline-none" aria-describedby="sw-slug-estado" />
                  <span className="px-3">{slugEstado === "checking" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : slugEstado === "free" ? <CheckCircle2 className="h-5 w-5 text-success" /> : slugEstado === "taken" || slugEstado === "invalid" ? <XCircle className="h-5 w-5 text-destructive" /> : null}</span>
                </div>
                <p id="sw-slug-estado" role="status" className={cn("text-xs", slugEstado === "free" ? "text-success" : slugEstado === "taken" || slugEstado === "invalid" ? "text-destructive" : "text-muted-foreground")}>
                  {slugEstado === "free" ? "¡Está libre!" : slugEstado === "taken" ? "Ya está en uso, probá con otra." : slugEstado === "invalid" ? "Usá de 3 a 40 letras minúsculas, números o guiones." : "Conviene no cambiarla después: se rompen los enlaces compartidos."}
                </p>
              </div>
              <div><p className="mb-2 text-sm font-bold">Color de tu marca</p><ColorSwatches value={b.color ?? info.color} onChange={(c) => set("color", c)} /></div>
              <dl className="divide-y rounded-2xl border text-sm">
                {[["Actividad", info.nombre, 0], ["Negocio", b.nombre || "—", 1], ["Contacto", [b.telefono, wa && `WhatsApp ${wa}`].filter(Boolean).join(" · ") || "Solo formulario", 1]].map(([k, v, paso]) => (
                  <div key={String(k)} className="flex items-center gap-3 px-3.5 py-2.5"><dt className="w-24 shrink-0 text-muted-foreground">{k}</dt><dd className="min-w-0 flex-1 truncate font-semibold">{v}</dd><button type="button" className="text-xs font-bold text-primary hover:underline" onClick={() => ir(Number(paso))}>Cambiar</button></div>
                ))}
              </dl>
              <p className="text-xs text-muted-foreground">Al crear tu sitio aceptás los <Link to="/terminos" target="_blank" className="font-semibold underline">Términos y condiciones</Link> y la <Link to="/privacidad" target="_blank" className="font-semibold underline">Política de privacidad</Link>. Woref revisa cada negocio antes de hacerlo público.</p>
              {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
            </div>
            <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
              <p className="mb-2 text-sm font-bold text-muted-foreground">Así va a quedar tu sitio (lo editás después)</p>
              <SitioPreview actividad={actividad} datos={datos} slug={b.slug} color={b.color ?? undefined} alto={1300} />
            </div>
          </div>
        )}
      </section>

      <div className="sticky bottom-20 z-10 mt-5 flex items-center justify-between gap-3 rounded-full border bg-card/95 p-2 pl-3 shadow-pop backdrop-blur md:bottom-3">
        <Button type="button" variant="ghost" className="rounded-full font-bold" onClick={() => ir(b.paso - 1)} disabled={b.paso === 0 || creando}><ArrowLeft className="h-4 w-4" />Atrás</Button>
        <p className="hidden min-w-0 flex-1 truncate text-center text-xs font-semibold text-muted-foreground sm:block" role="status">{problema ?? "Se guarda solo: podés seguir más tarde."}</p>
        {b.paso === PASOS.length - 1 ? (
          <Button type="button" className="rounded-full px-6 font-bold" onClick={crear} disabled={creando || slugEstado !== "free"}>{creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{creando ? "Creando…" : "Crear mi sitio"}</Button>
        ) : (
          <Button type="button" className="rounded-full px-6 font-bold" onClick={() => { if (problema) { toast.error(problema); return; } ir(b.paso + 1); }}>Siguiente<ArrowRight className="h-4 w-4" /></Button>
        )}
      </div>
      {problema && <p className="mt-2 text-center text-xs font-semibold text-muted-foreground sm:hidden" role="status">{problema}</p>}
    </div>
  );
}

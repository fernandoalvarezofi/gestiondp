import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, NavLink, useNavigate, useParams } from "react-router-dom";
import { Check, CheckCircle2, CircleAlert, CloudOff, Copy, ExternalLink, FileText, History, LayoutDashboard, Loader2, LucideIcon, Package, Palette, Pencil, QrCode, Search, Store } from "lucide-react";
import { toast } from "sonner";
import { DesignPanel } from "@/components/storefront/builder/DesignPanel";
import { Campo, Interruptor, Texto } from "@/components/storefront/builder/fields";
import { PreviewPane } from "@/components/storefront/builder/PreviewPane";
import { SiteEditor } from "@/components/storefront/builder/SiteEditor";
import { avisosDelTema, PublishDialog, SeoPanel, VersionsPanel } from "@/components/storefront/builder/StorePanels";
import { useSitio, type Sitio } from "@/components/storefront/builder/useSitio";
import { QrPoster } from "@/components/storefront/QrPoster";
import { ProductosLista } from "@/components/merchant/productos/ProductosLista";
import { SubscribersPanel } from "@/components/storefront/SubscribersPanel";
import { StorefrontStats } from "@/components/storefront/StorefrontStats";
import type { ColeccionTienda, ServicioTienda } from "@/components/storefront/StorefrontView";
import { TemplateGrid } from "@/components/storefront/TemplatePicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { confirmar } from "@/components/ui/dialogos";
import { useAvisoSalida } from "@/hooks/useAvisoSalida";
import { db, DeliverySection, errorMessage, orderSections } from "@/lib/delivery";
import { Diseno, normalizeDiseno, normalizeTheme, paginaDePlantilla, Plantilla, PLANTILLAS, TEMA_BASE, storefrontPath, storefrontUrl, TemaNormalizado } from "@/lib/storefront";
import type { VendedorResumen } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { fetchColecciones } from "@/services/catalogPro";
import { fetchPreparacion, ItemPreparacion, restaurarVersion } from "@/services/storeBuilder";
import { useMerchant } from "./context";

const BASE_TIENDA = "/app/comercio/tienda";
type SeccionTienda = "resumen" | "editor" | "temas" | "productos" | "seo" | "compartir" | "datos" | "versiones";
const SECCIONES_TIENDA: { id: SeccionTienda; texto: string; icono: LucideIcon; grupo: number }[] = [
  { id: "resumen", texto: "Resumen", icono: LayoutDashboard, grupo: 0 },
  { id: "editor", texto: "Editor del sitio", icono: Pencil, grupo: 1 }, { id: "temas", texto: "Temas", icono: Palette, grupo: 1 },
  { id: "productos", texto: "Productos", icono: Package, grupo: 2 }, { id: "seo", texto: "SEO y dominio", icono: Search, grupo: 2 }, { id: "compartir", texto: "QR y suscriptores", icono: QrCode, grupo: 2 },
  { id: "datos", texto: "Datos y redes", icono: Store, grupo: 3 }, { id: "versiones", texto: "Versiones", icono: History, grupo: 3 },
];
/** Direcciones de la versión anterior del constructor: ahora son parte del editor. */
const ANTERIORES: Record<string, SeccionTienda> = { paginas: "editor", menu: "editor" };

/** Lista de lo que conviene tener listo antes de compartir la tienda (la arma el servidor). */
function PreparacionTienda({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<ItemPreparacion[] | null>(null);
  useEffect(() => { fetchPreparacion(storeId).then(setItems).catch(() => setItems([])); }, [storeId]);
  if (!items) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  const lista = items.filter((i) => i.clave !== "borrador");
  if (!lista.length) return null;
  const listos = lista.filter((i) => i.ok).length;
  return (
    <section className="rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-extrabold">Lista para vender</h3><span className="text-sm font-bold text-muted-foreground">{listos} de {lista.length}</span></div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((listos / lista.length) * 100)}%` }} /></div>
      <ul className="mt-4 divide-y">
        {lista.map((i) => (
          <li key={i.clave} className="flex items-start gap-2.5 py-2.5">
            {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <CircleAlert className={cn("mt-0.5 h-4 w-4 shrink-0", i.grave ? "text-destructive" : "text-warning")} />}
            <span><span className="block text-sm font-bold">{i.titulo}</span>{!i.ok && <span className="block text-xs text-muted-foreground">{i.detalle}</span>}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Avisos de contenido de todo el sitio (inicio y páginas visibles). */
function avisosDelSitio(s: Sitio): string[] {
  const out = avisosDelTema(s.tema);
  for (const p of s.paginas) {
    if (p.estado !== "publicada") continue;
    const temaPagina = { ...s.tema, bloques: p.bloques, menu: [] } as TemaNormalizado;
    avisosDelTema(temaPagina).filter((a) => !a.startsWith("La página no tiene portada") && !a.startsWith("La portada")).forEach((a) => out.push(`${p.titulo}: ${a}`));
    if (!p.contenido.trim() && p.bloques.filter((b) => b.visible).length === 0) out.push(`${p.titulo}: la página está vacía.`);
  }
  return [...new Set(out)];
}

/**
 * Mi tienda. Todo el sitio (diseño, inicio, encabezado, pie y páginas) es UN borrador que se guarda solo en el servidor y se
 * publica junto; las secciones de esta pantalla (editor, temas, SEO, datos, versiones) lo comparten.
 */
export default function MerchantStorefront() {
  const { store, products, reviews, loadStore, loadProducts, access } = useMerchant();
  const puedeCatalogo = access.permisos.includes("catalogo");
  const { seccion: seccionParam = "resumen" } = useParams<{ seccion?: string }>();
  const seccion = (ANTERIORES[seccionParam] ?? seccionParam) as SeccionTienda;
  const navigate = useNavigate();
  const irA = useCallback((x: SeccionTienda) => navigate(`${BASE_TIENDA}/${x}`), [navigate]);
  const api = useSitio(store);
  const { sitio, cambiar } = api;

  const [sections, setSections] = useState<DeliverySection[]>([]);
  const [vendedor, setVendedor] = useState<VendedorResumen | null>(null);
  const [servicios, setServicios] = useState<ServicioTienda[]>([]);
  const [colecciones, setColecciones] = useState<ColeccionTienda[]>([]);
  const [publicando, setPublicando] = useState(false);
  const [copied, setCopied] = useState(false);
  const [versionesRef, setVersionesRef] = useState(0);
  const [plantillaElegida, setPlantillaElegida] = useState<Plantilla>(() => normalizeTheme(store.tienda_tema).plantilla);
  const [reemplazarInicio, setReemplazarInicio] = useState(false);
  const [vistaTema, setVistaTema] = useState(false);

  // Al entrar (o cambiar de sucursal) se carga el borrador del sitio; si no hay, lo publicado.
  useEffect(() => {
    api.cargar(store.tienda_tema).then((hay) => { if (hay) toast.info("Retomamos tus cambios sin publicar."); });
  }, [store.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPlantillaElegida(sitio.tema.plantilla); }, [sitio.tema.plantilla]);
  useEffect(() => {
    let alive = true;
    db.from("delivery_secciones").select("*").eq("comercio_id", store.id).then(({ data }: { data: DeliverySection[] | null }) => { if (alive) setSections(data ?? []); });
    db.rpc("delivery_vendedor_resumen", { p_slug: store.slug }).then(({ data }: { data: VendedorResumen | null }) => { if (alive) setVendedor(data ?? null); });
    db.from("servicios").select("id,nombre,descripcion,duracion_min,precio,imagen_url,capacidad").eq("comercio_id", store.id).eq("activo", true).order("orden").then(({ data }: { data: ServicioTienda[] | null }) => { if (alive) setServicios(data ?? []); });
    fetchColecciones(store.id).then((c) => { if (alive) setColecciones(c.filter((x) => x.activa)); }).catch(() => undefined);
    return () => { alive = false; };
  }, [store.id, store.slug]);
  useAvisoSalida(api.guardado !== "listo");

  const url = storefrontUrl(store.slug);
  const categorias = useMemo(() => orderSections(products, sections, true).map((item) => item.name), [products, sections]);
  const productosVisibles = useMemo(() => products.filter((p) => (p.estado ?? "publicado") === "publicado"), [products]);
  const avisos = useMemo(() => avisosDelSitio(sitio), [sitio]);
  const setTema = useCallback((c: Partial<TemaNormalizado>) => cambiar((s) => ({ ...s, tema: { ...s.tema, ...c } })), [cambiar]);
  const setDiseno = useCallback((c: Partial<Diseno> & { color?: string }) => cambiar((s) => {
    const { color, ...resto } = c;
    return { ...s, tema: { ...s.tema, ...(color ? { color } : {}), diseno: { ...s.tema.diseno, ...resto } } };
  }), [cambiar]);

  /** Cambiar de tema cambia el sistema de diseño (tokens y estilo de portada). El contenido se conserva salvo que se pida reemplazar el inicio. */
  const aplicarTema = () => {
    cambiar((s) => {
      const t = s.tema;
      const colorAnterior = PLANTILLAS.find((p) => p.id === t.plantilla)?.color;
      const colorNuevo = PLANTILLAS.find((p) => p.id === plantillaElegida)?.color ?? t.color;
      const sinPersonalizar = t.color === colorAnterior || t.color === TEMA_BASE.color;
      const bloques = reemplazarInicio
        ? paginaDePlantilla(plantillaElegida, { titulo: t.titulo, subtitulo: t.subtitulo, boton: t.boton, banner_url: t.banner_url, acerca: t.acerca })
        : t.bloques.map((b) => (b.tipo === "portada" ? { ...b, estilo: plantillaElegida } : b));
      return { ...s, tema: { ...t, plantilla: plantillaElegida, color: sinPersonalizar ? colorNuevo : t.color, diseno: normalizeDiseno({}, plantillaElegida, t.tipografia), bloques } };
    });
    toast.success(reemplazarInicio ? "Tema e inicio de ejemplo aplicados en el borrador." : "Tema aplicado en el borrador. Tu contenido se mantuvo.", { action: { label: "Deshacer", onClick: api.deshacer } });
    setReemplazarInicio(false);
  };

  const publicar = async (nota: string) => {
    try {
      await api.publicar(nota, loadStore);
      toast.success("¡Sitio publicado! Los cambios ya están en línea.");
      setPublicando(false);
      setVersionesRef((n) => n + 1);
    } catch (error) { toast.error(errorMessage(error)); }
  };
  const descartar = async () => {
    if (!(await confirmar({ titulo: "¿Descartar todos los cambios sin publicar?", descripcion: "El inicio, el diseño y las páginas vuelven a lo que está en línea. Las páginas nuevas que nunca publicaste se borran.", confirmar: "Descartar", peligro: true }))) return;
    await api.descartarTodo(store.tienda_tema);
    toast.success("Cambios descartados");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { toast.info(url); }
  };

  if (!SECCIONES_TIENDA.some((x) => x.id === seccion) || (seccion === "productos" && !puedeCatalogo)) return <Navigate to={`${BASE_TIENDA}/resumen`} replace />;
  if (ANTERIORES[seccionParam]) return <Navigate to={`${BASE_TIENDA}/${seccion}`} replace />;

  const publishDialog = <PublishDialog open={publicando} storeId={store.id} avisosLocales={avisos} onOpenChange={setPublicando} onPublicar={publicar} />;
  const previewData = { store, tema: sitio.tema, products: productosVisibles, sections, reviews, vendedor, servicios, colecciones, paginas: [], reservaHref: servicios.length ? `/t/${store.slug}/reservar` : null };

  if (api.errorCarga) {
    return (
      <div className="mx-auto max-w-md space-y-3 rounded-2xl border bg-card p-6 text-center">
        <CloudOff className="mx-auto h-8 w-8 text-muted-foreground" /><p className="font-extrabold">No pudimos abrir tu tienda</p><p className="text-sm text-muted-foreground">{api.errorCarga}</p>
        <Button className="rounded-full" onClick={() => void api.cargar(store.tienda_tema)}>Reintentar</Button>
      </div>
    );
  }
  if (seccion === "editor") {
    if (!api.cargado) return <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
    return (
      <>
        <SiteEditor api={api} datos={{ store, products, sections, reviews, vendedor, servicios, colecciones, categorias }} onPublicar={() => setPublicando(true)} onSalir={() => irA("resumen")} />
        {publishDialog}
      </>
    );
  }

  const estadoGuardado = api.guardado === "guardando" ? "Guardando borrador…" : api.guardado === "error" ? (api.errorGuardado ?? "No pudimos guardar el borrador") : api.sinPublicar ? "Borrador guardado · sin publicar" : "Todo publicado";
  const paginasVisibles = sitio.paginas.filter((p) => p.estado === "publicada").length;

  let contenido: ReactNode = null;
  if (seccion === "resumen") {
    contenido = (
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <section className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Estado del sitio</p>
            <p className="mt-1 text-xl font-black">{api.sinPublicar ? "Tenés cambios sin publicar" : "Todo lo que ves está publicado"}</p>
            <p className="text-sm text-muted-foreground">{api.sinPublicar ? `${api.temaSinPublicar ? "Diseño o inicio" : ""}${api.temaSinPublicar && api.paginasSinPublicar.length ? " y " : ""}${api.paginasSinPublicar.length ? `${api.paginasSinPublicar.length} ${api.paginasSinPublicar.length === 1 ? "página" : "páginas"}` : ""} con cambios. Nada cambia en línea hasta que publiques.` : "Cuando edites, se guarda un borrador automático del sitio completo."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={() => irA("editor")}><Pencil className="h-4 w-4" />Abrir el editor</Button>
              <Button variant="outline" className="rounded-full" onClick={() => irA("temas")}><Palette className="h-4 w-4" />Temas</Button>
              {api.sinPublicar && <Button variant="outline" className="rounded-full" onClick={() => setPublicando(true)}>Publicar cambios</Button>}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border text-sm sm:grid-cols-4">
              {[["Tema", PLANTILLAS.find((p) => p.id === sitio.tema.plantilla)?.nombre ?? sitio.tema.plantilla], ["Secciones en inicio", String(sitio.tema.bloques.filter((b) => b.visible).length)], ["Páginas visibles", `${paginasVisibles} de ${sitio.paginas.length}`], ["Productos visibles", String(productosVisibles.length)]].map(([k, v]) => (
                <div key={k} className="bg-card p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate font-extrabold">{v}</dd></div>
              ))}
            </dl>
          </section>
          {sitio.paginas.length > 0 && (
            <section className="rounded-2xl border bg-card">
              <h3 className="border-b px-5 py-3 font-extrabold">Páginas</h3>
              <ul className="divide-y">
                {sitio.paginas.map((p) => (
                  <li key={p.clave} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{p.titulo}</span><span className="block truncate text-xs text-muted-foreground">/pagina/{p.slug}</span></span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", p.estado === "publicada" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{p.estado === "publicada" ? "Visible" : "Oculta"}</span>
                    {api.paginasSinPublicar.includes(p.clave) && <span className="rounded-full bg-brand-yellow/20 px-2 py-0.5 text-xs font-bold">Sin publicar</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {avisos.length > 0 && <section className="rounded-2xl border border-warning/40 bg-warning/10 p-5"><h3 className="font-extrabold">Para revisar antes de publicar</h3><ul className="mt-2 space-y-1 text-sm">{avisos.map((a) => <li key={a}>• {a}</li>)}</ul></section>}
          <PreparacionTienda storeId={store.id} />
        </div>
        <aside className="space-y-5">
          <section className="rounded-2xl border bg-card p-5">
            <h3 className="font-extrabold">Visitas</h3>
            <p className="mb-3 text-xs text-muted-foreground">De quienes aceptan cookies de medición.</p>
            <StorefrontStats storeId={store.id} />
          </section>
        </aside>
      </div>
    );
  } else if (seccion === "temas") {
    const elegido = PLANTILLAS.find((p) => p.id === plantillaElegida);
    contenido = (
      <div className="grid gap-6 xl:grid-cols-[minmax(0,560px)_1fr]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border bg-card p-4 sm:p-5">
            <h3 className="font-extrabold">Temas</h3>
            <p className="mb-3 text-sm text-muted-foreground">Un tema es un sistema de diseño completo: tipografías, colores de fondo y superficie, estilo de tarjetas, tamaño de títulos, botones y forma de la portada. Cambiarlo no toca tus secciones, páginas, menú ni textos.</p>
            <TemplateGrid value={plantillaElegida} color={sitio.tema.color} onChange={setPlantillaElegida} />
            {elegido && plantillaElegida !== sitio.tema.plantilla && <p className="mt-3 rounded-xl bg-muted p-3 text-sm"><b>{elegido.nombre}</b> · ideal para {elegido.ideal.toLowerCase()}. {elegido.detalle}</p>}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reemplazarInicio} onChange={(e) => setReemplazarInicio(e.target.checked)} className="h-4 w-4" />Reemplazar también el inicio por el de ejemplo del tema</label>
              <Button type="button" className="rounded-full font-bold" disabled={plantillaElegida === sitio.tema.plantilla && !reemplazarInicio} onClick={aplicarTema}>{plantillaElegida === sitio.tema.plantilla && !reemplazarInicio ? "Es tu tema actual" : "Aplicar tema"}</Button>
            </div>
          </section>
          <section className="rounded-2xl border bg-card p-4 sm:p-5"><h3 className="mb-3 font-extrabold">Ajustar el tema</h3><DesignPanel tema={sitio.tema} onChange={setDiseno} /></section>
        </div>
        <aside className="hidden min-w-0 xl:sticky xl:top-20 xl:block xl:self-start"><PreviewPane data={previewData} selected={null} onSelect={() => irA("editor")} /></aside>
        <Button type="button" variant="outline" className="w-full rounded-full font-bold xl:hidden" onClick={() => setVistaTema(true)}>Ver vista previa</Button>
      </div>
    );
  } else if (seccion === "productos") {
    contenido = (
      <div className="space-y-3">
        <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Solo los productos publicados aparecen en tu tienda. Las colecciones (grupos para promociones o temporadas) se arman en <Link to="/app/comercio/colecciones" className="font-bold text-primary hover:underline">Colecciones</Link>.</p>
        <ProductosLista storeId={store.id} products={products} onChange={loadProducts} />
      </div>
    );
  } else if (seccion === "seo") {
    contenido = <div className="max-w-3xl"><SeoPanel storeId={store.id} storeNombre={store.nombre} storeSlug={store.slug} tema={sitio.tema} onChange={setTema} /></div>;
  } else if (seccion === "datos") {
    contenido = (
      <div className="max-w-3xl space-y-4">
        <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
          <h3 className="font-extrabold">Opiniones</h3>
          <Interruptor label="Mostrar calificaciones y opiniones" value={sitio.tema.mostrar_opiniones} onChange={(mostrar_opiniones) => setTema({ mostrar_opiniones })} />
        </section>
        <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5">
          <h3 className="font-extrabold">Contacto y redes</h3>
          <Campo label="WhatsApp (con código de país, solo números)"><Input inputMode="numeric" maxLength={15} value={sitio.tema.whatsapp ?? ""} placeholder="5492355123456" onChange={(event) => setTema({ whatsapp: event.target.value.replace(/\D/g, "") })} aria-label="WhatsApp" /></Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo label="Instagram (usuario)"><Input maxLength={60} value={sitio.tema.instagram ?? ""} placeholder="mi.tienda" onChange={(event) => setTema({ instagram: event.target.value.replace(/[^A-Za-z0-9._-]/g, "") })} aria-label="Instagram" /></Campo>
            <Campo label="Facebook (usuario)"><Input maxLength={60} value={sitio.tema.facebook ?? ""} placeholder="mi.tienda" onChange={(event) => setTema({ facebook: event.target.value.replace(/[^A-Za-z0-9._-]/g, "") })} aria-label="Facebook" /></Campo>
          </div>
          <Campo label="Sitio web (https://…)"><Input maxLength={200} value={sitio.tema.web ?? ""} placeholder="https://mitienda.com" onChange={(event) => setTema({ web: event.target.value })} aria-label="Sitio web" /></Campo>
          <Texto label="Descripción de la tienda (Sobre nosotros)" value={sitio.tema.acerca} max={800} multiline onChange={(acerca) => setTema({ acerca })} hint="Se usa en las plantillas de inicio y en Google cuando no hay descripción SEO." />
          <p className="text-xs text-muted-foreground">Logo, horarios, dirección y sucursales se cargan en Configuración del local y se ven solos en la tienda.</p>
        </section>
      </div>
    );
  } else if (seccion === "versiones") {
    contenido = (
      <div className="max-w-3xl">
        <VersionsPanel storeId={store.id} refresco={versionesRef} onRestaurar={async (v) => {
          if (!(await confirmar({ titulo: "¿Cargar esta versión como borrador?", descripcion: "El diseño, el inicio y las páginas de esa versión reemplazan tu borrador actual. Nada cambia en línea hasta que publiques.", confirmar: "Cargar versión" }))) return;
          try { await api.guardarAhora(); await restaurarVersion(v.id); await api.cargar(store.tienda_tema); irA("editor"); toast.success("Versión cargada como borrador. Revisala y publicá si querés volver a ella."); }
          catch (error) { toast.error(errorMessage(error)); }
        }} />
      </div>
    );
  } else if (seccion === "compartir") {
    contenido = (
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border bg-card p-4 sm:p-5">
          <h3 className="font-extrabold">Cartel con QR</h3>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Llevá a tus clientes del local a tu tienda online.</p>
          <QrPoster store={store} url={url} color={sitio.tema.color} title={sitio.tema.titulo || store.nombre} />
        </section>
        <SubscribersPanel storeId={store.id} storeSlug={store.slug} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold">Tu tienda online</h2>
          <p className="text-sm text-muted-foreground">Un sitio con páginas, secciones, temas y menú. Todo se guarda como borrador; nada cambia en línea hasta que publiques.</p>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-xl border bg-card p-1.5 pl-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-semibold">{url.replace(/^https?:\/\//, "")}</span>
          <Button type="button" size="sm" variant="ghost" className="shrink-0 rounded-full" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiado" : "Copiar"}</Button>
          <Button asChild size="sm" variant="outline" className="shrink-0 rounded-full"><a href={storefrontPath(store.slug)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Abrir</a></Button>
        </div>
      </section>

      <nav aria-label="Secciones de la tienda" className="scrollbar-none -mx-1 flex items-center gap-1 overflow-x-auto border-b px-1">
        {SECCIONES_TIENDA.filter((x) => x.id !== "productos" || puedeCatalogo).map((x, i, lista) => (
          <span key={x.id} className="flex shrink-0 items-center">
            {i > 0 && lista[i - 1].grupo !== x.grupo && <span aria-hidden className="mx-1 h-4 w-px bg-border" />}
            <NavLink to={`${BASE_TIENDA}/${x.id}`} className={({ isActive }) => cn("-mb-px flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-sm font-bold transition-colors", isActive ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              <x.icono className="h-4 w-4" />{x.texto}
            </NavLink>
          </span>
        ))}
      </nav>

      {!api.cargado ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : contenido}

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card/95 p-2 pl-4 shadow-pop backdrop-blur">
        <span className={cn("flex min-w-0 items-center gap-2 text-sm font-semibold text-muted-foreground", api.guardado === "error" && "text-destructive")}>
          {api.guardado === "guardando" ? <Loader2 className="h-4 w-4 animate-spin" /> : api.guardado === "error" ? <CloudOff className="h-4 w-4" /> : null}
          <span className="truncate">{estadoGuardado}</span>
        </span>
        <div className="flex items-center gap-1.5">
          {api.sinPublicar && <Button type="button" variant="ghost" className="rounded-full" onClick={descartar}>Descartar</Button>}
          <Button type="button" className="rounded-full font-bold" onClick={() => setPublicando(true)} disabled={!api.sinPublicar}>Publicar</Button>
        </div>
      </div>

      {publishDialog}
      <Dialog open={vistaTema} onOpenChange={setVistaTema}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Vista previa</DialogTitle>
          <DialogDescription className="sr-only">Así se ve tu tienda con el tema actual.</DialogDescription>
          {vistaTema && <PreviewPane data={previewData} selected={null} onSelect={() => undefined} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

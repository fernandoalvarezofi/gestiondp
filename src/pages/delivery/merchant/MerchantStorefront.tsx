import { DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, CloudOff, Copy, ExternalLink, Eye, EyeOff, GripVertical, LayoutTemplate, Loader2, Monitor, Plus, Redo2, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { BlockSettings } from "@/components/storefront/builder/BlockSettings";
import { DesignPanel, serializarTema } from "@/components/storefront/builder/DesignPanel";
import { Campo, Interruptor, Texto } from "@/components/storefront/builder/fields";
import { PagesPanel, PaginaEnEdicion } from "@/components/storefront/builder/PagesPanel";
import { PreviewPane } from "@/components/storefront/builder/PreviewPane";
import { avisosDelTema, NavigationPanel, PublishDialog, SeoPanel, VersionsPanel } from "@/components/storefront/builder/StorePanels";
import { QrPoster } from "@/components/storefront/QrPoster";
import { MerchantMenu } from "@/components/merchant/MerchantMenu";
import { SubscribersPanel } from "@/components/storefront/SubscribersPanel";
import { StorefrontStats } from "@/components/storefront/StorefrontStats";
import type { ColeccionTienda, PaginaTienda, ServicioTienda } from "@/components/storefront/StorefrontView";
import { TemplateGrid } from "@/components/storefront/TemplatePicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db, DeliverySection, errorMessage, orderSections } from "@/lib/delivery";
import { Bloque, bloqueNuevo, Diseno, MAX_BLOQUES, nuevoId, normalizeDiseno, normalizeTheme, paginaDePlantilla, Plantilla, PLANTILLAS, TEMA_BASE, storefrontPath, storefrontUrl, temaParaGuardar, TemaNormalizado, TIPOS_BLOQUE } from "@/lib/storefront";
import type { Vista } from "@/lib/storeRoutes";
import type { VendedorResumen } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { fetchColecciones } from "@/services/catalogPro";
import { descartarBorrador, fetchBorrador, fetchPaginas, guardarBorrador, Pagina, publicarTienda, restaurarVersion } from "@/services/storeBuilder";
import { useMerchant } from "./context";
import { confirmar } from "@/components/ui/dialogos";

const nombreDe = (tipo: Bloque["tipo"]) => TIPOS_BLOQUE.find((item) => item.tipo === tipo)?.nombre ?? tipo;
const resumenDe = (bloque: Bloque) => {
  const r = bloque as unknown as Record<string, unknown>;
  const texto = (r.titulo ?? r.boton ?? "") as string;
  return texto || (bloque.tipo === "galeria" ? `${bloque.imagenes.length} fotos` : bloque.tipo === "confianza" ? `${bloque.items.length} ventajas` : bloque.tipo === "faq" ? `${bloque.items.length} preguntas` : "");
};
const HISTORIA_MAX = 60;

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const on = () => setWide(query.matches);
    query.addEventListener("change", on);
    return () => query.removeEventListener("change", on);
  }, []);
  return wide;
}

/**
 * Constructor de la tienda online. El borrador se guarda solo en el servidor (no se pierde al recargar ni lo ve nadie más que el
 * equipo); publicar lo valida en el servidor, reemplaza la tienda en línea y guarda una versión restaurable. Deshacer/rehacer
 * en el editor, vista previa real en computadora, tableta y celular, páginas, menú, SEO y dominio.
 */
export default function MerchantStorefront() {
  const { store, products, reviews, loadStore, loadProducts, access } = useMerchant();
  const puedeCatalogo = access.permisos.includes("catalogo");
  const wide = useWide();

  const [draft, setDraftRaw] = useState<TemaNormalizado>(() => normalizeTheme(store.tienda_tema));
  const [pasado, setPasado] = useState<TemaNormalizado[]>([]);
  const [futuro, setFuturo] = useState<TemaNormalizado[]>([]);
  const [sections, setSections] = useState<DeliverySection[]>([]);
  const [vendedor, setVendedor] = useState<VendedorResumen | null>(null);
  const [servicios, setServicios] = useState<ServicioTienda[]>([]);
  const [colecciones, setColecciones] = useState<ColeccionTienda[]>([]);
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [tab, setTab] = useState("constructor");
  const sinVista = tab === "compartir" || tab === "productos" || tab === "versiones";
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [plantillaElegida, setPlantillaElegida] = useState<Plantilla>("boutique");
  const [phonePreview, setPhonePreview] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [copied, setCopied] = useState(false);
  const [borradorAt, setBorradorAt] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<"no" | "guardando" | "error">("no");
  const [cargado, setCargado] = useState(false);
  const [versionesRef, setVersionesRef] = useState(0);
  const ultimoGuardado = useRef<string>("");

  // Cambio con historial (deshacer/rehacer). Lo que se escribe letra a letra se agrupa por tiempo en un solo paso.
  const ultimoCambio = useRef(0);
  const draftRef = useRef(draft);
  const historia = useRef<{ p: TemaNormalizado[]; f: TemaNormalizado[] }>({ p: [], f: [] });
  const sincronizar = () => { setPasado([...historia.current.p]); setFuturo([...historia.current.f]); };
  const reemplazar = useCallback((t: TemaNormalizado, limpiarHistoria = false) => {
    draftRef.current = t; setDraftRaw(t);
    if (limpiarHistoria) { historia.current = { p: [], f: [] }; setPasado([]); setFuturo([]); }
  }, []);
  const setDraft = useCallback((fn: TemaNormalizado | ((t: TemaNormalizado) => TemaNormalizado)) => {
    const actual = draftRef.current;
    const next = typeof fn === "function" ? (fn as (t: TemaNormalizado) => TemaNormalizado)(actual) : fn;
    if (next === actual) return;
    const ahora = Date.now();
    if (ahora - ultimoCambio.current > 700) historia.current.p = [...historia.current.p.slice(-(HISTORIA_MAX - 1)), actual];
    ultimoCambio.current = ahora;
    historia.current.f = [];
    draftRef.current = next; setDraftRaw(next); sincronizar();
  }, []);
  const deshacer = useCallback(() => {
    const prev = historia.current.p.pop();
    if (!prev) return;
    historia.current.f = [draftRef.current, ...historia.current.f].slice(0, HISTORIA_MAX);
    ultimoCambio.current = 0;
    draftRef.current = prev; setDraftRaw(prev); sincronizar();
  }, []);
  const rehacer = useCallback(() => {
    const [next, ...resto] = historia.current.f;
    if (!next) return;
    historia.current.f = resto;
    historia.current.p = [...historia.current.p, draftRef.current].slice(-HISTORIA_MAX);
    ultimoCambio.current = 0;
    draftRef.current = next; setDraftRaw(next); sincronizar();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) rehacer(); else deshacer(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") { e.preventDefault(); rehacer(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [deshacer, rehacer]);

  // Al entrar (o cambiar de sucursal): si hay borrador en el servidor se retoma; si no, se parte de lo publicado.
  useEffect(() => {
    let vivo = true;
    setCargado(false); setOpenId(null);
    fetchBorrador(store.id).then((b) => {
      if (!vivo) return;
      const base = normalizeTheme(b ? b.tema : store.tienda_tema);
      reemplazar(base, true);
      ultimoGuardado.current = serializarTema(base);
      setBorradorAt(b?.updated_at ?? null);
      if (b) toast.info("Retomamos tu borrador sin publicar.");
      setCargado(true);
    }).catch(() => { if (vivo) { reemplazar(normalizeTheme(store.tienda_tema), true); setCargado(true); } });
    return () => { vivo = false; };
  }, [store.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargarExtras = useCallback(() => {
    fetchColecciones(store.id).then((c) => setColecciones(c.filter((x) => x.activa))).catch(() => setColecciones([]));
    fetchPaginas(store.id).then(setPaginas).catch(() => setPaginas([]));
  }, [store.id]);
  useEffect(() => {
    let alive = true;
    db.from("delivery_secciones").select("*").eq("comercio_id", store.id).then(({ data }: { data: DeliverySection[] | null }) => { if (alive) setSections(data ?? []); });
    db.rpc("delivery_vendedor_resumen", { p_slug: store.slug }).then(({ data }: { data: VendedorResumen | null }) => { if (alive) setVendedor(data ?? null); });
    db.from("servicios").select("id,nombre,descripcion,duracion_min,precio,imagen_url,capacidad").eq("comercio_id", store.id).eq("activo", true).order("orden").then(({ data }: { data: ServicioTienda[] | null }) => { if (alive) setServicios(data ?? []); });
    cargarExtras();
    return () => { alive = false; };
  }, [store.id, store.slug, cargarExtras]);

  const url = storefrontUrl(store.slug);
  const publicado = useMemo(() => serializarTema(normalizeTheme(store.tienda_tema)), [store.tienda_tema]);
  const actual = useMemo(() => serializarTema(draft), [draft]);
  const dirty = actual !== publicado;

  // Autoguardado del borrador en el servidor (2 s después del último cambio).
  useEffect(() => {
    if (!cargado || actual === ultimoGuardado.current) return;
    const t = window.setTimeout(async () => {
      setGuardando("guardando");
      try {
        if (actual === publicado) { await descartarBorrador(store.id); setBorradorAt(null); }
        else setBorradorAt(await guardarBorrador(store.id, temaParaGuardar(normalizeTheme(draft))));
        ultimoGuardado.current = actual;
        setGuardando("no");
      } catch { setGuardando("error"); }
    }, 2000);
    return () => window.clearTimeout(t);
  }, [actual, publicado, cargado, draft, store.id]);

  const categorias = useMemo(() => orderSections(products, sections, true).map((item) => item.name), [products, sections]);
  const paginasPublicadas = useMemo<PaginaTienda[]>(() => paginas.filter((p) => p.estado === "publicada").map((p) => ({ ...p })), [paginas]);
  const productosVisibles = useMemo(() => products.filter((p) => (p.estado ?? "publicado") === "publicado"), [products]);
  const previewBase = useMemo(() => ({ store, tema: normalizeTheme(draft), products: productosVisibles, sections, reviews, vendedor, servicios, colecciones, paginas: paginasPublicadas, reservaHref: servicios.length ? `/t/${store.slug}/reservar` : null }),
    [store, draft, productosVisibles, sections, reviews, vendedor, servicios, colecciones, paginasPublicadas]);
  const previewPagina = useCallback((p: PaginaEnEdicion) => {
    const slug = p.slug || "vista-previa";
    const pagina: PaginaTienda = { id: p.id ?? "nueva", slug, titulo: p.titulo, tipo: p.tipo, clase: p.clase, contenido: p.contenido, bloques: p.bloques, imagen_url: p.imagen_url || null };
    const vista: Vista = { tipo: "pagina", slug };
    return <PreviewPane data={{ ...previewBase, paginas: [...paginasPublicadas.filter((x) => x.slug !== slug), pagina], vista }} selected={null} onSelect={() => undefined} />;
  }, [previewBase, paginasPublicadas]);

  // ---- cambios del tema
  const setTema = useCallback((cambios: Partial<TemaNormalizado>) => setDraft((current) => ({ ...current, ...cambios })), [setDraft]);
  const setDiseno = (cambios: Partial<Diseno> & { color?: string }) => setDraft((current) => {
    const { color, ...resto } = cambios;
    return { ...current, ...(color ? { color } : {}), diseno: { ...current.diseno, ...resto } };
  });
  const setBloques = (fn: (list: Bloque[]) => Bloque[]) => setDraft((current) => ({ ...current, bloques: fn(current.bloques) }));
  const updateBloque = (id: string, cambios: Record<string, unknown>) => setBloques((list) => list.map((item) => (item.id === id ? ({ ...item, ...cambios } as Bloque) : item)));

  const mover = (id: string, direccion: -1 | 1) => setBloques((list) => {
    const index = list.findIndex((item) => item.id === id);
    const target = index + direccion;
    if (index < 0 || target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const duplicar = (id: string) => {
    const original = draft.bloques.find((item) => item.id === id);
    if (!original) return;
    const copia = { ...structuredClone(original), id: nuevoId() } as Bloque;
    setBloques((list) => {
      const index = list.findIndex((item) => item.id === id);
      return [...list.slice(0, index + 1), copia, ...list.slice(index + 1)];
    });
    setOpenId(copia.id);
  };
  const eliminar = (id: string) => { setBloques((list) => list.filter((item) => item.id !== id)); if (openId === id) setOpenId(null); toast("Bloque eliminado", { action: { label: "Deshacer", onClick: deshacer } }); };
  const agregar = (tipo: Bloque["tipo"]) => {
    const nuevo = bloqueNuevo(tipo, draft.plantilla);
    setBloques((list) => {
      const index = openId ? list.findIndex((item) => item.id === openId) : -1;
      const contacto = list.findIndex((item) => item.tipo === "contacto");
      const at = index >= 0 ? index + 1 : contacto >= 0 ? contacto : list.length;
      return [...list.slice(0, at), nuevo, ...list.slice(at)];
    });
    setOpenId(nuevo.id);
    setAdding(false);
    toast.success(`Agregamos "${nombreDe(tipo)}". Editalo en la lista.`);
  };
  const soltar = (event: DragEvent, targetId: string) => {
    event.preventDefault();
    if (dragId && dragId !== targetId) setBloques((list) => {
      const from = list.findIndex((item) => item.id === dragId);
      const to = list.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
    setDropOn(null);
  };
  const seleccionar = useCallback((id: string) => {
    setTab("constructor");
    setOpenId(id);
    window.setTimeout(() => document.getElementById(`editar-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  }, []);

  // Cambiar de plantilla: se rearma la página y el diseño; productos, páginas, menú, SEO y datos de contacto no se tocan.
  const aplicarPlantilla = () => {
    setDraft((current) => {
      const colorAnterior = PLANTILLAS.find((item) => item.id === current.plantilla)?.color;
      const colorNuevo = PLANTILLAS.find((item) => item.id === plantillaElegida)?.color ?? current.color;
      const sinPersonalizar = current.color === colorAnterior || current.color === TEMA_BASE.color;
      return {
        ...current,
        plantilla: plantillaElegida,
        color: sinPersonalizar ? colorNuevo : current.color,
        bloques: paginaDePlantilla(plantillaElegida, { titulo: current.titulo, subtitulo: current.subtitulo, boton: current.boton, banner_url: current.banner_url, acerca: current.acerca }),
        diseno: normalizeDiseno({}, plantillaElegida, current.tipografia),
      };
    });
    setOpenId(null);
    setTemplates(false);
    toast.success("Plantilla aplicada en el borrador. Si no te convence, tocá Deshacer.", { action: { label: "Deshacer", onClick: deshacer } });
  };

  const publicar = async (nota: string) => {
    try {
      await publicarTienda(store.id, temaParaGuardar(normalizeTheme(draft)), nota);
      ultimoGuardado.current = actual;
      setBorradorAt(null);
      toast.success("¡Tienda publicada! Los cambios ya están en línea.");
      setPublicando(false);
      setVersionesRef((n) => n + 1);
      await loadStore();
    } catch (error) { toast.error(errorMessage(error)); }
  };
  const descartar = async () => {
    if (!(await confirmar({ titulo: "¿Descartar los cambios sin publicar?", descripcion: "El editor vuelve a lo que está en línea. Lo que no publicaste se pierde.", confirmar: "Descartar", peligro: true }))) return;
    try { await descartarBorrador(store.id); } catch { /* si falla, igual se vuelve a lo publicado en pantalla */ }
    const base = normalizeTheme(store.tienda_tema);
    reemplazar(base, true); ultimoGuardado.current = serializarTema(base); setBorradorAt(null); setOpenId(null);
    toast.success("Cambios descartados");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { toast.info(url); }
  };
  const yaEsta = (tipo: Bloque["tipo"]) => Boolean(TIPOS_BLOQUE.find((item) => item.tipo === tipo)?.unico) && draft.bloques.some((item) => item.tipo === tipo);
  const avisos = useMemo(() => avisosDelTema(draft), [draft]);
  const estadoGuardado = guardando === "guardando" ? "Guardando borrador…" : guardando === "error" ? "No pudimos guardar el borrador (reintentamos al próximo cambio)" : dirty ? `Borrador guardado${borradorAt ? ` ${new Date(borradorAt).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` : ""} · sin publicar` : "Todo publicado";

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold">Tu tienda online</h2>
          <p className="text-sm text-muted-foreground">Armala a tu modo con bloques, páginas y menú. Todo se guarda como borrador; nada cambia en tu tienda hasta que publiques.</p>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-2xl border bg-muted/40 p-2 pl-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-semibold">{url.replace(/^https?:\/\//, "")}</span>
          <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-full" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiado" : "Copiar"}</Button>
          <Button asChild size="sm" className="shrink-0 rounded-full"><a href={storefrontPath(store.slug)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Abrir</a></Button>
        </div>
      </section>

      {!cargado ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : (
      <div className={cn("grid gap-6", !sinVista && "xl:grid-cols-[minmax(0,480px)_1fr]")}>
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList className="scrollbar-none flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-2xl p-1">
            <TabsTrigger value="constructor" className="shrink-0 rounded-xl px-3 py-2 font-bold">Bloques</TabsTrigger>
            <TabsTrigger value="diseno" className="shrink-0 rounded-xl px-3 py-2 font-bold">Diseño</TabsTrigger>
            <TabsTrigger value="paginas" className="shrink-0 rounded-xl px-3 py-2 font-bold">Páginas</TabsTrigger>
            <TabsTrigger value="menu" className="shrink-0 rounded-xl px-3 py-2 font-bold">Menú</TabsTrigger>
            <TabsTrigger value="seo" className="shrink-0 rounded-xl px-3 py-2 font-bold">SEO y dominio</TabsTrigger>
            <TabsTrigger value="datos" className="shrink-0 rounded-xl px-3 py-2 font-bold">Datos</TabsTrigger>
            {puedeCatalogo && <TabsTrigger value="productos" className="shrink-0 rounded-xl px-3 py-2 font-bold">Productos</TabsTrigger>}
            <TabsTrigger value="versiones" className="shrink-0 rounded-xl px-3 py-2 font-bold">Versiones</TabsTrigger>
            <TabsTrigger value="compartir" className="shrink-0 rounded-xl px-3 py-2 font-bold">Compartir</TabsTrigger>
          </TabsList>

          {/* ---------- BLOQUES ---------- */}
          <TabsContent value="constructor" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className="rounded-full font-bold" onClick={() => setAdding(true)} disabled={draft.bloques.length >= MAX_BLOQUES}><Plus className="h-4 w-4" />Agregar bloque</Button>
              <Button type="button" variant="outline" className="rounded-full font-bold" onClick={() => { setPlantillaElegida(draft.plantilla); setTemplates(true); }}><LayoutTemplate className="h-4 w-4" />Plantillas</Button>
              <span className="ml-auto text-xs text-muted-foreground">{draft.bloques.length}/{MAX_BLOQUES} bloques</span>
            </div>
            <p className="text-xs text-muted-foreground">Arrastrá los bloques para ordenarlos, o usá las flechas. Tocá un bloque para editarlo, o tocalo directo en la vista previa. Ctrl+Z deshace.</p>
            {avisos.length > 0 && <ul className="space-y-1 rounded-2xl bg-warning/10 p-3 text-xs font-semibold">{avisos.map((a) => <li key={a}>• {a}</li>)}</ul>}
            <ul className="space-y-2">
              {draft.bloques.map((bloque, index) => {
                const open = openId === bloque.id;
                const obligatorio = bloque.tipo === "catalogo";
                return (
                  <li key={bloque.id} id={`editar-${bloque.id}`} draggable onDragStart={() => setDragId(bloque.id)} onDragEnd={() => { setDragId(null); setDropOn(null); }} onDragOver={(event) => { event.preventDefault(); setDropOn(bloque.id); }} onDrop={(event) => soltar(event, bloque.id)}
                    className={cn("rounded-2xl border bg-card transition-shadow", open && "border-brand-yellow shadow-soft", dropOn === bloque.id && dragId !== bloque.id && "ring-2 ring-brand-yellow", dragId === bloque.id && "opacity-50", !bloque.visible && "opacity-70")}>
                    <div className="flex items-center gap-1 p-2">
                      <span className="cursor-grab px-1 text-muted-foreground" aria-hidden><GripVertical className="h-4 w-4" /></span>
                      <button type="button" onClick={() => setOpenId(open ? null : bloque.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-muted/50">
                        <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{nombreDe(bloque.tipo)}</span><span className="block truncate text-xs text-muted-foreground">{resumenDe(bloque) || "Sin título"}</span></span>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                      </button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={bloque.visible ? "Ocultar bloque" : "Mostrar bloque"} onClick={() => updateBloque(bloque.id, { visible: !bloque.visible })}>{bloque.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Subir" disabled={index === 0} onClick={() => mover(bloque.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Bajar" disabled={index === draft.bloques.length - 1} onClick={() => mover(bloque.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    </div>
                    {open && (
                      <div className="space-y-5 border-t p-4">
                        <BlockSettings bloque={bloque} categorias={categorias} colecciones={colecciones} onChange={(cambios) => updateBloque(bloque.id, cambios)} />
                        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                          {!TIPOS_BLOQUE.find((item) => item.tipo === bloque.tipo)?.unico && draft.bloques.length < MAX_BLOQUES && <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => duplicar(bloque.id)}><Copy className="h-4 w-4" />Duplicar</Button>}
                          {!obligatorio && <Button type="button" variant="outline" size="sm" className="rounded-full text-destructive hover:text-destructive" onClick={() => eliminar(bloque.id)}><Trash2 className="h-4 w-4" />Eliminar bloque</Button>}
                          {obligatorio && <p className="text-xs text-muted-foreground">El catálogo no se puede eliminar, pero sí ocultar o mover.</p>}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </TabsContent>

          <TabsContent value="productos" className="mt-4">
            <p className="mb-4 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">Solo los productos publicados aparecen en tu tienda. Los borradores y programados los ves solo vos.</p>
            <MerchantMenu storeId={store.id} products={products} onChange={loadProducts} />
          </TabsContent>

          <TabsContent value="diseno" className="mt-4">
            <div className="rounded-3xl border bg-card p-4 sm:p-5"><DesignPanel tema={draft} onChange={setDiseno} /></div>
          </TabsContent>

          <TabsContent value="paginas" className="mt-4">
            <PagesPanel storeId={store.id} storeSlug={store.slug} categorias={categorias} colecciones={colecciones} previewDe={previewPagina} onChanged={cargarExtras} />
          </TabsContent>

          <TabsContent value="menu" className="mt-4">
            <NavigationPanel tema={draft} onChange={setTema} categorias={categorias} colecciones={colecciones} paginas={paginasPublicadas} conTurnos={servicios.length > 0} />
          </TabsContent>

          <TabsContent value="seo" className="mt-4">
            <SeoPanel storeId={store.id} storeNombre={store.nombre} storeSlug={store.slug} tema={draft} onChange={setTema} />
          </TabsContent>

          {/* ---------- DATOS ---------- */}
          <TabsContent value="datos" className="mt-4 space-y-4">
            <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Mensajes generales</h3>
              <Texto label="Barra de anuncio (arriba de todo)" value={draft.anuncio} max={160} placeholder="Ej.: Envío gratis en compras de más de $20.000" onChange={(anuncio) => setTema({ anuncio })} />
              <Interruptor label="Mostrar calificaciones y opiniones" value={draft.mostrar_opiniones} onChange={(mostrar_opiniones) => setTema({ mostrar_opiniones })} />
            </section>
            <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Contacto y redes</h3>
              <Campo label="WhatsApp (con código de país, solo números)"><Input inputMode="numeric" maxLength={15} value={draft.whatsapp ?? ""} placeholder="5492355123456" onChange={(event) => setTema({ whatsapp: event.target.value.replace(/\D/g, "") })} aria-label="WhatsApp" /></Campo>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Instagram (usuario)"><Input maxLength={60} value={draft.instagram ?? ""} placeholder="mi.tienda" onChange={(event) => setTema({ instagram: event.target.value.replace(/[^A-Za-z0-9._-]/g, "") })} aria-label="Instagram" /></Campo>
                <Campo label="Facebook (usuario)"><Input maxLength={60} value={draft.facebook ?? ""} placeholder="mi.tienda" onChange={(event) => setTema({ facebook: event.target.value.replace(/[^A-Za-z0-9._-]/g, "") })} aria-label="Facebook" /></Campo>
              </div>
              <Campo label="Sitio web (https://…)"><Input maxLength={200} value={draft.web ?? ""} placeholder="https://mitienda.com" onChange={(event) => setTema({ web: event.target.value })} aria-label="Sitio web" /></Campo>
              <p className="text-xs text-muted-foreground">Logo, horarios, dirección y sucursales se cargan en Configuración del local y se ven solos en la tienda.</p>
            </section>
          </TabsContent>

          <TabsContent value="versiones" className="mt-4">
            <VersionsPanel storeId={store.id} refresco={versionesRef} onRestaurar={async (v) => {
              try { const tema = await restaurarVersion(v.id); setDraft(normalizeTheme(tema)); ultimoGuardado.current = serializarTema(normalizeTheme(tema)); setTab("constructor"); toast.success("Versión cargada como borrador. Revisala y publicá si querés volver a ella."); }
              catch (error) { toast.error(errorMessage(error)); }
            }} />
          </TabsContent>

          {/* ---------- COMPARTIR ---------- */}
          <TabsContent value="compartir" className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Visitas a tu tienda</h3>
              <p className="mb-3 mt-1 text-sm text-muted-foreground">Cuántas personas entraron (de quienes aceptan cookies de medición). No guardamos quién es cada una.</p>
              <StorefrontStats storeId={store.id} />
            </section>
            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Cartel con QR</h3>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">Llevá a tus clientes del local a tu tienda online.</p>
              <QrPoster store={store} url={url} color={draft.color} title={draft.titulo || store.nombre} />
            </section>
            <SubscribersPanel storeId={store.id} storeSlug={store.slug} />
          </TabsContent>
        </Tabs>

        {!sinVista && wide && (
          <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
            <PreviewPane data={previewBase} selected={openId} onSelect={seleccionar} />
          </aside>
        )}
      </div>
      )}

      {!sinVista && !wide && (
        <Button type="button" variant="outline" className="w-full rounded-full font-bold" onClick={() => setPhonePreview(true)}><Monitor className="h-4 w-4" />Ver vista previa</Button>
      )}

      <div className="sticky bottom-3 z-20 flex flex-wrap items-center justify-between gap-2 rounded-3xl border bg-card/95 p-2 pl-4 shadow-pop backdrop-blur sm:rounded-full">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-muted-foreground">
          {guardando === "guardando" ? <Loader2 className="h-4 w-4 animate-spin" /> : guardando === "error" ? <CloudOff className="h-4 w-4 text-destructive" /> : null}
          <span className="truncate">{estadoGuardado}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-full" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!pasado.length} onClick={deshacer}><Undo2 className="h-4 w-4" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9 rounded-full" aria-label="Rehacer" title="Rehacer (Ctrl+Y)" disabled={!futuro.length} onClick={rehacer}><Redo2 className="h-4 w-4" /></Button>
          {dirty && <Button type="button" variant="ghost" className="rounded-full" onClick={descartar}>Descartar</Button>}
          <Button type="button" className="rounded-full font-bold" onClick={() => setPublicando(true)} disabled={!dirty}>Publicar</Button>
        </div>
      </div>

      <PublishDialog open={publicando} storeId={store.id} avisosLocales={avisos} onOpenChange={setPublicando} onPublicar={publicar} />

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Agregar un bloque</DialogTitle>
          <DialogDescription>Elegí qué querés sumar a tu página. Se agrega debajo del bloque que estás editando.</DialogDescription>
          <div className="grid gap-2 sm:grid-cols-2">
            {TIPOS_BLOQUE.map((item) => {
              const bloqueado = yaEsta(item.tipo);
              return (
                <button key={item.tipo} type="button" disabled={bloqueado} onClick={() => agregar(item.tipo)} className="rounded-2xl border p-3 text-left transition-colors hover:border-brand-yellow hover:bg-brand-yellow/5 disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="block font-bold">{item.nombre}</span>
                  <span className="block text-xs text-muted-foreground">{bloqueado ? "Ya está en tu página" : item.tipo === "servicios" && servicios.length === 0 ? "Necesitás servicios con turnos para que se vea" : item.detalle}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templates} onOpenChange={setTemplates}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Plantillas</DialogTitle>
          <DialogDescription>Cada plantilla arma una página distinta (composición, letras, tarjetas y secciones) que después cambiás a gusto. <strong>Reemplaza los bloques y el diseño del borrador</strong>; tus productos, páginas, menú, SEO y datos no se tocan, y podés deshacer.</DialogDescription>
          <TemplateGrid value={plantillaElegida} color={draft.color} onChange={setPlantillaElegida} />
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" className="rounded-full" onClick={() => setTemplates(false)}>Cancelar</Button><Button type="button" className="rounded-full font-bold" onClick={aplicarPlantilla}>Usar esta plantilla</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={phonePreview} onOpenChange={setPhonePreview}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Vista previa</DialogTitle>
          <DialogDescription className="sr-only">Así se ve tu tienda online.</DialogDescription>
          {phonePreview && <PreviewPane data={previewBase} selected={openId} onSelect={(id) => { setPhonePreview(false); seleccionar(id); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

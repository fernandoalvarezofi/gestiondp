import { DragEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, NavLink, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Check, CheckCircle2, ChevronDown, CircleAlert, CloudOff, Copy, ExternalLink, Eye, EyeOff, FileText, GripVertical, History, LayoutDashboard, LayoutTemplate, Loader2, LucideIcon, Menu, Monitor, MousePointerClick, Package, Palette, Pencil, Plus, QrCode, Redo2, Search, Store, Trash2, Undo2, X } from "lucide-react";
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
import { db, DeliverySection, errorMessage, orderSections } from "@/lib/delivery";
import { Bloque, bloqueNuevo, Diseno, MAX_BLOQUES, nuevoId, normalizeDiseno, normalizeTheme, paginaDePlantilla, Plantilla, PLANTILLAS, TEMA_BASE, storefrontPath, storefrontUrl, temaParaGuardar, TemaNormalizado, TIPOS_BLOQUE } from "@/lib/storefront";
import type { Vista } from "@/lib/storeRoutes";
import type { VendedorResumen } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { fetchColecciones } from "@/services/catalogPro";
import { descartarBorrador, fetchBorrador, fetchPaginas, fetchPreparacion, guardarBorrador, ItemPreparacion, Pagina, publicarTienda, restaurarVersion } from "@/services/storeBuilder";
import { useMerchant } from "./context";
import { confirmar } from "@/components/ui/dialogos";

const nombreDe = (tipo: Bloque["tipo"]) => TIPOS_BLOQUE.find((item) => item.tipo === tipo)?.nombre ?? tipo;
const resumenDe = (bloque: Bloque) => {
  const r = bloque as unknown as Record<string, unknown>;
  const texto = (r.titulo ?? r.boton ?? "") as string;
  return texto || (bloque.tipo === "galeria" ? `${bloque.imagenes.length} fotos` : bloque.tipo === "confianza" ? `${bloque.items.length} ventajas` : bloque.tipo === "faq" ? `${bloque.items.length} preguntas` : "");
};
const HISTORIA_MAX = 60;
const BASE_TIENDA = "/app/comercio/tienda";
type SeccionTienda = "resumen" | "editor" | "paginas" | "temas" | "menu" | "productos" | "seo" | "compartir" | "datos" | "versiones";
const SECCIONES_TIENDA: { id: SeccionTienda; texto: string; icono: LucideIcon; grupo: number }[] = [
  { id: "resumen", texto: "Resumen", icono: LayoutDashboard, grupo: 0 },
  { id: "editor", texto: "Editor", icono: Pencil, grupo: 1 }, { id: "paginas", texto: "Páginas", icono: FileText, grupo: 1 },
  { id: "temas", texto: "Temas y diseño", icono: Palette, grupo: 1 }, { id: "menu", texto: "Menú y pie", icono: Menu, grupo: 1 },
  { id: "productos", texto: "Productos", icono: Package, grupo: 2 }, { id: "seo", texto: "SEO y dominio", icono: Search, grupo: 2 }, { id: "compartir", texto: "QR y suscriptores", icono: QrCode, grupo: 2 },
  { id: "datos", texto: "Datos y redes", icono: Store, grupo: 3 }, { id: "versiones", texto: "Versiones", icono: History, grupo: 3 },
];

/** Lista de lo que conviene tener listo antes de compartir la tienda (la arma el servidor). */
function PreparacionTienda({ storeId }: { storeId: string }) {
  const [items, setItems] = useState<ItemPreparacion[] | null>(null);
  useEffect(() => { fetchPreparacion(storeId).then(setItems).catch(() => setItems([])); }, [storeId]);
  if (!items) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!items.length) return null;
  const listos = items.filter((i) => i.ok).length;
  return (
    <section className="rounded-3xl border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2"><h3 className="font-extrabold">Tu tienda, lista para vender</h3><span className="text-sm font-bold text-muted-foreground">{listos} de {items.length}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.round((listos / items.length) * 100)}%` }} /></div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.clave} className="flex items-start gap-2.5 rounded-2xl border p-3">
            {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <CircleAlert className={cn("mt-0.5 h-4 w-4 shrink-0", i.grave ? "text-destructive" : "text-warning")} />}
            <span><span className="block text-sm font-bold">{i.titulo}</span>{!i.ok && <span className="block text-xs text-muted-foreground">{i.detalle}</span>}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function useWide(media = "(min-width: 1280px)") {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia(media).matches);
  useEffect(() => {
    const query = window.matchMedia(media);
    const on = () => setWide(query.matches);
    query.addEventListener("change", on);
    return () => query.removeEventListener("change", on);
  }, [media]);
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
  const muyAncho = useWide("(min-width: 1536px)");

  const [draft, setDraftRaw] = useState<TemaNormalizado>(() => normalizeTheme(store.tienda_tema));
  const [pasado, setPasado] = useState<TemaNormalizado[]>([]);
  const [futuro, setFuturo] = useState<TemaNormalizado[]>([]);
  const [sections, setSections] = useState<DeliverySection[]>([]);
  const [vendedor, setVendedor] = useState<VendedorResumen | null>(null);
  const [servicios, setServicios] = useState<ServicioTienda[]>([]);
  const [colecciones, setColecciones] = useState<ColeccionTienda[]>([]);
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const { seccion = "resumen" } = useParams<{ seccion?: SeccionTienda }>();
  const navigate = useNavigate();
  const irA = useCallback((x: SeccionTienda) => navigate(`${BASE_TIENDA}/${x}`), [navigate]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [plantillaElegida, setPlantillaElegida] = useState<Plantilla>(() => normalizeTheme(store.tienda_tema).plantilla);
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
    if (seccion !== "editor") irA("editor");
    setOpenId(id);
    window.setTimeout(() => document.getElementById(`editar-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  }, [seccion, irA]);

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
    toast.success("Tema aplicado en el borrador. Si no te convence, tocá Deshacer.", { action: { label: "Deshacer", onClick: deshacer } });
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

  const listaBloques = (compacta: boolean) => (
    <ul className="space-y-2">
      {draft.bloques.map((bloque, index) => {
        const open = openId === bloque.id;
        const obligatorio = bloque.tipo === "catalogo";
        return (
          <li key={bloque.id} id={`editar-${bloque.id}`} draggable onDragStart={() => setDragId(bloque.id)} onDragEnd={() => { setDragId(null); setDropOn(null); }} onDragOver={(event) => { event.preventDefault(); setDropOn(bloque.id); }} onDrop={(event) => soltar(event, bloque.id)}
            className={cn("rounded-2xl border bg-card transition-shadow", open && "border-brand-yellow shadow-soft", dropOn === bloque.id && dragId !== bloque.id && "ring-2 ring-brand-yellow", dragId === bloque.id && "opacity-50", !bloque.visible && "opacity-70")}>
            <div className="flex items-center gap-1 p-1.5">
              <span className="cursor-grab px-1 text-muted-foreground" aria-hidden><GripVertical className="h-4 w-4" /></span>
              <button type="button" onClick={() => setOpenId(open && !compacta ? null : bloque.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-muted/50">
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{nombreDe(bloque.tipo)}</span><span className="block truncate text-xs text-muted-foreground">{resumenDe(bloque) || "Sin título"}</span></span>
                {!compacta && <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
              </button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={bloque.visible ? "Ocultar bloque" : "Mostrar bloque"} onClick={() => updateBloque(bloque.id, { visible: !bloque.visible })}>{bloque.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Subir" disabled={index === 0} onClick={() => mover(bloque.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Bajar" disabled={index === draft.bloques.length - 1} onClick={() => mover(bloque.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
            </div>
            {open && !compacta && <div className="space-y-5 border-t p-4">{ajustesDe(bloque, obligatorio)}</div>}
          </li>
        );
      })}
    </ul>
  );
  const ajustesDe = (bloque: Bloque, obligatorio = bloque.tipo === "catalogo") => (
    <>
      <BlockSettings bloque={bloque} categorias={categorias} colecciones={colecciones} onChange={(cambios) => updateBloque(bloque.id, cambios)} />
      <div className="flex flex-wrap items-center gap-2 border-t pt-4">
        {!TIPOS_BLOQUE.find((item) => item.tipo === bloque.tipo)?.unico && draft.bloques.length < MAX_BLOQUES && <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => duplicar(bloque.id)}><Copy className="h-4 w-4" />Duplicar</Button>}
        {!obligatorio && <Button type="button" variant="outline" size="sm" className="rounded-full text-destructive hover:text-destructive" onClick={() => eliminar(bloque.id)}><Trash2 className="h-4 w-4" />Eliminar bloque</Button>}
        {obligatorio && <p className="text-xs text-muted-foreground">El catálogo no se puede eliminar, pero sí ocultar o mover.</p>}
      </div>
    </>
  );
  const barraEditor = (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" className="rounded-full font-bold" onClick={() => setAdding(true)} disabled={draft.bloques.length >= MAX_BLOQUES}><Plus className="h-4 w-4" />Agregar bloque</Button>
      <Button type="button" variant="outline" className="rounded-full font-bold" onClick={() => irA("temas")}><LayoutTemplate className="h-4 w-4" />Cambiar tema</Button>
      <span className="ml-auto text-xs text-muted-foreground">{draft.bloques.length}/{MAX_BLOQUES} bloques</span>
    </div>
  );
  const seleccionado = draft.bloques.find((b) => b.id === openId) ?? null;
  if (!SECCIONES_TIENDA.some((x) => x.id === seccion) || (seccion === "productos" && !puedeCatalogo)) return <Navigate to={`${BASE_TIENDA}/resumen`} replace />;

  let contenido: ReactNode = null;
  if (seccion === "resumen") {
    contenido = (
      <div className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-3xl border bg-card p-5 lg:col-span-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Estado</p>
            <p className="mt-1 text-xl font-black">{dirty ? "Tenés cambios sin publicar" : "Todo lo que ves está publicado"}</p>
            <p className="text-sm text-muted-foreground">{dirty ? `Borrador guardado${borradorAt ? ` el ${new Date(borradorAt).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}. Nada cambia en tu tienda hasta que publiques.` : "Cuando edites, se guarda un borrador automático."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button className="rounded-full" onClick={() => irA("editor")}><Pencil className="h-4 w-4" />Editar la página de inicio</Button>
              <Button variant="outline" className="rounded-full" onClick={() => irA("paginas")}><FileText className="h-4 w-4" />Páginas ({paginas.length})</Button>
              <Button variant="outline" className="rounded-full" onClick={() => irA("temas")}><Palette className="h-4 w-4" />Tema y diseño</Button>
              {dirty && <Button variant="outline" className="rounded-full" onClick={() => setPublicando(true)}>Publicar cambios</Button>}
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[["Tema", PLANTILLAS.find((p) => p.id === draft.plantilla)?.nombre ?? draft.plantilla], ["Bloques en inicio", String(draft.bloques.filter((b) => b.visible).length)], ["Páginas publicadas", String(paginasPublicadas.length)], ["Productos visibles", String(productosVisibles.length)]].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate font-extrabold">{v}</dd></div>
              ))}
            </dl>
          </section>
          <section className="rounded-3xl border bg-card p-5">
            <h3 className="font-extrabold">Visitas</h3>
            <p className="mb-3 text-xs text-muted-foreground">De quienes aceptan cookies de medición.</p>
            <StorefrontStats storeId={store.id} />
          </section>
        </div>
        {avisos.length > 0 && <section className="rounded-3xl border border-warning/40 bg-warning/10 p-5"><h3 className="font-extrabold">Para revisar antes de publicar</h3><ul className="mt-2 space-y-1 text-sm">{avisos.map((a) => <li key={a}>• {a}</li>)}</ul></section>}
        <PreparacionTienda storeId={store.id} />
      </div>
    );
  } else if (seccion === "editor") {
    contenido = wide ? (
      <div className={cn("grid gap-4", muyAncho ? "grid-cols-[280px_minmax(0,1fr)_340px]" : "grid-cols-[330px_minmax(0,1fr)]")}>
        <aside className="sticky top-20 max-h-[calc(100vh-7rem)] min-w-0 space-y-3 self-start overflow-y-auto pr-1" aria-label={!muyAncho && seleccionado ? "Ajustes del bloque" : "Bloques de la página"}>
          {!muyAncho && seleccionado ? (
            <>
              <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={() => setOpenId(null)}><ArrowLeft className="h-4 w-4" />Todos los bloques</Button>
              <div className="space-y-5 rounded-3xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Bloque</p><h3 className="text-lg font-extrabold">{nombreDe(seleccionado.tipo)}</h3></div><Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label="Cerrar ajustes" onClick={() => setOpenId(null)}><X className="h-4 w-4" /></Button></div>
                {ajustesDe(seleccionado)}
              </div>
            </>
          ) : (
            <>
              {barraEditor}
              {avisos.length > 0 && <ul className="space-y-1 rounded-2xl bg-warning/10 p-3 text-xs font-semibold">{avisos.map((a) => <li key={a}>• {a}</li>)}</ul>}
              {listaBloques(true)}
            </>
          )}
        </aside>
        <div className="min-w-0"><PreviewPane data={previewBase} selected={openId} onSelect={seleccionar} /></div>
        {muyAncho && <aside className="sticky top-20 max-h-[calc(100vh-7rem)] min-w-0 self-start overflow-y-auto" aria-label="Ajustes del bloque">
          {seleccionado ? (
            <div className="space-y-5 rounded-3xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Bloque</p><h3 className="text-lg font-extrabold">{nombreDe(seleccionado.tipo)}</h3></div><Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label="Cerrar ajustes" onClick={() => setOpenId(null)}><X className="h-4 w-4" /></Button></div>
              {ajustesDe(seleccionado)}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed bg-card p-6 text-center text-sm text-muted-foreground">
              <MousePointerClick className="mx-auto mb-2 h-6 w-6" />Elegí un bloque en la lista o tocalo en la vista previa para editarlo.
              <p className="mt-3 text-xs">Arrastrá para ordenar · Ctrl+Z deshace</p>
            </div>
          )}
        </aside>}
      </div>
    ) : (
      <div className="space-y-3">
        {barraEditor}
        <p className="text-xs text-muted-foreground">Arrastrá los bloques para ordenarlos, o usá las flechas. Tocá un bloque para editarlo. Ctrl+Z deshace.</p>
        {avisos.length > 0 && <ul className="space-y-1 rounded-2xl bg-warning/10 p-3 text-xs font-semibold">{avisos.map((a) => <li key={a}>• {a}</li>)}</ul>}
        {listaBloques(false)}
        <Button type="button" variant="outline" className="w-full rounded-full font-bold" onClick={() => setPhonePreview(true)}><Monitor className="h-4 w-4" />Ver vista previa</Button>
      </div>
    );
  } else if (seccion === "temas") {
    contenido = (
      <div className={cn("grid gap-6", wide && "xl:grid-cols-[minmax(0,520px)_1fr]")}>
        <div className="min-w-0 space-y-4">
          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <h3 className="font-extrabold">Temas</h3>
            <p className="mb-3 text-sm text-muted-foreground">Cada tema cambia la estructura de la página (composición, portada, tarjetas y secciones), no solo los colores. Tus productos, páginas, menú, SEO y datos no se tocan, y podés deshacer.</p>
            <TemplateGrid value={plantillaElegida} color={draft.color} onChange={setPlantillaElegida} />
            <div className="mt-3 flex justify-end"><Button type="button" className="rounded-full font-bold" disabled={plantillaElegida === draft.plantilla} onClick={aplicarPlantilla}>{plantillaElegida === draft.plantilla ? "Es tu tema actual" : "Usar este tema"}</Button></div>
          </section>
          <section className="rounded-3xl border bg-card p-4 sm:p-5"><h3 className="mb-3 font-extrabold">Diseño</h3><DesignPanel tema={draft} onChange={setDiseno} /></section>
        </div>
        {wide ? <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start"><PreviewPane data={previewBase} selected={openId} onSelect={seleccionar} /></aside>
          : <Button type="button" variant="outline" className="w-full rounded-full font-bold" onClick={() => setPhonePreview(true)}><Monitor className="h-4 w-4" />Ver vista previa</Button>}
      </div>
    );
  } else if (seccion === "paginas") {
    contenido = <PagesPanel storeId={store.id} storeSlug={store.slug} categorias={categorias} colecciones={colecciones} previewDe={previewPagina} onChanged={cargarExtras} />;
  } else if (seccion === "menu") {
    contenido = <div className="max-w-3xl"><NavigationPanel tema={draft} onChange={setTema} categorias={categorias} colecciones={colecciones} paginas={paginasPublicadas} conTurnos={servicios.length > 0} /></div>;
  } else if (seccion === "productos") {
    contenido = (
      <div className="space-y-3">
        <p className="rounded-2xl bg-muted p-3 text-sm text-muted-foreground">Solo los productos publicados aparecen en tu tienda. Las colecciones (grupos para promociones o temporadas) se arman en <Link to="/app/comercio/colecciones" className="font-bold text-primary hover:underline">Colecciones</Link>.</p>
        <MerchantMenu storeId={store.id} products={products} onChange={loadProducts} />
      </div>
    );
  } else if (seccion === "seo") {
    contenido = <div className="max-w-3xl"><SeoPanel storeId={store.id} storeNombre={store.nombre} storeSlug={store.slug} tema={draft} onChange={setTema} /></div>;
  } else if (seccion === "datos") {
    contenido = (
      <div className="max-w-3xl space-y-4">
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
      </div>
    );
  } else if (seccion === "versiones") {
    contenido = (
      <div className="max-w-3xl">
        <VersionsPanel storeId={store.id} refresco={versionesRef} onRestaurar={async (v) => {
          try { const tema = await restaurarVersion(v.id); setDraft(normalizeTheme(tema)); ultimoGuardado.current = serializarTema(normalizeTheme(tema)); irA("editor"); toast.success("Versión cargada como borrador. Revisala y publicá si querés volver a ella."); }
          catch (error) { toast.error(errorMessage(error)); }
        }} />
      </div>
    );
  } else if (seccion === "compartir") {
    contenido = (
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border bg-card p-4 sm:p-5">
          <h3 className="font-extrabold">Cartel con QR</h3>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Llevá a tus clientes del local a tu tienda online.</p>
          <QrPoster store={store} url={url} color={draft.color} title={draft.titulo || store.nombre} />
        </section>
        <SubscribersPanel storeId={store.id} storeSlug={store.slug} />
      </div>
    );
  }

  const enlace = (x: (typeof SECCIONES_TIENDA)[number]) => (
    <NavLink key={x.id} to={`${BASE_TIENDA}/${x.id}`} className={({ isActive }) => cn("flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold transition-colors", isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <x.icono className="h-4 w-4" />{x.texto}
    </NavLink>
  );

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold">Tu tienda online</h2>
          <p className="text-sm text-muted-foreground">Armala con bloques, páginas, temas y menú. Todo se guarda como borrador; nada cambia en tu tienda hasta que publiques.</p>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-2xl border bg-muted/40 p-2 pl-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-semibold">{url.replace(/^https?:\/\//, "")}</span>
          <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-full" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiado" : "Copiar"}</Button>
          <Button asChild size="sm" className="shrink-0 rounded-full"><a href={storefrontPath(store.slug)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Abrir</a></Button>
        </div>
      </section>

      <nav aria-label="Secciones de la tienda" className="scrollbar-none -mx-1 flex items-center gap-1 overflow-x-auto rounded-full border bg-card p-1 px-1">
        {SECCIONES_TIENDA.filter((x) => x.id !== "productos" || puedeCatalogo).map((x, i, lista) => (
          <span key={x.id} className="flex shrink-0 items-center">
            {i > 0 && lista[i - 1].grupo !== x.grupo && <span aria-hidden className="mx-1 h-5 w-px bg-border" />}
            {enlace(x)}
          </span>
        ))}
      </nav>

      {!cargado ? <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div> : contenido}

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

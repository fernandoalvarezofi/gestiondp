import { DragEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown, ArrowLeft, ArrowUp, Bookmark, ChevronDown, ClipboardPaste, CloudOff, Copy, CopyPlus, ExternalLink, Eye, EyeOff, FileText, GripVertical, Home, LayoutPanelTop,
  Layers, Loader2, Package, Monitor, MoreHorizontal, Palette, PanelBottom, Plus, Redo2, Search, Smartphone, Trash2, Undo2, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { confirmar, pedirTexto } from "@/components/ui/dialogos";
import type { DeliveryProduct, DeliverySection, DeliveryStore } from "@/lib/delivery";
import { errorMessage } from "@/lib/delivery";
import type { VendedorResumen } from "@/lib/marketplace";
import { Bloque, BloqueTipo, Diseno, grupoDe, GRUPOS_BLOQUE, MAX_BLOQUES, MAX_BLOQUES_PRODUCTO, normalizeBloque, nuevoId, bloqueNuevo, storefrontPath, TemaNormalizado, TIPOS_BLOQUE } from "@/lib/storefront";
import type { EstiloSeccion } from "@/lib/storefrontSecciones";
import { PATRONES } from "@/lib/storefrontPatrones";
import type { Vista } from "@/lib/storeRoutes";
import { cn } from "@/lib/utils";
import { borrarPagina, borrarSeccion, fetchSecciones, guardarSeccion, SeccionGuardada } from "@/services/storeBuilder";
import type { ColeccionTienda, PaginaTienda, ServicioTienda, StorefrontReview } from "@/components/storefront/StorefrontView";
import { BlockSettings } from "./BlockSettings";
import { EstiloPanel, OpcionesSitio } from "./controles";
import { DesignPanel } from "./DesignPanel";
import { Dispositivo, PreviewPane, SelectorDispositivo } from "./PreviewPane";
import { CatalogoGlobal, FooterPanel, HeaderPanel, NuevaPaginaDialog, PaginaPanel } from "./SitePanels";
import type { PaginaEd, useSitio } from "./useSitio";

type Api = ReturnType<typeof useSitio>;
type Seleccion = { tipo: "global" } | { tipo: "pagina" } | { tipo: "cabecera" } | { tipo: "pie" } | { tipo: "seccion"; id: string } | null;
const INICIO = "inicio";
/** Plantilla de la ficha de producto: secciones debajo de la ficha en todos los productos. */
const PRODUCTO = "producto";
const PORTAPAPELES = "woref-seccion-copiada";

const nombreTipo = (tipo: BloqueTipo) => TIPOS_BLOQUE.find((t) => t.tipo === tipo)?.nombre ?? tipo;
const nombreSeccion = (b: Bloque) => b.est?.nombre || nombreTipo(b.tipo);
const resumen = (b: Bloque) => {
  const r = b as unknown as Record<string, unknown>;
  return (typeof r.titulo === "string" && r.titulo) || (typeof r.boton === "string" && r.boton) || "";
};
const leerPortapapeles = (): Bloque | null => { try { const raw = window.localStorage.getItem(PORTAPAPELES); return raw ? normalizeBloque(JSON.parse(raw), 0) : null; } catch { return null; } };

export type EditorDatos = {
  store: DeliveryStore; products: DeliveryProduct[]; sections: DeliverySection[]; reviews: StorefrontReview[]; vendedor: VendedorResumen | null;
  servicios: ServicioTienda[]; colecciones: ColeccionTienda[]; categorias: string[];
};

/**
 * Editor del sitio a pantalla completa. Izquierda: estructura (estilos globales, páginas, encabezado, secciones de la página, pie) y
 * biblioteca para agregar (secciones, patrones, guardadas). Centro: la tienda real en el dispositivo elegido; tocar una sección la
 * selecciona. Derecha: propiedades de lo seleccionado (contenido y estilo). Todo cambia el mismo borrador con deshacer/rehacer.
 */
export function SiteEditor({ api, datos, onPublicar, onSalir }: { api: Api; datos: EditorDatos; onPublicar: () => void; onSalir: () => void }) {
  const { sitio, cambiar } = api;
  const { store } = datos;
  const [paginaClave, setPaginaClave] = useState(INICIO);
  const [sel, setSel] = useState<Seleccion>(null);
  const [izq, setIzq] = useState<"estructura" | "agregar">("estructura");
  const [pestana, setPestana] = useState<"contenido" | "estilo">("contenido");
  const [device, setDevice] = useState<Dispositivo>("escritorio");
  const [movil, setMovil] = useState<"estructura" | "vista" | "ajustes">("vista");
  const [nuevaPagina, setNuevaPagina] = useState(false);
  const [buscar, setBuscar] = useState("");
  const [guardadas, setGuardadas] = useState<SeccionGuardada[] | null>(null);
  const [copiada, setCopiada] = useState<Bloque | null>(leerPortapapeles);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const ancho = useAncho();

  const esProducto = paginaClave === PRODUCTO;
  const pagina = paginaClave === INICIO || esProducto ? null : sitio.paginas.find((p) => p.clave === paginaClave) ?? null;
  useEffect(() => { if (paginaClave !== INICIO && !esProducto && !pagina) setPaginaClave(INICIO); }, [paginaClave, pagina, esProducto]);
  const bloques = pagina ? pagina.bloques : esProducto ? sitio.tema.producto_bloques ?? [] : sitio.tema.bloques;
  const seleccionada = sel?.tipo === "seccion" ? bloques.find((b) => b.id === sel.id) ?? null : null;

  // ---- cambios
  const setTema = useCallback((c: Partial<TemaNormalizado>) => cambiar((s) => ({ ...s, tema: { ...s.tema, ...c } })), [cambiar]);
  const setDiseno = useCallback((c: Partial<Diseno> & { color?: string }) => cambiar((s) => {
    const { color, ...resto } = c;
    return { ...s, tema: { ...s.tema, ...(color ? { color } : {}), diseno: { ...s.tema.diseno, ...resto } } };
  }), [cambiar]);
  const setPagina = useCallback((clave: string, c: Partial<PaginaEd>) => cambiar((s) => ({ ...s, paginas: s.paginas.map((p) => (p.clave === clave ? { ...p, ...c } : p)) })), [cambiar]);
  const setBloques = useCallback((fn: (l: Bloque[]) => Bloque[]) => cambiar((s) => (paginaClave === INICIO
    ? { ...s, tema: { ...s.tema, bloques: fn(s.tema.bloques) } }
    : paginaClave === PRODUCTO ? { ...s, tema: { ...s.tema, producto_bloques: fn(s.tema.producto_bloques ?? []) } }
    : { ...s, paginas: s.paginas.map((p) => (p.clave === paginaClave ? { ...p, bloques: fn(p.bloques) } : p)) })), [cambiar, paginaClave]);
  const actualizar = (id: string, c: Record<string, unknown>) => setBloques((l) => l.map((b) => (b.id === id ? ({ ...b, ...c } as Bloque) : b)));
  const setEstilo = (id: string, est: EstiloSeccion | undefined) => setBloques((l) => l.map((b) => { if (b.id !== id) return b; const { est: _viejo, ...resto } = b; void _viejo; return (est ? { ...resto, est } : resto) as Bloque; }));

  const limite = paginaClave === INICIO ? MAX_BLOQUES + 10 : esProducto ? MAX_BLOQUES_PRODUCTO : 40;
  const insertar = (nuevo: Bloque) => {
    if (bloques.length >= limite) { toast.error(`Llegaste al máximo de ${limite} secciones en esta página`); return; }
    setBloques((l) => {
      const i = sel?.tipo === "seccion" ? l.findIndex((b) => b.id === sel.id) : -1;
      const contacto = paginaClave === INICIO ? l.findIndex((b) => b.tipo === "contacto") : -1;
      const at = i >= 0 ? i + 1 : contacto >= 0 ? contacto : l.length;
      return [...l.slice(0, at), nuevo, ...l.slice(at)];
    });
    setSel({ tipo: "seccion", id: nuevo.id }); setPestana("contenido"); setIzq("estructura");
    if (ancho < 1024) setMovil("ajustes");
    window.setTimeout(() => document.getElementById(`arbol-${nuevo.id}`)?.scrollIntoView({ block: "nearest" }), 60);
  };
  const unico = (tipo: BloqueTipo) => Boolean(TIPOS_BLOQUE.find((t) => t.tipo === tipo)?.unico) && bloques.some((b) => b.tipo === tipo);
  const mover = (id: string, d: -1 | 1) => setBloques((l) => { const i = l.findIndex((b) => b.id === id); const j = i + d; if (i < 0 || j < 0 || j >= l.length) return l; const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const duplicar = (id: string) => {
    const o = bloques.find((b) => b.id === id);
    if (!o) return;
    if (TIPOS_BLOQUE.find((t) => t.tipo === o.tipo)?.unico) { toast.info("Esta sección va una sola vez por página."); return; }
    insertarDespues(id, { ...structuredClone(o), id: nuevoId() } as Bloque);
  };
  const insertarDespues = (id: string, nuevo: Bloque) => {
    setBloques((l) => { const i = l.findIndex((b) => b.id === id); return [...l.slice(0, i + 1), nuevo, ...l.slice(i + 1)]; });
    setSel({ tipo: "seccion", id: nuevo.id });
  };
  const eliminar = (id: string) => {
    const b = bloques.find((x) => x.id === id);
    if (!b) return;
    if (b.tipo === "catalogo" && paginaClave === INICIO) { toast.info("El catálogo no se elimina: podés ocultarlo o moverlo."); return; }
    setBloques((l) => l.filter((x) => x.id !== id));
    if (sel?.tipo === "seccion" && sel.id === id) setSel(null);
    toast("Sección eliminada", { action: { label: "Deshacer", onClick: api.deshacer } });
  };
  const copiar = (id: string) => {
    const b = bloques.find((x) => x.id === id);
    if (!b) return;
    try { window.localStorage.setItem(PORTAPAPELES, JSON.stringify(b)); } catch { /* sin almacenamiento: solo en esta pestaña */ }
    setCopiada(b); toast.success("Sección copiada. Pegala en esta u otra página.");
  };
  const pegar = () => {
    if (!copiada) return;
    if (copiada.tipo === "catalogo" && paginaClave !== INICIO) { toast.error("El catálogo completo va solo en el inicio."); return; }
    if (unico(copiada.tipo)) { toast.error("Esa sección ya está en esta página."); return; }
    insertar({ ...structuredClone(copiada), id: nuevoId() } as Bloque);
  };
  const guardarComoSeccion = async (id: string) => {
    const b = bloques.find((x) => x.id === id);
    if (!b) return;
    const nombre = await pedirTexto({ titulo: "Guardar en Mis secciones", etiqueta: "Nombre", inicial: nombreSeccion(b), maximo: 60, confirmar: "Guardar", validar: (v) => (v.trim().length < 2 ? "Poné al menos 2 letras" : null) });
    if (!nombre) return;
    try { await guardarSeccion(store.id, nombre.trim(), b); toast.success("Guardada en Mis secciones"); setGuardadas(null); } catch (error) { toast.error(errorMessage(error)); }
  };
  const soltar = (e: DragEvent, destino: string) => {
    e.preventDefault();
    if (dragId && dragId !== destino) setBloques((l) => { const a = l.findIndex((b) => b.id === dragId), z = l.findIndex((b) => b.id === destino); if (a < 0 || z < 0) return l; const n = [...l]; const [m] = n.splice(a, 1); n.splice(z, 0, m); return n; });
    setDragId(null); setDropOn(null);
  };

  // ---- páginas
  const crearPagina = (p: Omit<PaginaEd, "clave">) => {
    const clave = `n${nuevoId()}`;
    cambiar((s) => ({ ...s, paginas: [...s.paginas, { ...p, clave }] }));
    setNuevaPagina(false); setPaginaClave(clave); setSel({ tipo: "pagina" });
    toast.success("Página creada como borrador oculto.");
  };
  const eliminarPagina = async (p: PaginaEd) => {
    if (!(await confirmar({ titulo: `¿Eliminar “${p.titulo}”?`, descripcion: "Se borra en el acto, también de la tienda en línea si estaba publicada. No se puede deshacer.", confirmar: "Eliminar", peligro: true }))) return;
    try {
      await api.guardarAhora();
      const id = api.idDe(p.clave);
      if (id) await borrarPagina(id);
      api.olvidarPagina(p.clave); setPaginaClave(INICIO); setSel(null);
      toast.success("Página eliminada");
    } catch (error) { toast.error(errorMessage(error)); }
  };
  const irAPagina = (clave: string) => { setPaginaClave(clave); setSel(clave === INICIO || clave === PRODUCTO ? null : { tipo: "pagina" }); };

  // ---- datos para destinos y para la vista previa
  const anclas = useMemo(() => bloques.filter((b) => b.est?.ancla).map((b) => ({ id: b.est!.ancla!, nombre: `${nombreSeccion(b)} (#${b.est!.ancla})` })), [bloques]);
  const opciones: OpcionesSitio = useMemo(() => ({
    categorias: datos.categorias, colecciones: datos.colecciones, anclas, conTurnos: datos.servicios.length > 0, conWhatsapp: Boolean(sitio.tema.whatsapp),
    paginas: sitio.paginas.filter((p) => p.estado === "publicada" && p.slug).map((p) => ({ slug: p.slug, titulo: p.titulo })),
  }), [datos.categorias, datos.colecciones, datos.servicios.length, anclas, sitio.paginas, sitio.tema.whatsapp]);
  const productosVisibles = useMemo(() => datos.products.filter((p) => (p.estado ?? "publicado") === "publicado"), [datos.products]);
  const vista: Vista = pagina ? { tipo: "pagina", slug: pagina.slug || "vista-previa" } : esProducto ? { tipo: "producto" } : { tipo: "inicio" };
  const paginasVista: PaginaTienda[] = useMemo(() => sitio.paginas.filter((p) => p.estado === "publicada" || p.clave === paginaClave).map((p) => ({
    id: p.clave, slug: p.clave === paginaClave ? p.slug || "vista-previa" : p.slug, titulo: p.titulo, tipo: p.tipo, clase: p.clase, contenido: p.contenido || null, bloques: p.bloques, imagen_url: p.imagen_url || null,
  })), [sitio.paginas, paginaClave]);
  const preview = useMemo(() => ({
    store, tema: sitio.tema, products: productosVisibles, sections: datos.sections, reviews: datos.reviews, vendedor: datos.vendedor, servicios: datos.servicios,
    colecciones: datos.colecciones, paginas: paginasVista, reservaHref: datos.servicios.length ? `/t/${store.slug}/reservar` : null, vista,
    productoId: productosVisibles.find((p) => p.en_tienda !== false)?.id ?? null,
  }), [store, sitio.tema, productosVisibles, datos, paginasVista, vista.tipo === "pagina" ? vista.slug : vista.tipo]); // eslint-disable-line react-hooks/exhaustive-deps
  const seleccionarDesdeVista = useCallback((id: string) => { setSel({ tipo: "seccion", id }); setPestana("contenido"); if (window.innerWidth < 1024) setMovil("ajustes"); window.setTimeout(() => document.getElementById(`arbol-${id}`)?.scrollIntoView({ block: "nearest" }), 60); }, []);

  // ---- atajos de teclado
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); if (e.shiftKey) api.rehacer(); else api.deshacer(); }
      else if (mod && k === "y") { e.preventDefault(); api.rehacer(); }
      else if (mod && k === "d" && sel?.tipo === "seccion") { e.preventDefault(); duplicar(sel.id); }
      else if (mod && k === "c" && sel?.tipo === "seccion") { e.preventDefault(); copiar(sel.id); }
      else if (mod && k === "v" && copiada) { e.preventDefault(); pegar(); }
      else if (e.key === "Escape") setSel(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => { if (izq === "agregar" && guardadas === null) fetchSecciones(store.id).then(setGuardadas).catch(() => setGuardadas([])); }, [izq, guardadas, store.id]);

  // ---- piezas
  const estado = api.guardado === "guardando" ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Guardando…</>
    : api.guardado === "error" ? <span className="flex items-center gap-1.5 text-destructive" title={api.errorGuardado ?? undefined}><CloudOff className="h-3.5 w-3.5" />{api.errorGuardado ?? "No se pudo guardar"}</span>
    : api.sinPublicar ? <>Borrador guardado · sin publicar</> : <>Todo publicado</>;

  const fila = (b: Bloque, i: number) => {
    const activa = sel?.tipo === "seccion" && sel.id === b.id;
    return (
      <li key={b.id} id={`arbol-${b.id}`} draggable onDragStart={() => setDragId(b.id)} onDragEnd={() => { setDragId(null); setDropOn(null); }} onDragOver={(e) => { e.preventDefault(); setDropOn(b.id); }} onDrop={(e) => soltar(e, b.id)}
        className={cn("group flex items-center gap-1 rounded-lg pr-1 transition-colors", activa ? "bg-foreground text-background" : "hover:bg-muted", dropOn === b.id && dragId !== b.id && "ring-2 ring-brand-yellow", dragId === b.id && "opacity-50")}>
        <span className="cursor-grab px-1 opacity-50" aria-hidden><GripVertical className="h-3.5 w-3.5" /></span>
        <button type="button" onClick={() => { setSel({ tipo: "seccion", id: b.id }); if (ancho < 1024) setMovil("ajustes"); }} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left" aria-current={activa ? "true" : undefined}>
          {b.est?.fondo && <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full border" style={{ background: b.est.fondo === "color" ? b.est.color : b.est.fondo === "oscuro" ? "#0B0B0C" : b.est.fondo === "acento" ? sitio.tema.color : b.est.fondo === "imagen" ? "#888" : "transparent" }} />}
          <span className={cn("min-w-0 flex-1 truncate text-[13px]", !b.visible && "line-through opacity-60")}>
            <span className="font-semibold">{nombreSeccion(b)}</span>{resumen(b) && <span className={cn("ml-1.5", activa ? "opacity-70" : "text-muted-foreground")}>{resumen(b)}</span>}
          </span>
          {b.est?.ver === "movil" && <Smartphone className="h-3.5 w-3.5 shrink-0 opacity-70" aria-label="Solo en celular" />}
          {b.est?.ver === "escritorio" && <Monitor className="h-3.5 w-3.5 shrink-0 opacity-70" aria-label="Solo en computadora" />}
        </button>
        <button type="button" onClick={() => actualizar(b.id, { visible: !b.visible })} className={cn("rounded p-1 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100", !b.visible && "opacity-100")} aria-label={b.visible ? "Ocultar sección" : "Mostrar sección"}>{b.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</button>
        {menuSeccion(b, i, bloques.length)}
      </li>
    );
  };
  const menuSeccion = (b: Bloque, i: number, total: number) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><button type="button" className="rounded p-1 opacity-60 hover:opacity-100" aria-label={`Acciones de ${nombreSeccion(b)}`}><MoreHorizontal className="h-4 w-4" /></button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem disabled={i === 0} onSelect={() => mover(b.id, -1)}><ArrowUp className="mr-2 h-4 w-4" />Subir</DropdownMenuItem>
        <DropdownMenuItem disabled={i === total - 1} onSelect={() => mover(b.id, 1)}><ArrowDown className="mr-2 h-4 w-4" />Bajar</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => duplicar(b.id)}><CopyPlus className="mr-2 h-4 w-4" />Duplicar<span className="ml-auto text-xs opacity-60">Ctrl+D</span></DropdownMenuItem>
        <DropdownMenuItem onSelect={() => copiar(b.id)}><Copy className="mr-2 h-4 w-4" />Copiar<span className="ml-auto text-xs opacity-60">Ctrl+C</span></DropdownMenuItem>
        {b.tipo !== "catalogo" && <DropdownMenuItem onSelect={() => void guardarComoSeccion(b.id)}><Bookmark className="mr-2 h-4 w-4" />Guardar en Mis secciones</DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => eliminar(b.id)} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const nodo = (activo: boolean, icono: ReactNode, texto: ReactNode, onClick: () => void, extra?: ReactNode) => (
    <button type="button" onClick={onClick} aria-current={activo ? "true" : undefined} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold transition-colors", activo ? "bg-foreground text-background" : "hover:bg-muted")}>
      {icono}<span className="min-w-0 flex-1 truncate">{texto}</span>{extra}
    </button>
  );

  const estructura = (
    <div className="space-y-5 p-3">
      {nodo(sel?.tipo === "global", <Palette className="h-4 w-4 shrink-0" />, "Estilos globales", () => { setSel({ tipo: "global" }); if (ancho < 1024) setMovil("ajustes"); })}
      <div>
        <p className="mb-1 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Páginas</p>
        <ul className="space-y-0.5">
          <li>{nodo(paginaClave === INICIO, <Home className="h-4 w-4 shrink-0" />, "Inicio", () => irAPagina(INICIO), api.temaSinPublicar && <Punto />)}</li>
          {sitio.paginas.map((p) => (
            <li key={p.clave}>{nodo(paginaClave === p.clave, <FileText className="h-4 w-4 shrink-0" />, p.titulo || "Sin título", () => irAPagina(p.clave),
              <span className="flex items-center gap-1.5">{p.estado !== "publicada" && <span className="rounded bg-muted px-1.5 text-[10px] font-bold uppercase text-muted-foreground">Oculta</span>}{api.paginasSinPublicar.includes(p.clave) && <Punto />}</span>)}</li>
          ))}
          <li>{nodo(esProducto, <Package className="h-4 w-4 shrink-0" />, "Ficha de producto", () => irAPagina(PRODUCTO), <span className="rounded bg-muted px-1.5 text-[10px] font-bold uppercase text-muted-foreground">Plantilla</span>)}</li>
        </ul>
        <button type="button" onClick={() => setNuevaPagina(true)} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><Plus className="h-4 w-4" />Nueva página</button>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between px-2">
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{pagina ? pagina.titulo || "Página" : esProducto ? "Ficha de producto" : "Inicio"}</p>
          {pagina && <button type="button" onClick={() => setSel({ tipo: "pagina" })} className="text-[11px] font-bold text-muted-foreground underline-offset-2 hover:underline">Ajustes de la página</button>}
        </div>
        <ul className="space-y-0.5">
          <li>{nodo(sel?.tipo === "cabecera", <LayoutPanelTop className="h-4 w-4 shrink-0" />, "Encabezado", () => { setSel({ tipo: "cabecera" }); if (ancho < 1024) setMovil("ajustes"); })}</li>
          {esProducto && <li className="flex items-center gap-2 rounded-lg bg-muted/60 px-2 py-1.5 text-[13px] text-muted-foreground"><Package className="h-4 w-4 shrink-0" />Ficha: fotos, precio, compra, descripción, opiniones y relacionados</li>}
          {pagina?.contenido.trim() && <li className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-muted-foreground"><FileText className="h-4 w-4" />Texto principal <button type="button" className="ml-auto text-xs underline" onClick={() => setSel({ tipo: "pagina" })}>Editar</button></li>}
        </ul>
        <ul className="my-0.5 space-y-0.5 border-l-2 border-muted pl-1.5">
          {bloques.map((b, i) => fila(b, i))}
          {bloques.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">{esProducto ? "Sumá secciones que se vean debajo de cada producto: envíos, garantía, testimonios, una banda de marca…" : "Esta página no tiene secciones todavía."}</li>}
        </ul>
        <button type="button" onClick={() => setIzq("agregar")} className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-semibold text-primary hover:bg-muted"><Plus className="h-4 w-4" />Agregar sección</button>
        <ul className="space-y-0.5"><li>{nodo(sel?.tipo === "pie", <PanelBottom className="h-4 w-4 shrink-0" />, "Pie de página", () => { setSel({ tipo: "pie" }); if (ancho < 1024) setMovil("ajustes"); })}</li></ul>
      </div>
      <p className="px-2 text-[11px] leading-relaxed text-muted-foreground">Arrastrá para ordenar. Ctrl+Z deshace · Ctrl+D duplica · Ctrl+C / Ctrl+V copian y pegan secciones entre páginas.</p>
    </div>
  );

  const q = buscar.trim().toLowerCase();
  const tipos = TIPOS_BLOQUE.filter((t) => (paginaClave === INICIO || t.tipo !== "catalogo") && (!q || `${t.nombre} ${t.detalle}`.toLowerCase().includes(q)));
  const patrones = PATRONES.filter((p) => !q || `${p.nombre} ${p.detalle}`.toLowerCase().includes(q));
  const agregar = (
    <div className="space-y-5 p-3">
      <div className="flex items-center gap-2">
        <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Volver a la estructura" onClick={() => setIzq("estructura")}><ArrowLeft className="h-4 w-4" /></Button>
        <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border bg-background px-2.5"><Search className="h-4 w-4 text-muted-foreground" /><input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar secciones" aria-label="Buscar secciones" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
      </div>
      {copiada && <button type="button" onClick={pegar} className="flex w-full items-center gap-2 rounded-lg border border-dashed p-2.5 text-left text-sm font-semibold hover:bg-muted"><ClipboardPaste className="h-4 w-4" />Pegar “{nombreSeccion(copiada)}”</button>}
      {GRUPOS_BLOQUE.map((g) => {
        const lista = tipos.filter((t) => grupoDe(t.tipo) === g.id);
        if (!lista.length) return null;
        return (
          <div key={g.id}>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{g.nombre}</p>
            <ul className="space-y-1">
              {lista.map((t) => {
                const ya = unico(t.tipo);
                return (
                  <li key={t.tipo}>
                    <button type="button" disabled={ya} onClick={() => insertar(bloqueNuevo(t.tipo, sitio.tema.plantilla))} className="w-full rounded-lg border p-2.5 text-left transition-colors hover:border-foreground/40 disabled:cursor-not-allowed disabled:opacity-50">
                      <span className="block text-sm font-bold">{t.nombre}</span>
                      <span className="block text-xs text-muted-foreground">{ya ? "Ya está en esta página" : t.tipo === "servicios" && !opciones.conTurnos ? "Necesitás servicios con turnos para que se vea" : t.detalle}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      {patrones.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Patrones (secciones ya diseñadas)</p>
          <ul className="space-y-1">
            {patrones.map((p) => (
              <li key={p.id}><button type="button" onClick={() => { const b = p.crear(sitio.tema.plantilla); if (unico(b.tipo)) { toast.error("Esa sección ya está en esta página."); return; } insertar(b); }} className="w-full rounded-lg border p-2.5 text-left transition-colors hover:border-foreground/40">
                <span className="block text-sm font-bold">{p.nombre}</span><span className="block text-xs text-muted-foreground">{p.detalle}</span>
              </button></li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Mis secciones</p>
        {guardadas === null ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : guardadas.length === 0 ? <p className="text-xs text-muted-foreground">Guardá una sección desde su menú (⋯) para reutilizarla en cualquier página.</p> : (
          <ul className="space-y-1">
            {guardadas.filter((g) => !q || g.nombre.toLowerCase().includes(q)).map((g) => {
              const b = normalizeBloque(g.bloque, 0);
              return (
                <li key={g.id} className="flex items-center gap-1">
                  <button type="button" disabled={!b} onClick={() => { if (!b) return; if (unico(b.tipo) || (b.tipo === "catalogo" && paginaClave !== INICIO)) { toast.error("Esa sección no se puede agregar acá."); return; } insertar({ ...b, id: nuevoId() } as Bloque); }}
                    className="min-w-0 flex-1 rounded-lg border p-2.5 text-left hover:border-foreground/40"><span className="block truncate text-sm font-bold">{g.nombre}</span><span className="block text-xs text-muted-foreground">{b ? nombreTipo(b.tipo) : "No compatible"}</span></button>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`Borrar ${g.nombre}`} onClick={async () => {
                    if (!(await confirmar({ titulo: `¿Borrar “${g.nombre}” de Mis secciones?`, descripcion: "Las páginas que ya la usan no cambian.", confirmar: "Borrar", peligro: true }))) return;
                    try { await borrarSeccion(g.id); setGuardadas((l) => (l ?? []).filter((x) => x.id !== g.id)); } catch (error) { toast.error(errorMessage(error)); }
                  }}><Trash2 className="h-4 w-4" /></Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );

  const titulo = (sup: string, t: ReactNode, cerrar = true) => (
    <div className="flex items-start justify-between gap-2 border-b px-4 py-3">
      <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{sup}</p><h2 className="truncate text-base font-extrabold">{t}</h2></div>
      {cerrar && <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label="Cerrar" onClick={() => setSel(null)}><X className="h-4 w-4" /></Button>}
    </div>
  );
  let inspector: ReactNode;
  if (seleccionada) {
    const i = bloques.findIndex((b) => b.id === seleccionada.id);
    inspector = (
      <>
        {titulo(nombreTipo(seleccionada.tipo), nombreSeccion(seleccionada))}
        <div className="flex gap-1 border-b px-3 py-2" role="tablist">
          {(["contenido", "estilo"] as const).map((t) => <button key={t} type="button" role="tab" aria-selected={pestana === t} onClick={() => setPestana(t)} className={cn("rounded-md px-3 py-1.5 text-sm font-bold capitalize", pestana === t ? "bg-muted" : "text-muted-foreground hover:text-foreground")}>{t}</button>)}
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto p-4">
          {pestana === "contenido"
            ? <BlockSettings bloque={seleccionada} categorias={datos.categorias} colecciones={datos.colecciones} sitio={opciones} onChange={(c) => actualizar(seleccionada.id, c)} />
            : <EstiloPanel value={seleccionada.est} onChange={(est) => setEstilo(seleccionada.id, est)} ocultarFondo={seleccionada.tipo === "portada" || seleccionada.tipo === "cinta"} />}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t p-3">
          <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => duplicar(seleccionada.id)}><CopyPlus className="h-4 w-4" />Duplicar</Button>
          {seleccionada.tipo !== "catalogo" && <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => void guardarComoSeccion(seleccionada.id)}><Bookmark className="h-4 w-4" />Guardar</Button>}
          <span className="ml-auto flex">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Subir" disabled={i <= 0} onClick={() => mover(seleccionada.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Bajar" disabled={i >= bloques.length - 1} onClick={() => mover(seleccionada.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Eliminar sección" onClick={() => eliminar(seleccionada.id)}><Trash2 className="h-4 w-4" /></Button>
          </span>
        </div>
      </>
    );
  } else if (sel?.tipo === "global") {
    inspector = <>{titulo("Todo el sitio", "Estilos globales")}<div className="flex-1 space-y-6 overflow-y-auto p-4"><DesignPanel tema={sitio.tema} onChange={setDiseno} /><CatalogoGlobal tema={sitio.tema} onChange={setTema} /></div></>;
  } else if (sel?.tipo === "cabecera") {
    inspector = <>{titulo("Todas las páginas", "Encabezado")}<div className="flex-1 overflow-y-auto p-4"><HeaderPanel tema={sitio.tema} onChange={setTema} onDiseno={setDiseno} sitio={opciones} /></div></>;
  } else if (sel?.tipo === "pie") {
    inspector = <>{titulo("Todas las páginas", "Pie de página")}<div className="flex-1 overflow-y-auto p-4"><FooterPanel tema={sitio.tema} onChange={setTema} sitio={opciones} /></div></>;
  } else if (sel?.tipo === "pagina" && pagina) {
    inspector = <>{titulo("Página", pagina.titulo || "Sin título")}<div className="flex-1 overflow-y-auto p-4"><PaginaPanel pagina={pagina} storeSlug={store.slug} publicada={api.esPublicada(pagina.clave)} onChange={(c) => setPagina(pagina.clave, c)} onEliminar={() => void eliminarPagina(pagina)} /></div></>;
  } else {
    inspector = (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
        <Layers className="h-7 w-7" />
        <p>Elegí una sección en la estructura o tocala en la vista previa para editarla.</p>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setIzq("agregar")}><Plus className="h-4 w-4" />Agregar sección</Button>
      </div>
    );
  }

  const selectorPagina = (
    <label className="relative flex min-w-0 items-center">
      <span className="sr-only">Página que estás editando</span>
      <select value={paginaClave} onChange={(e) => irAPagina(e.target.value)} className="h-9 min-w-0 max-w-[14rem] appearance-none truncate rounded-lg border bg-background pl-3 pr-8 text-sm font-bold">
        <option value={INICIO}>Inicio</option>
        <option value={PRODUCTO}>Ficha de producto (plantilla)</option>
        {sitio.paginas.map((p) => <option key={p.clave} value={p.clave}>{p.titulo || "Sin título"}{p.estado !== "publicada" ? " (oculta)" : ""}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-muted-foreground" />
    </label>
  );
  const primerProducto = productosVisibles.find((p) => p.en_tienda !== false);
  const enLinea = pagina ? (pagina.estado === "publicada" && api.esPublicada(pagina.clave) ? `${storefrontPath(store.slug)}/pagina/${pagina.slug}` : null)
    : esProducto ? (primerProducto ? `${storefrontPath(store.slug)}/p/${primerProducto.slug || primerProducto.id}` : null) : storefrontPath(store.slug);

  const barra = (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-2 sm:px-3">
      <Button type="button" variant="ghost" size="sm" className="shrink-0 rounded-full" onClick={onSalir}><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Mi tienda</span></Button>
      <span className="hidden h-6 w-px bg-border sm:block" aria-hidden />
      {selectorPagina}
      <SelectorDispositivo value={device} onChange={setDevice} className="hidden md:flex" />
      <span className="ml-auto hidden min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-muted-foreground lg:flex" role="status">{estado}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1 lg:ml-2">
        <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!api.historial.atras} onClick={api.deshacer}><Undo2 className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Rehacer" title="Rehacer (Ctrl+Y)" disabled={!api.historial.adelante} onClick={api.rehacer}><Redo2 className="h-4 w-4" /></Button>
        {enLinea && <Button asChild size="icon" variant="ghost" className="hidden h-9 w-9 sm:inline-flex" title="Ver en línea"><Link to={enLinea} target="_blank" rel="noopener noreferrer" aria-label="Ver esta página en línea"><ExternalLink className="h-4 w-4" /></Link></Button>}
        <Button type="button" className="rounded-full font-bold" disabled={!api.sinPublicar} onClick={onPublicar}>Publicar</Button>
      </div>
    </header>
  );

  const lienzo = (
    <div className="flex h-full min-h-0 flex-col bg-muted/50 p-2 sm:p-4">
      <PreviewPane data={preview} selected={sel?.tipo === "seccion" ? sel.id : null} onSelect={seleccionarDesdeVista} device={device} llenar />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {barra}
      {ancho >= 1024 ? (
        <div className={cn("grid min-h-0 flex-1", ancho >= 1440 ? "grid-cols-[280px_minmax(0,1fr)_360px]" : "grid-cols-[260px_minmax(0,1fr)_320px]")}>
          <aside className="min-h-0 overflow-y-auto border-r bg-card" aria-label={izq === "estructura" ? "Estructura del sitio" : "Agregar sección"}>{izq === "estructura" ? estructura : agregar}</aside>
          <main className="min-h-0">{lienzo}</main>
          <aside className="flex min-h-0 flex-col border-l bg-card" aria-label="Propiedades">{inspector}</aside>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {movil === "estructura" ? (izq === "estructura" ? estructura : agregar) : movil === "vista" ? lienzo : <div className="flex min-h-full flex-col bg-card">{inspector}</div>}
          </div>
          <nav className="grid shrink-0 grid-cols-3 border-t bg-card" aria-label="Paneles del editor">
            {([["estructura", Layers, "Estructura"], ["vista", Monitor, "Vista previa"], ["ajustes", Palette, "Propiedades"]] as const).map(([id, Icon, label]) => (
              <button key={id} type="button" aria-pressed={movil === id} onClick={() => setMovil(id)} className={cn("flex h-14 flex-col items-center justify-center gap-0.5 text-xs font-bold", movil === id ? "text-foreground" : "text-muted-foreground")}><Icon className="h-5 w-5" />{label}</button>
            ))}
          </nav>
        </>
      )}
      <NuevaPaginaDialog open={nuevaPagina} onOpenChange={setNuevaPagina} existentes={sitio.paginas.map((p) => p.slug)} onCrear={crearPagina} plantilla={sitio.tema.plantilla} />
    </div>
  );
}

const Punto = () => <span aria-label="Con cambios sin publicar" title="Con cambios sin publicar" className="h-2 w-2 shrink-0 rounded-full bg-brand-yellow" />;

function useAncho() {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));
  useEffect(() => { const on = () => setW(window.innerWidth); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, []);
  return w;
}

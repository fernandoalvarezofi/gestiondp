import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Archive, ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, FileClock, Loader2, Package, Pause, Percent, Play, Plus, Search, Send, Star, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { MenuImportDialog } from "@/components/merchant/MenuImportDialog";
import { MerchantMenu } from "@/components/merchant/MerchantMenu";
import { QuickEditTable } from "@/components/merchant/QuickEditTable";
import { Button } from "@/components/ui/button";
import { confirmar, pedirTexto } from "@/components/ui/dialogos";
import { db, DeliveryProduct, errorMessage, ESTADO_PRODUCTO, EstadoProducto, img, money, precioRegular, stockBajo } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { catalogoMasivo, Coleccion, fetchColecciones } from "@/services/catalogPro";
import { exportarCatalogo } from "./exportar";

const BASE = "/app/comercio/productos";
const POR_PAGINA = 50;
type Vista = "lista" | "rapida" | "secciones";
type EstadoTab = "todos" | EstadoProducto;
type Orden = "recientes" | "nombre" | "precio_asc" | "precio_desc" | "stock" | "ventas";
type Inventario = "" | "agotado" | "bajo" | "con_stock" | "sin_control";
type Extra = "" | "oferta" | "sin_foto" | "destacado" | "pausado" | "con_variantes";

const sinStock = (p: DeliveryProduct) => (p.usa_variantes && p.variantes?.length ? p.variantes.every((v) => !v.disponible || v.stock === 0) : p.stock === 0);
/** Unidades en stock (null = sin control). Con variantes, la suma de las que controlan stock. */
function unidades(p: DeliveryProduct): number | null {
  if (p.usa_variantes && p.variantes?.length) { const con = p.variantes.filter((v) => v.stock != null); return con.length ? con.reduce((t, v) => t + Number(v.stock), 0) : null; }
  return p.stock ?? null;
}
function precios(p: DeliveryProduct): [number, number] {
  if (p.usa_variantes && p.variantes?.length) { const l = p.variantes.map((v) => Number(v.precio ?? p.precio)); return [Math.min(...l), Math.max(...l)]; }
  return [Number(p.precio), Number(p.precio)];
}

/**
 * Productos: tabla de trabajo para catálogos grandes. Pestañas por estado, búsqueda por nombre/SKU/código/marca, filtros que se
 * combinan (sección, inventario, canal, ofertas…), orden por columnas, ventas de los últimos 30 días, paginación y acciones sobre
 * la selección (también sobre todos los filtrados). Además: edición rápida en planilla y orden por secciones.
 */
export function ProductosLista({ storeId, products, onChange }: { storeId: string; products: DeliveryProduct[]; onChange: () => void }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const vista = (["lista", "rapida", "secciones"].includes(params.get("vista") ?? "") ? params.get("vista") : "lista") as Vista;
  const estadoTab = (["todos", "publicado", "borrador", "programado", "archivado"].includes(params.get("estado") ?? "") ? params.get("estado") : "todos") as EstadoTab;
  const setParam = (k: string, v: string | null) => setParams((p) => { const n = new URLSearchParams(p); if (v) n.set(k, v); else n.delete(k); return n; }, { replace: true });
  const [q, setQ] = useState("");
  const [seccion, setSeccion] = useState("");
  const [inventario, setInventario] = useState<Inventario>("");
  const [canal, setCanal] = useState<"" | "tienda" | "market">("");
  const [extra, setExtra] = useState<Extra>("");
  const [orden, setOrden] = useState<Orden>("recientes");
  const [pagina, setPagina] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [importando, setImportando] = useState(false);
  const [ventas, setVentas] = useState<Map<string, { unidades: number; ingresos: number }>>(new Map());
  const [colecciones, setColecciones] = useState<(Coleccion & { productos: string[] })[]>([]);

  const cargarVentas = useCallback(() => {
    db.rpc("catalogo_ventas", { p_comercio: storeId, p_dias: 30 }).then(({ data }: { data: { producto_id: string; unidades: number; ingresos: number }[] | null }) => {
      setVentas(new Map((data ?? []).map((x) => [x.producto_id, { unidades: Number(x.unidades), ingresos: Number(x.ingresos) }])));
    }, () => undefined);
  }, [storeId]);
  useEffect(() => { cargarVentas(); fetchColecciones(storeId).then(setColecciones).catch(() => setColecciones([])); }, [storeId, cargarVentas]);
  useEffect(() => { setPagina(0); }, [q, seccion, inventario, canal, extra, orden, estadoTab]);

  const secciones = useMemo(() => [...new Set(products.map((p) => p.categoria))].sort((a, b) => a.localeCompare(b, "es")), [products]);
  const conteo = useMemo(() => {
    const c: Record<EstadoTab, number> = { todos: 0, publicado: 0, borrador: 0, programado: 0, archivado: 0 };
    products.forEach((p) => { const e = p.estado ?? "publicado"; c[e]++; if (e !== "archivado") c.todos++; });
    return c;
  }, [products]);

  const filtrados = useMemo(() => {
    const t = q.trim().toLowerCase();
    const l = products.filter((p) => {
      const e = p.estado ?? "publicado";
      if (estadoTab === "todos" ? e === "archivado" : e !== estadoTab) return false;
      if (t && !`${p.nombre} ${p.sku ?? ""} ${p.codigo_barras ?? ""} ${p.marca ?? ""} ${p.categoria} ${(p.variantes ?? []).map((v) => `${v.nombre} ${v.sku ?? ""}`).join(" ")}`.toLowerCase().includes(t)) return false;
      if (seccion && p.categoria !== seccion) return false;
      const u = unidades(p);
      if (inventario === "agotado" && !sinStock(p)) return false;
      if (inventario === "bajo" && !stockBajo(p)) return false;
      if (inventario === "con_stock" && (u == null || u <= 0)) return false;
      if (inventario === "sin_control" && u != null) return false;
      if (canal === "tienda" && p.en_tienda === false) return false;
      if (canal === "market" && p.en_market === false) return false;
      if (extra === "oferta" && !(p.promo_activa || p.precio_promo || p.precio_anterior)) return false;
      if (extra === "sin_foto" && p.imagen_url) return false;
      if (extra === "destacado" && !p.destacado) return false;
      if (extra === "pausado" && p.disponible) return false;
      if (extra === "con_variantes" && !p.usa_variantes) return false;
      return true;
    });
    const v = (p: DeliveryProduct) => ventas.get(p.id)?.unidades ?? 0;
    const cmp: Record<Orden, (a: DeliveryProduct, b: DeliveryProduct) => number> = {
      recientes: (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""),
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
      precio_asc: (a, b) => precios(a)[0] - precios(b)[0],
      precio_desc: (a, b) => precios(b)[0] - precios(a)[0],
      stock: (a, b) => (unidades(a) ?? Infinity) - (unidades(b) ?? Infinity),
      ventas: (a, b) => v(b) - v(a),
    };
    return l.sort(cmp[orden]);
  }, [products, q, estadoTab, seccion, inventario, canal, extra, orden, ventas]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const visibles = filtrados.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const filtros = [
    seccion && { k: "Sección", v: seccion, quitar: () => setSeccion("") },
    inventario && { k: "Inventario", v: { agotado: "Agotados", bajo: "Stock bajo", con_stock: "Con stock", sin_control: "Sin control" }[inventario], quitar: () => setInventario("") },
    canal && { k: "Canal", v: canal === "tienda" ? "Tienda online" : "Marketplace", quitar: () => setCanal("") },
    extra && { k: "", v: { oferta: "Con rebaja u oferta", sin_foto: "Sin foto", destacado: "Destacados", pausado: "Pausados", con_variantes: "Con variantes" }[extra], quitar: () => setExtra("") },
  ].filter(Boolean) as { k: string; v: string; quitar: () => void }[];
  const limpiar = () => { setQ(""); setSeccion(""); setInventario(""); setCanal(""); setExtra(""); };

  // ---- selección y acciones masivas
  const ids = [...sel];
  const todosVisibles = visibles.length > 0 && visibles.every((p) => sel.has(p.id));
  const tocar = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const masivo = async (accion: Parameters<typeof catalogoMasivo>[2], valor: Record<string, unknown> = {}, ok = "Listo") => {
    setBusy(true);
    try { const n = await catalogoMasivo(storeId, ids, accion, valor); toast.success(`${ok} (${n})`); setSel(new Set()); onChange(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const directo = async (patch: Record<string, unknown>, ok: string) => {
    setBusy(true);
    const { error } = await db.from("delivery_productos").update(patch).in("id", ids);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(ok); setSel(new Set()); onChange();
  };
  const precioMasivo = async () => {
    const raw = await pedirTexto({ titulo: `Ajustar el precio de ${ids.length} ${ids.length === 1 ? "producto" : "productos"}`, descripcion: "Positivo sube; negativo baja y muestra el precio anterior tachado. Queda en el historial de cada producto.", etiqueta: "Porcentaje", placeholder: "Ej.: 10 o -15", modoTeclado: "decimal", maximo: 6, confirmar: "Aplicar",
      validar: (v) => { const n = Number(v.replace(",", ".")); return !Number.isFinite(n) || n === 0 || n < -90 || n > 300 ? "Entre -90 y 300, distinto de 0" : null; } });
    if (raw === null) return;
    setBusy(true);
    const { error } = await db.rpc("delivery_ajustar_precios", { p_comercio: storeId, p_ids: ids, p_pct: Number(raw.replace(",", ".")) });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Precios actualizados"); setSel(new Set()); onChange();
  };
  const eliminarMasivo = async () => {
    if (!(await confirmar({ titulo: `¿Eliminar ${ids.length} ${ids.length === 1 ? "producto" : "productos"}?`, descripcion: "No se puede deshacer. Si solo querés sacarlos de la venta, archivalos.", confirmar: "Eliminar", peligro: true }))) return;
    setBusy(true);
    const { error } = await db.from("delivery_productos").delete().in("id", ids);
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Productos eliminados"); setSel(new Set()); onChange();
  };

  const encabezado = (texto: string, campo?: Orden, alterno?: Orden, clase?: string) => {
    const activo = campo && (orden === campo || orden === alterno);
    return (
      <th className={cn("px-3 py-2.5 font-bold", clase)} aria-sort={activo ? (orden === alterno ? "descending" : "ascending") : undefined}>
        {campo ? <button type="button" onClick={() => setOrden(orden === campo && alterno ? alterno : campo)} className="inline-flex items-center gap-1 hover:text-foreground">{texto}{activo && (orden === alterno ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />)}</button> : texto}
      </th>
    );
  };
  const select = "h-9 rounded-md border bg-background px-2.5 text-sm";

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-auto" />
        <Button variant="outline" size="sm" onClick={() => setImportando(true)}><Upload className="h-4 w-4" />Importar</Button>
        <Button variant="outline" size="sm" onClick={() => exportarCatalogo(filtrados.length ? filtrados : products)} disabled={!products.length}><Download className="h-4 w-4" />Exportar{filtros.length || q ? " filtrados" : ""}</Button>
        <Button size="sm" asChild><Link to={`${BASE}/nuevo`}><Plus className="h-4 w-4" />Agregar producto</Link></Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b">
        <div className="scrollbar-none -mb-px flex gap-1 overflow-x-auto" role="tablist" aria-label="Estado">
          {(["todos", "publicado", "borrador", "programado", "archivado"] as EstadoTab[]).filter((e) => e === "todos" || e === estadoTab || conteo[e] > 0).map((e) => (
            <button key={e} type="button" role="tab" aria-selected={estadoTab === e} onClick={() => { setParam("estado", e === "todos" ? null : e); setSel(new Set()); }}
              className={cn("shrink-0 border-b-2 px-3 py-2 text-sm font-bold", estadoTab === e ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
              {e === "todos" ? "Activos" : ESTADO_PRODUCTO[e].texto + "s"} <span className="ml-0.5 text-xs font-semibold text-muted-foreground">{conteo[e]}</span>
            </button>
          ))}
        </div>
        <div className="mb-1 flex rounded-md border p-0.5 text-xs font-bold" role="group" aria-label="Vista">
          {([["lista", "Lista"], ["rapida", "Edición rápida"], ["secciones", "Secciones y orden"]] as [Vista, string][]).map(([v, t]) => (
            <button key={v} type="button" aria-pressed={vista === v} onClick={() => setParam("vista", v === "lista" ? null : v)} className={cn("rounded px-2.5 py-1", vista === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{t}</button>
          ))}
        </div>
      </div>

      {vista === "secciones" ? <MerchantMenu storeId={storeId} products={products} onChange={onChange} /> : (
        <>
          {/* Búsqueda y filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-md border bg-background px-3 focus-within:ring-2 focus-within:ring-ring/30">
              <Search className="h-4 w-4 text-muted-foreground" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, SKU, código de barras o marca" aria-label="Buscar productos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              {q && <button type="button" aria-label="Borrar búsqueda" onClick={() => setQ("")}><X className="h-4 w-4 text-muted-foreground" /></button>}
            </label>
            <select aria-label="Sección" value={seccion} onChange={(e) => setSeccion(e.target.value)} className={select}><option value="">Todas las secciones</option>{secciones.map((s) => <option key={s} value={s}>{s}</option>)}</select>
            <select aria-label="Inventario" value={inventario} onChange={(e) => setInventario(e.target.value as Inventario)} className={select}><option value="">Todo el inventario</option><option value="con_stock">Con stock</option><option value="bajo">Stock bajo</option><option value="agotado">Agotados</option><option value="sin_control">Sin control de stock</option></select>
            <select aria-label="Canal" value={canal} onChange={(e) => setCanal(e.target.value as typeof canal)} className={select}><option value="">Todos los canales</option><option value="tienda">Tienda online</option><option value="market">Marketplace</option></select>
            <select aria-label="Otros filtros" value={extra} onChange={(e) => setExtra(e.target.value as Extra)} className={select}><option value="">Más filtros</option><option value="oferta">Con rebaja u oferta</option><option value="destacado">Destacados</option><option value="pausado">Pausados</option><option value="con_variantes">Con variantes</option><option value="sin_foto">Sin foto</option></select>
            <select aria-label="Ordenar" value={orden} onChange={(e) => setOrden(e.target.value as Orden)} className={cn(select, "lg:hidden")}><option value="recientes">Más recientes</option><option value="nombre">Nombre A–Z</option><option value="precio_asc">Menor precio</option><option value="precio_desc">Mayor precio</option><option value="stock">Menos stock</option><option value="ventas">Más vendidos (30 días)</option></select>
          </div>
          {(filtros.length > 0 || q) && (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
              {filtros.map((f) => <button key={f.k + f.v} type="button" onClick={f.quitar} className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs font-semibold">{f.k && <span className="text-muted-foreground">{f.k}:</span>}{f.v}<X className="h-3 w-3" /></button>)}
              <button type="button" onClick={limpiar} className="text-xs font-bold text-primary hover:underline">Limpiar todo</button>
              <span className="text-xs text-muted-foreground">· {filtrados.length} {filtrados.length === 1 ? "producto" : "productos"}</span>
            </div>
          )}

          {vista === "rapida" ? <QuickEditTable storeId={storeId} products={filtrados} onSaved={onChange} /> : products.length === 0 ? (
            <EmptyState icon={<Package className="h-7 w-7" />} title="Todavía no cargaste productos" text="Cargalos de a uno con fotos, precio y variantes, o importá una planilla para empezar rápido."
              action={<div className="flex flex-wrap justify-center gap-2"><Button asChild className="rounded-full"><Link to={`${BASE}/nuevo`}><Plus className="h-4 w-4" />Agregar producto</Link></Button><Button variant="outline" className="rounded-full" onClick={() => setImportando(true)}><Upload className="h-4 w-4" />Importar planilla</Button></div>} />
          ) : (
            <>
              {/* Acciones sobre la selección */}
              {sel.size > 0 && (
                <div className="sticky top-14 z-20 flex flex-wrap items-center gap-1.5 rounded-lg border bg-card p-2 shadow-pop" role="toolbar" aria-label="Acciones sobre la selección">
                  <span className="px-2 text-sm font-extrabold">{sel.size} {sel.size === 1 ? "seleccionado" : "seleccionados"}</span>
                  {sel.size < filtrados.length && <button type="button" onClick={() => setSel(new Set(filtrados.map((p) => p.id)))} className="px-1 text-xs font-bold text-primary hover:underline">Seleccionar los {filtrados.length} filtrados</button>}
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => masivo("publicar", {}, "Publicados")}><Send className="h-4 w-4" />Publicar</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => masivo("borrador", {}, "Pasados a borrador")}><FileClock className="h-4 w-4" />Borrador</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => masivo("archivar", {}, "Archivados")}><Archive className="h-4 w-4" />Archivar</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => directo({ disponible: false }, "Pausados")}><Pause className="h-4 w-4" />Pausar</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => directo({ disponible: true }, "Activados")}><Play className="h-4 w-4" />Activar</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={precioMasivo}><Percent className="h-4 w-4" />Precio</Button>
                  <select value="" aria-label="Mover a sección" disabled={busy} onChange={(e) => { const s = e.target.value; if (s) void directo({ categoria: s }, `Movidos a ${s}`); }} className="h-8 rounded-md border bg-background px-2 text-sm font-semibold">
                    <option value="">Mover a sección…</option>{secciones.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  {colecciones.length > 0 && (
                    <select value="" aria-label="Agregar a colección" disabled={busy} onChange={(e) => { const c = e.target.value; if (c) void masivo("coleccion", { valor: c }, "Agregados a la colección"); }} className="h-8 rounded-md border bg-background px-2 text-sm font-semibold">
                      <option value="">Agregar a colección…</option>{colecciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  )}
                  <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={eliminarMasivo}><Trash2 className="h-4 w-4" />Eliminar</Button>
                  {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setSel(new Set())}>Cancelar</Button>
                </div>
              )}

              <div className="overflow-hidden rounded-lg border bg-card">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="w-10 px-3 py-2.5"><input type="checkbox" aria-label="Seleccionar la página" className="h-4 w-4 accent-primary" checked={todosVisibles} onChange={() => setSel((s) => { const n = new Set(s); visibles.forEach((p) => (todosVisibles ? n.delete(p.id) : n.add(p.id))); return n; })} /></th>
                      {encabezado("Producto", "nombre")}
                      {encabezado("Estado", undefined, undefined, "hidden md:table-cell")}
                      {encabezado("Inventario", "stock", undefined, "hidden md:table-cell")}
                      {encabezado("Precio", "precio_asc", "precio_desc", "text-right")}
                      {encabezado("Ventas 30 d", "ventas", undefined, "hidden text-right lg:table-cell")}
                      {encabezado("Sección", undefined, undefined, "hidden xl:table-cell")}
                      {encabezado("Canales", undefined, undefined, "hidden xl:table-cell")}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibles.map((p) => {
                      const u = unidades(p); const agotado = sinStock(p); const bajo = stockBajo(p);
                      const [min, max] = precios(p); const v = ventas.get(p.id);
                      const e = p.estado ?? "publicado";
                      return (
                        <tr key={p.id} className={cn("cursor-pointer transition-colors hover:bg-muted/40", sel.has(p.id) && "bg-primary/5")} onClick={() => navigate(`${BASE}/${p.id}`)}>
                          <td className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}><input type="checkbox" aria-label={`Seleccionar ${p.nombre}`} className="h-4 w-4 accent-primary" checked={sel.has(p.id)} onChange={() => tocar(p.id)} /></td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-3">
                              {p.imagen_url ? <img src={img(p.imagen_url, 96)} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md border object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground"><Package className="h-4 w-4" /></span>}
                              <div className="min-w-0">
                                <Link to={`${BASE}/${p.id}`} onClick={(ev) => ev.stopPropagation()} className="flex items-center gap-1.5 font-semibold hover:underline">{p.destacado && <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" aria-label="Destacado" />}<span className="truncate">{p.nombre}</span></Link>
                                <p className="truncate text-xs text-muted-foreground">{[p.sku, p.usa_variantes && p.variantes?.length ? `${p.variantes.length} variantes` : null, p.marca].filter(Boolean).join(" · ") || " "}</p>
                                <p className="mt-0.5 flex flex-wrap gap-1 md:hidden"><span className={cn("rounded px-1.5 text-[10px] font-bold", ESTADO_PRODUCTO[e].clase)}>{ESTADO_PRODUCTO[e].texto}</span>{agotado && <span className="rounded bg-destructive/10 px-1.5 text-[10px] font-bold text-destructive">Agotado</span>}</p>
                              </div>
                            </div>
                          </td>
                          <td className="hidden px-3 py-2 md:table-cell">
                            <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold", ESTADO_PRODUCTO[e].clase)}>{ESTADO_PRODUCTO[e].texto}</span>
                            {!p.disponible && <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">Pausado</span>}
                          </td>
                          <td className="hidden px-3 py-2 md:table-cell">
                            {u == null ? <span className="text-muted-foreground">Sin control</span>
                              : <span className={cn("font-semibold tabular-nums", agotado ? "text-destructive" : bajo ? "text-warning-foreground" : "")}>{agotado ? "Agotado" : `${u} en stock`}{bajo && !agotado && <span className="ml-1 rounded bg-warning/25 px-1 text-[10px] font-bold">bajo</span>}</span>}
                            {p.usa_variantes && p.variantes?.length ? <span className="block text-xs text-muted-foreground">en {p.variantes.length} variantes</span> : null}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {p.promo_activa ? <><span className="font-semibold text-success">{money(p.precio)}</span><span className="block text-xs text-muted-foreground line-through">{money(precioRegular(p))}</span></>
                              : <><span className="font-semibold">{min === max ? money(min) : `${money(min)} – ${money(max)}`}</span>{p.precio_anterior ? <span className="block text-xs text-muted-foreground line-through">{money(p.precio_anterior)}</span> : null}</>}
                          </td>
                          <td className="hidden px-3 py-2 text-right tabular-nums lg:table-cell">{v ? <><span className="font-semibold">{v.unidades} u</span><span className="block text-xs text-muted-foreground">{money(v.ingresos)}</span></> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="hidden max-w-[10rem] truncate px-3 py-2 text-muted-foreground xl:table-cell">{p.categoria}</td>
                          <td className="hidden px-3 py-2 xl:table-cell"><span className="flex gap-1">{p.en_tienda !== false && <span className="rounded border px-1.5 text-[11px] font-semibold">Tienda</span>}{p.en_market !== false && <span className="rounded border px-1.5 text-[11px] font-semibold">Market</span>}</span></td>
                        </tr>
                      );
                    })}
                    {visibles.length === 0 && <tr><td colSpan={8} className="px-3 py-12 text-center text-muted-foreground">No hay productos con estos filtros. <button type="button" onClick={limpiar} className="font-bold text-primary hover:underline">Limpiar filtros</button></td></tr>}
                  </tbody>
                </table>
              </div>
              {filtrados.length > POR_PAGINA && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{pagina * POR_PAGINA + 1}–{Math.min(filtrados.length, (pagina + 1) * POR_PAGINA)} de {filtrados.length}</span>
                  <span className="flex gap-1"><Button variant="outline" size="icon" className="h-8 w-8" aria-label="Página anterior" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}><ChevronLeft className="h-4 w-4" /></Button><Button variant="outline" size="icon" className="h-8 w-8" aria-label="Página siguiente" disabled={pagina >= paginas - 1} onClick={() => setPagina(pagina + 1)}><ChevronRight className="h-4 w-4" /></Button></span>
                </div>
              )}
            </>
          )}
        </>
      )}
      <MenuImportDialog open={importando} onOpenChange={setImportando} storeId={storeId} products={products} onDone={() => { onChange(); cargarVentas(); }} />
    </div>
  );
}

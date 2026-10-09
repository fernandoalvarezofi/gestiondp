import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Copy, Download, Eye, EyeOff, Loader2, MoreHorizontal, Pencil, Percent, Pause, Pencil as Rename, Play, Plus, Search, Star, Trash2, Upload, UtensilsCrossed } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { MenuImportDialog } from "@/components/merchant/MenuImportDialog";
import { OptionGroupsEditor } from "@/components/merchant/OptionGroupsEditor";
import { VariantsEditor } from "@/components/merchant/VariantsEditor";
import { StockHistoryButton } from "@/components/merchant/StockHistory";
import { MarketFields } from "@/components/merchant/MarketFields";
import { AtributoFila, atributosAFilas, filasAAtributos } from "@/services/categories";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { downloadCsv, toCsv } from "@/lib/csv";
import { db, DeliveryProduct, DeliverySection, errorMessage, ESTADO_PRODUCTO, EstadoProducto, img, margen, money, orderSections, precioRegular, stockBajo, tagLabels, TIPO_PRODUCTO, TipoProducto } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Archive, BadgePercent, FileClock, FolderPlus, History as HistoryIcon, Send } from "lucide-react";
import { catalogoMasivo, Coleccion, duplicarProducto, fetchColecciones, guardarProductosColeccion, isoADateTimeLocal, localDateTimeAIso, programarOferta, slugify, slugValido } from "@/services/catalogPro";
import { ProductHistoryDialog } from "@/components/merchant/ProductHistory";

type Draft = {
  id?: string; nombre: string; descripcion: string; categoria: string; precio: string; precio_anterior: string; stock: string; imagen_url: string; imagenes: string[]; destacado: boolean; disponible: boolean;
  etiquetas: string[]; categoria_id: string; marca: string; atributos: AtributoFila[]; en_market: boolean; en_tienda: boolean;
  tipo: TipoProducto; estado: EstadoProducto; publicar_desde: string; sku: string; codigo_barras: string; costo: string; stock_minimo: string; slug: string; seo_titulo: string; seo_descripcion: string;
  descripcion_larga: string; relacionados: string[]; colecciones: string[]; promo_precio: string; promo_desde: string; promo_hasta: string; promo_activa: boolean;
};
const emptyDraft: Draft = {
  nombre: "", descripcion: "", categoria: "", precio: "", precio_anterior: "", stock: "", imagen_url: "", imagenes: [], destacado: false, disponible: true, etiquetas: [], categoria_id: "", marca: "", atributos: [], en_market: true, en_tienda: true,
  tipo: "fisico", estado: "publicado", publicar_desde: "", sku: "", codigo_barras: "", costo: "", stock_minimo: "", slug: "", seo_titulo: "", seo_descripcion: "", descripcion_larga: "", relacionados: [], colecciones: [],
  promo_precio: "", promo_desde: "", promo_hasta: "", promo_activa: false,
};
type Filter = "todos" | EstadoProducto | "agotados" | "sin_foto" | "stock_bajo" | "oferta";

const toDraft = (product: DeliveryProduct, colecciones: string[] = []): Draft => ({
  ...emptyDraft,
  id: product.id,
  nombre: product.nombre,
  descripcion: product.descripcion || "",
  categoria: product.categoria,
  // Con una oferta corriendo, se edita el precio regular (la oferta se maneja aparte).
  precio: String(precioRegular(product)),
  precio_anterior: !product.promo_activa && product.precio_anterior ? String(product.precio_anterior) : "",
  tipo: product.tipo ?? "fisico",
  estado: product.estado ?? "publicado",
  publicar_desde: isoADateTimeLocal(product.publicar_desde),
  sku: product.sku ?? "",
  codigo_barras: product.codigo_barras ?? "",
  costo: product.costo == null ? "" : String(product.costo),
  stock_minimo: product.stock_minimo == null ? "" : String(product.stock_minimo),
  slug: product.slug ?? "",
  seo_titulo: product.seo_titulo ?? "",
  seo_descripcion: product.seo_descripcion ?? "",
  descripcion_larga: product.descripcion_larga ?? "",
  relacionados: product.relacionados ?? [],
  colecciones,
  promo_precio: product.precio_promo == null ? "" : String(product.precio_promo),
  promo_desde: isoADateTimeLocal(product.promo_desde),
  promo_hasta: isoADateTimeLocal(product.promo_hasta),
  promo_activa: Boolean(product.promo_activa),
  stock: product.stock === null || product.stock === undefined ? "" : String(product.stock),
  imagen_url: product.imagen_url || "",
  imagenes: product.imagenes || [],
  destacado: Boolean(product.destacado),
  disponible: product.disponible,
  etiquetas: product.etiquetas || [],
  categoria_id: product.categoria_id || "",
  marca: product.marca || "",
  atributos: atributosAFilas(product.atributos),
  en_market: product.en_market !== false,
  en_tienda: product.en_tienda !== false,
});

const soldOut = (product: DeliveryProduct) => !product.disponible || product.stock === 0;

/** Edita un número en el lugar (precio o stock): Enter o salir del campo guarda, Escape cancela. */
function InlineNumber({ value, label, format, allowEmpty, onSave }: { value: number | null | undefined; label: string; format: (value: number | null | undefined) => string; allowEmpty?: boolean; onSave: (value: number | null) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const commit = async () => {
    setEditing(false);
    const clean = text.trim();
    if (clean === "" && allowEmpty) { if (value != null) await onSave(null); return; }
    const number = Math.floor(Number(clean));
    if (!Number.isFinite(number) || number < (allowEmpty ? 0 : 1)) return toast.error(`${label} inválido`);
    if (number !== value) await onSave(number);
  };
  if (!editing) return <button type="button" title={`Editar ${label.toLowerCase()}`} onClick={() => { setText(value == null ? "" : String(value)); setEditing(true); }} className="rounded-md px-1.5 py-0.5 text-left font-bold underline-offset-2 hover:bg-muted hover:underline">{format(value)}</button>;
  return <Input autoFocus inputMode="numeric" aria-label={label} value={text} onChange={(event) => setText(event.target.value.replace(/\D/g, ""))} onBlur={commit} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); if (event.key === "Escape") setEditing(false); }} className="h-8 w-24" />;
}

export function MerchantMenu({ storeId, products, onChange }: { storeId: string; products: DeliveryProduct[]; onChange: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [config, setConfig] = useState<DeliverySection[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [colecciones, setColecciones] = useState<(Coleccion & { productos: string[] })[]>([]);
  const [historial, setHistorial] = useState<DeliveryProduct | null>(null);

  const loadConfig = useCallback(async () => {
    const { data } = await db.from("delivery_secciones").select("*").eq("comercio_id", storeId);
    setConfig(data || []);
  }, [storeId]);
  const loadColecciones = useCallback(() => { fetchColecciones(storeId).then(setColecciones).catch(() => setColecciones([])); }, [storeId]);
  useEffect(() => { loadConfig(); loadColecciones(); }, [loadConfig, loadColecciones]);

  const sections = useMemo(() => orderSections(products, config, false), [products, config]);
  const names = sections.map((section) => section.name);
  const needle = term.trim().toLowerCase();
  const enFiltro = useCallback((product: DeliveryProduct, f: Filter) => {
    const estado = product.estado ?? "publicado";
    if (f === "todos") return estado !== "archivado";
    if (f === "agotados") return soldOut(product);
    if (f === "sin_foto") return !product.imagen_url;
    if (f === "stock_bajo") return stockBajo(product);
    if (f === "oferta") return Boolean(product.promo_activa || product.precio_promo);
    return estado === f;
  }, []);
  const matches = useCallback((product: DeliveryProduct) => (!needle || `${product.nombre} ${product.categoria} ${product.sku ?? ""} ${product.codigo_barras ?? ""} ${product.marca ?? ""}`.toLowerCase().includes(needle))
    && enFiltro(product, filter), [needle, filter, enFiltro]);
  const visibleProducts = products.filter(matches);
  const contar = (f: Filter) => products.filter((p) => enFiltro(p, f)).length;

  const run = async (action: () => PromiseLike<{ error: unknown }>, success?: string) => {
    setBusy(true);
    const { error } = await action();
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return false; }
    if (success) toast.success(success);
    return true;
  };

  const patchProduct = async (product: DeliveryProduct, patch: Partial<DeliveryProduct>) => {
    if (await run(() => db.from("delivery_productos").update(patch).eq("id", product.id))) onChange();
  };
  const toggle = (product: DeliveryProduct, field: "disponible" | "destacado") => patchProduct(product, { [field]: !product[field] });

  const remove = async (product: DeliveryProduct) => {
    if (!window.confirm(`¿Eliminar “${product.nombre}”? Los pedidos anteriores no se ven afectados.`)) return;
    if (await run(() => db.from("delivery_productos").delete().eq("id", product.id), "Producto eliminado")) onChange();
  };

  // Duplica todo (variantes, opciones y colecciones) en el servidor; la copia queda en borrador y sin SKU.
  const duplicate = async (product: DeliveryProduct) => {
    setBusy(true);
    try { await duplicarProducto(product.id); toast.success("Duplicado como borrador: revisalo y publicalo cuando esté listo"); onChange(); }
    catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const masivo = async (accion: Parameters<typeof catalogoMasivo>[2], valor: Record<string, unknown> = {}, ok = "Listo") => {
    setBusy(true);
    try { const n = await catalogoMasivo(storeId, ids, accion, valor); toast.success(`${ok} (${n})`); setSelected(new Set()); onChange(); loadColecciones(); }
    catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  // ---- Secciones ----
  const saveOrder = async (ordered: string[]) => {
    const rows = ordered.map((nombre, index) => ({ comercio_id: storeId, nombre, orden: index * 10, visible: config.find((section) => section.nombre === nombre)?.visible ?? true }));
    if (await run(() => db.from("delivery_secciones").upsert(rows, { onConflict: "comercio_id,nombre" }))) loadConfig();
  };
  const moveSection = (name: string, direction: -1 | 1) => {
    const list = [...names];
    const index = list.indexOf(name);
    const target = index + direction;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    saveOrder(list);
  };
  const toggleSection = async (name: string, visible: boolean) => {
    const current = config.find((section) => section.nombre === name);
    const orden = current?.orden ?? names.indexOf(name) * 10;
    if (await run(() => db.from("delivery_secciones").upsert({ comercio_id: storeId, nombre: name, orden, visible }, { onConflict: "comercio_id,nombre" }))) loadConfig();
  };
  const renameSection = async (name: string) => {
    const next = window.prompt("Nuevo nombre de la sección", name)?.trim();
    if (!next || next === name) return;
    if (await run(() => db.rpc("delivery_renombrar_seccion", { p_comercio: storeId, p_actual: name, p_nuevo: next }), "Sección renombrada")) { loadConfig(); onChange(); }
  };
  const addSection = async () => {
    const name = window.prompt("Nombre de la nueva sección (ej.: Bebidas, Postres)")?.trim().slice(0, 40);
    if (!name) return;
    if (names.includes(name)) return toast.error("Ya tenés una sección con ese nombre");
    if (await run(() => db.from("delivery_secciones").insert({ comercio_id: storeId, nombre: name, orden: names.length * 10 }), "Sección creada")) loadConfig();
  };
  const deleteSection = async (name: string) => {
    if (!window.confirm(`¿Eliminar la sección “${name}”?`)) return;
    if (await run(() => db.from("delivery_secciones").delete().eq("comercio_id", storeId).eq("nombre", name))) loadConfig();
  };

  const moveProduct = async (product: DeliveryProduct, direction: -1 | 1) => {
    const peers = products.filter((item) => item.categoria === product.categoria).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre, "es"));
    const index = peers.findIndex((item) => item.id === product.id);
    const target = index + direction;
    if (target < 0 || target >= peers.length) return;
    [peers[index], peers[target]] = [peers[target], peers[index]];
    setBusy(true);
    const results = await Promise.all(peers.map((item, position) => (item.orden === position ? null : db.from("delivery_productos").update({ orden: position }).eq("id", item.id))));
    setBusy(false);
    if (results.some((result) => result?.error)) toast.error("No pudimos reordenar");
    onChange();
  };

  // ---- Selección y acciones masivas ----
  const ids = [...selected];
  const toggleSelected = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const bulk = async (action: () => PromiseLike<{ error: unknown }>, success: string) => {
    if (await run(action, success)) { setSelected(new Set()); onChange(); }
  };
  const bulkPrice = async () => {
    const raw = window.prompt("Ajuste de precio en % (ej.: 10 sube 10%, -15 baja 15% y muestra el precio anterior como oferta)");
    if (raw === null) return;
    const pct = Number(raw.replace(",", "."));
    if (!Number.isFinite(pct) || pct === 0 || pct < -90 || pct > 300) return toast.error("Ingresá un porcentaje entre -90 y 300");
    if (!window.confirm(`Se ${pct > 0 ? "sube" : "baja"} ${Math.abs(pct)}% el precio de ${ids.length} productos. ¿Continuar?`)) return;
    await bulk(() => db.rpc("delivery_ajustar_precios", { p_comercio: storeId, p_ids: ids, p_pct: pct }), "Precios actualizados");
  };
  const bulkDelete = async () => {
    if (!window.confirm(`¿Eliminar ${ids.length} productos? No se puede deshacer.`)) return;
    await bulk(() => db.from("delivery_productos").delete().in("id", ids), "Productos eliminados");
  };

  // Misma estructura que acepta la importación: se puede exportar, editar en una planilla y volver a importar.
  const exportCsv = () => {
    const base = (p: DeliveryProduct) => [p.categoria, p.nombre, p.descripcion ?? ""];
    const extra = (p: DeliveryProduct, costo: number | null | undefined, barras: string | null | undefined, minimo: number | null | undefined) =>
      [costo ?? "", barras ?? "", minimo ?? "", ESTADO_PRODUCTO[p.estado ?? "publicado"].texto, TIPO_PRODUCTO[p.tipo ?? "fisico"], p.marca ?? "", precioRegular(p) !== Number(p.precio) ? "" : p.precio_anterior ?? ""];
    const csv = toCsv(["Sección", "Nombre", "Descripción", "Precio", "Stock", "Disponible", "Variante", "SKU", "Costo", "Código de barras", "Stock mínimo", "Estado", "Tipo", "Marca", "Precio anterior"], products.flatMap((product) => (product.usa_variantes && product.variantes?.length
      ? [...product.variantes].sort((x, y) => x.orden - y.orden).map((v) => [...base(product), v.precio ?? precioRegular(product), v.stock ?? "", product.disponible && v.disponible ? "si" : "no", v.nombre, v.sku ?? "", ...extra(product, v.costo ?? product.costo, v.codigo_barras, v.stock_minimo ?? product.stock_minimo)])
      : [[...base(product), precioRegular(product), product.stock ?? "", product.disponible ? "si" : "no", "", product.sku ?? "", ...extra(product, product.costo, product.codigo_barras, product.stock_minimo)]])));
    downloadCsv("catalogo-woref.csv", csv);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-full border bg-card px-4 transition-shadow focus-within:ring-2 focus-within:ring-ring/30"><Search className="h-4 w-4 text-muted-foreground" /><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar en tu menú" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Buscar en tu menú" /></label>
        <Button variant="outline" className="rounded-full" onClick={addSection}><Plus className="h-4 w-4" />Sección</Button>
        <Button variant="outline" className="rounded-full" onClick={() => setImporting(true)}><Upload className="h-4 w-4" />Importar</Button>
        <Button variant="outline" className="rounded-full" onClick={exportCsv} disabled={products.length === 0}><Download className="h-4 w-4" />Exportar</Button>
        <Button className="rounded-full" onClick={() => setDraft({ ...emptyDraft, categoria: names[0] || "Destacados" })}><Plus className="h-4 w-4" />Nuevo producto</Button>
      </div>

      {products.length > 0 && (
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
          {([["todos", "Activos"], ["publicado", "Publicados"], ["borrador", "Borradores"], ["programado", "Programados"], ["oferta", "En oferta"], ["agotados", "Agotados o pausados"], ["stock_bajo", "Stock bajo"], ["sin_foto", "Sin foto"], ["archivado", "Archivados"]] as [Filter, string][])
            .map(([value, label]) => ({ value, label, n: contar(value) })).filter((c) => c.value === "todos" || c.value === filter || c.n > 0)
            .map(({ value, label, n }) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold", filter === value ? "border-foreground bg-foreground text-background" : "bg-card", value === "stock_bajo" && filter !== value && "border-warning/60")}>{label} ({n})</button>
            ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-14 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2.5 shadow-pop" role="toolbar" aria-label="Acciones sobre la selección">
          <span className="px-2 text-sm font-extrabold">{selected.size} seleccionados</span>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => bulk(() => db.from("delivery_productos").update({ disponible: false }).in("id", ids), "Productos pausados")}><Pause className="h-4 w-4" />Pausar</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => bulk(() => db.from("delivery_productos").update({ disponible: true }).in("id", ids), "Productos activados")}><Play className="h-4 w-4" />Activar</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => masivo("publicar", {}, "Publicados")}><Send className="h-4 w-4" />Publicar</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => masivo("borrador", {}, "Pasados a borrador")}><FileClock className="h-4 w-4" />Borrador</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => masivo("archivar", {}, "Archivados")}><Archive className="h-4 w-4" />Archivar</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={bulkPrice}><Percent className="h-4 w-4" />Precio</Button>
          {colecciones.length > 0 && (
            <select value="" onChange={(event) => { const id = event.target.value; if (id) masivo("coleccion", { valor: id }, "Agregados a la colección"); }} aria-label="Agregar a colección" className="h-8 rounded-full border bg-background px-3 text-sm font-semibold">
              <option value="">Agregar a colección…</option>
              {colecciones.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          )}
          <select value={moveTo} onChange={(event) => { const section = event.target.value; setMoveTo(""); if (section) bulk(() => db.from("delivery_productos").update({ categoria: section }).in("id", ids), `Movidos a ${section}`); }} aria-label="Mover a sección" className="h-8 rounded-full border bg-background px-3 text-sm font-semibold">
            <option value="">Mover a…</option>
            {names.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <Button size="sm" variant="outline" className="rounded-full text-destructive" disabled={busy} onClick={bulkDelete}><Trash2 className="h-4 w-4" />Eliminar</Button>
          <Button size="sm" variant="ghost" className="ml-auto rounded-full" onClick={() => setSelected(new Set())}>Cancelar</Button>
        </div>
      )}

      {products.length === 0 && config.length === 0 ? (
        <EmptyState className="mt-4" icon={<UtensilsCrossed className="h-7 w-7" />} title="Tu menú está vacío" text="Cargá tus productos con foto y precio, o importá una planilla para empezar más rápido." action={<div className="flex flex-wrap justify-center gap-2"><Button className="rounded-full" onClick={() => setDraft({ ...emptyDraft, categoria: "Destacados" })}><Plus className="h-4 w-4" />Cargar el primero</Button><Button variant="outline" className="rounded-full" onClick={() => setImporting(true)}><Upload className="h-4 w-4" />Importar planilla</Button></div>} />
      ) : sections.map((section, sectionIndex) => {
        const items = visibleProducts.filter((product) => product.categoria === section.name).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0) || a.nombre.localeCompare(b.nombre, "es"));
        if ((needle || filter !== "todos") && items.length === 0) return null;
        const allSelected = items.length > 0 && items.every((product) => selected.has(product.id));
        return (
          <section key={section.name} className="mt-7">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {items.length > 0 && <input type="checkbox" checked={allSelected} onChange={() => setSelected((current) => { const next = new Set(current); items.forEach((product) => (allSelected ? next.delete(product.id) : next.add(product.id))); return next; })} aria-label={`Seleccionar toda la sección ${section.name}`} className="h-4 w-4 accent-primary" />}
              <h3 className={cn("text-[15px] font-extrabold", !section.visible && "text-muted-foreground")}>{section.name}</h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">{products.filter((product) => product.categoria === section.name).length}</span>
              {!section.visible && <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-bold">Oculta para clientes</span>}
              <span className="ml-auto flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Opciones de la sección ${section.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onClick={() => renameSection(section.name)}><Rename className="h-4 w-4" />Renombrar</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleSection(section.name, !section.visible)}>{section.visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}{section.visible ? "Ocultar para clientes" : "Mostrar a clientes"}</DropdownMenuItem>
                    <DropdownMenuItem disabled={busy || sectionIndex === 0} onClick={() => moveSection(section.name, -1)}><ArrowUp className="h-4 w-4" />Subir sección</DropdownMenuItem>
                    <DropdownMenuItem disabled={busy || sectionIndex === sections.length - 1} onClick={() => moveSection(section.name, 1)}><ArrowDown className="h-4 w-4" />Bajar sección</DropdownMenuItem>
                    {products.every((product) => product.categoria !== section.name) && <><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => deleteSection(section.name)}><Trash2 className="h-4 w-4" />Eliminar sección</DropdownMenuItem></>}
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </div>
            {items.length === 0 ? <p className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">Sección vacía. Agregá productos o movelos desde otra sección.</p> : (
              <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
                {items.map((product, index) => (
                  <li key={product.id} className={cn("flex flex-wrap items-center gap-3 p-3", selected.has(product.id) && "bg-primary/5")}>
                    <input type="checkbox" checked={selected.has(product.id)} onChange={() => toggleSelected(product.id)} aria-label={`Seleccionar ${product.nombre}`} className="h-4 w-4 accent-primary" />
                    <img src={img(product.imagen_url, 160)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1 basis-40">
                      <p className="flex flex-wrap items-center gap-1.5 font-bold">{product.destacado && <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />}<span className="truncate">{product.nombre}</span>
                        {(product.estado ?? "publicado") !== "publicado" && <span className={cn("rounded-full px-1.5 text-[10px] font-bold", ESTADO_PRODUCTO[product.estado ?? "publicado"].clase)}>{ESTADO_PRODUCTO[product.estado ?? "publicado"].texto}</span>}
                        {product.promo_activa && <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-yellow/25 px-1.5 text-[10px] font-bold text-brand-yellow-foreground"><BadgePercent className="h-3 w-3" />oferta</span>}
                        {stockBajo(product) && <span className="rounded-full bg-warning/25 px-1.5 text-[10px] font-bold">stock bajo</span>}
                        {!product.imagen_url && <span className="rounded-full bg-warning/20 px-1.5 text-[10px] font-bold">sin foto</span>}
                        {product.sku && <span className="text-[11px] font-semibold text-muted-foreground">{product.sku}</span>}</p>
                      <p className="flex flex-wrap items-center gap-x-1 text-sm">
                        {product.promo_activa && <span className="font-bold text-brand-yellow-foreground">{money(product.precio)}</span>}
                        <InlineNumber value={precioRegular(product)} label={product.promo_activa ? "Precio regular" : "Precio"} format={(value) => (product.promo_activa ? `regular ${money(value ?? 0)}` : money(value ?? 0))} onSave={async (value) => { await patchProduct(product, { precio: value as number }); }} />
                        {!product.promo_activa && product.precio_anterior && <span className="text-xs text-muted-foreground line-through">{money(product.precio_anterior)}</span>}
                        <span className="text-xs text-muted-foreground">· Stock:</span>
                        <InlineNumber value={product.stock} label="Stock" allowEmpty format={(value) => (value == null ? "ilimitado" : String(value))} onSave={async (value) => { await patchProduct(product, { stock: value }); }} />
                      </p>
                    </div>
                    <label className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground sm:flex">{product.disponible ? "Disponible" : "Pausado"}<Switch checked={product.disponible} onCheckedChange={() => toggle(product, "disponible")} /></label>
                    <Switch className="sm:hidden" checked={product.disponible} onCheckedChange={() => toggle(product, "disponible")} aria-label="Disponible" />
                    <span className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Editar ${product.nombre}`} title="Editar" onClick={() => setDraft(toDraft(product, colecciones.filter((c) => c.productos.includes(product.id)).map((c) => c.id)))}><Pencil className="h-4 w-4" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Más acciones de ${product.nombre}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => toggle(product, "destacado")}><Star className={product.destacado ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4"} />{product.destacado ? "Quitar de destacados" : "Destacar"}</DropdownMenuItem>
                          <DropdownMenuItem disabled={busy} onClick={() => duplicate(product)}><Copy className="h-4 w-4" />Duplicar</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setHistorial(product)}><HistoryIcon className="h-4 w-4" />Historial de cambios</DropdownMenuItem>
                          {(product.estado ?? "publicado") !== "archivado"
                            ? <DropdownMenuItem disabled={busy} onClick={() => patchProduct(product, { estado: "archivado" })}><Archive className="h-4 w-4" />Archivar</DropdownMenuItem>
                            : <DropdownMenuItem disabled={busy} onClick={() => patchProduct(product, { estado: "borrador" })}><FileClock className="h-4 w-4" />Sacar del archivo</DropdownMenuItem>}
                          <DropdownMenuItem disabled={busy || index === 0} onClick={() => moveProduct(product, -1)}><ArrowUp className="h-4 w-4" />Subir en la sección</DropdownMenuItem>
                          <DropdownMenuItem disabled={busy || index === items.length - 1} onClick={() => moveProduct(product, 1)}><ArrowDown className="h-4 w-4" />Bajar en la sección</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => remove(product)}><Trash2 className="h-4 w-4" />Eliminar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      {visibleProducts.length === 0 && products.length > 0 && <p className="mt-6 rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No hay productos con este filtro.</p>}

      <ProductEditor storeId={storeId} draft={draft} categories={names} products={products} colecciones={colecciones} onClose={() => setDraft(null)} onSaved={(close) => { if (close) setDraft(null); onChange(); loadColecciones(); }} onOptionsChanged={onChange} />
      <ProductHistoryDialog storeId={storeId} product={historial} onClose={() => setHistorial(null)} />
      <MenuImportDialog open={importing} onOpenChange={setImporting} storeId={storeId} products={products} onDone={() => { onChange(); loadConfig(); }} />
    </div>
  );
}

type EditorTab = "general" | "precio" | "fotos" | "organizacion" | "variantes";
const EDITOR_TABS: [EditorTab, string][] = [["general", "General"], ["precio", "Precio e inventario"], ["fotos", "Fotos"], ["organizacion", "Organización y SEO"], ["variantes", "Variantes y opciones"]];

function ProductEditor({ storeId, draft, categories, products, colecciones, onClose, onSaved, onOptionsChanged }: {
  storeId: string; draft: Draft | null; categories: string[]; products: DeliveryProduct[]; colecciones: (Coleccion & { productos: string[] })[];
  onClose: () => void; onSaved: (close: boolean) => void; onOptionsChanged: () => void;
}) {
  const [values, setValues] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<EditorTab>("general");
  const [openedFor, setOpenedFor] = useState<Draft | null>(null);
  const [buscaRel, setBuscaRel] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  if (draft !== openedFor) { setOpenedFor(draft); if (draft) { setValues(draft); setTab("general"); } }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setValues((current) => ({ ...current, [key]: value }));
  const toggleTag = (tag: string) => set("etiquetas", values.etiquetas.includes(tag) ? values.etiquetas.filter((item) => item !== tag) : values.etiquetas.length >= 6 ? values.etiquetas : [...values.etiquetas, tag]);
  const toggleIn = (key: "relacionados" | "colecciones", id: string, max: number) => set(key, values[key].includes(id) ? values[key].filter((x) => x !== id) : values[key].length >= max ? values[key] : [...values[key], id]);

  const precioNum = Number(values.precio);
  const costoNum = values.costo === "" ? null : Number(values.costo);
  const mg = margen(precioNum, costoNum);
  const original = draft?.id ? products.find((p) => p.id === draft.id) : undefined;
  const slugVista = values.slug || slugify(values.nombre, 80);
  // Advertencias de contenido: no bloquean, ayudan a publicar algo completo.
  const avisos = [
    !values.imagen_url && "No tiene foto principal: los productos sin foto se venden mucho menos.",
    values.descripcion.trim().length < 20 && "La descripción es muy corta.",
    values.tipo === "fisico" && values.stock === "" && values.stock_minimo !== "" && "Pusiste stock mínimo pero el stock es ilimitado.",
    costoNum != null && precioNum > 0 && costoNum >= precioNum && "El costo es igual o mayor al precio: estás vendiendo sin ganancia.",
  ].filter(Boolean) as string[];

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const precio = Number(values.precio);
    const anterior = values.precio_anterior ? Number(values.precio_anterior) : null;
    if (!values.nombre.trim() || !(precio > 0)) { setTab("general"); return toast.error("Completá nombre y precio"); }
    if (anterior !== null && anterior <= precio) { setTab("precio"); return toast.error("El precio anterior tiene que ser mayor al precio actual (si no, no hay oferta)"); }
    if (values.costo !== "" && !(Number(values.costo) >= 0)) { setTab("precio"); return toast.error("El costo no es válido"); }
    if (values.codigo_barras && !/^[0-9A-Za-z-]{4,32}$/.test(values.codigo_barras.trim())) { setTab("precio"); return toast.error("El código de barras solo admite letras, números y guiones (4 a 32)"); }
    if (values.slug && !slugValido(values.slug)) { setTab("organizacion"); return toast.error("La dirección solo admite minúsculas, números y guiones"); }
    if (values.estado === "programado" && !values.publicar_desde) { setTab("general"); return toast.error("Elegí cuándo se publica"); }
    const promo = values.promo_precio === "" ? null : Number(values.promo_precio);
    if (promo !== null && !(promo > 0 && promo < precio)) { setTab("precio"); return toast.error("El precio de oferta tiene que ser menor al precio regular"); }
    const categoria = values.categoria.trim() || "Destacados";
    const payload = {
      comercio_id: storeId,
      nombre: values.nombre.trim(),
      descripcion: values.descripcion.trim() || null,
      categoria,
      precio,
      precio_anterior: values.promo_activa ? undefined : anterior,
      stock: values.stock === "" ? null : Math.max(0, Math.floor(Number(values.stock))),
      imagen_url: values.imagen_url.trim() || null,
      imagenes: values.imagenes.slice(0, 5),
      destacado: values.destacado,
      disponible: values.disponible,
      etiquetas: values.etiquetas,
      categoria_id: values.categoria_id || null,
      marca: values.marca.trim() || null,
      atributos: filasAAtributos(values.atributos),
      en_market: values.en_market,
      en_tienda: values.en_tienda,
      tipo: values.tipo,
      estado: values.estado,
      publicar_desde: values.estado === "programado" ? localDateTimeAIso(values.publicar_desde) : null,
      sku: values.sku.trim() || null,
      codigo_barras: values.codigo_barras.trim() || null,
      costo: values.costo === "" ? null : Number(values.costo),
      stock_minimo: values.stock_minimo === "" ? null : Math.max(0, Math.floor(Number(values.stock_minimo))),
      slug: values.slug.trim() || null,
      seo_titulo: values.seo_titulo.trim() || null,
      seo_descripcion: values.seo_descripcion.trim() || null,
      descripcion_larga: values.descripcion_larga.trim() || null,
      relacionados: values.relacionados,
    };
    setSaving(true);
    let id = values.id;
    if (id) {
      const { error } = await db.from("delivery_productos").update(payload).eq("id", id);
      if (error) { setSaving(false); return toast.error(errorMessage(error)); }
    } else {
      const orden = Math.max(0, ...products.filter((product) => product.categoria === categoria).map((product) => product.orden ?? 0)) + 1;
      const { data, error } = await db.from("delivery_productos").insert({ ...payload, orden }).select("id").single();
      if (error) { setSaving(false); return toast.error(errorMessage(error)); }
      id = data.id as string;
    }
    try {
      // Oferta programada: solo si cambió algo (la valida y aplica el servidor).
      const promoAntes = original ? `${original.precio_promo ?? ""}|${isoADateTimeLocal(original.promo_desde)}|${isoADateTimeLocal(original.promo_hasta)}` : "||";
      const promoAhora = `${promo ?? ""}|${promo === null ? "" : values.promo_desde}|${promo === null ? "" : values.promo_hasta}`;
      if (promoAntes !== promoAhora) await programarOferta(id, promo, localDateTimeAIso(values.promo_desde), localDateTimeAIso(values.promo_hasta));
      // Colecciones del producto.
      for (const c of colecciones) {
        const tiene = c.productos.includes(id); const quiere = values.colecciones.includes(c.id);
        if (tiene !== quiere) await guardarProductosColeccion(c.id, quiere ? [...c.productos, id] : c.productos.filter((p) => p !== id));
      }
    } catch (error) { setSaving(false); toast.error(errorMessage(error)); onSaved(false); return; }
    setSaving(false);
    if (values.id) { toast.success("Producto guardado"); onSaved(true); return; }
    // Queda abierto para sumarle variantes y opciones al producto recién creado.
    setValues((current) => ({ ...current, id }));
    setTab("variantes");
    toast.success("Producto creado. Si querés, agregale variantes u opciones.");
    onSaved(false);
  };

  const candidatosRel = products.filter((p) => p.id !== values.id && (p.estado ?? "publicado") !== "archivado" && (!buscaRel.trim() || p.nombre.toLowerCase().includes(buscaRel.trim().toLowerCase()))).slice(0, 30);

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle className="text-xl font-extrabold">{values.id ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
        <div role="tablist" aria-label="Secciones del producto" className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1">
          {EDITOR_TABS.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("h-8 shrink-0 rounded-full border px-3 text-sm font-bold", tab === id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{label}</button>)}
        </div>
        {avisos.length > 0 && tab !== "variantes" && <ul className="space-y-1 rounded-2xl bg-warning/10 p-3 text-xs font-semibold">{avisos.map((a) => <li key={a}>• {a}</li>)}</ul>}
        <form onSubmit={submit} className="space-y-4">
          <div className={cn("grid gap-4 sm:grid-cols-2", tab !== "general" && "hidden")}>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-nombre">Nombre</Label><Input id="p-nombre" ref={nameInput} required maxLength={80} value={values.nombre} onChange={(event) => set("nombre", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="p-tipo">Tipo de producto</Label>
              <select id="p-tipo" value={values.tipo} onChange={(e) => set("tipo", e.target.value as TipoProducto)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{(Object.keys(TIPO_PRODUCTO) as TipoProducto[]).map((t) => <option key={t} value={t}>{TIPO_PRODUCTO[t]}</option>)}</select>
              <p className="text-xs text-muted-foreground">{values.tipo === "digital" ? "Sin stock físico ni envío (lo entregás vos por mensaje o email)." : values.tipo === "servicio" ? "Para turnos con agenda usá Reservas y turnos." : "Con stock y envío o retiro."}</p></div>
            <div className="space-y-1.5"><Label htmlFor="p-cat">Sección del catálogo</Label><Input id="p-cat" list="menu-sections" maxLength={40} value={values.categoria} onChange={(event) => set("categoria", event.target.value)} /><datalist id="menu-sections">{categories.map((item) => <option key={item} value={item} />)}</datalist></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-desc">Descripción corta</Label><Textarea id="p-desc" maxLength={300} value={values.descripcion} onChange={(event) => set("descripcion", event.target.value)} className="min-h-[64px]" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-larga">Descripción completa <span className="font-normal text-muted-foreground">(admite **negrita**, listas con “- ” y párrafos)</span></Label><Textarea id="p-larga" maxLength={8000} value={values.descripcion_larga} onChange={(event) => set("descripcion_larga", event.target.value)} className="min-h-[120px]" placeholder={"Materiales, medidas, cuidados…\n- Algodón 100%\n- Hecho en Argentina"} /></div>
            <div className="space-y-1.5"><Label htmlFor="p-estado">Estado</Label>
              <select id="p-estado" value={values.estado} onChange={(e) => set("estado", e.target.value as EstadoProducto)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{(Object.keys(ESTADO_PRODUCTO) as EstadoProducto[]).map((t) => <option key={t} value={t}>{ESTADO_PRODUCTO[t].texto}</option>)}</select>
              <p className="text-xs text-muted-foreground">Solo lo publicado se ve y se puede comprar.</p></div>
            {values.estado === "programado" && <div className="space-y-1.5"><Label htmlFor="p-pub">Se publica el</Label><Input id="p-pub" type="datetime-local" value={values.publicar_desde} onChange={(e) => set("publicar_desde", e.target.value)} /></div>}
            <div className="flex flex-col justify-center gap-3 sm:col-span-2 sm:flex-row sm:justify-start sm:gap-6">
              <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={values.disponible} onCheckedChange={(checked) => set("disponible", checked)} />Disponible para comprar</label>
              <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={values.destacado} onCheckedChange={(checked) => set("destacado", checked)} />Destacado</label>
            </div>
          </div>

          <div className={cn("grid gap-4 sm:grid-cols-2", tab !== "precio" && "hidden")}>
            <div className="space-y-1.5"><Label htmlFor="p-precio">{values.promo_activa ? "Precio regular ($)" : "Precio ($)"}</Label><Input id="p-precio" type="number" min={1} required value={values.precio} onChange={(event) => set("precio", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="p-antes">Precio de comparación (tachado)</Label><Input id="p-antes" type="number" min={0} disabled={values.promo_activa} value={values.precio_anterior} onChange={(event) => set("precio_anterior", event.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="p-costo">Costo ($, solo lo ves vos)</Label><Input id="p-costo" type="number" min={0} step="0.01" value={values.costo} onChange={(event) => set("costo", event.target.value)} /></div>
            <div className="flex items-end"><p className={cn("w-full rounded-xl p-2.5 text-sm font-bold", mg == null ? "bg-muted text-muted-foreground" : mg < 0 ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>{mg == null ? "Cargá el costo para ver el margen" : `Margen estimado: ${mg}% (${money(precioNum - (costoNum ?? 0))} por unidad)`}</p></div>
            <fieldset className="grid gap-3 rounded-2xl border p-3 sm:col-span-2 sm:grid-cols-3">
              <legend className="px-1 text-sm font-extrabold">Oferta programada</legend>
              <div className="space-y-1.5"><Label htmlFor="p-promo">Precio de oferta</Label><Input id="p-promo" type="number" min={1} value={values.promo_precio} onChange={(e) => set("promo_precio", e.target.value)} placeholder="Sin oferta" /></div>
              <div className="space-y-1.5"><Label htmlFor="p-pdesde">Desde</Label><Input id="p-pdesde" type="datetime-local" value={values.promo_desde} onChange={(e) => set("promo_desde", e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="p-phasta">Hasta</Label><Input id="p-phasta" type="datetime-local" value={values.promo_hasta} onChange={(e) => set("promo_hasta", e.target.value)} /></div>
              <p className="text-xs text-muted-foreground sm:col-span-3">{values.promo_activa ? "La oferta está activa ahora. " : ""}Empieza y termina sola: mientras dura, la tienda muestra el precio regular tachado y el carrito cobra el de oferta. Vacío “desde” = ahora; vacío “hasta” = hasta que la quites. Las variantes con precio propio mantienen el suyo.</p>
            </fieldset>
            <div className="space-y-1.5"><Label htmlFor="p-stock">Stock {values.tipo !== "fisico" ? "(opcional)" : "(vacío = ilimitado)"}</Label><Input id="p-stock" type="number" min={0} value={values.stock} onChange={(event) => set("stock", event.target.value)} />{values.id && <div className="pt-1"><StockHistoryButton storeId={storeId} productId={values.id} /></div>}</div>
            <div className="space-y-1.5"><Label htmlFor="p-min">Avisarme con stock en (mínimo)</Label><Input id="p-min" type="number" min={0} value={values.stock_minimo} onChange={(event) => set("stock_minimo", event.target.value)} placeholder="Sin alerta" /></div>
            <div className="space-y-1.5"><Label htmlFor="p-sku">SKU (código interno)</Label><Input id="p-sku" maxLength={40} value={values.sku} onChange={(event) => set("sku", event.target.value)} placeholder="REM-001" /></div>
            <div className="space-y-1.5"><Label htmlFor="p-ean">Código de barras</Label><Input id="p-ean" maxLength={32} inputMode="numeric" value={values.codigo_barras} onChange={(event) => set("codigo_barras", event.target.value)} placeholder="7790000000000" /></div>
          </div>

          <div className={cn("space-y-4", tab !== "fotos" && "hidden")}>
            <ImageUpload label="Foto principal" folder="productos" shape="square" value={values.imagen_url} onChange={(url) => set("imagen_url", url)} />
            <div className="space-y-2">
              <p className="text-sm font-semibold">Galería <span className="font-normal text-muted-foreground">(hasta 5 fotos más; usá las flechas para ordenarlas)</span></p>
              {values.imagenes.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {values.imagenes.map((url, index) => (
                    <li key={`${url}-${index}`} className="relative">
                      <img src={img(url, 160)} alt={`Foto ${index + 2}`} className="h-20 w-20 rounded-xl border object-cover" />
                      <button type="button" aria-label={`Quitar foto ${index + 2}`} onClick={() => set("imagenes", values.imagenes.filter((_, i) => i !== index))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white shadow">×</button>
                      <span className="absolute inset-x-0 bottom-0 flex justify-between p-0.5">
                        <button type="button" aria-label="Mover antes" disabled={index === 0} onClick={() => { const n = [...values.imagenes]; [n[index - 1], n[index]] = [n[index], n[index - 1]]; set("imagenes", n); }} className="rounded bg-black/60 px-1 text-[10px] text-white disabled:opacity-30">◀</button>
                        <button type="button" aria-label="Usar como principal" onClick={() => { const n = [...values.imagenes]; const [f] = n.splice(index, 1); set("imagenes", values.imagen_url ? [values.imagen_url, ...n] : n); set("imagen_url", f); }} className="rounded bg-black/60 px-1 text-[10px] text-white">★</button>
                        <button type="button" aria-label="Mover después" disabled={index === values.imagenes.length - 1} onClick={() => { const n = [...values.imagenes]; [n[index + 1], n[index]] = [n[index], n[index + 1]]; set("imagenes", n); }} className="rounded bg-black/60 px-1 text-[10px] text-white disabled:opacity-30">▶</button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {values.imagenes.length < 5 && <ImageUpload label={`Agregar foto (${values.imagenes.length}/5)`} folder="productos" shape="square" value="" onChange={(url) => set("imagenes", [...values.imagenes, url])} />}
            </div>
          </div>

          <div className={cn("grid gap-4 sm:grid-cols-2", tab !== "organizacion" && "hidden")}>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(tagLabels).map(([tag, label]) => <button key={tag} type="button" aria-pressed={values.etiquetas.includes(tag)} onClick={() => toggleTag(tag)} className={cn("rounded-full border px-3 py-1 text-xs font-bold", values.etiquetas.includes(tag) ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted")}>{label}</button>)}
              </div>
            </div>
            <MarketFields values={values} onChange={(next) => setValues((current) => ({ ...current, ...next }))} />
            {colecciones.length > 0 && (
              <div className="space-y-1.5 sm:col-span-2"><Label>Colecciones</Label>
                <div className="flex flex-wrap gap-1.5">{colecciones.map((c) => <button key={c.id} type="button" aria-pressed={values.colecciones.includes(c.id)} onClick={() => toggleIn("colecciones", c.id, 50)} className={cn("rounded-full border px-3 py-1 text-xs font-bold", values.colecciones.includes(c.id) ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted")}>{c.nombre}</button>)}</div></div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="p-rel">Productos relacionados <span className="font-normal text-muted-foreground">({values.relacionados.length}/12, se muestran en la ficha)</span></Label>
              {values.relacionados.length > 0 && <div className="flex flex-wrap gap-1.5">{values.relacionados.map((id) => { const p = products.find((x) => x.id === id); return p ? <button key={id} type="button" onClick={() => toggleIn("relacionados", id, 12)} className="rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{p.nombre} ×</button> : null; })}</div>}
              <Input id="p-rel" value={buscaRel} onChange={(e) => setBuscaRel(e.target.value)} placeholder="Buscar producto para sumar" />
              {buscaRel.trim() && <ul className="max-h-36 divide-y overflow-y-auto rounded-xl border">{candidatosRel.filter((p) => !values.relacionados.includes(p.id)).map((p) => <li key={p.id}><button type="button" onClick={() => { toggleIn("relacionados", p.id, 12); setBuscaRel(""); }} className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-muted"><img src={img(p.imagen_url, 80)} alt="" className="h-8 w-8 rounded-lg object-cover" />{p.nombre}</button></li>)}</ul>}
            </div>
            <fieldset className="grid gap-3 rounded-2xl border p-3 sm:col-span-2">
              <legend className="px-1 text-sm font-extrabold">Buscadores (SEO)</legend>
              <div className="space-y-1.5"><Label htmlFor="p-slug">Dirección del producto</Label><Input id="p-slug" maxLength={80} value={values.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder={slugify(values.nombre, 80)} /></div>
              <div className="space-y-1.5"><Label htmlFor="p-seot">Título para Google <span className="font-normal text-muted-foreground">({values.seo_titulo.length}/70)</span></Label><Input id="p-seot" maxLength={70} value={values.seo_titulo} onChange={(e) => set("seo_titulo", e.target.value)} placeholder={values.nombre} /></div>
              <div className="space-y-1.5"><Label htmlFor="p-seod">Descripción para Google <span className="font-normal text-muted-foreground">({values.seo_descripcion.length}/170)</span></Label><Textarea id="p-seod" maxLength={170} value={values.seo_descripcion} onChange={(e) => set("seo_descripcion", e.target.value)} className="min-h-[56px] resize-none" placeholder={values.descripcion} /></div>
              <div className="rounded-xl bg-muted p-3 text-sm" aria-label="Vista previa en buscadores">
                <p className="truncate text-xs text-muted-foreground">woref.vercel.app › … › {slugVista}</p>
                <p className="truncate font-semibold text-sky-700 dark:text-sky-400">{values.seo_titulo || values.nombre || "Nombre del producto"}</p>
                <p className="line-clamp-2 text-xs text-muted-foreground">{values.seo_descripcion || values.descripcion || "Agregá una descripción para que se vea bien en Google y al compartir."}</p>
              </div>
            </fieldset>
          </div>

          {tab !== "variantes" && <Button type="submit" className="w-full rounded-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{values.id ? "Guardar" : "Crear producto"}</Button>}
        </form>
        {tab === "variantes" && (
          <>
            <div>
              <h3 className="font-extrabold">Variantes</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">Talle, color o capacidad, cada una con su SKU, código de barras, costo, precio y stock.</p>
              {values.id ? <VariantsEditor productId={values.id} onChange={onOptionsChanged} /> : <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">Guardá el producto primero y después agregale variantes acá mismo.</p>}
            </div>
            <div className="border-t pt-4">
              <h3 className="font-extrabold">Opciones del producto</h3>
              <p className="mt-0.5 text-sm text-muted-foreground">Tamaños, sabores, extras con precio…</p>
              {values.id ? <OptionGroupsEditor productId={values.id} onChange={onOptionsChanged} /> : <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">Guardá el producto primero y después agregale opciones acá mismo.</p>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

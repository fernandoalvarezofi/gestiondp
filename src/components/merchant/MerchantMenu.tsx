import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, MoreHorizontal, Pencil, Percent, Pause, Pencil as Rename, Play, Plus, Search, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { db, DeliveryProduct, DeliverySection, errorMessage, ESTADO_PRODUCTO, EstadoProducto, img, money, orderSections, precioRegular, stockBajo } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Archive, BadgePercent, FileClock, History as HistoryIcon, Send } from "lucide-react";
import { catalogoMasivo, Coleccion, duplicarProducto, fetchColecciones } from "@/services/catalogPro";
import { ProductHistoryDialog } from "@/components/merchant/ProductHistory";
import { confirmar, pedirTexto } from "@/components/ui/dialogos";

/*
 * Vista "Secciones y orden" del catálogo: ordenar secciones y productos como se ven en la tienda y en el menú, renombrar,
 * ocultar o eliminar secciones, y acciones rápidas por producto. La edición completa de un producto está en su propia página.
 */
type Filter = "todos" | EstadoProducto | "agotados" | "sin_foto" | "stock_bajo" | "oferta";

/** Sin stock para vender: el producto sin variantes con stock 0, o con variantes y ninguna con stock. */
const sinStock = (product: DeliveryProduct) => (product.usa_variantes && product.variantes?.length
  ? product.variantes.every((v) => !v.disponible || v.stock === 0)
  : product.stock === 0);
const soldOut = (product: DeliveryProduct) => !product.disponible || sinStock(product);

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
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [config, setConfig] = useState<DeliverySection[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
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
    if (!(await confirmar({ titulo: `¿Eliminar “${product.nombre}”?`, descripcion: "Desaparece del menú y de la tienda. Los pedidos anteriores no se ven afectados. Si solo querés ocultarlo un tiempo, marcalo como no disponible.", confirmar: "Eliminar", peligro: true }))) return;
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
    const next = await pedirTexto({ titulo: "Renombrar sección", descripcion: "Los productos de la sección pasan al nombre nuevo.", etiqueta: "Nombre", inicial: name, maximo: 40, confirmar: "Guardar", validar: (v) => (v !== name && names.includes(v) ? "Ya tenés una sección con ese nombre" : null) });
    if (!next || next === name) return;
    if (await run(() => db.rpc("delivery_renombrar_seccion", { p_comercio: storeId, p_actual: name, p_nuevo: next }), "Sección renombrada")) { loadConfig(); onChange(); }
  };
  const addSection = async () => {
    const name = await pedirTexto({ titulo: "Nueva sección", etiqueta: "Nombre", placeholder: "Ej.: Bebidas, Postres", maximo: 40, confirmar: "Crear sección", validar: (v) => (names.includes(v) ? "Ya tenés una sección con ese nombre" : null) });
    if (!name) return;
    if (names.includes(name)) return toast.error("Ya tenés una sección con ese nombre");
    if (await run(() => db.from("delivery_secciones").insert({ comercio_id: storeId, nombre: name, orden: names.length * 10 }), "Sección creada")) loadConfig();
  };
  const deleteSection = async (name: string) => {
    if (!(await confirmar({ titulo: `¿Eliminar la sección “${name}”?`, descripcion: "Se borra la sección del menú. Los productos que tenga no se eliminan.", confirmar: "Eliminar", peligro: true }))) return;
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
    const raw = await pedirTexto({ titulo: `Ajustar precios de ${ids.length} ${ids.length === 1 ? "producto" : "productos"}`, descripcion: "Un número positivo sube el precio; uno negativo lo baja y muestra el precio anterior tachado como oferta.", etiqueta: "Porcentaje", placeholder: "Ej.: 10 o -15", modoTeclado: "decimal", maximo: 6, confirmar: "Continuar", validar: (v) => { const n = Number(v.replace(",", ".")); return !Number.isFinite(n) || n === 0 || n < -90 || n > 300 ? "Escribí un porcentaje entre -90 y 300 (distinto de 0)" : null; } });
    if (raw === null) return;
    const pct = Number(raw.replace(",", "."));
    if (!Number.isFinite(pct) || pct === 0 || pct < -90 || pct > 300) return toast.error("Ingresá un porcentaje entre -90 y 300");
    if (!(await confirmar({ titulo: `¿${pct > 0 ? "Subir" : "Bajar"} ${Math.abs(pct)}% el precio de ${ids.length} ${ids.length === 1 ? "producto" : "productos"}?`, descripcion: "El cambio queda en el historial de cada producto.", confirmar: "Aplicar" }))) return;
    await bulk(() => db.rpc("delivery_ajustar_precios", { p_comercio: storeId, p_ids: ids, p_pct: pct }), "Precios actualizados");
  };
  const bulkDelete = async () => {
    if (!(await confirmar({ titulo: `¿Eliminar ${ids.length} ${ids.length === 1 ? "producto" : "productos"}?`, descripcion: "No se puede deshacer. Si solo querés sacarlos de la venta, ocultalos.", confirmar: "Eliminar", peligro: true }))) return;
    await bulk(() => db.from("delivery_productos").delete().in("id", ids), "Productos eliminados");
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-full border bg-card px-4 transition-shadow focus-within:ring-2 focus-within:ring-ring/30"><Search className="h-4 w-4 text-muted-foreground" /><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar en tu menú" className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label="Buscar en tu menú" /></label>
        <Button variant="outline" className="rounded-full" onClick={addSection}><Plus className="h-4 w-4" />Sección</Button>
      </div>

      {products.length > 0 && (
        <div className="mt-3 flex items-center gap-2">
        <div className="scrollbar-none flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {([["todos", "Activos"], ["publicado", "Publicados"], ["borrador", "Borradores"], ["programado", "Programados"], ["oferta", "En oferta"], ["agotados", "Agotados o pausados"], ["stock_bajo", "Stock bajo"], ["sin_foto", "Sin foto"], ["archivado", "Archivados"]] as [Filter, string][])
            .map(([value, label]) => ({ value, label, n: contar(value) })).filter((c) => c.value === "todos" || c.value === filter || c.n > 0)
            .map(({ value, label, n }) => (
              <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold", filter === value ? "border-foreground bg-foreground text-background" : "bg-card", value === "stock_bajo" && filter !== value && "border-warning/60")}>{label} ({n})</button>
            ))}
        </div>
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
        <EmptyState className="mt-4" icon={<UtensilsCrossed className="h-7 w-7" />} title="Tu menú está vacío" text="Cargá tus productos con foto y precio, o importá una planilla para empezar más rápido." action={<Button className="rounded-full" onClick={() => navigate("/app/comercio/productos/nuevo")}><Plus className="h-4 w-4" />Cargar el primero</Button>} />
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
                        {product.disponible && sinStock(product) && <span className="rounded-full bg-destructive/10 px-1.5 text-[10px] font-bold text-destructive">agotado</span>}
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
                    <label className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground sm:flex">{!product.disponible ? "Pausado" : sinStock(product) ? "Sin stock" : "Disponible"}<Switch checked={product.disponible} onCheckedChange={() => toggle(product, "disponible")} /></label>
                    <Switch className="sm:hidden" checked={product.disponible} onCheckedChange={() => toggle(product, "disponible")} aria-label="Disponible" />
                    <span className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Editar ${product.nombre}`} title="Editar" onClick={() => navigate(`/app/comercio/productos/${product.id}`)}><Pencil className="h-4 w-4" /></Button>
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

      <ProductHistoryDialog storeId={storeId} product={historial} onClose={() => setHistorial(null)} />
    </div>
  );
}

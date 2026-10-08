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
import { db, DeliveryProduct, DeliverySection, errorMessage, img, money, orderSections, tagLabels } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Draft = { id?: string; nombre: string; descripcion: string; categoria: string; precio: string; precio_anterior: string; stock: string; imagen_url: string; imagenes: string[]; destacado: boolean; disponible: boolean; etiquetas: string[]; categoria_id: string; marca: string; atributos: AtributoFila[]; en_market: boolean; en_tienda: boolean };
const emptyDraft: Draft = { nombre: "", descripcion: "", categoria: "", precio: "", precio_anterior: "", stock: "", imagen_url: "", imagenes: [], destacado: false, disponible: true, etiquetas: [], categoria_id: "", marca: "", atributos: [], en_market: true, en_tienda: true };
type Filter = "todos" | "agotados" | "sin_foto";

const toDraft = (product: DeliveryProduct): Draft => ({
  id: product.id,
  nombre: product.nombre,
  descripcion: product.descripcion || "",
  categoria: product.categoria,
  precio: String(product.precio),
  precio_anterior: product.precio_anterior ? String(product.precio_anterior) : "",
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

  const loadConfig = useCallback(async () => {
    const { data } = await db.from("delivery_secciones").select("*").eq("comercio_id", storeId);
    setConfig(data || []);
  }, [storeId]);
  useEffect(() => { loadConfig(); }, [loadConfig]);

  const sections = useMemo(() => orderSections(products, config, false), [products, config]);
  const names = sections.map((section) => section.name);
  const needle = term.trim().toLowerCase();
  const matches = useCallback((product: DeliveryProduct) => (!needle || `${product.nombre} ${product.categoria}`.toLowerCase().includes(needle))
    && (filter === "todos" || (filter === "agotados" ? soldOut(product) : !product.imagen_url)), [needle, filter]);
  const visibleProducts = products.filter(matches);
  const counts = { agotados: products.filter(soldOut).length, sin_foto: products.filter((product) => !product.imagen_url).length };

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

  const duplicate = async (product: DeliveryProduct) => {
    const peers = products.filter((item) => item.categoria === product.categoria);
    const copy = {
      comercio_id: storeId, nombre: `${product.nombre} (copia)`.slice(0, 80), descripcion: product.descripcion ?? null, categoria: product.categoria, precio: product.precio,
      precio_anterior: product.precio_anterior ?? null, stock: product.stock ?? null, imagen_url: product.imagen_url ?? null, destacado: false, disponible: false,
      etiquetas: product.etiquetas || [], orden: Math.max(0, ...peers.map((item) => item.orden ?? 0)) + 1,
    };
    if (await run(() => db.from("delivery_productos").insert(copy), "Duplicado y pausado: revisalo y activalo cuando esté listo")) onChange();
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

  const exportCsv = () => {
    const csv = toCsv(["Sección", "Nombre", "Descripción", "Precio", "Stock", "Disponible", "Variante", "SKU"], products.flatMap((product) => (product.usa_variantes && product.variantes?.length
      ? [...product.variantes].sort((x, y) => x.orden - y.orden).map((v) => [product.categoria, product.nombre, product.descripcion ?? "", v.precio ?? product.precio, v.stock ?? "", product.disponible && v.disponible ? "si" : "no", v.nombre, v.sku ?? ""])
      : [[product.categoria, product.nombre, product.descripcion ?? "", product.precio, product.stock ?? "", product.disponible ? "si" : "no", "", ""]])));
    downloadCsv("menu-woref.csv", csv);
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
          {([["todos", `Todos (${products.length})`], ["agotados", `Agotados o pausados (${counts.agotados})`], ["sin_foto", `Sin foto (${counts.sin_foto})`]] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold", filter === value ? "border-foreground bg-foreground text-background" : "bg-card")}>{label}</button>
          ))}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-14 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2.5 shadow-pop" role="toolbar" aria-label="Acciones sobre la selección">
          <span className="px-2 text-sm font-extrabold">{selected.size} seleccionados</span>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => bulk(() => db.from("delivery_productos").update({ disponible: false }).in("id", ids), "Productos pausados")}><Pause className="h-4 w-4" />Pausar</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => bulk(() => db.from("delivery_productos").update({ disponible: true }).in("id", ids), "Productos activados")}><Play className="h-4 w-4" />Activar</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={bulkPrice}><Percent className="h-4 w-4" />Precio</Button>
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
                      <p className="flex items-center gap-1.5 truncate font-bold">{product.destacado && <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />}{product.nombre}{!product.imagen_url && <span className="rounded-full bg-warning/20 px-1.5 text-[10px] font-bold">sin foto</span>}</p>
                      <p className="flex flex-wrap items-center gap-x-1 text-sm">
                        <InlineNumber value={product.precio} label="Precio" format={(value) => money(value ?? 0)} onSave={async (value) => { await patchProduct(product, { precio: value as number }); }} />
                        {product.precio_anterior && <span className="text-xs text-muted-foreground line-through">{money(product.precio_anterior)}</span>}
                        <span className="text-xs text-muted-foreground">· Stock:</span>
                        <InlineNumber value={product.stock} label="Stock" allowEmpty format={(value) => (value == null ? "ilimitado" : String(value))} onSave={async (value) => { await patchProduct(product, { stock: value }); }} />
                      </p>
                    </div>
                    <label className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground sm:flex">{product.disponible ? "Disponible" : "Pausado"}<Switch checked={product.disponible} onCheckedChange={() => toggle(product, "disponible")} /></label>
                    <Switch className="sm:hidden" checked={product.disponible} onCheckedChange={() => toggle(product, "disponible")} aria-label="Disponible" />
                    <span className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Editar ${product.nombre}`} title="Editar" onClick={() => setDraft(toDraft(product))}><Pencil className="h-4 w-4" /></Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Más acciones de ${product.nombre}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => toggle(product, "destacado")}><Star className={product.destacado ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4"} />{product.destacado ? "Quitar de destacados" : "Destacar"}</DropdownMenuItem>
                          <DropdownMenuItem disabled={busy} onClick={() => duplicate(product)}><Copy className="h-4 w-4" />Duplicar</DropdownMenuItem>
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

      <ProductEditor storeId={storeId} draft={draft} categories={names} products={products} onClose={() => setDraft(null)} onSaved={(close) => { if (close) setDraft(null); onChange(); }} onOptionsChanged={onChange} />
      <MenuImportDialog open={importing} onOpenChange={setImporting} storeId={storeId} products={products} onDone={() => { onChange(); loadConfig(); }} />
    </div>
  );
}

function ProductEditor({ storeId, draft, categories, products, onClose, onSaved, onOptionsChanged }: { storeId: string; draft: Draft | null; categories: string[]; products: DeliveryProduct[]; onClose: () => void; onSaved: (close: boolean) => void; onOptionsChanged: () => void }) {
  const [values, setValues] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<Draft | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  if (draft !== openedFor) { setOpenedFor(draft); if (draft) setValues(draft); }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setValues((current) => ({ ...current, [key]: value }));
  const toggleTag = (tag: string) => set("etiquetas", values.etiquetas.includes(tag) ? values.etiquetas.filter((item) => item !== tag) : values.etiquetas.length >= 6 ? values.etiquetas : [...values.etiquetas, tag]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const precio = Number(values.precio);
    const anterior = values.precio_anterior ? Number(values.precio_anterior) : null;
    if (!values.nombre.trim() || !(precio > 0)) return toast.error("Completá nombre y precio");
    if (anterior !== null && anterior <= precio) return toast.error("El precio anterior tiene que ser mayor al precio actual (si no, no hay oferta)");
    const categoria = values.categoria.trim() || "Destacados";
    const payload = {
      comercio_id: storeId,
      nombre: values.nombre.trim(),
      descripcion: values.descripcion.trim() || null,
      categoria,
      precio,
      precio_anterior: anterior,
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
    };
    setSaving(true);
    if (values.id) {
      const { error } = await db.from("delivery_productos").update(payload).eq("id", values.id);
      setSaving(false);
      if (error) return toast.error(errorMessage(error));
      toast.success("Producto actualizado");
      onSaved(true);
      return;
    }
    const orden = Math.max(0, ...products.filter((product) => product.categoria === categoria).map((product) => product.orden ?? 0)) + 1;
    const { data, error } = await db.from("delivery_productos").insert({ ...payload, orden }).select("id").single();
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    // Queda abierto para poder sumarle opciones (tamaños, extras) al producto recién creado.
    setValues((current) => ({ ...current, id: data.id }));
    toast.success("Producto creado. Si querés, agregale opciones abajo.");
    onSaved(false);
  };

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle className="text-xl font-extrabold">{values.id ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-nombre">Nombre</Label><Input id="p-nombre" ref={nameInput} required maxLength={80} value={values.nombre} onChange={(event) => set("nombre", event.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-desc">Descripción</Label><Textarea id="p-desc" maxLength={300} value={values.descripcion} onChange={(event) => set("descripcion", event.target.value)} className="min-h-[64px]" /></div>
          <div className="space-y-1.5"><Label htmlFor="p-cat">Sección del menú</Label><Input id="p-cat" list="menu-sections" maxLength={40} value={values.categoria} onChange={(event) => set("categoria", event.target.value)} /><datalist id="menu-sections">{categories.map((item) => <option key={item} value={item} />)}</datalist></div>
          <div className="space-y-1.5"><Label htmlFor="p-stock">Stock (vacío = ilimitado)</Label><Input id="p-stock" type="number" min={0} value={values.stock} onChange={(event) => set("stock", event.target.value)} /> {values.id && <div className="pt-1"><StockHistoryButton storeId={storeId} productId={values.id} /></div>}</div>
          <div className="space-y-1.5"><Label htmlFor="p-precio">Precio ($)</Label><Input id="p-precio" type="number" min={1} required value={values.precio} onChange={(event) => set("precio", event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="p-antes">Precio anterior (para mostrar oferta)</Label><Input id="p-antes" type="number" min={0} value={values.precio_anterior} onChange={(event) => set("precio_anterior", event.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Etiquetas</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(tagLabels).map(([tag, label]) => <button key={tag} type="button" aria-pressed={values.etiquetas.includes(tag)} onClick={() => toggleTag(tag)} className={cn("rounded-full border px-3 py-1 text-xs font-bold", values.etiquetas.includes(tag) ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted")}>{label}</button>)}
            </div>
          </div>
          <MarketFields values={values} onChange={(next) => setValues((current) => ({ ...current, ...next }))} />
          <ImageUpload label="Foto principal" folder="productos" shape="square" value={values.imagen_url} onChange={(url) => set("imagen_url", url)} className="sm:col-span-2" />
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-semibold">Más fotos <span className="font-normal text-muted-foreground">(opcional, hasta 5: se ven en la galería de la ficha del producto)</span></p>
            {values.imagenes.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {values.imagenes.map((url, index) => (
                  <li key={`${url}-${index}`} className="relative">
                    <img src={img(url, 160)} alt={`Foto extra ${index + 1}`} className="h-16 w-16 rounded-xl border object-cover" />
                    <button type="button" aria-label={`Quitar foto extra ${index + 1}`} onClick={() => set("imagenes", values.imagenes.filter((_, i) => i !== index))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-white shadow">×</button>
                  </li>
                ))}
              </ul>
            )}
            {values.imagenes.length < 5 && <ImageUpload label={`Agregar foto (${values.imagenes.length}/5)`} folder="productos" shape="square" value="" onChange={(url) => set("imagenes", [...values.imagenes, url])} />}
          </div>
          <div className="flex flex-col justify-center gap-3 sm:col-span-2 sm:flex-row sm:justify-start sm:gap-6">
            <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={values.disponible} onCheckedChange={(checked) => set("disponible", checked)} />Disponible</label>
            <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={values.destacado} onCheckedChange={(checked) => set("destacado", checked)} />Destacado</label>
          </div>
          <Button type="submit" className="rounded-full sm:col-span-2" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{values.id ? "Guardar" : "Crear producto"}</Button>
        </form>
        <div className="border-t pt-4">
          <h3 className="font-extrabold">Variantes</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Talle, color o sabor, cada una con su stock, SKU y precio.</p>
          {values.id
            ? <VariantsEditor productId={values.id} onChange={onOptionsChanged} />
            : <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">Creá el producto primero y después agregale variantes acá mismo.</p>}
        </div>
        <div className="border-t pt-4">
          <h3 className="font-extrabold">Opciones del producto</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">Tamaños, punto de la carne, sabores, extras con precio…</p>
          {values.id
            ? <OptionGroupsEditor productId={values.id} onChange={onOptionsChanged} />
            : <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">Creá el producto primero y después agregale opciones acá mismo.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

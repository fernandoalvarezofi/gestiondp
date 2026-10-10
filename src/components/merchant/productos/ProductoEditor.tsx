import { DragEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArrowLeft, ChevronLeft, ChevronRight, Copy, ExternalLink, History, ImagePlus, Loader2, MoreHorizontal, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { MarketFields } from "@/components/merchant/MarketFields";
import { OptionGroupsEditor } from "@/components/merchant/OptionGroupsEditor";
import { ProductHistoryDialog } from "@/components/merchant/ProductHistory";
import { StockHistoryButton } from "@/components/merchant/StockHistory";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/components/ui/dialogos";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAvisoSalida } from "@/hooks/useAvisoSalida";
import { db, errorMessage, ESTADO_PRODUCTO, EstadoProducto, img, margen, money, orderSections, tagLabels, TIPO_PRODUCTO, TipoProducto } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Coleccion, duplicarProducto, fetchColecciones, guardarProductosColeccion, isoADateTimeLocal, localDateTimeAIso, programarOferta, slugify } from "@/services/catalogPro";
import { useMerchant } from "@/pages/delivery/merchant/context";
import { RichText } from "@/components/storefront/RichText";
import { Borrador, BORRADOR_VACIO, borradorDe, erroresDe, filaDe, promoNumero } from "./borrador";
import { VariantesPanel } from "./VariantesPanel";

const BASE = "/app/comercio/productos";
const MAX_FOTOS = 6;

function Tarjeta({ titulo, accion, children, id, className }: { titulo?: ReactNode; accion?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section id={id} className={cn("rounded-xl border bg-card p-4 sm:p-5", className)}>
      {(titulo || accion) && <div className="mb-4 flex items-center justify-between gap-2">{titulo && <h2 className="text-[15px] font-extrabold">{titulo}</h2>}{accion}</div>}
      {children}
    </section>
  );
}
function Campo({ id, label, error, ayuda, children, className }: { id?: string; label: ReactNode; error?: string; ayuda?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
      {children}
      {error ? <p className="text-xs font-semibold text-destructive" role="alert">{error}</p> : ayuda ? <p className="text-xs text-muted-foreground">{ayuda}</p> : null}
    </div>
  );
}

/**
 * Editor de producto a página completa (/app/comercio/productos/:id o /nuevo), con el orden de trabajo de Shopify: a la izquierda
 * lo que define el producto (información, fotos, precio, inventario, variantes, opciones, buscadores); a la derecha cómo se vende
 * (estado, canales, organización). Barra de guardado cuando hay cambios, Ctrl+S guarda y los errores se muestran en cada campo.
 */
export default function ProductoEditor() {
  const { id } = useParams<{ id: string }>();
  const nuevo = !id || id === "nuevo";
  const navigate = useNavigate();
  const { store, products, loadProducts, access } = useMerchant();
  const producto = useMemo(() => (nuevo ? null : products.find((p) => p.id === id) ?? null), [products, id, nuevo]);
  const [colecciones, setColecciones] = useState<(Coleccion & { productos: string[] })[]>([]);
  const [valores, setValores] = useState<Borrador>(BORRADOR_VACIO);
  const [guardado, setGuardado] = useState<Borrador>(BORRADOR_VACIO);
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [intentado, setIntentado] = useState(false);
  const [historial, setHistorial] = useState(false);
  const [vistaDesc, setVistaDesc] = useState(false);
  const [buscaRel, setBuscaRel] = useState("");
  const [seo, setSeo] = useState(false);
  const [ventas, setVentas] = useState<{ unidades: number; ingresos: number } | null>(null);
  const cargadoPara = useRef<string | null>(null);

  useEffect(() => { fetchColecciones(store.id).then(setColecciones).catch(() => setColecciones([])); }, [store.id]);
  // Al abrir (o cambiar de producto) se toma el estado guardado. Si el producto todavía no llegó del contexto, se espera.
  useEffect(() => {
    const clave = nuevo ? "nuevo" : id ?? "";
    if (cargadoPara.current === clave) return;
    if (!nuevo && !producto) return;
    const b = producto ? borradorDe(producto, colecciones.filter((c) => c.productos.includes(producto.id)).map((c) => c.id)) : { ...BORRADOR_VACIO, categoria: orderSections(products, [], false)[0]?.name ?? "" };
    setValores(b); setGuardado(b); setIntentado(false); setListo(true); cargadoPara.current = clave;
  }, [id, nuevo, producto, colecciones, products]);
  // Las colecciones llegan después que el producto: se suman sin marcar cambios.
  useEffect(() => {
    if (!producto || !listo) return;
    const cols = colecciones.filter((c) => c.productos.includes(producto.id)).map((c) => c.id);
    setGuardado((g) => (JSON.stringify(g.colecciones) === JSON.stringify(cols) ? g : { ...g, colecciones: cols }));
    setValores((v) => (v.colecciones.length || !cols.length ? v : { ...v, colecciones: cols }));
  }, [colecciones, producto, listo]);
  useEffect(() => {
    if (nuevo || !id) return;
    db.rpc("catalogo_ventas", { p_comercio: store.id, p_dias: 30 }).then(({ data }: { data: { producto_id: string; unidades: number; ingresos: number }[] | null }) => {
      const fila = (data ?? []).find((x) => x.producto_id === id);
      setVentas({ unidades: Number(fila?.unidades ?? 0), ingresos: Number(fila?.ingresos ?? 0) });
    }, () => undefined);
  }, [id, nuevo, store.id]);

  const sinGuardar = listo && JSON.stringify(valores) !== JSON.stringify(guardado);
  useAvisoSalida(sinGuardar);
  const errores = erroresDe(valores);
  const err = (k: keyof Borrador) => (intentado ? errores[k] : undefined);
  const set = <K extends keyof Borrador>(k: K, v: Borrador[K]) => setValores((c) => ({ ...c, [k]: v }));
  const toggleEn = (k: "etiquetas" | "colecciones" | "relacionados", x: string, max: number) => setValores((c) => ({ ...c, [k]: c[k].includes(x) ? c[k].filter((y) => y !== x) : c[k].length >= max ? c[k] : [...c[k], x] }));

  const secciones = useMemo(() => orderSections(products, [], false).map((s) => s.name), [products]);
  const lista = useMemo(() => products.filter((p) => (p.estado ?? "publicado") !== "archivado").sort((a, b) => a.nombre.localeCompare(b.nombre, "es")), [products]);
  const pos = producto ? lista.findIndex((p) => p.id === producto.id) : -1;
  const anterior = pos > 0 ? lista[pos - 1] : null, siguiente = pos >= 0 && pos < lista.length - 1 ? lista[pos + 1] : null;

  const ir = async (destino: string) => {
    if (sinGuardar && !(await confirmar({ titulo: "¿Salir sin guardar?", descripcion: "Los cambios de este producto se pierden.", confirmar: "Salir sin guardar", cancelar: "Seguir editando", peligro: true }))) return;
    navigate(destino);
  };

  const guardar = useCallback(async () => {
    setIntentado(true);
    const e = erroresDe(valores);
    if (Object.keys(e).length) {
      toast.error("Revisá los campos marcados");
      document.querySelector('[role="alert"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setGuardando(true);
    const fila = filaDe(valores, store.id);
    let pid = valores.id;
    if (pid) {
      const { error } = await db.from("delivery_productos").update(fila).eq("id", pid);
      if (error) { setGuardando(false); return toast.error(errorMessage(error)); }
    } else {
      const orden = Math.max(0, ...products.filter((p) => p.categoria === fila.categoria).map((p) => p.orden ?? 0)) + 1;
      const { data, error } = await db.from("delivery_productos").insert({ ...fila, orden }).select("id").single();
      if (error) { setGuardando(false); return toast.error(errorMessage(error)); }
      pid = data.id as string;
    }
    try {
      // Oferta programada: solo si cambió (la valida y aplica el servidor).
      const antes = producto ? `${producto.precio_promo ?? ""}|${isoADateTimeLocal(producto.promo_desde)}|${isoADateTimeLocal(producto.promo_hasta)}` : "||";
      const promo = promoNumero(valores);
      const ahora = `${promo ?? ""}|${promo === null ? "" : valores.promo_desde}|${promo === null ? "" : valores.promo_hasta}`;
      if (antes !== ahora) await programarOferta(pid!, promo, localDateTimeAIso(valores.promo_desde), localDateTimeAIso(valores.promo_hasta));
      for (const c of colecciones) {
        const tiene = c.productos.includes(pid!), quiere = valores.colecciones.includes(c.id);
        if (tiene !== quiere) await guardarProductosColeccion(c.id, quiere ? [...c.productos, pid!] : c.productos.filter((x) => x !== pid));
      }
    } catch (error) { toast.error(errorMessage(error)); }
    await loadProducts();
    fetchColecciones(store.id).then(setColecciones).catch(() => undefined);
    setGuardando(false);
    const actualizado = { ...valores, id: pid };
    setGuardado(actualizado); setValores(actualizado); setIntentado(false);
    if (!valores.id) { cargadoPara.current = pid!; toast.success("Producto creado. Ahora podés sumarle variantes y opciones."); navigate(`${BASE}/${pid}`, { replace: true }); }
    else toast.success("Cambios guardados");
  }, [valores, store.id, products, producto, colecciones, loadProducts, navigate]);

  // Ctrl+S guarda.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (!guardando) void guardar(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [guardar, guardando]);

  const duplicar = async () => {
    if (!producto) return;
    try { const nid = await duplicarProducto(producto.id); await loadProducts(); toast.success("Duplicado como borrador"); navigate(`${BASE}/${nid}`); } catch (error) { toast.error(errorMessage(error)); }
  };
  const archivar = async () => {
    if (!producto) return;
    const archivado = (producto.estado ?? "publicado") === "archivado";
    const { error } = await db.from("delivery_productos").update({ estado: archivado ? "borrador" : "archivado" }).eq("id", producto.id);
    if (error) return toast.error(errorMessage(error));
    await loadProducts(); cargadoPara.current = null; toast.success(archivado ? "Sacado del archivo (queda en borrador)" : "Producto archivado");
  };
  const eliminar = async () => {
    if (!producto || !(await confirmar({ titulo: `¿Eliminar “${producto.nombre}”?`, descripcion: "Desaparece del catálogo y de la tienda. Los pedidos anteriores no cambian. Si solo querés sacarlo de la venta, archivalo.", confirmar: "Eliminar", peligro: true }))) return;
    const { error } = await db.from("delivery_productos").delete().eq("id", producto.id);
    if (error) return toast.error(errorMessage(error));
    await loadProducts(); setGuardado(valores); toast.success("Producto eliminado"); navigate(BASE);
  };

  // ---- fotos: la primera es la principal; se ordenan arrastrando
  const fotos = [valores.imagen_url, ...valores.imagenes].filter(Boolean);
  const setFotos = (l: string[]) => setValores((c) => ({ ...c, imagen_url: l[0] ?? "", imagenes: l.slice(1, MAX_FOTOS) }));
  const [arrastrada, setArrastrada] = useState<number | null>(null);
  const soltar = (e: DragEvent, destino: number) => {
    e.preventDefault();
    if (arrastrada === null || arrastrada === destino) return;
    const l = [...fotos]; const [m] = l.splice(arrastrada, 1); l.splice(destino, 0, m); setFotos(l); setArrastrada(null);
  };

  if (!listo) {
    if (!nuevo && products.length && !producto) return (
      <div className="mx-auto max-w-md space-y-3 rounded-xl border bg-card p-8 text-center">
        <p className="font-extrabold">No encontramos este producto</p><p className="text-sm text-muted-foreground">Puede que se haya eliminado.</p>
        <Button asChild className="rounded-full"><Link to={BASE}>Volver a productos</Link></Button>
      </div>
    );
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const precioNum = Number(valores.precio.replace(",", ".")), costoNum = valores.costo.trim() === "" ? null : Number(valores.costo.replace(",", "."));
  const mg = margen(precioNum, costoNum);
  const usaVariantes = Boolean(producto?.usa_variantes);
  const estado = valores.estado;
  const enTienda = producto && producto.estado === "publicado" && producto.en_tienda !== false ? `/t/${store.slug}/p/${producto.slug || producto.id}` : null;
  const candidatosRel = products.filter((p) => p.id !== valores.id && !valores.relacionados.includes(p.id) && (p.estado ?? "publicado") !== "archivado" && p.nombre.toLowerCase().includes(buscaRel.trim().toLowerCase())).slice(0, 20);
  const avisos = [
    fotos.length === 0 && "Sin fotos: los productos con foto se venden mucho más.",
    valores.descripcion.trim().length < 20 && "La descripción corta es muy breve.",
    costoNum != null && precioNum > 0 && costoNum >= precioNum && "El costo es igual o mayor al precio: estás vendiendo sin ganancia.",
  ].filter(Boolean) as string[];

  return (
    <div className="mx-auto max-w-6xl pb-24">
      {/* Encabezado */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Volver a productos" onClick={() => void ir(BASE)}><ArrowLeft className="h-5 w-5" /></Button>
        <h1 className="min-w-0 flex-1 truncate text-xl font-extrabold">{nuevo ? "Nuevo producto" : valores.nombre || "Producto"}</h1>
        {!nuevo && <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_PRODUCTO[producto?.estado ?? "publicado"].clase)}>{ESTADO_PRODUCTO[producto?.estado ?? "publicado"].texto}</span>}
        {!nuevo && (
          <div className="flex items-center gap-1">
            {enTienda && <Button asChild variant="outline" size="sm"><a href={enTienda} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Ver en la tienda</a></Button>}
            <Button variant="outline" size="sm" onClick={duplicar}><Copy className="h-4 w-4" />Duplicar</Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="h-9 w-9" aria-label="Más acciones"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => setHistorial(true)}><History className="mr-2 h-4 w-4" />Historial de cambios</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void archivar()}><Archive className="mr-2 h-4 w-4" />{(producto?.estado ?? "publicado") === "archivado" ? "Sacar del archivo" : "Archivar"}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void eliminar()} className="text-destructive focus:text-destructive"><Trash2 className="mr-2 h-4 w-4" />Eliminar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="ml-1 hidden sm:flex">
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Producto anterior" disabled={!anterior} onClick={() => anterior && void ir(`${BASE}/${anterior.id}`)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Producto siguiente" disabled={!siguiente} onClick={() => siguiente && void ir(`${BASE}/${siguiente.id}`)}><ChevronRight className="h-4 w-4" /></Button>
            </span>
          </div>
        )}
      </div>

      {avisos.length > 0 && <ul className="mb-4 space-y-0.5 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm">{avisos.map((a) => <li key={a}>• {a}</li>)}</ul>}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-5">
          <Tarjeta>
            <div className="space-y-4">
              <Campo id="p-nombre" label="Nombre" error={err("nombre")}><Input id="p-nombre" maxLength={80} value={valores.nombre} onChange={(e) => set("nombre", e.target.value)} placeholder="Ej.: Remera de algodón oversize" aria-invalid={Boolean(err("nombre"))} /></Campo>
              <Campo id="p-desc" label="Descripción corta" ayuda={`${valores.descripcion.length}/300 · Se ve en las tarjetas y en Google si no cargás una descripción para buscadores.`}><Textarea id="p-desc" maxLength={300} value={valores.descripcion} onChange={(e) => set("descripcion", e.target.value)} className="min-h-[70px]" /></Campo>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label htmlFor="p-larga" className="text-sm font-semibold">Descripción completa</Label>
                  <div className="flex rounded-md border p-0.5 text-xs font-bold" role="group" aria-label="Modo de la descripción">{([[false, "Escribir"], [true, "Vista previa"]] as const).map(([v, t]) => <button key={t} type="button" aria-pressed={vistaDesc === v} onClick={() => setVistaDesc(v)} className={cn("rounded px-2 py-0.5", vistaDesc === v ? "bg-muted" : "text-muted-foreground")}>{t}</button>)}</div>
                </div>
                {vistaDesc ? <div className="min-h-[160px] rounded-md border p-3"><RichText texto={valores.descripcion_larga || "Sin descripción."} className="text-sm" /></div>
                  : <Textarea id="p-larga" maxLength={8000} value={valores.descripcion_larga} onChange={(e) => set("descripcion_larga", e.target.value)} className="min-h-[160px] font-mono text-[13px]" placeholder={"Materiales, medidas, cuidados…\n\n## Características\n- Algodón 100%\n- Hecho en Argentina"} />}
                <p className="text-xs text-muted-foreground">Admite **negrita**, *cursiva*, subtítulos con “## ”, listas con “- ” y enlaces [texto](https://…).</p>
              </div>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Fotos" accion={<span className="text-xs text-muted-foreground">{fotos.length}/{MAX_FOTOS} · arrastrá para ordenar; la primera es la principal</span>}>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {fotos.map((url, i) => (
                <div key={`${url}-${i}`} draggable onDragStart={() => setArrastrada(i)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => soltar(e, i)}
                  className={cn("group relative aspect-square cursor-grab overflow-hidden rounded-lg border bg-muted", i === 0 && "col-span-2 row-span-2", arrastrada === i && "opacity-50")}>
                  <img src={img(url, i === 0 ? 480 : 200)} alt={i === 0 ? "Foto principal" : `Foto ${i + 1}`} className="h-full w-full object-cover" />
                  {i === 0 && <span className="absolute left-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">Principal</span>}
                  <span className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                    {i > 0 && <button type="button" title="Usar como principal" aria-label={`Usar la foto ${i + 1} como principal`} onClick={() => { const l = [...fotos]; const [m] = l.splice(i, 1); setFotos([m, ...l]); }} className="rounded bg-black/70 p-1 text-white"><Star className="h-3.5 w-3.5" /></button>}
                    <button type="button" title="Quitar" aria-label={`Quitar la foto ${i + 1}`} onClick={() => setFotos(fotos.filter((_, j) => j !== i))} className="rounded bg-black/70 p-1 text-white"><X className="h-3.5 w-3.5" /></button>
                  </span>
                </div>
              ))}
              {fotos.length < MAX_FOTOS && (
                <div className={cn(fotos.length === 0 && "col-span-2 row-span-2")}>
                  <ImageUpload label={fotos.length ? "Agregar" : "Subir foto"} folder="productos" shape="square" value="" onChange={(url) => url && setFotos([...fotos, url])} />
                </div>
              )}
            </div>
            {fotos.length === 0 && <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><ImagePlus className="h-4 w-4" />Fondo claro, buena luz y el producto completo. Hasta {MAX_FOTOS} fotos.</p>}
          </Tarjeta>

          <Tarjeta titulo="Precio">
            <div className="grid gap-4 sm:grid-cols-3">
              <Campo id="p-precio" label={valores.promo_activa ? "Precio regular" : "Precio"} error={err("precio")}><Input id="p-precio" inputMode="decimal" value={valores.precio} onChange={(e) => set("precio", e.target.value)} placeholder="0" aria-invalid={Boolean(err("precio"))} /></Campo>
              <Campo id="p-antes" label="Precio de comparación" error={err("precio_anterior")} ayuda={valores.promo_activa ? "Con la oferta activa, se muestra solo." : "Se muestra tachado."}><Input id="p-antes" inputMode="decimal" disabled={valores.promo_activa} value={valores.precio_anterior} onChange={(e) => set("precio_anterior", e.target.value)} placeholder="—" /></Campo>
              <Campo id="p-costo" label="Costo por unidad" error={err("costo")} ayuda="Solo lo ves vos."><Input id="p-costo" inputMode="decimal" value={valores.costo} onChange={(e) => set("costo", e.target.value)} placeholder="—" /></Campo>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border text-sm sm:grid-cols-3">
              <div className="bg-card p-3"><dt className="text-xs text-muted-foreground">Margen</dt><dd className={cn("font-extrabold", mg != null && mg < 0 && "text-destructive")}>{mg == null ? "—" : `${mg}%`}</dd></div>
              <div className="bg-card p-3"><dt className="text-xs text-muted-foreground">Ganancia por unidad</dt><dd className="font-extrabold">{costoNum == null || !(precioNum > 0) ? "—" : money(precioNum - costoNum)}</dd></div>
              <div className="col-span-2 bg-card p-3 sm:col-span-1"><dt className="text-xs text-muted-foreground">Ventas (30 días)</dt><dd className="font-extrabold">{nuevo ? "—" : ventas ? `${ventas.unidades} u · ${money(ventas.ingresos)}` : "…"}</dd></div>
            </dl>
            <details className="mt-4 rounded-lg border p-3" open={Boolean(valores.promo_precio) || undefined}>
              <summary className="cursor-pointer text-sm font-bold">Oferta programada {valores.promo_activa ? <span className="ml-1 rounded bg-brand-yellow/25 px-1.5 text-xs">activa ahora</span> : valores.promo_precio ? <span className="ml-1 rounded bg-muted px-1.5 text-xs">programada</span> : null}</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Campo id="p-promo" label="Precio de oferta" error={err("promo_precio")}><Input id="p-promo" inputMode="decimal" value={valores.promo_precio} onChange={(e) => set("promo_precio", e.target.value)} placeholder="Sin oferta" /></Campo>
                <Campo id="p-pdesde" label="Desde" ayuda="Vacío: ahora"><Input id="p-pdesde" type="datetime-local" value={valores.promo_desde} onChange={(e) => set("promo_desde", e.target.value)} /></Campo>
                <Campo id="p-phasta" label="Hasta" error={err("promo_hasta")} ayuda="Vacío: hasta que la quites"><Input id="p-phasta" type="datetime-local" value={valores.promo_hasta} onChange={(e) => set("promo_hasta", e.target.value)} /></Campo>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Empieza y termina sola: mientras dura, la tienda muestra el precio regular tachado y el carrito cobra el de oferta. Las variantes con precio propio mantienen el suyo.</p>
            </details>
          </Tarjeta>

          <Tarjeta titulo="Inventario" accion={valores.id && !usaVariantes ? <StockHistoryButton storeId={store.id} productId={valores.id} /> : undefined}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="p-sku" label="SKU (código interno)"><Input id="p-sku" maxLength={40} value={valores.sku} onChange={(e) => set("sku", e.target.value)} placeholder="REM-001" /></Campo>
              <Campo id="p-ean" label="Código de barras" error={err("codigo_barras")}><Input id="p-ean" maxLength={32} value={valores.codigo_barras} onChange={(e) => set("codigo_barras", e.target.value)} placeholder="7790000000000" /></Campo>
            </div>
            {usaVariantes ? <p className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">El stock se maneja por variante (más abajo).</p> : (
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2.5 text-sm font-semibold"><Switch checked={valores.controla_stock} onCheckedChange={(v) => set("controla_stock", v)} />Controlar stock</label>
                {valores.controla_stock ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Campo id="p-stock" label="Unidades disponibles" error={err("stock")} ayuda="Se descuenta con cada venta y vuelve si se cancela."><Input id="p-stock" inputMode="numeric" value={valores.stock} onChange={(e) => set("stock", e.target.value.replace(/\D/g, ""))} placeholder="0" /></Campo>
                    <Campo id="p-min" label="Avisarme con" error={err("stock_minimo")} ayuda="Alerta de stock bajo en el inicio y en Inventario."><Input id="p-min" inputMode="numeric" value={valores.stock_minimo} onChange={(e) => set("stock_minimo", e.target.value.replace(/\D/g, ""))} placeholder="Sin alerta" /></Campo>
                  </div>
                ) : <p className="text-sm text-muted-foreground">Sin control: siempre se puede comprar mientras esté disponible.</p>}
              </div>
            )}
          </Tarjeta>

          <Tarjeta titulo="Variantes">
            {valores.id ? <VariantesPanel storeId={store.id} productId={valores.id} precioBase={precioNum || 0} ejesGuardados={producto?.variantes_ejes ?? []} onChange={() => { void loadProducts(); }} />
              : <p className="text-sm text-muted-foreground">Guardá el producto y después definí sus opciones (talle, color…) para generar las variantes.</p>}
          </Tarjeta>

          <Tarjeta titulo="Opciones y extras" accion={<span className="text-xs text-muted-foreground">Para comidas: tamaño, agregados, sabores</span>}>
            {valores.id ? <OptionGroupsEditor productId={valores.id} onChange={() => { void loadProducts(); }} /> : <p className="text-sm text-muted-foreground">Guardá el producto para agregarle opciones con precio extra.</p>}
          </Tarjeta>

          <Tarjeta titulo="Buscadores (SEO)" accion={<Button type="button" variant="ghost" size="sm" onClick={() => setSeo(!seo)}>{seo ? "Listo" : "Editar"}</Button>}>
            <div className="rounded-lg bg-muted/60 p-3 text-sm" aria-label="Vista previa en Google">
              <p className="truncate text-xs text-muted-foreground">{window.location.host} › t › {store.slug} › p › {valores.slug || slugify(valores.nombre, 80) || "producto"}</p>
              <p className="truncate font-semibold text-sky-700 dark:text-sky-400">{valores.seo_titulo || valores.nombre || "Nombre del producto"} · {store.nombre}</p>
              <p className="line-clamp-2 text-xs text-muted-foreground">{valores.seo_descripcion || valores.descripcion || "Agregá una descripción para que se vea bien en Google y al compartir."}</p>
            </div>
            {seo && (
              <div className="mt-4 space-y-4">
                <Campo id="p-slug" label="Dirección del producto" error={err("slug")}><Input id="p-slug" maxLength={80} value={valores.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder={slugify(valores.nombre, 80)} /></Campo>
                <Campo id="p-seot" label={`Título para Google (${valores.seo_titulo.length}/70)`}><Input id="p-seot" maxLength={70} value={valores.seo_titulo} onChange={(e) => set("seo_titulo", e.target.value)} placeholder={valores.nombre} /></Campo>
                <Campo id="p-seod" label={`Descripción para Google (${valores.seo_descripcion.length}/170)`}><Textarea id="p-seod" maxLength={170} value={valores.seo_descripcion} onChange={(e) => set("seo_descripcion", e.target.value)} className="min-h-[60px]" placeholder={valores.descripcion} /></Campo>
              </div>
            )}
          </Tarjeta>
        </div>

        {/* Lateral */}
        <div className="space-y-5 lg:sticky lg:top-20">
          <Tarjeta titulo="Estado">
            <div className="space-y-3">
              <select aria-label="Estado del producto" value={estado} onChange={(e) => set("estado", e.target.value as EstadoProducto)} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-semibold">
                {(Object.keys(ESTADO_PRODUCTO) as EstadoProducto[]).map((t) => <option key={t} value={t}>{ESTADO_PRODUCTO[t].texto}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">{estado === "publicado" ? "Se ve y se puede comprar." : estado === "borrador" ? "Solo lo ves vos. Publicalo cuando esté listo." : estado === "programado" ? "Se publica solo en la fecha elegida." : "Fuera del catálogo; queda en el historial."}</p>
              {estado === "programado" && <Campo id="p-pub" label="Se publica el" error={err("publicar_desde")}><Input id="p-pub" type="datetime-local" value={valores.publicar_desde} onChange={(e) => set("publicar_desde", e.target.value)} /></Campo>}
              <label className="flex items-center justify-between gap-2 border-t pt-3 text-sm font-semibold">Disponible para comprar<Switch checked={valores.disponible} onCheckedChange={(v) => set("disponible", v)} /></label>
              <label className="flex items-center justify-between gap-2 text-sm font-semibold">Destacado<Switch checked={valores.destacado} onCheckedChange={(v) => set("destacado", v)} /></label>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Canales de venta">
            <div className="space-y-2.5">
              <label className="flex items-center justify-between gap-2 text-sm font-semibold">Mi tienda online<Switch checked={valores.en_tienda} onCheckedChange={(v) => set("en_tienda", v)} /></label>
              <label className="flex items-center justify-between gap-2 text-sm font-semibold">Marketplace de Woref<Switch checked={valores.en_market} onCheckedChange={(v) => set("en_market", v)} /></label>
              {err("en_tienda") && <p className="text-xs font-semibold text-destructive" role="alert">{err("en_tienda")}</p>}
            </div>
          </Tarjeta>

          <Tarjeta titulo="Organización">
            <div className="space-y-4">
              <Campo id="p-tipo" label="Tipo">
                <select id="p-tipo" value={valores.tipo} onChange={(e) => set("tipo", e.target.value as TipoProducto)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{(Object.keys(TIPO_PRODUCTO) as TipoProducto[]).map((t) => <option key={t} value={t}>{TIPO_PRODUCTO[t]}</option>)}</select>
              </Campo>
              <Campo id="p-cat" label="Sección del catálogo" ayuda="Agrupa los productos en la tienda y en el menú."><Input id="p-cat" list="p-secciones" maxLength={40} value={valores.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ej.: Remeras" /><datalist id="p-secciones">{secciones.map((s) => <option key={s} value={s} />)}</datalist></Campo>
              {colecciones.length > 0 && (
                <Campo label="Colecciones">
                  <div className="flex flex-wrap gap-1.5">{colecciones.map((c) => <button key={c.id} type="button" aria-pressed={valores.colecciones.includes(c.id)} onClick={() => toggleEn("colecciones", c.id, 50)} className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", valores.colecciones.includes(c.id) ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>{c.nombre}</button>)}</div>
                </Campo>
              )}
              <Campo label="Etiquetas">
                <div className="flex flex-wrap gap-1.5">{Object.entries(tagLabels).map(([t, l]) => <button key={t} type="button" aria-pressed={valores.etiquetas.includes(t)} onClick={() => toggleEn("etiquetas", t, 6)} className={cn("rounded-md border px-2.5 py-1 text-xs font-semibold", valores.etiquetas.includes(t) ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>{l}</button>)}</div>
              </Campo>
            </div>
          </Tarjeta>

          <MarketFields sinCanales values={valores} onChange={(next) => setValores((c) => ({ ...c, ...next }))} />

          <Tarjeta titulo={`Relacionados (${valores.relacionados.length}/12)`}>
            {valores.relacionados.length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {valores.relacionados.map((rid) => { const p = products.find((x) => x.id === rid); return p ? (
                  <li key={rid} className="flex items-center gap-2 text-sm"><img src={img(p.imagen_url, 80)} alt="" className="h-8 w-8 rounded object-cover" /><span className="min-w-0 flex-1 truncate">{p.nombre}</span><button type="button" aria-label={`Quitar ${p.nombre}`} onClick={() => toggleEn("relacionados", rid, 12)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button></li>
                ) : null; })}
              </ul>
            )}
            <Input value={buscaRel} onChange={(e) => setBuscaRel(e.target.value)} placeholder="Buscar para sumar" aria-label="Buscar productos relacionados" />
            {buscaRel.trim() && <ul className="mt-1.5 max-h-48 divide-y overflow-y-auto rounded-md border">{candidatosRel.map((p) => <li key={p.id}><button type="button" onClick={() => { toggleEn("relacionados", p.id, 12); setBuscaRel(""); }} className="flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-muted"><img src={img(p.imagen_url, 80)} alt="" className="h-7 w-7 rounded object-cover" />{p.nombre}</button></li>)}{candidatosRel.length === 0 && <li className="p-2 text-xs text-muted-foreground">Sin resultados</li>}</ul>}
            <p className="mt-2 text-xs text-muted-foreground">Se muestran primero en “Más productos” de la ficha.</p>
          </Tarjeta>
        </div>
      </div>

      {/* Barra de guardado */}
      {(sinGuardar || nuevo) && (
        <div className="sticky bottom-[72px] z-30 mt-6 rounded-xl bg-foreground text-background shadow-pop md:bottom-4" role="region" aria-label="Guardar cambios">
          <div className="flex items-center gap-3 px-4 py-3">
            <p className="min-w-0 flex-1 truncate text-sm font-semibold">{nuevo ? "Producto nuevo sin guardar" : "Cambios sin guardar"}{intentado && Object.keys(errores).length > 0 && <span className="ml-2 text-destructive-foreground/80">· {Object.keys(errores).length} {Object.keys(errores).length === 1 ? "campo para revisar" : "campos para revisar"}</span>}</p>
            <Button type="button" variant="ghost" className="text-background hover:bg-background/10 hover:text-background" disabled={guardando} onClick={() => (nuevo ? void ir(BASE) : setValores(guardado))}>{nuevo ? "Cancelar" : "Descartar"}</Button>
            <Button type="button" className="bg-none bg-background font-bold text-foreground hover:bg-background/90" disabled={guardando} onClick={() => void guardar()}>{guardando && <Loader2 className="h-4 w-4 animate-spin" />}{nuevo ? "Crear producto" : "Guardar"}</Button>
          </div>
        </div>
      )}
      {producto && historial && <ProductHistoryDialog storeId={store.id} product={producto} onClose={() => setHistorial(false)} />}
      {!access.permisos.includes("catalogo") && <p className="mt-4 text-sm text-destructive">No tenés permiso para editar productos.</p>}
    </div>
  );
}

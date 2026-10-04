import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Cross, ExternalLink, Loader2, Pencil, Plus, ShoppingBasket, Store as StoreIcon, Trash2, Utensils, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { AddressSearch } from "@/components/maps/AddressSearch";
import { MapPicker } from "@/components/maps/LazyMaps";
import { ClosuresEditor } from "@/components/merchant/ClosuresEditor";
import { ScheduleEditor } from "@/components/merchant/ScheduleEditor";
import { emptyStore, StoreFormValues } from "@/components/merchant/StoreSettingsForm";
import { StorefrontView } from "@/components/storefront/StorefrontView";
import { ColorSwatches, TemplateGrid } from "@/components/storefront/TemplatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Categoria, categoriaLabel, db, DeliveryProduct, DeliveryStore, errorMessage, money, scheduleSummary, slugify } from "@/lib/delivery";
import { normalizeTheme, storefrontUrl, temaParaGuardar, TiendaTema } from "@/lib/storefront";
import { cn } from "@/lib/utils";

type QuickProduct = { id: string; nombre: string; precio: string; categoria: string; imagen_url: string };
type Draft = { step: number; values: StoreFormValues; tema: TiendaTema; slug: string; slugTouched: boolean; productos: QuickProduct[] };

const STEPS = [
  { id: "negocio", label: "Tu negocio" },
  { id: "ubicacion", label: "Ubicación" },
  { id: "entrega", label: "Entrega y horarios" },
  { id: "imagen", label: "Tu imagen" },
  { id: "productos", label: "Productos" },
  { id: "tienda", label: "Tienda online" },
  { id: "revisar", label: "Revisar" },
] as const;

const CATEGORIAS: { id: Categoria; icon: typeof Utensils; detalle: string }[] = [
  { id: "comida", icon: Utensils, detalle: "Restaurantes, cafés, panaderías, heladerías" },
  { id: "supermercado", icon: ShoppingBasket, detalle: "Súper, almacén, kioscos, bebidas, verdulerías" },
  { id: "farmacia", icon: Cross, detalle: "Farmacias, perfumerías, cuidado personal" },
  { id: "tiendas", icon: StoreIcon, detalle: "Indumentaria, regalos, decoración, librería" },
];

const RUBROS: Record<Categoria, string[]> = {
  comida: ["Hamburguesas", "Pizza", "Sushi", "Parrilla", "Pastas", "Pollo", "Café", "Helados", "Desayunos", "Sándwiches", "Saludable", "Panadería"],
  supermercado: ["Supermercado", "Almacén", "Kiosco", "Bebidas", "Verdulería", "Carnicería", "Mascotas"],
  farmacia: ["Farmacia", "Perfumería", "Cuidado personal"],
  tiendas: ["Indumentaria", "Regalos", "Decoración", "Librería", "Juguetes", "Tecnología", "Cosmética"],
};

const DRAFT_KEY = "woref-alta-comercio";
const newProduct = (): QuickProduct => ({ id: crypto.randomUUID(), nombre: "", precio: "", categoria: "Destacados", imagen_url: "" });
const toNumber = (value: string) => (value === "" ? 0 : Number(value));
const cleanSlug = (value: string) => value.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-").slice(0, 40);

function readDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Draft;
    return parsed && typeof parsed.step === "number" && parsed.values ? parsed : null;
  } catch { return null; }
}

/** Vista previa en vivo de la tienda dentro de un marco escalado. */
function LivePreview({ store, tema, products }: { store: DeliveryStore; tema: TiendaTema; products: DeliveryProduct[] }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setScale(Math.min(1, element.clientWidth / 1200)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={frame} className="overflow-hidden rounded-3xl border bg-background shadow-soft" style={{ height: Math.round(820 * scale) }}>
      <div className="pointer-events-none origin-top-left select-none" style={{ width: 1200, height: 820, transform: `scale(${scale})` }} aria-hidden>
        <div className="h-full overflow-hidden"><StorefrontView store={store} tema={normalizeTheme(tema)} products={products} sections={[]} preview /></div>
      </div>
    </div>
  );
}

/** Alta guiada de un comercio: negocio, ubicación, entrega, imagen, primeros productos y tienda online, con vista previa y borrador guardado. */
export function StoreOnboarding({ userId, onDone, onCancel }: { userId: string; onDone: (storeId: string) => Promise<void> | void; onCancel?: () => void }) {
  const saved = useMemo(readDraft, []);
  const [step, setStep] = useState(saved?.step ?? 0);
  const [values, setValues] = useState<StoreFormValues>(saved?.values ?? emptyStore);
  const [tema, setTema] = useState<TiendaTema>(saved?.tema ?? { plantilla: "boutique", color: "#1F2A44" });
  const [slug, setSlug] = useState(saved?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(saved?.slugTouched ?? false);
  const [productos, setProductos] = useState<QuickProduct[]>(saved?.productos?.length ? saved.productos : []);
  const [slugState, setSlugState] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");
  const [creating, setCreating] = useState(false);
  const top = useRef<HTMLDivElement>(null);

  const set = <K extends keyof StoreFormValues>(key: K, value: StoreFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));
  const setT = <K extends keyof TiendaTema>(key: K, value: TiendaTema[K]) => setTema((current) => ({ ...current, [key]: value }));

  // El borrador se guarda solo: si se cierra la página, se retoma donde quedó.
  useEffect(() => {
    try { window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, values, tema, slug, slugTouched, productos } satisfies Draft)); } catch { /* sin almacenamiento */ }
  }, [step, values, tema, slug, slugTouched, productos]);

  // La dirección web de la tienda se sugiere a partir del nombre hasta que la persona la edite.
  useEffect(() => { if (!slugTouched) setSlug(cleanSlug(slugify(values.nombre))); }, [values.nombre, slugTouched]);

  // Disponibilidad de la dirección web, con una pequeña espera mientras se escribe.
  useEffect(() => {
    if (STEPS[step].id !== "tienda" && STEPS[step].id !== "revisar") return;
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 3) { setSlugState(slug ? "invalid" : "idle"); return; }
    setSlugState("checking");
    let alive = true;
    const timer = window.setTimeout(async () => {
      const { data, error } = await db.rpc("delivery_slug_disponible", { p_slug: slug });
      if (alive) setSlugState(error ? "idle" : data ? "free" : "taken");
    }, 400);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [slug, step]);

  const goTo = useCallback((next: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
    window.setTimeout(() => top.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  }, []);

  const validProducts = productos.filter((item) => item.nombre.trim() && Number(item.precio) > 0);
  const problems: Record<string, string | null> = {
    negocio: values.nombre.trim().length < 3 ? "Escribí el nombre de tu comercio (mínimo 3 letras)." : null,
    ubicacion: values.latitud == null || values.longitud == null ? "Buscá la dirección y marcá el local en el mapa." : values.direccion.trim().length < 5 ? "Completá la dirección." : null,
    entrega: values.tiempo_min < 5 || values.radio_entrega_km <= 0 ? "Revisá los tiempos y la distancia de entrega." : null,
    imagen: null,
    productos: productos.some((item) => (item.nombre.trim() || item.precio) && !(item.nombre.trim() && Number(item.precio) > 0)) ? "Completá nombre y precio de cada producto, o quitá los que estén a medias." : null,
    tienda: slugState === "free" ? null : slugState === "taken" ? "Esa dirección ya está en uso. Probá con otra." : slugState === "checking" ? "Verificando la dirección…" : "Elegí una dirección web de 3 a 40 letras, números o guiones.",
    revisar: null,
  };
  const current = STEPS[step].id;
  const blocked = problems[current];

  // Datos para la vista previa de la tienda.
  const previewStore = useMemo(() => ({
    id: "vista-previa", slug: slug || "tu-tienda", nombre: values.nombre.trim() || "Tu comercio", categoria: values.categoria, rubro: values.rubro, descripcion: values.descripcion,
    direccion: values.direccion || "Tu dirección", telefono: values.telefono, horario: "", imagen_url: values.imagen_url, logo_url: values.logo_url,
    rating: 0, total_resenas: 0, tiempo_min: values.tiempo_min, tiempo_max: values.tiempo_max, costo_envio: values.costo_envio, pedido_minimo: values.pedido_minimo,
    envio_gratis_desde: values.envio_gratis_desde, promo_texto: values.promo_texto, esta_abierto: true, horarios: values.horarios,
    latitud: values.latitud, longitud: values.longitud, radio_entrega_km: values.radio_entrega_km, costo_por_km: values.costo_por_km,
    activo: true, aprobado: true, tienda_tema: tema,
  }) as unknown as DeliveryStore, [slug, values, tema]);
  const previewProducts = useMemo<DeliveryProduct[]>(() => {
    const base = validProducts.length ? validProducts.map((item) => ({ nombre: item.nombre.trim(), precio: Number(item.precio), categoria: item.categoria.trim() || "Destacados", imagen_url: item.imagen_url }))
      : ["Producto de ejemplo 1", "Producto de ejemplo 2", "Producto de ejemplo 3", "Producto de ejemplo 4"].map((nombre, index) => ({ nombre, precio: 4500 + index * 1500, categoria: "Destacados", imagen_url: "" }));
    return base.map((item, index) => ({ id: `p${index}`, comercio_id: "vista-previa", descripcion: null, precio_anterior: null, stock: null, disponible: true, destacado: index < 2, orden: index, etiquetas: [], grupos: [], ...item })) as unknown as DeliveryProduct[];
  }, [validProducts]);

  const create = async () => {
    setCreating(true);
    const clean = {
      ...values,
      nombre: values.nombre.trim(),
      direccion: values.direccion.trim(),
      rubro: values.rubro?.trim() || null,
      descripcion: values.descripcion?.trim() || null,
      telefono: values.telefono?.trim() || null,
      imagen_url: values.imagen_url?.trim() || null,
      logo_url: values.logo_url?.trim() || null,
      promo_texto: values.promo_texto?.trim() || null,
      tiempo_max: Math.max(values.tiempo_max, values.tiempo_min),
      horario: scheduleSummary(values.horarios),
    };
    // El id se genera acá: pedirle a la base que devuelva la fila recién creada choca con la regla de lectura (todavía no está aprobada).
    const storeId = crypto.randomUUID();
    const { error } = await db.from("delivery_comercios").insert({ ...clean, id: storeId, propietario_id: userId, slug });
    if (error) {
      setCreating(false);
      const message = errorMessage(error);
      if (/slug|duplicate|unique/i.test(message)) { setSlugState("taken"); goTo(STEPS.findIndex((item) => item.id === "tienda")); toast.error("Esa dirección web ya está en uso. Elegí otra."); }
      else toast.error(message);
      return;
    }
    // Lo que no depende de que todo salga perfecto: si algo falla acá, el comercio ya existe y se completa desde el panel.
    const themeResult = await db.rpc("delivery_guardar_tienda_tema", { p_comercio: storeId, p_tema: temaParaGuardar(normalizeTheme(tema)) });
    const productResult = validProducts.length
      ? await db.from("delivery_productos").insert(validProducts.map((item, index) => ({ comercio_id: storeId, nombre: item.nombre.trim().slice(0, 120), precio: Number(item.precio), categoria: item.categoria.trim().slice(0, 60) || "Destacados", imagen_url: item.imagen_url || null, orden: index, destacado: index < 2 })))
      : { error: null };
    try { window.localStorage.removeItem(DRAFT_KEY); } catch { /* sin almacenamiento */ }
    if (themeResult.error || productResult.error) toast.warning("Tu comercio quedó creado, pero algunos datos de la tienda online o los productos no se guardaron. Completalos desde el panel.");
    else toast.success("¡Listo! Tu comercio y tu tienda online quedaron creados.");
    await onDone(storeId);
  };

  const field = "space-y-1.5";
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div ref={top} className="mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-6">
      <div className="rounded-3xl bg-brand-deep p-6 text-white sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-white/70">Alta de comercio · paso {step + 1} de {STEPS.length}</p>
          {onCancel && <button type="button" onClick={onCancel} disabled={creating} className="rounded-full px-3 py-1 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white">Cancelar</button>}
        </div>
        <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{current === "revisar" ? "Revisá y creá tu comercio" : "Sumá tu comercio a Woref"}</h1>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}><div className="h-full rounded-full bg-brand-orange transition-all duration-300" style={{ width: `${progress}%` }} /></div>
        <ol className="scrollbar-none mt-3 flex gap-1 overflow-x-auto text-xs font-semibold">
          {STEPS.map((item, index) => (
            <li key={item.id}>
              <button type="button" disabled={index > step} onClick={() => goTo(index)} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 transition-colors", index === step ? "bg-white text-foreground" : index < step ? "bg-white/15 text-white hover:bg-white/25" : "text-white/50")}>
                {index < step ? <Check className="h-3.5 w-3.5" /> : <span className="opacity-70">{index + 1}</span>}{item.label}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <section className="mt-5 rounded-3xl border bg-card p-4 sm:p-7">
        {current === "negocio" && (
          <div className="space-y-6">
            <div><h2 className="text-xl font-extrabold">¿Qué tipo de negocio es?</h2><p className="text-sm text-muted-foreground">Esto define dónde te mostramos y qué plantilla te conviene.</p></div>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de negocio">
              {CATEGORIAS.map(({ id, icon: Icon, detalle }) => (
                <button key={id} type="button" role="radio" aria-checked={values.categoria === id} onClick={() => { set("categoria", id); if (!RUBROS[id].includes(values.rubro || "")) set("rubro", ""); }}
                  className={cn("flex items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors", values.categoria === id ? "border-brand-orange bg-brand-orange/5" : "border-transparent bg-muted/50 hover:bg-muted")}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(220_14%_16%)] text-brand-orange"><Icon className="h-5 w-5" /></span>
                  <span><span className="block font-extrabold">{categoriaLabel[id]}</span><span className="block text-sm text-muted-foreground">{detalle}</span></span>
                </button>
              ))}
            </div>
            <div className={field}>
              <Label>Rubro</Label>
              <div className="flex flex-wrap gap-2">
                {RUBROS[values.categoria].map((item) => <button key={item} type="button" aria-pressed={values.rubro === item} onClick={() => set("rubro", item)} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", values.rubro === item ? "border-brand-orange bg-brand-orange/10" : "hover:bg-muted")}>{item}</button>)}
              </div>
              <Input maxLength={40} value={values.rubro || ""} onChange={(event) => set("rubro", event.target.value)} placeholder="O escribí el tuyo" className="mt-2 max-w-xs" aria-label="Rubro" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={field}><Label htmlFor="o-nombre">Nombre del comercio</Label><Input id="o-nombre" maxLength={80} value={values.nombre} onChange={(event) => set("nombre", event.target.value)} placeholder="Ej.: Panadería La Esquina" autoFocus /></div>
              <div className={field}><Label htmlFor="o-tel">Teléfono del local</Label><Input id="o-tel" type="tel" maxLength={40} value={values.telefono || ""} onChange={(event) => set("telefono", event.target.value)} placeholder="2355 123456" /></div>
              <div className={cn(field, "sm:col-span-2")}><Label htmlFor="o-desc">Contá qué vendés y qué te hace especial</Label><Textarea id="o-desc" maxLength={300} className="min-h-[88px]" value={values.descripcion || ""} onChange={(event) => set("descripcion", event.target.value)} placeholder="Ej.: Pan de masa madre, facturas y tortas caseras, todos los días." /><p className="text-xs text-muted-foreground">Se muestra en tu perfil y en tu tienda online.</p></div>
            </div>
          </div>
        )}

        {current === "ubicacion" && (
          <div className="space-y-4">
            <div><h2 className="text-xl font-extrabold">¿Dónde está tu local?</h2><p className="text-sm text-muted-foreground">Con esto calculamos a quién le llegás y cuánto cuesta el envío.</p></div>
            <AddressSearch placeholder="Buscá la dirección del local" onPick={(found) => setValues((currentValues) => ({ ...currentValues, latitud: found.lat, longitud: found.lng, direccion: found.label || currentValues.direccion }))} />
            {values.latitud != null && values.longitud != null
              ? <MapPicker value={{ lat: values.latitud, lng: values.longitud }} onChange={(point) => setValues((currentValues) => ({ ...currentValues, latitud: point.lat, longitud: point.lng }))} className="h-72" />
              : <p className="rounded-xl bg-warning/15 p-3 text-sm font-semibold">Todavía no marcaste dónde está el local. Buscá la dirección arriba.</p>}
            <div className={field}><Label htmlFor="o-dir">Dirección que ven tus clientes</Label><Input id="o-dir" maxLength={200} value={values.direccion} onChange={(event) => set("direccion", event.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Podés mover el pin en el mapa para ajustar la ubicación exacta.</p>
          </div>
        )}

        {current === "entrega" && (
          <div className="space-y-6">
            <div><h2 className="text-xl font-extrabold">Entrega y horarios</h2><p className="text-sm text-muted-foreground">Todo se puede cambiar después desde Configuración.</p></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className={field}><Label htmlFor="o-radio">Entregás hasta (km)</Label><Input id="o-radio" type="number" min={0.5} max={50} step={0.5} value={values.radio_entrega_km} onChange={(event) => set("radio_entrega_km", toNumber(event.target.value))} /></div>
              <div className={field}><Label htmlFor="o-envio">Envío base ($)</Label><Input id="o-envio" type="number" min={0} value={values.costo_envio} onChange={(event) => set("costo_envio", toNumber(event.target.value))} /></div>
              <div className={field}><Label htmlFor="o-km">Extra por km ($)</Label><Input id="o-km" type="number" min={0} value={values.costo_por_km} onChange={(event) => set("costo_por_km", toNumber(event.target.value))} /></div>
              <div className={field}><Label htmlFor="o-tmin">Tiempo mínimo (min)</Label><Input id="o-tmin" type="number" min={5} max={180} value={values.tiempo_min} onChange={(event) => set("tiempo_min", toNumber(event.target.value))} /></div>
              <div className={field}><Label htmlFor="o-tmax">Tiempo máximo (min)</Label><Input id="o-tmax" type="number" min={5} max={240} value={values.tiempo_max} onChange={(event) => set("tiempo_max", toNumber(event.target.value))} /></div>
              <div className={field}><Label htmlFor="o-min">Pedido mínimo ($)</Label><Input id="o-min" type="number" min={0} value={values.pedido_minimo} onChange={(event) => set("pedido_minimo", toNumber(event.target.value))} /></div>
            </div>
            <p className="text-xs text-muted-foreground">Ejemplo: con envío base de {money(values.costo_envio)} y {money(values.costo_por_km)} por km, a 3 km el envío cuesta {money(Math.round((values.costo_envio + values.costo_por_km * 3) / 10) * 10)}.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3"><span><span className="block text-sm font-bold">Ofrecer retiro en el local</span><span className="block text-xs text-muted-foreground">Sin envío ni repartidor.</span></span><Switch checked={values.acepta_retiro} onCheckedChange={(on) => set("acepta_retiro", on)} /></label>
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3"><span><span className="block text-sm font-bold">Pedidos programados</span><span className="block text-xs text-muted-foreground">Para más tarde o para otro día.</span></span><Switch checked={values.acepta_programados} onCheckedChange={(on) => set("acepta_programados", on)} /></label>
            </div>
            <div>
              <h3 className="mb-3 font-extrabold">Horarios de atención</h3>
              <ScheduleEditor value={values.horarios} onChange={(horarios) => set("horarios", horarios)} />
              <ClosuresEditor value={values.horarios} onChange={(horarios) => set("horarios", horarios)} />
            </div>
          </div>
        )}

        {current === "imagen" && (
          <div className="space-y-6">
            <div><h2 className="text-xl font-extrabold">Tu imagen</h2><p className="text-sm text-muted-foreground">Es lo primero que ven tus clientes. Una buena foto de portada hace mucha diferencia. Podés saltear este paso y subirlas después.</p></div>
            <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
              <ImageUpload label="Foto de portada (horizontal, mínimo 1200 px de ancho)" folder="comercios" value={values.imagen_url} onChange={(url) => set("imagen_url", url)} className="max-w-md" />
              <ImageUpload label="Logo (cuadrado)" folder="comercios" shape="round" value={values.logo_url} onChange={(url) => set("logo_url", url)} />
            </div>
          </div>
        )}

        {current === "productos" && (
          <div className="space-y-5">
            <div><h2 className="text-xl font-extrabold">Tus primeros productos</h2><p className="text-sm text-muted-foreground">Cargá algunos para ver cómo queda tu tienda. Después podés agregar el resto, importar tu lista desde un archivo CSV y armar variantes desde el panel. Este paso es opcional.</p></div>
            <ul className="space-y-3">
              {productos.map((item, index) => (
                <li key={item.id} className="grid gap-3 rounded-2xl border p-3 sm:grid-cols-[auto_1fr_1fr_auto] sm:items-start">
                  <ImageUpload label="" folder="productos" shape="square" value={item.imagen_url} onChange={(url) => setProductos((list) => list.map((row) => (row.id === item.id ? { ...row, imagen_url: url } : row)))} className="w-28" />
                  <div className="space-y-2">
                    <Input aria-label={`Nombre del producto ${index + 1}`} maxLength={120} placeholder="Nombre del producto" value={item.nombre} onChange={(event) => setProductos((list) => list.map((row) => (row.id === item.id ? { ...row, nombre: event.target.value } : row)))} />
                    <Input aria-label={`Categoría del producto ${index + 1}`} maxLength={60} placeholder="Categoría (ej.: Panes)" value={item.categoria} onChange={(event) => setProductos((list) => list.map((row) => (row.id === item.id ? { ...row, categoria: event.target.value } : row)))} />
                  </div>
                  <Input aria-label={`Precio del producto ${index + 1}`} type="number" min={0} inputMode="decimal" placeholder="Precio ($)" value={item.precio} onChange={(event) => setProductos((list) => list.map((row) => (row.id === item.id ? { ...row, precio: event.target.value } : row)))} />
                  <Button type="button" variant="ghost" size="icon" aria-label={`Quitar producto ${index + 1}`} onClick={() => setProductos((list) => list.filter((row) => row.id !== item.id))}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
            {productos.length < 8 && <Button type="button" variant="outline" className="rounded-full" onClick={() => setProductos((list) => [...list, newProduct()])}><Plus className="h-4 w-4" />Agregar producto</Button>}
          </div>
        )}

        {current === "tienda" && (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
            <div className="space-y-6">
              <div><h2 className="text-xl font-extrabold">Tu tienda online</h2><p className="text-sm text-muted-foreground">Un sitio propio para tu comercio, listo para compartir en redes. Elegí cómo se ve; después podés cambiarlo cuando quieras.</p></div>
              <div className={field}>
                <Label htmlFor="o-slug">Dirección web</Label>
                <div className="flex items-center overflow-hidden rounded-xl border bg-background pl-3 text-sm">
                  <span className="shrink-0 text-muted-foreground">{storefrontUrl("").replace(/^https?:\/\//, "")}</span>
                  <input id="o-slug" value={slug} onChange={(event) => { setSlugTouched(true); setSlug(cleanSlug(event.target.value)); }} className="h-11 min-w-0 flex-1 bg-transparent px-1 font-semibold outline-none" aria-describedby="o-slug-estado" />
                  <span className="px-3">{slugState === "checking" ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : slugState === "free" ? <CheckCircle2 className="h-5 w-5 text-success" /> : slugState === "taken" || slugState === "invalid" ? <XCircle className="h-5 w-5 text-destructive" /> : null}</span>
                </div>
                <p id="o-slug-estado" className={cn("text-xs", slugState === "free" ? "text-success" : slugState === "taken" || slugState === "invalid" ? "text-destructive" : "text-muted-foreground")}>
                  {slugState === "free" ? "¡Está libre! Esta será la dirección de tu tienda." : slugState === "taken" ? "Ya está en uso, probá con otra." : slugState === "invalid" ? "Usá de 3 a 40 letras minúsculas, números o guiones." : "No se puede cambiar después sin que se rompan los enlaces y los QR ya impresos."}
                </p>
              </div>
              <div><h3 className="mb-2 font-extrabold">Plantilla</h3><TemplateGrid value={normalizeTheme(tema).plantilla} color={normalizeTheme(tema).color} onChange={(id) => setT("plantilla", id)} /></div>
              <div><h3 className="mb-2 font-extrabold">Color de tu marca</h3><ColorSwatches value={normalizeTheme(tema).color} onChange={(color) => setT("color", color)} /></div>
              <div className={field}><Label htmlFor="o-sub">Frase bajo el título</Label><Input id="o-sub" maxLength={160} value={tema.subtitulo ?? ""} onChange={(event) => setT("subtitulo", event.target.value)} placeholder="Ej.: Pan de masa madre, horneado cada mañana" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className={field}><Label htmlFor="o-wa">WhatsApp</Label><Input id="o-wa" inputMode="numeric" maxLength={15} value={tema.whatsapp ?? ""} onChange={(event) => setT("whatsapp", event.target.value.replace(/\D/g, ""))} placeholder="5492355123456" /></div>
                <div className={field}><Label htmlFor="o-ig">Instagram</Label><Input id="o-ig" maxLength={60} value={tema.instagram ?? ""} onChange={(event) => setT("instagram", event.target.value.replace(/[^A-Za-z0-9._-]/g, ""))} placeholder="mi.tienda" /></div>
              </div>
            </div>
            <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
              <p className="mb-2 text-sm font-bold text-muted-foreground">Así se ve tu tienda</p>
              <LivePreview store={previewStore} tema={tema} products={previewProducts} />
              {!validProducts.length && <p className="mt-2 text-xs text-muted-foreground">Los productos que ves son de ejemplo. Los tuyos aparecen cuando los cargás.</p>}
            </div>
          </div>
        )}

        {current === "revisar" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,380px)]">
            <div className="space-y-5">
              <div><h2 className="text-xl font-extrabold">Todo listo para crear</h2><p className="text-sm text-muted-foreground">Revisá los datos. Podés volver a cualquier paso.</p></div>
              <dl className="divide-y rounded-2xl border">
                {([
                  ["Comercio", `${values.nombre} · ${categoriaLabel[values.categoria]}${values.rubro ? ` · ${values.rubro}` : ""}`, 0],
                  ["Dirección", values.direccion || "—", 1],
                  ["Entrega", `Hasta ${values.radio_entrega_km} km · envío desde ${money(values.costo_envio)} · ${values.tiempo_min}-${values.tiempo_max} min`, 2],
                  ["Horarios", scheduleSummary(values.horarios) || "—", 2],
                  ["Imagen", `${values.logo_url ? "Logo ✓" : "Sin logo"} · ${values.imagen_url ? "Portada ✓" : "Sin portada"}`, 3],
                  ["Productos", validProducts.length ? `${validProducts.length} cargados` : "Los cargás después desde el panel", 4],
                  ["Tienda online", storefrontUrl(slug), 5],
                ] as const).map(([label, value, target]) => (
                  <div key={label} className="flex items-start gap-3 p-3.5">
                    <dt className="w-28 shrink-0 text-sm font-semibold text-muted-foreground">{label}</dt>
                    <dd className="min-w-0 flex-1 break-words text-sm font-semibold">{value}</dd>
                    <button type="button" onClick={() => goTo(target)} className="shrink-0 text-muted-foreground hover:text-foreground" aria-label={`Editar ${label}`}><Pencil className="h-4 w-4" /></button>
                  </div>
                ))}
              </dl>
              <div className="rounded-2xl border border-l-4 border-l-brand-orange bg-muted/40 p-4 text-sm">
                <p className="font-extrabold">Qué pasa después de crear</p>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                  <li>Revisamos tu comercio antes de mostrarlo a los clientes (suele ser rápido).</li>
                  <li>Te pedimos verificar al titular y el CUIT, y cargar los datos de cobro desde Configuración.</li>
                  <li>Mientras tanto podés cargar tu menú, ver tu tienda online y descargar el cartel con el QR.</li>
                </ol>
                <p className="mt-3 text-xs text-muted-foreground">Al crear tu comercio aceptás los <Link to="/terminos" target="_blank" className="font-semibold underline">Términos y condiciones</Link> y la <Link to="/privacidad" target="_blank" className="font-semibold underline">Política de privacidad</Link>.</p>
              </div>
            </div>
            <div className="min-w-0">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-muted-foreground"><ExternalLink className="h-4 w-4" />Tu tienda online</p>
              <LivePreview store={previewStore} tema={tema} products={previewProducts} />
            </div>
          </div>
        )}
      </section>

      <div className="sticky bottom-3 z-10 mt-5 flex items-center justify-between gap-3 rounded-full border bg-card/95 p-2 pl-3 shadow-pop backdrop-blur">
        <Button type="button" variant="ghost" className="rounded-full font-bold" onClick={() => goTo(step - 1)} disabled={step === 0 || creating}><ArrowLeft className="h-4 w-4" />Atrás</Button>
        <p className="hidden min-w-0 flex-1 truncate text-center text-xs font-semibold text-muted-foreground sm:block" role="status">{blocked ?? "Se guarda solo: podés seguir más tarde."}</p>
        {current === "revisar" ? (
          <Button type="button" className="rounded-full px-6 font-bold" onClick={create} disabled={creating || slugState !== "free"}>{creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Crear mi comercio</Button>
        ) : (
          <Button type="button" className="rounded-full px-6 font-bold" onClick={() => { if (blocked) { toast.error(blocked); return; } goTo(step + 1); }} disabled={creating}>{current === "imagen" || current === "productos" ? "Continuar" : "Siguiente"}<ArrowRight className="h-4 w-4" /></Button>
        )}
      </div>
      {blocked && <p className="mt-2 text-center text-xs font-semibold text-muted-foreground sm:hidden" role="status">{blocked}</p>}
    </div>
  );
}

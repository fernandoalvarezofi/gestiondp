import { CSSProperties, ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BadgeCheck, Bike, Clock3, CreditCard, Globe, Headphones, Instagram, MapPin, MessageCircle, Search, ShoppingBag, Star, Store as StoreIcon, Zap } from "lucide-react";
import { ProductCard } from "@/components/delivery/ProductCard";
import { SmartImage } from "@/components/delivery/SmartImage";
import { deliveryFeeLabel, StoreLogo } from "@/components/delivery/StoreCard";
import { CartStore, useCart } from "@/contexts/CartContext";
import { useAddressPoint } from "@/hooks/useAddressPoint";
import { useTariff } from "@/hooks/useTariff";
import { DeliveryProduct, DeliverySection, DeliveryStore, isOpenNow, money, nextOpening, orderSections, scheduleSummary } from "@/lib/delivery";
import { storeReach } from "@/lib/geo";
import { Bloque, BloqueBanner, BloqueImagenTexto, BloquePortada, FUENTES, Icono, normalizeTheme, RADIOS, readableOn, TemaNormalizado, TIPOS_BLOQUE, whatsappLink } from "@/lib/storefront";
import { cn } from "@/lib/utils";

export type StorefrontReview = { id: string; puntaje: number; comentario?: string | null; created_at: string; cliente?: { nombre: string } | null };

type Props = {
  store: DeliveryStore;
  /** Tema ya normalizado (en el editor se pasa el borrador para ver los cambios al instante). */
  tema?: TemaNormalizado;
  products: DeliveryProduct[];
  sections: DeliverySection[];
  reviews?: StorefrontReview[];
  /** En la vista previa del editor no se navega: los enlaces y el carrito quedan inertes. */
  preview?: boolean;
  /** Editor: al tocar un bloque se avisa cuál es. Con esto cada bloque se puede seleccionar con un clic. */
  onSelectBlock?: (id: string) => void;
  selectedBlock?: string | null;
};

type Group = { name: string; items: DeliveryProduct[] };

const COLUMNAS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
  5: "grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
};
const ESPACIO: Record<string, string> = { compacto: "pt-8 sm:pt-10", normal: "pt-12 sm:pt-16", amplio: "pt-16 sm:pt-24" };
const ICONOS: Record<Icono, typeof Bike> = { envio: Bike, pago: CreditCard, calidad: BadgeCheck, tiempo: Zap, soporte: Headphones, local: StoreIcon };
const ALTO_PORTADA = { chico: "min-h-[240px] sm:min-h-[320px]", medio: "min-h-[340px] sm:min-h-[440px]", grande: "min-h-[420px] sm:min-h-[560px]" } as const;
const ALTO_BANNER = { chico: "min-h-[140px] sm:min-h-[180px]", medio: "min-h-[200px] sm:min-h-[260px]", grande: "min-h-[280px] sm:min-h-[380px]" } as const;
const ALTO_SEP = { chico: "h-4", medio: "h-10", grande: "h-20" } as const;

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** Tienda online de un comercio: arma la página con los bloques y el diseño elegidos. Es la misma pantalla para el sitio público y la vista previa del editor. */
export function StorefrontView({ store, tema, products, sections: sectionConfig, reviews = [], preview = false, onSelectBlock, selectedBlock }: Props) {
  const theme = useMemo(() => tema ?? normalizeTheme(store.tienda_tema), [tema, store.tienda_tema]);
  const d = theme.diseno;
  const { itemCount, subtotal } = useCart();
  const point = useAddressPoint();
  const tariff = useTariff(point);
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const open = isOpenNow(store);
  const reach = storeReach(store, point, undefined, tariff);
  const unavailable = !open || !reach.inZone;
  const fee = deliveryFeeLabel(store, reach.fee);
  const cartStore: CartStore = { id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio, pedido_minimo: store.pedido_minimo, envio_gratis_desde: store.envio_gratis_desde, imagen_url: store.imagen_url };

  const onAccent = readableOn(theme.color);
  const darkPage = d.fondo ? readableOn(d.fondo) === "#FFFFFF" : false;
  const titleFont = FUENTES[d.fuente_titulos].css;
  const bodyFont = d.fuente_texto === "serif" ? FUENTES.serif.css : undefined;
  const pageStyle = {
    "--sf-accent": theme.color,
    "--sf-on-accent": onAccent,
    "--sf-radius": RADIOS[d.radio].css,
    "--sf-aspect": d.aspecto,
    fontFamily: bodyFont,
    ...(d.fondo ? { backgroundColor: d.fondo, color: d.texto ?? readableOn(d.fondo) } : d.texto ? { color: d.texto } : {}),
  } as unknown as CSSProperties;
  const accent: CSSProperties = { background: "var(--sf-accent)", color: "var(--sf-on-accent)" };
  const headingStyle: CSSProperties = titleFont ? { fontFamily: titleFont } : {};
  const radiusButton: CSSProperties = { borderRadius: d.radio === "pildora" ? 9999 : d.radio === "cuadrado" ? 0 : "var(--sf-radius)" };
  const width = d.ancho === "amplio" ? "max-w-7xl" : "max-w-6xl";
  const centered = d.cabecera === "centro";
  const space = ESPACIO[d.espaciado];

  const visible = useMemo(() => {
    const value = term.trim().toLowerCase();
    return products.filter((product) => product.disponible !== false && (!value || `${product.nombre} ${product.descripcion || ""}`.toLowerCase().includes(value)));
  }, [products, term]);
  const available = useMemo(() => products.filter((product) => product.disponible !== false), [products]);
  const groupsOf = (list: DeliveryProduct[]): Group[] => orderSections(list, sectionConfig, true)
    .map(({ name }) => ({ name, items: list.filter((product) => product.categoria === name) }))
    .filter((group) => group.items.length > 0);
  const groups = useMemo(() => groupsOf(visible), [visible, sectionConfig]); // eslint-disable-line react-hooks/exhaustive-deps
  const allGroups = useMemo(() => groupsOf(available), [available, sectionConfig]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = category ? groups.filter((group) => group.name === category) : groups;
  const featured = available.filter((product) => product.destacado);

  const rated = theme.mostrar_opiniones && store.total_resenas > 0;
  const social = [
    theme.whatsapp && { href: whatsappLink(theme.whatsapp, store.nombre), label: "WhatsApp", icon: MessageCircle },
    theme.instagram && { href: `https://instagram.com/${theme.instagram}`, label: "Instagram", icon: Instagram },
    theme.facebook && { href: `https://facebook.com/${theme.facebook}`, label: "Facebook", icon: Globe },
    theme.web && { href: theme.web, label: "Sitio web", icon: Globe },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe }[];

  const go = (id: string) => { if (!preview) scrollToId(id); };
  const pickCategory = (name: string | null) => { setCategory(name); if (!preview) setTimeout(() => scrollToId("catalogo"), 30); };
  const follow = (tipo: "catalogo" | "whatsapp" | "url", url?: string) => {
    if (preview) return;
    if (tipo === "catalogo") scrollToId("catalogo");
    else if (tipo === "whatsapp" && theme.whatsapp) window.open(whatsappLink(theme.whatsapp, store.nombre), "_blank", "noopener,noreferrer");
    else if (tipo === "url" && url) window.open(url, "_blank", "noopener,noreferrer");
  };
  const cartLabel = itemCount > 0 ? `${itemCount} · ${money(subtotal)}` : "Mi pedido";

  // ---- piezas comunes
  const Boton = ({ children, onClick, tone = "accent" }: { children: ReactNode; onClick?: () => void; tone?: "accent" | "light" | "ghost-light" }) => {
    const filled = d.boton === "relleno";
    const style: CSSProperties = tone === "light" ? { background: "#fff", color: "var(--sf-accent)", ...radiusButton }
      : tone === "ghost-light" ? { border: "1px solid rgba(255,255,255,0.7)", color: "#fff", ...radiusButton }
      : filled ? { ...accent, ...radiusButton } : { border: "2px solid var(--sf-accent)", color: "var(--sf-accent)", ...radiusButton };
    return <button type="button" onClick={onClick} className="inline-flex items-center gap-2 px-6 py-3 text-base font-bold transition-opacity hover:opacity-90" style={style}>{children}</button>;
  };
  const Titulo = ({ children, id }: { children: ReactNode; id?: string }) => (
    <h2 id={id} className={cn("mb-6 scroll-mt-24 text-2xl font-extrabold sm:text-3xl", centered && "text-center")} style={headingStyle}>{children}</h2>
  );
  const statusChip = (
    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider"><span className={cn("h-2 w-2 rounded-full", open ? "bg-emerald-400" : "bg-red-400")} />{open ? "Abierto ahora" : "Cerrado"}</span>
  );
  const info = [
    { icon: Clock3, label: "Entrega", value: `${store.tiempo_min}-${store.tiempo_max} min` },
    { icon: Bike, label: "Envío", value: fee.replace("Envío ", "") },
    { icon: ShoppingBag, label: "Pedido mínimo", value: Number(store.pedido_minimo) > 0 ? money(store.pedido_minimo) : "Sin mínimo" },
    ...(rated ? [{ icon: Star, label: `${store.total_resenas} opiniones`, value: Number(store.rating).toFixed(1) }] : []),
  ];
  const grid = (items: DeliveryProduct[], columnas: number) => (
    <div className={cn("grid", d.descripcion ? "grid-cols-1 gap-x-8 md:grid-cols-2" : cn(COLUMNAS[columnas] ?? COLUMNAS[4], "gap-x-4 gap-y-8"))}>
      {items.map((product) => <ProductCard key={product.id} product={product} store={cartStore} disabled={unavailable} variant={d.descripcion ? "row" : "shop"} />)}
    </div>
  );

  // ---- portada
  const renderPortada = (b: BloquePortada) => {
    const title = b.titulo || theme.titulo || store.nombre;
    const sub = b.subtitulo || theme.subtitulo || store.descripcion || "";
    const cta = b.boton || theme.boton || (b.estilo === "impacto" ? "Pedir ahora" : b.estilo === "galeria" ? "Explorar" : "Ver productos");
    const image = b.imagen_url || theme.banner_url || store.imagen_url;
    const buttons = (light: boolean) => (
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Boton tone={light ? "light" : "accent"} onClick={() => go("catalogo")}>{cta}<ArrowRight className="h-4 w-4" /></Boton>
        {theme.whatsapp && !preview && <a href={whatsappLink(theme.whatsapp, store.nombre)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border px-5 py-3 text-base font-semibold" style={{ ...radiusButton, ...(light || b.estilo === "boutique" || b.estilo === "simple" ? { borderColor: "rgba(255,255,255,0.6)", color: "#fff" } : {}) }}><MessageCircle className="h-4 w-4" />WhatsApp</a>}
      </div>
    );
    if (b.estilo === "galeria") {
      return (
        <section className={cn("mx-auto px-4 pt-12 text-center sm:px-6 sm:pt-20", width)}>
          <p className="text-xs font-semibold uppercase tracking-[0.35em] opacity-60">{store.rubro || "Tienda online"}</p>
          <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-light leading-[1.05] tracking-tight sm:text-7xl" style={headingStyle}>{title}</h1>
          {sub && <p className="mx-auto mt-5 max-w-xl text-lg opacity-70">{sub}</p>}
          <div className="mx-auto mt-8 h-px w-20" style={{ background: "var(--sf-accent)" }} />
          <div className="relative mt-10 aspect-[16/9] overflow-hidden bg-muted sm:aspect-[21/9]" style={{ borderRadius: "var(--sf-radius)" }}><SmartImage src={image} width={1600} loading="eager" /></div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm opacity-80"><span className="font-semibold">{statusChip}</span>{info.map(({ label, value }) => <span key={label}>{label}: <span className="font-semibold">{value}</span></span>)}</div>
          <div className="mt-6 flex justify-center"><Boton onClick={() => go("catalogo")}>{cta}</Boton></div>
        </section>
      );
    }
    if (b.estilo === "impacto") {
      return (
        <section className={cn("mx-auto px-4 pt-5 sm:px-6", width)}>
          <div className="relative overflow-hidden p-6 sm:p-12" style={{ ...accent, borderRadius: d.radio === "cuadrado" ? 0 : "2rem" }}>
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
            <div className="relative grid items-center gap-8 lg:grid-cols-[1.25fr_1fr]">
              <div>
                <div className="mb-4 inline-flex rounded-full bg-white/15 px-3 py-1">{statusChip}</div>
                <h1 className="text-[2.6rem] font-black leading-[0.98] tracking-tight sm:text-7xl" style={headingStyle}>{title}</h1>
                {sub && <p className="mt-4 max-w-lg text-base opacity-90 sm:text-xl">{sub}</p>}
                {buttons(true)}
                <div className="mt-6 flex flex-wrap gap-2">{info.map(({ icon: Icon, label, value }) => <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold"><Icon className="h-4 w-4" />{value}<span className="hidden font-normal opacity-80 sm:inline"> {label.toLowerCase()}</span></span>)}</div>
              </div>
              <div className="relative hidden aspect-[4/3] rotate-2 overflow-hidden bg-black/10 shadow-pop lg:block" style={{ borderRadius: "var(--sf-radius)" }}><SmartImage src={image} width={900} loading="eager" /></div>
            </div>
          </div>
        </section>
      );
    }
    if (b.estilo === "gourmet") {
      return (
        <section className={cn("mx-auto px-4 pt-8 sm:px-6 sm:pt-14", width)}>
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
            <div className="text-center lg:text-left">
              <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--sf-accent)" }}>{store.rubro || "Cocina de la casa"}</p>
              <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-6xl" style={headingStyle}>{title}</h1>
              <div className="mx-auto mt-5 flex items-center gap-3 lg:mx-0"><span className="h-px w-12" style={{ background: "var(--sf-accent)" }} /><span className="text-lg" style={{ color: "var(--sf-accent)" }}>✦</span><span className="h-px w-12" style={{ background: "var(--sf-accent)" }} /></div>
              {sub && <p className="mx-auto mt-5 max-w-lg text-lg italic opacity-70 lg:mx-0">{sub}</p>}
              <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm opacity-80 lg:justify-start"><li className="font-semibold">{statusChip}</li>{info.slice(0, 3).map(({ icon: Icon, value }) => <li key={value} className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4" />{value}</li>)}</ul>
              <div className="flex justify-center lg:justify-start">{buttons(false)}</div>
            </div>
            <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-b-3xl rounded-t-[999px] bg-muted shadow-pop lg:max-w-none"><SmartImage src={image} width={900} loading="eager" /></div>
          </div>
        </section>
      );
    }
    // boutique y simple: foto a todo el ancho con texto encima
    const center = b.alineacion === "centro";
    return (
      <>
        <section className="relative isolate overflow-hidden bg-[hsl(220_14%_16%)] text-white">
          <div className="absolute inset-0 -z-10"><SmartImage src={image} width={1600} loading="eager" /></div>
          <div className="absolute inset-0 -z-10" style={{ background: `linear-gradient(${center ? "to top" : "to right"}, rgba(0,0,0,${Math.min(0.95, b.oscurecer / 100 + 0.2)}), rgba(0,0,0,${b.oscurecer / 100 * 0.6}) 60%, rgba(0,0,0,${b.oscurecer / 100 * 0.25}))` }} />
          <div className={cn("mx-auto flex flex-col justify-end px-4 pb-12 pt-24 sm:px-6 sm:pb-16", width, ALTO_PORTADA[b.alto], center && "items-center text-center")}>
            <div className="mb-4 opacity-90">{statusChip}</div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.02] sm:text-7xl" style={headingStyle}>{title}</h1>
            {sub && <p className="mt-4 max-w-xl text-base text-white/85 sm:text-xl">{sub}</p>}
            {buttons(false)}
          </div>
        </section>
        {b.estilo === "boutique" && (
          <div className={cn("relative z-10 mx-auto -mt-8 px-4 sm:px-6", width)}>
            <dl className="grid grid-cols-2 gap-px overflow-hidden border bg-border shadow-pop sm:grid-cols-4" style={{ borderRadius: "var(--sf-radius)" }}>
              {info.map(({ icon: Icon, label, value }) => <div key={label} className="flex items-center gap-3 bg-card p-4 text-card-foreground"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={accent}><Icon className="h-5 w-5" /></span><div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-extrabold">{value}</dd></div></div>)}
            </dl>
          </div>
        )}
      </>
    );
  };

  // ---- bloques con imagen
  const renderBanner = (b: BloqueBanner) => (
    <section className={cn("mx-auto px-4 sm:px-6", width, space)}>
      <div className={cn("relative isolate flex items-center overflow-hidden bg-[hsl(220_14%_16%)] text-white", ALTO_BANNER[b.alto])} style={{ borderRadius: "var(--sf-radius)", ...(b.imagen_url ? {} : accent) }}>
        {b.imagen_url && <><div className="absolute inset-0 -z-10"><SmartImage src={b.imagen_url} width={1400} /></div><div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/40 to-transparent" /></>}
        <div className="max-w-xl p-6 sm:p-10">
          {b.titulo && <h2 className="text-2xl font-black leading-tight sm:text-4xl" style={headingStyle}>{b.titulo}</h2>}
          {b.texto && <p className="mt-2 text-base opacity-90 sm:text-lg">{b.texto}</p>}
          {b.boton && <div className="mt-5"><Boton tone="light" onClick={() => follow(b.enlace_tipo, b.enlace_url)}>{b.boton}<ArrowRight className="h-4 w-4" /></Boton></div>}
        </div>
      </div>
    </section>
  );
  const renderImagenTexto = (b: BloqueImagenTexto) => (
    <section className={cn("mx-auto px-4 sm:px-6", width, space)}>
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
        <div className={cn("relative aspect-[4/3] overflow-hidden bg-muted", b.lado === "derecha" && "lg:order-2")} style={{ borderRadius: "var(--sf-radius)" }}><SmartImage src={b.imagen_url || store.imagen_url} width={900} /></div>
        <div>
          {b.titulo && <h2 className="text-2xl font-extrabold sm:text-4xl" style={headingStyle}>{b.titulo}</h2>}
          {b.texto && <p className="mt-4 whitespace-pre-line text-lg leading-relaxed opacity-75">{b.texto}</p>}
          {b.boton && <div className="mt-6"><Boton onClick={() => follow(b.enlace_tipo, b.enlace_url)}>{b.boton}<ArrowRight className="h-4 w-4" /></Boton></div>}
        </div>
      </div>
    </section>
  );

  // ---- bloques
  const renderBloque = (b: Bloque): ReactNode => {
    switch (b.tipo) {
      case "portada": return renderPortada(b);
      case "banner": return renderBanner(b);
      case "imagen_texto": return renderImagenTexto(b);
      case "texto":
        if ((!b.titulo && !b.texto) || (b.id === "acerca" && !b.texto)) return null;
        return (
          <section id={b.id === "acerca" ? "acerca" : undefined} className={cn("mx-auto scroll-mt-24 px-4 sm:px-6", width, space)}>
            <div className={cn("mx-auto max-w-3xl", b.fondo !== "ninguno" && "p-8 sm:p-12", b.alineacion === "centro" && "text-center")} style={b.fondo === "suave" ? { background: "color-mix(in srgb, var(--sf-accent) 9%, transparent)", borderRadius: "var(--sf-radius)" } : b.fondo === "color" ? { ...accent, borderRadius: "var(--sf-radius)" } : undefined}>
              {b.titulo && <h2 className="text-2xl font-extrabold sm:text-3xl" style={headingStyle}>{b.titulo}</h2>}
              {b.texto && <p className={cn("whitespace-pre-line text-lg leading-relaxed", b.titulo && "mt-3", b.fondo !== "color" && "opacity-75")}>{b.texto}</p>}
            </div>
          </section>
        );
      case "colecciones": {
        if (allGroups.length < 2) return null;
        return (
          <section className={cn("mx-auto px-4 sm:px-6", width, space)}>
            <Titulo>{b.titulo || "Colecciones"}</Titulo>
            <div className={cn("grid gap-3 sm:gap-5", b.estilo === "circulos" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : b.estilo === "lista" ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-4")}>
              {allGroups.slice(0, b.estilo === "circulos" ? 6 : 8).map((group) => {
                const image = group.items.find((product) => product.imagen_url)?.imagen_url;
                return b.estilo === "circulos" ? (
                  <button key={group.name} type="button" onClick={() => pickCategory(group.name)} className="group text-center">
                    <span className="relative mx-auto block aspect-square w-full max-w-[140px] overflow-hidden rounded-full border-2 border-transparent bg-muted transition-colors group-hover:border-[color:var(--sf-accent)]"><SmartImage src={image} width={300} className="transition-transform duration-500 group-hover:scale-110" /></span>
                    <span className="mt-2 block text-sm font-bold">{group.name}</span>
                  </button>
                ) : b.estilo === "lista" ? (
                  <button key={group.name} type="button" onClick={() => pickCategory(group.name)} className="group text-left">
                    <span className="relative block aspect-square overflow-hidden bg-muted" style={{ borderRadius: "var(--sf-radius)" }}><SmartImage src={image} width={500} className="transition-transform duration-700 group-hover:scale-105" /></span>
                    <span className="mt-3 flex items-baseline justify-between text-sm font-bold">{group.name}<span className="font-normal opacity-60">{group.items.length}</span></span>
                  </button>
                ) : (
                  <button key={group.name} type="button" onClick={() => pickCategory(group.name)} className="group relative aspect-[4/5] overflow-hidden bg-muted text-left sm:aspect-[3/4]" style={{ borderRadius: "var(--sf-radius)" }}>
                    <SmartImage src={image} width={500} className="transition-transform duration-700 group-hover:scale-105" />
                    <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
                    <span className="absolute inset-x-0 bottom-0 p-4 text-white"><span className="block text-lg font-extrabold leading-tight">{group.name}</span><span className="text-xs opacity-85">{group.items.length} {group.items.length === 1 ? "producto" : "productos"}</span></span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      }
      case "productos": {
        const list = b.fuente === "destacados" ? featured : b.fuente === "categoria" ? available.filter((product) => product.categoria === b.categoria) : available;
        if (!list.length) return null;
        return (
          <section className={cn("mx-auto px-4 sm:px-6", width, space)}>
            <Titulo>{b.titulo || (b.fuente === "destacados" ? "Destacados" : b.categoria || "Productos")}</Titulo>
            {grid(list.slice(0, b.cantidad), b.columnas)}
          </section>
        );
      }
      case "catalogo": {
        const flat = !category && visible.length <= 12 && !d.descripcion;
        const filters = b.filtros && allGroups.length > 1 && (
          <div className={cn("scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0", centered && "sm:justify-center")}>
            {[{ name: null as string | null, label: "Todo" }, ...allGroups.map((group) => ({ name: group.name as string | null, label: group.name }))].map((item) => {
              const on = category === item.name;
              return <button key={item.label} type="button" aria-pressed={on} onClick={() => setCategory(item.name)} className={cn("shrink-0 border px-4 py-1.5 text-sm font-bold transition-colors", !on && "hover:bg-muted/60")} style={{ borderRadius: d.radio === "cuadrado" ? 0 : 9999, ...(on ? { ...accent, borderColor: "var(--sf-accent)" } : {}) }}>{item.label}</button>;
            })}
          </div>
        );
        return (
          <section className={cn("mx-auto px-4 sm:px-6", width, space)}>
            <Titulo id="catalogo">{b.titulo || "Todos los productos"} <span className="ml-1 text-base font-normal opacity-60">({visible.length})</span></Titulo>
            {filters}
            <label className="mb-6 flex h-11 items-center gap-2 border bg-card px-4 text-card-foreground xl:hidden" style={radiusButton}>
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar productos" aria-label="Buscar productos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            {shown.length === 0 && <p className="py-16 text-center opacity-60">No encontramos productos{term ? ` para “${term}”` : ""}.</p>}
            {flat && shown.length > 0 && grid(shown.flatMap((group) => group.items), b.columnas)}
            {!flat && shown.map((group) => (
              <div key={group.name} className="mb-12">
                {(category === null || d.descripcion) && <h3 className="mb-4 flex items-center gap-4 text-xl font-bold" style={headingStyle}><span>{group.name}</span>{d.descripcion && <span className="h-px flex-1" style={{ background: "var(--sf-accent)", opacity: 0.35 }} />}</h3>}
                {grid(group.items, b.columnas)}
              </div>
            ))}
          </section>
        );
      }
      case "galeria":
        if (!b.imagenes.length) return null;
        return (
          <section className={cn("mx-auto px-4 sm:px-6", width, space)}>
            {b.titulo && <Titulo>{b.titulo}</Titulo>}
            <div className={cn("grid gap-3 sm:gap-4", b.columnas === 2 ? "grid-cols-2" : b.columnas === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3")}>
              {b.imagenes.map((image) => (
                <figure key={image.url}>
                  <div className="aspect-square overflow-hidden bg-muted" style={{ borderRadius: "var(--sf-radius)" }}><img src={image.url} alt={image.texto ?? ""} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" /></div>
                  {image.texto && <figcaption className="mt-2 text-sm opacity-70">{image.texto}</figcaption>}
                </figure>
              ))}
            </div>
          </section>
        );
      case "confianza":
        if (!b.items.length) return null;
        return (
          <section className={cn("mx-auto px-4 sm:px-6", width, space)}>
            <div className={cn("grid gap-4", b.items.length === 1 ? "" : b.items.length === 2 ? "sm:grid-cols-2" : b.items.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2 lg:grid-cols-4")}>
              {b.items.map((item) => {
                const Icon = ICONOS[item.icono];
                return (
                  <div key={item.titulo} className="flex items-start gap-4 border bg-card p-5 text-card-foreground" style={{ borderRadius: "var(--sf-radius)" }}>
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={accent}><Icon className="h-5 w-5" /></span>
                    <div><p className="font-extrabold">{item.titulo}</p>{item.texto && <p className="mt-0.5 text-sm text-muted-foreground">{item.texto}</p>}</div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      case "faq":
        if (!b.items.length) return null;
        return (
          <section className={cn("mx-auto px-4 sm:px-6", width, space)}>
            <div className="mx-auto max-w-3xl">
              <Titulo>{b.titulo || "Preguntas frecuentes"}</Titulo>
              <div className="space-y-3">
                {b.items.map((item) => (
                  <details key={item.p} className="group border bg-card p-4 text-card-foreground" style={{ borderRadius: "var(--sf-radius)" }}>
                    <summary className="cursor-pointer list-none font-bold marker:hidden">{item.p}<span className="float-right transition-transform group-open:rotate-45" aria-hidden>＋</span></summary>
                    <p className="mt-2 text-muted-foreground">{item.r}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        );
      case "opiniones": {
        const list = reviews.filter((review) => review.comentario);
        if (!theme.mostrar_opiniones || !list.length) return null;
        return (
          <section className={cn("mx-auto px-4 sm:px-6", width, space)}>
            <Titulo>{b.titulo || "Lo que dicen nuestros clientes"}</Titulo>
            <ul className="grid gap-4 md:grid-cols-3">
              {list.slice(0, 3).map((review) => (
                <li key={review.id} className="border bg-card p-5 text-card-foreground" style={{ borderRadius: "var(--sf-radius)" }}>
                  <p className="flex gap-0.5">{Array.from({ length: 5 }, (_, n) => <Star key={n} className={cn("h-4 w-4", n < review.puntaje ? "fill-warning text-warning" : "text-muted-foreground/30")} />)}</p>
                  <p className="mt-3 text-muted-foreground">“{review.comentario}”</p>
                  <p className="mt-3 text-sm font-bold">{review.cliente?.nombre?.split(" ")[0] || "Cliente"}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      }
      case "contacto":
        return (
          <section id="contacto" className={cn("mx-auto scroll-mt-24 px-4 sm:px-6", width, space)}>
            <Titulo>{b.titulo || "Contacto y horarios"}</Titulo>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="border bg-card p-5 text-card-foreground" style={{ borderRadius: "var(--sf-radius)" }}>
                <p className="flex items-center gap-2 font-extrabold"><MapPin className="h-5 w-5" style={{ color: "var(--sf-accent)" }} />Dónde estamos</p>
                <p className="mt-2 text-muted-foreground">{store.direccion}</p>
                {!preview && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.nombre} ${store.direccion}`)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline-offset-4 hover:underline">Cómo llegar<ArrowRight className="h-4 w-4" /></a>}
              </div>
              <div className="border bg-card p-5 text-card-foreground" style={{ borderRadius: "var(--sf-radius)" }}>
                <p className="flex items-center gap-2 font-extrabold"><Clock3 className="h-5 w-5" style={{ color: "var(--sf-accent)" }} />Horarios</p>
                <p className="mt-2 text-muted-foreground">{scheduleSummary(store.horarios) || "Consultanos por WhatsApp"}</p>
              </div>
              <div className="border bg-card p-5 text-card-foreground" style={{ borderRadius: "var(--sf-radius)" }}>
                <p className="flex items-center gap-2 font-extrabold"><MessageCircle className="h-5 w-5" style={{ color: "var(--sf-accent)" }} />Hablemos</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {social.length === 0 && <span className="text-muted-foreground">Pedí directo desde la tienda.</span>}
                  {social.map(({ href, label, icon: Icon }) => <a key={label} href={preview ? undefined : href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"><Icon className="h-4 w-4" />{label}</a>)}
                </div>
              </div>
            </div>
          </section>
        );
      case "separador":
        return <div className={cn("mx-auto px-4 sm:px-6", width)}><div className={cn(ALTO_SEP[b.alto], "flex items-center")}>{b.linea && <hr className="w-full border-current opacity-15" />}</div></div>;
      default:
        return null;
    }
  };

  // ---- encabezado y navegación
  const bloques = theme.bloques.filter((b) => b.visible);
  const hasColecciones = bloques.some((b) => b.tipo === "colecciones") && allGroups.length >= 2;
  const navLinks = [
    hasColecciones && { id: "colecciones", label: "Colecciones" },
    { id: "catalogo", label: "Productos" },
    bloques.some((b) => b.tipo === "texto" && b.id === "acerca") && { id: "acerca", label: "Nosotros" },
    bloques.some((b) => b.tipo === "contacto") && { id: "contacto", label: "Contacto" },
  ].filter(Boolean) as { id: string; label: string }[];
  const brand = <span className="flex min-w-0 items-center gap-3"><StoreLogo store={store} className={cn("h-10 w-10 shrink-0 text-sm", d.radio === "cuadrado" && "!rounded-none")} /><span className={cn("truncate text-lg font-extrabold", centered && "uppercase tracking-[0.18em] text-sm font-semibold")} style={headingStyle}>{store.nombre}</span></span>;
  const navigation = <nav className="hidden items-center gap-1 lg:flex" aria-label="Secciones">{navLinks.map((link) => <button key={link.id} type="button" onClick={() => go(link.id)} className="rounded-full px-3 py-1.5 text-sm font-semibold opacity-80 hover:opacity-100">{link.label}</button>)}</nav>;
  const searchBox = (
    <label className="hidden h-10 w-56 items-center gap-2 border bg-background/80 px-3 text-foreground xl:flex" style={radiusButton}>
      <Search className="h-4 w-4 text-muted-foreground" />
      <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar" aria-label="Buscar productos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
    </label>
  );
  const cartClass = "inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-bold";
  const cart = preview
    ? <span className={cartClass} style={{ ...accent, ...radiusButton }}><ShoppingBag className="h-4 w-4" />{cartLabel}</span>
    : <Link to="/app/carrito" className={cartClass} style={{ ...accent, ...radiusButton }}><ShoppingBag className="h-4 w-4" />{cartLabel}</Link>;

  const anuncio = theme.anuncio && <p className="px-4 py-2 text-center text-sm font-semibold" style={accent}>{theme.anuncio}</p>;
  const header = (
    <header className={cn("z-30 border-b bg-card/95 text-card-foreground backdrop-blur", preview ? "relative" : "sticky top-0")}>
      <div className={cn("mx-auto flex h-16 items-center gap-4 px-4 sm:px-6", width, centered && "justify-between")}>
        {centered ? (
          <><div className="flex-1">{navigation}</div>{brand}<div className="flex flex-1 items-center justify-end gap-3">{searchBox}{cart}</div></>
        ) : (
          <>{brand}<div className="mx-auto">{navigation}</div><div className="ml-auto flex items-center gap-3 lg:ml-0">{searchBox}{cart}</div></>
        )}
      </div>
    </header>
  );

  const nombreDe = (tipo: Bloque["tipo"]) => TIPOS_BLOQUE.find((item) => item.tipo === tipo)?.nombre ?? tipo;

  return (
    <div style={pageStyle} className={cn("min-h-screen bg-background text-foreground", darkPage && "dark")}>
      {anuncio}
      {header}

      {unavailable && (
        <p className={cn("mx-auto mt-6 rounded-2xl bg-muted px-4 py-3 text-sm text-foreground sm:mx-6 lg:mx-auto", width)}>
          {!open ? <><span className="font-extrabold">Cerrado ahora.</span> {store.esta_abierto ? nextOpening(store.horarios) || "" : "El local pausó los pedidos por un rato."} Podés mirar los productos igual.</> : <><span className="font-extrabold">No llega a tu dirección.</span> Elegí otra dirección para pedir.</>}
        </p>
      )}

      <main className="pb-28">
        {bloques.map((bloque) => {
          const content = renderBloque(bloque);
          if (!content) return null;
          const selected = selectedBlock === bloque.id;
          return (
            <div key={bloque.id} id={`bloque-${bloque.id}`} data-bloque={bloque.id} className="relative" {...(bloque.tipo === "colecciones" ? { "data-ancla": "colecciones" } : {})}>
              {bloque.tipo === "colecciones" && <span id="colecciones" className="absolute -top-20" aria-hidden />}
              {content}
              {onSelectBlock && (
                <button type="button" aria-label={`Editar ${nombreDe(bloque.tipo)}`} onClick={() => onSelectBlock(bloque.id)}
                  className={cn("group absolute inset-0 z-20 cursor-pointer outline-none transition-colors", selected ? "bg-brand-orange/5 ring-4 ring-inset ring-brand-orange" : "hover:bg-brand-orange/5 hover:ring-2 hover:ring-inset hover:ring-brand-orange/70")}>
                  <span className={cn("absolute left-3 top-3 rounded-md bg-brand-orange px-2 py-1 text-xs font-bold text-white shadow", selected ? "opacity-100" : "opacity-0 transition-opacity group-hover:opacity-100")}>{nombreDe(bloque.tipo)}</span>
                </button>
              )}
            </div>
          );
        })}
      </main>

      <footer className="mt-4 border-t bg-card text-card-foreground">
        <div className={cn("mx-auto flex flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6", width)}>
          <p className="font-semibold text-foreground">{store.nombre}</p>
          <p className="inline-flex items-center gap-1.5"><StoreIcon className="h-4 w-4" />Tienda online creada en Woref</p>
          {!preview && <Link to={`/app/tienda/${store.slug}`} className="font-semibold hover:text-foreground">Ver en la app de Woref</Link>}
        </div>
      </footer>

      {!preview && itemCount > 0 && (
        <Link to="/app/carrito" className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between px-5 py-3.5 font-bold shadow-pop md:hidden" style={{ ...accent, ...radiusButton }}>
          <span className="inline-flex items-center gap-2"><ShoppingBag className="h-5 w-5" />Ver mi pedido ({itemCount})</span>
          <span>{money(subtotal)}</span>
        </Link>
      )}
    </div>
  );
}

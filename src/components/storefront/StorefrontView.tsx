import { CSSProperties, ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bike, Clock3, Globe, Instagram, MapPin, MessageCircle, Search, ShoppingBag, Star, Store as StoreIcon } from "lucide-react";
import { ProductCard } from "@/components/delivery/ProductCard";
import { SmartImage } from "@/components/delivery/SmartImage";
import { deliveryFeeLabel, StoreLogo } from "@/components/delivery/StoreCard";
import { CartStore, useCart } from "@/contexts/CartContext";
import { useAddressPoint } from "@/hooks/useAddressPoint";
import { useTariff } from "@/hooks/useTariff";
import { DeliveryProduct, DeliverySection, DeliveryStore, isOpenNow, money, nextOpening, orderSections, scheduleSummary } from "@/lib/delivery";
import { storeReach } from "@/lib/geo";
import { normalizeTheme, Plantilla, readableOn, Seccion, TemaNormalizado, whatsappLink } from "@/lib/storefront";
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
};

type Group = { name: string; items: DeliveryProduct[] };

/** Forma de cada plantilla: esquinas, proporción de las fotos y grilla del catálogo. */
const SHAPE: Record<Plantilla, { radius: string; aspect: string; grid: string }> = {
  boutique: { radius: "0.75rem", aspect: "4 / 5", grid: "grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4" },
  galeria: { radius: "0px", aspect: "3 / 4", grid: "grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 md:gap-x-10 md:gap-y-14" },
  impacto: { radius: "1.75rem", aspect: "1 / 1", grid: "grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4" },
  gourmet: { radius: "1rem", aspect: "1 / 1", grid: "grid-cols-1 gap-x-8 md:grid-cols-2" },
};

const scrollToId = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

/** Tienda online de un comercio: la misma pantalla para el sitio público y la vista previa del editor. */
export function StorefrontView({ store, tema, products, sections: sectionConfig, reviews = [], preview = false }: Props) {
  const theme = useMemo(() => tema ?? normalizeTheme(store.tienda_tema), [tema, store.tienda_tema]);
  const { itemCount, subtotal } = useCart();
  const point = useAddressPoint();
  const tariff = useTariff(point);
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const tpl = theme.plantilla;
  const shape = SHAPE[tpl];
  const open = isOpenNow(store);
  const reach = storeReach(store, point, undefined, tariff);
  const unavailable = !open || !reach.inZone;
  const fee = deliveryFeeLabel(store, reach.fee);
  const cartStore: CartStore = { id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio, pedido_minimo: store.pedido_minimo, envio_gratis_desde: store.envio_gratis_desde, imagen_url: store.imagen_url };

  const onAccent = readableOn(theme.color);
  const serif = theme.tipografia === "serif" || tpl === "gourmet";
  const style = {
    "--sf-accent": theme.color,
    "--sf-on-accent": onAccent,
    "--sf-radius": shape.radius,
    "--sf-aspect": shape.aspect,
    fontFamily: serif ? "Georgia, 'Times New Roman', serif" : undefined,
  } as CSSProperties;
  const accent: CSSProperties = { background: "var(--sf-accent)", color: "var(--sf-on-accent)" };

  const visible = useMemo(() => {
    const value = term.trim().toLowerCase();
    return products.filter((product) => product.disponible !== false && (!value || `${product.nombre} ${product.descripcion || ""}`.toLowerCase().includes(value)));
  }, [products, term]);
  const groups: Group[] = useMemo(() => orderSections(visible, sectionConfig, true)
    .map(({ name }) => ({ name, items: visible.filter((product) => product.categoria === name) }))
    .filter((group) => group.items.length > 0), [visible, sectionConfig]);
  const allGroups: Group[] = useMemo(() => {
    const available = products.filter((product) => product.disponible !== false);
    return orderSections(available, sectionConfig, true)
      .map(({ name }) => ({ name, items: available.filter((product) => product.categoria === name) }))
      .filter((group) => group.items.length > 0);
  }, [products, sectionConfig]);
  const shown = category ? groups.filter((group) => group.name === category) : groups;
  const featured = visible.filter((product) => product.destacado);
  const flat = !category && visible.length <= 12 && tpl !== "gourmet";

  const title = theme.titulo || store.nombre;
  const subtitle = theme.subtitulo || store.descripcion || "";
  const rated = theme.mostrar_opiniones && store.total_resenas > 0;
  const cta = theme.boton || (tpl === "impacto" ? "Pedir ahora" : tpl === "galeria" ? "Explorar" : "Ver productos");
  const hero = theme.banner_url || store.imagen_url;
  const social = [
    theme.whatsapp && { href: whatsappLink(theme.whatsapp, store.nombre), label: "WhatsApp", icon: MessageCircle },
    theme.instagram && { href: `https://instagram.com/${theme.instagram}`, label: "Instagram", icon: Instagram },
    theme.facebook && { href: `https://facebook.com/${theme.facebook}`, label: "Facebook", icon: Globe },
    theme.web && { href: theme.web, label: "Sitio web", icon: Globe },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe }[];

  const active = theme.secciones.filter((id) => {
    if (id === "categorias") return allGroups.length >= 2;
    if (id === "destacados") return featured.length > 0 && !category && !term;
    if (id === "acerca") return !!theme.acerca;
    if (id === "opiniones") return theme.mostrar_opiniones && reviews.some((review) => review.comentario);
    return true;
  });

  const go = (id: string) => { if (!preview) scrollToId(id); };
  const pickCategory = (name: string | null) => { setCategory(name); if (!preview) setTimeout(() => scrollToId("catalogo"), 30); };
  const cartLabel = itemCount > 0 ? `${itemCount} · ${money(subtotal)}` : "Mi pedido";
  const cartButton = (className?: string) => {
    const base = cn("inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-4 py-2 text-sm font-bold", tpl === "galeria" ? "rounded-none uppercase tracking-wider" : "rounded-full", className);
    const content = <><ShoppingBag className="h-4 w-4" />{cartLabel}</>;
    return preview ? <span className={base} style={tpl === "impacto" ? { background: "#fff", color: "var(--sf-accent)" } : accent}>{content}</span> : <Link to="/app/carrito" className={base} style={tpl === "impacto" ? { background: "#fff", color: "var(--sf-accent)" } : accent}>{content}</Link>;
  };

  const navLinks = [
    active.includes("categorias") && { id: "colecciones", label: "Colecciones" },
    { id: "catalogo", label: tpl === "gourmet" ? "Carta" : "Productos" },
    active.includes("acerca") && { id: "acerca", label: "Nosotros" },
    active.includes("contacto") && { id: "contacto", label: "Contacto" },
  ].filter(Boolean) as { id: string; label: string }[];

  const info = [
    { icon: Clock3, label: "Entrega", value: `${store.tiempo_min}-${store.tiempo_max} min` },
    { icon: Bike, label: "Envío", value: fee.replace("Envío ", "") },
    { icon: ShoppingBag, label: "Pedido mínimo", value: Number(store.pedido_minimo) > 0 ? money(store.pedido_minimo) : "Sin mínimo" },
    ...(rated ? [{ icon: Star, label: `${store.total_resenas} opiniones`, value: Number(store.rating).toFixed(1) }] : []),
  ];
  const status = (
    <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
      <span className={cn("h-2 w-2 rounded-full", open ? "bg-emerald-400" : "bg-red-400")} />{open ? "Abierto ahora" : "Cerrado"}
    </span>
  );

  // ---- Encabezado ----
  const brand = (
    <span className="flex min-w-0 items-center gap-3">
      <StoreLogo store={store} className={cn("h-10 w-10 shrink-0 text-sm", tpl === "galeria" && "!rounded-none")} />
      <span className={cn("truncate font-extrabold", tpl === "galeria" ? "text-sm font-semibold uppercase tracking-[0.2em]" : "text-lg")}>{store.nombre}</span>
    </span>
  );
  const navigation = (
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Secciones">
      {navLinks.map((link) => <button key={link.id} type="button" onClick={() => go(link.id)} className="rounded-full px-3 py-1.5 text-sm font-semibold opacity-80 hover:opacity-100">{link.label}</button>)}
    </nav>
  );
  const searchBox = (
    <label className={cn("hidden h-10 w-56 items-center gap-2 border bg-background/90 px-3 text-foreground xl:flex", tpl === "galeria" ? "rounded-none" : "rounded-full")}>
      <Search className="h-4 w-4 text-muted-foreground" />
      <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar" aria-label="Buscar productos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
    </label>
  );
  const header = (
    <header className={cn("z-30 border-b backdrop-blur", preview ? "relative" : "sticky top-0", tpl === "impacto" ? "border-transparent" : "bg-card/95")} style={tpl === "impacto" ? accent : undefined}>
      <div className={cn("mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6", tpl === "galeria" && "justify-between")}>
        {tpl === "galeria" ? (
          <>
            <div className="flex-1">{navigation}</div>
            {brand}
            <div className="flex flex-1 items-center justify-end gap-3">{searchBox}{cartButton()}</div>
          </>
        ) : (
          <>
            {brand}
            <div className="mx-auto">{navigation}</div>
            <div className="ml-auto flex items-center gap-3 lg:ml-0">{searchBox}{cartButton()}</div>
          </>
        )}
      </div>
    </header>
  );

  // ---- Portadas ----
  const heroButtons = (
    <div className="mt-6 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => go("catalogo")} className={cn("inline-flex items-center gap-2 px-6 py-3 text-base font-bold", tpl === "galeria" ? "rounded-none text-sm uppercase tracking-wider" : "rounded-full")} style={tpl === "impacto" ? { background: "#fff", color: "var(--sf-accent)" } : accent}>
        {cta}<ArrowRight className="h-4 w-4" />
      </button>
      {theme.whatsapp && !preview && <a href={whatsappLink(theme.whatsapp, store.nombre)} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-2 border px-5 py-3 text-base font-semibold", tpl === "galeria" ? "rounded-none" : "rounded-full", (tpl === "boutique" || tpl === "impacto") && "border-white/60 text-white")}><MessageCircle className="h-4 w-4" />WhatsApp</a>}
    </div>
  );

  const heroBlock: ReactNode = tpl === "boutique" ? (
    <>
      <section className="relative isolate overflow-hidden bg-[hsl(220_14%_16%)] text-white">
        <div className="absolute inset-0 -z-10"><SmartImage src={hero} width={1600} loading="eager" /></div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
        <div className="mx-auto flex min-h-[420px] max-w-6xl flex-col justify-end px-4 pb-12 pt-24 sm:min-h-[560px] sm:px-6 sm:pb-16">
          <div className="mb-4 opacity-90">{status}</div>
          <h1 className="max-w-3xl text-4xl font-black leading-[1.02] sm:text-7xl">{title}</h1>
          {subtitle && <p className="mt-4 max-w-xl text-base text-white/85 sm:text-xl">{subtitle}</p>}
          {heroButtons}
        </div>
      </section>
      <div className="relative z-10 mx-auto -mt-8 max-w-6xl px-4 sm:px-6">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border shadow-pop sm:grid-cols-4">
          {info.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 bg-card p-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={accent}><Icon className="h-5 w-5" /></span><div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-extrabold">{value}</dd></div></div>
          ))}
        </dl>
      </div>
    </>
  ) : tpl === "galeria" ? (
    <section className="mx-auto max-w-6xl px-4 pt-12 text-center sm:px-6 sm:pt-20">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">{store.rubro || "Tienda online"}</p>
      <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-light leading-[1.05] tracking-tight sm:text-7xl">{title}</h1>
      {subtitle && <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">{subtitle}</p>}
      <div className="mx-auto mt-8 h-px w-20" style={{ background: "var(--sf-accent)" }} />
      <div className="relative mt-10 aspect-[16/9] overflow-hidden bg-muted sm:aspect-[21/9]"><SmartImage src={hero} width={1600} loading="eager" /></div>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{status}</span>
        {info.map(({ label, value }) => <span key={label}>{label}: <span className="font-semibold text-foreground">{value}</span></span>)}
      </div>
      <div className="mt-6 flex justify-center"><button type="button" onClick={() => go("catalogo")} className="inline-flex items-center gap-2 border px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] transition-colors hover:bg-[color:var(--sf-accent)] hover:text-[color:var(--sf-on-accent)]" style={{ borderColor: "var(--sf-accent)" }}>{cta}</button></div>
    </section>
  ) : tpl === "impacto" ? (
    <section className="mx-auto max-w-6xl px-4 pt-5 sm:px-6">
      <div className="relative overflow-hidden rounded-[2rem] p-6 sm:rounded-[2.5rem] sm:p-12" style={accent}>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
        <div className="relative grid items-center gap-8 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <div className="mb-4 inline-flex rounded-full bg-white/15 px-3 py-1">{status}</div>
            <h1 className="text-[2.6rem] font-black leading-[0.98] tracking-tight sm:text-7xl">{title}</h1>
            {subtitle && <p className="mt-4 max-w-lg text-base opacity-90 sm:text-xl">{subtitle}</p>}
            {heroButtons}
            <div className="mt-6 flex flex-wrap gap-2">{info.map(({ icon: Icon, label, value }) => <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-sm font-semibold"><Icon className="h-4 w-4" />{value}<span className="hidden font-normal opacity-80 sm:inline"> {label.toLowerCase()}</span></span>)}</div>
          </div>
          <div className="relative hidden aspect-[4/3] rotate-2 overflow-hidden rounded-[2rem] bg-black/10 shadow-pop lg:block"><SmartImage src={hero} width={900} loading="eager" /></div>
        </div>
      </div>
    </section>
  ) : (
    <section className="mx-auto max-w-6xl px-4 pt-8 sm:px-6 sm:pt-14">
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
        <div className="text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.3em]" style={{ color: "var(--sf-accent)" }}>{store.rubro || "Cocina de la casa"}</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.05] sm:text-6xl">{title}</h1>
          <div className="mx-auto mt-5 flex items-center gap-3 lg:mx-0"><span className="h-px w-12" style={{ background: "var(--sf-accent)" }} /><span className="text-lg" style={{ color: "var(--sf-accent)" }}>✦</span><span className="h-px w-12" style={{ background: "var(--sf-accent)" }} /></div>
          {subtitle && <p className="mx-auto mt-5 max-w-lg text-lg italic text-muted-foreground lg:mx-0">{subtitle}</p>}
          <ul className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground lg:justify-start">
            <li className="font-semibold text-foreground">{status}</li>
            {info.slice(0, 3).map(({ icon: Icon, value }) => <li key={value} className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4" />{value}</li>)}
          </ul>
          <div className="flex justify-center lg:justify-start">{heroButtons}</div>
        </div>
        <div className="relative mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-b-3xl rounded-t-[999px] bg-muted shadow-pop lg:max-w-none"><SmartImage src={hero} width={900} loading="eager" /></div>
      </div>
    </section>
  );

  // ---- Secciones ----
  const sectionTitle = (text: string, id?: string, count?: number) => (
    <div id={id} className={cn("scroll-mt-24", tpl === "galeria" || tpl === "gourmet" ? "mb-8 text-center" : "mb-5")}>
      {tpl === "gourmet" && <p className="mb-2 text-lg" style={{ color: "var(--sf-accent)" }}>✦</p>}
      <h2 className={cn("font-extrabold", tpl === "galeria" ? "text-xs font-semibold uppercase tracking-[0.3em]" : "text-2xl sm:text-3xl", tpl === "gourmet" && "text-3xl font-bold")}>{text}{count !== undefined && <span className="ml-2 text-base font-normal text-muted-foreground">({count})</span>}</h2>
      {tpl === "galeria" && <div className="mx-auto mt-3 h-px w-10" style={{ background: "var(--sf-accent)" }} />}
    </div>
  );

  const grid = (items: DeliveryProduct[]) => (
    <div className={cn("grid", shape.grid)}>
      {items.map((product) => <ProductCard key={product.id} product={product} store={cartStore} disabled={unavailable} variant={tpl === "gourmet" ? "row" : "shop"} />)}
    </div>
  );

  const filters = (
    <div className={cn("scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0", (tpl === "galeria" || tpl === "gourmet") && "sm:justify-center")}>
      {[{ name: null as string | null, label: "Todo" }, ...allGroups.map((group) => ({ name: group.name as string | null, label: group.name }))].map((item) => {
        const on = category === item.name;
        return tpl === "galeria"
          ? <button key={item.label} type="button" aria-pressed={on} onClick={() => setCategory(item.name)} className={cn("shrink-0 border-b-2 px-1 pb-1 text-xs font-semibold uppercase tracking-[0.2em] transition-colors", on ? "" : "border-transparent text-muted-foreground hover:text-foreground")} style={on ? { borderColor: "var(--sf-accent)" } : undefined}>{item.label}</button>
          : <button key={item.label} type="button" aria-pressed={on} onClick={() => setCategory(item.name)} className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm font-bold transition-colors", !on && "hover:bg-muted")} style={on ? { ...accent, borderColor: "var(--sf-accent)" } : undefined}>{item.label}</button>;
      })}
    </div>
  );

  const renderSection = (id: Seccion): ReactNode => {
    switch (id) {
      case "categorias":
        return (
          <section key={id} className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
            {sectionTitle("Colecciones", "colecciones")}
            <div className={cn("grid gap-3 sm:gap-5", tpl === "gourmet" ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : "grid-cols-2 md:grid-cols-4")}>
              {allGroups.slice(0, tpl === "gourmet" ? 6 : 8).map((group) => {
                const image = group.items.find((product) => product.imagen_url)?.imagen_url;
                return tpl === "gourmet" ? (
                  <button key={group.name} type="button" onClick={() => pickCategory(group.name)} className="group text-center">
                    <span className="relative mx-auto block aspect-square w-full max-w-[140px] overflow-hidden rounded-full border-2 border-transparent bg-muted transition-colors group-hover:border-[color:var(--sf-accent)]"><SmartImage src={image} width={300} className="transition-transform duration-500 group-hover:scale-110" /></span>
                    <span className="mt-2 block text-sm font-bold">{group.name}</span>
                  </button>
                ) : tpl === "galeria" ? (
                  <button key={group.name} type="button" onClick={() => pickCategory(group.name)} className="group text-left">
                    <span className="relative block aspect-square overflow-hidden bg-muted"><SmartImage src={image} width={500} className="transition-transform duration-700 group-hover:scale-105" /></span>
                    <span className="mt-3 flex items-baseline justify-between text-xs font-semibold uppercase tracking-[0.2em]">{group.name}<span className="font-normal text-muted-foreground">{group.items.length}</span></span>
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
      case "destacados":
        return (
          <section key={id} className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
            {sectionTitle("Destacados")}
            {grid(featured.slice(0, 4))}
          </section>
        );
      case "catalogo":
        return (
          <section key={id} className="mx-auto max-w-6xl px-4 pt-14 sm:px-6">
            {sectionTitle(tpl === "gourmet" ? "Nuestra carta" : "Todos los productos", "catalogo", visible.length)}
            {allGroups.length > 1 && filters}
            <label className="mb-6 flex h-11 items-center gap-2 rounded-full border bg-card px-4 xl:hidden">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar productos" aria-label="Buscar productos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            {shown.length === 0 && <p className="py-16 text-center text-muted-foreground">No encontramos productos{term ? ` para “${term}”` : ""}.</p>}
            {flat && shown.length > 0 && grid(shown.flatMap((group) => group.items))}
            {!flat && shown.map((group) => (
              <div key={group.name} className="mb-12">
                {(category === null || tpl === "gourmet") && (
                  tpl === "gourmet"
                    ? <h3 className="mb-5 flex items-center gap-4 text-2xl font-bold"><span>{group.name}</span><span className="h-px flex-1" style={{ background: "var(--sf-accent)", opacity: 0.35 }} /></h3>
                    : <h3 className={cn("mb-4 font-extrabold", tpl === "galeria" ? "text-xs uppercase tracking-[0.25em] text-muted-foreground" : "text-xl")}>{group.name}</h3>
                )}
                {grid(group.items)}
              </div>
            ))}
          </section>
        );
      case "acerca":
        return (
          <section key={id} id="acerca" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-16 sm:px-6">
            <div className={cn("grid items-center gap-8", tpl === "boutique" || tpl === "impacto" ? "lg:grid-cols-2" : "mx-auto max-w-2xl text-center")}>
              {(tpl === "boutique" || tpl === "impacto") && <div className="relative aspect-[4/3] overflow-hidden bg-muted" style={{ borderRadius: "var(--sf-radius)" }}><SmartImage src={store.imagen_url || hero} width={900} /></div>}
              <div className={cn(tpl === "impacto" && "rounded-[2rem] p-8 sm:p-10")} style={tpl === "impacto" ? { background: "color-mix(in srgb, var(--sf-accent) 10%, transparent)" } : undefined}>
                {sectionTitle("Sobre nosotros")}
                <p className="whitespace-pre-line text-lg leading-relaxed text-muted-foreground">{theme.acerca}</p>
              </div>
            </div>
          </section>
        );
      case "opiniones":
        return (
          <section key={id} className="mx-auto max-w-6xl px-4 pt-16 sm:px-6">
            {sectionTitle("Lo que dicen nuestros clientes")}
            <ul className="grid gap-4 md:grid-cols-3">
              {reviews.filter((review) => review.comentario).slice(0, 3).map((review) => (
                <li key={review.id} className="border bg-card p-5" style={{ borderRadius: "var(--sf-radius)" }}>
                  <p className="flex gap-0.5">{Array.from({ length: 5 }, (_, n) => <Star key={n} className={cn("h-4 w-4", n < review.puntaje ? "fill-warning text-warning" : "text-muted-foreground/30")} />)}</p>
                  <p className="mt-3 text-muted-foreground">“{review.comentario}”</p>
                  <p className="mt-3 text-sm font-bold">{review.cliente?.nombre?.split(" ")[0] || "Cliente"}</p>
                </li>
              ))}
            </ul>
          </section>
        );
      case "contacto":
        return (
          <section key={id} id="contacto" className="mx-auto max-w-6xl scroll-mt-24 px-4 pt-16 sm:px-6">
            {sectionTitle("Contacto y horarios")}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="border bg-card p-5" style={{ borderRadius: "var(--sf-radius)" }}>
                <p className="flex items-center gap-2 font-extrabold"><MapPin className="h-5 w-5" style={{ color: "var(--sf-accent)" }} />Dónde estamos</p>
                <p className="mt-2 text-muted-foreground">{store.direccion}</p>
                {!preview && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${store.nombre} ${store.direccion}`)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-bold underline-offset-4 hover:underline">Cómo llegar<ArrowRight className="h-4 w-4" /></a>}
              </div>
              <div className="border bg-card p-5" style={{ borderRadius: "var(--sf-radius)" }}>
                <p className="flex items-center gap-2 font-extrabold"><Clock3 className="h-5 w-5" style={{ color: "var(--sf-accent)" }} />Horarios</p>
                <p className="mt-2 text-muted-foreground">{scheduleSummary(store.horarios) || "Consultanos por WhatsApp"}</p>
              </div>
              <div className="border bg-card p-5" style={{ borderRadius: "var(--sf-radius)" }}>
                <p className="flex items-center gap-2 font-extrabold"><MessageCircle className="h-5 w-5" style={{ color: "var(--sf-accent)" }} />Hablemos</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  {social.length === 0 && <span className="text-muted-foreground">Pedí directo desde la tienda.</span>}
                  {social.map(({ href, label, icon: Icon }) => <a key={label} href={preview ? undefined : href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"><Icon className="h-4 w-4" />{label}</a>)}
                </div>
              </div>
            </div>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <div style={style} data-tpl={tpl} className="min-h-screen bg-background text-foreground">
      {theme.anuncio && <p className="px-4 py-2 text-center text-sm font-semibold" style={tpl === "impacto" ? { background: "#111", color: "#fff" } : accent}>{theme.anuncio}</p>}
      {header}
      {heroBlock}

      {unavailable && (
        <p className="mx-auto mt-6 max-w-6xl rounded-2xl bg-muted px-4 py-3 text-sm sm:mx-6 lg:mx-auto">
          {!open ? <><span className="font-extrabold">Cerrado ahora.</span> {store.esta_abierto ? nextOpening(store.horarios) || "" : "El local pausó los pedidos por un rato."} Podés mirar los productos igual.</> : <><span className="font-extrabold">No llega a tu dirección.</span> Elegí otra dirección para pedir.</>}
        </p>
      )}

      <main className="pb-28">{active.map(renderSection)}</main>

      <footer className="mt-4 border-t bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
          <p className="font-semibold text-foreground">{store.nombre}</p>
          <p className="inline-flex items-center gap-1.5"><StoreIcon className="h-4 w-4" />Tienda online creada en Woref</p>
          {!preview && <Link to={`/app/tienda/${store.slug}`} className="font-semibold hover:text-foreground">Ver en la app de Woref</Link>}
        </div>
      </footer>

      {!preview && itemCount > 0 && (
        <Link to="/app/carrito" className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-full px-5 py-3.5 font-bold shadow-pop md:hidden" style={accent}>
          <span className="inline-flex items-center gap-2"><ShoppingBag className="h-5 w-5" />Ver mi pedido ({itemCount})</span>
          <span>{money(subtotal)}</span>
        </Link>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { StorefrontView } from "@/components/storefront/StorefrontView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage } from "@/lib/delivery";
import { COLORES, normalizeTheme, PLANTILLAS, Plantilla, storefrontPath, storefrontUrl, TiendaTema } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import { useMerchant } from "./context";

/** Dibujo esquemático de cada plantilla para elegirla de un vistazo. */
function Wireframe({ id, color }: { id: Plantilla; color: string }) {
  const block = "rounded-[3px] bg-muted-foreground/25";
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border bg-background p-2" aria-hidden>
      {id === "clasica" && <><div className="h-[38%] rounded-md" style={{ background: color, opacity: 0.85 }} /><div className="mt-2 grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((n) => <div key={n} className={cn("aspect-[4/5]", block)} />)}</div></>}
      {id === "minimal" && <><div className="mx-auto h-4 w-4 rounded-full" style={{ background: color }} /><div className={cn("mx-auto mt-1 h-1.5 w-1/2", block)} /><div className="mt-2 grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((n) => <div key={n} className={cn("aspect-[4/5] !rounded-[1px]", block)} />)}</div></>}
      {id === "moderno" && <><div className="flex h-[42%] items-center gap-1 rounded-xl p-1.5" style={{ background: color }}><div className="h-2 w-1/2 rounded bg-white/70" /><div className="ml-auto h-full w-1/3 rounded-lg bg-white/30" /></div><div className="mt-2 grid grid-cols-4 gap-1">{[0, 1, 2, 3].map((n) => <div key={n} className={cn("aspect-[4/5] !rounded-lg", block)} />)}</div></>}
    </div>
  );
}

/** Editor de la tienda online del comercio: plantilla, color, portada, textos y redes, con vista previa en vivo. */
export default function MerchantStorefront() {
  const { store, products, reviews, loadStore } = useMerchant();
  const [draft, setDraft] = useState<TiendaTema>(() => normalizeTheme(store.tienda_tema));
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sections, setSections] = useState<Awaited<ReturnType<typeof loadSections>>>([]);
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  // Si el comercio cambia (selector de sucursal), se carga el tema de ese comercio.
  useEffect(() => { setDraft(normalizeTheme(store.tienda_tema)); }, [store.id, store.tienda_tema]);
  useEffect(() => { loadSections(store.id).then(setSections); }, [store.id]);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setScale(Math.min(1, element.clientWidth / 1200)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const theme = useMemo(() => normalizeTheme(draft), [draft]);
  const saved = useMemo(() => JSON.stringify(normalizeTheme(store.tienda_tema)), [store.tienda_tema]);
  const dirty = JSON.stringify(theme) !== saved;
  const set = <K extends keyof TiendaTema>(key: K, value: TiendaTema[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const url = storefrontUrl(store.slug);

  const save = async () => {
    setSaving(true);
    const { error } = await db.rpc("delivery_guardar_tienda_tema", { p_comercio: store.id, p_tema: theme });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Tienda actualizada");
    await loadStore();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { toast.info(url); }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
      <div className="space-y-6">
        <section className="rounded-3xl border bg-card p-4 sm:p-5">
          <h2 className="text-lg font-extrabold">Tu tienda online</h2>
          <p className="mt-1 text-sm text-muted-foreground">Un sitio propio para tu comercio dentro de Woref. Compartilo en Instagram, WhatsApp o donde quieras: tus clientes ven tus productos y piden sin instalar nada.</p>
          <div className="mt-4 flex items-center gap-2 rounded-2xl border bg-muted/40 p-2 pl-3 text-sm">
            <span className="min-w-0 flex-1 truncate font-semibold">{url}</span>
            <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-full" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiado" : "Copiar"}</Button>
            <Button asChild size="sm" className="shrink-0 rounded-full"><a href={storefrontPath(store.slug)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Abrir</a></Button>
          </div>
        </section>

        <section className="rounded-3xl border bg-card p-4 sm:p-5">
          <h3 className="font-extrabold">Plantilla</h3>
          <div className="mt-3 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Plantilla">
            {PLANTILLAS.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={theme.plantilla === item.id} onClick={() => set("plantilla", item.id)}
                className={cn("rounded-2xl border-2 p-2 text-left transition-colors", theme.plantilla === item.id ? "border-brand-orange bg-brand-orange/5" : "border-transparent bg-muted/40 hover:bg-muted")}>
                <Wireframe id={item.id} color={theme.color} />
                <span className="mt-2 block text-sm font-bold">{item.nombre}</span>
                <span className="hidden text-[11px] leading-tight text-muted-foreground sm:block">{item.detalle}</span>
              </button>
            ))}
          </div>

          <h3 className="mt-6 font-extrabold">Color de la marca</h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {COLORES.map((color) => (
              <button key={color} type="button" aria-label={`Color ${color}`} aria-pressed={theme.color === color} onClick={() => set("color", color)}
                className={cn("flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow ring-2 transition", theme.color === color ? "ring-brand-orange" : "ring-transparent hover:ring-border")} style={{ background: color }}>
                {theme.color === color && <Check className="h-4 w-4 text-white mix-blend-difference" />}
              </button>
            ))}
            <label className="ml-1 flex items-center gap-2 text-sm font-semibold">
              <input type="color" value={theme.color} onChange={(event) => set("color", event.target.value.toUpperCase())} className="h-9 w-9 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Elegir otro color" />
              <span className="font-mono text-xs text-muted-foreground">{theme.color}</span>
            </label>
          </div>

          <h3 className="mt-6 font-extrabold">Tipografía</h3>
          <div className="mt-3 flex gap-2">
            {([["sans", "Moderna", ""], ["serif", "Elegante", "font-serif"]] as const).map(([id, label, extra]) => (
              <button key={id} type="button" aria-pressed={theme.tipografia === id} onClick={() => set("tipografia", id)}
                className={cn("rounded-full border-2 px-4 py-1.5 text-sm font-bold", extra, theme.tipografia === id ? "border-brand-orange bg-brand-orange/5" : "border-transparent bg-muted/40 hover:bg-muted")}>{label}</button>
            ))}
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
          <h3 className="font-extrabold">Portada y textos</h3>
          <ImageUpload label="Foto de portada (si no subís una, usamos la de tu local)" folder="comercios" value={theme.banner_url} onChange={(value) => set("banner_url", value)} className="max-w-sm" />
          <div className="space-y-1.5"><Label htmlFor="sf-titulo">Título</Label><Input id="sf-titulo" maxLength={80} value={draft.titulo ?? ""} placeholder={store.nombre} onChange={(event) => set("titulo", event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sf-sub">Frase bajo el título</Label><Input id="sf-sub" maxLength={160} value={draft.subtitulo ?? ""} placeholder="Ej.: Pan de masa madre, horneado cada mañana" onChange={(event) => set("subtitulo", event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sf-anuncio">Barra de anuncio (opcional)</Label><Input id="sf-anuncio" maxLength={160} value={draft.anuncio ?? ""} placeholder="Ej.: Envío gratis en compras de más de $20.000" onChange={(event) => set("anuncio", event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="sf-acerca">Sobre nosotros</Label><Textarea id="sf-acerca" maxLength={800} className="min-h-[100px]" value={draft.acerca ?? ""} placeholder="Contá tu historia, qué te hace especial…" onChange={(event) => set("acerca", event.target.value)} /></div>
          <label className="flex items-center justify-between gap-3 rounded-2xl border p-3 text-sm font-semibold">Mostrar calificaciones y opiniones<Switch checked={theme.mostrar_opiniones} onCheckedChange={(value) => set("mostrar_opiniones", value)} /></label>
        </section>

        <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
          <h3 className="font-extrabold">Contacto y redes</h3>
          <div className="space-y-1.5"><Label htmlFor="sf-wa">WhatsApp (con código de país, solo números)</Label><Input id="sf-wa" inputMode="numeric" maxLength={15} value={draft.whatsapp ?? ""} placeholder="5492355123456" onChange={(event) => set("whatsapp", event.target.value.replace(/\D/g, ""))} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="sf-ig">Instagram (usuario)</Label><Input id="sf-ig" maxLength={60} value={draft.instagram ?? ""} placeholder="mi.tienda" onChange={(event) => set("instagram", event.target.value.replace(/[^A-Za-z0-9._-]/g, ""))} /></div>
            <div className="space-y-1.5"><Label htmlFor="sf-fb">Facebook (usuario)</Label><Input id="sf-fb" maxLength={60} value={draft.facebook ?? ""} placeholder="mi.tienda" onChange={(event) => set("facebook", event.target.value.replace(/[^A-Za-z0-9._-]/g, ""))} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="sf-web">Sitio web (https://…)</Label><Input id="sf-web" maxLength={200} value={draft.web ?? ""} placeholder="https://mitienda.com" onChange={(event) => set("web", event.target.value)} /></div>
        </section>

        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-full border bg-card/95 p-2 pl-5 shadow-pop backdrop-blur">
          <span className="text-sm font-semibold text-muted-foreground">{dirty ? "Tenés cambios sin guardar" : "Todo guardado"}</span>
          <Button type="button" className="rounded-full font-bold" onClick={save} disabled={!dirty || saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cambios</Button>
        </div>
      </div>

      <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
        <p className="mb-2 text-sm font-bold text-muted-foreground">Vista previa en vivo</p>
        <div ref={frame} className="overflow-hidden rounded-3xl border bg-background shadow-soft" style={{ height: Math.round(760 * scale) }}>
          <div className="pointer-events-none origin-top-left select-none" style={{ width: 1200, height: 760, transform: `scale(${scale})` }} aria-hidden>
            <div className="h-full overflow-hidden">
              <StorefrontView store={store} tema={theme} products={products} sections={sections} reviews={reviews} preview />
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

async function loadSections(comercioId: string) {
  const { data } = await db.from("delivery_secciones").select("*").eq("comercio_id", comercioId);
  return (data ?? []) as import("@/lib/delivery").DeliverySection[];
}

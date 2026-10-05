import { DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, ExternalLink, Eye, EyeOff, GripVertical, LayoutTemplate, Loader2, Monitor, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BlockSettings } from "@/components/storefront/builder/BlockSettings";
import { DesignPanel, serializarTema } from "@/components/storefront/builder/DesignPanel";
import { Campo, Interruptor, Texto } from "@/components/storefront/builder/fields";
import { PreviewPane } from "@/components/storefront/builder/PreviewPane";
import { QrPoster } from "@/components/storefront/QrPoster";
import { StorefrontStats } from "@/components/storefront/StorefrontStats";
import { TemplateGrid } from "@/components/storefront/TemplatePicker";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db, DeliverySection, errorMessage, orderSections } from "@/lib/delivery";
import { Bloque, bloqueNuevo, bloquesDePlantilla, Diseno, MAX_BLOQUES, nuevoId, normalizeDiseno, normalizeTheme, Plantilla, storefrontPath, storefrontUrl, temaParaGuardar, TemaNormalizado, TIPOS_BLOQUE } from "@/lib/storefront";
import type { VendedorResumen } from "@/lib/marketplace";
import { cn } from "@/lib/utils";
import { useMerchant } from "./context";

const nombreDe = (tipo: Bloque["tipo"]) => TIPOS_BLOQUE.find((item) => item.tipo === tipo)?.nombre ?? tipo;
const resumenDe = (bloque: Bloque) => {
  const r = bloque as unknown as Record<string, unknown>;
  const texto = (r.titulo ?? r.boton ?? "") as string;
  return texto || (bloque.tipo === "galeria" ? `${bloque.imagenes.length} fotos` : bloque.tipo === "confianza" ? `${bloque.items.length} ventajas` : bloque.tipo === "faq" ? `${bloque.items.length} preguntas` : "");
};

function useWide() {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1280px)");
    const on = () => setWide(query.matches);
    query.addEventListener("change", on);
    return () => query.removeEventListener("change", on);
  }, []);
  return wide;
}

/** Constructor de la tienda online: el comercio arma su página con bloques, elige el diseño y ve el resultado al instante. */
export default function MerchantStorefront() {
  const { store, products, reviews, loadStore } = useMerchant();
  const wide = useWide();
  const [draft, setDraft] = useState<TemaNormalizado>(() => normalizeTheme(store.tienda_tema));
  const [sections, setSections] = useState<DeliverySection[]>([]);
  const [vendedor, setVendedor] = useState<VendedorResumen | null>(null);
  const [tab, setTab] = useState("constructor");
  const [openId, setOpenId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [templates, setTemplates] = useState(false);
  const [plantillaElegida, setPlantillaElegida] = useState<Plantilla>("boutique");
  const [phonePreview, setPhonePreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Si el comercio cambia (selector de sucursal), se carga el tema de ese comercio.
  useEffect(() => { setDraft(normalizeTheme(store.tienda_tema)); setOpenId(null); }, [store.id, store.tienda_tema]);
  useEffect(() => {
    let alive = true;
    db.from("delivery_secciones").select("*").eq("comercio_id", store.id).then(({ data }: { data: DeliverySection[] | null }) => { if (alive) setSections(data ?? []); });
    db.rpc("delivery_vendedor_resumen", { p_slug: store.slug }).then(({ data }: { data: VendedorResumen | null }) => { if (alive) setVendedor(data ?? null); });
    return () => { alive = false; };
  }, [store.id, store.slug]);

  const url = storefrontUrl(store.slug);
  const saved = useMemo(() => serializarTema(normalizeTheme(store.tienda_tema)), [store.tienda_tema]);
  const dirty = useMemo(() => serializarTema(draft) !== saved, [draft, saved]);
  const categorias = useMemo(() => orderSections(products, sections, true).map((item) => item.name), [products, sections]);
  const previewData = useMemo(() => ({ store, tema: normalizeTheme(draft), products, sections, reviews, vendedor }), [store, draft, products, sections, reviews, vendedor]);

  // ---- cambios del tema
  const setTema = useCallback((cambios: Partial<TemaNormalizado>) => setDraft((current) => ({ ...current, ...cambios })), []);
  const setDiseno = (cambios: Partial<Diseno> & { color?: string }) => setDraft((current) => {
    const { color, ...resto } = cambios;
    return { ...current, ...(color ? { color } : {}), diseno: { ...current.diseno, ...resto } };
  });
  const setBloques = (fn: (list: Bloque[]) => Bloque[]) => setDraft((current) => ({ ...current, bloques: fn(current.bloques) }));
  const updateBloque = (id: string, cambios: Record<string, unknown>) => setBloques((list) => list.map((item) => (item.id === id ? ({ ...item, ...cambios } as Bloque) : item)));

  const mover = (id: string, direccion: -1 | 1) => setBloques((list) => {
    const index = list.findIndex((item) => item.id === id);
    const target = index + direccion;
    if (index < 0 || target < 0 || target >= list.length) return list;
    const next = [...list];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const duplicar = (id: string) => {
    const original = draft.bloques.find((item) => item.id === id);
    if (!original) return;
    const copia = { ...structuredClone(original), id: nuevoId() } as Bloque;
    setBloques((list) => {
      const index = list.findIndex((item) => item.id === id);
      return [...list.slice(0, index + 1), copia, ...list.slice(index + 1)];
    });
    setOpenId(copia.id);
  };
  const eliminar = (id: string) => { setBloques((list) => list.filter((item) => item.id !== id)); if (openId === id) setOpenId(null); };
  const agregar = (tipo: Bloque["tipo"]) => {
    const nuevo = bloqueNuevo(tipo, draft.plantilla);
    setBloques((list) => {
      const index = openId ? list.findIndex((item) => item.id === openId) : -1;
      const contacto = list.findIndex((item) => item.tipo === "contacto");
      const at = index >= 0 ? index + 1 : contacto >= 0 ? contacto : list.length;
      return [...list.slice(0, at), nuevo, ...list.slice(at)];
    });
    setOpenId(nuevo.id);
    setAdding(false);
    toast.success(`Agregamos "${nombreDe(tipo)}". Editalo en la lista.`);
  };
  const soltar = (event: DragEvent, targetId: string) => {
    event.preventDefault();
    if (dragId && dragId !== targetId) setBloques((list) => {
      const from = list.findIndex((item) => item.id === dragId);
      const to = list.findIndex((item) => item.id === targetId);
      if (from < 0 || to < 0) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
    setDropOn(null);
  };
  const seleccionar = useCallback((id: string) => {
    setTab("constructor");
    setOpenId(id);
    window.setTimeout(() => document.getElementById(`editar-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 60);
  }, []);

  const aplicarPlantilla = () => {
    setDraft((current) => ({
      ...current,
      plantilla: plantillaElegida,
      bloques: bloquesDePlantilla(plantillaElegida, { titulo: current.titulo, subtitulo: current.subtitulo, boton: current.boton, banner_url: current.banner_url, acerca: current.acerca }),
      diseno: normalizeDiseno({}, plantillaElegida, current.tipografia),
    }));
    setOpenId(null);
    setTemplates(false);
    toast.success("Plantilla aplicada. Guardá cuando estés conforme.");
  };

  const save = async () => {
    setSaving(true);
    const { error } = await db.rpc("delivery_guardar_tienda_tema", { p_comercio: store.id, p_tema: temaParaGuardar(normalizeTheme(draft)) });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Tienda guardada y publicada");
    await loadStore();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { toast.info(url); }
  };

  const yaEsta = (tipo: Bloque["tipo"]) => Boolean(TIPOS_BLOQUE.find((item) => item.tipo === tipo)?.unico) && draft.bloques.some((item) => item.tipo === tipo);

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-extrabold">Tu tienda online</h2>
          <p className="text-sm text-muted-foreground">Armala a tu modo: agregá, quitá y ordená bloques, elegí los colores y las letras. Los cambios se ven al instante.</p>
        </div>
        <div className="flex min-w-0 items-center gap-2 rounded-2xl border bg-muted/40 p-2 pl-3 text-sm">
          <span className="min-w-0 flex-1 truncate font-semibold">{url.replace(/^https?:\/\//, "")}</span>
          <Button type="button" size="sm" variant="outline" className="shrink-0 rounded-full" onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "Copiado" : "Copiar"}</Button>
          <Button asChild size="sm" className="shrink-0 rounded-full"><a href={storefrontPath(store.slug)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Abrir</a></Button>
        </div>
      </section>

      <div className={cn("grid gap-6", tab !== "compartir" && "xl:grid-cols-[minmax(0,460px)_1fr]")}>
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <TabsList className="grid h-auto w-full grid-cols-4 rounded-2xl p-1">
            <TabsTrigger value="constructor" className="rounded-xl py-2 font-bold">Bloques</TabsTrigger>
            <TabsTrigger value="diseno" className="rounded-xl py-2 font-bold">Diseño</TabsTrigger>
            <TabsTrigger value="datos" className="rounded-xl py-2 font-bold">Datos</TabsTrigger>
            <TabsTrigger value="compartir" className="rounded-xl py-2 font-bold">Compartir</TabsTrigger>
          </TabsList>

          {/* ---------- BLOQUES ---------- */}
          <TabsContent value="constructor" className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" className="rounded-full font-bold" onClick={() => setAdding(true)} disabled={draft.bloques.length >= MAX_BLOQUES}><Plus className="h-4 w-4" />Agregar bloque</Button>
              <Button type="button" variant="outline" className="rounded-full font-bold" onClick={() => { setPlantillaElegida(draft.plantilla); setTemplates(true); }}><LayoutTemplate className="h-4 w-4" />Empezar desde una plantilla</Button>
              <span className="ml-auto text-xs text-muted-foreground">{draft.bloques.length}/{MAX_BLOQUES} bloques</span>
            </div>
            <p className="text-xs text-muted-foreground">Arrastrá los bloques para ordenarlos, o usá las flechas. Tocá un bloque para editarlo, o tocalo directo en la vista previa.</p>

            <ul className="space-y-2">
              {draft.bloques.map((bloque, index) => {
                const open = openId === bloque.id;
                const obligatorio = bloque.tipo === "catalogo";
                return (
                  <li key={bloque.id} id={`editar-${bloque.id}`} draggable onDragStart={() => setDragId(bloque.id)} onDragEnd={() => { setDragId(null); setDropOn(null); }} onDragOver={(event) => { event.preventDefault(); setDropOn(bloque.id); }} onDrop={(event) => soltar(event, bloque.id)}
                    className={cn("rounded-2xl border bg-card transition-shadow", open && "border-brand-orange shadow-soft", dropOn === bloque.id && dragId !== bloque.id && "ring-2 ring-brand-orange", dragId === bloque.id && "opacity-50", !bloque.visible && "opacity-70")}>
                    <div className="flex items-center gap-1 p-2">
                      <span className="cursor-grab px-1 text-muted-foreground" aria-hidden><GripVertical className="h-4 w-4" /></span>
                      <button type="button" onClick={() => setOpenId(open ? null : bloque.id)} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2 py-1.5 text-left hover:bg-muted/50">
                        <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{nombreDe(bloque.tipo)}</span><span className="block truncate text-xs text-muted-foreground">{resumenDe(bloque) || "Sin título"}</span></span>
                        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
                      </button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={bloque.visible ? "Ocultar bloque" : "Mostrar bloque"} onClick={() => updateBloque(bloque.id, { visible: !bloque.visible })}>{bloque.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Subir" disabled={index === 0} onClick={() => mover(bloque.id, -1)}><ArrowUp className="h-4 w-4" /></Button>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Bajar" disabled={index === draft.bloques.length - 1} onClick={() => mover(bloque.id, 1)}><ArrowDown className="h-4 w-4" /></Button>
                    </div>
                    {open && (
                      <div className="space-y-5 border-t p-4">
                        <BlockSettings bloque={bloque} categorias={categorias} onChange={(cambios) => updateBloque(bloque.id, cambios)} />
                        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                          {!TIPOS_BLOQUE.find((item) => item.tipo === bloque.tipo)?.unico && draft.bloques.length < MAX_BLOQUES && <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => duplicar(bloque.id)}><Copy className="h-4 w-4" />Duplicar</Button>}
                          {!obligatorio && <Button type="button" variant="outline" size="sm" className="rounded-full text-destructive hover:text-destructive" onClick={() => eliminar(bloque.id)}><Trash2 className="h-4 w-4" />Eliminar bloque</Button>}
                          {obligatorio && <p className="text-xs text-muted-foreground">El catálogo no se puede eliminar, pero sí ocultar o mover.</p>}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </TabsContent>

          {/* ---------- DISEÑO ---------- */}
          <TabsContent value="diseno" className="mt-4">
            <div className="rounded-3xl border bg-card p-4 sm:p-5"><DesignPanel tema={draft} onChange={setDiseno} /></div>
          </TabsContent>

          {/* ---------- DATOS ---------- */}
          <TabsContent value="datos" className="mt-4 space-y-4">
            <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Mensajes generales</h3>
              <Texto label="Barra de anuncio (arriba de todo)" value={draft.anuncio} max={160} placeholder="Ej.: Envío gratis en compras de más de $20.000" onChange={(anuncio) => setTema({ anuncio })} />
              <Interruptor label="Mostrar calificaciones y opiniones" value={draft.mostrar_opiniones} onChange={(mostrar_opiniones) => setTema({ mostrar_opiniones })} />
            </section>
            <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Contacto y redes</h3>
              <Campo label="WhatsApp (con código de país, solo números)"><Input inputMode="numeric" maxLength={15} value={draft.whatsapp ?? ""} placeholder="5492355123456" onChange={(event) => setTema({ whatsapp: event.target.value.replace(/\D/g, "") })} aria-label="WhatsApp" /></Campo>
              <div className="grid gap-4 sm:grid-cols-2">
                <Campo label="Instagram (usuario)"><Input maxLength={60} value={draft.instagram ?? ""} placeholder="mi.tienda" onChange={(event) => setTema({ instagram: event.target.value.replace(/[^A-Za-z0-9._-]/g, "") })} aria-label="Instagram" /></Campo>
                <Campo label="Facebook (usuario)"><Input maxLength={60} value={draft.facebook ?? ""} placeholder="mi.tienda" onChange={(event) => setTema({ facebook: event.target.value.replace(/[^A-Za-z0-9._-]/g, "") })} aria-label="Facebook" /></Campo>
              </div>
              <Campo label="Sitio web (https://…)"><Input maxLength={200} value={draft.web ?? ""} placeholder="https://mitienda.com" onChange={(event) => setTema({ web: event.target.value })} aria-label="Sitio web" /></Campo>
            </section>
          </TabsContent>

          {/* ---------- COMPARTIR ---------- */}
          <TabsContent value="compartir" className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Visitas a tu tienda</h3>
              <p className="mb-3 mt-1 text-sm text-muted-foreground">Cuántas personas entraron. No guardamos quién es cada una.</p>
              <StorefrontStats storeId={store.id} />
            </section>
            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Cartel con QR</h3>
              <p className="mb-4 mt-1 text-sm text-muted-foreground">Llevá a tus clientes del local a tu tienda online.</p>
              <QrPoster store={store} url={url} color={draft.color} title={draft.titulo || store.nombre} />
            </section>
          </TabsContent>
        </Tabs>

        {tab !== "compartir" && wide && (
          <aside className="min-w-0 xl:sticky xl:top-20 xl:self-start">
            <PreviewPane data={previewData} selected={openId} onSelect={seleccionar} />
          </aside>
        )}
      </div>

      {tab !== "compartir" && !wide && (
        <Button type="button" variant="outline" className="w-full rounded-full font-bold" onClick={() => setPhonePreview(true)}><Monitor className="h-4 w-4" />Ver vista previa</Button>
      )}

      <div className="sticky bottom-3 z-20 flex items-center justify-between gap-3 rounded-full border bg-card/95 p-2 pl-5 shadow-pop backdrop-blur">
        <span className="text-sm font-semibold text-muted-foreground">{dirty ? "Tenés cambios sin publicar" : "Todo publicado"}</span>
        <div className="flex gap-2">
          {dirty && <Button type="button" variant="ghost" className="rounded-full" onClick={() => { setDraft(normalizeTheme(store.tienda_tema)); setOpenId(null); }}>Descartar</Button>}
          <Button type="button" className="rounded-full font-bold" onClick={save} disabled={!dirty || saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar y publicar</Button>
        </div>
      </div>

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-h-[88vh] max-w-xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Agregar un bloque</DialogTitle>
          <DialogDescription>Elegí qué querés sumar a tu página. Se agrega debajo del bloque que estás editando.</DialogDescription>
          <div className="grid gap-2 sm:grid-cols-2">
            {TIPOS_BLOQUE.map((item) => {
              const bloqueado = yaEsta(item.tipo);
              return (
                <button key={item.tipo} type="button" disabled={bloqueado} onClick={() => agregar(item.tipo)} className="rounded-2xl border p-3 text-left transition-colors hover:border-brand-orange hover:bg-brand-orange/5 disabled:cursor-not-allowed disabled:opacity-50">
                  <span className="block font-bold">{item.nombre}</span>
                  <span className="block text-xs text-muted-foreground">{bloqueado ? "Ya está en tu página" : item.detalle}</span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={templates} onOpenChange={setTemplates}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Empezar desde una plantilla</DialogTitle>
          <DialogDescription>Una plantilla arma los bloques y el diseño por vos, y después cambiás lo que quieras. <strong>Reemplaza los bloques y el diseño actuales</strong>; no toca tus productos.</DialogDescription>
          <TemplateGrid value={plantillaElegida} color={draft.color} onChange={setPlantillaElegida} />
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" className="rounded-full" onClick={() => setTemplates(false)}>Cancelar</Button><Button type="button" className="rounded-full font-bold" onClick={aplicarPlantilla}>Usar esta plantilla</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={phonePreview} onOpenChange={setPhonePreview}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Vista previa</DialogTitle>
          <DialogDescription className="sr-only">Así se ve tu tienda online.</DialogDescription>
          {phonePreview && <PreviewPane data={previewData} selected={openId} onSelect={(id) => { setPhonePreview(false); seleccionar(id); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

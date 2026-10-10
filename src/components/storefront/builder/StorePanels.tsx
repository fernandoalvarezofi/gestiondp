import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Globe, History, Loader2, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { errorMessage, formatDateTime } from "@/lib/delivery";
import { CATALOGO_ORDENES, CatalogoOrden, MENU_TIPOS, MenuItem, MenuTipo, TemaNormalizado } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import { Dominio, fetchDominio, fetchPreparacion, fetchVersiones, ItemPreparacion, solicitarDominio, Version } from "@/services/storeBuilder";
import { Campo, Interruptor, Texto } from "./fields";

type SetTema = (cambios: Partial<TemaNormalizado>) => void;

/** Menú del encabezado, pie de página y comportamiento del catálogo (orden inicial y buscador). */
export function NavigationPanel({ tema, onChange, categorias, colecciones, paginas, conTurnos }: {
  tema: TemaNormalizado; onChange: SetTema; categorias: string[]; colecciones: { slug: string; nombre: string }[]; paginas: { slug: string; titulo: string }[]; conTurnos: boolean;
}) {
  const menu = tema.menu ?? [];
  const setMenu = (m: MenuItem[]) => onChange({ menu: m });
  const opciones = (tipo: MenuTipo) => tipo === "categoria" ? categorias.map((c) => ({ v: c, t: c })) : tipo === "coleccion" ? colecciones.map((c) => ({ v: c.slug, t: c.nombre })) : tipo === "pagina" ? paginas.map((p) => ({ v: p.slug, t: p.titulo })) : [];
  const agregar = (tipo: MenuTipo) => {
    const def = MENU_TIPOS.find((m) => m.tipo === tipo)!;
    const primera = opciones(tipo)[0];
    setMenu([...menu, { tipo, texto: primera?.t ?? def.nombre.replace(/ \(.*\)$/, ""), ...(def.necesita === "url" ? { destino: "https://" } : primera ? { destino: primera.v } : {}) }].slice(0, 12));
  };
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-3xl border bg-card p-4 sm:p-5">
        <div><h3 className="font-extrabold">Menú del encabezado</h3><p className="text-sm text-muted-foreground">Si lo dejás vacío, se arma solo con tus secciones, Ofertas, Nosotros y Contacto.</p></div>
        {menu.length > 0 && (
          <ul className="space-y-2">
            {menu.map((m, i) => {
              const def = MENU_TIPOS.find((x) => x.tipo === m.tipo)!;
              const ops = opciones(m.tipo);
              const set = (c: Partial<MenuItem>) => setMenu(menu.map((x, j) => (j === i ? { ...x, ...c } : x)));
              return (
                <li key={i} className="grid gap-2 rounded-2xl border p-2.5 sm:grid-cols-[1fr_1fr_auto]">
                  <Input aria-label="Texto del enlace" maxLength={30} value={m.texto} onChange={(e) => set({ texto: e.target.value })} />
                  {def.necesita === "url" ? <Input aria-label="Enlace" maxLength={200} value={m.destino ?? ""} onChange={(e) => set({ destino: e.target.value })} placeholder="https://" />
                    : def.necesita ? (
                      <select aria-label="Destino" value={m.destino ?? ""} onChange={(e) => set({ destino: e.target.value })} className="h-10 rounded-md border bg-background px-3 text-sm">
                        {ops.length === 0 && <option value="">No hay opciones</option>}
                        {ops.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                      </select>
                    ) : <span className="flex h-10 items-center text-sm text-muted-foreground">{def.nombre}</span>}
                  <span className="flex items-center">
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Subir" disabled={i === 0} onClick={() => { const n = [...menu]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setMenu(n); }}><ArrowUp className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Bajar" disabled={i === menu.length - 1} onClick={() => { const n = [...menu]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setMenu(n); }}><ArrowDown className="h-4 w-4" /></Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Quitar enlace" onClick={() => setMenu(menu.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {menu.length < 12 && (
          <select value="" aria-label="Agregar enlace" onChange={(e) => e.target.value && agregar(e.target.value as MenuTipo)} className="h-10 w-full rounded-full border bg-background px-4 text-sm font-semibold">
            <option value="">+ Agregar enlace…</option>
            {MENU_TIPOS.filter((m) => m.tipo !== "reservar" || conTurnos).map((m) => <option key={m.tipo} value={m.tipo} disabled={(m.necesita === "pagina" && paginas.length === 0) || (m.necesita === "coleccion" && colecciones.length === 0)}>{m.nombre}</option>)}
          </select>
        )}
        {menu.some((m) => m.tipo === "url" && !/^https:\/\/[^\s<>"]+$/.test(m.destino ?? "")) && <p className="text-xs font-semibold text-destructive">Hay un enlace externo inválido: tiene que empezar con https://</p>}
      </section>
      <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
        <h3 className="font-extrabold">Catálogo</h3>
        <Campo label="Orden inicial de los productos">
          <select value={tema.catalogo_orden ?? "relevancia"} onChange={(e) => onChange({ catalogo_orden: e.target.value as CatalogoOrden })} className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label="Orden inicial">
            {CATALOGO_ORDENES.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </Campo>
        <Interruptor label="Mostrar el buscador en el encabezado" value={tema.mostrar_busqueda !== false} onChange={(mostrar_busqueda) => onChange({ mostrar_busqueda })} />
      </section>
      <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
        <h3 className="font-extrabold">Pie de página</h3>
        <Texto label="Texto del pie (opcional)" value={tema.pie} max={300} multiline placeholder="Ej.: Hecho con amor en Lincoln desde 1998. CUIT 20-12345678-9." onChange={(pie) => onChange({ pie })} hint="Si lo dejás vacío se usa la descripción del local. Las páginas publicadas aparecen solas en el pie." />
      </section>
    </div>
  );
}

/** SEO e indexación, imagen para compartir, ícono, píxeles de analítica y dominio propio. */
export function SeoPanel({ storeId, storeNombre, storeSlug, tema, onChange }: { storeId: string; storeNombre: string; storeSlug: string; tema: TemaNormalizado; onChange: SetTema }) {
  const [dominio, setDominio] = useState<Dominio>(null);
  const [nuevoDom, setNuevoDom] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { fetchDominio(storeId).then((d) => { setDominio(d); setNuevoDom(d?.dominio ?? ""); }); }, [storeId]);
  const pedir = async () => {
    setBusy(true);
    try { const d = await solicitarDominio(storeId, nuevoDom); setDominio(d); toast.success(d ? "Pedido registrado. Seguí los pasos de abajo." : "Dominio quitado"); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const titulo = tema.seo_titulo || `${storeNombre} · Tienda online`;
  const desc = tema.seo_descripcion || "Agregá una descripción para que se vea bien en Google y al compartir el enlace.";
  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-extrabold"><Search className="h-4 w-4 text-primary" />Buscadores y redes</h3>
        <Texto label={`Título para Google (${(tema.seo_titulo ?? "").length}/70)`} value={tema.seo_titulo} max={70} placeholder={`${storeNombre} · Tienda online`} onChange={(seo_titulo) => onChange({ seo_titulo })} />
        <Texto label="Descripción para Google y al compartir" value={tema.seo_descripcion} max={170} multiline placeholder="Qué vendés, dónde y por qué comprarte. Ej.: Panadería artesanal en Lincoln. Pedí online con envío en el día." onChange={(seo_descripcion) => onChange({ seo_descripcion })} />
        <div className="rounded-2xl bg-muted p-3 text-sm" aria-label="Vista previa en Google">
          <p className="truncate text-xs text-muted-foreground">woref.vercel.app › t › {storeSlug}</p>
          <p className="truncate font-semibold text-sky-700 dark:text-sky-400">{titulo}</p>
          <p className="line-clamp-2 text-xs text-muted-foreground">{desc}</p>
        </div>
        <ImageUpload label="Imagen al compartir el enlace (1200×630 ideal)" folder="comercios" shape="wide" value={tema.og_imagen ?? ""} onChange={(og_imagen) => onChange({ og_imagen })} />
        <ImageUpload label="Ícono de la pestaña (favicon, cuadrado)" folder="comercios" shape="square" value={tema.favicon_url ?? ""} onChange={(favicon_url) => onChange({ favicon_url })} />
        <Interruptor label="Mostrar mi tienda en Google" hint="Si lo apagás, pedimos a los buscadores que no la indexen (sigue abierta para quien tenga el enlace)." value={tema.indexar !== false} onChange={(indexar) => onChange({ indexar })} />
        <p className="text-xs text-muted-foreground">Tus productos y páginas se suman solos al mapa del sitio (sitemap) y usan datos estructurados para que Google muestre precio y disponibilidad.</p>
      </section>
      <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
        <h3 className="font-extrabold">Analítica propia (opcional)</h3>
        <p className="text-sm text-muted-foreground">Si usás Meta Ads o Google Analytics, pegá tus IDs. Se cargan solo para visitantes que aceptan cookies de medición.</p>
        <Campo label="ID del píxel de Meta (solo números)"><Input inputMode="numeric" maxLength={20} value={tema.pixel_meta ?? ""} placeholder="123456789012345" onChange={(e) => onChange({ pixel_meta: e.target.value.replace(/\D/g, "") || undefined })} aria-label="ID del píxel de Meta" /></Campo>
        <Campo label="ID de medición de Google Analytics 4"><Input maxLength={16} value={tema.ga4 ?? ""} placeholder="G-XXXXXXXXXX" onChange={(e) => onChange({ ga4: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") || undefined })} aria-label="ID de Google Analytics" /></Campo>
        {tema.ga4 && !/^G-[A-Z0-9]{4,14}$/.test(tema.ga4) && <p className="text-xs font-semibold text-destructive">El ID de Google Analytics tiene el formato G-XXXXXXX.</p>}
      </section>
      <section className="space-y-3 rounded-3xl border bg-card p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-extrabold"><Globe className="h-4 w-4 text-primary" />Dominio propio</h3>
        <p className="text-sm text-muted-foreground">Usá tu propio dominio (por ejemplo, mitienda.com.ar) en lugar de la dirección de Woref.</p>
        <div className="flex gap-2"><Input aria-label="Tu dominio" maxLength={120} value={nuevoDom} placeholder="mitienda.com.ar" onChange={(e) => setNuevoDom(e.target.value.toLowerCase().trim())} /><Button type="button" variant="outline" className="shrink-0 rounded-full" disabled={busy || nuevoDom === (dominio?.dominio ?? "")} onClick={pedir}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{nuevoDom ? "Guardar" : "Quitar"}</Button></div>
        {dominio && (
          <div className={cn("space-y-2 rounded-2xl p-3 text-sm", dominio.estado === "activo" ? "bg-success/10" : dominio.estado === "rechazado" ? "bg-destructive/10" : "bg-muted")}>
            <p className="font-bold">{dominio.dominio} · {dominio.estado === "activo" ? "Activo" : dominio.estado === "rechazado" ? "Rechazado" : "Pendiente de activación"}</p>
            {dominio.nota && <p>{dominio.nota}</p>}
            {dominio.estado !== "activo" && (
              <ol className="list-decimal space-y-1 pl-5 text-xs">
                <li>En tu proveedor de dominio, creá un registro <b>CNAME</b> de <code>www</code> a <code>cname.vercel-dns.com</code> (o un registro <b>A</b> del dominio raíz a <code>76.76.21.21</code>).</li>
                <li>Agregá un registro <b>TXT</b> llamado <code>_woref</code> con el valor <code className="break-all">{dominio.token}</code> para probar que es tuyo.</li>
                <li>El equipo de Woref verifica los registros, conecta el dominio y te avisamos. Puede tardar hasta 48 h por la propagación de DNS.</li>
              </ol>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

/** Versiones publicadas: restaurar trae la versión al borrador (no publica sola). */
export function VersionsPanel({ storeId, onRestaurar, refresco }: { storeId: string; onRestaurar: (v: Version) => void; refresco: number }) {
  const [versiones, setVersiones] = useState<Version[] | null>(null);
  useEffect(() => { setVersiones(null); fetchVersiones(storeId).then(setVersiones).catch(() => setVersiones([])); }, [storeId, refresco]);
  return (
    <section className="rounded-3xl border bg-card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-extrabold"><History className="h-4 w-4 text-primary" />Versiones publicadas</h3>
      <p className="mt-1 text-sm text-muted-foreground">Cada vez que publicás se guarda una copia (las últimas 40). Restaurar la carga en el editor como borrador: la revisás y publicás si querés.</p>
      {!versiones ? <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" /> : versiones.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Todavía no hay versiones: aparecen desde la próxima vez que publiques.</p> : (
        <ol className="mt-4 divide-y rounded-2xl border">
          {versiones.map((v, i) => (
            <li key={v.id} className="flex items-center gap-3 p-3 text-sm">
              <div className="min-w-0 flex-1"><p className="font-bold">{v.nota || (i === 0 ? "Versión publicada ahora" : "Sin nota")}</p><p className="text-xs text-muted-foreground">{formatDateTime(v.created_at)}{i === 0 ? " · en línea" : ""}</p></div>
              {i > 0 && <Button size="sm" variant="outline" className="rounded-full" onClick={() => onRestaurar(v)}><RotateCcw className="h-4 w-4" />Restaurar</Button>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Revisión antes de publicar: lo que falta (con datos reales) y una nota para el historial de versiones. */
export function PublishDialog({ open, storeId, avisosLocales, onOpenChange, onPublicar }: {
  open: boolean; storeId: string; avisosLocales: string[]; onOpenChange: (v: boolean) => void; onPublicar: (nota: string) => Promise<void>;
}) {
  const [items, setItems] = useState<ItemPreparacion[] | null>(null);
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setItems(null); setNota(""); fetchPreparacion(storeId).then(setItems).catch(() => setItems([])); } }, [open, storeId]);
  const pendientes = (items ?? []).filter((i) => !i.ok && i.clave !== "borrador");
  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogTitle className="text-xl font-extrabold">Publicar cambios</DialogTitle>
        <DialogDescription>Revisá que esté todo. Lo que publiques reemplaza la tienda en línea al instante; la versión anterior queda guardada.</DialogDescription>
        {!items ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /> : (
          <ul className="space-y-1.5 text-sm">
            {items.filter((i) => i.clave !== "borrador").map((i) => (
              <li key={i.clave} className={cn("flex items-start gap-2 rounded-xl p-2", !i.ok && (i.grave ? "bg-destructive/10" : "bg-warning/10"))}>
                {i.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> : <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", i.grave ? "text-destructive" : "text-warning")} />}
                <span><span className="font-bold">{i.titulo}</span>{!i.ok && <span className="block text-xs text-muted-foreground">{i.detalle}</span>}</span>
              </li>
            ))}
            {avisosLocales.map((a) => <li key={a} className="flex items-start gap-2 rounded-xl bg-warning/10 p-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span>{a}</span></li>)}
          </ul>
        )}
        {pendientes.some((p) => p.grave) && <p className="text-xs text-muted-foreground">Podés publicar igual: los puntos en rojo impiden que los clientes compren o vean la tienda hasta que los resuelvas.</p>}
        <Input aria-label="Nota de la versión" maxLength={120} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota para esta versión (ej.: Portada de Navidad)" />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" className="rounded-full" disabled={busy} onClick={() => onOpenChange(false)}>Seguir editando</Button>
          <Button className="rounded-full font-bold" disabled={busy || !items} onClick={async () => { setBusy(true); try { await onPublicar(nota); } finally { setBusy(false); } }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Publicar ahora</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Advertencias de contenido del borrador (las que se pueden saber sin ir a la base). */
export function avisosDelTema(t: TemaNormalizado): string[] {
  const out: string[] = [];
  const visibles = t.bloques.filter((b) => b.visible);
  const portada = visibles.find((b) => b.tipo === "portada");
  if (!portada) out.push("La página no tiene portada: es lo primero que ve la gente.");
  else if (portada.tipo === "portada" && !portada.imagen_url && !t.banner_url && portada.estilo !== "impacto") out.push("La portada no tiene imagen propia (se usa la foto del local).");
  visibles.forEach((b) => {
    if ((b.tipo === "banner" || b.tipo === "imagen_texto") && !b.imagen_url) out.push(`El bloque “${b.titulo || (b.tipo === "banner" ? "Banner" : "Imagen con texto")}” no tiene foto.`);
    if (b.tipo === "galeria" && b.imagenes.length === 0) out.push("La galería está vacía (no se va a ver).");
    if (b.tipo === "productos" && b.fuente === "coleccion" && !b.coleccion) out.push("Un bloque de productos no tiene colección elegida.");
    if (b.tipo === "productos" && b.fuente === "categoria" && !b.categoria) out.push("Un bloque de productos no tiene sección elegida.");
    if (b.tipo === "oferta" && b.hasta && Date.parse(b.hasta) < Date.now()) out.push(`La oferta “${b.titulo || "con cuenta regresiva"}” ya venció.`);
    if (b.tipo === "video" && !b.url) out.push("El bloque de video no tiene enlace.");
    if (b.tipo === "testimonios" && b.items.some((x) => x.nombre === "Nombre del cliente")) out.push("Los testimonios tienen el texto de ejemplo: cargá frases reales o quitá el bloque.");
    if (b.tipo === "columnas" && b.items.some((x) => /^(Primera|Segunda|Tercera) columna$/.test(x.titulo))) out.push("Las columnas tienen el texto de ejemplo.");
    if (b.tipo === "cta" && b.enlace_tipo === "url" && !b.enlace_url) out.push(`El botón de “${b.titulo || "Llamado a la acción"}” no tiene dirección web.`);
  });
  if ((t.menu ?? []).some((m) => m.tipo === "url" && !/^https:\/\//.test(m.destino ?? ""))) out.push("Hay un enlace del menú inválido (se va a descartar al publicar).");
  return [...new Set(out)];
}

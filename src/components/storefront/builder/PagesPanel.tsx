import { ReactNode, useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, ExternalLink, FileText, Loader2, Megaphone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { RichText } from "@/components/storefront/RichText";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/delivery";
import { Bloque, bloqueNuevo, BloqueTipo, normalizeBloque, TIPOS_BLOQUE } from "@/lib/storefront";
import { cn } from "@/lib/utils";
import { slugify, slugValido } from "@/services/catalogPro";
import { borrarPagina, CLASE_PAGINA, ClasePagina, fetchPaginas, guardarPagina, Pagina, PAGINAS_SUGERIDAS } from "@/services/storeBuilder";
import { BlockSettings } from "./BlockSettings";
import { confirmar } from "@/components/ui/dialogos";

type Draft = { id: string | null; tipo: Pagina["tipo"]; clase: ClasePagina; slug: string; titulo: string; contenido: string; bloques: Bloque[]; estado: Pagina["estado"]; seo_titulo: string; seo_descripcion: string; imagen_url: string };
const TIPOS_LANDING: BloqueTipo[] = ["portada", "banner", "oferta", "cta", "productos", "colecciones", "servicios", "imagen_texto", "texto", "columnas", "galeria", "testimonios", "confianza", "faq", "video", "cinta", "newsletter", "formulario", "ubicacion", "politicas", "separador"];

/** Páginas de la tienda: informativas (Nosotros, Envíos, Cambios…) con texto con formato, y landings de campaña armadas con secciones. */
export function PagesPanel({ storeId, storeSlug, categorias, colecciones, previewDe, onChanged }: {
  storeId: string; storeSlug: string; categorias: string[]; colecciones: { slug: string; nombre: string }[];
  previewDe: (p: Draft) => ReactNode; onChanged: () => void;
}) {
  const [paginas, setPaginas] = useState<Pagina[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { fetchPaginas(storeId).then(setPaginas).catch(() => setPaginas([])); }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const editar = (p: Pagina) => setDraft({
    id: p.id, tipo: p.tipo, clase: p.clase, slug: p.slug, titulo: p.titulo, contenido: p.contenido ?? "", estado: p.estado, seo_titulo: p.seo_titulo ?? "", seo_descripcion: p.seo_descripcion ?? "", imagen_url: p.imagen_url ?? "",
    bloques: (Array.isArray(p.bloques) ? p.bloques : []).map((b, i) => normalizeBloque(b, i)).filter((b): b is Bloque => b !== null),
  });
  const nueva = (tipo: Pagina["tipo"], base?: (typeof PAGINAS_SUGERIDAS)[number]) => {
    const usadas = new Set((paginas ?? []).map((p) => p.slug));
    let slug = base?.slug ?? (tipo === "landing" ? "campana" : "nueva-pagina"); let n = 2;
    while (usadas.has(slug)) slug = `${base?.slug ?? "pagina"}-${n++}`;
    setDraft({
      id: null, tipo, clase: base?.clase ?? (tipo === "landing" ? "campana" : "otra"), slug, titulo: base?.titulo ?? (tipo === "landing" ? "Nueva campaña" : "Nueva página"),
      contenido: base?.contenido ?? "", estado: "borrador", seo_titulo: "", seo_descripcion: "", imagen_url: "",
      bloques: tipo === "landing" ? [{ ...bloqueNuevo("banner"), titulo: "Tu campaña", texto: "Contá de qué se trata y hasta cuándo dura." } as Bloque, { ...bloqueNuevo("productos"), fuente: "ofertas", titulo: "Productos en promoción" } as Bloque] : [],
    });
  };
  const guardar = async (estado?: Pagina["estado"]) => {
    if (!draft) return;
    const slug = draft.slug || slugify(draft.titulo);
    if (draft.titulo.trim().length < 2) return toast.error("Poné un título");
    if (!slugValido(slug)) return toast.error("La dirección solo admite minúsculas, números y guiones");
    setBusy(true);
    try {
      const id = await guardarPagina(storeId, draft.id, { tipo: draft.tipo, clase: draft.clase, slug, titulo: draft.titulo, contenido: draft.contenido, bloques: draft.bloques, estado: estado ?? draft.estado, seo_titulo: draft.seo_titulo, seo_descripcion: draft.seo_descripcion, imagen_url: draft.imagen_url || null } as Partial<Pagina>);
      toast.success((estado ?? draft.estado) === "publicada" ? "Página publicada" : "Página guardada como borrador");
      setDraft(null); load(); onChanged();
      void id;
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const cambiarEstado = async (p: Pagina) => {
    setBusy(true);
    try { await guardarPagina(storeId, p.id, { ...p, estado: p.estado === "publicada" ? "borrador" : "publicada" }); load(); onChanged(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const mover = async (i: number, dir: -1 | 1) => {
    if (!paginas) return;
    const lista = [...paginas]; const j = i + dir; if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    setPaginas(lista);
    try { await Promise.all(lista.map((p, orden) => (p.orden === orden ? null : guardarPagina(storeId, p.id, { ...p, orden })))); onChanged(); } catch (error) { toast.error(errorMessage(error)); load(); }
  };
  const eliminar = async (p: Pagina) => {
    if (!(await confirmar({ titulo: `¿Eliminar la página “${p.titulo}”?`, descripcion: "Si está en el menú de la tienda, se quita sola.", confirmar: "Eliminar", peligro: true }))) return;
    try { await borrarPagina(p.id); toast.success("Página eliminada"); load(); onChanged(); } catch (error) { toast.error(errorMessage(error)); }
  };
  const faltantes = PAGINAS_SUGERIDAS.filter((s) => !(paginas ?? []).some((p) => p.clase === s.clase));
  const setB = (fn: (l: Bloque[]) => Bloque[]) => setDraft((d) => (d ? { ...d, bloques: fn(d.bloques) } : d));

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="font-extrabold">Páginas de tu tienda</h3><p className="text-sm text-muted-foreground">Aparecen en el pie y las podés sumar al menú.</p></div>
          <div className="flex gap-2"><Button size="sm" variant="outline" className="rounded-full" onClick={() => nueva("informativa")}><FileText className="h-4 w-4" />Página</Button><Button size="sm" className="rounded-full" onClick={() => nueva("landing")}><Megaphone className="h-4 w-4" />Campaña</Button></div>
        </div>
        {!paginas ? <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" /> : paginas.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Todavía no creaste páginas.</p> : (
          <ul className="mt-4 divide-y rounded-2xl border">
            {paginas.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 p-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", p.tipo === "landing" ? "bg-brand-yellow/25 text-brand-yellow-foreground" : "bg-primary/10 text-primary")}>{p.tipo === "landing" ? <Megaphone className="h-4 w-4" /> : <FileText className="h-4 w-4" />}</span>
                <button type="button" onClick={() => editar(p)} className="min-w-0 flex-1 text-left"><p className="truncate text-sm font-bold">{p.titulo}</p><p className="truncate text-xs text-muted-foreground">/{p.slug} · {CLASE_PAGINA[p.clase]} · {p.estado === "publicada" ? "Publicada" : "Borrador"}</p></button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Bajar" disabled={i === paginas.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={p.estado === "publicada" ? "Pasar a borrador" : "Publicar"} title={p.estado === "publicada" ? "Pasar a borrador" : "Publicar"} disabled={busy} onClick={() => cambiarEstado(p)}>{p.estado === "publicada" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}</Button>
                {p.estado === "publicada" && <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Ver en la tienda" asChild><a href={`/t/${storeSlug}/pagina/${p.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>}
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label={`Eliminar ${p.titulo}`} onClick={() => eliminar(p)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
        {faltantes.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-bold text-muted-foreground">Sugeridas (con un texto para completar)</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{faltantes.map((s) => <button key={s.clase} type="button" onClick={() => nueva("informativa", s)} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold hover:bg-muted"><Plus className="h-3 w-3" />{s.titulo}</button>)}</div>
          </div>
        )}
      </section>

      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && !busy && setDraft(null)}>
        <DialogContent className="max-h-[94vh] max-w-6xl overflow-y-auto">
          <DialogTitle className="text-xl font-extrabold">{draft?.id ? "Editar página" : draft?.tipo === "landing" ? "Nueva campaña" : "Nueva página"}</DialogTitle>
          <DialogDescription>{draft?.tipo === "landing" ? "Una página de promoción armada con secciones: banner, productos en oferta, cuenta regresiva…" : "Texto con formato: ## títulos, listas con “- ”, **negrita** y enlaces [texto](https://…)."}</DialogDescription>
          {draft && (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="pg-t">Título</Label><Input id="pg-t" maxLength={90} value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="pg-c">Tipo</Label><select id="pg-c" value={draft.clase} onChange={(e) => setDraft({ ...draft, clase: e.target.value as ClasePagina })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{(Object.keys(CLASE_PAGINA) as ClasePagina[]).map((c) => <option key={c} value={c}>{CLASE_PAGINA[c]}</option>)}</select></div>
                <div className="space-y-1.5 sm:col-span-3"><Label htmlFor="pg-s">Dirección</Label><div className="flex items-center gap-1 text-sm"><span className="shrink-0 text-muted-foreground">/t/{storeSlug}/pagina/</span><Input id="pg-s" maxLength={70} value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div></div>
              </div>
              {draft.tipo === "informativa" ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-1.5"><Label htmlFor="pg-txt">Contenido</Label><Textarea id="pg-txt" maxLength={20000} value={draft.contenido} onChange={(e) => setDraft({ ...draft, contenido: e.target.value })} className="min-h-[320px] font-mono text-sm" /></div>
                  <div><p className="mb-1.5 text-sm font-semibold">Así se ve</p><div className="max-h-[360px] overflow-y-auto rounded-2xl border bg-background p-4"><h2 className="mb-3 text-2xl font-black">{draft.titulo}</h2><RichText texto={draft.contenido} /></div></div>
                  <ImageUpload label="Imagen (opcional)" folder="comercios" shape="wide" value={draft.imagen_url} onChange={(url) => setDraft({ ...draft, imagen_url: url })} className="lg:col-span-2" />
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-extrabold">Secciones ({draft.bloques.length}/20)</p>
                  <ul className="space-y-2">
                    {draft.bloques.map((b, i) => (
                      <li key={b.id} className="rounded-2xl border">
                        <div className="flex items-center gap-1 p-2">
                          <button type="button" onClick={() => setAbierto(abierto === b.id ? null : b.id)} className="min-w-0 flex-1 rounded-xl px-2 py-1 text-left text-sm font-bold hover:bg-muted/50">{TIPOS_BLOQUE.find((t) => t.tipo === b.tipo)?.nombre ?? b.tipo}</button>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Subir" disabled={i === 0} onClick={() => setB((l) => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}><ArrowUp className="h-4 w-4" /></Button>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Bajar" disabled={i === draft.bloques.length - 1} onClick={() => setB((l) => { const n = [...l]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}><ArrowDown className="h-4 w-4" /></Button>
                          <Button type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Quitar sección" onClick={() => setB((l) => l.filter((x) => x.id !== b.id))}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                        {abierto === b.id && <div className="border-t p-3"><BlockSettings bloque={b} categorias={categorias} colecciones={colecciones} onChange={(c) => setB((l) => l.map((x) => (x.id === b.id ? ({ ...x, ...c } as Bloque) : x)))} /></div>}
                      </li>
                    ))}
                  </ul>
                  {draft.bloques.length < 20 && (
                    <select value="" aria-label="Agregar sección" onChange={(e) => { const t = e.target.value as BloqueTipo; if (t) { const nb = bloqueNuevo(t); setB((l) => [...l, nb]); setAbierto(nb.id); } }} className="h-10 w-full rounded-full border bg-background px-4 text-sm font-semibold">
                      <option value="">+ Agregar sección…</option>
                      {TIPOS_LANDING.map((t) => <option key={t} value={t}>{TIPOS_BLOQUE.find((x) => x.tipo === t)?.nombre ?? t}</option>)}
                    </select>
                  )}
                </div>
              )}
              <details className="rounded-2xl border p-3">
                <summary className="cursor-pointer text-sm font-extrabold">Buscadores (SEO)</summary>
                <div className="mt-3 grid gap-3">
                  <div className="space-y-1.5"><Label htmlFor="pg-st">Título para Google ({draft.seo_titulo.length}/70)</Label><Input id="pg-st" maxLength={70} value={draft.seo_titulo} placeholder={draft.titulo} onChange={(e) => setDraft({ ...draft, seo_titulo: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label htmlFor="pg-sd">Descripción para Google ({draft.seo_descripcion.length}/170)</Label><Textarea id="pg-sd" maxLength={170} value={draft.seo_descripcion} onChange={(e) => setDraft({ ...draft, seo_descripcion: e.target.value })} className="min-h-[56px] resize-none" /></div>
                </div>
              </details>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" className="rounded-full" disabled={busy} onClick={() => setDraft(null)}>Cancelar</Button>
                <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => guardar("borrador")}>Guardar borrador</Button>
                <Button className="rounded-full" disabled={busy} onClick={() => guardar("publicada")}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Publicar página</Button>
              </div>
            </div>
            <aside className="hidden min-w-0 xl:block">{previewDe(draft)}</aside>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
export type PaginaEnEdicion = Draft;

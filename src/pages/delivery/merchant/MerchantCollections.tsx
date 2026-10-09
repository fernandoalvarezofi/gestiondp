import { FormEvent, useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ExternalLink, Layers, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { PageIntro } from "@/components/panel/kit";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, img } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Coleccion, fetchColecciones, guardarProductosColeccion, slugify, slugValido } from "@/services/catalogPro";
import { useMerchant } from "./context";
import { confirmar } from "@/components/ui/dialogos";

type ColeccionConProductos = Coleccion & { productos: string[] };
type Draft = { id?: string; nombre: string; slug: string; descripcion: string; imagen_url: string; activa: boolean; productos: string[] };

/** Colecciones curadas a mano (Verano, Regalos, Novedades…): agrupan productos de distintas secciones y tienen su propia página en la tienda. */
export default function MerchantCollections() {
  const { store, products } = useMerchant();
  const [cols, setCols] = useState<ColeccionConProductos[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busca, setBusca] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(() => { fetchColecciones(store.id).then(setCols).catch((e) => { toast.error(errorMessage(e)); setCols([]); }); }, [store.id]);
  useEffect(() => { load(); }, [load]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const slug = draft.slug || slugify(draft.nombre);
    if (draft.nombre.trim().length < 2) return toast.error("Poné un nombre");
    if (!slugValido(slug)) return toast.error("La dirección solo admite minúsculas, números y guiones");
    setSaving(true);
    try {
      const payload = { comercio_id: store.id, nombre: draft.nombre.trim(), slug, descripcion: draft.descripcion.trim() || null, imagen_url: draft.imagen_url || null, activa: draft.activa };
      let id = draft.id;
      if (id) { const { error } = await db.from("delivery_colecciones").update(payload).eq("id", id); if (error) throw error; }
      else { const { data, error } = await db.from("delivery_colecciones").insert({ ...payload, orden: cols?.length ?? 0 }).select("id").single(); if (error) throw error; id = data.id; }
      await guardarProductosColeccion(id as string, draft.productos);
      toast.success("Colección guardada");
      setDraft(null); load();
    } catch (error) {
      const msg = errorMessage(error);
      toast.error(/duplicate|unique/i.test(msg) ? "Ya tenés una colección con esa dirección" : msg);
    } finally { setSaving(false); }
  };
  const borrar = async (c: ColeccionConProductos) => {
    if (!(await confirmar({ titulo: `¿Eliminar la colección “${c.nombre}”?`, descripcion: "Los productos no se borran; solo dejan de estar agrupados.", confirmar: "Eliminar", peligro: true }))) return;
    const { error } = await db.from("delivery_colecciones").delete().eq("id", c.id);
    if (error) return toast.error(errorMessage(error));
    toast.success("Colección eliminada"); load();
  };
  const mover = (i: number, dir: -1 | 1) => setDraft((d) => { if (!d) return d; const p = [...d.productos]; const j = i + dir; if (j < 0 || j >= p.length) return d; [p[i], p[j]] = [p[j], p[i]]; return { ...d, productos: p }; });
  const q = busca.trim().toLowerCase();
  const candidatos = draft ? products.filter((p) => (p.estado ?? "publicado") !== "archivado" && !draft.productos.includes(p.id) && (!q || `${p.nombre} ${p.categoria}`.toLowerCase().includes(q))).slice(0, 40) : [];

  return (
    <div className="space-y-5">
      <PageIntro description="Agrupá productos para campañas, temporadas o regalos. Cada colección tiene su página y la podés mostrar en la portada."
        actions={<Button className="rounded-full" onClick={() => setDraft({ nombre: "", slug: "", descripcion: "", imagen_url: "", activa: true, productos: [] })}><Plus className="h-4 w-4" />Nueva colección</Button>} />
      {!cols ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /> : cols.length === 0 ? (
        <EmptyState icon={<Layers className="h-7 w-7" />} title="Todavía no armaste colecciones" text="Por ejemplo: “Día de la Madre”, “Lo nuevo”, “Combos para compartir”." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cols.map((c) => (
            <li key={c.id} className={cn("flex gap-3 rounded-3xl border bg-card p-3", !c.activa && "opacity-60")}>
              <img src={img(c.imagen_url ?? products.find((p) => p.id === c.productos[0])?.imagen_url, 200)} alt="" className="h-20 w-20 shrink-0 rounded-2xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{c.nombre}{!c.activa && <span className="ml-1 text-xs font-bold text-muted-foreground">(oculta)</span>}</p>
                <p className="text-sm text-muted-foreground">{c.productos.length} productos · /{c.slug}</p>
                <div className="mt-2 flex gap-1">
                  <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => setDraft({ id: c.id, nombre: c.nombre, slug: c.slug, descripcion: c.descripcion ?? "", imagen_url: c.imagen_url ?? "", activa: c.activa, productos: c.productos })}><Pencil className="h-3.5 w-3.5" />Editar</Button>
                  <Button size="sm" variant="ghost" className="h-8 rounded-full" asChild><a href={`/t/${store.slug}/coleccion/${c.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Ver</a></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive" aria-label={`Eliminar ${c.nombre}`} onClick={() => borrar(c)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={Boolean(draft)} onOpenChange={(v) => !v && !saving && setDraft(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogTitle className="text-xl font-extrabold">{draft?.id ? "Editar colección" : "Nueva colección"}</DialogTitle>
          {draft && (
            <form onSubmit={save} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label htmlFor="col-n">Nombre</Label><Input id="col-n" maxLength={60} value={draft.nombre} onChange={(e) => setDraft({ ...draft, nombre: e.target.value })} /></div>
                <div className="space-y-1.5"><Label htmlFor="col-s">Dirección</Label><Input id="col-s" maxLength={70} value={draft.slug} placeholder={slugify(draft.nombre || "coleccion")} onChange={(e) => setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="col-d">Descripción (se muestra arriba de la colección)</Label><Textarea id="col-d" maxLength={500} value={draft.descripcion} onChange={(e) => setDraft({ ...draft, descripcion: e.target.value })} className="min-h-[56px]" /></div>
              <ImageUpload label="Imagen de la colección" folder="comercios" shape="wide" value={draft.imagen_url} onChange={(url) => setDraft({ ...draft, imagen_url: url })} />
              <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={draft.activa} onCheckedChange={(v) => setDraft({ ...draft, activa: v })} />Visible en la tienda</label>
              <div>
                <p className="text-sm font-extrabold">Productos ({draft.productos.length})</p>
                {draft.productos.length > 0 && (
                  <ol className="mt-2 divide-y rounded-2xl border">
                    {draft.productos.map((id, i) => { const p = products.find((x) => x.id === id); return (
                      <li key={id} className="flex items-center gap-2 p-2 text-sm">
                        <img src={img(p?.imagen_url, 80)} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        <span className="min-w-0 flex-1 truncate font-semibold">{p?.nombre ?? "Producto eliminado"}</span>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Subir" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Bajar" disabled={i === draft.productos.length - 1} onClick={() => mover(i, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                        <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Quitar" onClick={() => setDraft({ ...draft, productos: draft.productos.filter((x) => x !== id) })}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </li>
                    ); })}
                  </ol>
                )}
                <label className="mt-3 flex h-10 items-center gap-2 rounded-full border bg-card px-3 text-sm"><Search className="h-4 w-4 text-muted-foreground" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar productos para sumar" aria-label="Buscar productos" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
                <ul className="mt-2 grid max-h-56 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
                  {candidatos.map((p) => <li key={p.id}><button type="button" onClick={() => setDraft({ ...draft, productos: [...draft.productos, p.id].slice(0, 500) })} className="flex w-full items-center gap-2 rounded-xl p-1.5 text-left text-sm hover:bg-muted"><img src={img(p.imagen_url, 80)} alt="" className="h-8 w-8 rounded-lg object-cover" /><span className="min-w-0 flex-1 truncate">{p.nombre}</span><Plus className="h-4 w-4 text-primary" /></button></li>)}
                </ul>
              </div>
              <Button type="submit" className="w-full rounded-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar colección</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

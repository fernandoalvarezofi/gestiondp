import { FormEvent, useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Search, Star, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { db, DeliveryProduct, errorMessage, img, money } from "@/lib/delivery";

type Draft = { id?: string; nombre: string; descripcion: string; categoria: string; precio: string; precio_anterior: string; stock: string; imagen_url: string; destacado: boolean; disponible: boolean };
const emptyDraft: Draft = { nombre: "", descripcion: "", categoria: "", precio: "", precio_anterior: "", stock: "", imagen_url: "", destacado: false, disponible: true };

const toDraft = (product: DeliveryProduct): Draft => ({
  id: product.id,
  nombre: product.nombre,
  descripcion: product.descripcion || "",
  categoria: product.categoria,
  precio: String(product.precio),
  precio_anterior: product.precio_anterior ? String(product.precio_anterior) : "",
  stock: product.stock === null || product.stock === undefined ? "" : String(product.stock),
  imagen_url: product.imagen_url || "",
  destacado: Boolean(product.destacado),
  disponible: product.disponible,
});

export function MerchantMenu({ storeId, products, onChange }: { storeId: string; products: DeliveryProduct[]; onChange: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [term, setTerm] = useState("");
  const categories = useMemo(() => [...new Set(products.map((product) => product.categoria))], [products]);
  const filtered = products.filter((product) => `${product.nombre} ${product.categoria}`.toLowerCase().includes(term.trim().toLowerCase()));
  const groups = [...new Set(filtered.map((product) => product.categoria))];

  const toggle = async (product: DeliveryProduct, field: "disponible" | "destacado") => {
    const { error } = await db.from("delivery_productos").update({ [field]: !product[field] }).eq("id", product.id);
    if (error) return toast.error(errorMessage(error));
    onChange();
  };

  const remove = async (product: DeliveryProduct) => {
    if (!window.confirm(`¿Eliminar “${product.nombre}”? Los pedidos anteriores no se ven afectados.`)) return;
    const { error } = await db.from("delivery_productos").delete().eq("id", product.id);
    if (error) return toast.error(errorMessage(error));
    toast.success("Producto eliminado");
    onChange();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-full bg-muted px-4"><Search className="h-4 w-4 text-muted-foreground" /><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar en tu menú" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <Button className="rounded-full" onClick={() => setDraft({ ...emptyDraft, categoria: categories[0] || "Destacados" })}><Plus className="h-4 w-4" />Nuevo producto</Button>
      </div>

      {products.length === 0 ? (
        <EmptyState className="mt-4" icon={<UtensilsCrossed className="h-7 w-7" />} title="Tu menú está vacío" text="Cargá tus productos con foto y precio para empezar a vender." action={<Button className="rounded-full" onClick={() => setDraft({ ...emptyDraft, categoria: "Destacados" })}><Plus className="h-4 w-4" />Cargar el primero</Button>} />
      ) : groups.map((group) => (
        <section key={group} className="mt-6">
          <h3 className="mb-2 font-extrabold">{group}</h3>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {filtered.filter((product) => product.categoria === group).map((product) => (
              <li key={product.id} className="flex items-center gap-3 p-3">
                <img src={img(product.imagen_url, 160)} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-bold">{product.destacado && <Star className="h-3.5 w-3.5 shrink-0 fill-warning text-warning" />}{product.nombre}</p>
                  <p className="text-sm"><span className="font-bold">{money(product.precio)}</span>{product.precio_anterior && <span className="ml-2 text-xs text-muted-foreground line-through">{money(product.precio_anterior)}</span>}{product.stock !== null && product.stock !== undefined && <span className="ml-2 text-xs text-muted-foreground">Stock: {product.stock}</span>}</p>
                </div>
                <label className="hidden items-center gap-2 text-xs font-semibold text-muted-foreground sm:flex">{product.disponible ? "Disponible" : "Pausado"}<Switch checked={product.disponible} onCheckedChange={() => toggle(product, "disponible")} /></label>
                <Switch className="sm:hidden" checked={product.disponible} onCheckedChange={() => toggle(product, "disponible")} aria-label="Disponible" />
                <Button size="icon" variant="ghost" aria-label={product.destacado ? "Quitar de destacados" : "Destacar"} onClick={() => toggle(product, "destacado")}><Star className={product.destacado ? "h-4 w-4 fill-warning text-warning" : "h-4 w-4"} /></Button>
                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => setDraft(toDraft(product))}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" aria-label="Eliminar" onClick={() => remove(product)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <ProductEditor storeId={storeId} draft={draft} categories={categories} onClose={() => setDraft(null)} onSaved={() => { setDraft(null); onChange(); }} />
    </div>
  );
}

function ProductEditor({ storeId, draft, categories, onClose, onSaved }: { storeId: string; draft: Draft | null; categories: string[]; onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<Draft | null>(null);
  if (draft !== openedFor) { setOpenedFor(draft); if (draft) setValues(draft); }
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const precio = Number(values.precio);
    if (!values.nombre.trim() || !(precio > 0)) return toast.error("Completá nombre y precio");
    const payload = {
      comercio_id: storeId,
      nombre: values.nombre.trim(),
      descripcion: values.descripcion.trim() || null,
      categoria: values.categoria.trim() || "Destacados",
      precio,
      precio_anterior: values.precio_anterior ? Number(values.precio_anterior) : null,
      stock: values.stock === "" ? null : Math.max(0, Math.floor(Number(values.stock))),
      imagen_url: values.imagen_url.trim() || null,
      destacado: values.destacado,
      disponible: values.disponible,
    };
    setSaving(true);
    const { error } = values.id
      ? await db.from("delivery_productos").update(payload).eq("id", values.id)
      : await db.from("delivery_productos").insert(payload);
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(values.id ? "Producto actualizado" : "Producto creado");
    onSaved();
  };

  return (
    <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle className="text-xl font-extrabold">{values.id ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-nombre">Nombre</Label><Input id="p-nombre" required maxLength={80} value={values.nombre} onChange={(event) => set("nombre", event.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="p-desc">Descripción</Label><Textarea id="p-desc" maxLength={300} value={values.descripcion} onChange={(event) => set("descripcion", event.target.value)} className="min-h-[64px]" /></div>
          <div className="space-y-1.5"><Label htmlFor="p-cat">Sección del menú</Label><Input id="p-cat" list="menu-sections" maxLength={40} value={values.categoria} onChange={(event) => set("categoria", event.target.value)} /><datalist id="menu-sections">{categories.map((item) => <option key={item} value={item} />)}</datalist></div>
          <div className="space-y-1.5"><Label htmlFor="p-stock">Stock (vacío = ilimitado)</Label><Input id="p-stock" type="number" min={0} value={values.stock} onChange={(event) => set("stock", event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="p-precio">Precio ($)</Label><Input id="p-precio" type="number" min={1} required value={values.precio} onChange={(event) => set("precio", event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="p-antes">Precio anterior (para mostrar oferta)</Label><Input id="p-antes" type="number" min={0} value={values.precio_anterior} onChange={(event) => set("precio_anterior", event.target.value)} /></div>
          <ImageUpload label="Foto del producto" folder="productos" shape="square" value={values.imagen_url} onChange={(url) => set("imagen_url", url)} className="sm:col-span-2" />
          <div className="flex flex-col justify-center gap-3 sm:col-span-2 sm:flex-row sm:justify-start sm:gap-6">
            <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={values.disponible} onCheckedChange={(checked) => set("disponible", checked)} />Disponible</label>
            <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={values.destacado} onCheckedChange={(checked) => set("destacado", checked)} />Destacado</label>
          </div>
          <Button type="submit" className="rounded-full sm:col-span-2" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

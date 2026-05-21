import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Package, Eye, EyeOff, Settings2, Upload, X } from "lucide-react";
import { PRODUCT_TYPES, slugify, formatPrice } from "@/lib/marketplace";
import { toast } from "sonner";
import { BackHeader } from "@/components/lin/BackHeader";

export default function VendedorProductos() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: prods }, { data: cs }] = await Promise.all([
      (supabase as any).from("marketplace_productos").select("*").eq("vendedor_id", user.id).order("created_at", { ascending: false }),
      (supabase as any).from("marketplace_categorias").select("*").order("orden"),
    ]);
    setItems(prods || []);
    setCats(cs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const togglePublish = async (p: any) => {
    const newEstado = p.estado === "activo" ? "pausado" : "activo";
    await (supabase as any).from("marketplace_productos").update({ estado: newEstado }).eq("id", p.id);
    load();
  };

  const remove = async (p: any) => {
    if (!confirm(`¿Eliminar "${p.titulo}"? Esta acción no se puede deshacer.`)) return;
    await (supabase as any).from("marketplace_productos").delete().eq("id", p.id);
    load();
  };

  return (
    <>
      <BackHeader title="Mis productos" />
      <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mis productos</h1>
          <p className="text-sm text-muted-foreground">Gestioná tu catálogo en el Mercado.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="gap-1.5"><Link to="/lin/vendedor/configurar"><Settings2 className="h-4 w-4" /> Configurar pagos</Link></Button>
          <Button asChild variant="outline" className="gap-1.5"><Link to="/lin/vendedor/ordenes">Órdenes</Link></Button>
          <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo producto</Button>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : items.length === 0 ? (
          <Card><CardContent className="p-10 text-center">
            <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-semibold">Sin productos todavía</p>
            <p className="mt-1 text-sm text-muted-foreground">Empezá a vender tu primer producto digital.</p>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="mt-4 gap-1.5"><Plus className="h-4 w-4" /> Crear producto</Button>
          </CardContent></Card>
        ) : items.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-secondary">
                {p.portada_url ? <img src={p.portada_url} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-2xl opacity-30">📦</div>}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-semibold">{p.titulo}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.estado === "activo" ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{p.estado}</span>
                </div>
                <p className="text-xs text-muted-foreground">{formatPrice(Number(p.precio), p.moneda)} · {p.total_ventas} ventas · {p.total_vistas} vistas</p>
              </div>
              <Button size="icon" variant="ghost" onClick={() => togglePublish(p)} title={p.estado === "activo" ? "Pausar" : "Activar"}>
                {p.estado === "activo" ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => remove(p)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
          <ProductForm
            initial={editing}
            cats={cats}
            onSaved={() => { setOpen(false); load(); }}
          />
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}

function ProductForm({ initial, cats, onSaved }: { initial: any; cats: any[]; onSaved: () => void }) {
  const { user } = useAuth();
  const [titulo, setTitulo] = useState(initial?.titulo || "");
  const [resumen, setResumen] = useState(initial?.resumen || "");
  const [desc, setDesc] = useState(initial?.descripcion || "");
  const [precio, setPrecio] = useState<number>(Number(initial?.precio) || 0);
  const [moneda, setMoneda] = useState(initial?.moneda || "USD");
  const [tipo, setTipo] = useState(initial?.tipo || "archivo");
  const [categoriaId, setCategoriaId] = useState(initial?.categoria_id || "");
  const [portada, setPortada] = useState(initial?.portada_url || "");
  const [demoUrl, setDemoUrl] = useState(initial?.demo_url || "");
  const [tags, setTags] = useState((initial?.tags || []).join(", "));
  const [archivoExterno, setArchivoExterno] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const uploadPortada = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const path = `${user.id}/${Date.now()}-${file.name}`;
    const { error } = await (supabase as any).storage.from("marketplace-portadas").upload(path, file);
    if (error) { toast.error("Error al subir imagen"); setUploading(false); return; }
    const { data } = (supabase as any).storage.from("marketplace-portadas").getPublicUrl(path);
    setPortada(data.publicUrl);
    setUploading(false);
  };

  const save = async () => {
    if (!user) return;
    if (!titulo.trim() || !desc.trim()) { toast.error("Título y descripción requeridos"); return; }
    setSaving(true);
    const slug = initial?.slug || `${slugify(titulo)}-${Math.random().toString(36).slice(2, 6)}`;
    const payload: any = {
      vendedor_id: user.id,
      titulo: titulo.trim(),
      slug,
      resumen: resumen.trim() || null,
      descripcion: desc.trim(),
      tipo,
      precio,
      moneda,
      categoria_id: categoriaId || null,
      portada_url: portada || null,
      demo_url: demoUrl.trim() || null,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    let productoId = initial?.id;
    if (initial) {
      const { error } = await (supabase as any).from("marketplace_productos").update(payload).eq("id", initial.id);
      if (error) { toast.error("Error al actualizar"); setSaving(false); return; }
    } else {
      const { data, error } = await (supabase as any).from("marketplace_productos").insert(payload).select().single();
      if (error) { toast.error("Error al crear: " + error.message); setSaving(false); return; }
      productoId = data.id;
    }

    // Si es archivo y hay un link externo, lo guardamos como entrega
    if (archivoExterno.trim() && productoId) {
      await (supabase as any).from("marketplace_archivos").insert({
        producto_id: productoId,
        nombre: "Link de entrega",
        storage_path: "",
        contenido_externo: archivoExterno.trim(),
        tipo: "link",
      });
    }

    setSaving(false);
    toast.success(initial ? "Producto actualizado" : "Producto publicado");
    onSaved();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Título *</Label>
        <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej: Plantilla Notion para startups" />
      </div>
      <div>
        <Label>Resumen corto</Label>
        <Input value={resumen} onChange={(e) => setResumen(e.target.value)} placeholder="Una línea para enganchar" />
      </div>
      <div>
        <Label>Descripción detallada *</Label>
        <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={5} placeholder="Qué incluye, qué problema resuelve, qué se llevan…" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Precio</Label>
          <Input type="number" min={0} step="0.01" value={precio} onChange={(e) => setPrecio(Number(e.target.value))} />
        </div>
        <div>
          <Label>Moneda</Label>
          <Select value={moneda} onValueChange={setMoneda}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="BRL">BRL</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Tipo</Label>
          <Select value={tipo} onValueChange={setTipo}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PRODUCT_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.icon} {t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Categoría</Label>
        <Select value={categoriaId} onValueChange={setCategoriaId}>
          <SelectTrigger><SelectValue placeholder="Elegí una categoría" /></SelectTrigger>
          <SelectContent>
            {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Portada</Label>
        {portada ? (
          <div className="relative mt-1 overflow-hidden rounded-lg border">
            <img src={portada} className="aspect-video w-full object-cover" />
            <Button size="icon" variant="secondary" onClick={() => setPortada("")} className="absolute right-2 top-2"><X className="h-4 w-4" /></Button>
          </div>
        ) : (
          <label className="mt-1 flex aspect-video w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground hover:bg-secondary/50">
            {uploading ? "Subiendo…" : <><Upload className="mr-1.5 h-4 w-4" /> Subir imagen</>}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadPortada(e.target.files[0])} />
          </label>
        )}
      </div>

      <div>
        <Label>Demo / preview (opcional)</Label>
        <Input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="https://..." />
      </div>

      <div>
        <Label>Tags (separados por coma)</Label>
        <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="notion, startup, productividad" />
      </div>

      {!initial && (
        <div>
          <Label>Link de entrega tras pago (opcional)</Label>
          <Input value={archivoExterno} onChange={(e) => setArchivoExterno(e.target.value)} placeholder="Google Drive, Notion, Gumroad, link directo…" />
          <p className="mt-1 text-xs text-muted-foreground">Se entrega automáticamente al comprador cuando confirmes el pago.</p>
        </div>
      )}

      <Button onClick={save} disabled={saving} size="lg" className="w-full">{saving ? "Guardando…" : (initial ? "Guardar cambios" : "Publicar producto")}</Button>
    </div>
  );
}

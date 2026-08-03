import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ImagePlus, Loader2, Trash2, Save, Box } from "lucide-react";
import {
  OPERACIONES, TIPOS_INMUEBLE, ESTADOS_PROPIEDAD, AMENITIES, MONEDAS, slugifyPropiedad,
} from "@/lib/inmobiliaria";
import { toast } from "sonner";

const MAX_IMG = 8 * 1024 * 1024;
const TIPOS_IMG = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const vacio = {
  titulo: "", descripcion: "", operacion: "venta", tipo: "departamento",
  precio: "", moneda: "USD", expensas: "", m2_totales: "", m2_cubiertos: "",
  ambientes: "", dormitorios: "", banos: "", cocheras: "", antiguedad: "",
  direccion: "", barrio: "", ciudad: "", provincia: "", pais: "Argentina",
  estado: "activa",
};

export default function NuevaPropiedad() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get("id");

  const [f, setF] = useState<any>(vacio);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [imagenes, setImagenes] = useState<string[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(!!editId);
  const [slug, setSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!editId || !user) return;
    (async () => {
      const { data } = await (supabase as any).from("propiedades").select("*").eq("id", editId).maybeSingle();
      if (!data || data.agente_id !== user.id) {
        toast.error("No podés editar esta propiedad");
        navigate("/lin/mis-propiedades");
        return;
      }
      setF({
        titulo: data.titulo ?? "", descripcion: data.descripcion ?? "",
        operacion: data.operacion, tipo: data.tipo,
        precio: data.precio ?? "", moneda: data.moneda ?? "USD",
        expensas: data.expensas ?? "", m2_totales: data.m2_totales ?? "", m2_cubiertos: data.m2_cubiertos ?? "",
        ambientes: data.ambientes ?? "", dormitorios: data.dormitorios ?? "", banos: data.banos ?? "",
        cocheras: data.cocheras ?? "", antiguedad: data.antiguedad ?? "",
        direccion: data.direccion ?? "", barrio: data.barrio ?? "", ciudad: data.ciudad ?? "",
        provincia: data.provincia ?? "", pais: data.pais ?? "Argentina", estado: data.estado,
      });
      setAmenities(data.amenities || []);
      setSlug(data.slug);
      const { data: md } = await (supabase as any)
        .from("propiedad_media").select("url,tipo,orden").eq("propiedad_id", editId).order("orden");
      const urls = [data.portada_url, ...(md || []).filter((m: any) => m.tipo === "imagen").map((m: any) => m.url)].filter(Boolean);
      setImagenes(Array.from(new Set(urls)) as string[]);
      setCargando(false);
    })();
  }, [editId, user, navigate]);

  const set = (k: string, v: any) => setF((prev: any) => ({ ...prev, [k]: v }));

  const subirImagenes = async (files: FileList | null) => {
    if (!files?.length || !user) return;
    setSubiendo(true);
    const nuevas: string[] = [];
    for (const file of Array.from(files).slice(0, 10)) {
      if (!TIPOS_IMG.includes(file.type)) { toast.error(`${file.name}: formato no permitido`); continue; }
      if (file.size > MAX_IMG) { toast.error(`${file.name}: supera los 8 MB`); continue; }
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("propiedades").upload(path, file, { contentType: file.type });
      if (error) { toast.error(`No se pudo subir ${file.name}`); continue; }
      const { data } = supabase.storage.from("propiedades").getPublicUrl(path);
      nuevas.push(data.publicUrl);
    }
    setImagenes((prev) => [...prev, ...nuevas]);
    setSubiendo(false);
    if (nuevas.length) toast.success(`${nuevas.length} imagen(es) agregada(s)`);
  };

  const num = (v: any) => (v === "" || v === null || v === undefined ? null : Number(v));

  const guardar = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!f.titulo.trim()) { toast.error("Poné un título"); return; }
    if (!f.ciudad.trim()) { toast.error("Indicá la ciudad"); return; }
    setGuardando(true);

    const payload: any = {
      agente_id: user.id,
      titulo: f.titulo.trim(),
      descripcion: f.descripcion.trim() || null,
      operacion: f.operacion,
      tipo: f.tipo,
      precio: num(f.precio) ?? 0,
      moneda: f.moneda,
      expensas: num(f.expensas),
      m2_totales: num(f.m2_totales),
      m2_cubiertos: num(f.m2_cubiertos),
      ambientes: num(f.ambientes),
      dormitorios: num(f.dormitorios),
      banos: num(f.banos),
      cocheras: num(f.cocheras) ?? 0,
      antiguedad: num(f.antiguedad),
      direccion: f.direccion.trim() || null,
      barrio: f.barrio.trim() || null,
      ciudad: f.ciudad.trim(),
      provincia: f.provincia.trim() || null,
      pais: f.pais.trim() || null,
      amenities,
      estado: f.estado,
      portada_url: imagenes[0] ?? null,
    };

    let propId = editId;
    let propSlug = slug;

    if (editId) {
      const { error } = await (supabase as any).from("propiedades").update(payload).eq("id", editId);
      if (error) { setGuardando(false); toast.error("No se pudo guardar"); return; }
    } else {
      payload.slug = slugifyPropiedad(f.titulo);
      const { data, error } = await (supabase as any).from("propiedades").insert(payload).select("id,slug").single();
      if (error || !data) { setGuardando(false); toast.error("No se pudo publicar"); return; }
      propId = data.id;
      propSlug = data.slug;
    }

    // Sincronizar galería
    await (supabase as any).from("propiedad_media").delete().eq("propiedad_id", propId).eq("tipo", "imagen");
    if (imagenes.length > 1) {
      await (supabase as any).from("propiedad_media").insert(
        imagenes.slice(1).map((url, i) => ({ propiedad_id: propId, url, tipo: "imagen", orden: i }))
      );
    }

    setGuardando(false);
    toast.success(editId ? "Propiedad actualizada" : "Propiedad publicada");
    navigate(propSlug ? `/lin/propiedades/${propSlug}` : "/lin/mis-propiedades");
  };

  if (cargando) {
    return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="gap-1.5">
        <Link to="/lin/mis-propiedades"><ArrowLeft className="h-4 w-4" /> Mis propiedades</Link>
      </Button>
      <h1 className="mt-3 text-2xl font-bold">{editId ? "Editar propiedad" : "Publicar propiedad"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Completá la ficha. Después podés generar el recorrido 3D desde Mis propiedades.
      </p>

      <div className="mt-6 space-y-4">
        {/* BÁSICO */}
        <Card><CardContent className="space-y-4 p-5">
          <div>
            <Label>Título</Label>
            <Input value={f.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Departamento 3 ambientes con balcón en Palermo" />
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea value={f.descripcion} onChange={(e) => set("descripcion", e.target.value)} rows={5} placeholder="Detalles, estado, orientación, servicios cercanos…" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Operación</Label>
              <Select value={f.operacion} onValueChange={(v) => set("operacion", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{OPERACIONES.map((o) => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={f.tipo} onValueChange={(v) => set("tipo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS_INMUEBLE.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Estado</Label>
              <Select value={f.estado} onValueChange={(v) => set("estado", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ESTADOS_PROPIEDAD.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </CardContent></Card>

        {/* PRECIO */}
        <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <Label>Precio</Label>
            <Input type="number" min={0} value={f.precio} onChange={(e) => set("precio", e.target.value)} placeholder="150000" />
          </div>
          <div>
            <Label>Moneda</Label>
            <Select value={f.moneda} onValueChange={(v) => set("moneda", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Expensas</Label>
            <Input type="number" min={0} value={f.expensas} onChange={(e) => set("expensas", e.target.value)} placeholder="Opcional" />
          </div>
        </CardContent></Card>

        {/* CARACTERÍSTICAS */}
        <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          {[
            ["m2_totales", "Sup. total (m²)"], ["m2_cubiertos", "Sup. cubierta (m²)"], ["ambientes", "Ambientes"],
            ["dormitorios", "Dormitorios"], ["banos", "Baños"], ["cocheras", "Cocheras"], ["antiguedad", "Antigüedad (años)"],
          ].map(([k, label]) => (
            <div key={k}>
              <Label>{label}</Label>
              <Input type="number" min={0} value={f[k]} onChange={(e) => set(k, e.target.value)} />
            </div>
          ))}
        </CardContent></Card>

        {/* UBICACIÓN */}
        <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div><Label>Dirección</Label><Input value={f.direccion} onChange={(e) => set("direccion", e.target.value)} placeholder="Av. Santa Fe 3200" /></div>
          <div><Label>Barrio</Label><Input value={f.barrio} onChange={(e) => set("barrio", e.target.value)} placeholder="Palermo" /></div>
          <div><Label>Ciudad</Label><Input value={f.ciudad} onChange={(e) => set("ciudad", e.target.value)} placeholder="Buenos Aires" /></div>
          <div><Label>Provincia</Label><Input value={f.provincia} onChange={(e) => set("provincia", e.target.value)} placeholder="CABA" /></div>
          <div><Label>País</Label><Input value={f.pais} onChange={(e) => set("pais", e.target.value)} /></div>
        </CardContent></Card>

        {/* AMENITIES */}
        <Card><CardContent className="p-5">
          <Label>Amenities</Label>
          <div className="mt-3 flex flex-wrap gap-2">
            {AMENITIES.map((a) => {
              const on = amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() => setAmenities((prev) => on ? prev.filter((x) => x !== a) : [...prev, a])}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    on ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary/60"
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </CardContent></Card>

        {/* FOTOS */}
        <Card><CardContent className="p-5">
          <div className="flex items-center justify-between">
            <Label>Fotos</Label>
            <Badge variant="secondary">{imagenes.length} · la primera es la portada</Badge>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
            {imagenes.map((url, i) => (
              <div key={url} className="group relative aspect-[4/3] overflow-hidden rounded-lg border">
                <img src={url} alt="" className="h-full w-full object-cover" />
                {i === 0 && <Badge className="absolute left-1 top-1 text-[10px]">Portada</Badge>}
                <button
                  type="button"
                  aria-label="Quitar foto"
                  onClick={() => setImagenes((prev) => prev.filter((u) => u !== url))}
                  className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition hover:border-primary hover:text-primary">
              {subiendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              <span className="text-xs">Agregar</span>
              <input type="file" accept="image/*" multiple hidden onChange={(e) => subirImagenes(e.target.files)} />
            </label>
          </div>
        </CardContent></Card>

        <div className="flex flex-wrap gap-2 pb-8">
          <Button onClick={guardar} disabled={guardando} size="lg" className="gap-1.5">
            {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {editId ? "Guardar cambios" : "Publicar propiedad"}
          </Button>
          {editId && (
            <Button asChild variant="outline" size="lg" className="gap-1.5">
              <Link to="/lin/mis-propiedades"><Box className="h-4 w-4" /> Generar tour 3D</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

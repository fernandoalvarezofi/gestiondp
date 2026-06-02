import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ESTADO_PROYECTO } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { BackHeader } from "@/components/lin/BackHeader";
import {
  Upload, X, Plus, Image as ImageIcon, Rocket, Globe, Github, ExternalLink,
  Youtube, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIAS = ["SaaS","IA","DevTools","FinTech","EdTech","Health","Marketplace","Web3","Hardware","Otro"];
const BUSCANDO = ["Co-founder","Desarrollador","Diseñador","Marketing","Inversión","Advisors"];
const FUNDING = [
  { id: "idea", label: "Idea" },
  { id: "bootstrapped", label: "Bootstrapped" },
  { id: "pre_seed", label: "Pre-seed" },
  { id: "seed", label: "Seed" },
  { id: "serie_a", label: "Serie A+" },
];

const MAX_LOGO = 2 * 1024 * 1024;
const MAX_PORTADA = 5 * 1024 * 1024;
const MAX_MEDIA = 5;

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function videoEmbed(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

type MediaItem = { url: string; storage_path: string };

export default function NuevoProyecto() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [tagline, setTagline] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoria, setCategoria] = useState<string>("");
  const [estado, setEstado] = useState("lanzado");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const [sitioWeb, setSitioWeb] = useState("");
  const [demoUrl, setDemoUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");

  const [buscando, setBuscando] = useState<string[]>([]);
  const [funding, setFunding] = useState<string>("idea");

  const [logo, setLogo] = useState<MediaItem | null>(null);
  const [portada, setPortada] = useState<MediaItem | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingPortada, setUploadingPortada] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const logoRef = useRef<HTMLInputElement>(null);
  const portadaRef = useRef<HTMLInputElement>(null);
  const mediaRef = useRef<HTMLInputElement>(null);

  const embed = useMemo(() => videoEmbed(videoUrl), [videoUrl]);

  // Cleanup uploaded files if user leaves without submitting
  useEffect(() => {
    return () => {
      // best-effort; user may navigate away
    };
  }, []);

  if (!user) {
    return (
      <>
        <BackHeader title="Nuevo proyecto" />
        <div className="mx-auto max-w-md py-10 text-center text-sm text-muted-foreground">
          Iniciá sesión para lanzar un proyecto.
        </div>
      </>
    );
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, "");
    if (!t) return;
    if (tags.length >= 5) { toast.error("Máximo 5 tags"); return; }
    if (tags.includes(t)) { setTagInput(""); return; }
    setTags([...tags, t]);
    setTagInput("");
  };

  const toggleBuscando = (b: string) => {
    setBuscando((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]);
  };

  const uploadTo = async (bucket: string, file: File): Promise<MediaItem> => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const url = supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
    return { url, storage_path: path };
  };

  const onPickLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Tiene que ser una imagen"); return; }
    if (file.size > MAX_LOGO) { toast.error("Máximo 2MB"); return; }
    setUploadingLogo(true);
    try {
      if (logo?.storage_path) await supabase.storage.from("proyectos-logos").remove([logo.storage_path]);
      const item = await uploadTo("proyectos-logos", file);
      setLogo(item);
    } catch (e: any) { toast.error(e.message || "No se pudo subir el logo"); }
    finally { setUploadingLogo(false); }
  };

  const onPickPortada = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Tiene que ser una imagen"); return; }
    if (file.size > MAX_PORTADA) { toast.error("Máximo 5MB"); return; }
    setUploadingPortada(true);
    try {
      if (portada?.storage_path) await supabase.storage.from("proyectos-portadas").remove([portada.storage_path]);
      const item = await uploadTo("proyectos-portadas", file);
      setPortada(item);
    } catch (e: any) { toast.error(e.message || "No se pudo subir la portada"); }
    finally { setUploadingPortada(false); }
  };

  const onPickMedia = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_MEDIA - media.length;
    if (room <= 0) { toast.error(`Máximo ${MAX_MEDIA} imágenes`); return; }
    const list = Array.from(files).slice(0, room);
    setUploadingMedia(true);
    try {
      const uploaded: MediaItem[] = [];
      for (const f of list) {
        if (!f.type.startsWith("image/")) continue;
        if (f.size > MAX_PORTADA) { toast.error(`"${f.name}" supera 5MB`); continue; }
        uploaded.push(await uploadTo("proyectos-media", f));
      }
      setMedia((prev) => [...prev, ...uploaded]);
    } catch (e: any) { toast.error(e.message || "No se pudo subir"); }
    finally { setUploadingMedia(false); }
  };

  const removeMedia = async (idx: number) => {
    const item = media[idx];
    if (item?.storage_path) await supabase.storage.from("proyectos-media").remove([item.storage_path]);
    setMedia((prev) => prev.filter((_, i) => i !== idx));
  };

  const removeLogo = async () => {
    if (logo?.storage_path) await supabase.storage.from("proyectos-logos").remove([logo.storage_path]);
    setLogo(null);
  };
  const removePortada = async () => {
    if (portada?.storage_path) await supabase.storage.from("proyectos-portadas").remove([portada.storage_path]);
    setPortada(null);
  };

  const canSubmit = nombre.trim().length >= 2 && tagline.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    if (tagline.length > 80) { toast.error("La tagline supera 80 caracteres"); return; }
    setSubmitting(true);
    try {
      const baseSlug = slugify(nombre) || "proyecto";
      const slug = `${baseSlug}-${Date.now().toString(36)}`;
      const { data: proy, error } = await (supabase as any).from("proyectos").insert({
        perfil_id: user.id,
        nombre: nombre.trim(),
        slug,
        tagline: tagline.trim(),
        descripcion: descripcion.trim() || tagline.trim(),
        categoria: categoria || null,
        estado,
        tags: tags.length ? tags : null,
        buscando: buscando.length ? buscando : null,
        sitio_web: sitioWeb.trim() || null,
        demo_url: demoUrl.trim() || null,
        repo_url: repoUrl.trim() || null,
        video_demo_url: videoUrl.trim() || null,
        logo_url: logo?.url || null,
        portada_url: portada?.url || null,
        funding_etapa: funding || null,
      }).select("id, slug").single();
      if (error) throw error;

      // Insert media
      if (media.length > 0) {
        const rows = media.map((m, i) => ({
          proyecto_id: proy.id, url: m.url, storage_path: m.storage_path, orden: i,
        }));
        await (supabase as any).from("proyecto_media").insert(rows);
      }

      // Add creator as founder member
      await (supabase as any).from("proyecto_miembros").insert({
        proyecto_id: proy.id, perfil_id: user.id, es_fundador: true, rol: "fundador",
      });

      // Publicación automática para que el lanzamiento aparezca en Feed/Explorar.
      await (supabase as any).from("publicaciones").insert({
        perfil_id: user.id,
        tipo: "proyecto",
        formato: "proyecto",
        estado: "activa",
        titulo: nombre.trim(),
        cuerpo: descripcion.trim() || tagline.trim(),
        imagen_url: portada?.url || logo?.url || null,
        tags: tags.length ? tags : null,
      });

      toast.success("Proyecto lanzado");
      navigate(`/lin/proyectos/${proy.slug}`);
    } catch (e: any) {
      toast.error(e.message || "No se pudo crear el proyecto");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <BackHeader title="Lanzar producto" />
      <div className="mx-auto max-w-5xl px-3 pb-32 sm:px-4">
        <header className="mb-5 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Nuevo lanzamiento</p>
          <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">Contale al mundo qué construiste.</h1>
          <p className="text-sm text-muted-foreground">Subí logo, portada, screenshots, links y a quién buscás. Lo necesario para lanzar bien.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* LEFT: Visual identity */}
          <div className="space-y-6">
            <Section title="Identidad visual" subtitle="Lo primero que ven cuando entran a tu producto.">
              {/* Logo */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Logo (cuadrado · máx 2MB)</Label>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => logoRef.current?.click()}
                    className={cn(
                      "relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-dashed bg-secondary/40 transition-colors hover:border-primary",
                      logo && "border-solid border-transparent"
                    )}
                  >
                    {uploadingLogo ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> :
                      logo ? <img src={logo.url} alt="logo" className="h-full w-full object-cover" /> :
                      <Upload className="h-5 w-5 text-muted-foreground" />}
                  </button>
                  <div className="space-y-1.5">
                    <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()} disabled={uploadingLogo}>
                      {logo ? "Cambiar logo" : "Subir logo"}
                    </Button>
                    {logo && (
                      <Button type="button" variant="ghost" size="sm" onClick={removeLogo} className="text-xs text-muted-foreground">
                        <X className="h-3 w-3" /> Quitar
                      </Button>
                    )}
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => onPickLogo(e.target.files?.[0])} />
                </div>
              </div>

              {/* Portada */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Portada (16:9 · máx 5MB)</Label>
                <button
                  type="button"
                  onClick={() => portadaRef.current?.click()}
                  className={cn(
                    "relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-secondary/40 transition-colors hover:border-primary",
                    portada && "border-solid border-transparent"
                  )}
                >
                  {uploadingPortada ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /> :
                    portada ? <img src={portada.url} alt="portada" className="h-full w-full object-cover" /> :
                    <div className="flex flex-col items-center gap-1.5 text-muted-foreground">
                      <ImageIcon className="h-6 w-6" />
                      <span className="text-xs">Click para subir portada</span>
                    </div>}
                </button>
                {portada && (
                  <Button type="button" variant="ghost" size="sm" onClick={removePortada} className="text-xs text-muted-foreground">
                    <X className="h-3 w-3" /> Quitar portada
                  </Button>
                )}
                <input ref={portadaRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => onPickPortada(e.target.files?.[0])} />
              </div>

              {/* Screenshots */}
              <div className="space-y-2">
                <div className="flex items-end justify-between">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Screenshots ({media.length}/{MAX_MEDIA})
                  </Label>
                  <Button type="button" variant="outline" size="sm" onClick={() => mediaRef.current?.click()}
                    disabled={uploadingMedia || media.length >= MAX_MEDIA}>
                    {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    Agregar
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {media.map((m, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-lg border bg-secondary">
                      <img src={m.url} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeMedia(i)}
                        className="absolute right-1 top-1 rounded-full bg-background/90 p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  {media.length < MAX_MEDIA && (
                    <button type="button" onClick={() => mediaRef.current?.click()}
                      className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                      <Plus className="h-5 w-5" />
                    </button>
                  )}
                </div>
                <input ref={mediaRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { onPickMedia(e.target.files); e.target.value = ""; }} />
              </div>
            </Section>

            {/* Preview en vivo */}
            <Section title="Vista previa" subtitle="Así se ve tu lanzamiento en el ranking.">
              <div className="flex items-center gap-3 rounded-2xl border bg-card p-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-secondary">
                  {logo?.url ? <img src={logo.url} alt="" className="h-full w-full object-cover" /> :
                    portada?.url ? <img src={portada.url} alt="" className="h-full w-full object-cover" /> :
                    <div className="flex h-full w-full items-center justify-center"><Rocket className="h-5 w-5 text-foreground/30" /></div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold leading-tight">{nombre || "Nombre del producto"}</p>
                  <p className="line-clamp-1 text-[13px] text-muted-foreground">{tagline || "Tu tagline aparece acá."}</p>
                </div>
              </div>
            </Section>
          </div>

          {/* RIGHT: Info */}
          <div className="space-y-6">
            <Section title="Información básica" subtitle="Lo esencial para que entiendan tu producto en 5 segundos.">
              <Field label="Nombre del proyecto" required>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Notion para devs" maxLength={80} />
              </Field>
              <Field label={`Tagline (${tagline.length}/80)`} required hint="Una línea, sin punto final. Vendé en un suspiro.">
                <Input value={tagline} onChange={(e) => setTagline(e.target.value.slice(0, 80))}
                  placeholder="Editor de notas con IA para programadores" />
              </Field>
              <Field label="Descripción larga">
                <Textarea rows={8} value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="¿Qué hace? ¿Para quién es? ¿Por qué te importa?" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Categoría">
                  <Select value={categoria} onValueChange={setCategoria}>
                    <SelectTrigger><SelectValue placeholder="Elegí una" /></SelectTrigger>
                    <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Estado">
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(ESTADO_PROYECTO).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label={`Tags (${tags.length}/5)`} hint="Enter para agregar.">
                <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
                  {tags.map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 pr-1">
                      {t}
                      <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} className="ml-0.5 rounded-full p-0.5 hover:bg-background">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                    placeholder={tags.length === 0 ? "ej: ai, productivity" : ""}
                    className="min-w-[120px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                </div>
              </Field>
            </Section>

            <Section title="Links" subtitle="Mostrá tu producto en acción.">
              <Field label="Sitio web" icon={Globe}>
                <Input value={sitioWeb} onChange={(e) => setSitioWeb(e.target.value)} placeholder="https://" />
              </Field>
              <Field label="Demo URL" icon={ExternalLink}>
                <Input value={demoUrl} onChange={(e) => setDemoUrl(e.target.value)} placeholder="https://demo.tuproducto.com" />
              </Field>
              <Field label="Repositorio GitHub" icon={Github}>
                <Input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/usuario/repo" />
              </Field>
              <Field label="Video demo (YouTube o Vimeo)" icon={Youtube}>
                <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
              </Field>
              {embed && (
                <div className="overflow-hidden rounded-xl border bg-black aspect-video">
                  <iframe src={embed} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
                </div>
              )}
              {videoUrl && !embed && (
                <p className="text-xs text-amber-600">No reconocimos la URL como YouTube o Vimeo, pero la vamos a guardar igual.</p>
              )}
            </Section>

            <Section title="Equipo y búsqueda" subtitle="¿Qué necesitás para crecer?">
              <Field label="Buscando">
                <div className="flex flex-wrap gap-1.5">
                  {BUSCANDO.map((b) => {
                    const active = buscando.includes(b);
                    return (
                      <button key={b} type="button" onClick={() => toggleBuscando(b)}
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                          active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"
                        )}>
                        {b}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Etapa de funding">
                <Select value={funding} onValueChange={setFunding}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FUNDING.map((f) => <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </Section>
          </div>
        </div>
      </div>

      {/* Sticky submit bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="hidden text-xs text-muted-foreground sm:block">
            {canSubmit ? "Todo listo para lanzar." : "Falta nombre y tagline."}
          </div>
          <div className="flex flex-1 items-center justify-end gap-2 sm:flex-none">
            <Button type="button" variant="outline" onClick={() => navigate(-1)} disabled={submitting}>Cancelar</Button>
            <Button type="button" onClick={submit} disabled={!canSubmit} className="min-w-[160px] font-semibold">
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Publicando…</> :
                <><Rocket className="h-4 w-4" /> Publicar proyecto</>}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="border-b pb-2">
        <h2 className="font-display text-lg font-extrabold tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, hint, required, icon: Icon, children }: { label: string; hint?: string; required?: boolean; icon?: any; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}{required && <span className="text-primary">*</span>}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

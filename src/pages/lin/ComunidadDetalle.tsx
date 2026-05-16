import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Users } from "lucide-react";
import { initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";

export default function ComunidadDetalle() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [esMiembro, setEsMiembro] = useState(false);
  const [txt, setTxt] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [posting, setPosting] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from("comunidades").select("*").eq("slug", slug).single();
    if (!data) return;
    setC(data);
    const { data: ps } = await (supabase as any).from("comunidad_posts")
      .select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url)")
      .eq("comunidad_id", data.id).order("created_at", { ascending: false });
    setPosts(ps || []);
    if (user) {
      const { data: m } = await (supabase as any).from("comunidad_miembros").select("id").eq("comunidad_id", data.id).eq("perfil_id", user.id).maybeSingle();
      setEsMiembro(!!m);
    }
  };
  useEffect(() => { load(); }, [slug, user]);

  const toggleUnirme = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (esMiembro) await (supabase as any).from("comunidad_miembros").delete().eq("comunidad_id", c.id).eq("perfil_id", user.id);
    else await (supabase as any).from("comunidad_miembros").insert({ comunidad_id: c.id, perfil_id: user.id });
    setEsMiembro(!esMiembro);
  };

  const pickImage = (file: File | null) => { setImagen(file); setPreview(file ? URL.createObjectURL(file) : ""); };

  const postear = async () => {
    if (!txt.trim() && !imagen) return;
    setPosting(true);
    try {
      let imagen_url: string | null = null;
      if (imagen) {
        const path = `${user!.id}/${Date.now()}-${imagen.name}`;
        const { error } = await (supabase as any).storage.from("publicaciones").upload(path, imagen);
        if (error) throw error;
        imagen_url = (supabase as any).storage.from("publicaciones").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await (supabase as any).from("comunidad_posts").insert({
        comunidad_id: c.id, perfil_id: user!.id, contenido: txt || "", imagen_url,
      });
      if (error) throw error;
      setTxt(""); pickImage(null); load();
    } catch (e: any) {
      toast.error(e.message || "Error al postear");
    } finally { setPosting(false); }
  };

  if (!c) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="overflow-hidden rounded-2xl">
        <div className="h-40 w-full bg-gradient-to-br from-primary/20 to-secondary"
          style={c.portada_url ? { backgroundImage: `url(${c.portada_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        <div className="relative bg-card px-5 pb-5 pt-0">
          <div className="-mt-8 flex items-end justify-between gap-3">
            {c.avatar_url
              ? <img src={c.avatar_url} className="h-16 w-16 rounded-full border-4 border-card object-cover" alt="" />
              : <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-card bg-secondary text-lg font-semibold">{c.nombre?.[0] || "C"}</div>}
            <Button onClick={toggleUnirme} size="sm" variant={esMiembro ? "outline" : "default"}>{esMiembro ? "Salir" : "Unirme"}</Button>
          </div>
          <div className="mt-3">
            <h1 className="text-2xl font-bold tracking-tight">{c.nombre}</h1>
            <p className="flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-3.5 w-3.5" />{c.total_miembros} miembros{c.tematica ? ` · ${c.tematica}` : ""}</p>
          </div>
          {c.descripcion && <p className="mt-3 text-sm">{c.descripcion}</p>}
        </div>
      </div>

      {esMiembro && (
        <Card><CardContent className="space-y-3 p-4">
          <Textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Compartí algo con la comunidad…" rows={3} />
          {preview && (
            <div className="relative">
              <img src={preview} alt="" className="max-h-60 w-full rounded-lg border object-cover" />
              <Button size="icon" variant="secondary" className="absolute right-2 top-2 h-7 w-7" onClick={() => pickImage(null)}><X className="h-4 w-4" /></Button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ImagePlus className="h-4 w-4" /><span>{imagen ? "Cambiar imagen" : "Adjuntar imagen"}</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] || null)} />
            </label>
            <Button onClick={postear} size="sm" disabled={posting}>{posting ? "Publicando…" : "Publicar"}</Button>
          </div>
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {posts.length === 0 ? <p className="text-center text-sm text-muted-foreground">Aún no hay posts.</p>
          : posts.map((p) => (
            <Card key={p.id}><CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7"><AvatarImage src={p.perfil?.avatar_url || ""} /><AvatarFallback>{initials(p.perfil?.nombre || "??")}</AvatarFallback></Avatar>
                <p className="text-xs"><span className="font-medium">{p.perfil?.nombre}</span> · {formatTime(p.created_at)}</p>
              </div>
              {p.titulo && <p className="font-semibold">{p.titulo}</p>}
              {p.contenido && <p className="whitespace-pre-wrap text-sm">{p.contenido}</p>}
              {p.imagen_url && <img src={p.imagen_url} alt="" className="w-full rounded-lg border object-cover" />}
            </CardContent></Card>
          ))}
      </div>
    </div>
  );
}

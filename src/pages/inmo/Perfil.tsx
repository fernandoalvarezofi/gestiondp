import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BadgeCheck, MessageCircleMore, Instagram, Globe, Pencil, Save } from "lucide-react";
import { getFallbackImage, TIPO_OPERACION_LABEL, TIPO_USUARIO_LABEL, formatPrecio } from "@/lib/inmoImages";
import { toast } from "sonner";

export default function InmoPerfil() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<any>(null);
  const [pubs, setPubs] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);

  // Sin slug → ir al perfil propio
  useEffect(() => {
    if (!slug && user) {
      (async () => {
        const { data } = await (supabase as any).from("perfiles_inmo").select("slug").eq("id", user.id).single();
        if (data?.slug) navigate(`/inmo/perfil/${data.slug}`, { replace: true });
      })();
    }
  }, [slug, user, navigate]);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: p } = await (supabase as any).from("perfiles_inmo").select("*").eq("slug", slug).single();
      setPerfil(p);
      if (p) {
        const { data: pl } = await (supabase as any)
          .from("publicaciones")
          .select("id,titulo,tipo_operacion,tipo_propiedad,precio,moneda,imagenes:imagenes_publicacion(url,es_portada)")
          .eq("perfil_id", p.id).eq("estado", "activa").order("created_at", { ascending: false });
        setPubs(pl || []);
      }
    })();
  }, [slug]);

  const isOwn = user && perfil && user.id === perfil.id;

  const save = async () => {
    if (!isOwn) return;
    const { error } = await (supabase as any).from("perfiles_inmo").update({
      nombre: perfil.nombre, descripcion: perfil.descripcion, whatsapp: perfil.whatsapp,
      instagram: perfil.instagram, sitio_web: perfil.sitio_web, tipo: perfil.tipo,
    }).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Perfil actualizado");
    setEditing(false);
  };

  if (!perfil) return <p className="text-muted-foreground">Cargando perfil...</p>;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Portada */}
      <div className="relative h-40 overflow-hidden rounded-2xl bg-gradient-to-br from-[hsl(var(--surface-mint-strong))] to-[hsl(var(--surface-mint))] sm:h-56">
        {perfil.portada_url && <img src={perfil.portada_url} alt="" className="h-full w-full object-cover" />}
      </div>

      <Card className="-mt-16 mx-4">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-4">
              <Avatar className="h-20 w-20 border-4 border-background">
                <AvatarImage src={perfil.avatar_url || ""} className="object-cover" />
                <AvatarFallback>{perfil.nombre?.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                {editing ? (
                  <Input value={perfil.nombre || ""} onChange={(e) => setPerfil({ ...perfil, nombre: e.target.value })} className="text-xl font-bold" />
                ) : (
                  <h1 className="text-2xl font-bold tracking-tight">{perfil.nombre}</h1>
                )}
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="secondary">{TIPO_USUARIO_LABEL[perfil.tipo]}</Badge>
                  {perfil.verificado && <Badge className="gap-1 bg-[hsl(var(--teal-data))] text-white"><BadgeCheck className="h-3 w-3" /> Verificada</Badge>}
                </div>
              </div>
            </div>
            {isOwn && (
              <Button variant={editing ? "default" : "outline"} size="sm" onClick={() => editing ? save() : setEditing(true)}>
                {editing ? <><Save className="h-4 w-4" /> Guardar</> : <><Pencil className="h-4 w-4" /> Editar perfil</>}
              </Button>
            )}
          </div>

          <div className="mt-4 space-y-3">
            {editing ? (
              <>
                <div><Label>Bio</Label><Textarea value={perfil.descripcion || ""} onChange={(e) => setPerfil({ ...perfil, descripcion: e.target.value })} /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label>WhatsApp</Label><Input value={perfil.whatsapp || ""} onChange={(e) => setPerfil({ ...perfil, whatsapp: e.target.value })} placeholder="54 9 2355..." /></div>
                  <div><Label>Instagram</Label><Input value={perfil.instagram || ""} onChange={(e) => setPerfil({ ...perfil, instagram: e.target.value })} /></div>
                  <div><Label>Sitio web</Label><Input value={perfil.sitio_web || ""} onChange={(e) => setPerfil({ ...perfil, sitio_web: e.target.value })} /></div>
                  <div>
                    <Label>Tipo</Label>
                    <Select value={perfil.tipo} onValueChange={(v) => setPerfil({ ...perfil, tipo: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dueno_directo">Dueño directo</SelectItem>
                        <SelectItem value="inmobiliaria">Inmobiliaria</SelectItem>
                        <SelectItem value="agente_independiente">Agente independiente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            ) : (
              <>
                {perfil.descripcion && <p className="text-sm text-muted-foreground">{perfil.descripcion}</p>}
                <div className="flex flex-wrap gap-3 text-sm">
                  {perfil.whatsapp && (
                    <a href={`https://wa.me/${String(perfil.whatsapp).replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-[#25D366] hover:underline">
                      <MessageCircleMore className="h-4 w-4" /> {perfil.whatsapp}
                    </a>
                  )}
                  {perfil.instagram && (
                    <a href={perfil.instagram.startsWith("http") ? perfil.instagram : `https://instagram.com/${perfil.instagram}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 hover:text-primary"><Instagram className="h-4 w-4" /> Instagram</a>
                  )}
                  {perfil.sitio_web && (
                    <a href={perfil.sitio_web} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-primary">
                      <Globe className="h-4 w-4" /> Sitio web
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Publicaciones activas ({pubs.length})</h2>
        {pubs.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">Todavía no hay publicaciones.</CardContent></Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pubs.map((p) => {
              const img = p.imagenes?.find((i: any) => i.es_portada)?.url || p.imagenes?.[0]?.url || getFallbackImage(p.tipo_propiedad);
              return (
                <Link key={p.id} to={`/inmo/publicacion/${p.id}`}>
                  <Card className="overflow-hidden transition-shadow hover:shadow-lg">
                    <div className="aspect-[4/3] overflow-hidden bg-muted"><img src={img} alt="" className="h-full w-full object-cover" /></div>
                    <CardContent className="space-y-1 p-3">
                      <Badge variant="secondary" className="text-[10px]">{TIPO_OPERACION_LABEL[p.tipo_operacion]}</Badge>
                      <h3 className="line-clamp-1 text-sm font-semibold">{p.titulo}</h3>
                      <p className="text-sm font-bold text-primary">{formatPrecio(p.precio, p.moneda)}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

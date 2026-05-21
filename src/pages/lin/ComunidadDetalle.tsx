import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { ImagePlus, X, Users, Hash, Plus, Send, Heart, Settings, Crown } from "lucide-react";
import { initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ComunidadDetalle() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState<any>(null);
  const [canales, setCanales] = useState<any[]>([]);
  const [canalActivo, setCanalActivo] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [esMiembro, setEsMiembro] = useState(false);
  const [txt, setTxt] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [posting, setPosting] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const { data } = await (supabase as any).from("comunidades").select("*").eq("slug", slug).single();
    if (!data) return;
    setC(data);
    const [{ data: cans }, { data: ms }] = await Promise.all([
      (supabase as any).from("comunidad_canales").select("*").eq("comunidad_id", data.id).order("orden"),
      (supabase as any).from("comunidad_miembros")
        .select("rol, perfil:perfiles!perfil_id(id,nombre,username,avatar_url,verificado)")
        .eq("comunidad_id", data.id).limit(80),
    ]);
    setCanales(cans || []);
    setMiembros(ms || []);
    if (cans?.length && !canalActivo) setCanalActivo(cans[0].id);
    if (user) {
      const { data: m } = await (supabase as any).from("comunidad_miembros").select("id").eq("comunidad_id", data.id).eq("perfil_id", user.id).maybeSingle();
      setEsMiembro(!!m);
    }
  };

  const loadPosts = async () => {
    if (!c) return;
    let q = (supabase as any).from("comunidad_posts")
      .select("*, perfil:perfiles!perfil_id(id,nombre,username,avatar_url,verificado)")
      .eq("comunidad_id", c.id).order("created_at", { ascending: true }).limit(100);
    if (canalActivo) q = q.eq("canal_id", canalActivo);
    const { data } = await q;
    setPosts(data || []);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug, user]);
  useEffect(() => { loadPosts(); /* eslint-disable-next-line */ }, [c?.id, canalActivo]);

  useEffect(() => {
    if (!c) return;
    const ch = (supabase as any).channel(`com_${c.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comunidad_posts", filter: `comunidad_id=eq.${c.id}` }, loadPosts)
      .on("postgres_changes", { event: "*", schema: "public", table: "comunidad_miembros", filter: `comunidad_id=eq.${c.id}` }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
    // eslint-disable-next-line
  }, [c?.id, canalActivo]);

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
        comunidad_id: c.id, perfil_id: user!.id, canal_id: canalActivo, contenido: txt || "", imagen_url,
      });
      if (error) throw error;
      setTxt(""); pickImage(null);
    } catch (e: any) {
      toast.error(e.message || "Error al postear");
    } finally { setPosting(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postear(); }
  };

  if (!c) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const canalNombre = canales.find((x) => x.id === canalActivo)?.nombre || "general";

  return (
    <div className="mx-auto grid h-[calc(100vh-7rem)] max-w-7xl grid-cols-1 gap-0 overflow-hidden rounded-2xl border bg-background md:grid-cols-[220px_1fr_220px]">
      {/* Sidebar canales */}
      <aside className="hidden flex-col border-r bg-secondary/40 md:flex">
        <div className="border-b p-3">
          <Link to="/lin/comunidades" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">← Comunidades</Link>
          <div className="mt-2 flex items-center gap-2">
            {c.avatar_url ? <img src={c.avatar_url} className="h-8 w-8 rounded-full object-cover" alt="" />
              : <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-xs font-bold">{c.nombre?.[0]}</div>}
            <h2 className="truncate text-sm font-bold">{c.nombre}</h2>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Canales</p>
          {canales.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Sin canales aún.</p>
          ) : canales.map((ch) => (
            <button key={ch.id} onClick={() => setCanalActivo(ch.id)}
              className={cn("group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                canalActivo === ch.id ? "bg-primary/15 font-semibold text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
              <Hash className="h-4 w-4 shrink-0" />
              <span className="truncate">{ch.nombre}</span>
            </button>
          ))}
        </div>
        <div className="border-t p-2">
          <Button onClick={toggleUnirme} size="sm" variant={esMiembro ? "outline" : "default"} className="w-full">
            {esMiembro ? "Salir" : "Unirme"}
          </Button>
        </div>
      </aside>

      {/* Chat principal */}
      <main className="flex min-h-0 flex-col">
        <header className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Hash className="h-5 w-5 shrink-0 text-muted-foreground" />
            <h1 className="truncate font-bold">{canalNombre}</h1>
            <span className="hidden text-xs text-muted-foreground sm:inline">· {posts.length} mensajes</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={toggleUnirme}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowRoster(!showRoster)}>
              <Users className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {posts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <Hash className="mb-2 h-10 w-10 opacity-40" />
              <p className="font-semibold">Bienvenido a #{canalNombre}</p>
              <p className="text-xs">Este es el comienzo de la conversación.</p>
            </div>
          ) : posts.map((p, i) => {
            const prev = posts[i - 1];
            const grouped = prev && prev.perfil?.id === p.perfil?.id &&
              (new Date(p.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000);
            return (
              <div key={p.id} className={cn("group flex gap-3 rounded px-2 py-0.5 hover:bg-secondary/40", grouped ? "" : "mt-2")}>
                <div className="w-10 shrink-0">
                  {!grouped && (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={p.perfil?.avatar_url || ""} />
                      <AvatarFallback className="text-xs">{initials(p.perfil?.nombre || "??")}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <Link to={`/lin/perfil/${p.perfil?.username}`} className="text-sm font-semibold hover:underline">{p.perfil?.nombre}</Link>
                      <span className="text-[10px] text-muted-foreground">{formatTime(p.created_at)}</span>
                    </div>
                  )}
                  {p.contenido && <p className="whitespace-pre-wrap text-sm leading-relaxed">{p.contenido}</p>}
                  {p.imagen_url && (
                    <a href={p.imagen_url} target="_blank" rel="noreferrer" className="mt-1 block w-fit">
                      <img src={p.imagen_url} alt="" loading="lazy" className="max-h-64 rounded-lg border object-cover" />
                    </a>
                  )}
                  {p.total_likes > 0 && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                      <Heart className="h-3 w-3 fill-current text-rose-500" />{p.total_likes}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        {esMiembro ? (
          <div className="border-t bg-background p-3">
            {preview && (
              <div className="relative mb-2 inline-block">
                <img src={preview} alt="" className="max-h-32 rounded-lg border object-cover" />
                <Button size="icon" variant="secondary" className="absolute -right-2 -top-2 h-6 w-6 rounded-full" onClick={() => pickImage(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border bg-secondary/40 px-3 py-2">
              <label className="cursor-pointer text-muted-foreground hover:text-foreground">
                <ImagePlus className="h-5 w-5" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] || null)} />
              </label>
              <Textarea
                value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={handleKey}
                placeholder={`Mensaje en #${canalNombre}`} rows={1}
                className="min-h-[36px] flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
              <Button onClick={postear} size="icon" disabled={posting || (!txt.trim() && !imagen)} className="h-8 w-8 shrink-0 rounded-full">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t bg-secondary/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">Unite a la comunidad para participar</p>
            <Button onClick={toggleUnirme} size="sm" className="mt-2">Unirme</Button>
          </div>
        )}
      </main>

      {/* Roster */}
      <aside className={cn("flex-col border-l bg-secondary/40", showRoster ? "flex" : "hidden md:flex")}>
        <div className="border-b p-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Miembros — {miembros.length}</p>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {miembros.map((m) => (
            <Link key={m.perfil?.id} to={`/lin/perfil/${m.perfil?.username}`}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-secondary">
              <Avatar className="h-7 w-7">
                <AvatarImage src={m.perfil?.avatar_url || ""} />
                <AvatarFallback className="text-[10px]">{initials(m.perfil?.nombre || "??")}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-sm">{m.perfil?.nombre}</span>
              {m.rol === "admin" && <Crown className="h-3.5 w-3.5 text-amber-500" />}
            </Link>
          ))}
        </div>
      </aside>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Film, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useConfirm } from "@/components/lin/ConfirmDialog";

export default function Editor() {
  const { user } = useAuth();
  const nav = useNavigate();
  const confirm = useConfirm();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("video_proyectos")
      .select("*")
      .eq("perfil_id", user.id)
      .eq("eliminado", false)
      .order("updated_at", { ascending: false })
      .then(({ data }: any) => { setItems(data || []); setLoading(false); });
  }, [user]);

  const crear = async () => {
    if (!user) return;
    setCreating(true);
    const { data, error } = await (supabase as any).from("video_proyectos").insert({
      perfil_id: user.id,
      nombre: "Proyecto sin título",
    }).select().single();
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    nav(`/lin/editor/${data.id}`);
  };

  const borrar = async (id: string) => {
    const ok = await confirm({ title: "¿Eliminar proyecto?", destructive: true, confirmText: "Eliminar" });
    if (!ok) return;
    await (supabase as any).from("video_proyectos").update({ eliminado: true }).eq("id", id);
    setItems((p) => p.filter((x) => x.id !== id));
  };

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold md:text-3xl">Editor de video</h1>
          <p className="text-sm text-muted-foreground">Timeline multi-pista, cortes, texto y exportación en tu navegador.</p>
        </div>
        <Button onClick={crear} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span className="ml-2">Nuevo proyecto</span>
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-12 text-center">
          <Film className="h-10 w-10 text-muted-foreground" />
          <p className="font-semibold">Todavía no tenés proyectos</p>
          <p className="text-sm text-muted-foreground">Creá uno para empezar a editar.</p>
          <Button onClick={crear}><Plus className="mr-2 h-4 w-4" />Crear proyecto</Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <Card key={p.id} className="group overflow-hidden">
              <Link to={`/lin/editor/${p.id}`} className="block aspect-video bg-muted">
                {p.thumbnail_url ? (
                  <img src={p.thumbnail_url} className="h-full w-full object-cover" alt={p.nombre} />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <Film className="h-8 w-8" />
                  </div>
                )}
              </Link>
              <div className="flex items-center justify-between p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{p.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.aspect_ratio} · {Math.round(p.duracion_s || 0)}s
                  </p>
                </div>
                <button onClick={() => borrar(p.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BadgeCheck, UserPlus, UserCheck } from "lucide-react";
import { BackHeader } from "@/components/lin/BackHeader";
import { initials } from "@/lib/worefHelpers";
import { toast } from "sonner";

/**
 * /lin/perfil/:slug/red?tab=seguidores | siguiendo
 * Lista de seguidores y seguidos con realtime y botón seguir/dejar.
 */
export default function RedDePerfil() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as "seguidores" | "siguiendo") || "seguidores";
  const [perfil, setPerfil] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [yo, setYo] = useState<Set<string>>(new Set());

  // load profile
  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data } = await (supabase as any).from("perfiles").select("id,nombre,username,total_seguidores,total_siguiendo").eq("username", slug).single();
      setPerfil(data);
    })();
  }, [slug]);

  // load network + realtime
  useEffect(() => {
    if (!perfil?.id) return;
    const cargar = async () => {
      const col = tab === "seguidores" ? "seguidor_id" : "seguido_id";
      const filterCol = tab === "seguidores" ? "seguido_id" : "seguidor_id";
      const { data } = await (supabase as any).from("seguidos")
        .select(`id, perfil:perfiles!${col}(id,nombre,username,avatar_url,verificado,bio)`)
        .eq(filterCol, perfil.id)
        .order("created_at", { ascending: false });
      setItems((data || []).map((d: any) => d.perfil).filter(Boolean));
    };
    cargar();
    const ch = (supabase as any).channel(`red-${perfil.id}-${tab}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "seguidos" }, cargar)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [perfil?.id, tab]);

  // ¿a quién sigo?
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("seguidos").select("seguido_id").eq("seguidor_id", user.id);
      setYo(new Set((data || []).map((s: any) => s.seguido_id)));
    })();
  }, [user, items.length]);

  const toggle = async (id: string) => {
    if (!user) return toast.error("Iniciá sesión");
    if (id === user.id) return;
    const ya = yo.has(id);
    const next = new Set(yo);
    if (ya) {
      next.delete(id);
      await (supabase as any).from("seguidos").delete().eq("seguidor_id", user.id).eq("seguido_id", id);
    } else {
      next.add(id);
      const { error } = await (supabase as any).from("seguidos").insert({ seguidor_id: user.id, seguido_id: id });
      if (error) { next.delete(id); toast.error("No se pudo"); }
    }
    setYo(new Set(next));
  };

  if (!perfil) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <BackHeader title={perfil.nombre} subtitle={`@${perfil.username}`} />
      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="border-b">
        <TabsList className="h-12 w-full justify-start rounded-none bg-transparent p-0">
          <TabsTrigger value="seguidores" className="h-12 flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
            {perfil.total_seguidores} Seguidores
          </TabsTrigger>
          <TabsTrigger value="siguiendo" className="h-12 flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent">
            {perfil.total_siguiendo} Siguiendo
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <ul>
        {items.length === 0 && (
          <li className="px-6 py-12 text-center text-sm text-muted-foreground">Sin {tab} aún.</li>
        )}
        {items.map((p) => {
          const sigo = yo.has(p.id);
          const mio = user?.id === p.id;
          return (
            <li key={p.id} className="flex items-center gap-3 border-b px-4 py-3 hover:bg-secondary/30">
              <Link to={`/lin/perfil/${p.username}`} className="shrink-0">
                <Avatar className="h-11 w-11"><AvatarImage src={p.avatar_url || ""} /><AvatarFallback>{initials(p.nombre)}</AvatarFallback></Avatar>
              </Link>
              <Link to={`/lin/perfil/${p.username}`} className="min-w-0 flex-1">
                <p className="flex items-center gap-1 truncate text-sm font-semibold">{p.nombre} {p.verificado && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}</p>
                <p className="truncate text-xs text-muted-foreground">@{p.username}</p>
                {p.bio && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{p.bio}</p>}
              </Link>
              {!mio && user && (
                <Button onClick={() => toggle(p.id)} size="sm" variant={sigo ? "outline" : "default"} className="h-8 rounded-full px-3 text-xs font-bold">
                  {sigo ? <><UserCheck className="h-3.5 w-3.5" />Siguiendo</> : <><UserPlus className="h-3.5 w-3.5" />Seguir</>}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

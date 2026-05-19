import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus } from "lucide-react";
import { initials } from "@/lib/worefHelpers";

interface PerfilHistorias {
  perfil: { id: string; nombre: string; username: string; avatar_url: string | null };
  historias: any[];
  todasVistas: boolean;
}

export function HistoriasBar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState<PerfilHistorias[]>([]);
  const [miPerfil, setMiPerfil] = useState<any>(null);
  const [misHistorias, setMisHistorias] = useState<any[]>([]);

  const cargar = async () => {
    if (!user) return;
    const { data: me } = await (supabase as any).from("perfiles").select("id,nombre,username,avatar_url").eq("id", user.id).maybeSingle();
    setMiPerfil(me);

    const { data: historias } = await (supabase as any)
      .from("historias")
      .select("id, perfil_id, media_url, tipo, created_at, expira_at, perfil:perfiles!perfil_id(id,nombre,username,avatar_url)")
      .gt("expira_at", new Date().toISOString())
      .order("created_at", { ascending: true });

    const { data: vistas } = await (supabase as any)
      .from("historia_vistas").select("historia_id").eq("perfil_id", user.id);
    const vistasSet = new Set((vistas || []).map((v: any) => v.historia_id));

    const map = new Map<string, PerfilHistorias>();
    (historias || []).forEach((h: any) => {
      if (!h.perfil) return;
      if (!map.has(h.perfil.id)) {
        map.set(h.perfil.id, { perfil: h.perfil, historias: [], todasVistas: true });
      }
      const g = map.get(h.perfil.id)!;
      g.historias.push(h);
      if (!vistasSet.has(h.id)) g.todasVistas = false;
    });

    const arr = Array.from(map.values());
    // Mis historias primero, luego no-vistas, luego vistas
    setMisHistorias(arr.find((g) => g.perfil.id === user.id)?.historias || []);
    const otras = arr.filter((g) => g.perfil.id !== user.id)
      .sort((a, b) => Number(a.todasVistas) - Number(b.todasVistas));
    setGrupos(otras);
  };

  useEffect(() => { cargar(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const ch = (supabase as any).channel("historias-bar")
      .on("postgres_changes", { event: "*", schema: "public", table: "historias" }, () => cargar())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user]);

  if (!user) return null;

  return (
    <div className="border-b">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3.5 px-4 py-3 sm:px-5">
          {/* Tu historia */}
          <button
            onClick={() => misHistorias.length > 0 ? navigate(`/lin/historias/${user.id}`) : navigate("/lin/historias/nueva")}
            className="flex w-16 flex-col items-center gap-1.5 shrink-0"
          >
            <div className="relative">
              {misHistorias.length > 0 ? (
                <div className="rounded-full bg-gradient-to-tr from-primary via-pink-500 to-amber-400 p-[2px]">
                  <div className="rounded-full bg-background p-[2px]">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={miPerfil?.avatar_url || ""} className="object-cover" />
                      <AvatarFallback>{initials(miPerfil?.nombre)}</AvatarFallback>
                    </Avatar>
                  </div>
                </div>
              ) : (
                <Avatar className="h-14 w-14 ring-2 ring-border">
                  <AvatarImage src={miPerfil?.avatar_url || ""} className="object-cover" />
                  <AvatarFallback>{initials(miPerfil?.nombre)}</AvatarFallback>
                </Avatar>
              )}
              <span
                onClick={(e) => { e.stopPropagation(); navigate("/lin/historias/nueva"); }}
                className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background"
                role="button"
              >
                <Plus className="h-3 w-3" strokeWidth={3} />
              </span>
            </div>
            <span className="truncate w-full text-center text-[11px] text-foreground">Tu historia</span>
          </button>

          {/* Historias de otros */}
          {grupos.map((g) => (
            <button
              key={g.perfil.id}
              onClick={() => navigate(`/lin/historias/${g.perfil.id}`)}
              className="flex w-16 flex-col items-center gap-1.5 shrink-0"
            >
              <div className={g.todasVistas
                ? "rounded-full bg-muted-foreground/30 p-[2px]"
                : "rounded-full bg-gradient-to-tr from-primary via-pink-500 to-amber-400 p-[2px]"}>
                <div className="rounded-full bg-background p-[2px]">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={g.perfil.avatar_url || ""} className="object-cover" />
                    <AvatarFallback>{initials(g.perfil.nombre)}</AvatarFallback>
                  </Avatar>
                </div>
              </div>
              <span className="truncate w-full text-center text-[11px] text-muted-foreground">{g.perfil.username}</span>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-1" />
      </ScrollArea>
    </div>
  );
}

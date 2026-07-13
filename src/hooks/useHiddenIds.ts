import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Devuelve un Set con los IDs de perfiles que el usuario actual bloqueó,
 * lo bloquearon a él, o silenció. Se actualiza en realtime.
 */
export function useHiddenIds() {
  const { user } = useAuth();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setIds(new Set()); return; }
    let alive = true;
    const cargar = async () => {
      const [{ data: b1 }, { data: b2 }, { data: s }] = await Promise.all([
        (supabase as any).from("bloqueos").select("bloqueado_id").eq("perfil_id", user.id),
        (supabase as any).from("bloqueos").select("perfil_id").eq("bloqueado_id", user.id),
        (supabase as any).from("silenciados").select("silenciado_id").eq("perfil_id", user.id),
      ]);
      if (!alive) return;
      const set = new Set<string>();
      (b1 || []).forEach((r: any) => set.add(r.bloqueado_id));
      (b2 || []).forEach((r: any) => set.add(r.perfil_id));
      (s || []).forEach((r: any) => set.add(r.silenciado_id));
      setIds(set);
    };
    cargar();
    const ch = (supabase as any)
      .channel(`hidden-ids-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bloqueos" }, cargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "silenciados" }, cargar)
      .subscribe();
    return () => { alive = false; (supabase as any).removeChannel(ch); };
  }, [user?.id]);

  return ids;
}

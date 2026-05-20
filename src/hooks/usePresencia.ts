import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Global heartbeat: marca al usuario actual online y actualiza ultimo_visto cada 30s.
export function usePresenciaHeartbeat() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let mounted = true;
    const set = async (online: boolean) => {
      if (!mounted) return;
      await (supabase as any).from("presencia").upsert(
        { perfil_id: user.id, online, ultimo_visto: new Date().toISOString() },
        { onConflict: "perfil_id" }
      );
    };
    set(true);
    const interval = setInterval(() => set(true), 30_000);
    const onVis = () => set(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", () => set(false));
    return () => {
      mounted = false;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
      set(false);
    };
  }, [user]);
}

// Hook para observar la presencia de otro perfil en tiempo real
export function usePresenciaDe(perfilId?: string | null) {
  const [estado, setEstado] = useState<{ online: boolean; ultimo_visto: string | null }>({ online: false, ultimo_visto: null });
  useEffect(() => {
    if (!perfilId) return;
    let cancel = false;
    const cargar = async () => {
      const { data } = await (supabase as any).from("presencia").select("online,ultimo_visto").eq("perfil_id", perfilId).maybeSingle();
      if (!cancel && data) setEstado({ online: !!data.online, ultimo_visto: data.ultimo_visto });
    };
    cargar();
    const ch = (supabase as any).channel(`pres-${perfilId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "presencia", filter: `perfil_id=eq.${perfilId}` },
        (p: any) => setEstado({ online: !!p.new.online, ultimo_visto: p.new.ultimo_visto }))
      .subscribe();
    return () => { cancel = true; (supabase as any).removeChannel(ch); };
  }, [perfilId]);
  return estado;
}

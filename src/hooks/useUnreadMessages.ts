import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/delivery";
import { fetchSinLeer } from "@/services/messaging";

/** Conversaciones con mensajes sin leer en un contexto (para el globito del menú). Se actualiza en tiempo real. */
export function useUnreadMessages(opts: { comercio?: string | null; rol?: "cliente" | "repartidor" | "conductor" | null; enabled?: boolean }) {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const enabled = opts.enabled !== false && Boolean(user);
  const { comercio, rol } = opts;

  useEffect(() => {
    if (!enabled) { setTotal(0); return; }
    let active = true;
    const load = () => fetchSinLeer({ comercio, rol }).then((n) => { if (active) setTotal(n); }).catch(() => undefined);
    load();
    const ch = db.channel(`sin-leer-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "msg_mensajes" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "msg_lecturas", filter: `usuario_id=eq.${user!.id}` }, load)
      .subscribe();
    const timer = window.setInterval(load, 60000);
    return () => { active = false; db.removeChannel(ch); window.clearInterval(timer); };
  }, [enabled, comercio, rol, user]);

  return total;
}

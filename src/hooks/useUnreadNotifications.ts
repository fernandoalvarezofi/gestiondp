import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/delivery";
import { fetchNoLeidas } from "@/services/notifications";

/** Cantidad de avisos sin leer: se actualiza en tiempo real y, como respaldo, cada minuto y al volver a la pestaña. */
export function useUnreadNotifications() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const [count, setCount] = useState(0);
  const refresh = useCallback(async () => { if (uid) setCount(await fetchNoLeidas().catch(() => 0)); }, [uid]);

  useEffect(() => {
    if (!uid) { setCount(0); return; }
    refresh();
    const channel = db.channel(`notif-${uid}-${crypto.randomUUID()}`).on("postgres_changes", { event: "*", schema: "public", table: "notificaciones", filter: `usuario_id=eq.${uid}` }, refresh).subscribe();
    const timer = window.setInterval(refresh, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { db.removeChannel(channel); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [uid, refresh]);

  return { count, refresh };
}

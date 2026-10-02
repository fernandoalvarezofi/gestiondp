import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/delivery";
import type { GeoPoint } from "@/lib/geo";

type Row = { latitud: number; longitud: number; updated_at: string };

/** Sigue en tiempo real la ubicación de un repartidor (la base solo la muestra a quien tiene un pedido en curso con él). */
export function useCourierLocation(courierId: string | null | undefined, enabled: boolean) {
  const [position, setPosition] = useState<(GeoPoint & { updatedAt: string }) | null>(null);

  useEffect(() => {
    if (!courierId || !enabled) { setPosition(null); return; }
    const apply = (row: Row | null) => row && setPosition({ lat: Number(row.latitud), lng: Number(row.longitud), updatedAt: row.updated_at });
    db.from("delivery_ubicaciones").select("latitud,longitud,updated_at").eq("repartidor_id", courierId).maybeSingle().then(({ data }: { data: Row | null }) => apply(data));
    const channel = db.channel(`ubicacion-${courierId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_ubicaciones", filter: `repartidor_id=eq.${courierId}` }, (payload: { new: Row }) => apply(payload.new))
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [courierId, enabled]);

  return position;
}

/** El repartidor comparte su ubicación mientras tiene un pedido en curso (cada ~10 s como máximo). */
export function useShareCourierLocation(active: boolean) {
  const { user } = useAuth();
  const [status, setStatus] = useState<"idle" | "sharing" | "denied" | "unsupported">("idle");
  const [position, setPosition] = useState<GeoPoint | null>(null);
  const lastSent = useRef(0);

  useEffect(() => {
    if (!active || !user) { setStatus("idle"); return; }
    if (!("geolocation" in navigator)) { setStatus("unsupported"); return; }
    const watch = navigator.geolocation.watchPosition(
      async (event) => {
        const point = { lat: event.coords.latitude, lng: event.coords.longitude };
        setPosition(point);
        setStatus("sharing");
        if (Date.now() - lastSent.current < 10000) return;
        lastSent.current = Date.now();
        await db.from("delivery_ubicaciones").upsert({ repartidor_id: user.id, latitud: point.lat, longitud: point.lng, updated_at: new Date().toISOString() });
      },
      (error) => setStatus(error.code === error.PERMISSION_DENIED ? "denied" : "idle"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [active, user]);

  return { status, position };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { playChime } from "@/lib/alarm";
import { db } from "@/lib/delivery";

export type Offer = {
  pedido_id: string;
  comercio_nombre: string;
  comercio_direccion: string;
  comercio_latitud: number | null;
  comercio_longitud: number | null;
  zona_entrega: string;
  entrega_latitud: number | null;
  entrega_longitud: number | null;
  dist_retiro_km: number | null;
  dist_entrega_km: number | null;
  ganancia: number;
  productos: number;
  metodo_pago: string;
  cobrar: number | null;
  listo_en_min: number | null;
  exclusivo: boolean;
  vence_at: string | null;
  programado_para: string | null;
};

/**
 * Ofertas de reparto para el repartidor conectado. El servidor decide cuáles puede ver (por cercanía y turno),
 * así que alcanza con consultar cada pocos segundos. Suena un aviso cuando aparece una oferta nueva.
 */
export function useOffers(enabled: boolean, onNew?: (offer: Offer) => void) {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loaded, setLoaded] = useState(false);
  const known = useRef<Set<string>>(new Set());
  const callback = useRef(onNew);
  callback.current = onNew;

  const refresh = useCallback(async () => {
    const { data, error } = await db.rpc("delivery_mis_ofertas");
    if (error) return;
    const list = (data || []) as Offer[];
    const fresh = list.filter((offer) => !known.current.has(offer.pedido_id));
    if (known.current.size || loaded) {
      if (fresh.length) { playChime(); fresh.forEach((offer) => callback.current?.(offer)); }
    }
    known.current = new Set(list.map((offer) => offer.pedido_id));
    setOffers(list);
    setLoaded(true);
  }, [loaded]);

  useEffect(() => {
    if (!enabled) { setOffers([]); known.current = new Set(); setLoaded(false); return; }
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  return { offers, refresh, loaded };
}

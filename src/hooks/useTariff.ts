import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/delivery";
import { GeoPoint, Tariff } from "@/lib/geo";

/** Tarifa de la zona de la dirección elegida (zona, demanda y clima). Se refresca cada minuto. */
export function useTariff(point: GeoPoint | null | undefined): Tariff | null {
  const lat = point ? Math.round(point.lat * 1000) / 1000 : null;
  const lng = point ? Math.round(point.lng * 1000) / 1000 : null;
  const { data } = useQuery({
    queryKey: ["tarifa", lat, lng],
    enabled: lat !== null && lng !== null,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data: result, error } = await db.rpc("delivery_tarifa_zona", { p_lat: lat, p_lng: lng });
      if (error) throw error;
      return result as unknown as Tariff;
    },
  });
  return data ?? null;
}

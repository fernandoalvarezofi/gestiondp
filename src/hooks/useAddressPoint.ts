import { useMemo } from "react";
import { useCart } from "@/contexts/CartContext";
import type { DeliveryStore } from "@/lib/delivery";
import { GeoPoint, storeReach } from "@/lib/geo";

/** Coordenadas de la dirección de entrega elegida (o null si no tiene ubicación). */
export function useAddressPoint(): GeoPoint | null {
  const { address } = useCart();
  return useMemo(() => (address?.lat != null && address?.lng != null ? { lat: address.lat, lng: address.lng } : null), [address?.lat, address?.lng]);
}

/** ¿Este comercio llega a la dirección elegida? Sin dirección con ubicación, se asume que sí. */
export function useInZone() {
  const point = useAddressPoint();
  return useMemo(() => (store: DeliveryStore) => storeReach(store, point).inZone, [point]);
}

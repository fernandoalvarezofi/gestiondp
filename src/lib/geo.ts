import type { DeliveryStore } from "@/lib/delivery";

export type GeoPoint = { lat: number; lng: number };
export type AddressSuggestion = GeoPoint & { label: string; detail: string };

/** Centro de CABA: punto de partida del mapa cuando no hay otra referencia. */
export const DEFAULT_CENTER: GeoPoint = { lat: -34.6037, lng: -58.3816 };

/** Distancia en línea recta en km (misma fórmula que delivery_distancia_km en la base). */
export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`);

export type StoreReach = { km: number | null; inZone: boolean; fee: number };

/** Distancia, si llega a la dirección y costo de envío estimado (misma regla que el servidor). */
export function storeReach(
  store: Pick<DeliveryStore, "costo_envio" | "envio_gratis_desde"> & { latitud?: number | null; longitud?: number | null; radio_entrega_km?: number | null; costo_por_km?: number | null },
  point: GeoPoint | null | undefined,
): StoreReach {
  const base = Number(store.costo_envio);
  if (!point || store.latitud == null || store.longitud == null) return { km: null, inZone: true, fee: base };
  const km = distanceKm(point, { lat: Number(store.latitud), lng: Number(store.longitud) });
  const fee = Math.round((base + Number(store.costo_por_km || 0) * km) / 10) * 10;
  return { km, inZone: km <= Number(store.radio_entrega_km ?? 6), fee };
}

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; housenumber?: string; district?: string; locality?: string; city?: string; county?: string; state?: string; country?: string; type?: string };
};

function toSuggestion(feature: PhotonFeature): AddressSuggestion {
  const p = feature.properties;
  const street = p.street ? `${p.street}${p.housenumber ? ` ${p.housenumber}` : ""}` : p.name || "";
  const label = street || p.name || "Ubicación";
  const detail = [p.street && p.name && p.name !== p.street ? p.name : null, p.district || p.locality, p.city || p.county, p.state].filter(Boolean).join(", ");
  return { label, detail, lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0] };
}

const PHOTON = "https://photon.komoot.io";

/** Autocompletado de direcciones (OpenStreetMap vía Photon), priorizando cerca de `near`. */
export async function searchAddresses(query: string, near: GeoPoint = DEFAULT_CENTER, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const text = query.trim();
  if (text.length < 3) return [];
  const url = `${PHOTON}/api/?q=${encodeURIComponent(text)}&lat=${near.lat}&lon=${near.lng}&limit=6&bbox=-73.6,-55.1,-53.6,-21.7`;
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("No pudimos buscar la dirección");
  const data = (await response.json()) as { features: PhotonFeature[] };
  return data.features.filter((feature) => feature.properties.country === "Argentina" || !feature.properties.country).map(toSuggestion);
}

/** Dirección aproximada de un punto del mapa. */
export async function reverseGeocode(point: GeoPoint): Promise<AddressSuggestion | null> {
  try {
    const response = await fetch(`${PHOTON}/reverse?lat=${point.lat}&lon=${point.lng}&limit=1`);
    if (!response.ok) return null;
    const data = (await response.json()) as { features: PhotonFeature[] };
    return data.features[0] ? { ...toSuggestion(data.features[0]), lat: point.lat, lng: point.lng } : null;
  } catch {
    return null;
  }
}

/** Ubicación actual del dispositivo (pide permiso). */
export function currentPosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) { reject(new Error("Tu dispositivo no permite compartir la ubicación")); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED ? "Permití el acceso a tu ubicación para usar esta opción" : "No pudimos obtener tu ubicación")),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

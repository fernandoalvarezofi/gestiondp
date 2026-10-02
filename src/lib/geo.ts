import type { DeliveryStore } from "@/lib/delivery";

export type GeoPoint = { lat: number; lng: number };
/** `exacta` = tiene calle y número; `calle` = solo la calle o una zona (hay que ajustar el pin). */
export type AddressSuggestion = GeoPoint & { label: string; detail: string; precision?: "exacta" | "calle" };

/** Centro de Lincoln, Buenos Aires: punto de partida del mapa cuando no hay otra referencia. */
export const DEFAULT_CENTER: GeoPoint = { lat: -34.8667, lng: -61.5333 };

/** Distancia en línea recta en km (misma fórmula que delivery_distancia_km en la base). */
export function distanceKm(a: GeoPoint, b: GeoPoint) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(6371 * 2 * Math.asin(Math.sqrt(h)) * 100) / 100;
}

export const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toLocaleString("es-AR", { maximumFractionDigits: 1 })} km`);

/** Cuánto más largo que la línea recta es, en promedio, el camino por las calles (respaldo cuando no hay ruta real). */
export const ROUTE_FACTOR = 1.35;

/** Tarifa de la zona de entrega: recargo fijo, multiplicador (zona + demanda + clima) y si está cerrada. Misma regla que el servidor. */
export type Tariff = { zona: string | null; cerrada: boolean; multiplicador: number; recargo: number; motivos: string[] };

export function applyTariff(fee: number, tariff?: Pick<Tariff, "multiplicador" | "recargo"> | null): number {
  if (!tariff || fee <= 0) return fee;
  return Math.round((fee * Number(tariff.multiplicador) + Number(tariff.recargo)) / 10) * 10;
}

export type StoreReach = { km: number | null; inZone: boolean; fee: number; feeKm?: number; zoneClosed?: boolean; surge?: string[] };

/**
 * Distancia en línea recta (cobertura), si llega a la dirección y costo de envío estimado (misma regla que el servidor).
 * El costo se calcula con los kilómetros por las calles: los reales si se pasan (`roadKm`) o una estimación.
 */
export function storeReach(
  store: Pick<DeliveryStore, "costo_envio" | "envio_gratis_desde"> & { latitud?: number | null; longitud?: number | null; radio_entrega_km?: number | null; costo_por_km?: number | null },
  point: GeoPoint | null | undefined,
  roadKm?: number | null,
  tariff?: Tariff | null,
): StoreReach {
  const base = Number(store.costo_envio);
  if (!point || store.latitud == null || store.longitud == null) return { km: null, inZone: true, fee: base };
  const km = distanceKm(point, { lat: Number(store.latitud), lng: Number(store.longitud) });
  const feeKm = roadKm ?? Math.round(km * ROUTE_FACTOR * 100) / 100;
  const fee = applyTariff(Math.round((base + Number(store.costo_por_km || 0) * feeKm) / 10) * 10, tariff);
  return { km, inZone: km <= Number(store.radio_entrega_km ?? 6) && !tariff?.cerrada, fee, feeKm, zoneClosed: Boolean(tariff?.cerrada), surge: tariff?.motivos?.length ? tariff.motivos : undefined };
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
  return { label, detail, lat: feature.geometry.coordinates[1], lng: feature.geometry.coordinates[0], precision: p.street && p.housenumber ? "exacta" : "calle" };
}

const PHOTON = "https://photon.komoot.io";
const NOMINATIM = "https://nominatim.openstreetmap.org";
// Caja de Argentina: evita resultados de otros países.
const ARGENTINA_BBOX = "-73.6,-55.1,-53.6,-21.7";

type NominatimItem = { lat: string; lon: string; display_name: string; address?: Record<string, string> };

function fromNominatim(item: NominatimItem): AddressSuggestion {
  const a = item.address || {};
  const street = a.road || a.pedestrian || a.footway || "";
  const label = street ? `${street}${a.house_number ? ` ${a.house_number}` : ""}` : item.display_name.split(",")[0];
  const detail = [a.suburb || a.neighbourhood, a.city || a.town || a.village || a.municipality, a.state].filter(Boolean).join(", ");
  return { label, detail, lat: Number(item.lat), lng: Number(item.lon), precision: street && a.house_number ? "exacta" : "calle" };
}

/** Quita duplicados (mismo texto a menos de ~50 m) y deja primero lo que tiene calle y número. */
function tidy(list: AddressSuggestion[], query: string): AddressSuggestion[] {
  const seen: AddressSuggestion[] = [];
  for (const item of list) {
    if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
    // Misma calle, número y zona = misma dirección; si una versión es exacta y la otra aproximada, queda la exacta.
    const twin = seen.findIndex((other) => other.label === item.label && other.detail === item.detail);
    if (twin === -1) seen.push(item);
    else if (seen[twin].precision !== "exacta" && item.precision === "exacta") seen[twin] = item;
  }
  const wantsNumber = /\d/.test(query);
  // Una versión aproximada de una dirección que ya tenemos exacta sobra.
  const exact = new Set(seen.filter((item) => item.precision === "exacta").map((item) => item.label));
  return seen.filter((item) => item.precision === "exacta" || !exact.has(item.label)).sort((a, b) => (wantsNumber ? Number(b.precision === "exacta") - Number(a.precision === "exacta") : 0)).slice(0, 6);
}

/**
 * Autocompletado de direcciones de Argentina. Usa Photon (OpenStreetMap) y, si no responde o no encuentra
 * nada, Nominatim. Prioriza lo cercano a `near` (tu ubicación o la del comercio), no un punto fijo.
 */
export async function searchAddresses(query: string, near?: GeoPoint | null, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const text = query.trim().replace(/\s+/g, " ");
  if (text.length < 3) return [];
  const bias = near ?? DEFAULT_CENTER;
  let results: AddressSuggestion[] = [];
  try {
    const response = await fetch(`${PHOTON}/api/?q=${encodeURIComponent(text)}&lat=${bias.lat}&lon=${bias.lng}&limit=8&bbox=${ARGENTINA_BBOX}`, { signal });
    if (response.ok) {
      const data = (await response.json()) as { features: PhotonFeature[] };
      results = data.features.filter((feature) => feature.properties.country === "Argentina" || !feature.properties.country).map(toSuggestion);
    }
  } catch (error) {
    if ((error as Error).name === "AbortError") throw error;
  }
  if (!results.length) {
    const response = await fetch(`${NOMINATIM}/search?q=${encodeURIComponent(text)}&format=jsonv2&countrycodes=ar&limit=6&addressdetails=1&accept-language=es`, { signal });
    if (!response.ok) throw new Error("No pudimos buscar la dirección");
    results = ((await response.json()) as NominatimItem[]).map(fromNominatim);
  }
  // Mantiene el número que escribió la persona si el resultado solo trae la calle (ubicación aproximada).
  const typedNumber = text.match(/(?:^|\s)(\d{1,5})\s*$/)?.[1];
  const withNumber = results.map((item) => (typedNumber && item.precision === "calle" && !/\d/.test(item.label) ? { ...item, label: `${item.label} ${typedNumber}` } : item));
  return tidy(withNumber, text);
}

/** Dirección aproximada de un punto del mapa (Photon y, si falla, Nominatim). */
export async function reverseGeocode(point: GeoPoint): Promise<AddressSuggestion | null> {
  try {
    const response = await fetch(`${PHOTON}/reverse?lat=${point.lat}&lon=${point.lng}&limit=1`);
    if (response.ok) {
      const data = (await response.json()) as { features: PhotonFeature[] };
      if (data.features[0]) return { ...toSuggestion(data.features[0]), lat: point.lat, lng: point.lng };
    }
  } catch { /* probamos con el segundo servicio */ }
  try {
    const response = await fetch(`${NOMINATIM}/reverse?lat=${point.lat}&lon=${point.lng}&format=jsonv2&addressdetails=1&accept-language=es`);
    if (!response.ok) return null;
    const item = (await response.json()) as NominatimItem;
    return item?.lat ? { ...fromNominatim(item), lat: point.lat, lng: point.lng } : null;
  } catch {
    return null;
  }
}

export type DevicePosition = GeoPoint & { accuracy: number };

function readPosition(options: PositionOptions): Promise<DevicePosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }),
      reject,
      options,
    );
  });
}

/**
 * Ubicación actual del dispositivo. Primero GPS preciso; si tarda o no está disponible (notebooks, interiores),
 * reintenta con la ubicación aproximada por red. Devuelve también la precisión en metros.
 */
export async function currentPosition(): Promise<DevicePosition> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) throw new Error("Tu dispositivo no permite compartir la ubicación");
  try {
    return await readPosition({ enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 });
  } catch (first) {
    if ((first as GeolocationPositionError).code === 1) throw new Error("Permití el acceso a tu ubicación desde el candado de la barra de direcciones y volvé a intentar");
    try {
      return await readPosition({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 });
    } catch (second) {
      const code = (second as GeolocationPositionError).code;
      throw new Error(code === 1 ? "Permití el acceso a tu ubicación desde el candado de la barra de direcciones y volvé a intentar" : "No pudimos obtener tu ubicación. Buscá tu dirección escribiéndola.");
    }
  }
}

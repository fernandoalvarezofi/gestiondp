// Ruta real entre dos puntos (distancia y tiempo por calles).
// Usa OSRM (datos de OpenStreetMap). Si el servicio no responde, devuelve una estimación marcada como tal.
// Las rutas consultadas con `guardar: true` se guardan: la base las usa para calcular el costo del envío.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const CENTER = { lat: -34.8667, lng: -61.5333 };
const MAX_ZONE_KM = 80;
const OSRM = "https://router.project-osrm.org/route/v1/driving";
const FALLBACK_FACTOR = 1.35;
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Content-Type": "application/json" };

type Point = { lat: number; lng: number };
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isPoint = (value: unknown): value is Point => {
  const point = value as Point | null;
  return Boolean(point) && isNumber(point!.lat) && isNumber(point!.lng) && Math.abs(point!.lat) <= 90 && Math.abs(point!.lng) <= 180;
};
function haversine(a: Point, b: Point) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}
const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);

  // Solo personas con sesión iniciada (la clave pública de la app, sola, no alcanza).
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const auth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: session } = token ? await auth.auth.getUser(token) : { data: { user: null } };
  if (!session.user) return reply({ error: "Iniciá sesión" }, 401);

  let body: { desde?: unknown; hasta?: unknown; guardar?: unknown; perfil?: unknown };
  try { body = await req.json(); } catch { return reply({ error: "Pedido inválido" }, 400); }
  if (!isPoint(body.desde) || !isPoint(body.hasta)) return reply({ error: "Faltan las coordenadas" }, 400);
  const from = body.desde;
  const to = body.hasta;
  // Solo se calculan rutas dentro de la zona de servicio: así la función no se puede usar para consultar cualquier mapa.
  if (haversine(from, CENTER) > MAX_ZONE_KM || haversine(to, CENTER) > MAX_ZONE_KM) return reply({ error: "Fuera de la zona de servicio" }, 400);
  const profile = ["moto", "auto", "bici", "a_pie"].includes(body.perfil as string) ? (body.perfil as string) : "moto";
  const persist = body.guardar === true;

  const supabase = auth;
  const key = { o_lat: round(from.lat, 4), o_lng: round(from.lng, 4), d_lat: round(to.lat, 4), d_lng: round(to.lng, 4) };

  // Base: kilómetros y minutos en auto por las calles
  let km: number; let carMinutes: number; let source: "osrm" | "estimado" | "guardada";
  const { data: cached } = await supabase.from("delivery_rutas").select("km, minutos").match(key).gt("created_at", new Date(Date.now() - 120 * 86400000).toISOString()).maybeSingle();
  if (cached) {
    km = Number(cached.km); carMinutes = Number(cached.minutos); source = "guardada";
  } else {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(`${OSRM}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`, { signal: controller.signal });
      clearTimeout(timer);
      const json = await response.json();
      const route = json?.routes?.[0];
      if (!route || !isNumber(route.distance) || !isNumber(route.duration)) throw new Error("sin ruta");
      km = route.distance / 1000; carMinutes = route.duration / 60; source = "osrm";
      if (persist) await supabase.from("delivery_rutas").upsert({ ...key, km: round(km, 2), minutos: round(carMinutes, 1), fuente: "osrm", created_at: new Date().toISOString() });
    } catch {
      km = haversine(from, to) * FALLBACK_FACTOR; carMinutes = (km / 22) * 60; source = "estimado";
    }
  }

  // Tiempo según el vehículo (con una demora de salida y estacionamiento)
  const minutes = profile === "bici" ? (km / 15) * 60 + 1 : profile === "a_pie" ? (km / 5) * 60 : carMinutes * 1.2 + 1;
  return reply({ km: round(km, 2), min: Math.max(1, Math.round(minutes)), fuente: source });
});

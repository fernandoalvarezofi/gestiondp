import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GeoPoint } from "@/lib/geo";

export type RouteInfo = { km: number; min: number; fuente: "osrm" | "estimado" | "guardada" };
export type RouteOptions = { persist?: boolean; profile?: "moto" | "auto" | "bici" | "a_pie" };

const key = (from: GeoPoint, to: GeoPoint, options: RouteOptions) => `${from.lat.toFixed(4)},${from.lng.toFixed(4)}>${to.lat.toFixed(4)},${to.lng.toFixed(4)}|${options.persist ? 1 : 0}|${options.profile ?? "moto"}`;
const memo = new Map<string, { at: number; value: Promise<RouteInfo | null> }>();

/**
 * Ruta real por las calles (distancia y minutos). Con `persist` el servidor guarda la ruta y la usa para cobrar el envío.
 * Devuelve null si no se pudo consultar: quien llama usa su estimación.
 */
export function fetchRoute(from: GeoPoint, to: GeoPoint, options: RouteOptions = {}): Promise<RouteInfo | null> {
  const id = key(from, to, options);
  const cached = memo.get(id);
  // Los precios (persist) se reutilizan toda la sesión; los tiempos en vivo, 30 segundos.
  if (cached && (options.persist || Date.now() - cached.at < 30000)) return cached.value;
  const value = supabase.auth.getSession()
    // Sin sesión no se consulta (el servicio exige iniciar sesión): quien explora usa la estimación.
    .then(({ data: auth }) => (auth.session ? supabase.functions.invoke("ruta", { body: { desde: from, hasta: to, guardar: Boolean(options.persist), perfil: options.profile ?? "moto" } }) : { data: null, error: new Error("sin sesión") }))
    .then(({ data, error }) => (error || !data || typeof data.km !== "number" ? null : (data as RouteInfo)))
    .catch(() => null)
    // Un fallo (por ejemplo, sin sesión) no se recuerda: se vuelve a intentar la próxima vez.
    .then((info) => { if (!info) memo.delete(id); return info; });
  memo.set(id, { at: Date.now(), value });
  if (memo.size > 200) memo.delete(memo.keys().next().value as string);
  return value;
}

/** Ruta real entre dos puntos; se vuelve a pedir cada `refreshMs` si se indica (tiempos en vivo). */
export function useRoute(from: GeoPoint | null | undefined, to: GeoPoint | null | undefined, options: RouteOptions & { refreshMs?: number } = {}) {
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const fromKey = from ? `${from.lat.toFixed(4)},${from.lng.toFixed(4)}` : "";
  const toKey = to ? `${to.lat.toFixed(4)},${to.lng.toFixed(4)}` : "";
  const { persist, profile, refreshMs } = options;

  useEffect(() => {
    if (!from || !to) { setRoute(null); return; }
    let active = true;
    const load = () => fetchRoute(from, to, { persist, profile }).then((info) => { if (active) setRoute(info); });
    load();
    const timer = refreshMs ? window.setInterval(load, refreshMs) : 0;
    return () => { active = false; if (timer) window.clearInterval(timer); };
  }, [fromKey, toKey, persist, profile, refreshMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return route;
}

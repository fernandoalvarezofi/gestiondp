import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage } from "@/lib/delivery";

export const FAV_KEY = "woref-fav-productos";
export const MAX_FAVORITOS = 200;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lee los favoritos guardados en el navegador (solo identificadores válidos, sin repetidos, hasta 200). */
export function leerLocales(): string[] {
  try { const raw = window.localStorage.getItem(FAV_KEY); const list = raw ? JSON.parse(raw) : []; return Array.isArray(list) ? normalizarIds(list) : []; } catch { return []; }
}
export function normalizarIds(list: unknown[]): string[] { return [...new Set(list.filter((x): x is string => typeof x === "string" && UUID.test(x)))].slice(-MAX_FAVORITOS); }
const guardarLocales = (ids: string[]) => { try { window.localStorage.setItem(FAV_KEY, JSON.stringify(ids.slice(-MAX_FAVORITOS))); } catch { /* sin almacenamiento */ } };
const borrarLocales = () => { try { window.localStorage.removeItem(FAV_KEY); } catch { /* sin almacenamiento */ } };

/**
 * Favoritos de productos. Con sesión se guardan en la cuenta (se ven en cualquier dispositivo); sin sesión, en el navegador.
 * Al ingresar, los del navegador se pasan a la cuenta una sola vez.
 */
export function useProductFavorites() {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>(leerLocales);
  const [ready, setReady] = useState(false);
  const importado = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (!user) { setIds(leerLocales()); setReady(true); return; }
    (async () => {
      const locales = leerLocales();
      if (locales.length && importado.current !== user.id) {
        importado.current = user.id;
        const { error } = await db.rpc("favoritos_producto_importar", { p_ids: locales });
        if (!error) borrarLocales();
      }
      const { data } = await db.from("delivery_favoritos_producto").select("producto_id").eq("perfil_id", user.id).order("created_at");
      if (alive) { setIds(((data ?? []) as { producto_id: string }[]).map((r) => r.producto_id)); setReady(true); }
    })();
    return () => { alive = false; };
  }, [user]);

  const toggle = useCallback(async (productId: string): Promise<boolean> => {
    const era = ids.includes(productId);
    const siguiente = era ? ids.filter((i) => i !== productId) : [...ids, productId].slice(-MAX_FAVORITOS);
    setIds(siguiente);
    if (!user) { guardarLocales(siguiente); return !era; }
    const { error } = era
      ? await db.from("delivery_favoritos_producto").delete().eq("perfil_id", user.id).eq("producto_id", productId)
      : await db.from("delivery_favoritos_producto").insert({ perfil_id: user.id, producto_id: productId });
    if (error) { setIds(ids); toast.error(errorMessage(error)); return era; }
    return !era;
  }, [ids, user]);

  return { ids, ready, isFavorite: (id: string) => ids.includes(id), toggle, enCuenta: Boolean(user) };
}

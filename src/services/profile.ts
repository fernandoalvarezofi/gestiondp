import { supabase } from "@/integrations/supabase/client";

export type MyProfile = { nombre: string | null; telefono: string | null; avatar_url: string | null; username: string | null };

/**
 * Perfil propio, con el teléfono. Es la única vía para leer el teléfono: la columna no es legible por la API.
 * Devuelve `null` si no hay sesión o no se pudo leer.
 */
export async function fetchMyProfile(): Promise<MyProfile | null> {
  const { data, error } = await supabase.rpc("delivery_mi_perfil");
  if (error || !data || typeof data !== "object") return null;
  return data as unknown as MyProfile;
}

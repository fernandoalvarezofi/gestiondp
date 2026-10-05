import { supabase } from "@/integrations/supabase/client";

export type RolNegocio = "owner" | "admin" | "manager" | "operator" | "seller";
export type TiendaDeNegocio = { id: string; nombre: string; slug: string; parent_store_id: string | null; aprobado: boolean; esta_abierto: boolean };
export type Negocio = { id: string; nombre: string; rol: RolNegocio; estado: "activo" | "suspendido"; tiendas: TiendaDeNegocio[] };

/** Negocios a los que pertenece la persona, con sus tiendas y sucursales. La autorización real la decide la base (RLS y funciones). */
export async function fetchMisNegocios(): Promise<Negocio[]> {
  const { data, error } = await supabase.rpc("delivery_mis_negocios");
  if (error || !Array.isArray(data)) return [];
  return data as unknown as Negocio[];
}

/** Sucursales (tiendas con `parent_store_id`) agrupadas bajo su tienda principal; las demás quedan como principales. */
export function agruparSucursales(tiendas: TiendaDeNegocio[]): { principal: TiendaDeNegocio; sucursales: TiendaDeNegocio[] }[] {
  const ids = new Set(tiendas.map((t) => t.id));
  return tiendas
    .filter((t) => !t.parent_store_id || !ids.has(t.parent_store_id))
    .map((principal) => ({ principal, sucursales: tiendas.filter((t) => t.parent_store_id === principal.id) }));
}

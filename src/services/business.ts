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

export type Integrante = { user_id: string; rol: RolNegocio; estado: "activo" | "invitado" | "suspendido"; nombre: string | null; created_at: string };
export type Invitacion = { business_id: string; negocio: string; rol: RolNegocio; created_at: string };

/** Integrantes del negocio (solo dueño y administradores; otro rol recibe lista vacía). */
export async function fetchIntegrantes(businessId: string): Promise<Integrante[]> {
  const { data, error } = await supabase.rpc("core_listar_integrantes", { p_business: businessId });
  return error || !Array.isArray(data) ? [] : (data as unknown as Integrante[]);
}

export async function fetchMisInvitaciones(): Promise<Invitacion[]> {
  const { data, error } = await supabase.rpc("core_mis_invitaciones");
  return error || !Array.isArray(data) ? [] : (data as unknown as Invitacion[]);
}

/** Invita por email (solo el dueño). La respuesta es la misma exista o no la cuenta: no se revela quién tiene cuenta. */
export const invitarIntegrante = (businessId: string, email: string, rol: Exclude<RolNegocio, "owner">) => supabase.rpc("core_agregar_integrante", { p_business: businessId, p_email: email, p_rol: rol });
export const responderInvitacion = (businessId: string, acepta: boolean) => supabase.rpc("core_responder_invitacion", { p_business: businessId, p_acepta: acepta });
export const cambiarRolIntegrante = (businessId: string, userId: string, rol: Exclude<RolNegocio, "owner">) => supabase.rpc("core_cambiar_rol", { p_business: businessId, p_user: userId, p_rol: rol });
export const quitarIntegrante = (businessId: string, userId: string) => supabase.rpc("core_quitar_integrante", { p_business: businessId, p_user: userId });

/** Qué puede hacer cada rol del negocio en todas sus tiendas (refleja lo que decide la base; sirve para mostrar u ocultar opciones, nunca para autorizar). */
export const PERMISOS_POR_ROL: Record<RolNegocio, readonly string[]> = {
  owner: ["pedidos", "catalogo", "promociones", "opiniones", "estadisticas", "ajustes", "finanzas", "equipo"],
  admin: ["pedidos", "catalogo", "promociones", "opiniones", "estadisticas", "ajustes", "finanzas", "equipo"],
  manager: ["pedidos", "catalogo", "promociones", "opiniones", "estadisticas", "ajustes"],
  operator: ["pedidos"],
  seller: ["pedidos", "catalogo"],
};

import { createClient } from "@supabase/supabase-js";

/**
 * Cliente de la BASE DE ADMINISTRACIÓN (proyecto "woref-admin"), distinta de la base de los usuarios.
 * La URL y la clave pública (publishable) son públicas por diseño: no dan acceso a nada. Los datos solo se leen con una
 * cuenta listada como administradora y con verificación en dos pasos, y lo controlan las reglas de esa base.
 * Tiene su propia sesión (otro almacenamiento) para no mezclarse con la de los usuarios de Woref.
 */
export const ADMIN_URL = "https://bfttmxxtojpbqaafwutb.supabase.co";
const ADMIN_PUBLISHABLE_KEY = "sb_publishable_tKAsi0DVTLRx2TWAlqHc6g_Ihqkfr96";

export const adminDb = createClient(ADMIN_URL, ADMIN_PUBLISHABLE_KEY, {
  auth: { storageKey: "woref-consola-auth", persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});

export type EventoAuditoria = { id: number; origen_id: number; ocurrio_at: string; recibido_at: string; actor_id: string | null; accion: string; entidad: string; entidad_id: string | null; detalle: Record<string, unknown>; hash: string };
export type ErrorApp = { id: number; ocurrio_at: string; huella: string; mensaje: string; stack: string | null; url: string | null; agente: string | null; usuario_id: string | null };
export type EstadoSesion = { admin: boolean; aal: "aal1" | "aal2"; configuracion_inicial: boolean };
export type ResumenAdmin = { auditoria_total: number; ultimo_evento_recibido: string | null; errores_24h: number; errores_total: number; ultimo_error_recibido: string | null };

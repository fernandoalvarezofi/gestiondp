import { db, errorMessage } from "@/lib/delivery";

export type IdentityState = "pendiente" | "en_revision" | "aprobada" | "rechazada";
export type Identity = {
  perfil_id: string; nombre_legal: string; dni: string; fecha_nacimiento: string | null; estado: IdentityState; motivo_rechazo: string | null;
  desafio: string; intentos: number; enviado_at: string | null; revisado_at: string | null; vence_at: string | null;
};
export type IdentityChecks = { datos: boolean; nitidez: boolean; rostro: boolean; desafio: boolean };

export const identityStateLabel: Record<IdentityState, string> = { pendiente: "Sin enviar", en_revision: "En revisión", aprobada: "Verificada", rechazada: "Rechazada" };

export const rejectionPresets = [
  "La foto del DNI está borrosa o cortada",
  "El nombre o el número no coinciden con los datos cargados",
  "La selfie no muestra el DNI junto a tu cara",
  "No se cumplió el gesto pedido en la selfie",
  "El documento está vencido o no es un DNI argentino",
];

export async function loadIdentity(userId: string): Promise<Identity | null> {
  const { data } = await db.from("delivery_identidad").select("*").eq("perfil_id", userId).maybeSingle();
  return (data as Identity | null) ?? null;
}

/** Mayor de 18 años a partir de la fecha ISO (AAAA-MM-DD). */
export function isAdult(isoDate: string, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const birth = new Date(year, month - 1, day);
  if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day || year < 1900) return false;
  const limit = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return birth <= limit;
}

/** Mismas reglas que la base: nombre y apellido, DNI de 7 u 8 números y mayoría de edad. */
export function validateIdentityData(name: string, dni: string, birth: string): string | null {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (cleanName.length < 5 || !cleanName.includes(" ")) return "Ingresá tu nombre y apellido tal como figuran en el DNI";
  if (!/^\d{7,8}$/.test(dni.replace(/\D/g, ""))) return "El DNI tiene que tener 7 u 8 números, sin puntos";
  if (!isAdult(birth)) return "Tenés que ser mayor de 18 años";
  return null;
}

export async function saveIdentity(name: string, dni: string, birth: string) {
  const { error } = await db.rpc("delivery_identidad_guardar", { p_nombre: name, p_dni: dni, p_nacimiento: birth });
  if (error) throw new Error(errorMessage(error));
}

export async function submitIdentity() {
  const { error } = await db.rpc("delivery_identidad_enviar");
  if (error) throw new Error(errorMessage(error));
}

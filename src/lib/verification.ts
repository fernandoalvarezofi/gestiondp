import { supabase } from "@/integrations/supabase/client";
import { db, errorMessage } from "@/lib/delivery";
import { compress } from "@/lib/uploads";

export type DocEntity = "repartidor" | "comercio" | "persona";
export type DocType = "dni_frente" | "dni_dorso" | "selfie" | "licencia" | "cedula_vehiculo" | "habilitacion" | "constancia_afip" | "dni_titular";
export type VerificationDoc = { id: string; entidad: DocEntity; entidad_id: string; tipo: DocType; path: string; created_at: string };
export type DocSpec = { tipo: DocType; label: string; hint: string; required: boolean };

const BUCKET = "verificaciones";
const MAX_BYTES = 6 * 1024 * 1024;
const PDF = "application/pdf";

export const docLabel: Record<DocType, string> = {
  dni_frente: "DNI (frente)", dni_dorso: "DNI (dorso)", selfie: "Selfie con tu DNI", licencia: "Licencia de conducir",
  cedula_vehiculo: "Cédula del vehículo", habilitacion: "Habilitación comercial", constancia_afip: "Constancia de inscripción en AFIP", dni_titular: "DNI del titular",
};

/** Documentos del vehículo (opcionales). El DNI y la selfie se cargan en el paso de verificación de identidad. */
export const courierDocs = (vehicle: string): DocSpec[] => [
  ...(vehicle === "moto" || vehicle === "auto" ? [
    { tipo: "licencia" as const, label: docLabel.licencia, hint: "Opcional por ahora, pero te va a servir para zonas con controles.", required: false },
    { tipo: "cedula_vehiculo" as const, label: docLabel.cedula_vehiculo, hint: "Opcional: cédula verde o azul del vehículo.", required: false },
  ] : []),
];

export const storeDocs: DocSpec[] = [
  { tipo: "constancia_afip", label: docLabel.constancia_afip, hint: "Opcional: acelera la aprobación y la facturación de la comisión.", required: false },
  { tipo: "habilitacion", label: docLabel.habilitacion, hint: "Opcional: habilitación municipal o bromatológica (gastronomía y farmacias).", required: false },
  { tipo: "dni_titular", label: docLabel.dni_titular, hint: "Opcional: DNI del titular o del responsable del local.", required: false },
];

const extensionOf = (type: string) => (type === PDF ? "pdf" : "jpg");

/** Sube el archivo al bucket privado (carpeta propia) y lo registra como documento de la entidad. */
export async function uploadVerificationDoc(file: File, userId: string, entidad: DocEntity, entidadId: string, tipo: DocType) {
  if (![PDF, "image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Subí una foto (JPG, PNG o WEBP) o un PDF");
  if (file.size > 15 * 1024 * 1024) throw new Error("El archivo es muy pesado (máximo 6 MB)");
  const blob = file.type === PDF ? file : await compress(file);
  if (blob.size > MAX_BYTES) throw new Error("El archivo es muy pesado (máximo 6 MB)");
  const type = blob.type || file.type;
  const path = `${userId}/${entidad}/${tipo}-${crypto.randomUUID()}.${extensionOf(type)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: type, cacheControl: "0" });
  if (error) throw new Error("No pudimos subir el archivo. Probá de nuevo.");
  const { error: registerError } = await db.rpc("delivery_documento_registrar", { p_entidad: entidad, p_entidad_id: entidadId, p_tipo: tipo, p_path: path });
  if (registerError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(errorMessage(registerError, "No pudimos registrar el documento"));
  }
}

/** Enlace temporal (5 minutos) para ver un documento privado. */
export async function signedDocUrl(path: string) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

export async function loadDocs(entidad: DocEntity, entidadId: string): Promise<VerificationDoc[]> {
  const { data } = await db.from("delivery_documentos").select("*").eq("entidad", entidad).eq("entidad_id", entidadId);
  return data || [];
}

/** CUIT con prefijo y dígito verificador válidos (misma regla que la base). */
export function isValidCuit(raw: string) {
  const cuit = raw.replace(/\D/g, "");
  if (!/^(20|23|24|27|30|33|34)\d{9}$/.test(cuit)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const sum = weights.reduce((total, weight, index) => total + weight * Number(cuit[index]), 0);
  const check = 11 - (sum % 11) === 11 ? 0 : 11 - (sum % 11);
  return check < 10 && check === Number(cuit[10]);
}

export const formatCuit = (raw: string) => {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  return digits.length > 10 ? `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}` : digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
};

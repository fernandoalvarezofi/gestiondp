import { supabase } from "@/integrations/supabase/client";

export type TotpFactor = { id: string; friendly_name?: string | null; created_at: string };

/** ¿La sesión tiene que confirmar el segundo factor? (tiene un factor verificado pero entró solo con contraseña) */
export async function mfaPending(): Promise<boolean> {
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return false;
  return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
}

export async function listTotpFactors(): Promise<TotpFactor[]> {
  const { data } = await supabase.auth.mfa.listFactors();
  return ((data?.totp ?? []) as TotpFactor[]).filter((factor) => factor);
}

/** Empieza a activar el 2FA: devuelve el QR (imagen SVG) y la clave para cargar a mano. */
export async function enrollTotp() {
  // Si quedó un intento a medias sin verificar, se descarta para no acumular factores.
  const { data: all } = await supabase.auth.mfa.listFactors();
  for (const factor of all?.all ?? []) if (factor.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: factor.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `Woref ${new Date().toLocaleDateString("es-AR")}` });
  if (error || !data) throw new Error(error?.message ?? "No pudimos iniciar la activación");
  return { factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Confirma un código de 6 dígitos (al activar y al ingresar). */
export async function verifyTotp(factorId: string, code: string) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\D/g, "") });
  if (error) throw new Error(/invalid|expired/i.test(error.message) ? "El código no es correcto o venció. Probá con el que muestra tu app ahora." : "No pudimos verificar el código. Probá de nuevo.");
}

export async function disableTotp(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw new Error("No pudimos desactivarlo. Confirmá tu código e intentá de nuevo.");
}

export const isSixDigits = (value: string) => /^\d{6}$/.test(value.replace(/\s/g, ""));

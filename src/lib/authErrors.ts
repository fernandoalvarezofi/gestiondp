import { sanitizeErrorMessage } from "@/lib/sanitize";

/** Traduce los errores de Supabase Auth a mensajes claros. */
export function authErrorMessage(message: string) {
  if (/invalid login credentials/i.test(message)) return "El email o la contraseña no son correctos.";
  if (/email not confirmed/i.test(message)) return "Todavía no confirmaste tu email. Buscá el link que te enviamos (revisá spam).";
  if (/already registered|already been registered/i.test(message)) return "Ya existe una cuenta con ese email. Iniciá sesión o recuperá tu contraseña.";
  if (/rate limit|too many/i.test(message)) return "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.";
  if (/same.*password|different from the old/i.test(message)) return "La contraseña nueva tiene que ser distinta de la anterior.";
  if (/password should be|weak password/i.test(message)) return "La contraseña es muy débil. Usá al menos 8 caracteres, con letras y números.";
  if (/invalid.*email|email address .* is invalid/i.test(message)) return "Ese email no es válido.";
  if (/network|failed to fetch/i.test(message)) return "No hay conexión. Revisá tu internet y probá de nuevo.";
  return sanitizeErrorMessage(message || "Ocurrió un error inesperado");
}

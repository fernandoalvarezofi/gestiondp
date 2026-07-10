/**
 * Maps raw auth/db error messages to safe, user-facing messages.
 */
export function sanitizeErrorMessage(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Invalid email or password.";
  if (lower.includes("email not confirmed")) return "Please verify your email before signing in.";
  if (lower.includes("user already registered")) return "An account with this email already exists.";
  if (lower.includes("password") && lower.includes("leak")) return "This password has been found in a data breach. Please choose a different one.";
  if (lower.includes("rate limit") || lower.includes("too many")) return "Too many attempts. Please wait a moment and try again.";
  if (lower.includes("row-level security")) return "You don't have permission to perform this action.";
  if (lower.includes("duplicate key")) return "This record already exists.";
  if (lower.includes("network") || lower.includes("fetch")) return "Network error. Please check your connection.";
  return "Something went wrong. Please try again.";
}

/**
 * Spanish-language safe error mapper for Lin surfaces.
 */
export function sanitizarErrorEs(raw: string): string {
  const lower = (raw || "").toLowerCase();
  if (lower.includes("row-level security") || lower.includes("permission")) return "No tenés permiso para realizar esta acción.";
  if (lower.includes("duplicate key") || lower.includes("unique")) return "Ese registro ya existe.";
  if (lower.includes("foreign key") || lower.includes("violates")) return "No se pudo completar la acción por una restricción de datos.";
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("failed to fetch")) return "Error de red. Revisá tu conexión.";
  if (lower.includes("rate limit") || lower.includes("too many")) return "Demasiados intentos. Probá de nuevo en un momento.";
  if (lower.includes("mensajes privados") || lower.includes("acepta mensajes")) return "Este usuario no acepta mensajes privados.";
  if (lower.includes("payload too large") || lower.includes("exceeded")) return "El archivo es demasiado grande.";
  if (lower.includes("mime") || lower.includes("invalid file")) return "Tipo de archivo no permitido.";
  if (lower.includes("authentication required") || lower.includes("not authorized") || lower.includes("jwt")) return "Iniciá sesión para continuar.";
  return "Ocurrió un error. Intentá de nuevo.";
}

/**
 * Sanitizes a URL to prevent javascript: protocol XSS.
 */
export function sanitizeHref(href: string): string {
  const trimmed = href.trim();
  if (/^javascript:/i.test(trimmed) || /^data:/i.test(trimmed) || /^vbscript:/i.test(trimmed)) {
    return "#";
  }
  return trimmed;
}

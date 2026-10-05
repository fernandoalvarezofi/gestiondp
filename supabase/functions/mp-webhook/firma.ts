// Verificación de la firma de las notificaciones de Mercado Pago (cabecera x-signature). Código puro, sin dependencias de Deno,
// para poder probarlo. Documentación: el manifiesto es `id:<data.id en minúsculas>;request-id:<x-request-id>;ts:<ts>;` firmado con HMAC-SHA256.
export type ResultadoFirma = "ok" | "ausente" | "invalida" | "vencida";

const TOLERANCIA_MS = 10 * 60 * 1000;

function aHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

// Comparación en tiempo constante.
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function leerCabecera(xSignature: string | null): { ts: string; v1: string } | null {
  if (!xSignature) return null;
  let ts = "";
  let v1 = "";
  for (const parte of xSignature.split(",")) {
    const [clave, valor] = parte.split("=", 2).map((s) => s?.trim() ?? "");
    if (clave === "ts") ts = valor;
    if (clave === "v1") v1 = valor;
  }
  return ts && v1 ? { ts, v1 } : null;
}

export async function firmar(secreto: string, dataId: string, requestId: string, ts: string): Promise<string> {
  const manifiesto = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const clave = await crypto.subtle.importKey("raw", new TextEncoder().encode(secreto), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return aHex(await crypto.subtle.sign("HMAC", clave, new TextEncoder().encode(manifiesto)));
}

export async function verificarFirma(opts: {
  secreto: string; xSignature: string | null; xRequestId: string | null; dataId: string; ahora?: number;
}): Promise<ResultadoFirma> {
  const cabecera = leerCabecera(opts.xSignature);
  if (!cabecera || !opts.xRequestId) return "ausente";
  const esperada = await firmar(opts.secreto, opts.dataId, opts.xRequestId, cabecera.ts);
  if (!iguales(esperada, cabecera.v1.toLowerCase())) return "invalida";
  const ts = Number(cabecera.ts);
  if (!Number.isFinite(ts) || Math.abs((opts.ahora ?? Date.now()) - ts) > TOLERANCIA_MS) return "vencida";
  return "ok";
}

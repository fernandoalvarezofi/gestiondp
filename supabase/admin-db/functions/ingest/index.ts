// Ingesta de auditoría y errores desde la base principal de Woref hacia la base de administración.
// Autenticación: firma HMAC-SHA256 del cuerpo con un secreto compartido (no usa JWT). Solo se acepta agregar eventos:
// la base principal nunca puede leer ni modificar lo que ya está acá. Reenviar el mismo evento no lo duplica.
import { createClient } from "jsr:@supabase/supabase-js@2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const encoder = new TextEncoder();
const MAX_BODY = 1_000_000;
const MAX_ITEMS = 200;
const VENTANA_SEG = 300;

let cache: { value: string; at: number } | null = null;
async function secret(): Promise<string | null> {
  if (cache && Date.now() - cache.at < 60_000) return cache.value;
  const { data } = await admin.from("config").select("valor").eq("clave", "ingest_secret").maybeSingle();
  if (!data?.valor) return null;
  cache = { value: data.valor, at: Date.now() };
  return cache.value;
}

async function firma(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(message)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparación en tiempo constante para no filtrar información por la demora. */
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "método no permitido" });
  const ts = req.headers.get("x-woref-ts") ?? "";
  const sig = req.headers.get("x-woref-sig") ?? "";
  const body = await req.text();
  if (body.length > MAX_BODY) return json(413, { error: "demasiado grande" });

  const edad = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(edad) || edad > VENTANA_SEG) return json(401, { error: "fuera de hora" });
  const clave = await secret();
  if (!clave) return json(503, { error: "sin configurar" });
  const esperada = await firma(clave, `${ts}.${body}`);
  if (!iguales(esperada, sig.toLowerCase())) return json(401, { error: "firma inválida" });

  let datos: { auditoria?: unknown; errores?: unknown; metricas?: unknown };
  try { datos = JSON.parse(body); } catch { return json(400, { error: "json inválido" }); }
  const auditoria = Array.isArray(datos.auditoria) ? datos.auditoria : [];
  const errores = Array.isArray(datos.errores) ? datos.errores : [];
  const metricas = Array.isArray(datos.metricas) ? datos.metricas : [];
  if (auditoria.length > MAX_ITEMS || errores.length > MAX_ITEMS || metricas.length > 600) return json(413, { error: "demasiados eventos" });

  // Métricas agregadas (idempotentes: se pisan por día y clave).
  let guardadas = 0;
  if (metricas.length > 0) {
    const { data: n, error: errorMetricas } = await admin.rpc("ingest_metricas", { p_metricas: metricas });
    if (errorMetricas) return json(400, { error: "no se pudieron guardar las métricas", detalle: errorMetricas.message.slice(0, 120) });
    guardadas = Number(n) || 0;
  }
  if (auditoria.length === 0 && errores.length === 0) return json(200, { ok: true, auditoria: 0, errores: 0, metricas: guardadas });

  const { data, error } = await admin.rpc("ingest_lote", { p_auditoria: auditoria, p_errores: errores });
  if (error) return json(400, { error: "no se pudo guardar", detalle: error.message.slice(0, 120) });
  return json(200, { ok: true, ...(data as Record<string, number>), metricas: guardadas });
});

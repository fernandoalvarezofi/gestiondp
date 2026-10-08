import { db } from "@/lib/delivery";
import { compress } from "@/lib/uploads";

/*
 * Mensajería de Woref: un solo motor para todas las conversaciones. Cada hilo está atado a un contexto
 * (pedido, viaje, envío o consulta a un local) y el servidor decide quién participa y cuándo se puede escribir.
 */

export type MsgContexto = "pedido" | "viaje" | "envio" | "consulta";
export type MsgCanal = "cliente_comercio" | "cliente_repartidor" | "comercio_repartidor" | "pasajero_conductor" | "consulta";
export type MsgRol = "cliente" | "comercio" | "repartidor" | "conductor" | "pasajero" | "admin";
export type MsgTipo = "texto" | "rapido" | "ubicacion" | "foto" | "sistema";

/** Cómo se ve un hilo para mí: con quién hablo y de qué contexto. */
export type HiloResumen = {
  id: string; contexto: MsgContexto; contexto_id: string | null; canal: MsgCanal; rol: MsgRol;
  titulo: string; subtitulo: string; referencia: string | null; estado: string | null; url: string | null; logo_url: string | null;
};
export type HiloInfo = HiloResumen & { puede_escribir: boolean; motivo_cerrado: string | null; bloqueado: boolean };
export type HiloBandeja = HiloResumen & { ultimo_texto: string | null; ultimo_mensaje_at: string; ultimo_mio: boolean; archivado: boolean; sin_leer: number };
export type Mensaje = { id: number; autor_rol: MsgRol; mio: boolean; tipo: MsgTipo; texto: string | null; lat: number | null; lng: number | null; foto_path: string | null; oculto: boolean; created_at: string };
export type PaginaMensajes = { mi_rol: MsgRol | null; otro_leido_at: string | null; mensajes: Mensaje[] };

export const MAX_MENSAJE = 1000;
export const mensajeValido = (texto: string) => texto.trim().length > 0 && texto.trim().length <= MAX_MENSAJE;

/** Abre (o retoma) el hilo de un pedido, viaje o envío. */
export async function abrirHilo(contexto: Exclude<MsgContexto, "consulta">, id: string, canal: MsgCanal) {
  const { data, error } = await db.rpc("msg_abrir", { p_contexto: contexto, p_id: id, p_canal: canal });
  if (error) throw error;
  return data as string;
}

/** Busca el hilo SIN crearlo (para mostrar globitos de sin leer en listas). */
export async function buscarHilo(contexto: Exclude<MsgContexto, "consulta">, id: string, canal: MsgCanal) {
  const { data } = await db.from("msg_hilos").select("id").eq("contexto", contexto).eq("contexto_id", id).eq("canal", canal).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

/** Mensajes sin leer de un hilo para mí (los de la otra parte después de mi última lectura). */
export async function sinLeerDeHilo(hilo: string, userId: string) {
  const { data: lectura } = await db.from("msg_lecturas").select("leido_at").eq("hilo_id", hilo).eq("usuario_id", userId).maybeSingle();
  let query = db.from("msg_mensajes").select("id", { count: "exact", head: true }).eq("hilo_id", hilo).neq("autor_id", userId);
  if (lectura?.leido_at) query = query.gt("created_at", lectura.leido_at);
  const { count } = await query;
  return count ?? 0;
}

export async function iniciarConsulta(comercio: string, texto: string, producto?: string) {
  const { data, error } = await db.rpc("msg_consulta_iniciar", { p_comercio: comercio, p_texto: texto.trim(), p_producto: producto ?? null });
  if (error) throw error;
  return data as string;
}

export async function enviarMensaje(hilo: string, mensaje: { tipo: Exclude<MsgTipo, "sistema">; texto?: string; lat?: number; lng?: number; foto?: string }) {
  const { error } = await db.rpc("msg_enviar", { p_hilo: hilo, p_tipo: mensaje.tipo, p_texto: mensaje.texto ?? null, p_lat: mensaje.lat ?? null, p_lng: mensaje.lng ?? null, p_foto: mensaje.foto ?? null });
  if (error) throw error;
}

export async function fetchMensajes(hilo: string, antes?: number): Promise<PaginaMensajes> {
  const { data, error } = await db.rpc("msg_mensajes", { p_hilo: hilo, p_antes: antes ?? null });
  if (error) throw error;
  return data as PaginaMensajes;
}

export async function fetchHiloInfo(hilo: string): Promise<HiloInfo> {
  const { data, error } = await db.rpc("msg_hilo_info", { p_hilo: hilo });
  if (error) throw error;
  return data as HiloInfo;
}

export const marcarLeido = (hilo: string) => db.rpc("msg_marcar_leido", { p_hilo: hilo }).then(() => undefined);

export async function archivarHilo(hilo: string, archivar: boolean) {
  const { error } = await db.rpc("msg_archivar", { p_hilo: hilo, p_archivar: archivar });
  if (error) throw error;
}

/** Bandeja: con `comercio`, la del local; con `rol`, la del contexto (cliente, repartidor o conductor). */
export async function fetchBandeja(opts: { comercio?: string | null; rol?: "cliente" | "repartidor" | "conductor" | null }): Promise<HiloBandeja[]> {
  const { data, error } = await db.rpc("msg_bandeja", { p_comercio: opts.comercio ?? null, p_rol: opts.rol ?? null });
  if (error) throw error;
  return (data ?? []) as HiloBandeja[];
}

export async function fetchSinLeer(opts: { comercio?: string | null; rol?: "cliente" | "repartidor" | "conductor" | null }) {
  const { data } = await db.rpc("msg_sin_leer", { p_comercio: opts.comercio ?? null, p_rol: opts.rol ?? null });
  return (data as number | null) ?? 0;
}

export async function reportarMensaje(mensaje: number, motivo: string) {
  const { error } = await db.rpc("msg_reportar", { p_mensaje: mensaje, p_motivo: motivo });
  if (error) throw error;
}

export async function bloquearConsulta(hilo: string, bloquear: boolean) {
  const { error } = await db.rpc("msg_bloquear", { p_hilo: hilo, p_bloquear: bloquear });
  if (error) throw error;
}

/** Sube una foto comprimida a la carpeta del hilo (solo la pueden ver quienes participan). */
export async function subirFoto(hilo: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Elegí una imagen");
  const blob = await compress(file);
  const path = `${hilo}/${crypto.randomUUID()}.jpg`;
  const { error } = await db.storage.from("mensajes").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
}

const fotoCache = new Map<string, { url: string; vence: number }>();
/** URL temporal (10 min) de una foto de un hilo. */
export async function urlFoto(path: string) {
  const cached = fotoCache.get(path);
  if (cached && cached.vence > Date.now()) return cached.url;
  const { data } = await db.storage.from("mensajes").createSignedUrl(path, 600);
  if (data?.signedUrl) fotoCache.set(path, { url: data.signedUrl, vence: Date.now() + 540_000 });
  return data?.signedUrl ?? null;
}

export type ReporteMensaje = { id: number; mensaje_id: number; hilo_id: string; motivo: string; created_at: string; texto: string | null; tipo: MsgTipo; autor_rol: MsgRol; autor: string; reporta: string; oculto: boolean; contexto: HiloResumen };
export async function fetchReportes(): Promise<ReporteMensaje[]> {
  const { data, error } = await db.rpc("msg_admin_reportes");
  if (error) throw error;
  return (data ?? []) as ReporteMensaje[];
}
export async function resolverReporte(reporte: number, ocultar: boolean) {
  const { error } = await db.rpc("msg_admin_resolver", { p_reporte: reporte, p_ocultar: ocultar });
  if (error) throw error;
}

/** Respuestas rápidas según quién escribe y a quién (como en Uber/PedidosYa). */
export function respuestasRapidas(rol: MsgRol | null, canal: MsgCanal): string[] {
  if (rol === "repartidor" && canal === "cliente_repartidor") return ["Ya estoy en camino", "Llegué, estoy afuera", "Estoy a 2 minutos", "No encuentro la dirección", "¿Me das una referencia?"];
  if (rol === "cliente" && canal === "cliente_repartidor") return ["Ya salgo", "Estoy en la puerta", "Tocá timbre, por favor", "¿Cuánto falta?"];
  if (rol === "conductor") return ["Ya llegué", "Estoy a 2 minutos", "¿Dónde te encuentro?", "No encuentro la dirección"];
  if (rol === "pasajero") return ["Ya salgo", "Estoy en la esquina", "Esperame 2 minutos", "¿Dónde estás?"];
  if (rol === "comercio" && canal === "cliente_comercio") return ["Tu pedido está en preparación", "Tu pedido está listo", "Nos falta un producto, ¿lo cambiamos?"];
  if (rol === "cliente" && canal === "cliente_comercio") return ["¿Cuánto falta?", "¿Pueden agregar servilletas?", "Gracias"];
  if (rol === "comercio" && canal === "comercio_repartidor") return ["El pedido está listo", "Faltan 5 minutos", "Retiralo por la puerta del costado"];
  if (rol === "repartidor" && canal === "comercio_repartidor") return ["Estoy llegando al local", "Ya estoy en el local", "¿Falta mucho?"];
  if (rol === "comercio" && canal === "consulta") return ["¡Sí, tenemos!", "No nos queda, perdón", "Te paso el precio"];
  return [];
}

/** Enlace para ver una ubicación compartida en el mapa. */
export const linkUbicacion = (lat: number, lng: number) => `https://www.google.com/maps?q=${lat},${lng}`;

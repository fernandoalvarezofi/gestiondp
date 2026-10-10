import { db } from "@/lib/delivery";

/** Woref Logística: envíos de paquetes con seguimiento (local e interurbano). La lógica vive en el servidor (funciones log_*). */

export type EstadoLog = "creado" | "admitido" | "en_centro" | "en_transito" | "en_sucursal" | "en_distribucion" | "visita_fallida" | "entregado" | "en_devolucion" | "devuelto" | "cancelado" | "siniestrado";
export type Servicio = "express" | "estandar" | "prioritario";

export const ESTADOS_LOG: Record<EstadoLog, { texto: string; corto: string; clase: string }> = {
  creado: { texto: "Pendiente de ingreso", corto: "Pendiente", clase: "bg-muted text-muted-foreground" },
  admitido: { texto: "Recibido", corto: "Recibido", clase: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  en_centro: { texto: "En centro de distribución", corto: "En centro", clase: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  en_transito: { texto: "En viaje", corto: "En viaje", clase: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  en_sucursal: { texto: "En sucursal", corto: "En sucursal", clase: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300" },
  en_distribucion: { texto: "En reparto", corto: "En reparto", clase: "bg-warning/20 text-warning-foreground" },
  visita_fallida: { texto: "Visita sin éxito", corto: "Visita fallida", clase: "bg-destructive/10 text-destructive" },
  entregado: { texto: "Entregado", corto: "Entregado", clase: "bg-success/15 text-success" },
  en_devolucion: { texto: "En devolución", corto: "Devolución", clase: "bg-destructive/10 text-destructive" },
  devuelto: { texto: "Devuelto al remitente", corto: "Devuelto", clase: "bg-foreground/10 text-foreground/70" },
  cancelado: { texto: "Cancelado", corto: "Cancelado", clase: "bg-foreground/10 text-foreground/70" },
  siniestrado: { texto: "Con siniestro", corto: "Siniestro", clase: "bg-destructive/15 text-destructive" },
};
export const ESTADOS_FINALES: EstadoLog[] = ["entregado", "devuelto", "cancelado", "siniestrado"];
/** Pasos que se muestran en la barra de progreso del seguimiento. */
export const PASOS_LOG: { id: EstadoLog[]; texto: string }[] = [
  { id: ["creado"], texto: "Creado" },
  { id: ["admitido", "en_centro"], texto: "Recibido" },
  { id: ["en_transito", "en_sucursal"], texto: "En viaje" },
  { id: ["en_distribucion", "visita_fallida"], texto: "En reparto" },
  { id: ["entregado"], texto: "Entregado" },
];
export const pasoDe = (e: EstadoLog) => PASOS_LOG.findIndex((p) => p.id.includes(e));

/** Transiciones que ofrece la operación (el servidor las valida igual). */
export const SIGUIENTES: Partial<Record<EstadoLog, EstadoLog[]>> = {
  creado: ["admitido", "cancelado"],
  admitido: ["en_centro", "en_distribucion", "en_sucursal", "siniestrado"],
  en_centro: ["en_transito", "en_distribucion", "en_sucursal", "en_devolucion", "siniestrado"],
  en_transito: ["en_centro", "en_sucursal", "en_distribucion", "siniestrado"],
  en_sucursal: ["en_distribucion", "entregado", "en_devolucion", "en_transito", "siniestrado"],
  en_distribucion: ["entregado", "visita_fallida", "en_centro", "siniestrado"],
  visita_fallida: ["en_distribucion", "en_sucursal", "en_centro", "en_devolucion", "siniestrado"],
  en_devolucion: ["en_transito", "en_centro", "devuelto", "siniestrado"],
};
export const PIDE_SUCURSAL: EstadoLog[] = ["en_centro", "en_sucursal"];

export const SERVICIOS: Record<Servicio, { texto: string; detalle: string }> = {
  express: { texto: "Express", detalle: "En el día, dentro de la misma ciudad" },
  estandar: { texto: "Estándar", detalle: "A todo el país" },
  prioritario: { texto: "Prioritario", detalle: "Más rápido, a todo el país" },
};
export const TIPOS_INCIDENCIA: Record<string, string> = {
  demora: "Demora", danio: "Llegó dañado", extravio: "Extravío", direccion: "Dirección incorrecta", ausente: "Destinatario ausente", rechazo: "Rechazo", reembolso: "Contra reembolso", otro: "Otro",
};
export const MOTIVOS_VISITA = ["No había nadie", "Dirección incorrecta o incompleta", "Destinatario rechazó el paquete", "No pudo pagar el contra reembolso", "Zona inaccesible", "Otro"];

export type Bulto = { peso_kg: number; alto_cm?: number | null; ancho_cm?: number | null; largo_cm?: number | null };
export type Cotizacion = { ok: true; flete: number; seguro: number; comision_reembolso: number; retiro: number; total: number; peso_real: number; peso_vol: number; peso_facturable: number; zona_origen_nombre: string; zona_destino_nombre: string; dias: number; fecha_estimada: string } | { ok: false; motivo: string };

export type EnvioLog = {
  id: string; numero: string; cuenta_id: string; comercio_id: string | null; pedido_id: string | null; referencia: string | null; servicio: Servicio; origen_modo: "retiro" | "sucursal"; entrega_modo: "domicilio" | "sucursal";
  rem_nombre: string; rem_telefono: string | null; rem_direccion: string | null; rem_ciudad: string | null; rem_provincia: string | null; rem_cp: number; sucursal_origen_id: string | null;
  des_nombre: string; des_telefono: string; des_email: string | null; des_dni: string | null; des_direccion: string | null; des_ciudad: string; des_provincia: string; des_cp: number; des_notas: string | null; sucursal_destino_id: string | null;
  bultos: number; peso_kg: number; peso_vol_kg: number; peso_facturable: number; valor_declarado: number; contenido: string | null; reembolso: number;
  precio_flete: number; precio_seguro: number; precio_reembolso: number; precio_retiro: number; precio_total: number;
  estado: EstadoLog; sucursal_actual_id: string | null; intentos: number; fecha_estimada: string | null; retiro_id: string | null; hoja_ruta_id: string | null;
  receptor_nombre: string | null; receptor_dni: string | null; entregado_at: string | null; reembolso_cobrado: boolean; rendicion_id: string | null; motivo_cancelacion: string | null; created_at: string; updated_at: string;
};
export type EventoLog = { id: number; envio_id: string; estado: EstadoLog; descripcion: string; sucursal_id: string | null; detalle: string | null; visible: boolean; created_at: string };
export type BultoLog = { id: string; envio_id: string; nro: number; codigo: string; peso_kg: number; alto_cm: number | null; ancho_cm: number | null; largo_cm: number | null };
export type Sucursal = { id: string; codigo: string; nombre: string; tipo: "centro" | "sucursal" | "punto"; direccion: string; ciudad: string; provincia: string; cp: number; telefono: string | null; horario: string | null; activa: boolean };
export type Cuenta = {
  id: string; numero: number; tipo: "comercio" | "empresa" | "particular"; comercio_id: string | null; razon_social: string; nombre_fantasia: string | null; cuit: string | null; condicion_iva: string | null;
  contacto_nombre: string | null; email: string | null; telefono: string | null; direccion_retiro: string | null; ciudad: string | null; provincia: string | null; cp: number | null;
  tarifario_id: string | null; condicion_pago: "contado" | "cuenta_corriente"; limite_credito: number; estado: "prospecto" | "activa" | "suspendida"; etiquetas: string[]; notas: string | null; created_at: string; updated_at: string;
};
export type Retiro = { id: string; cuenta_id: string; direccion: string; ciudad: string | null; cp: number | null; contacto: string | null; telefono: string | null; fecha: string; franja: "manana" | "tarde"; estado: "solicitado" | "asignado" | "realizado" | "fallido" | "cancelado"; repartidor_id: string | null; notas: string | null; motivo: string | null; created_at: string };
export type Incidencia = { id: string; numero: number; envio_id: string; cuenta_id: string; tipo: string; estado: "abierta" | "en_gestion" | "resuelta"; descripcion: string; resolucion: string | null; created_at: string; resuelta_at: string | null };
export type EstadoCuenta = { facturado: number; pagado: number; saldo: number; mes_envios: number; mes_monto: number; reembolsos_sin_rendir: number; rendiciones_pendientes: number; condicion_pago: string; limite_credito: number };
export type Seguimiento = {
  numero: string; estado: EstadoLog; servicio: Servicio; entrega_modo: "domicilio" | "sucursal"; destino: string; origen: string; bultos: number; fecha_estimada: string | null; creado: string; entregado_at: string | null;
  receptor: string | null; intentos: number; sucursal_destino: { nombre: string; direccion: string; ciudad: string; horario: string | null } | null;
  eventos: { estado: EstadoLog; descripcion: string; fecha: string; lugar: string | null }[];
};
export type EntregaRepartidor = { id: string; numero: string; estado: EstadoLog; hoja: number; des_nombre: string; des_telefono: string; des_direccion: string | null; des_ciudad: string; des_notas: string | null; des_lat: number | null; des_lng: number | null; bultos: number; reembolso: number; intentos: number; remitente: string };

const lanzar = (error: unknown) => { if (error) throw error; };
export const FRANJA: Record<"manana" | "tarde", string> = { manana: "Mañana (9 a 13 h)", tarde: "Tarde (14 a 18 h)" };

export async function cotizar(args: { cuenta?: string | null; comercio?: string | null; servicio: Servicio; cpOrigen: number; cpDestino: number; bultos: Bulto[]; valor?: number; reembolso?: number; retiro?: boolean }): Promise<Cotizacion> {
  const { data, error } = await db.rpc("log_cotizar", { p_cuenta: args.cuenta ?? null, p_comercio: args.comercio ?? null, p_servicio: args.servicio, p_cp_origen: args.cpOrigen, p_cp_destino: args.cpDestino,
    p_bultos: args.bultos, p_valor: args.valor ?? 0, p_reembolso: args.reembolso ?? 0, p_retiro: Boolean(args.retiro) });
  lanzar(error);
  return data as Cotizacion;
}
export async function crearEnvio(datos: Record<string, unknown>): Promise<{ id: string; numero: string }> { const { data, error } = await db.rpc("log_crear_envio", { p: datos }); lanzar(error); return data; }
export async function cancelarEnvio(id: string, motivo: string) { const { error } = await db.rpc("log_cancelar", { p_envio: id, p_motivo: motivo }); lanzar(error); }
export async function avanzar(id: string, estado: EstadoLog, extra: { sucursal?: string | null; detalle?: string | null; receptorNombre?: string | null; receptorDni?: string | null; cobrado?: boolean } = {}) {
  const { error } = await db.rpc("log_avanzar", { p_envio: id, p_estado: estado, p_sucursal: extra.sucursal ?? null, p_detalle: extra.detalle ?? null, p_receptor_nombre: extra.receptorNombre ?? null, p_receptor_dni: extra.receptorDni ?? null, p_cobrado: Boolean(extra.cobrado) });
  lanzar(error);
}
export async function escanear(codigos: string[], estado: EstadoLog, sucursal: string | null, detalle?: string): Promise<{ codigo: string; numero?: string; ok: boolean; mensaje: string }[]> {
  const { data, error } = await db.rpc("log_escanear", { p_codigos: codigos, p_estado: estado, p_sucursal: sucursal, p_detalle: detalle ?? null }); lanzar(error); return data ?? [];
}
export async function solicitarRetiro(args: { comercio?: string | null; cuenta?: string | null; fecha: string; franja: "manana" | "tarde"; envios: string[]; direccion?: string; notas?: string }) {
  const { data, error } = await db.rpc("log_solicitar_retiro", { p_comercio: args.comercio ?? null, p_cuenta: args.cuenta ?? null, p_fecha: args.fecha, p_franja: args.franja, p_envios: args.envios, p_direccion: args.direccion ?? null, p_notas: args.notas ?? null });
  lanzar(error); return data as string;
}
export async function actualizarRetiro(id: string, estado: Retiro["estado"], repartidor?: string | null, motivo?: string | null) {
  const { error } = await db.rpc("log_retiro_actualizar", { p_retiro: id, p_estado: estado, p_repartidor: repartidor ?? null, p_motivo: motivo ?? null }); lanzar(error);
}
export async function crearHoja(repartidor: string, sucursal: string | null, codigos: string[]): Promise<{ id: string; numero: number; cargados: number; errores: { codigo: string; mensaje: string }[] }> {
  const { data, error } = await db.rpc("log_hoja_crear", { p_repartidor: repartidor, p_sucursal: sucursal, p_codigos: codigos }); lanzar(error); return data;
}
export async function cerrarHoja(id: string): Promise<number> { const { data, error } = await db.rpc("log_hoja_cerrar", { p_hoja: id }); lanzar(error); return data; }
export async function misEntregas(): Promise<EntregaRepartidor[]> { const { data, error } = await db.rpc("log_mis_entregas"); lanzar(error); return data ?? []; }
export async function resolverEntrega(id: string, resultado: "entregado" | "fallida", d: { nombre?: string; dni?: string; motivo?: string; cobrado?: boolean }) {
  const { error } = await db.rpc("log_entrega", { p_envio: id, p_resultado: resultado, p_receptor_nombre: d.nombre ?? null, p_receptor_dni: d.dni ?? null, p_motivo: d.motivo ?? null, p_cobrado: Boolean(d.cobrado) }); lanzar(error);
}
export async function abrirIncidencia(envio: string, tipo: string, descripcion: string) { const { data, error } = await db.rpc("log_incidencia_abrir", { p_envio: envio, p_tipo: tipo, p_descripcion: descripcion }); lanzar(error); return data as string; }
export async function actualizarIncidencia(id: string, estado: Incidencia["estado"], resolucion?: string) { const { error } = await db.rpc("log_incidencia_actualizar", { p_id: id, p_estado: estado, p_resolucion: resolucion ?? null }); lanzar(error); }
export async function estadoCuenta(cuenta: string): Promise<EstadoCuenta> { const { data, error } = await db.rpc("log_estado_cuenta", { p_cuenta: cuenta }); lanzar(error); return data; }
export async function seguimiento(numero: string): Promise<Seguimiento | null> { const { data, error } = await db.rpc("log_seguimiento", { p_numero: numero }); lanzar(error); return data; }
export async function cuentaDeComercio(comercio: string): Promise<string> { const { data, error } = await db.rpc("log_cuenta_de_comercio", { p_comercio: comercio }); lanzar(error); return data; }
export async function sucursalesActivas(): Promise<Sucursal[]> { const { data } = await db.from("log_sucursales").select("*").eq("activa", true).order("provincia").order("ciudad"); return (data ?? []) as Sucursal[]; }

export const enlaceSeguimiento = (numero: string) => `${typeof window !== "undefined" ? window.location.origin : "https://woref.vercel.app"}/seguimiento/${numero}`;
export const esFinal = (e: EstadoLog) => ESTADOS_FINALES.includes(e);

/** Envíos con sus bultos, para imprimir etiquetas de varios a la vez. */
export async function paraEtiquetas(ids: string[]): Promise<{ envio: EnvioLog; bultos: BultoLog[] }[]> {
  if (ids.length === 0) return [];
  const [{ data: envios, error }, { data: bultos, error: e2 }] = await Promise.all([
    db.from("log_envios").select("*").in("id", ids),
    db.from("log_bultos").select("*").in("envio_id", ids).order("nro"),
  ]);
  lanzar(error); lanzar(e2);
  return ((envios ?? []) as EnvioLog[]).map((envio) => ({ envio, bultos: ((bultos ?? []) as BultoLog[]).filter((b) => b.envio_id === envio.id) }));
}

/** Próximos días hábiles (lunes a sábado) para programar un retiro. */
export function diasRetiro(cantidad = 8, desde = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(desde);
  while (out.length < cantidad) {
    if (d.getDay() !== 0) out.push(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
export const fechaCorta = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

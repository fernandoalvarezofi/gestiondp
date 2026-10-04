import { supabase } from "@/integrations/supabase/client";
import { Beer, Cake, Coffee, Cross, Flame, IceCream, Pizza, Salad, ShoppingBasket, Shirt, Sandwich, Store, Utensils, type LucideIcon } from "lucide-react";

// Las tablas de delivery todavía no están en los tipos generados de Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export type Categoria = "comida" | "supermercado" | "farmacia" | "tiendas";
export type EstadoPedido = "pendiente" | "confirmado" | "preparando" | "listo" | "en_camino" | "entregado" | "cancelado";
export type TipoEntrega = "delivery" | "retiro";
export type MetodoPago = "efectivo" | "tarjeta" | "transferencia" | "mercadopago";
export type PagoEstado = "no_requiere" | "pendiente" | "aprobado" | "rechazado" | "a_reintegrar" | "reintegrado";

export type DeliveryStore = {
  id: string;
  propietario_id?: string | null;
  nombre: string;
  slug: string;
  categoria: Categoria;
  rubro?: string | null;
  descripcion?: string | null;
  tienda_tema?: unknown;
  direccion: string;
  telefono?: string | null;
  horario?: string | null;
  imagen_url?: string | null;
  logo_url?: string | null;
  rating: number;
  total_resenas: number;
  tiempo_min: number;
  tiempo_max: number;
  costo_envio: number;
  pedido_minimo: number;
  envio_gratis_desde?: number | null;
  promo_texto?: string | null;
  esta_abierto: boolean;
  horarios?: Horarios | null;
  latitud?: number | null;
  longitud?: number | null;
  radio_entrega_km?: number | null;
  costo_por_km?: number | null;
  aprobado?: boolean;
  motivo_rechazo?: string | null;
  destacado?: boolean;
  activo?: boolean;
  acepta_retiro?: boolean;
  acepta_programados?: boolean;
  pausado_hasta?: string | null;
  tiempo_preparacion_min?: number;
  comision_pct?: number;
  created_at?: string;
};

/** Turnos por día de la semana: "0" = domingo … "6" = sábado. Un día sin turnos está cerrado. */
export type Turno = { abre: string; cierra: string };
export type Horarios = Record<string, Turno[]>;

export const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const defaultSchedule: Horarios = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [String(day), [{ abre: "10:00", cierra: "23:00" }]]));

/** Cierre especial (feriado, vacaciones): se guarda dentro de "horarios.cierres" y lo respeta la base al aceptar pedidos. */
export type Cierre = { desde: string; hasta: string; motivo?: string };
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
export const getClosures = (horarios: Horarios | null | undefined): Cierre[] => {
  const raw = (horarios as unknown as { cierres?: unknown } | null | undefined)?.cierres;
  return Array.isArray(raw) ? raw.filter((item): item is Cierre => Boolean(item) && DATE_KEY.test(item.desde) && DATE_KEY.test(item.hasta ?? item.desde)).map((item) => ({ ...item, hasta: item.hasta ?? item.desde })) : [];
};
export const withClosures = (horarios: Horarios, cierres: Cierre[]): Horarios => {
  const { cierres: _previous, ...days } = horarios as unknown as Record<string, unknown>;
  return (cierres.length ? { ...days, cierres } : days) as unknown as Horarios;
};
/** Fecha (AAAA-MM-DD) en Argentina. */
export const argentinaDateKey = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
export const activeClosure = (horarios: Horarios | null | undefined, date = new Date()): Cierre | null => {
  const today = argentinaDateKey(date);
  return getClosures(horarios).find((item) => today >= item.desde && today <= item.hasta) ?? null;
};

/** Hora actual en Argentina, independiente de la zona horaria del dispositivo. */
function argentinaNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { day, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

const toMinutes = (value: string) => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + (minutes || 0);
};

/** Misma regla que delivery_abierto_ahora en la base: turnos que cruzan la medianoche siguen abiertos al día siguiente. */
export function withinSchedule(horarios: Horarios | null | undefined, date = new Date()) {
  if (!horarios) return true;
  if (activeClosure(horarios, date)) return false;
  const { day, minutes } = argentinaNow(date);
  const today = horarios[String(day)] || [];
  const yesterday = horarios[String((day + 6) % 7)] || [];
  for (const turno of today) {
    const abre = toMinutes(turno.abre);
    const cierra = toMinutes(turno.cierra);
    if (cierra > abre && minutes >= abre && minutes < cierra) return true;
    if (cierra <= abre && minutes >= abre) return true;
  }
  return yesterday.some((turno) => toMinutes(turno.cierra) <= toMinutes(turno.abre) && minutes < toMinutes(turno.cierra));
}

/** Abierto = el comercio no está pausado y está dentro de su horario. */
/** ¿Está en pausa temporal? (el comercio pidió no recibir pedidos por un rato) */
/** Si la persona venía mirando comercios para retirar, el carrito arranca en "Retiro en el local". */
export const readPickupPreference = () => { try { return window.sessionStorage.getItem("woref-modo-entrega") === "retiro"; } catch { return false; } };
export const writePickupPreference = (pickup: boolean) => { try { window.sessionStorage.setItem("woref-modo-entrega", pickup ? "retiro" : "delivery"); } catch { /* sin almacenamiento */ } };

export const isPaused = (store: Pick<DeliveryStore, "pausado_hasta">) => Boolean(store.pausado_hasta && new Date(store.pausado_hasta).getTime() > Date.now());
export const isOpenNow = (store: Pick<DeliveryStore, "esta_abierto" | "horarios"> & Partial<Pick<DeliveryStore, "pausado_hasta">>) => store.esta_abierto && !isPaused(store) && withinSchedule(store.horarios);

/** Próxima apertura para mostrar "Abre hoy a las 10:00" / "Abre el lunes a las 12:00". */
export function nextOpening(horarios: Horarios | null | undefined) {
  if (!horarios) return null;
  const { day, minutes } = argentinaNow();
  for (let offset = 0; offset < 7; offset += 1) {
    const current = (day + offset) % 7;
    if (activeClosure(horarios, new Date(Date.now() + offset * 86_400_000))) continue;
    const turnos = [...(horarios[String(current)] || [])].sort((a, b) => toMinutes(a.abre) - toMinutes(b.abre));
    const next = turnos.find((turno) => offset > 0 || toMinutes(turno.abre) > minutes);
    if (next) return offset === 0 ? `Abre hoy a las ${next.abre}` : offset === 1 ? `Abre mañana a las ${next.abre}` : `Abre el ${diasSemana[current].toLowerCase()} a las ${next.abre}`;
  }
  return null;
}

/** Resumen legible: "Lun a vie 10:00–23:00 · Sáb y dom 12:00–00:00". */
export function scheduleSummary(horarios: Horarios | null | undefined) {
  if (!horarios) return "";
  const short = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const label = (day: number) => (horarios[String(day)] || []).map((turno) => `${turno.abre}–${turno.cierra}`).join(", ") || "Cerrado";
  const order = [1, 2, 3, 4, 5, 6, 0];
  const groups: { days: number[]; text: string }[] = [];
  for (const day of order) {
    const text = label(day);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.days.push(day); else groups.push({ days: [day], text });
  }
  if (groups.length === 1) return groups[0].text === "Cerrado" ? "Cerrado" : `Todos los días ${groups[0].text}`;
  return groups.map(({ days, text }) => `${days.length > 2 ? `${short[days[0]]} a ${short[days[days.length - 1]].toLowerCase()}` : days.map((day) => short[day]).join(" y ")} ${text}`).join(" · ");
}

export type DeliveryProduct = {
  id: string;
  comercio_id: string;
  nombre: string;
  descripcion?: string | null;
  categoria: string;
  imagen_url?: string | null;
  precio: number;
  precio_anterior?: number | null;
  stock?: number | null;
  disponible: boolean;
  destacado?: boolean;
  orden?: number;
  etiquetas?: string[];
  grupos?: ProductGroup[];
};

export type DeliverySection = { id: string; comercio_id: string; nombre: string; orden: number; visible: boolean };
export const tagLabels: Record<string, string> = {
  vegano: "Vegano", vegetariano: "Vegetariano", sin_tacc: "Sin TACC", apto_celiacos: "Apto celíacos", picante: "Picante", sin_azucar: "Sin azúcar", nuevo: "Nuevo", mas_vendido: "Más vendido",
};

/** Secciones del menú en el orden elegido por el comercio (las que no tienen configuración van al final, por nombre). Las ocultas se descartan si `onlyVisible`. */
export function orderSections(products: Pick<DeliveryProduct, "categoria">[], configured: DeliverySection[], onlyVisible: boolean): { name: string; visible: boolean }[] {
  const byName = new Map(configured.map((section) => [section.nombre, section]));
  const names = [...new Set([...configured.map((section) => section.nombre), ...products.map((product) => product.categoria)])];
  return names
    .map((name) => ({ name, visible: byName.get(name)?.visible ?? true, orden: byName.get(name)?.orden ?? 1000 }))
    .filter((section) => !onlyVisible || section.visible)
    .sort((a, b) => a.orden - b.orden || a.name.localeCompare(b.name, "es"))
    .map(({ name, visible }) => ({ name, visible }));
}

export type ProductOption = { id: string; grupo_id: string; nombre: string; precio_extra: number; disponible: boolean; orden: number };
export type ProductGroup = { id: string; producto_id: string; nombre: string; minimo: number; maximo: number; orden: number; opciones: ProductOption[] };
/** Opción elegida, tal como se guarda en el carrito y en el pedido. */
export type ChosenOption = { id: string; grupo: string; nombre: string; precio: number };

export const productSelect = "*, grupos:delivery_producto_grupos(*, opciones:delivery_producto_opciones(*))";

/** Ordena grupos y opciones (Supabase no ordena las relaciones anidadas). */
export function sortGroups(groups: ProductGroup[] | null | undefined): ProductGroup[] {
  return [...(groups || [])]
    .sort((a, b) => a.orden - b.orden)
    .map((group) => ({ ...group, opciones: [...(group.opciones || [])].sort((a, b) => a.orden - b.orden) }));
}

export const optionsLabel = (opciones: ChosenOption[] | null | undefined) =>
  (opciones || []).map((option) => (Number(option.precio) > 0 ? `${option.nombre} (+${money(option.precio)})` : option.nombre)).join(" · ");

export type OrderItem = { id?: string; producto_id?: string | null; nombre: string; cantidad: number; precio_unitario: number; notas?: string | null; opciones?: ChosenOption[] };

export type DeliveryOrder = {
  id: string;
  cliente_id: string;
  comercio_id: string;
  repartidor_id?: string | null;
  direccion_entrega: string;
  estado: EstadoPedido;
  subtotal: number;
  costo_envio: number;
  tarifa_servicio: number;
  descuento: number;
  propina: number;
  total: number;
  metodo_pago: MetodoPago;
  notas?: string | null;
  telefono_contacto?: string | null;
  pago_estado?: PagoEstado;
  cupon_codigo?: string | null;
  motivo_cancelacion?: string | null;
  calificado: boolean;
  entrega_estimada?: string | null;
  created_at: string;
  confirmado_at?: string | null;
  preparando_at?: string | null;
  en_camino_at?: string | null;
  entregado_at?: string | null;
  cancelado_at?: string | null;
  items?: OrderItem[];
  latitud?: number | null;
  longitud?: number | null;
  distancia_km?: number | null;
  tipo_entrega: TipoEntrega;
  programado_para?: string | null;
  efectivo_paga_con?: number | null;
  listo_at?: string | null;
  preparacion_min?: number | null;
  visible_at?: string | null;
  responder_antes_de?: string | null;
  aceptado_en_seg?: number | null;
  demora_extra_min?: number;
  asignado_at?: string | null;
  ganancia_repartidor?: number | null;
  llegada_comercio_at?: string | null;
  llegada_cliente_at?: string | null;
  foto_entrega_path?: string | null;
  comercio?: Pick<DeliveryStore, "nombre" | "slug" | "imagen_url" | "logo_url" | "direccion" | "telefono" | "latitud" | "longitud"> | null;
  cliente?: { nombre: string } | null;
};

export type Coupon = {
  id: string;
  codigo: string;
  descripcion: string;
  tipo: "porcentaje" | "monto" | "envio_gratis";
  valor: number;
  tope?: number | null;
  minimo: number;
  comercio_id?: string | null;
  usos: number;
  usos_max?: number | null;
  activo: boolean;
  vence_at?: string | null;
};

const currency = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
export const money = (value: number | string | null | undefined) => currency.format(Number(value || 0));

export const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" }) : "";
export const formatTime = (value?: string | null) =>
  value ? new Date(value).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "";

export const shortId = (id: string) => `#${id.slice(0, 6).toUpperCase()}`;

/** Resuelve imágenes de Unsplash con el tamaño pedido; deja intactas las rutas locales. */
export function img(url: string | null | undefined, width = 800) {
  if (!url) return "/placeholder.svg";
  if (url.includes("images.unsplash.com")) return url.replace(/([?&])w=\d+/, `$1w=${width}`);
  return url;
}

export function slugify(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

export const categoriaLabel: Record<Categoria, string> = {
  comida: "Restaurantes",
  supermercado: "Supermercados",
  farmacia: "Farmacias",
  tiendas: "Tiendas",
};

export type Vertical = { id: string; label: string; icon: LucideIcon; categoria?: Categoria; rubro?: string; color: string; image: string };

const verticalPhoto = (id: string) => `https://images.unsplash.com/photo-${id}?w=400&q=80&auto=format&fit=crop`;

/** Accesos rápidos de la portada: cada uno filtra por categoría o por rubro. */
export const verticals: Vertical[] = [
  { id: "restaurantes", label: "Restaurantes", icon: Utensils, categoria: "comida", color: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300", image: verticalPhoto("1568901346375-23c9450c58cd") },
  { id: "super", label: "Súper", icon: ShoppingBasket, categoria: "supermercado", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", image: verticalPhoto("1542838132-92c53300491e") },
  { id: "farmacia", label: "Farmacia", icon: Cross, categoria: "farmacia", color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300", image: verticalPhoto("1587854692152-cbe660dbde88") },
  { id: "tiendas", label: "Tiendas", icon: Store, categoria: "tiendas", color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", image: verticalPhoto("1513885535751-8b9238bd345a") },
  { id: "cafe", label: "Café", icon: Coffee, rubro: "Café", color: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", image: verticalPhoto("1509042239860-f550ce710b93") },
  { id: "helados", label: "Helados", icon: IceCream, rubro: "Helados", color: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300", image: verticalPhoto("1563805042-7684c019e1cb") },
  { id: "pizza", label: "Pizza", icon: Pizza, rubro: "Pizza", color: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", image: verticalPhoto("1513104890138-7c749659a591") },
  { id: "saludable", label: "Saludable", icon: Salad, rubro: "Saludable", color: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300", image: verticalPhoto("1512621776951-a57141f2eefd") },
  { id: "parrilla", label: "Parrilla", icon: Flame, rubro: "Parrilla", color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", image: verticalPhoto("1600891964092-4316c288032e") },
  { id: "sandwiches", label: "Sándwiches", icon: Sandwich, rubro: "Sándwiches", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300", image: verticalPhoto("1592415486689-125cbbfcbee2") },
  { id: "desayunos", label: "Desayunos", icon: Cake, rubro: "Desayunos", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", image: verticalPhoto("1484723091739-30a097e8f929") },
  { id: "bebidas", label: "Bebidas", icon: Beer, rubro: "Bebidas", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300", image: verticalPhoto("1608270586620-248524c67de9") },
  { id: "moda", label: "Moda", icon: Shirt, rubro: "Indumentaria", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300", image: verticalPhoto("1441986300917-64674bd600d8") },
];

export const matchesVertical = (store: DeliveryStore, vertical: Vertical) =>
  (vertical.categoria ? store.categoria === vertical.categoria : true) && (vertical.rubro ? store.rubro === vertical.rubro : true);

export const estadoLabel: Record<EstadoPedido, string> = {
  pendiente: "Esperando al comercio",
  confirmado: "Pedido confirmado",
  preparando: "Preparando tu pedido",
  listo: "Listo para retirar",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const estadoCorto: Record<EstadoPedido, string> = {
  pendiente: "Nuevo",
  confirmado: "Confirmado",
  preparando: "En preparación",
  listo: "Listo para retirar",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const estadoTone: Record<EstadoPedido, string> = {
  pendiente: "bg-warning/15 text-warning-foreground dark:text-warning",
  confirmado: "bg-info/10 text-info",
  preparando: "bg-info/10 text-info",
  listo: "bg-success/10 text-success",
  en_camino: "bg-primary/10 text-primary",
  entregado: "bg-success/10 text-success",
  cancelado: "bg-muted text-muted-foreground",
};

export const pasosPedido: EstadoPedido[] = ["pendiente", "confirmado", "preparando", "en_camino", "entregado"];
export const pasosRetiro: EstadoPedido[] = ["pendiente", "confirmado", "preparando", "listo", "entregado"];
/** Pasos del seguimiento según cómo se entrega el pedido. */
export const pasosDe = (order: Pick<DeliveryOrder, "tipo_entrega">) => (order.tipo_entrega === "retiro" ? pasosRetiro : pasosPedido);

/** Título del estado, ajustado al tipo de entrega ("Retirado" en vez de "Entregado"). */
export function estadoTitulo(order: Pick<DeliveryOrder, "estado" | "tipo_entrega">) {
  if (order.tipo_entrega === "retiro" && order.estado === "entregado") return "Retirado";
  return estadoLabel[order.estado];
}

const argentinaDay = (date: Date) => date.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" });
/** Día de una franja programada: "Hoy", "Mañana" o "vie 3 oct". */
export function slotDay(value: string | Date) {
  const date = new Date(value);
  if (argentinaDay(date) === argentinaDay(new Date())) return "Hoy";
  if (argentinaDay(date) === argentinaDay(new Date(Date.now() + 86400000))) return "Mañana";
  return date.toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "short", day: "numeric", month: "short" });
}
export const slotTime = (value: string | Date) =>
  new Date(value).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false });
export const formatSlot = (value: string | Date) => `${slotDay(value)} ${slotTime(value)}`;
export const pedidoActivo = (estado: EstadoPedido) => estado !== "entregado" && estado !== "cancelado";

export const metodoPagoLabel: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta al recibir",
  transferencia: "Transferencia",
  mercadopago: "Mercado Pago (online)",
};

export const pagoEstadoLabel: Record<PagoEstado, string> = {
  no_requiere: "Se paga al recibir",
  pendiente: "Esperando el pago",
  aprobado: "Pagado",
  rechazado: "Pago rechazado",
  a_reintegrar: "Reintegro pendiente",
  reintegrado: "Reintegrado",
};

export function couponValue(coupon: Pick<Coupon, "tipo" | "valor">) {
  if (coupon.tipo === "porcentaje") return `${Number(coupon.valor)}% OFF`;
  if (coupon.tipo === "monto") return `${money(coupon.valor)} OFF`;
  return "Envío gratis";
}

/** Mensaje legible de un error de Supabase/Postgres (las funciones del servidor ya devuelven texto en español). */
export function errorMessage(error: unknown, fallback = "Algo salió mal. Probá de nuevo.") {
  const message = (error as { message?: string } | null)?.message;
  if (!message) return fallback;
  if (/permission denied|violates row-level security/i.test(message)) return "No tenés permiso para hacer esto.";
  if (/duplicate key/i.test(message)) return "Ya existe un registro con esos datos.";
  if (/function .* does not exist|Could not find the function/i.test(message)) return "Falta aplicar la migración de base de datos de delivery.";
  return message;
}

export const storeSelect = "*";
export const orderSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario,notas,opciones), comercio:delivery_comercios(nombre,slug,imagen_url,logo_url,direccion,telefono,latitud,longitud)";

export type ChatCanal = "comercio" | "repartidor";
export type ChatMessage = { id: string; pedido_id: string; canal: ChatCanal; autor_id: string; texto: string; leido_at: string | null; created_at: string };

export type ReclamoTipo = "demora" | "faltante" | "mal_estado" | "equivocado" | "cobro" | "repartidor" | "otro" | "cuenta" | "pago" | "app" | "consulta" | "sugerencia";
export type ReclamoEstado = "abierto" | "en_curso" | "esperando_cliente" | "resuelto" | "rechazado";
export type Reclamo = {
  id: string;
  pedido_id: string | null;
  cliente_id: string;
  comercio_id: string | null;
  tipo: ReclamoTipo;
  detalle: string;
  estado: ReclamoEstado;
  prioridad?: "normal" | "alta" | "urgente";
  csat?: number | null;
  credito_codigo?: string | null;
  ultimo_mensaje_at?: string;
  ultimo_autor?: string | null;
  resolucion?: string | null;
  reembolso_monto: number;
  resuelto_at?: string | null;
  created_at: string;
};

export const reclamoTipoLabel: Record<ReclamoTipo, string> = {
  demora: "Mi pedido se está demorando",
  faltante: "Faltó un producto",
  mal_estado: "Un producto llegó en mal estado",
  equivocado: "Me trajeron otra cosa",
  cobro: "Problema con el cobro",
  repartidor: "Problema con el repartidor",
  otro: "Otro problema",
  cuenta: "Mi cuenta",
  pago: "Pagos y reintegros",
  app: "Falla en la app",
  consulta: "Consulta general",
  sugerencia: "Sugerencia",
};

/** Qué reclamos se pueden hacer según el momento del pedido (el servidor valida lo mismo). */
export function reclamosDisponibles(order: Pick<DeliveryOrder, "estado" | "entrega_estimada" | "programado_para" | "entregado_at" | "tipo_entrega">): ReclamoTipo[] {
  if (order.estado === "cancelado" || order.estado === "pendiente") return [];
  if (order.estado === "entregado") {
    const recent = order.entregado_at ? Date.now() - new Date(order.entregado_at).getTime() < 48 * 3600000 : false;
    return recent ? ["faltante", "mal_estado", "equivocado", "cobro", ...(order.tipo_entrega === "delivery" ? (["repartidor"] as ReclamoTipo[]) : []), "otro"] : ["otro"];
  }
  const limit = order.programado_para || order.entrega_estimada;
  const late = limit ? Date.now() > new Date(limit).getTime() + 10 * 60000 : false;
  return late ? ["demora", "otro"] : ["otro"];
}

import { supabase } from "@/integrations/supabase/client";
import { Beer, Cake, Coffee, Cross, Flame, IceCream, Pizza, Salad, ShoppingBasket, Shirt, Sandwich, Store, Utensils, type LucideIcon } from "lucide-react";

// Las tablas de delivery todavía no están en los tipos generados de Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const db = supabase as any;

export type Categoria = "comida" | "supermercado" | "farmacia" | "tiendas";
export type EstadoPedido = "pendiente" | "confirmado" | "preparando" | "en_camino" | "entregado" | "cancelado";
export type MetodoPago = "efectivo" | "tarjeta" | "transferencia";

export type DeliveryStore = {
  id: string;
  propietario_id?: string | null;
  nombre: string;
  slug: string;
  categoria: Categoria;
  rubro?: string | null;
  descripcion?: string | null;
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
  destacado?: boolean;
  activo?: boolean;
  created_at?: string;
};

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
};

export type OrderItem = { id?: string; nombre: string; cantidad: number; precio_unitario: number; notas?: string | null };

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
  comercio?: Pick<DeliveryStore, "nombre" | "slug" | "imagen_url" | "logo_url" | "direccion" | "telefono"> | null;
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

export type Vertical = { id: string; label: string; icon: LucideIcon; categoria?: Categoria; rubro?: string; color: string };

/** Accesos rápidos de la portada: cada uno filtra por categoría o por rubro. */
export const verticals: Vertical[] = [
  { id: "restaurantes", label: "Restaurantes", icon: Utensils, categoria: "comida", color: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300" },
  { id: "super", label: "Súper", icon: ShoppingBasket, categoria: "supermercado", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  { id: "farmacia", label: "Farmacia", icon: Cross, categoria: "farmacia", color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  { id: "tiendas", label: "Tiendas", icon: Store, categoria: "tiendas", color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  { id: "cafe", label: "Café", icon: Coffee, rubro: "Café", color: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  { id: "helados", label: "Helados", icon: IceCream, rubro: "Helados", color: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300" },
  { id: "pizza", label: "Pizza", icon: Pizza, rubro: "Pizza", color: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  { id: "saludable", label: "Saludable", icon: Salad, rubro: "Saludable", color: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300" },
  { id: "parrilla", label: "Parrilla", icon: Flame, rubro: "Parrilla", color: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300" },
  { id: "sandwiches", label: "Sándwiches", icon: Sandwich, rubro: "Sándwiches", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300" },
  { id: "desayunos", label: "Desayunos", icon: Cake, rubro: "Desayunos", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  { id: "bebidas", label: "Bebidas", icon: Beer, rubro: "Bebidas", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-500/15 dark:text-yellow-300" },
  { id: "moda", label: "Moda", icon: Shirt, rubro: "Indumentaria", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
];

export const matchesVertical = (store: DeliveryStore, vertical: Vertical) =>
  (vertical.categoria ? store.categoria === vertical.categoria : true) && (vertical.rubro ? store.rubro === vertical.rubro : true);

export const estadoLabel: Record<EstadoPedido, string> = {
  pendiente: "Esperando al comercio",
  confirmado: "Pedido confirmado",
  preparando: "Preparando tu pedido",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const estadoCorto: Record<EstadoPedido, string> = {
  pendiente: "Nuevo",
  confirmado: "Confirmado",
  preparando: "En preparación",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export const estadoTone: Record<EstadoPedido, string> = {
  pendiente: "bg-warning/15 text-warning-foreground dark:text-warning",
  confirmado: "bg-info/10 text-info",
  preparando: "bg-info/10 text-info",
  en_camino: "bg-primary/10 text-primary",
  entregado: "bg-success/10 text-success",
  cancelado: "bg-muted text-muted-foreground",
};

export const pasosPedido: EstadoPedido[] = ["pendiente", "confirmado", "preparando", "en_camino", "entregado"];
export const pedidoActivo = (estado: EstadoPedido) => estado !== "entregado" && estado !== "cancelado";

export const metodoPagoLabel: Record<MetodoPago, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta al recibir",
  transferencia: "Transferencia",
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
export const orderSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario,notas), comercio:delivery_comercios(nombre,slug,imagen_url,logo_url,direccion,telefono)";

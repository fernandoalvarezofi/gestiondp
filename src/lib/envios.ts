/** Mensajería: envío de paquetes entre dos direcciones, llevado por un repartidor de Woref. */
export type EnvioEstado = "buscando" | "asignado" | "retirado" | "entregado" | "cancelado";
export type EnvioTamano = "sobre" | "chico" | "mediano" | "grande";

export type Envio = {
  id: string; cliente_id: string; estado: EnvioEstado;
  origen_direccion: string; origen_lat: number; origen_lng: number; origen_contacto: string; origen_telefono: string; origen_notas?: string | null;
  destino_direccion: string; destino_lat: number; destino_lng: number; destino_contacto: string; destino_telefono: string; destino_notas?: string | null;
  descripcion: string; tamano: EnvioTamano; quien_paga: "origen" | "destino"; metodo_pago: "efectivo";
  distancia_km: number; costo: number; propina: number; total: number; ganancia_repartidor: number;
  repartidor_id?: string | null; asignado_at?: string | null; retirado_at?: string | null; entregado_at?: string | null; cancelado_at?: string | null; motivo_cancelacion?: string | null;
  created_at: string;
};

export type EnvioOferta = {
  id: string; origen_zona: string; destino_zona: string; tamano: EnvioTamano; descripcion: string;
  distancia_km: number; dist_retiro_km: number | null; ganancia: number; cobrar: number; quien_paga: "origen" | "destino"; created_at: string;
};

export type EnvioQuote = { ok: true; km: number; costo: number; costo_base?: number; tarifa?: { motivos: string[]; multiplicador: number }; ganancia: number } | { ok: false; km?: number; motivo: string };

export const tamanos: { id: EnvioTamano; label: string; hint: string }[] = [
  { id: "sobre", label: "Sobre", hint: "Documentos, llaves" },
  { id: "chico", label: "Chico", hint: "Entra en una mochila" },
  { id: "mediano", label: "Mediano", hint: "Caja de zapatos (+$300)" },
  { id: "grande", label: "Grande", hint: "Hasta 10 kg (+$800)" },
];
export const tamanoLabel = Object.fromEntries(tamanos.map((item) => [item.id, item.label])) as Record<EnvioTamano, string>;

export const envioActivo = (estado: EnvioEstado) => estado === "buscando" || estado === "asignado" || estado === "retirado";

export const envioEstadoLabel: Record<EnvioEstado, string> = {
  buscando: "Buscando repartidor", asignado: "Repartidor en camino al retiro", retirado: "Paquete en camino", entregado: "Entregado", cancelado: "Cancelado",
};
export const envioPasos: { id: EnvioEstado; label: string }[] = [
  { id: "buscando", label: "Buscando repartidor" },
  { id: "asignado", label: "Va a retirar" },
  { id: "retirado", label: "En camino" },
  { id: "entregado", label: "Entregado" },
];

export const envioSelect = "*";

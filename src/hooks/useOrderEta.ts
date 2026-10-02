import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/delivery";

export type OrderEta = {
  minutos: number;
  hora?: string;
  programado?: boolean;
  terminal?: boolean;
  fases?: { aceptacion: number; preparacion: number; retiro?: number; transito?: number };
  fuente?: "gps" | "historial" | "estimado";
  velocidad_kmh?: number;
  trafico?: number;
};

/** Tiempo de llegada calculado por el servidor (preparación + retiro + tránsito). Se actualiza cada 30 segundos mientras el pedido está activo. */
export function useOrderEta(orderId: string | undefined, active: boolean) {
  const { data } = useQuery({
    queryKey: ["eta-pedido", orderId],
    enabled: Boolean(orderId) && active,
    refetchInterval: 30_000,
    staleTime: 15_000,
    queryFn: async () => {
      const { data: result, error } = await db.rpc("delivery_eta_pedido", { p_pedido: orderId });
      if (error) throw error;
      return result as unknown as OrderEta;
    },
  });
  return data ?? null;
}

export type OrderEvent = {
  evento: "creado" | "estado" | "asignado" | "liberado" | "llegada_comercio" | "llegada_cliente" | "listo" | "demora" | "pago";
  estado_anterior: string | null;
  estado_nuevo: string | null;
  actor_rol: "cliente" | "comercio" | "repartidor" | "admin" | "sistema";
  detalle: Record<string, unknown> | null;
  created_at: string;
};

/** Historial de eventos del pedido, en orden cronológico. */
export function useOrderHistory(orderId: string | undefined, refreshKey?: string | null) {
  const { data } = useQuery({
    queryKey: ["historial-pedido", orderId, refreshKey ?? null],
    enabled: Boolean(orderId),
    staleTime: 10_000,
    queryFn: async () => {
      const { data: result, error } = await db.rpc("delivery_pedido_historial", { p_pedido: orderId });
      if (error) throw error;
      return result as unknown as OrderEvent[];
    },
  });
  return data ?? null;
}

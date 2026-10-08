import { ContextChatButton } from "@/components/messages/ContextChat";
import type { MsgCanal } from "@/services/messaging";

/** Canales del chat de un pedido: con el comercio, con el repartidor, o entre comercio y repartidor. */
export type PedidoCanal = "comercio" | "repartidor" | "comercio_repartidor";
const CANAL: Record<PedidoCanal, MsgCanal> = { comercio: "cliente_comercio", repartidor: "cliente_repartidor", comercio_repartidor: "comercio_repartidor" };

/**
 * Botón de chat de un pedido. Usa el motor de mensajería común (src/services/messaging):
 * el servidor decide quién participa según el pedido (cliente, equipo del local o repartidor asignado).
 */
export function ChatButton({ pedidoId, canal, ...props }: {
  pedidoId: string; canal: PedidoCanal; label: string; title: string; subtitle?: string; className?: string; variant?: "outline" | "default" | "ghost"; autoOpen?: boolean; readOnly?: boolean;
}) {
  return <ContextChatButton contexto="pedido" id={pedidoId} canal={CANAL[canal]} {...props} />;
}

import { Compass, Home, MessageCircle, Receipt, UserCircle, type LucideIcon } from "lucide-react";

// Menú del contexto Cliente. Va en un archivo aparte para que la carga inicial de la app
// no incluya los menús e íconos de los paneles (comercio, repartidor, administración).

export type ClientTab = { to: string; label: string; icon: LucideIcon; end?: boolean };

/** Barra de abajo del cliente en el celular. El carrito vive arriba y en la barra flotante "Ver mi pedido". */
export const CLIENT_TABS: ClientTab[] = [
  { to: "/app", label: "Inicio", icon: Home, end: true },
  { to: "/app/explorar", label: "Explorar", icon: Compass },
  { to: "/app/pedidos", label: "Pedidos", icon: Receipt },
  { to: "/app/mensajes", label: "Mensajes", icon: MessageCircle },
  { to: "/app/perfil", label: "Cuenta", icon: UserCircle },
];
/** Sin cuenta solo se ve lo público (el resto pide ingresar). */
export const GUEST_TABS: ClientTab[] = [CLIENT_TABS[0], CLIENT_TABS[1]];

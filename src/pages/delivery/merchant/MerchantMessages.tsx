import { Inbox } from "@/components/messages/Inbox";
import { useMerchant } from "./context";

/** Mensajes del local: consultas de clientes y chats de pedidos (con clientes y repartidores). Responde cualquiera del equipo con permiso de pedidos. */
export default function MerchantMessages() {
  const { store } = useMerchant();
  return <Inbox comercio={store.id} vacio={{ titulo: "Todavía no tenés mensajes", texto: "Acá llegan las consultas de clientes y los chats de tus pedidos con clientes y repartidores." }} />;
}

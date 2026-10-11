import { Inbox } from "@/components/messages/Inbox";
import { PageIntro } from "@/components/panel/kit";
import { useMerchant } from "./context";

/** Mensajes del local: consultas de clientes y chats de pedidos (con clientes y repartidores). Responde cualquiera del equipo con permiso de pedidos. */
export default function MerchantMessages() {
  const { store } = useMerchant();
  return <div className="space-y-5"><PageIntro title="Mensajes" description="Consultas de clientes y chats de tus pedidos con clientes y repartidores." /><Inbox comercio={store.id} vacio={{ titulo: "Todavía no tenés mensajes", texto: "Acá llegan las consultas de clientes y los chats de tus pedidos con clientes y repartidores." }} /></div>;
}

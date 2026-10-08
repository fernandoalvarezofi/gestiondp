import { Link } from "react-router-dom";
import { PageHeader } from "@/components/delivery/Common";
import { Inbox, SupportEntry } from "@/components/messages/Inbox";
import { Button } from "@/components/ui/button";

/** Mensajes del cliente: pedidos, envíos, viajes y consultas a locales, en un solo lugar. Soporte va aparte (tickets). */
export default function Messages() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-14 pt-5 sm:px-6">
      <PageHeader eyebrow="Tu cuenta" title="Mensajes" subtitle="Tus conversaciones con locales, repartidores y conductores." />
      <div className="mt-5">
        <Inbox rol="cliente" extra={<SupportEntry />}
          vacio={{ titulo: "Todavía no tenés mensajes", texto: "Cuando hagas un pedido, un envío o un viaje, o le escribas a un local, la conversación aparece acá.", accion: <Button asChild className="rounded-full"><Link to="/app/explorar">Explorar</Link></Button> }} />
      </div>
    </div>
  );
}

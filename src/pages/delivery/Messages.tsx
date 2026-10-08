import { PageHeader } from "@/components/delivery/Common";
import { Inbox, SupportEntry } from "@/components/messages/Inbox";
import { NewInquiry } from "@/components/messages/NewInquiry";

/** Mensajes del cliente: pedidos, envíos, viajes y consultas a locales, en un solo lugar. Soporte va aparte (tickets). */
export default function Messages() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-14 pt-5 sm:px-6">
      <PageHeader eyebrow="Tu cuenta" title="Mensajes" subtitle="Tus conversaciones con locales, repartidores y conductores." />
      <div className="mt-5">
        <Inbox rol="cliente" extra={<SupportEntry />} accion={<NewInquiry className="w-full rounded-full font-bold" />}
          vacio={{ titulo: "Todavía no tenés mensajes", texto: "Escribile a un local para hacerle una consulta. Cuando hagas un pedido, un envío o un viaje, esas conversaciones también aparecen acá." }} />
      </div>
    </div>
  );
}

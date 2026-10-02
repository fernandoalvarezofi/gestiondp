import { FormEvent, useState } from "react";
import { Bike, Loader2, PowerOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ActiveDelivery } from "@/components/courier/ActiveDelivery";
import { CourierWallet } from "@/components/courier/CourierWallet";
import { OfferCard } from "@/components/courier/OfferCard";
import { EmptyState } from "@/components/delivery/Common";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { useCourier } from "./CourierLayout";

export function CourierOrdersPage() {
  const { current, connected, offers, position, sharingStatus, refreshAll } = useCourier();
  if (current) return <ActiveDelivery order={current} position={position} sharing={sharingStatus} onChange={refreshAll} />;
  if (!connected) return <EmptyState icon={<PowerOff className="h-7 w-7" />} title="Estás desconectado" text="Tocá “Conectarme” arriba para recibir ofertas de pedidos." />;
  if (!offers.length) return <EmptyState icon={<Bike className="h-7 w-7" />} title="Buscando pedidos para vos" text="Quedate conectado: apenas haya uno cerca, te suena el aviso y tenés 45 segundos para aceptarlo." />;
  return <div className="mx-auto max-w-2xl space-y-4">{offers.map((offer) => <OfferCard key={offer.pedido_id} offer={offer} onChange={refreshAll} />)}</div>;
}

export function CourierEarningsPage() {
  const { delivered } = useCourier();
  return <CourierWallet refreshKey={delivered.length} />;
}

export function CourierHistoryPage() {
  const { delivered } = useCourier();
  if (!delivered.length) return <EmptyState title="Todavía no hiciste entregas" text="Tus viajes y ganancias aparecen acá." />;
  return (
    <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
      {delivered.slice(0, 50).map((order) => (
        <li key={order.id} className="flex items-center justify-between gap-3 p-3 text-sm">
          <span className="min-w-0"><span className="block truncate font-bold">{order.comercio?.nombre}</span><span className="block truncate text-muted-foreground">{formatDateTime(order.entregado_at || order.created_at)} · {order.direccion_entrega}</span></span>
          <span className="shrink-0 font-bold text-success">+{money(order.ganancia_repartidor ?? Number(order.costo_envio) + Number(order.propina))}</span>
        </li>
      ))}
    </ul>
  );
}

const faqs = [
  { q: "¿Cómo se calcula mi ganancia por viaje?", a: "Es el costo de envío por distancia del comercio más la propina del cliente (el 100% es tuyo). Lo ves en cada oferta antes de aceptar." },
  { q: "¿Cuánto tiempo tengo para aceptar una oferta?", a: "45 segundos. Si no la aceptás o la rechazás, pasa al siguiente repartidor cercano." },
  { q: "¿Qué pasa si no puedo hacer un pedido que ya tomé?", a: "Podés soltarlo antes de retirarlo, indicando el motivo. Se le ofrece a otro repartidor. Soltar seguido afecta tu cuenta." },
  { q: "¿Cómo cobro mis ganancias?", a: "Administración registra los pagos. En Ganancias ves cuánto te deben y cuánto efectivo tenés que rendir." },
  { q: "¿Por qué tengo que estar cerca para marcar mi llegada?", a: "Para que comercios y clientes confíen en los avisos. Si el GPS falla, avisá por el chat del pedido." },
];

export function CourierProfilePage() {
  const { courier, reloadCourier } = useCourier();
  const [phone, setPhone] = useState(courier.telefono ?? "");
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (phone.replace(/\D/g, "").length < 8) { toast.error("Ingresá un teléfono válido"); return; }
    setSaving(true);
    const { error } = await db.from("delivery_repartidores").update({ telefono: phone.trim() }).eq("perfil_id", courier.perfil_id);
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Teléfono actualizado");
    reloadCourier();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-extrabold"><ShieldCheck className="h-5 w-5 text-success" />Cuenta verificada</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Vehículo</dt><dd className="font-bold capitalize">{courier.vehiculo.replace("_", " ")}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">DNI</dt><dd className="font-bold">{courier.dni ? `••••${courier.dni.slice(-3)}` : "—"}</dd></div>
          {courier.patente && <div className="flex justify-between"><dt className="text-muted-foreground">Patente</dt><dd className="font-bold">{courier.patente}</dd></div>}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Para cambiar vehículo, DNI o patente, escribile a soporte: se vuelve a verificar tu identidad.</p>
      </section>

      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="font-extrabold">Teléfono de contacto</h2>
        <form onSubmit={save} className="mt-3 flex gap-2">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} inputMode="tel" aria-label="Teléfono" />
          <Button type="submit" variant="outline" className="rounded-full" disabled={saving || phone.trim() === (courier.telefono ?? "")}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar</Button>
        </form>
      </section>

      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="font-extrabold">Ayuda para repartidores</h2>
        <Accordion type="single" collapsible className="mt-1">
          {faqs.map((item) => (
            <AccordionItem key={item.q} value={item.q}>
              <AccordionTrigger className="text-left font-bold">{item.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </div>
  );
}

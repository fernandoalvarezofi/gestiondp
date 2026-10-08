import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Bike, CarTaxiFront, ChevronRight, Loader2, Package, PowerOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ActiveBatch } from "@/components/courier/ActiveBatch";
import { ActiveEnvio, EnvioOfferCard } from "@/components/courier/EnvioCards";
import type { Courier } from "@/components/courier/CourierApplication";
import { DemandStrip, WorkMap, type WorkMarker } from "@/components/courier/WorkMap";
import { CourierIncentives } from "@/components/courier/Incentives";
import { PayoutForm } from "@/components/account/PayoutForm";
import { CourierWallet } from "@/components/courier/CourierWallet";
import { OfferCard } from "@/components/courier/OfferCard";
import { EmptyState } from "@/components/delivery/Common";
import { IdentityVerification } from "@/components/verification/IdentityVerification";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { useCourier } from "./CourierLayout";

/** Trabajos del repartidor: el pedido o envío en curso, o las ofertas disponibles. */
export function CourierOrdersPage() {
  const { current, currents, currentEnvio, currentViaje, connected, offers, envioOffers, position, sharingStatus, refreshAll } = useCourier();
  if (current) return <ActiveBatch orders={currents} offers={offers} position={position} sharing={sharingStatus} onChange={refreshAll} />;
  if (currentEnvio) return <ActiveEnvio envio={currentEnvio} position={position} sharing={sharingStatus} onChange={refreshAll} />;
  // Un viaje de remís en curso se maneja desde el contexto Conductor; mientras tanto no se toman entregas.
  if (currentViaje) return <EmptyState icon={<CarTaxiFront className="h-7 w-7" />} title="Tenés un viaje de remís en curso" text="Terminalo desde el panel de conductor. Mientras tanto no te llegan entregas." action={<Button asChild className="rounded-full"><Link to="/app/conductor">Ir al viaje</Link></Button>} />;
  if (!connected) return <EmptyState icon={<PowerOff className="h-7 w-7" />} title="Estás desconectado" text="Tocá “Conectarme” arriba para recibir ofertas de pedidos y envíos." />;
  if (!offers.length && !envioOffers.length) return <EmptyState icon={<Bike className="h-7 w-7" />} title="Buscando pedidos para vos" text="Quedate conectado: apenas haya un pedido o un envío de paquete cerca, te suena el aviso." />;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {offers.map((offer) => <OfferCard key={offer.pedido_id} offer={offer} onChange={refreshAll} />)}
      {envioOffers.map((offer) => <EnvioOfferCard key={offer.id} offer={offer} onChange={refreshAll} />)}
    </div>
  );
}

/** Mapa del repartidor: dónde está, el pedido o envío en curso, las ofertas con su punto de retiro y la demanda. */
export function CourierMapPage() {
  const { position, connected, currents, currentEnvio, offers } = useCourier();
  const markers: WorkMarker[] = [
    ...currents.flatMap((order) => [
      ...(order.comercio?.latitud != null && order.comercio?.longitud != null ? [{ lat: Number(order.comercio.latitud), lng: Number(order.comercio.longitud), kind: "store" as const, label: `Retiro: ${order.comercio.nombre}` }] : []),
      ...(order.latitud != null && order.longitud != null ? [{ lat: Number(order.latitud), lng: Number(order.longitud), kind: "home" as const, label: "Entrega" }] : []),
    ]),
    ...(currentEnvio ? [
      { lat: Number(currentEnvio.origen_lat), lng: Number(currentEnvio.origen_lng), kind: "store" as const, label: "Retiro del paquete" },
      { lat: Number(currentEnvio.destino_lat), lng: Number(currentEnvio.destino_lng), kind: "home" as const, label: "Entrega del paquete" },
    ] : []),
    ...offers.filter((offer) => offer.comercio_latitud != null && offer.comercio_longitud != null)
      .map((offer) => ({ lat: Number(offer.comercio_latitud), lng: Number(offer.comercio_longitud), kind: "offer" as const, label: `Oferta: ${offer.comercio_nombre} · ${money(offer.ganancia)}` })),
  ];
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <DemandStrip />
      <WorkMap position={position} connected={connected} markers={markers}
        legend={[{ color: "hsl(214 84% 52%)", label: "Vos" }, { color: "hsl(163 44% 14%)", label: "Retiro" }, { color: "hsl(46 100% 47%)", label: "Entrega" }, { color: "hsl(262 83% 58%)", label: "Ofertas" }]} />
    </div>
  );
}

export function CourierEarningsPage() {
  const { delivered, deliveredEnvios } = useCourier();
  return <CourierWallet refreshKey={delivered.length + deliveredEnvios.length} />;
}

export function CourierIncentivesPage() {
  return <CourierIncentives />;
}

export function CourierHistoryPage() {
  const { delivered, deliveredEnvios } = useCourier();
  const rows = [
    ...delivered.map((order) => ({ id: order.id, at: order.entregado_at || order.created_at, title: order.comercio?.nombre ?? "Pedido", detail: order.direccion_entrega, gain: order.ganancia_repartidor ?? Number(order.costo_envio) + Number(order.propina), parcel: false })),
    ...deliveredEnvios.map((envio) => ({ id: envio.id, at: envio.entregado_at || envio.created_at, title: `Envío: ${envio.descripcion}`, detail: envio.destino_direccion, gain: Number(envio.ganancia_repartidor), parcel: true })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  if (!rows.length) return <EmptyState title="Todavía no hiciste entregas" text="Tus viajes y ganancias aparecen acá." />;
  return (
    <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
      {rows.slice(0, 50).map((row) => (
        <li key={row.id} className="flex items-center justify-between gap-3 p-3 text-sm">
          <span className="min-w-0"><span className="block truncate font-bold">{row.parcel && <Package className="mr-1 inline h-3.5 w-3.5 text-amber-600" />}{row.title}</span><span className="block truncate text-muted-foreground">{formatDateTime(row.at)} · {row.detail}</span></span>
          <span className="shrink-0 font-bold text-success">+{money(row.gain)}</span>
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

/** Secciones de la cuenta de trabajo que comparten repartidor y conductor (es la misma verificación y la misma billetera). */
export function WorkerAccountSections({ courier, onChanged }: { courier: Courier; onChanged: () => void }) {
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
    onChanged();
  };

  return (
    <>
      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="mb-3 font-extrabold">Verificación de identidad</h2>
        <IdentityVerification entidad="repartidor" onChanged={onChanged} />
      </section>

      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="font-extrabold">Cobros</h2>
        <p className="mb-3 text-sm text-muted-foreground">La cuenta donde te depositamos tus ganancias.</p>
        <PayoutForm entidad="repartidor" entidadId={courier.perfil_id} />
      </section>

      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="font-extrabold">Teléfono de contacto</h2>
        <form onSubmit={save} className="mt-3 flex gap-2">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} inputMode="tel" aria-label="Teléfono" />
          <Button type="submit" variant="outline" className="rounded-full" disabled={saving || phone.trim() === (courier.telefono ?? "")}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar</Button>
        </form>
      </section>
    </>
  );
}

/** Preguntas frecuentes de un contexto de trabajo. */
export function WorkerFaq({ title, items }: { title: string; items: { q: string; a: string }[] }) {
  return (
    <section className="rounded-3xl border bg-card p-4 sm:p-5">
      <h2 className="font-extrabold">{title}</h2>
      <Accordion type="single" collapsible className="mt-1">
        {items.map((item) => (
          <AccordionItem key={item.q} value={item.q}>
            <AccordionTrigger className="text-left font-bold">{item.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export function CourierProfilePage() {
  const { courier, reloadCourier } = useCourier();

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

      {courier.vehiculo === "auto" && (
        <Link to="/app/conductor" className="flex items-center gap-3 rounded-3xl border bg-card p-4 transition-colors hover:bg-muted sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl brand-tile"><CarTaxiFront className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><span className="block font-extrabold">{courier.remis_estado === "aprobado" ? "Panel de conductor" : "¿Querés llevar pasajeros?"}</span><span className="block text-sm text-muted-foreground">{courier.remis_estado === "aprobado" ? "Tus viajes de remís, ganancias e historial" : "Con tu auto podés sumarte como conductor de remís"}</span></span>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
        </Link>
      )}

      <WorkerAccountSections courier={courier} onChanged={reloadCourier} />
      <WorkerFaq title="Ayuda para repartidores" items={faqs} />
    </div>
  );
}

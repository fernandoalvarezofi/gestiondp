import { Link } from "react-router-dom";
import { Bike, CarTaxiFront, PowerOff, ShieldCheck, Star } from "lucide-react";
import { RemisEnrollment } from "@/components/courier/RemisEnrollment";
import { ActiveViaje, ViajeOfferCard } from "@/components/courier/ViajeCards";
import { CourierWallet } from "@/components/courier/CourierWallet";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { formatDateTime, money } from "@/lib/delivery";
import { categoriaLabel, viajeEstadoLabel } from "@/lib/remis";
import { WorkerAccountSections, WorkerFaq } from "../courier/CourierPages";
import { useDriver } from "./DriverLayout";

/** Viajes: el viaje en curso o los pedidos de remís disponibles cerca. */
export function DriverTripsPage() {
  const { currentViaje, busyDelivery, connected, viajeOffers, position, sharingStatus, refreshAll, courier } = useDriver();
  if (currentViaje) return <ActiveViaje viaje={currentViaje} position={position} sharing={sharingStatus} onChange={refreshAll} />;
  // Una entrega en curso se termina desde el contexto Repartidor; mientras tanto no se toman viajes.
  if (busyDelivery) return <EmptyState icon={<Bike className="h-7 w-7" />} title="Tenés una entrega en curso" text="Terminala desde el panel de repartidor. Mientras tanto no te llegan viajes." action={<Button asChild className="rounded-full"><Link to="/app/repartidor">Ir a la entrega</Link></Button>} />;
  if (!connected) return <EmptyState icon={<PowerOff className="h-7 w-7" />} title="Estás desconectado" text="Tocá “Conectarme” arriba para recibir pedidos de viaje cerca tuyo." />;
  if (!viajeOffers.length) {
    const categorias = (courier.remis_categorias ?? ["estandar"]).map(categoriaLabel).join(", ");
    return <EmptyState icon={<CarTaxiFront className="h-7 w-7" />} title="Buscando viajes para vos" text={`Quedate conectado: apenas alguien pida un remís cerca (${categorias}), te suena el aviso.`} />;
  }
  return <div className="mx-auto max-w-2xl space-y-4">{viajeOffers.map((offer) => <ViajeOfferCard key={offer.id} offer={offer} onChange={refreshAll} />)}</div>;
}

/** Ganancias: es la misma billetera de la cuenta de trabajo (viajes, entregas y bonos juntos). */
export function DriverEarningsPage() {
  const { finishedViajes } = useDriver();
  return (
    <div className="space-y-3">
      <p className="rounded-2xl border bg-card p-3 text-sm text-muted-foreground">Tu billetera es una sola: suma tus viajes de remís y, si también hacés entregas, lo que ganás como repartidor.</p>
      <CourierWallet refreshKey={finishedViajes.length} />
    </div>
  );
}

/** Historial de viajes terminados y cancelados. */
export function DriverHistoryPage() {
  const { finishedViajes } = useDriver();
  if (!finishedViajes.length) return <EmptyState icon={<CarTaxiFront className="h-7 w-7" />} title="Todavía no hiciste viajes" text="Tus viajes terminados y lo que ganaste aparecen acá." />;
  return (
    <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
      {finishedViajes.slice(0, 100).map((trip) => (
        <li key={trip.id} className="flex items-center justify-between gap-3 p-3 text-sm">
          <span className="min-w-0">
            <span className="block truncate font-bold">{trip.origen_direccion.split(",")[0]} → {trip.destino_direccion.split(",")[0]}</span>
            <span className="block truncate text-muted-foreground">{formatDateTime(trip.completado_at || trip.cancelado_at || trip.created_at)} · {categoriaLabel(trip.categoria ?? "estandar")} · {Number(trip.distancia_km).toFixed(1)} km{trip.calificacion ? <> · <Star className="inline h-3 w-3 fill-current text-warning" /> {trip.calificacion}</> : null}</span>
          </span>
          {trip.estado === "completado"
            ? <span className="shrink-0 font-bold text-success">+{money(Number(trip.ganancia_conductor))}</span>
            : <span className="shrink-0 text-xs font-bold text-muted-foreground">{viajeEstadoLabel[trip.estado]}</span>}
        </li>
      ))}
    </ul>
  );
}

const faqs = [
  { q: "¿Cómo se calcula lo que gano por viaje?", a: "Cada oferta muestra cuánto ganás antes de aceptarla. La tarifa sale de la distancia, con un mínimo y recargo nocturno." },
  { q: "¿Cómo cobro?", a: "El pasajero te paga en efectivo. En Ganancias ves tus viajes, lo que ganaste y tus movimientos." },
  { q: "¿Para qué es el código de 4 dígitos?", a: "El pasajero te lo dice al subir: así confirmamos que llevás a la persona correcta." },
  { q: "¿Qué categorías puedo llevar?", a: "Las habilita administración según tu vehículo (estándar, confort o familiar). Las ves en tu perfil." },
];

/** Perfil del conductor: vehículo, licencia, cobros y datos de contacto. */
export function DriverProfilePage() {
  const { courier, reloadCourier } = useDriver();
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-extrabold"><ShieldCheck className="h-5 w-5 text-success" />Conductor habilitado</h2>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Vehículo</dt><dd className="font-bold">{[courier.vehiculo_marca, courier.vehiculo_modelo, courier.vehiculo_anio].filter(Boolean).join(" ") || "Auto"}</dd></div>
          {courier.vehiculo_color && <div className="flex justify-between"><dt className="text-muted-foreground">Color</dt><dd className="font-bold capitalize">{courier.vehiculo_color}</dd></div>}
          {courier.patente && <div className="flex justify-between"><dt className="text-muted-foreground">Patente</dt><dd className="font-bold">{courier.patente}</dd></div>}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">Para cambiar la patente o el tipo de vehículo, escribile a soporte: se vuelve a verificar tu cuenta.</p>
      </section>
      <RemisEnrollment courier={courier} onChanged={reloadCourier} />
      <WorkerAccountSections courier={courier} onChanged={reloadCourier} />
      <WorkerFaq title="Ayuda para conductores" items={faqs} />
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ContextChatButton } from "@/components/messages/ContextChat";
import { Car, Check, KeyRound, Loader2, MapPin, Navigation, Phone, Star, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { MapView } from "@/components/maps/LazyMaps";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCourierLocation } from "@/hooks/useCourierLocation";
import { db, errorMessage, formatDateTime, money, shortId } from "@/lib/delivery";
import { Viaje, viajeActivo, viajeEstadoLabel, viajePasos, categoriaLabel } from "@/lib/remis";
import { cn } from "@/lib/utils";

type Driver = { nombre: string | null; patente: string | null; telefono: string | null; viajes: number; calificacion: number | null; marca?: string | null; modelo?: string | null; color?: string | null; anio?: number | null; categoria?: string | null };

/** Seguimiento del viaje: estado en vivo, mapa con el conductor, código para subir, cancelación y calificación. */
export default function RemisDetail() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [trip, setTrip] = useState<Viaje | null | undefined>(undefined);
  const [code, setCode] = useState<string | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_viajes").select("*").eq("id", id).maybeSingle();
    setTrip(data ?? null);
    if (!data) return;
    const { data: row } = await db.from("delivery_viaje_codigos").select("codigo").eq("viaje_id", id).maybeSingle();
    setCode(row?.codigo ?? null);
    if (data.conductor_id) {
      const { data: info } = await db.rpc("delivery_viaje_conductor", { p_viaje: id });
      setDriver((info as Driver | null) ?? null);
    } else setDriver(null);
  }, [id]);

  useEffect(() => {
    load();
    const channel = db.channel(`viaje-${id}`).on("postgres_changes", { event: "*", schema: "public", table: "delivery_viajes", filter: `id=eq.${id}` }, load).subscribe();
    return () => { db.removeChannel(channel); };
  }, [id, load]);

  const tracking = Boolean(trip && ["asignado", "en_origen", "a_bordo"].includes(trip.estado));
  const driverPosition = useCourierLocation(trip?.conductor_id, tracking);
  const markers = useMemo(() => trip ? [
    { lat: Number(trip.origen_lat), lng: Number(trip.origen_lng), kind: "home" as const, label: "Origen" },
    { lat: Number(trip.destino_lat), lng: Number(trip.destino_lng), kind: "store" as const, label: "Destino" },
    ...(driverPosition ? [{ lat: driverPosition.lat, lng: driverPosition.lng, kind: "courier" as const, label: "Conductor" }] : []),
  ] : [], [trip, driverPosition]);

  if (trip === undefined) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!trip || trip.cliente_id !== user?.id) return <div className="mx-auto max-w-2xl px-4 py-14"><EmptyState icon={<Car className="h-7 w-7" />} title="No encontramos este viaje" action={<Button asChild className="rounded-full"><Link to="/app/remis">Pedir un remís</Link></Button>} /></div>;

  const stepIndex = viajePasos.findIndex((step) => step.id === trip.estado);
  const cancel = async () => {
    if (!window.confirm("¿Cancelar el viaje?")) return;
    setBusy(true);
    const { error } = await db.rpc("delivery_cancelar_viaje", { p_id: trip.id, p_motivo: null });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Viaje cancelado");
    load();
  };
  const rate = async (stars: number) => {
    const { error } = await db.rpc("delivery_calificar_viaje", { p_id: trip.id, p_estrellas: stars });
    if (error) return toast.error(errorMessage(error));
    toast.success("¡Gracias por calificar!");
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-14 pt-4 sm:px-6">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs font-bold uppercase text-primary">Remís · {shortId(trip.id)}</p><h1 className="text-2xl font-extrabold">{viajeEstadoLabel[trip.estado]}</h1></div>
        <p className="font-display text-2xl font-black">{money(trip.total)}</p>
      </div>

      {trip.estado === "cancelado" ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-destructive/10 p-4 text-sm font-semibold text-destructive"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{trip.motivo_cancelacion ?? "El viaje fue cancelado"}. No se te cobró nada.</p>
      ) : (
        <ol className="mt-5 grid grid-cols-5 gap-1" aria-label="Estado del viaje">
          {viajePasos.map((step, index) => (
            <li key={step.id} className="flex flex-col items-center text-center">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-black", index < stepIndex || trip.estado === "completado" ? "bg-primary text-primary-foreground" : index === stepIndex ? "bg-primary/15 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground")}>{index < stepIndex || trip.estado === "completado" ? <Check className="h-4 w-4" /> : index + 1}</span>
              <span className={cn("mt-1 text-[11px] font-bold leading-tight", index <= stepIndex ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
            </li>
          ))}
        </ol>
      )}

      {trip.estado === "buscando" && <p className="mt-4 flex items-center gap-2 rounded-2xl bg-muted p-4 text-sm font-semibold"><Loader2 className="h-4 w-4 animate-spin" />{trip.programado_para ? `Reservado para el ${formatDateTime(trip.programado_para)}. Asignamos conductor 30 minutos antes.` : "Estamos avisando a los conductores cercanos. Te notificamos apenas alguien acepte."}</p>}

      {driver && viajeActivo(trip.estado) && (
        <section className="mt-5 flex items-center gap-3 rounded-3xl border bg-card p-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Car className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-extrabold">{driver.nombre || "Tu conductor"}</p>
            {(driver.marca || driver.modelo) && <p className="text-sm font-semibold">{[driver.marca, driver.modelo, driver.color].filter(Boolean).join(" · ")}{driver.anio ? ` (${driver.anio})` : ""}</p>}
            <p className="text-sm text-muted-foreground">{driver.patente ? `Patente ${driver.patente}` : "Auto habilitado"} · {driver.viajes} viajes{driver.calificacion ? ` · ★ ${driver.calificacion}` : ""}{driver.categoria ? ` · ${categoriaLabel(driver.categoria)}` : ""}</p>
          </div>
          {id && <ContextChatButton contexto="viaje" id={id} canal="pasajero_conductor" label="" title={driver.nombre || "Tu conductor"} subtitle="Coordiná el encuentro" autoOpen={searchParams.get("chat") === "1"} />}
          {driver.telefono && <Button asChild variant="outline" size="icon" className="rounded-full" aria-label="Llamar al conductor"><a href={`tel:${driver.telefono.replace(/[^\d+]/g, "")}`}><Phone className="h-4 w-4" /></a></Button>}
        </section>
      )}

      {viajeActivo(trip.estado) && code && trip.estado !== "a_bordo" && trip.estado !== "buscando" && (
        <section className="mt-5 rounded-3xl border-2 border-primary bg-primary/5 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-bold"><KeyRound className="h-4 w-4" />Tu código del viaje</p>
          <p className="mt-1 font-mono text-4xl font-black tracking-[0.4em]">{code}</p>
          <p className="mt-1 text-xs text-muted-foreground">Dáselo al conductor cuando subas, para confirmar que sos vos. No lo compartas antes de subir.</p>
        </section>
      )}

      <MapView markers={markers} className="mt-5 h-60 sm:h-72" />

      <section className="mt-5 divide-y rounded-3xl border bg-card">
        <div className="flex gap-3 p-4"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="font-bold">Origen</p><p className="text-sm text-muted-foreground">{trip.origen_direccion}</p></div></div>
        <div className="flex gap-3 p-4"><Navigation className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="font-bold">Destino</p><p className="text-sm text-muted-foreground">{trip.destino_direccion}</p></div></div>
        <dl className="space-y-1 p-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Viaje · {Number(trip.distancia_km).toFixed(1)} km · {trip.pasajeros} {trip.pasajeros === 1 ? "pasajero" : "pasajeros"}</dt><dd>{money(trip.tarifa)}</dd></div>
          {Number(trip.propina) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Propina</dt><dd>{money(trip.propina)}</dd></div>}
          <div className="flex justify-between font-extrabold"><dt>Total en efectivo</dt><dd>{money(trip.total)}</dd></div>
          <p className="pt-1 text-xs text-muted-foreground">Se lo pagás al conductor al llegar · Pedido el {formatDateTime(trip.created_at)}</p>
        </dl>
      </section>

      {trip.estado === "completado" && (
        <section className="mt-5 rounded-3xl border bg-card p-4 text-center">
          {trip.calificacion ? <p className="font-bold">Calificaste el viaje con {trip.calificacion} ★. ¡Gracias!</p> : (
            <>
              <p className="font-extrabold">¿Cómo estuvo el viaje?</p>
              <div className="mt-2 flex justify-center gap-1" role="group" aria-label="Calificación">{[1, 2, 3, 4, 5].map((stars) => <button key={stars} type="button" onClick={() => rate(stars)} aria-label={`${stars} estrellas`} className="rounded-full p-1.5 hover:bg-muted"><Star className="h-8 w-8 text-warning" /></button>)}</div>
            </>
          )}
        </section>
      )}

      {["buscando", "asignado", "en_origen"].includes(trip.estado) && <Button variant="outline" className="mt-5 w-full rounded-full text-destructive" onClick={cancel} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Cancelar viaje</Button>}
      {trip.estado === "a_bordo" && <p className="mt-5 text-center text-xs text-muted-foreground">El viaje ya empezó. Si necesitás ayuda, escribile a soporte.</p>}
    </div>
  );
}

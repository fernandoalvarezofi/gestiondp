import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, KeyRound, Loader2, MapPin, Package, PackageCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { MapView } from "@/components/maps/LazyMaps";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useCourierLocation } from "@/hooks/useCourierLocation";
import { db, errorMessage, formatDateTime, money, shortId } from "@/lib/delivery";
import { Envio, envioActivo, envioEstadoLabel, envioPasos, tamanoLabel } from "@/lib/envios";
import { cn } from "@/lib/utils";

/** Seguimiento de un envío: estado en tiempo real, mapa con el repartidor, código de entrega y cancelación. */
export default function EnvioDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [envio, setEnvio] = useState<Envio | null | undefined>(undefined);
  const [code, setCode] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_envios").select("*").eq("id", id).maybeSingle();
    setEnvio(data ?? null);
    if (data) {
      const { data: row } = await db.from("delivery_envio_codigos").select("codigo").eq("envio_id", id).maybeSingle();
      setCode(row?.codigo ?? null);
    }
  }, [id]);

  useEffect(() => {
    load();
    const channel = db.channel(`envio-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_envios", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [id, load]);

  const tracking = Boolean(envio && (envio.estado === "asignado" || envio.estado === "retirado"));
  const courier = useCourierLocation(envio?.repartidor_id, tracking);
  const markers = useMemo(() => envio ? [
    { lat: Number(envio.origen_lat), lng: Number(envio.origen_lng), kind: "store" as const, label: "Retiro" },
    { lat: Number(envio.destino_lat), lng: Number(envio.destino_lng), kind: "home" as const, label: "Entrega" },
    ...(courier ? [{ lat: courier.lat, lng: courier.lng, kind: "courier" as const, label: "Repartidor" }] : []),
  ] : [], [envio, courier]);

  if (envio === undefined) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!envio || envio.cliente_id !== user?.id) return <div className="mx-auto max-w-2xl px-4 py-14"><EmptyState icon={<Package className="h-7 w-7" />} title="No encontramos este envío" action={<Button asChild className="rounded-full"><Link to="/app/pedidos">Ver mis pedidos</Link></Button>} /></div>;

  const stepIndex = envioPasos.findIndex((step) => step.id === envio.estado);
  const cancel = async () => {
    if (!window.confirm("¿Cancelar el envío?")) return;
    setCancelling(true);
    const { error } = await db.rpc("delivery_cancelar_envio", { p_id: envio.id, p_motivo: null });
    setCancelling(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Envío cancelado");
    load();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-14 pt-4 sm:px-6">
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-xs font-bold uppercase text-primary">Envío de paquete · {shortId(envio.id)}</p><h1 className="text-2xl font-extrabold">{envioEstadoLabel[envio.estado]}</h1></div>
        <p className="font-display text-2xl font-black">{money(envio.total)}</p>
      </div>

      {envio.estado === "cancelado" ? (
        <p className="mt-4 flex items-start gap-2 rounded-2xl bg-destructive/10 p-4 text-sm font-semibold text-destructive"><XCircle className="mt-0.5 h-4 w-4 shrink-0" />{envio.motivo_cancelacion ?? "El envío fue cancelado"}. No se te cobró nada.</p>
      ) : (
        <ol className="mt-5 grid grid-cols-4 gap-1" aria-label="Estado del envío">
          {envioPasos.map((step, index) => (
            <li key={step.id} className="flex flex-col items-center text-center">
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-black", index < stepIndex || envio.estado === "entregado" ? "bg-primary text-primary-foreground" : index === stepIndex ? "bg-primary/15 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground")}>{index < stepIndex || envio.estado === "entregado" ? <Check className="h-4 w-4" /> : index + 1}</span>
              <span className={cn("mt-1 text-[11px] font-bold leading-tight", index <= stepIndex ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
            </li>
          ))}
        </ol>
      )}

      {envio.estado === "buscando" && <p className="mt-4 flex items-center gap-2 rounded-2xl bg-muted p-4 text-sm font-semibold"><Loader2 className="h-4 w-4 animate-spin" />Estamos avisando a los repartidores cercanos. Te notificamos apenas alguien lo tome.</p>}

      {envioActivo(envio.estado) && code && (
        <section className="mt-5 rounded-3xl border-2 border-primary bg-primary/5 p-4 text-center">
          <p className="flex items-center justify-center gap-2 text-sm font-bold"><KeyRound className="h-4 w-4" />Código de entrega</p>
          <p className="mt-1 font-mono text-4xl font-black tracking-[0.4em]">{code}</p>
          <p className="mt-1 text-xs text-muted-foreground">Pasáselo a {envio.destino_contacto}: lo tiene que decir el repartidor al entregar el paquete. No lo compartas con nadie más.</p>
        </section>
      )}

      <MapView markers={markers} className="mt-5 h-60 sm:h-72" />

      <section className="mt-5 divide-y rounded-3xl border bg-card">
        <div className="flex gap-3 p-4"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="font-bold">Retiro · {envio.origen_contacto}</p><p className="text-sm text-muted-foreground">{envio.origen_direccion}</p>{envio.origen_notas && <p className="text-sm text-muted-foreground">“{envio.origen_notas}”</p>}</div></div>
        <div className="flex gap-3 p-4"><PackageCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="font-bold">Entrega · {envio.destino_contacto}</p><p className="text-sm text-muted-foreground">{envio.destino_direccion}</p>{envio.destino_notas && <p className="text-sm text-muted-foreground">“{envio.destino_notas}”</p>}</div></div>
        <div className="flex gap-3 p-4"><Package className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><p className="font-bold">{envio.descripcion}</p><p className="text-sm text-muted-foreground">Tamaño {tamanoLabel[envio.tamano].toLowerCase()} · {Number(envio.distancia_km).toFixed(1)} km</p></div></div>
        <dl className="space-y-1 p-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Envío</dt><dd>{money(envio.costo)}</dd></div>
          {Number(envio.propina) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Propina</dt><dd>{money(envio.propina)}</dd></div>}
          <div className="flex justify-between font-extrabold"><dt>Total en efectivo</dt><dd>{money(envio.total)}</dd></div>
          <p className="pt-1 text-xs text-muted-foreground">{envio.quien_paga === "origen" ? "Se lo pagás al repartidor al retirar el paquete." : `Se lo paga ${envio.destino_contacto} al repartidor al recibirlo.`} · Pedido el {formatDateTime(envio.created_at)}</p>
        </dl>
      </section>

      {(envio.estado === "buscando" || envio.estado === "asignado") && <Button variant="outline" className="mt-5 w-full rounded-full text-destructive" onClick={cancel} disabled={cancelling}>{cancelling && <Loader2 className="h-4 w-4 animate-spin" />}Cancelar envío</Button>}
      {envio.estado === "retirado" && <p className="mt-5 text-center text-xs text-muted-foreground">El paquete ya fue retirado. Si necesitás ayuda, escribile a soporte.</p>}
    </div>
  );
}

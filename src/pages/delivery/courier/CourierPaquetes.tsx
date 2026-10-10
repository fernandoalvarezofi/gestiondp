import { useCallback, useEffect, useState } from "react";
import { Banknote, Check, Loader2, MapPin, Navigation, Package, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { EntregaRepartidor, misEntregas, MOTIVOS_VISITA, resolverEntrega } from "@/services/logistica";
import { EstadoEnvio } from "@/components/logistica/comun";

/**
 * Paquetes de Woref Logística que el repartidor tiene en su hoja de ruta. Para entregar pide nombre y DNI de quien recibe
 * (y confirmar el cobro si es contra reembolso); si no puede, registra el motivo. El servidor valida que la hoja sea suya.
 */
export default function CourierPaquetes() {
  const [rows, setRows] = useState<EntregaRepartidor[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [abierto, setAbierto] = useState<{ id: string; modo: "entregar" | "fallida" } | null>(null);
  const cargar = useCallback(async () => { try { setRows(await misEntregas()); setError(null); } catch (e) { setError(e); } }, []);
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t); }, [cargar]);

  if (error && !rows) return <ErrorState title="No pudimos cargar tus paquetes" error={error} onRetry={cargar} />;
  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const pendientes = rows.filter((r) => r.estado === "en_distribucion");
  const hechos = rows.filter((r) => r.estado !== "en_distribucion");
  const efectivo = rows.filter((r) => r.estado === "entregado" && Number(r.reembolso) > 0).reduce((s, r) => s + Number(r.reembolso), 0);
  if (rows.length === 0) return <EmptyState icon={<Package className="h-7 w-7" />} title="No tenés paquetes asignados" text="Cuando el depósito te arme una hoja de ruta, los paquetes aparecen acá en el orden de reparto." />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border bg-card p-3"><p className="text-2xl font-extrabold">{pendientes.length}</p><p className="text-xs text-muted-foreground">Por entregar</p></div>
        <div className="rounded-2xl border bg-card p-3"><p className="text-2xl font-extrabold">{hechos.filter((r) => r.estado === "entregado").length}</p><p className="text-xs text-muted-foreground">Entregados</p></div>
        <div className="rounded-2xl border bg-card p-3"><p className="text-lg font-extrabold">{money(efectivo)}</p><p className="text-xs text-muted-foreground">Efectivo a rendir</p></div>
      </div>
      <ul className="space-y-3">
        {pendientes.map((r) => (
          <li key={r.id} className="rounded-3xl border bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="font-mono text-xs font-bold text-muted-foreground">{r.numero} · hoja {r.hoja}</p><p className="text-lg font-extrabold">{r.des_nombre}</p>
                <p className="flex items-start gap-1 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{r.des_direccion}, {r.des_ciudad}</p>
                {r.des_notas && <p className="mt-1 text-xs text-muted-foreground">“{r.des_notas}”</p>}
                <p className="mt-1 text-xs text-muted-foreground">{r.bultos} {r.bultos === 1 ? "bulto" : "bultos"} · de {r.remitente}{r.intentos > 0 ? ` · ${r.intentos + 1}.ª visita` : ""}</p></div>
              {Number(r.reembolso) > 0 && <span className="shrink-0 rounded-xl bg-warning/20 px-2.5 py-1.5 text-center text-xs font-bold text-warning-foreground"><Banknote className="mx-auto mb-0.5 h-4 w-4" />Cobrar<br />{money(r.reembolso)}</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-full" asChild><a href={`tel:${r.des_telefono.replace(/[^\d+]/g, "")}`}><Phone className="mr-1.5 h-4 w-4" /> Llamar</a></Button>
              <Button variant="outline" size="sm" className="rounded-full" asChild><a href={r.des_lat && r.des_lng ? `https://www.google.com/maps/dir/?api=1&destination=${r.des_lat},${r.des_lng}` : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${r.des_direccion}, ${r.des_ciudad}`)}`} target="_blank" rel="noreferrer"><Navigation className="mr-1.5 h-4 w-4" /> Ir</a></Button>
              <Button size="sm" className="ml-auto rounded-full" onClick={() => setAbierto({ id: r.id, modo: "entregar" })}><Check className="mr-1.5 h-4 w-4" /> Entregado</Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setAbierto({ id: r.id, modo: "fallida" })}>No pude</Button>
            </div>
            {abierto?.id === r.id && <Resolver envio={r} modo={abierto.modo} onCerrar={() => setAbierto(null)} onListo={() => { setAbierto(null); cargar(); }} />}
          </li>
        ))}
      </ul>
      {hechos.length > 0 && (
        <section><h3 className="mb-2 text-sm font-bold text-muted-foreground">Resueltos hoy</h3>
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">{hechos.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 text-sm"><span className="font-mono text-xs">{r.numero}</span><span className="min-w-0 flex-1 truncate">{r.des_nombre} · {r.des_ciudad}</span><EstadoEnvio estado={r.estado} /></li>
          ))}</ul>
        </section>
      )}
    </div>
  );
}

function Resolver({ envio, modo, onCerrar, onListo }: { envio: EntregaRepartidor; modo: "entregar" | "fallida"; onCerrar: () => void; onListo: () => void }) {
  const [nombre, setNombre] = useState(envio.des_nombre);
  const [dni, setDni] = useState("");
  const [cobrado, setCobrado] = useState(false);
  const [motivo, setMotivo] = useState(MOTIVOS_VISITA[0]);
  const [otro, setOtro] = useState("");
  const [busy, setBusy] = useState(false);
  const cr = Number(envio.reembolso) > 0;
  const listo = modo === "entregar" ? nombre.trim().length >= 3 && /^\d{6,9}$/.test(dni) && (!cr || cobrado) : motivo !== "Otro" || otro.trim().length >= 3;
  const enviar = async () => {
    setBusy(true);
    try {
      if (modo === "entregar") await resolverEntrega(envio.id, "entregado", { nombre, dni, cobrado });
      else await resolverEntrega(envio.id, "fallida", { motivo: motivo === "Otro" ? otro : motivo });
      toast.success(modo === "entregar" ? "Entrega registrada" : "Visita registrada");
      onListo();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-muted/50 p-3">
      <div className="flex items-center justify-between"><p className="text-sm font-bold">{modo === "entregar" ? "¿Quién lo recibe?" : "¿Por qué no se pudo entregar?"}</p><button type="button" aria-label="Cerrar" onClick={onCerrar} className="rounded-full p-1 hover:bg-background"><X className="h-4 w-4" /></button></div>
      {modo === "entregar" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-semibold">Nombre y apellido<Input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} className="mt-1 bg-background" /></label>
            <label className="text-xs font-semibold">DNI (sin puntos)<Input value={dni} onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" className="mt-1 bg-background" /></label>
          </div>
          {cr && <label className={cn("flex items-center gap-2 rounded-xl border p-2.5 text-sm font-semibold", cobrado ? "border-success bg-success/10" : "bg-background")}><input type="checkbox" checked={cobrado} onChange={(e) => setCobrado(e.target.checked)} /> Cobré {money(envio.reembolso)} en efectivo</label>}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">{MOTIVOS_VISITA.map((m) => <button key={m} type="button" onClick={() => setMotivo(m)} className={cn("rounded-full border px-3 py-1 text-xs font-semibold", motivo === m ? "border-foreground bg-foreground text-background" : "bg-background")}>{m}</button>)}</div>
          {motivo === "Otro" && <Input value={otro} onChange={(e) => setOtro(e.target.value)} maxLength={200} placeholder="Contá qué pasó" className="bg-background" aria-label="Motivo" />}
        </>
      )}
      <Button className="w-full rounded-full" disabled={!listo || busy} variant={modo === "fallida" ? "destructive" : "default"} onClick={enviar}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}{modo === "entregar" ? "Confirmar entrega" : "Registrar visita"}</Button>
    </div>
  );
}

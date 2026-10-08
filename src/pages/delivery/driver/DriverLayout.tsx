import { useEffect } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import { CarTaxiFront, Loader2, Power, PowerOff } from "lucide-react";
import { CourierApplication } from "@/components/courier/CourierApplication";
import { RemisEnrollment } from "@/components/courier/RemisEnrollment";
import { SelfieControl } from "@/components/courier/SelfieControl";
import { EmptyState } from "@/components/delivery/Common";
import { PushPrompt } from "@/components/delivery/PushPrompt";
import { PanelShell } from "@/components/panel/PanelShell";
import { Button } from "@/components/ui/button";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { cn } from "@/lib/utils";
import { driverNav } from "@/navigation/menus";
import { useWorkerSession, type WorkerSession } from "../courier/useWorkerSession";

export type DriverContext = WorkerSession & { courier: NonNullable<WorkerSession["courier"]> };
export const useDriver = () => useOutletContext<DriverContext>();

/** Paso previo al panel: quien todavía no es conductor aprobado ve cómo sumarse (verificación + licencia y cédula). */
function DriverOnboarding({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <header className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl brand-tile"><CarTaxiFront className="h-6 w-6" /></span>
        <div><p className="text-xs font-bold uppercase tracking-wide text-primary">Conductor</p><h1 className="text-2xl font-extrabold">Manejá con Woref</h1></div>
      </header>
      <p className="text-muted-foreground">Llevá pasajeros con tu auto y cobrá en efectivo. Primero verificamos tu identidad y después revisamos tu licencia y la cédula del vehículo.</p>
      {children}
    </div>
  );
}

/** Contexto Conductor: viajes de remís. Usa la misma cuenta de trabajo que el repartidor, pero solo muestra viajes. */
export default function DriverLayout() {
  const session = useWorkerSession("viajes");
  const { courier, loading, connected, busyNow, viajeOffers, sharingStatus, toggleConnection, reloadCourier } = session;
  const roles = useDeliveryRoles();
  const location = useLocation();

  const approvedDriver = Boolean(courier?.activo && courier?.remis_estado === "aprobado");
  useEffect(() => { if (!loading && approvedDriver !== roles.isDriver) roles.refresh(); }, [loading, approvedDriver]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!courier || !courier.verificado) return <DriverOnboarding><CourierApplication courier={courier} onDone={reloadCourier} /></DriverOnboarding>;
  if (!courier.activo) return <div className="mx-auto max-w-2xl px-4 py-14"><EmptyState icon={<CarTaxiFront className="h-7 w-7" />} title="Tu cuenta está pausada" text="Comunicate con soporte para reactivarla." /></div>;
  if (courier.remis_estado !== "aprobado") return <DriverOnboarding><RemisEnrollment courier={courier} onChanged={reloadCourier} /></DriverOnboarding>;

  const context: DriverContext = { ...session, courier };
  const vehicle = [courier.vehiculo_marca, courier.vehiculo_modelo].filter(Boolean).join(" ") || "Auto";

  return (
    <PanelShell
      panel="Conductor"
      bottomTabs
      identity={
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 group-data-[collapsible=icon]:hidden">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", connected ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}><CarTaxiFront className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="text-sm font-extrabold leading-tight">{connected ? "Conectado" : "Desconectado"}</p><p className="truncate text-[11px] font-bold text-muted-foreground">{vehicle}{courier.patente ? ` · ${courier.patente}` : ""}</p></div>
        </div>
      }
      groups={driverNav(busyNow ? undefined : viajeOffers.length)}
      actions={
        <Button onClick={toggleConnection} size="sm" className={cn("h-9 rounded-full px-4 font-extrabold", connected ? "bg-success text-white hover:bg-success/90" : "")} variant={connected ? "default" : "outline"} disabled={busyNow && connected} aria-pressed={connected}>
          {connected ? <><Power className="h-4 w-4" />Conectado</> : <><PowerOff className="h-4 w-4" />Conectarme</>}
        </Button>
      }
    >
      {connected && sharingStatus === "denied" && <p className="mb-4 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Necesitamos tu ubicación para ofrecerte viajes cercanos. Habilitala desde el candado de la barra de direcciones.</p>}
      <SelfieControl courier={courier} onDone={reloadCourier} />
      {location.pathname === "/app/conductor" && <PushPrompt className="mb-4" title="Enterate al instante de los viajes" text="Activá los avisos: te notificamos cuando un pasajero pide un remís cerca, aunque tengas la app cerrada." />}
      <Outlet context={context} />
    </PanelShell>
  );
}

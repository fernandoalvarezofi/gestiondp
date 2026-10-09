import { useEffect } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import { Bike, Loader2, Power, PowerOff } from "lucide-react";
import { CourierApplication } from "@/components/courier/CourierApplication";
import { OnboardingBar } from "@/components/courier/OnboardingBar";
import { SelfieControl } from "@/components/courier/SelfieControl";
import { EmptyState } from "@/components/delivery/Common";
import { PushPrompt } from "@/components/delivery/PushPrompt";
import { PanelShell } from "@/components/panel/PanelShell";
import { Button } from "@/components/ui/button";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { cn } from "@/lib/utils";
import { COURIER_TABS, courierNav } from "@/navigation/menus";
import { useWorkerSession, type WorkerSession } from "./useWorkerSession";

export type CourierContext = WorkerSession & { courier: NonNullable<WorkerSession["courier"]> };
export const useCourier = () => useOutletContext<CourierContext>();

/** Contexto Repartidor: entregas de pedidos y envíos de paquetes. Los viajes de remís están en el contexto Conductor. */
export default function CourierLayout() {
  const session = useWorkerSession("entregas");
  const { courier, loading, connected, busyDelivery, offers, envioOffers, sharingStatus, toggleConnection, reloadCourier } = session;
  const roles = useDeliveryRoles();
  const unreadMessages = useUnreadMessages({ rol: "repartidor" });
  const location = useLocation();

  // Si el alta cambió (por ejemplo, lo aprobaron), el selector de contexto se entera.
  const active = Boolean(courier?.activo);
  useEffect(() => { if (!loading && active !== roles.isCourier) roles.refresh(); }, [loading, active]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!courier || !courier.verificado) return <><OnboardingBar /><CourierApplication courier={courier} onDone={reloadCourier} /></>;
  if (!courier.activo) return <div className="mx-auto max-w-2xl px-4 py-14"><EmptyState icon={<Bike className="h-7 w-7" />} title="Tu cuenta de repartidor está pausada" text="Comunicate con soporte para reactivarla." /></div>;

  const context: CourierContext = { ...session, courier };

  return (
    <PanelShell
      panel="Repartidor"
      bottomTabs
      tabs={COURIER_TABS}
      identity={
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 group-data-[collapsible=icon]:hidden">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", connected ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}><Bike className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="text-sm font-extrabold leading-tight">{connected ? "Conectado" : "Desconectado"}</p><p className="text-[11px] font-bold capitalize text-muted-foreground">{courier.vehiculo.replace("_", " ")} · verificado</p></div>
        </div>
      }
      groups={courierNav(busyDelivery ? undefined : offers.length + envioOffers.length, unreadMessages)}
      actions={
        <Button onClick={toggleConnection} size="sm" className={cn("h-9 rounded-full px-4 font-extrabold", connected ? "bg-success text-white hover:bg-success/90" : "")} variant={connected ? "default" : "outline"} disabled={session.busyNow && connected} aria-pressed={connected}>
          {connected ? <><Power className="h-4 w-4" />Conectado</> : <><PowerOff className="h-4 w-4" />Conectarme</>}
        </Button>
      }
    >
      {connected && sharingStatus === "denied" && <p className="mb-4 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Necesitamos tu ubicación para ofrecerte pedidos cercanos. Habilitala desde el candado de la barra de direcciones.</p>}
      <SelfieControl courier={courier} onDone={reloadCourier} />
      {location.pathname === "/app/repartidor" && <PushPrompt className="mb-4" title="Enterate al instante de las ofertas" text="Activá los avisos: te notificamos cuando haya una oferta para vos, aunque tengas la app cerrada." />}
      <Outlet context={context} />
    </PanelShell>
  );
}

import { Link, Navigate, useParams } from "react-router-dom";
import { Bell, Clock3, Info, MapPin, Settings2 } from "lucide-react";
import { PrintAlertsPanel } from "@/components/merchant/PrintAlertsPanel";
import { SettingsSection, StoreSettingsForm, storeToFormValues } from "@/components/merchant/StoreSettingsForm";
import { cn } from "@/lib/utils";
import { useMerchant } from "./context";

const SECTIONS = [
  { id: "general", label: "Datos del local", hint: "Nombre, fotos y descripción", icon: Info },
  { id: "horarios", label: "Horarios", hint: "Cuándo atendés", icon: Clock3 },
  { id: "entrega", label: "Entrega y zona", hint: "Ubicación, costos y tiempos", icon: MapPin },
  { id: "operacion", label: "Operación", hint: "Retiro, programados y preparación", icon: Settings2 },
  { id: "impresion", label: "Impresión y avisos", hint: "Comandas y notificaciones", icon: Bell },
] as const;

/** Configuración del local dividida en secciones, cada una con su propia pantalla. */
export default function MerchantSettings() {
  const { store, saveSettings } = useMerchant();
  const { seccion } = useParams();
  const current = SECTIONS.find((item) => item.id === seccion);
  if (!current) return <Navigate to="/app/comercio/configuracion/general" replace />;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <nav className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0" aria-label="Secciones de configuración">
        {SECTIONS.map(({ id, label, hint, icon: Icon }) => (
          <Link key={id} to={`/app/comercio/configuracion/${id}`} className={cn("flex shrink-0 items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors lg:border-transparent", current.id === id ? "border-primary bg-primary/5 text-primary lg:border-primary/30" : "bg-card hover:bg-muted lg:bg-transparent")}>
            <Icon className="h-5 w-5 shrink-0" />
            <span className="min-w-0"><span className="block text-sm font-bold">{label}</span><span className="hidden text-xs font-normal text-muted-foreground lg:block">{hint}</span></span>
          </Link>
        ))}
      </nav>

      <section className="min-w-0 rounded-3xl border bg-card p-4 sm:p-6">
        <h2 className="text-xl font-extrabold">{current.label}</h2>
        <p className="mb-5 text-sm text-muted-foreground">{current.hint}</p>
        {current.id === "impresion" ? (
          <PrintAlertsPanel className="max-w-md" />
        ) : (
          <StoreSettingsForm key={`${store.id}-${current.id}-${store.nombre}`} section={current.id as SettingsSection} initial={storeToFormValues(store)} submitLabel="Guardar cambios" onSubmit={saveSettings} />
        )}
      </section>
    </div>
  );
}

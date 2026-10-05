import { useState } from "react";
import { Car, Clock3, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { DocumentChecklist } from "@/components/verification/DocumentChecklist";
import type { Courier } from "@/components/courier/CourierApplication";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, errorMessage } from "@/lib/delivery";
import { categoriaLabel } from "@/lib/remis";
import type { DocSpec } from "@/lib/verification";

const remisDocs: DocSpec[] = [
  { tipo: "licencia", label: "Licencia de conducir profesional", hint: "Foto clara del frente y dorso en un solo archivo (o PDF).", required: true },
  { tipo: "cedula_vehiculo", label: "Cédula del vehículo", hint: "Cédula verde o azul vigente, a nombre tuyo o con autorización.", required: true },
];

/** Alta como conductor de remís: documentación, aprobación de administración y botón para recibir viajes. */
export function RemisEnrollment({ courier, onChanged }: { courier: Courier; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  if (courier.vehiculo !== "auto") {
    return (
      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-extrabold"><Car className="h-5 w-5 text-primary" />Viajes de remís</h2>
        <p className="mt-1 text-sm text-muted-foreground">Para manejar un remís tu vehículo tiene que ser un auto. Si cambiaste de vehículo, actualizalo en tu perfil (se vuelve a verificar).</p>
      </section>
    );
  }

  const request = async () => {
    setBusy(true);
    const { error } = await db.rpc("delivery_remis_solicitar");
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Pedimos tu alta como conductor de remís. Te avisamos cuando la revisemos.");
    onChanged();
  };
  const toggle = async (checked: boolean) => {
    const { error } = await db.from("delivery_repartidores").update({ acepta_remis: checked }).eq("perfil_id", courier.perfil_id);
    if (error) return toast.error(errorMessage(error));
    toast.success(checked ? "Vas a recibir viajes de remís cuando estés conectado" : "Dejaste de recibir viajes de remís");
    onChanged();
  };

  return (
    <section className="rounded-3xl border bg-card p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-extrabold"><Car className="h-5 w-5 text-primary" />Viajes de remís</h2>
      {courier.remis_estado === "aprobado" ? (
        <>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl border p-3">
          <span><span className="block font-bold">Recibir viajes de remís</span><span className="block text-xs text-muted-foreground">Cuando estés conectado, además de pedidos y envíos te llegan viajes de pasajeros. Cobrás en efectivo.</span></span>
          <Switch checked={Boolean(courier.acepta_remis)} onCheckedChange={toggle} aria-label="Recibir viajes de remís" />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">Categorías que podés llevar: <span className="font-bold text-foreground">{(courier.remis_categorias ?? ["estandar"]).map(categoriaLabel).join(", ")}</span>. Las habilita administración.</p>
        <VehicleForm courier={courier} onChanged={onChanged} />
        </>
      ) : courier.remis_estado === "solicitado" ? (
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-sm font-semibold"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />Estamos revisando tu documentación. Te avisamos apenas esté lista.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted-foreground">Sumá viajes de pasajeros a tus ganancias. Necesitamos tu licencia y la cédula del auto para habilitarte.</p>
          {courier.remis_estado === "rechazado" && <p className="mt-3 flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />No pudimos habilitarte: {courier.remis_motivo}. Corregí tus documentos y volvé a pedirlo.</p>}
          <div className="mt-3"><DocumentChecklist entidad="repartidor" entidadId={courier.perfil_id} specs={remisDocs} /></div>
          <Button className="mt-3 rounded-full" onClick={request} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Pedir el alta como remís</Button>
        </>
      )}
    </section>
  );
}

/** Datos del auto que ve el pasajero (marca, modelo, color y año) para reconocerlo al subir. */
function VehicleForm({ courier, onChanged }: { courier: Courier; onChanged: () => void }) {
  const [marca, setMarca] = useState(courier.vehiculo_marca ?? "");
  const [modelo, setModelo] = useState(courier.vehiculo_modelo ?? "");
  const [color, setColor] = useState(courier.vehiculo_color ?? "");
  const [anio, setAnio] = useState(courier.vehiculo_anio ? String(courier.vehiculo_anio) : "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const { error } = await db.rpc("delivery_conductor_vehiculo", { p_marca: marca, p_modelo: modelo, p_color: color, p_anio: Number(anio) });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Guardamos los datos de tu auto");
    onChanged();
  };
  return (
    <div className="mt-4 rounded-2xl border p-3">
      <p className="font-bold">Tu auto</p>
      <p className="text-xs text-muted-foreground">Lo ve el pasajero junto con la patente, para reconocerte.</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="v-marca">Marca</Label><Input id="v-marca" value={marca} maxLength={40} onChange={(e) => setMarca(e.target.value)} placeholder="Fiat" /></div>
        <div className="space-y-1"><Label htmlFor="v-modelo">Modelo</Label><Input id="v-modelo" value={modelo} maxLength={40} onChange={(e) => setModelo(e.target.value)} placeholder="Cronos" /></div>
        <div className="space-y-1"><Label htmlFor="v-color">Color</Label><Input id="v-color" value={color} maxLength={30} onChange={(e) => setColor(e.target.value)} placeholder="Gris" /></div>
        <div className="space-y-1"><Label htmlFor="v-anio">Año</Label><Input id="v-anio" inputMode="numeric" value={anio} maxLength={4} onChange={(e) => setAnio(e.target.value.replace(/\D/g, ""))} placeholder="2020" /></div>
      </div>
      <Button className="mt-3 rounded-full" size="sm" onClick={save} disabled={busy || !marca.trim() || !modelo.trim() || !color.trim() || anio.length !== 4}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar datos del auto</Button>
    </div>
  );
}

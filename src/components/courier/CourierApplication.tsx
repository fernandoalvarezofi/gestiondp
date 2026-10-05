import { FormEvent, useState } from "react";
import { Bike, Car, Footprints, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { DocumentChecklist } from "@/components/verification/DocumentChecklist";
import { IdentityVerification } from "@/components/verification/IdentityVerification";
import { db, errorMessage } from "@/lib/delivery";
import { courierDocs } from "@/lib/verification";
import { cn } from "@/lib/utils";

export type Courier = {
  perfil_id: string; vehiculo: string; telefono?: string | null; disponible: boolean; activo: boolean;
  dni?: string | null; patente?: string | null; verificado: boolean; motivo_rechazo?: string | null;
  remis_estado?: "solicitado" | "aprobado" | "rechazado" | null; remis_motivo?: string | null; acepta_remis?: boolean;
  vehiculo_marca?: string | null; vehiculo_modelo?: string | null; vehiculo_color?: string | null; vehiculo_anio?: number | null; remis_categorias?: string[] | null;
  control_estado?: "requerido" | "en_revision" | null; control_motivo?: string | null; control_desafio?: string | null;
};

const vehicles = [
  { id: "moto", label: "Moto", icon: Bike },
  { id: "bici", label: "Bici", icon: Bike },
  { id: "auto", label: "Auto", icon: Car },
  { id: "a_pie", label: "A pie", icon: Footprints },
];

/** Alta del repartidor y estado de la verificación de identidad (administración la aprueba antes de que pueda conectarse). */
export function CourierApplication({ courier, onDone }: { courier: Courier | null; onDone: () => void }) {
  const { user } = useAuth();
  const [editing, setEditing] = useState(!courier);
  const [vehicle, setVehicle] = useState(courier?.vehiculo ?? "moto");
  const [phone, setPhone] = useState(courier?.telefono ?? "");
  const [plate, setPlate] = useState(courier?.patente ?? "");
  const [saving, setSaving] = useState(false);
  const needsPlate = vehicle === "moto" || vehicle === "auto";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (phone.replace(/\D/g, "").length < 8) return toast.error("Ingresá un teléfono de contacto válido");
    if (needsPlate && (cleanPlate.length < 6 || cleanPlate.length > 7)) return toast.error("Ingresá la patente de tu vehículo");
    setSaving(true);
    const values = { vehiculo: vehicle, telefono: phone.trim(), patente: needsPlate ? cleanPlate : null };
    const { error } = courier
      ? await db.from("delivery_repartidores").update(values).eq("perfil_id", user.id)
      : await db.from("delivery_repartidores").insert({ perfil_id: user.id, ...values });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(courier ? "Datos actualizados" : "¡Listo! Ahora verificá tu identidad para empezar a repartir.");
    setEditing(false);
    onDone();
  };

  if (courier && !editing) {
    const extras = courierDocs(courier.vehiculo);
    return (
      <div className="mx-auto max-w-xl px-4 pb-16 pt-8">
        <div className="text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="h-8 w-8" /></span>
          <h1 className="mt-4 text-2xl font-black">Verificá tu identidad para repartir</h1>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">Como en toda app de reparto, confirmamos quién es cada repartidor antes de dejarlo conectarse. Son unos minutos y solo se hace una vez.</p>
        </div>
        <div className="mt-6 rounded-3xl border bg-card p-4 sm:p-5"><IdentityVerification entidad="repartidor" onChanged={onDone} /></div>
        {extras.length > 0 && (
          <div className="mt-6 rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="font-extrabold">Documentos de tu vehículo</h2>
            <p className="mb-3 text-sm text-muted-foreground">Son opcionales, pero nos ayudan a habilitarte en zonas con controles.</p>
            <DocumentChecklist entidad="repartidor" entidadId={courier.perfil_id} specs={extras} />
          </div>
        )}
        <dl className="mt-6 space-y-2 rounded-2xl border bg-card p-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Vehículo</dt><dd className="font-bold">{vehicles.find((item) => item.id === courier.vehiculo)?.label}</dd></div>
          {courier.patente && <div className="flex justify-between"><dt className="text-muted-foreground">Patente</dt><dd className="font-bold">{courier.patente}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted-foreground">Teléfono</dt><dd className="font-bold">{courier.telefono || "—"}</dd></div>
        </dl>
        <div className="mt-4 text-center"><Button variant="outline" className="rounded-full" onClick={() => setEditing(true)}>Editar vehículo y teléfono</Button></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 pb-16 pt-5 sm:px-6">
      {!courier && (
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-10 text-primary-foreground">
          <Bike className="absolute -bottom-8 -right-6 h-48 w-48 text-white/10" />
          <div className="relative">
            <Bike className="h-10 w-10" />
            <h1 className="mt-3 text-3xl font-extrabold">Repartí con Woref</h1>
            <p className="mt-2 max-w-md text-primary-foreground/85">Elegí tus horarios, conectate cuando quieras y quedate con el 100% de las propinas.</p>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="mt-6 space-y-5 rounded-3xl border bg-card p-5">
        <div>
          <p className="font-bold">¿Cómo vas a repartir?</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Vehículo">
            {vehicles.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" role="radio" aria-checked={vehicle === id} onClick={() => setVehicle(id)} className={cn("flex flex-col items-center gap-1 rounded-2xl border p-3 font-bold", vehicle === id ? "border-primary bg-primary/5 text-primary" : "hover:bg-muted")}><Icon className="h-6 w-6" />{label}</button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor="courier-phone" className="font-bold">Teléfono de contacto</label><Input id="courier-phone" value={phone} onChange={(event) => setPhone(event.target.value)} maxLength={30} placeholder="2355 40-0000" className="mt-2" /></div>
          {needsPlate && <div><label htmlFor="courier-plate" className="font-bold">Patente</label><Input id="courier-plate" value={plate} onChange={(event) => setPlate(event.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 7))} placeholder="AB123CD" className="mt-2 uppercase" /></div>}
        </div>
        <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />Tus datos solo los ve administración y se usan para verificar tu identidad. Cuando los aprobemos, vas a poder conectarte y recibir pedidos.</p>
        <div className="flex gap-2">
          {courier && <Button type="button" variant="outline" className="h-12 rounded-full" onClick={() => setEditing(false)}>Cancelar</Button>}
          <Button type="submit" className="h-12 flex-1 rounded-full text-base font-bold" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{courier ? "Guardar datos" : "Enviar para verificación"}</Button>
        </div>
      </form>
    </div>
  );
}

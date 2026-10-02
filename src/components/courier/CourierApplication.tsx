import { FormEvent, useState } from "react";
import { Bike, Car, Clock3, Footprints, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { DocumentChecklist, hasRequiredDocs } from "@/components/verification/DocumentChecklist";
import { db, errorMessage } from "@/lib/delivery";
import { courierDocs, VerificationDoc } from "@/lib/verification";
import { cn } from "@/lib/utils";

export type Courier = {
  perfil_id: string; vehiculo: string; telefono?: string | null; disponible: boolean; activo: boolean;
  dni?: string | null; patente?: string | null; verificado: boolean; motivo_rechazo?: string | null;
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
  const [dni, setDni] = useState(courier?.dni ?? "");
  const [plate, setPlate] = useState(courier?.patente ?? "");
  const [saving, setSaving] = useState(false);
  const [docs, setDocs] = useState<VerificationDoc[] | null>(null);
  const needsPlate = vehicle === "moto" || vehicle === "auto";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const cleanDni = dni.replace(/\D/g, "");
    const cleanPlate = plate.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (cleanDni.length < 7 || cleanDni.length > 9) return toast.error("Ingresá tu DNI sin puntos (7 a 9 números)");
    if (phone.replace(/\D/g, "").length < 8) return toast.error("Ingresá un teléfono de contacto válido");
    if (needsPlate && (cleanPlate.length < 6 || cleanPlate.length > 7)) return toast.error("Ingresá la patente de tu vehículo");
    setSaving(true);
    const values = { vehiculo: vehicle, telefono: phone.trim(), dni: cleanDni, patente: needsPlate ? cleanPlate : null };
    const { error } = courier
      ? await db.from("delivery_repartidores").update(values).eq("perfil_id", user.id)
      : await db.from("delivery_repartidores").insert({ perfil_id: user.id, ...values });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(courier ? "Datos actualizados" : "¡Listo! Ahora subí tus documentos para que podamos verificarte.");
    setEditing(false);
    onDone();
  };

  if (courier && !editing) {
    const specs = courierDocs(courier.vehiculo);
    const complete = hasRequiredDocs(docs, specs);
    return (
      <div className="mx-auto max-w-xl px-4 py-14 text-center">
        <span className={cn("mx-auto flex h-20 w-20 items-center justify-center rounded-full", courier.motivo_rechazo ? "bg-destructive/10 text-destructive" : "bg-warning/20")}>
          {courier.motivo_rechazo ? <XCircle className="h-10 w-10" /> : <Clock3 className="h-10 w-10" />}
        </span>
        <h1 className="mt-5 text-2xl font-black">{courier.motivo_rechazo ? "No pudimos verificar tus datos" : docs && !complete ? "Subí tus documentos para verificarte" : "Estamos revisando tus datos"}</h1>
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          {courier.motivo_rechazo ? <>Motivo: <span className="font-bold text-foreground">{courier.motivo_rechazo}</span>. Corregí tus datos o documentos y volvemos a revisarlos.</> : docs && !complete ? "Necesitamos tu DNI (frente y dorso) y una selfie con el DNI. Sin eso no podemos aprobarte." : "Verificamos la identidad de cada repartidor antes de dejarlo conectarse. Te avisamos apenas esté listo."}
        </p>
        <div className="mt-6 text-left"><DocumentChecklist entidad="repartidor" entidadId={courier.perfil_id} specs={specs} onChange={setDocs} /></div>
        <dl className="mx-auto mt-6 max-w-sm space-y-2 rounded-2xl border bg-card p-4 text-left text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Vehículo</dt><dd className="font-bold">{vehicles.find((item) => item.id === courier.vehiculo)?.label}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">DNI</dt><dd className="font-bold">{courier.dni || "—"}</dd></div>
          {courier.patente && <div className="flex justify-between"><dt className="text-muted-foreground">Patente</dt><dd className="font-bold">{courier.patente}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted-foreground">Teléfono</dt><dd className="font-bold">{courier.telefono || "—"}</dd></div>
        </dl>
        <Button variant="outline" className="mt-5 rounded-full" onClick={() => setEditing(true)}>Editar mis datos</Button>
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
          <div><label htmlFor="courier-dni" className="font-bold">DNI</label><Input id="courier-dni" value={dni} onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 9))} inputMode="numeric" placeholder="Sin puntos" className="mt-2" /></div>
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

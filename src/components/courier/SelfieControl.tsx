import { useState } from "react";
import { Camera, Clock3, Loader2, ShieldAlert, UserRound } from "lucide-react";
import { toast } from "sonner";
import { CameraCapture } from "@/components/verification/CameraCapture";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage } from "@/lib/delivery";
import { uploadVerificationDoc } from "@/lib/verification";
import type { Courier } from "@/components/courier/CourierApplication";

/** Selfie de control: confirma que quien reparte es la misma persona verificada. Mientras esté pendiente no se puede conectar. */
export function SelfieControl({ courier, onDone }: { courier: Courier; onDone: () => void }) {
  const { user } = useAuth();
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!courier.control_estado) return null;

  if (courier.control_estado === "en_revision") {
    return (
      <div className="mb-4 flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4">
        <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
        <div><p className="font-extrabold">Estamos revisando tu selfie de control</p><p className="text-sm text-muted-foreground">Apenas la aprobemos vas a poder conectarte de nuevo. Te avisamos.</p></div>
      </div>
    );
  }

  const send = async (file: File) => {
    if (!user) return;
    setBusy(true);
    try {
      await uploadVerificationDoc(file, user.id, "repartidor", user.id, "selfie_control");
      const { error } = await db.rpc("delivery_control_enviar");
      if (error) throw new Error(errorMessage(error));
      toast.success("Listo, la estamos revisando");
      onDone();
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="mb-4 rounded-2xl border-2 border-primary/40 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-extrabold">Necesitamos una selfie de control para que sigas repartiendo</p>
          <p className="text-sm text-muted-foreground">Es un chequeo de seguridad que hacemos cada tanto: confirma que sos vos quien reparte con esta cuenta. Tarda un minuto.</p>
          {courier.control_motivo && <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-sm font-semibold text-destructive">La anterior no sirvió: {courier.control_motivo}</p>}
          {courier.control_desafio && <p className="mt-3 flex items-center gap-2 text-sm"><UserRound className="h-4 w-4 text-primary" />Hacé este gesto: <span className="font-extrabold">{courier.control_desafio}</span></p>}
          <Button className="mt-3 h-11 rounded-full px-6 font-bold" disabled={busy} onClick={() => setCamera(true)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}Sacarme la selfie</Button>
        </div>
      </div>
      {camera && <CameraCapture modo="rostro" titulo="Selfie de control" consejo={`${courier.control_desafio ?? "Mirá a la cámara"}. Con buena luz y la cara descubierta.`} onClose={() => setCamera(false)} onCapture={(file) => { setCamera(false); send(file); }} />}
    </div>
  );
}

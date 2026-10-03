import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, CheckCircle2, Clock3, ImagePlus, Loader2, Lock, ShieldAlert, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { CameraCapture } from "@/components/verification/CameraCapture";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateTime } from "@/lib/delivery";
import { Identity, isAdult, loadIdentity, saveIdentity, submitIdentity, validateIdentityData } from "@/lib/identity";
import { analyzeCanvas } from "@/lib/imageQuality";
import { DocEntity, DocType, loadDocs, signedDocUrl, uploadVerificationDoc, VerificationDoc } from "@/lib/verification";
import { cn } from "@/lib/utils";

type Step = "datos" | "frente" | "dorso" | "selfie" | "enviar";
type PhotoStep = "frente" | "dorso" | "selfie";
const STEPS: { id: Step; label: string }[] = [
  { id: "datos", label: "Tus datos" }, { id: "frente", label: "DNI frente" }, { id: "dorso", label: "DNI dorso" }, { id: "selfie", label: "Selfie" }, { id: "enviar", label: "Enviar" },
];
const DOC_OF: Record<PhotoStep, DocType> = { frente: "dni_frente", dorso: "dni_dorso", selfie: "selfie" };
const NEXT: Record<PhotoStep, Step> = { frente: "dorso", dorso: "selfie", selfie: "enviar" };
const isPhotoStep = (step: Step): step is PhotoStep => step === "frente" || step === "dorso" || step === "selfie";

const TIPS: Record<PhotoStep, { titulo: string; consejo: string; ok: string[] }> = {
  frente: { titulo: "Frente del DNI", consejo: "Apoyalo sobre una superficie lisa y encuadralo dentro del marco.", ok: ["Se leen el nombre y el número", "Se ven los cuatro bordes", "Sin reflejos ni dedos tapando"] },
  dorso: { titulo: "Dorso del DNI", consejo: "Dalo vuelta y encuadralo igual que el frente.", ok: ["Se ve el domicilio y el número de trámite", "Se ven los cuatro bordes", "Sin reflejos ni sombras"] },
  selfie: { titulo: "Selfie con tu DNI", consejo: "Tu cara y el DNI en la misma foto, con buena luz.", ok: ["Cara descubierta, sin lentes oscuros ni gorra", "El DNI al lado de tu cara, legible", "Hacé el gesto que te pedimos arriba"] },
};

/** Una foto privada del documento: solo la ven la persona dueña y administración (enlace temporal). */
function DocThumb({ doc, label }: { doc?: VerificationDoc; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setUrl(null);
    if (doc && !doc.path.endsWith(".pdf")) signedDocUrl(doc.path).then((signed) => { if (active) setUrl(signed); });
    return () => { active = false; };
  }, [doc]);
  return (
    <div className="overflow-hidden rounded-2xl border bg-muted">
      <div className="flex h-28 items-center justify-center">{url ? <img src={url} alt={label} className="h-full w-full object-cover" /> : doc ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <ImagePlus className="h-6 w-6 text-muted-foreground" />}</div>
      <p className="bg-card p-2 text-center text-xs font-bold">{label}</p>
    </div>
  );
}

/**
 * Verificación de identidad guiada: datos → foto del DNI (frente y dorso) → selfie con un gesto → revisión de administración.
 * Las fotos se sacan con la cámara y se controlan (nitidez, luz, reflejos) antes de subirlas.
 */
export function IdentityVerification({ entidad, onChanged }: { entidad: Extract<DocEntity, "repartidor" | "persona">; onChanged?: () => void }) {
  const { user } = useAuth();
  const [identity, setIdentity] = useState<Identity | null | undefined>(undefined);
  const [docs, setDocs] = useState<VerificationDoc[]>([]);
  const [step, setStep] = useState<Step>("datos");
  const [camera, setCamera] = useState<PhotoStep | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [dni, setDni] = useState("");
  const [birth, setBirth] = useState("");
  const [accepted, setAccepted] = useState(false);
  const gallery = useRef<HTMLInputElement>(null);
  const galleryStep = useRef<PhotoStep>("frente");

  const reload = useCallback(async () => {
    if (!user) return;
    const [row, list] = await Promise.all([loadIdentity(user.id), loadDocs(entidad, user.id)]);
    setIdentity(row);
    setDocs(list);
    if (row) { setName(row.nombre_legal); setDni(row.dni); setBirth(row.fecha_nacimiento ?? ""); }
  }, [user, entidad]);
  useEffect(() => { reload(); }, [reload]);

  const has = (tipo: DocType) => docs.find((doc) => doc.tipo === tipo);
  const doneOf = (id: Step) => id === "datos" ? Boolean(identity) : id === "enviar" ? false : Boolean(has(DOC_OF[id]));
  const maxBirth = (() => { const limit = new Date(); limit.setFullYear(limit.getFullYear() - 18); return limit.toISOString().slice(0, 10); })();

  const saveData = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateIdentityData(name, dni, birth);
    if (problem) return toast.error(problem);
    setBusy(true);
    try { await saveIdentity(name, dni, birth); await reload(); setStep("frente"); } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  };

  const upload = async (file: File, target: PhotoStep) => {
    if (!user) return;
    setBusy(true);
    try {
      await uploadVerificationDoc(file, user.id, entidad, user.id, DOC_OF[target]);
      await reload();
      toast.success("Foto guardada");
      setStep(NEXT[target]);
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  };

  const pickFromGallery = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Elegí una foto (JPG, PNG o WEBP)");
    // Aunque venga de la galería, la foto pasa por el mismo control de calidad.
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return toast.error("No pudimos leer esa foto");
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0);
    bitmap.close();
    const quality = analyzeCanvas(canvas);
    if (!quality.ok) return toast.error(quality.problems[0]);
    await upload(file, galleryStep.current);
  };

  const send = async () => {
    setBusy(true);
    try {
      await submitIdentity();
      toast.success("¡Listo! Revisamos tu identidad y te avisamos.");
      setEditing(false); setAccepted(false);
      await reload();
      onChanged?.();
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  };

  if (identity === undefined) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (identity?.estado === "aprobada") {
    return (
      <div className="rounded-3xl border border-success/40 bg-success/5 p-5">
        <div className="flex items-start gap-3">
          <BadgeCheck className="mt-0.5 h-7 w-7 shrink-0 text-success" />
          <div>
            <p className="text-lg font-extrabold">Identidad verificada</p>
            <p className="text-sm text-muted-foreground">{identity.nombre_legal} · DNI ••••{identity.dni.slice(-3)}{identity.vence_at && ` · vigente hasta el ${new Date(identity.vence_at).toLocaleDateString("es-AR")}`}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">Si cambiás tu nombre, tu DNI o alguna de las fotos, vamos a tener que revisar tu identidad de nuevo.</p>
      </div>
    );
  }

  if (identity?.estado === "en_revision") {
    return (
      <div className="rounded-3xl border border-warning/40 bg-warning/10 p-5">
        <div className="flex items-start gap-3">
          <Clock3 className="mt-0.5 h-7 w-7 shrink-0" />
          <div>
            <p className="text-lg font-extrabold">Estamos revisando tu identidad</p>
            <p className="text-sm text-muted-foreground">Enviada el {identity.enviado_at ? formatDateTime(identity.enviado_at) : "—"}. Una persona de Woref compara tus fotos con tus datos. Te avisamos apenas esté lista.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2"><DocThumb doc={has("dni_frente")} label="Frente" /><DocThumb doc={has("dni_dorso")} label="Dorso" /><DocThumb doc={has("selfie")} label="Selfie" /></div>
      </div>
    );
  }

  if (identity?.estado === "rechazada" && !editing) {
    return (
      <div className="rounded-3xl border border-destructive/40 bg-destructive/5 p-5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-7 w-7 shrink-0 text-destructive" />
          <div>
            <p className="text-lg font-extrabold">No pudimos verificar tu identidad</p>
            <p className="text-sm text-muted-foreground">Motivo: <span className="font-bold text-foreground">{identity.motivo_rechazo}</span></p>
          </div>
        </div>
        <Button className="mt-4 rounded-full" onClick={() => { setEditing(true); setStep("datos"); }}>Corregir y volver a enviar</Button>
      </div>
    );
  }

  const current = STEPS.findIndex((item) => item.id === step);
  const allDocs = Boolean(has("dni_frente") && has("dni_dorso") && has("selfie"));

  return (
    <div className="space-y-5">
      <ol className="flex items-center gap-1" aria-label="Pasos de la verificación">
        {STEPS.map((item, index) => {
          const reachable = index === 0 || Boolean(identity);
          return (
            <li key={item.id} className="flex flex-1 flex-col items-center gap-1">
              <button type="button" disabled={!reachable} onClick={() => setStep(item.id)} aria-label={item.label} aria-current={index === current ? "step" : undefined}
                className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-black", index === current ? "border-primary bg-primary text-primary-foreground" : doneOf(item.id) ? "border-success bg-success/10 text-success" : "text-muted-foreground")}>
                {doneOf(item.id) && index !== current ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </button>
              <span className={cn("hidden text-[11px] font-bold sm:block", index === current ? "text-foreground" : "text-muted-foreground")}>{item.label}</span>
            </li>
          );
        })}
      </ol>

      {step === "datos" && (
        <form onSubmit={saveData} className="space-y-4">
          <p className="flex items-start gap-2 rounded-2xl bg-muted p-3 text-sm text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0" />Usá los datos exactos de tu DNI. Solo los ve el equipo de verificación de Woref y los usamos únicamente para confirmar quién sos.</p>
          <div className="space-y-1.5"><Label htmlFor="id-name">Nombre y apellido (como en el DNI)</Label><Input id="id-name" value={name} maxLength={120} onChange={(event) => setName(event.target.value)} autoComplete="name" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="id-dni">Número de DNI</Label><Input id="id-dni" value={dni} inputMode="numeric" placeholder="Sin puntos" onChange={(event) => setDni(event.target.value.replace(/\D/g, "").slice(0, 8))} /></div>
            <div className="space-y-1.5"><Label htmlFor="id-birth">Fecha de nacimiento</Label><Input id="id-birth" type="date" value={birth} min="1900-01-01" max={maxBirth} onChange={(event) => setBirth(event.target.value)} aria-invalid={Boolean(birth) && !isAdult(birth)} /></div>
          </div>
          <Button type="submit" className="h-12 w-full rounded-full text-base font-bold sm:w-auto sm:px-8" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar y seguir</Button>
        </form>
      )}

      {isPhotoStep(step) && (
        <div className="space-y-4">
          {step === "selfie" && identity && (
            <div className="rounded-2xl border-2 border-primary/40 bg-primary/5 p-4">
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wide text-primary"><UserRound className="h-4 w-4" />Tu gesto de verificación</p>
              <p className="mt-1 text-lg font-extrabold">{identity.desafio}</p>
              <p className="text-xs text-muted-foreground">Es para confirmar que la foto es de ahora y que sos vos. Sin el gesto no podemos aprobarla.</p>
            </div>
          )}
          <div>
            <h3 className="text-lg font-extrabold">{TIPS[step].titulo}</h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{TIPS[step].ok.map((item) => <li key={item} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-success" />{item}</li>)}</ul>
          </div>
          {has(DOC_OF[step]) && <div className="max-w-[180px]"><DocThumb doc={has(DOC_OF[step])} label="Foto actual" /></div>}
          <div className="flex flex-wrap gap-2">
            <Button className="h-12 rounded-full px-6 font-bold" disabled={busy} onClick={() => setCamera(step)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}{has(DOC_OF[step]) ? "Sacar otra foto" : "Abrir la cámara"}</Button>
            {step !== "selfie" && <Button variant="outline" className="h-12 rounded-full px-5" disabled={busy} onClick={() => { galleryStep.current = step; gallery.current?.click(); }}><ImagePlus className="h-4 w-4" />Elegir de la galería</Button>}
            {has(DOC_OF[step]) && <Button variant="ghost" className="h-12 rounded-full" onClick={() => setStep(NEXT[step])}>Seguir</Button>}
          </div>
          <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={pickFromGallery} />
        </div>
      )}

      {step === "enviar" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2"><DocThumb doc={has("dni_frente")} label="DNI frente" /><DocThumb doc={has("dni_dorso")} label="DNI dorso" /><DocThumb doc={has("selfie")} label="Selfie" /></div>
          {identity && (
            <dl className="space-y-2 rounded-2xl border p-4 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Nombre</dt><dd className="font-bold">{identity.nombre_legal}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">DNI</dt><dd className="font-bold">{identity.dni}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Nacimiento</dt><dd className="font-bold">{identity.fecha_nacimiento ? new Date(`${identity.fecha_nacimiento}T12:00:00`).toLocaleDateString("es-AR") : "—"}</dd></div>
            </dl>
          )}
          {!allDocs && <p className="rounded-2xl bg-warning/15 p-3 text-sm font-semibold">Todavía faltan fotos: volvé a los pasos anteriores.</p>}
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm">
            <Checkbox checked={accepted} onCheckedChange={(value) => setAccepted(value === true)} className="mt-0.5" />
            <span>Declaro que los datos y las fotos son verdaderos y autorizo a Woref a usarlos para verificar mi identidad, según la <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline">política de privacidad</a>.</span>
          </label>
          <Button className="h-12 w-full rounded-full text-base font-bold sm:w-auto sm:px-8" disabled={busy || !allDocs || !accepted} onClick={send}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Enviar para verificación</Button>
        </div>
      )}

      {camera && (
        <CameraCapture modo={camera === "selfie" ? "rostro" : "documento"} titulo={TIPS[camera].titulo} consejo={camera === "selfie" && identity ? `${identity.desafio}. ${TIPS.selfie.consejo}` : TIPS[camera].consejo}
          onClose={() => setCamera(null)} onCapture={(file) => { const target = camera; setCamera(null); upload(file, target); }} />
      )}
    </div>
  );
}

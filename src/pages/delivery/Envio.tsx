import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Banknote, Loader2, MapPin, Package, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/delivery/Common";
import { MapView } from "@/components/maps/LazyMaps";
import { AddressSearch } from "@/components/maps/AddressSearch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { db, errorMessage, money } from "@/lib/delivery";
import { EnvioQuote, EnvioTamano, tamanos } from "@/lib/envios";
import type { AddressSuggestion } from "@/lib/geo";
import { cn } from "@/lib/utils";

type Place = { label: string; lat: number; lng: number } | null;
const PHONE = /^[0-9+()\s-]{8,25}$/;
const tips = [0, 500, 1000, 2000];

/** Pedir un envío de paquete: de una dirección a otra, con precio cerrado antes de confirmar. */
export default function Envio() {
  const { user } = useAuth();
  const roles = useDeliveryRoles();
  const navigate = useNavigate();
  const [origin, setOrigin] = useState<Place>(null);
  const [dest, setDest] = useState<Place>(null);
  const [oName, setOName] = useState("");
  const [oPhone, setOPhone] = useState("");
  const [oNotes, setONotes] = useState("");
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dNotes, setDNotes] = useState("");
  const [what, setWhat] = useState("");
  const [size, setSize] = useState<EnvioTamano>("chico");
  const [payer, setPayer] = useState<"origen" | "destino">("origen");
  const [tip, setTip] = useState(0);
  const [quote, setQuote] = useState<EnvioQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Los datos del remitente se completan con los de la cuenta (se pueden cambiar).
  useEffect(() => { if (roles.nombre && !oName) setOName(roles.nombre); }, [roles.nombre]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!user) return;
    db.from("perfiles").select("telefono").eq("id", user.id).maybeSingle().then(({ data }: { data: { telefono: string | null } | null }) => { if (data?.telefono) setOPhone((current) => current || data.telefono!); });
  }, [user]);

  useEffect(() => {
    if (!origin || !dest) { setQuote(null); return; }
    let active = true;
    setQuoting(true);
    const timer = window.setTimeout(async () => {
      const { data, error } = await db.rpc("delivery_cotizar_envio", { p_olat: origin.lat, p_olng: origin.lng, p_dlat: dest.lat, p_dlng: dest.lng, p_tamano: size });
      if (!active) return;
      setQuoting(false);
      setQuote(error ? { ok: false, motivo: errorMessage(error) } : data);
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [origin, dest, size]);

  const markers = useMemo(() => [
    ...(origin ? [{ lat: origin.lat, lng: origin.lng, kind: "store" as const, label: "Retiro" }] : []),
    ...(dest ? [{ lat: dest.lat, lng: dest.lng, kind: "home" as const, label: "Entrega" }] : []),
  ], [origin, dest]);

  const pick = (setter: (place: Place) => void) => (suggestion: AddressSuggestion) => setter({ label: suggestion.label, lat: suggestion.lat, lng: suggestion.lng });
  const total = quote?.ok ? quote.costo + tip : null;
  const reason = quote && !quote.ok ? (quote as { motivo: string }).motivo : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!origin || !dest) return toast.error("Elegí el retiro y la entrega");
    if (oName.trim().length < 2 || dName.trim().length < 2) return toast.error("Completá el nombre de quien entrega y de quien recibe");
    if (!PHONE.test(oPhone.trim()) || !PHONE.test(dPhone.trim())) return toast.error("Revisá los teléfonos de contacto");
    if (what.trim().length < 3) return toast.error("Contanos qué vas a enviar");
    if (!quote?.ok) return toast.error(reason ?? "Esperá la cotización");
    setSaving(true);
    const { data, error } = await db.rpc("delivery_crear_envio", {
      p_origen: origin.label, p_olat: origin.lat, p_olng: origin.lng, p_ocontacto: oName.trim(), p_otel: oPhone.trim(), p_onotas: oNotes.trim() || null,
      p_destino: dest.label, p_dlat: dest.lat, p_dlng: dest.lng, p_dcontacto: dName.trim(), p_dtel: dPhone.trim(), p_dnotas: dNotes.trim() || null,
      p_descripcion: what.trim(), p_tamano: size, p_quien_paga: payer, p_propina: tip,
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("¡Pedido enviado! Buscamos un repartidor.");
    navigate(`/app/envios/${data}`);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-32 pt-5 sm:px-6">
      <PageHeader eyebrow="Mensajería" title="Enviá un paquete" />
      <p className="mt-1 text-sm text-muted-foreground">Un repartidor retira el paquete en una dirección y lo lleva a otra, dentro de Lincoln. Pagás en efectivo al repartidor.</p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <section className="space-y-3 rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-extrabold"><MapPin className="h-5 w-5 text-primary" />Dónde lo retiramos</h2>
            <AddressSearch onPick={pick(setOrigin)} placeholder="Calle y altura del retiro" />
            {origin && <p className="rounded-xl bg-muted p-2.5 text-sm font-semibold">{origin.label}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="o-name">Quién lo entrega</Label><Input id="o-name" value={oName} maxLength={80} onChange={(event) => setOName(event.target.value)} autoComplete="name" /></div>
              <div className="space-y-1.5"><Label htmlFor="o-phone">Teléfono</Label><Input id="o-phone" type="tel" inputMode="tel" value={oPhone} maxLength={25} onChange={(event) => setOPhone(event.target.value)} autoComplete="tel" /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="o-notes">Indicaciones (opcional)</Label><Textarea id="o-notes" value={oNotes} maxLength={200} onChange={(event) => setONotes(event.target.value)} placeholder="Piso, timbre, horario…" className="min-h-[56px] resize-none" /></div>
          </section>

          <section className="space-y-3 rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="flex items-center gap-2 font-extrabold"><PackageCheck className="h-5 w-5 text-primary" />Dónde lo entregamos</h2>
            <AddressSearch onPick={pick(setDest)} placeholder="Calle y altura de la entrega" hideLocate />
            {dest && <p className="rounded-xl bg-muted p-2.5 text-sm font-semibold">{dest.label}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="d-name">Quién lo recibe</Label><Input id="d-name" value={dName} maxLength={80} onChange={(event) => setDName(event.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="d-phone">Teléfono</Label><Input id="d-phone" type="tel" inputMode="tel" value={dPhone} maxLength={25} onChange={(event) => setDPhone(event.target.value)} /></div>
            </div>
            <div className="space-y-1.5"><Label htmlFor="d-notes">Indicaciones (opcional)</Label><Textarea id="d-notes" value={dNotes} maxLength={200} onChange={(event) => setDNotes(event.target.value)} placeholder="Piso, timbre, horario…" className="min-h-[56px] resize-none" /></div>
          </section>
        </div>

        {markers.length > 0 && <MapView markers={markers} className="h-56 sm:h-64" />}

        <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-extrabold"><Package className="h-5 w-5 text-primary" />Qué enviás</h2>
          <div className="space-y-1.5"><Label htmlFor="what">Descripción</Label><Input id="what" value={what} maxLength={200} onChange={(event) => setWhat(event.target.value)} placeholder="Ej.: documentos, un regalo, una caja con ropa" /></div>
          <div role="radiogroup" aria-label="Tamaño del paquete" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {tamanos.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={size === item.id} onClick={() => setSize(item.id)} className={cn("rounded-2xl border p-3 text-left", size === item.id ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                <span className="block font-bold">{item.label}</span><span className="block text-xs text-muted-foreground">{item.hint}</span>
              </button>
            ))}
          </div>
          <p className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">No transportamos dinero en efectivo, joyas, armas, medicamentos con receta, sustancias ilegales ni productos peligrosos. El destinatario tiene que pasarle un código de 4 números al repartidor para confirmar la entrega.</p>
        </section>

        <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-extrabold"><Banknote className="h-5 w-5 text-primary" />Pago</h2>
          <div role="radiogroup" aria-label="Quién paga" className="grid gap-2 sm:grid-cols-2">
            {([["origen", "Pago yo, al retirar", "Le pagás al repartidor cuando retira el paquete."], ["destino", "Paga quien recibe", "El destinatario le paga al repartidor al recibirlo."]] as const).map(([id, label, hint]) => (
              <button key={id} type="button" role="radio" aria-checked={payer === id} onClick={() => setPayer(id)} className={cn("rounded-2xl border p-3 text-left", payer === id ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                <span className="block font-bold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span>
              </button>
            ))}
          </div>
          <div>
            <p className="text-sm font-bold">Propina para el repartidor (opcional)</p>
            <div className="mt-2 flex flex-wrap gap-2">{tips.map((value) => <button key={value} type="button" aria-pressed={tip === value} onClick={() => setTip(value)} className={cn("rounded-full border px-4 py-1.5 text-sm font-bold", tip === value ? "border-foreground bg-foreground text-background" : "bg-card")}>{value ? money(value) : "Sin propina"}</button>)}</div>
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto flex max-w-4xl items-center gap-3">
            <div className="min-w-0 flex-1">
              {quoting ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Calculando precio…</p>
                : quote?.ok ? <p className="text-sm"><span className="font-display text-xl font-black">{money(total)}</span><span className="ml-2 text-muted-foreground">{quote.km.toFixed(1)} km{tip ? ` · incluye ${money(tip)} de propina` : ""}</span></p>
                : reason ? <p className="text-sm font-semibold text-destructive">{reason}</p>
                : <p className="text-sm text-muted-foreground">Elegí el retiro y la entrega para ver el precio.</p>}
            </div>
            <Button type="submit" className="h-12 rounded-full px-8 text-base font-extrabold" disabled={saving || !quote?.ok}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Pedir envío</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

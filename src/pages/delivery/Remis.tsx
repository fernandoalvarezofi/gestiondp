import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarClock, Car, Loader2, MapPin, Moon, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/delivery/Common";
import { AddressSearch } from "@/components/maps/AddressSearch";
import { MapView } from "@/components/maps/LazyMaps";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import type { AddressSuggestion } from "@/lib/geo";
import { minScheduleValue, Viaje, viajeActivo, viajeEstadoLabel, ViajeQuote, validSchedule } from "@/lib/remis";
import { fetchRoute } from "@/lib/route";
import { cn } from "@/lib/utils";

type Place = { label: string; lat: number; lng: number } | null;
const PHONE = /^[0-9+()\s-]{8,25}$/;
const tips = [0, 300, 500, 1000];

/** Pedir un remís: del origen al destino, con precio cerrado antes de confirmar. Se paga en efectivo al conductor. */
export default function Remis() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [origin, setOrigin] = useState<Place>(null);
  const [dest, setDest] = useState<Place>(null);
  const [passengers, setPassengers] = useState(1);
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [tip, setTip] = useState(0);
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState("");
  const [quote, setQuote] = useState<ViajeQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<Viaje[]>([]);

  useEffect(() => {
    if (!user) return;
    db.rpc("delivery_mi_perfil").then(({ data }: { data: { telefono: string | null } | null }) => { if (data?.telefono) setPhone((current) => current || data.telefono!); });
  }, [user]);
  const loadRecent = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("delivery_viajes").select("*").eq("cliente_id", user.id).order("created_at", { ascending: false }).limit(5);
    setRecent(data || []);
  }, [user]);
  useEffect(() => { loadRecent(); }, [loadRecent]);

  const scheduled = later && validSchedule(when) ? new Date(when).toISOString() : null;
  useEffect(() => {
    if (!origin || !dest) { setQuote(null); return; }
    let active = true;
    setQuoting(true);
    const timer = window.setTimeout(async () => {
      await fetchRoute({ lat: origin.lat, lng: origin.lng }, { lat: dest.lat, lng: dest.lng }, { persist: true });
      const { data, error } = await db.rpc("delivery_cotizar_viaje", { p_olat: origin.lat, p_olng: origin.lng, p_dlat: dest.lat, p_dlng: dest.lng, p_programado: scheduled });
      if (!active) return;
      setQuoting(false);
      setQuote(error ? { ok: false, motivo: errorMessage(error) } : data);
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [origin, dest, scheduled]);

  const markers = useMemo(() => [
    ...(origin ? [{ lat: origin.lat, lng: origin.lng, kind: "home" as const, label: "Origen" }] : []),
    ...(dest ? [{ lat: dest.lat, lng: dest.lng, kind: "store" as const, label: "Destino" }] : []),
  ], [origin, dest]);
  const pick = (setter: (place: Place) => void) => (suggestion: AddressSuggestion) => setter({ label: suggestion.label, lat: suggestion.lat, lng: suggestion.lng });
  const total = quote?.ok ? quote.costo + tip : null;
  const reason = quote && !quote.ok ? (quote as { motivo: string }).motivo : null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!origin || !dest) return toast.error("Elegí el origen y el destino");
    if (!PHONE.test(phone.trim())) return toast.error("Dejanos un teléfono para que el conductor te contacte");
    if (later && !validSchedule(when)) return toast.error("Elegí una hora entre 30 minutos y 7 días desde ahora");
    if (!quote?.ok) return toast.error(reason ?? "Esperá la cotización");
    setSaving(true);
    const { data, error } = await db.rpc("delivery_crear_viaje", {
      p_origen: origin.label, p_olat: origin.lat, p_olng: origin.lng, p_destino: dest.label, p_dlat: dest.lat, p_dlng: dest.lng,
      p_pasajeros: passengers, p_notas: notes.trim() || null, p_telefono: phone.trim(), p_programado: scheduled, p_propina: tip,
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(scheduled ? "¡Viaje reservado!" : "¡Pedido enviado! Buscamos un conductor.");
    navigate(`/app/remis/${data}`);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32 pt-5 sm:px-6">
      <PageHeader eyebrow="Remises" title="Pedí un remís" />
      <p className="mt-1 text-sm text-muted-foreground">Un conductor habilitado te busca y te lleva dentro de Lincoln. Ves el precio antes de pedir y pagás en efectivo al llegar.</p>

      <form onSubmit={submit} className="mt-6 space-y-6">
        <section className="space-y-3 rounded-3xl border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-extrabold"><MapPin className="h-5 w-5 text-primary" />Origen y destino</h2>
          <div className="space-y-1.5"><Label>Dónde te buscamos</Label><AddressSearch onPick={pick(setOrigin)} placeholder="Calle y altura de origen" /></div>
          {origin && <p className="rounded-xl bg-muted p-2.5 text-sm font-semibold">{origin.label}</p>}
          <div className="space-y-1.5"><Label>A dónde vas</Label><AddressSearch onPick={pick(setDest)} placeholder="Calle y altura de destino" hideLocate /></div>
          {dest && <p className="rounded-xl bg-muted p-2.5 text-sm font-semibold">{dest.label}</p>}
          {markers.length > 0 && <MapView markers={markers} className="h-52 sm:h-60" />}
        </section>

        <section className="space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-extrabold"><Users className="h-5 w-5 text-primary" />Detalles del viaje</h2>
          <div>
            <p className="text-sm font-bold">Pasajeros</p>
            <div role="radiogroup" aria-label="Cantidad de pasajeros" className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6].map((value) => <button key={value} type="button" role="radio" aria-checked={passengers === value} onClick={() => setPassengers(value)} className={cn("h-10 w-10 rounded-full border text-sm font-bold", passengers === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{value}</button>)}
            </div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="r-phone">Tu teléfono</Label><Input id="r-phone" type="tel" inputMode="tel" value={phone} maxLength={25} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" /></div>
          <div className="space-y-1.5"><Label htmlFor="r-notes">Indicaciones para el conductor (opcional)</Label><Textarea id="r-notes" value={notes} maxLength={200} onChange={(event) => setNotes(event.target.value)} placeholder="Portón negro, equipaje, silla para bebé…" className="min-h-[64px] resize-none" /></div>
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3">
            <span className="flex items-center gap-2 text-sm font-bold"><CalendarClock className="h-5 w-5 text-primary" />Reservar para más tarde</span>
            <input type="checkbox" checked={later} onChange={(event) => setLater(event.target.checked)} className="h-5 w-5 accent-[hsl(var(--primary))]" aria-label="Reservar para más tarde" />
          </label>
          {later && <div className="space-y-1.5"><Label htmlFor="r-when">Día y hora</Label><Input id="r-when" type="datetime-local" value={when} min={minScheduleValue()} onChange={(event) => setWhen(event.target.value)} /><p className="text-xs text-muted-foreground">Con al menos 30 minutos de anticipación y hasta 7 días. El conductor se asigna 30 minutos antes.</p></div>}
          <div>
            <p className="text-sm font-bold">Propina para el conductor (opcional)</p>
            <div className="mt-2 flex flex-wrap gap-2">{tips.map((value) => <button key={value} type="button" aria-pressed={tip === value} onClick={() => setTip(value)} className={cn("rounded-full border px-4 py-1.5 text-sm font-bold", tip === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{value === 0 ? "Sin propina" : money(value)}</button>)}</div>
          </div>
        </section>

        {recent.length > 0 && (
          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="font-extrabold">Tus últimos viajes</h2>
            <ul className="mt-2 divide-y">
              {recent.map((trip) => (
                <li key={trip.id}><Link to={`/app/remis/${trip.id}`} className="flex items-center gap-3 py-2.5"><Car className="h-5 w-5 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{trip.destino_direccion}</span><span className="block text-xs text-muted-foreground">{formatDateTime(trip.created_at)} · {viajeEstadoLabel[trip.estado]}</span></span><span className={cn("text-sm font-extrabold", viajeActivo(trip.estado) && "text-primary")}>{money(trip.total)}</span></Link></li>
              ))}
            </ul>
          </section>
        )}

        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 p-3 backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              {quoting ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Calculando precio…</p>
                : quote?.ok ? <p className="text-sm"><span className="font-display text-xl font-black">{money(total)}</span><span className="ml-2 text-muted-foreground">{quote.km.toFixed(1)} km · ~{quote.minutos} min{tip ? ` · incluye ${money(tip)} de propina` : ""}</span>{quote.nocturno && <span className="ml-2 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground"><Moon className="h-3 w-3" />tarifa nocturna</span>}</p>
                : reason ? <p className="text-sm font-semibold text-destructive">{reason}</p>
                : <p className="text-sm text-muted-foreground">Elegí el origen y el destino para ver el precio.</p>}
            </div>
            <Button type="submit" className="h-12 rounded-full px-8 text-base font-extrabold" disabled={saving || !quote?.ok}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{later ? "Reservar" : "Pedir remís"}</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

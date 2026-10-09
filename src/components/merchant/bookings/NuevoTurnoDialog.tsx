import { FormEvent, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage } from "@/lib/delivery";
import { useMerchant } from "@/pages/delivery/merchant/context";
import { cap1, crearTurnoPanel, fechaLarga, fechasRepetidas, horaLocal, hoyLocal, Profesional, Servicio } from "@/services/bookings";
import { Contacto, iniciales, listarClientes } from "@/services/crm";
import { SlotPicker, slotIso, SlotValue } from "./SlotPicker";

type Prof = Profesional & { servicios: string[] };
/** Cliente elegido para un turno del panel: un contacto del CRM (con o sin cuenta) o una cuenta de Woref. */
export type ClienteTurno = { contactoId?: string | null; id?: string | null; nombre: string; telefono: string | null };
type Repetir = "no" | "semana" | "quincena" | "mes";

/**
 * Turno cargado por el local: alguien llamó, escribió o vino al mostrador. Nace confirmado.
 * El cliente se busca en el CRM (así no se duplican fichas); si es nuevo, se carga con nombre y teléfono.
 * Puede repetirse cada semana, quincena o mes: se agendan los que entran y se informa cuáles no.
 */
export function NuevoTurnoDialog({ open, onOpenChange, servicios, profesionales, inicial, cliente, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; servicios: Servicio[]; profesionales: Prof[]; inicial?: Partial<SlotValue>;
  cliente?: ClienteTurno | null; onCreated: () => void;
}) {
  const { store, access } = useMerchant();
  const puedeCrm = access.permisos.includes("estadisticas");
  const [slot, setSlot] = useState<SlotValue>({ servicio: "", profesional: "", fecha: hoyLocal(), hora: "" });
  const [elegido, setElegido] = useState<ClienteTurno | null>(null);
  const [nombre, setNombre] = useState("");
  const [sugeridos, setSugeridos] = useState<Contacto[]>([]);
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [interna, setInterna] = useState("");
  const [personas, setPersonas] = useState(1);
  const [repetir, setRepetir] = useState<Repetir>("no");
  const [veces, setVeces] = useState(4);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSlot({ servicio: "", profesional: "", fecha: hoyLocal(), hora: "", ...inicial });
    setElegido(cliente ?? null); setNombre(""); setSugeridos([]);
    setTelefono(""); setNotas(""); setInterna(""); setPersonas(1); setRepetir("no"); setVeces(4);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mientras se escribe el nombre, se buscan coincidencias en el CRM (nombre, teléfono o email).
  useEffect(() => {
    if (!open || !puedeCrm || elegido || nombre.trim().length < 2) { setSugeridos([]); return; }
    let vivo = true;
    const t = window.setTimeout(() => { listarClientes(store.id, { q: nombre }, 6).then((r) => { if (vivo) setSugeridos(r.items); }, () => undefined); }, 250);
    return () => { vivo = false; window.clearTimeout(t); };
  }, [nombre, open, puedeCrm, elegido, store.id]);

  const servicio = servicios.find((x) => x.id === slot.servicio);
  const capacidad = servicio?.capacidad ?? 1;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const inicio = slotIso(slot);
    if (!slot.servicio || !slot.profesional || !inicio) return toast.error("Elegí servicio, profesional, día y hora");
    if (!elegido && nombre.trim().length < 2) return toast.error("Elegí un cliente o escribí el nombre de la persona");
    const base = {
      servicio: slot.servicio, profesional: slot.profesional, notas, personas, notaInterna: interna,
      contacto: elegido?.contactoId ?? null, cliente: elegido?.contactoId ? null : elegido?.id ?? null,
      nombre: elegido ? undefined : nombre.trim(), telefono: elegido ? (elegido.telefono ?? undefined) : telefono,
    };
    setBusy(true);
    try {
      await crearTurnoPanel({ ...base, inicio });
      const fallidas: string[] = [];
      let ok = 0;
      if (repetir !== "no") {
        for (const fecha of fechasRepetidas(slot.fecha, repetir, veces)) {
          const iso = slotIso({ ...slot, fecha });
          if (!iso) continue;
          try { await crearTurnoPanel({ ...base, inicio: iso }); ok += 1; } catch (err) { fallidas.push(`${cap1(fechaLarga(iso))}: ${errorMessage(err)}`); }
        }
      }
      toast.success(repetir === "no" ? `Turno agendado: ${cap1(fechaLarga(inicio))} a las ${horaLocal(inicio)}` : `Agendamos ${ok + 1} turnos`);
      if (fallidas.length) toast.warning(`No entraron ${fallidas.length}: ${fallidas[0]}${fallidas.length > 1 ? "…" : ""}`, { duration: 9000 });
      onOpenChange(false); onCreated();
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogTitle className="text-xl font-extrabold">Nuevo turno</DialogTitle>
        <DialogDescription>Para quien llamó, escribió o vino al local. Queda confirmado y ocupa la agenda al instante.</DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nt-nombre">Cliente</Label>
            {elegido ? (
              <div className="flex items-center gap-3 rounded-2xl border bg-muted/40 p-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">{iniciales(elegido.nombre)}</span>
                <span className="min-w-0 flex-1"><span className="block truncate font-bold">{elegido.nombre}</span><span className="block truncate text-xs text-muted-foreground">{elegido.telefono || "Sin teléfono"}</span></span>
                {!cliente && <Button type="button" size="sm" variant="ghost" className="rounded-full" onClick={() => setElegido(null)}>Cambiar</Button>}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Input id="nt-nombre" autoComplete="off" maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder={puedeCrm ? "Buscá o escribí el nombre" : "Nombre y apellido"} />
                  {sugeridos.length > 0 && (
                    <ul className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-popover shadow-pop" aria-label="Clientes encontrados">
                      {sugeridos.map((c) => (
                        <li key={c.id}>
                          <button type="button" onClick={() => { setElegido({ contactoId: c.id, nombre: c.nombre, telefono: c.telefono }); setSugeridos([]); }} className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted">
                            <span className="font-bold">{c.nombre}</span><span className="truncate text-xs text-muted-foreground">{c.telefono ?? c.email ?? "Sin contacto"} · {c.operaciones} compras y turnos</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <Input aria-label="Teléfono" inputMode="tel" maxLength={30} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono (si es alguien nuevo)" />
              </div>
            )}
          </div>
          <SlotPicker servicios={servicios} profesionales={profesionales} value={slot} onChange={setSlot} />
          {capacidad > 1 && (
            <div className="space-y-1.5"><Label htmlFor="nt-pers">Personas (cupo {capacidad} por horario)</Label><Input id="nt-pers" type="number" min={1} max={capacidad} value={personas} onChange={(e) => setPersonas(Math.max(1, Math.min(capacidad, Number(e.target.value) || 1)))} /></div>
          )}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="nt-rep">Repetir</Label>
              <select id="nt-rep" value={repetir} onChange={(e) => setRepetir(e.target.value as Repetir)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                <option value="no">No se repite</option><option value="semana">Cada semana, a la misma hora</option><option value="quincena">Cada 2 semanas</option><option value="mes">Cada mes</option>
              </select>
            </div>
            {repetir !== "no" && <div className="space-y-1.5"><Label htmlFor="nt-veces">Cantidad</Label><Input id="nt-veces" type="number" min={2} max={12} value={veces} onChange={(e) => setVeces(Math.max(2, Math.min(12, Number(e.target.value) || 2)))} className="w-28" /></div>}
          </div>
          <div className="space-y-1.5"><Label htmlFor="nt-notas">Nota para el turno (la ve la persona si tiene cuenta)</Label><Textarea id="nt-notas" maxLength={300} value={notas} onChange={(e) => setNotas(e.target.value)} className="min-h-[56px] resize-none" /></div>
          <div className="space-y-1.5"><Label htmlFor="nt-int">Nota interna (solo el equipo)</Label><Textarea id="nt-int" maxLength={1000} value={interna} onChange={(e) => setInterna(e.target.value)} className="min-h-[56px] resize-none" /></div>
          <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}{repetir === "no" ? "Agendar turno" : `Agendar ${veces} turnos`}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

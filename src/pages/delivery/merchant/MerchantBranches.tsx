import { FormEvent, useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock3, Loader2, MapPin, Plus, Star } from "lucide-react";
import { toast } from "sonner";
import { AddressSearch } from "@/components/maps/AddressSearch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, errorMessage, money } from "@/lib/delivery";
import type { AddressSuggestion } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { useMerchant } from "./context";

type Summary = { id: string; nombre: string; direccion: string; aprobado: boolean; esta_abierto: boolean; rating: number; resenas: number; pedidos: number; ventas: number; ticket: number; pendientes: number };

/** Sucursales: todos los locales de la cuenta, con su resumen de los últimos 30 días, y alta de sucursales nuevas. */
export default function MerchantBranches() {
  const { store, switchStore, reloadBranches } = useMerchant();
  const [rows, setRows] = useState<Summary[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [place, setPlace] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [copyMenu, setCopyMenu] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.rpc("delivery_resumen_sucursales");
    setRows((data || []) as Summary[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const totals = (rows || []).reduce((acc, row) => ({ pedidos: acc.pedidos + Number(row.pedidos), ventas: acc.ventas + Number(row.ventas) }), { pedidos: 0, ventas: 0 });

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 3) return toast.error("Poné el nombre de la sucursal (ej.: «Mi Local Centro»)");
    if (!place) return toast.error("Buscá y elegí la dirección de la sucursal");
    setSaving(true);
    const { data, error } = await db.rpc("delivery_crear_sucursal", { p_origen: store.id, p_nombre: name.trim(), p_direccion: place.label, p_lat: place.lat, p_lng: place.lng, p_telefono: phone.trim() || null, p_copiar_menu: copyMenu });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("¡Sucursal creada! Queda en revisión: mientras tanto podés completar los horarios y el menú.");
    setOpen(false); setName(""); setPhone(""); setPlace(null);
    await reloadBranches();
    await load();
    switchStore(String(data));
  };

  if (!rows) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">Cada sucursal tiene su propio menú, horarios, equipo, pedidos y finanzas. Cambiás de una a otra desde el selector de arriba a la izquierda. Los clientes ven cada local por separado.</p>
        <Button className="rounded-full" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Agregar sucursal</Button>
      </div>

      {rows.length > 1 && (
        <div className="grid grid-cols-2 gap-3 rounded-3xl bg-brand-deep p-5 text-white">
          <div><p className="text-sm font-semibold text-white/70">Ventas de las {rows.length} sucursales (30 días)</p><p className="font-display text-3xl font-black">{money(totals.ventas)}</p></div>
          <div><p className="text-sm font-semibold text-white/70">Pedidos entregados</p><p className="font-display text-3xl font-black">{totals.pedidos}</p></div>
        </div>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.id} className={cn("flex flex-col rounded-3xl border bg-card p-4", row.id === store.id && "border-primary ring-1 ring-primary/30")}>
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Building2 className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1"><p className="truncate font-extrabold">{row.nombre}</p><p className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="h-3 w-3 shrink-0" />{row.direccion}</p></div>
              {row.id === store.id && <span className="shrink-0 rounded-full bg-primary px-2.5 py-0.5 text-xs font-extrabold text-primary-foreground">Estás acá</span>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
              {row.aprobado ? <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-success"><CheckCircle2 className="h-3 w-3" />Aprobada</span> : <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2.5 py-1"><Clock3 className="h-3 w-3" />En revisión</span>}
              <span className={cn("rounded-full px-2.5 py-1", row.esta_abierto ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{row.esta_abierto ? "Recibiendo pedidos" : "Cerrada"}</span>
              {Number(row.pendientes) > 0 && <span className="rounded-full bg-primary px-2.5 py-1 text-primary-foreground">{row.pendientes} pedidos nuevos</span>}
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
              <div className="rounded-2xl bg-muted/60 p-2"><dt className="text-[11px] text-muted-foreground">Pedidos</dt><dd className="font-extrabold">{row.pedidos}</dd></div>
              <div className="rounded-2xl bg-muted/60 p-2"><dt className="text-[11px] text-muted-foreground">Ventas</dt><dd className="font-extrabold">{money(row.ventas)}</dd></div>
              <div className="rounded-2xl bg-muted/60 p-2"><dt className="text-[11px] text-muted-foreground">Ticket</dt><dd className="font-extrabold">{money(row.ticket)}</dd></div>
            </dl>
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><Star className="h-3 w-3 text-warning" />{Number(row.rating) ? `${Number(row.rating).toFixed(1)} · ${row.resenas} opiniones` : "Sin opiniones todavía"}</p>
            <div className="mt-auto pt-3">{row.id !== store.id && <Button variant="outline" className="w-full rounded-full" onClick={() => switchStore(row.id)}>Abrir el panel de esta sucursal</Button>}</div>
          </li>
        ))}
      </ul>

      <Dialog open={open} onOpenChange={(next) => !saving && setOpen(next)}>
        <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
          <DialogTitle className="text-xl font-black">Agregar una sucursal</DialogTitle>
          <DialogDescription>Se crea con los datos de «{store.nombre}» (categoría, fotos, tiempos, costos y horarios) y la podés ajustar después.</DialogDescription>
          <form onSubmit={create} className="space-y-4">
            <div className="space-y-1.5"><Label htmlFor="b-name">Nombre de la sucursal</Label><Input id="b-name" value={name} maxLength={80} onChange={(event) => setName(event.target.value)} placeholder={`${store.nombre} Centro`} /></div>
            <div className="space-y-1.5"><Label>Dirección</Label><AddressSearch onPick={(suggestion: AddressSuggestion) => setPlace({ label: suggestion.label, lat: suggestion.lat, lng: suggestion.lng })} placeholder="Calle y altura de la sucursal" hideLocate />{place && <p className="rounded-xl bg-muted p-2.5 text-sm font-semibold">{place.label}</p>}</div>
            <div className="space-y-1.5"><Label htmlFor="b-phone">Teléfono (opcional)</Label><Input id="b-phone" type="tel" value={phone} maxLength={40} onChange={(event) => setPhone(event.target.value)} /></div>
            <label className="flex cursor-pointer items-start gap-3 rounded-2xl border p-3 text-sm"><Checkbox checked={copyMenu} onCheckedChange={(value) => setCopyMenu(value === true)} className="mt-0.5" /><span><span className="block font-bold">Copiar el menú de «{store.nombre}»</span><span className="block text-xs text-muted-foreground">Productos, precios, fotos, secciones y opciones. Después cada sucursal maneja su stock y sus precios por separado.</span></span></label>
            <p className="rounded-xl bg-warning/10 p-3 text-xs">La sucursal nueva tiene que ser aprobada por Woref antes de aparecer para los clientes. Empieza cerrada: abrila cuando esté lista.</p>
            <Button type="submit" className="h-12 w-full rounded-full font-extrabold" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Crear sucursal</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

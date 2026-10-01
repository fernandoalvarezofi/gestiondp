import { FormEvent, useState } from "react";
import { Loader2, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Coupon, couponValue, db, errorMessage, formatDateTime, money } from "@/lib/delivery";

/** Alta, pausa y baja de cupones. Con storeId son cupones del comercio; sin storeId, cupones globales (admin). */
export function CouponManager({ storeId, coupons, onChange }: { storeId: string | null; coupons: (Coupon & { comercio?: { nombre: string } | null })[]; onChange: () => void }) {
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<Coupon["tipo"]>("porcentaje");
  const [valor, setValor] = useState("10");
  const [tope, setTope] = useState("");
  const [minimo, setMinimo] = useState("0");
  const [usosMax, setUsosMax] = useState("");
  const [vence, setVence] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const code = codigo.trim().toUpperCase().replace(/\s+/g, "");
    if (code.length < 3) return toast.error("El código debe tener al menos 3 caracteres");
    if (tipo === "porcentaje" && (Number(valor) <= 0 || Number(valor) > 100)) return toast.error("El porcentaje va de 1 a 100");
    setSaving(true);
    const { error } = await db.from("delivery_cupones").insert({
      codigo: code,
      descripcion: descripcion.trim() || `${couponValue({ tipo, valor: Number(valor) })}`,
      tipo,
      valor: tipo === "envio_gratis" ? 0 : Number(valor),
      tope: tope ? Number(tope) : null,
      minimo: Number(minimo || 0),
      usos_max: usosMax ? Number(usosMax) : null,
      vence_at: vence ? new Date(`${vence}T23:59:59`).toISOString() : null,
      comercio_id: storeId,
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Cupón creado");
    setCodigo(""); setDescripcion(""); setTope(""); setUsosMax(""); setVence("");
    onChange();
  };

  const toggle = async (coupon: Coupon) => {
    const { error } = await db.from("delivery_cupones").update({ activo: !coupon.activo }).eq("id", coupon.id);
    if (error) return toast.error(errorMessage(error));
    onChange();
  };

  const remove = async (coupon: Coupon) => {
    if (!window.confirm(`¿Eliminar el cupón ${coupon.codigo}?`)) return;
    const { error } = await db.from("delivery_cupones").delete().eq("id", coupon.id);
    if (error) return toast.error(errorMessage(error));
    onChange();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={create} className="h-fit space-y-3 rounded-3xl border bg-card p-4 sm:p-5">
        <h3 className="font-extrabold">Crear cupón</h3>
        <div className="space-y-1.5"><Label htmlFor="c-codigo">Código</Label><Input id="c-codigo" required maxLength={30} value={codigo} onChange={(event) => setCodigo(event.target.value.toUpperCase())} placeholder="Ej.: FINDE20" className="font-mono uppercase" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="c-tipo">Tipo</Label>
          <select id="c-tipo" value={tipo} onChange={(event) => setTipo(event.target.value as Coupon["tipo"])} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            <option value="porcentaje">Porcentaje de descuento</option>
            <option value="monto">Monto fijo</option>
            <option value="envio_gratis">Envío gratis</option>
          </select>
        </div>
        {tipo !== "envio_gratis" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="c-valor">{tipo === "porcentaje" ? "Porcentaje" : "Monto ($)"}</Label><Input id="c-valor" type="number" min={1} required value={valor} onChange={(event) => setValor(event.target.value)} /></div>
            {tipo === "porcentaje" && <div className="space-y-1.5"><Label htmlFor="c-tope">Tope ($)</Label><Input id="c-tope" type="number" min={0} value={tope} onChange={(event) => setTope(event.target.value)} placeholder="Sin tope" /></div>}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="c-min">Compra mínima ($)</Label><Input id="c-min" type="number" min={0} value={minimo} onChange={(event) => setMinimo(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="c-usos">Usos máximos</Label><Input id="c-usos" type="number" min={1} value={usosMax} onChange={(event) => setUsosMax(event.target.value)} placeholder="Ilimitado" /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="c-vence">Vence el</Label><Input id="c-vence" type="date" value={vence} onChange={(event) => setVence(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="c-desc">Descripción para el cliente</Label><Input id="c-desc" maxLength={120} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Ej.: 20% OFF todo el fin de semana" /></div>
        <Button type="submit" className="w-full rounded-full" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Crear cupón</Button>
      </form>

      {coupons.length ? (
        <ul className="h-fit divide-y overflow-hidden rounded-3xl border bg-card">
          {coupons.map((coupon) => (
            <li key={coupon.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Ticket className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-mono font-bold">{coupon.codigo} <span className="ml-1 font-sans text-sm font-semibold text-primary">{couponValue(coupon)}</span></p>
                <p className="truncate text-sm text-muted-foreground">{coupon.descripcion}</p>
                <p className="text-xs text-muted-foreground">
                  {coupon.comercio?.nombre ? `${coupon.comercio.nombre} · ` : !storeId ? "Global · " : ""}
                  Usos: {coupon.usos}{coupon.usos_max ? `/${coupon.usos_max}` : ""}{Number(coupon.minimo) > 0 && ` · Mín. ${money(coupon.minimo)}`}{coupon.vence_at && ` · Vence ${formatDateTime(coupon.vence_at)}`}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">{coupon.activo ? "Activo" : "Pausado"}<Switch checked={coupon.activo} onCheckedChange={() => toggle(coupon)} /></label>
              <Button size="icon" variant="ghost" aria-label="Eliminar cupón" onClick={() => remove(coupon)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={<Ticket className="h-7 w-7" />} title="No hay cupones" text="Los cupones atraen clientes nuevos y hacen que vuelvan." />
      )}
    </div>
  );
}

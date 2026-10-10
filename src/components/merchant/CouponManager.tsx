import { FormEvent, useEffect, useState } from "react";
import { Loader2, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Coupon, couponValue, db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { confirmar } from "@/components/ui/dialogos";

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
  // Descuento automático: sin código, se aplica solo en el carrito (solo cupones de un comercio).
  const [automatico, setAutomatico] = useState(false);
  const [desde, setDesde] = useState("");
  const [alcance, setAlcance] = useState<"todo" | "secciones">("todo");
  const [secciones, setSecciones] = useState<string[]>([]);
  const [disponibles, setDisponibles] = useState<string[]>([]);
  useEffect(() => {
    if (!storeId) return;
    db.from("delivery_productos").select("categoria").eq("comercio_id", storeId).neq("estado", "archivado").then(({ data }: { data: { categoria: string }[] | null }) => setDisponibles([...new Set((data ?? []).map((x) => x.categoria).filter(Boolean))].sort()));
  }, [storeId]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    const code = automatico && storeId ? `AUTO-${Math.random().toString(36).slice(2, 8).toUpperCase()}` : codigo.trim().toUpperCase().replace(/\s+/g, "");
    if (code.length < 3) return toast.error("El código debe tener al menos 3 caracteres");
    if (automatico && !descripcion.trim()) return toast.error("Escribí cómo lo va a ver el cliente (ej.: 10% OFF en toda la tienda)");
    if (alcance === "secciones" && secciones.length === 0) return toast.error("Elegí al menos una sección");
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
      inicia_at: desde ? new Date(`${desde}T00:00:00`).toISOString() : null,
      aplica_a: alcance,
      secciones: alcance === "secciones" ? secciones : null,
      automatico: Boolean(storeId) && automatico,
      comercio_id: storeId,
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(automatico ? "Descuento automático creado: ya se aplica en el carrito" : "Cupón creado");
    setCodigo(""); setDescripcion(""); setTope(""); setUsosMax(""); setVence(""); setDesde(""); setSecciones([]); setAlcance("todo");
    onChange();
  };

  const toggle = async (coupon: Coupon) => {
    const { error } = await db.from("delivery_cupones").update({ activo: !coupon.activo }).eq("id", coupon.id);
    if (error) return toast.error(errorMessage(error));
    onChange();
  };

  const remove = async (coupon: Coupon) => {
    if (!(await confirmar({ titulo: `¿Eliminar el cupón ${coupon.codigo}?`, descripcion: "Deja de funcionar al instante. Los pedidos que ya lo usaron no cambian.", confirmar: "Eliminar", peligro: true }))) return;
    const { error } = await db.from("delivery_cupones").delete().eq("id", coupon.id);
    if (error) return toast.error(errorMessage(error));
    onChange();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <form onSubmit={create} className="h-fit space-y-3 rounded-3xl border bg-card p-4 sm:p-5">
        <h3 className="font-extrabold">{automatico ? "Crear descuento automático" : "Crear cupón"}</h3>
        {storeId && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1 text-sm font-bold" role="radiogroup" aria-label="Cómo se aplica">
            <button type="button" role="radio" aria-checked={!automatico} onClick={() => setAutomatico(false)} className={automatico ? "rounded-lg py-1.5 text-muted-foreground" : "rounded-lg bg-card py-1.5 shadow-soft"}>Con código</button>
            <button type="button" role="radio" aria-checked={automatico} onClick={() => setAutomatico(true)} className={!automatico ? "rounded-lg py-1.5 text-muted-foreground" : "rounded-lg bg-card py-1.5 shadow-soft"}>Automático</button>
          </div>
        )}
        {automatico ? <p className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">Se aplica solo en el carrito cuando se cumplen las condiciones. Si hay varios, se usa el que más descuenta; si el cliente escribe un código, se usa el código.</p>
          : <div className="space-y-1.5"><Label htmlFor="c-codigo">Código</Label><Input id="c-codigo" required maxLength={30} value={codigo} onChange={(event) => setCodigo(event.target.value.toUpperCase())} placeholder="Ej.: FINDE20" className="font-mono uppercase" /></div>}
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
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="c-desde">Desde</Label><Input id="c-desde" type="date" value={desde} onChange={(event) => setDesde(event.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="c-vence">Vence el</Label><Input id="c-vence" type="date" value={vence} onChange={(event) => setVence(event.target.value)} /></div>
        </div>
        {storeId && disponibles.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="c-alcance">Aplica a</Label>
            <select id="c-alcance" value={alcance} onChange={(event) => setAlcance(event.target.value as "todo" | "secciones")} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="todo">Toda la tienda</option>
              <option value="secciones">Solo algunas secciones</option>
            </select>
            {alcance === "secciones" && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {disponibles.map((x) => { const on = secciones.includes(x); return <button key={x} type="button" aria-pressed={on} onClick={() => setSecciones((l) => (on ? l.filter((y) => y !== x) : [...l, x]))} className={on ? "rounded-full border border-primary bg-primary/10 px-3 py-1 text-xs font-bold text-primary" : "rounded-full border px-3 py-1 text-xs font-semibold"}>{x}</button>; })}
              </div>
            )}
          </div>
        )}
        <div className="space-y-1.5"><Label htmlFor="c-desc">Descripción para el cliente</Label><Input id="c-desc" maxLength={120} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Ej.: 20% OFF todo el fin de semana" /></div>
        <Button type="submit" className="w-full rounded-full" disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{automatico ? "Crear descuento automático" : "Crear cupón"}</Button>
      </form>

      {coupons.length ? (
        <ul className="h-fit divide-y overflow-hidden rounded-3xl border bg-card">
          {coupons.map((coupon) => (
            <li key={coupon.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary"><Ticket className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-mono font-bold">{coupon.automatico ? <span className="font-sans">Automático</span> : coupon.codigo} <span className="ml-1 font-sans text-sm font-semibold text-primary">{couponValue(coupon)}</span>{coupon.aplica_a === "secciones" && <span className="ml-1 font-sans text-xs font-semibold text-muted-foreground">· {(coupon.secciones ?? []).join(", ")}</span>}</p>
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

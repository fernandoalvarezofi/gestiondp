import { useEffect, useState } from "react";
import { Banknote, HandHeart, Loader2, MessageSquareText, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage, money } from "@/lib/delivery";
import { defaultOrderPreferences, loadOrderPreferences, OrderPreferences, PagoPreferido, TIP_OPTIONS } from "@/lib/orderPreferences";
import { cn } from "@/lib/utils";

const PAYMENTS: { id: PagoPreferido; label: string; hint: string; icon: typeof Wallet }[] = [
  { id: "auto", label: "Automático", hint: "Mercado Pago si está disponible; si no, efectivo", icon: Wallet },
  { id: "mercadopago", label: "Mercado Pago", hint: "Pagás online, antes de que salga el pedido", icon: Wallet },
  { id: "efectivo", label: "Efectivo", hint: "Pagás al recibir (con vuelto)", icon: Banknote },
];

/** Preferencias que se aplican solas al armar un pedido: cómo pagar, cuánta propina dejar y cómo te gusta recibirlo. */
export function OrderPrefsSection() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<OrderPreferences | null>(null);
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadOrderPreferences(user.id).then((loaded) => { setPrefs(loaded); setInstructions(loaded.entrega_instrucciones ?? ""); });
  }, [user]);

  const save = async (patch: Partial<OrderPreferences>) => {
    if (!user || !prefs) return;
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    const { error } = await db.from("delivery_preferencias").upsert({ perfil_id: user.id, ...next, updated_at: new Date().toISOString() }, { onConflict: "perfil_id" });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); loadOrderPreferences(user.id).then(setPrefs); return; }
    toast.success("Preferencia guardada");
  };

  if (!prefs) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const current = prefs ?? defaultOrderPreferences;

  return (
    <div className="space-y-8">
      <section>
        <h3 className="flex items-center gap-2 font-extrabold"><Wallet className="h-5 w-5 text-primary" />Medio de pago preferido</h3>
        <p className="mt-1 text-sm text-muted-foreground">Es el que aparece elegido al armar tu pedido. Siempre podés cambiarlo en el momento.</p>
        <div role="radiogroup" aria-label="Medio de pago preferido" className="mt-3 grid gap-2 sm:grid-cols-3">
          {PAYMENTS.map(({ id, label, hint, icon: Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={current.pago_preferido === id} onClick={() => save({ pago_preferido: id })} className={cn("rounded-2xl border p-3 text-left transition-colors", current.pago_preferido === id ? "border-primary bg-primary/5" : "hover:bg-muted")}>
              <Icon className={cn("h-5 w-5", current.pago_preferido === id ? "text-primary" : "text-muted-foreground")} />
              <span className="mt-2 block font-bold">{label}</span>
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="flex items-center gap-2 font-extrabold"><HandHeart className="h-5 w-5 text-primary" />Propina habitual</h3>
        <p className="mt-1 text-sm text-muted-foreground">El 100% es para el repartidor. Se carga sola en el pedido y la podés cambiar.</p>
        <div role="radiogroup" aria-label="Propina habitual" className="mt-3 flex flex-wrap gap-2">
          {TIP_OPTIONS.map((value) => (
            <button key={value} type="button" role="radio" aria-checked={current.propina_default === value} onClick={() => save({ propina_default: value })} className={cn("rounded-full border px-4 py-2 text-sm font-bold", current.propina_default === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{value === 0 ? "Sin propina" : money(value)}</button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="flex items-center gap-2 font-extrabold"><MessageSquareText className="h-5 w-5 text-primary" />Cómo recibir tus pedidos</h3>
        <ul className="mt-3 divide-y rounded-2xl border">
          <li className="flex items-center gap-3 p-4">
            <span className="min-w-0 flex-1"><span className="block font-bold">Entrega sin contacto</span><span className="block text-xs text-muted-foreground">El repartidor deja el pedido en la puerta y te avisa.</span></span>
            <Switch checked={current.entrega_sin_contacto} onCheckedChange={(checked) => save({ entrega_sin_contacto: checked })} aria-label="Entrega sin contacto" />
          </li>
        </ul>
        <label htmlFor="pref-instr" className="mt-4 block text-sm font-bold">Instrucciones de entrega habituales</label>
        <Textarea id="pref-instr" value={instructions} maxLength={200} onChange={(event) => setInstructions(event.target.value)} onBlur={() => { if ((instructions.trim() || null) !== (prefs.entrega_instrucciones ?? null)) save({ entrega_instrucciones: instructions.trim() || null }); }} placeholder="Ej.: Portón negro, tocar el timbre 2B. Perro en el jardín." className="mt-2 min-h-[72px] resize-none" />
        <p className="mt-1 text-xs text-muted-foreground">Se agregan a las notas de cada pedido. {saving ? "Guardando…" : "Se guardan al salir del campo."}</p>
      </section>
    </div>
  );
}

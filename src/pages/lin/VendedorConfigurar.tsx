import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Save, ArrowLeft, ShieldCheck } from "lucide-react";
import { PAYMENT_METHOD_OPTIONS, findMethodMeta, type PayoutMethod } from "@/lib/marketplace";
import { toast } from "sonner";

export default function VendedorConfigurar() {
  const { user } = useAuth();
  const [bio, setBio] = useState("");
  const [auto, setAuto] = useState(true);
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("vendedor_perfiles").select("*").eq("id", user.id).maybeSingle();
      if (data) {
        setBio(data.bio_comercial || "");
        setAuto(data.entrega_automatica);
        setMethods(Array.isArray(data.payout_methods) ? data.payout_methods : []);
      }
    })();
  }, [user]);

  const addMethod = (id: string) => {
    const meta = findMethodMeta(id);
    setMethods((m) => [...m, { id: id as any, link: "", label: meta.label }]);
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const cleanMethods = methods.filter((m) => m.id === "coordinar" || m.link.trim().length > 0);
    const { error } = await (supabase as any).from("vendedor_perfiles").upsert({
      id: user.id,
      bio_comercial: bio,
      entrega_automatica: auto,
      payout_methods: cleanMethods,
    });
    setSaving(false);
    if (error) toast.error("Error al guardar"); else toast.success("Perfil de vendedor guardado");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="gap-1.5">
        <Link to="/lin/vendedor/productos"><ArrowLeft className="h-4 w-4" /> Mis productos</Link>
      </Button>

      <div className="mt-4">
        <h1 className="text-2xl font-bold">Configuración de vendedor</h1>
        <p className="text-sm text-muted-foreground">Definí cómo cobrás y cómo te encuentran tus compradores.</p>
      </div>

      <Card className="mt-6">
        <CardContent className="space-y-5 p-6">
          <div>
            <Label>Bio comercial</Label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Hablá de tu marca, qué vendés, tu propuesta de valor…" rows={3} className="mt-1" />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-semibold">Entrega automática</p>
              <p className="text-xs text-muted-foreground">Tras confirmar pago, el comprador recibe acceso al archivo/link automáticamente</p>
            </div>
            <Switch checked={auto} onCheckedChange={setAuto} />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Métodos de pago</h2>
              <p className="text-xs text-muted-foreground">Agregá los links donde tus compradores pueden pagarte. Cuantos más, mejor conversión.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {methods.map((m, i) => {
              const meta = findMethodMeta(m.id);
              return (
                <div key={i} className="flex items-center gap-2 rounded-lg border bg-card p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-xl">{meta.icon}</span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-semibold">{meta.label}</p>
                    {m.id !== "coordinar" && (
                      <Input
                        value={m.link}
                        placeholder={meta.placeholder}
                        onChange={(e) => setMethods((arr) => arr.map((x, j) => j === i ? { ...x, link: e.target.value } : x))}
                        className="h-8 text-sm"
                      />
                    )}
                    {m.id === "coordinar" && <p className="text-xs text-muted-foreground">El comprador será dirigido a abrir un chat con vos.</p>}
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setMethods((arr) => arr.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agregar método</p>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHOD_OPTIONS.filter((o) => !methods.find((m) => m.id === o.id)).map((o) => (
                <Button key={o.id} variant="outline" size="sm" onClick={() => addMethod(o.id)} className="gap-1.5">
                  <span>{o.icon}</span> {o.label} <Plus className="h-3 w-3" />
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 rounded-lg border bg-emerald-50 p-3 text-xs text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
        <ShieldCheck className="mb-1 inline h-3.5 w-3.5" /> Woref no toca tu dinero. Cobrás directo en tu cuenta de cada plataforma. Cero comisión, cero KYC.
      </div>

      <Button onClick={save} disabled={saving} size="lg" className="mt-6 w-full gap-1.5">
        <Save className="h-4 w-4" /> {saving ? "Guardando…" : "Guardar configuración"}
      </Button>
    </div>
  );
}

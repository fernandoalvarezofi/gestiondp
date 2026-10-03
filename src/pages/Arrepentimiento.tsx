import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Tipo = "arrepentimiento" | "baja";

const tipos: { value: Tipo; title: string; text: string }[] = [
  { value: "arrepentimiento", title: "Botón de arrepentimiento", text: "Revocar una compra (art. 34 de la Ley 24.240)." },
  { value: "baja", title: "Botón de baja", text: "Cancelar un servicio o dar de baja tu cuenta." },
];

/** Pantalla pública (Res. 424/2020): se puede usar sin cuenta y devuelve un código de seguimiento. */
export default function Arrepentimiento() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tipo, setTipo] = useState<Tipo>("arrepentimiento");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [telefono, setTelefono] = useState("");
  const [pedido, setPedido] = useState("");
  const [motivo, setMotivo] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codigo, setCodigo] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSending(true);
    const { data, error: rpcError } = await db.rpc("delivery_arrepentimiento_crear", { p_tipo: tipo, p_nombre: nombre, p_email: email, p_telefono: telefono, p_pedido: pedido, p_motivo: motivo });
    setSending(false);
    if (rpcError) { setError(errorMessage(rpcError)); return; }
    setCodigo(String(data));
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/app"))} aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>
          <Link to="/app" aria-label="Woref"><DeliveryBrand /></Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        {codigo ? (
          <div className="rounded-3xl border bg-card p-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h1 className="mt-3 text-2xl font-black">Recibimos tu solicitud</h1>
            <p className="mt-2 text-sm text-muted-foreground">Guardá este código. Te confirmamos por email en un máximo de 24 horas.</p>
            <p className="mt-4 select-all rounded-2xl bg-muted p-4 font-display text-2xl font-black tracking-wider" aria-label="Código de la solicitud">{codigo}</p>
            <Button asChild className="mt-6 rounded-full"><Link to="/app">Volver al inicio</Link></Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            <div>
              <h1 className="text-2xl font-black">Arrepentimiento y baja</h1>
              <p className="mt-1 text-sm text-muted-foreground">No hace falta tener cuenta. Completá los datos y te damos un código de seguimiento. Respondemos dentro de las 24 horas.</p>
            </div>
            <div role="radiogroup" aria-label="Qué querés hacer" className="grid gap-2 sm:grid-cols-2">
              {tipos.map((option) => (
                <button key={option.value} type="button" role="radio" aria-checked={tipo === option.value} onClick={() => setTipo(option.value)} className={cn("rounded-2xl border p-3 text-left", tipo === option.value ? "border-primary bg-primary/5" : "bg-card hover:bg-muted")}>
                  <p className="font-extrabold">{option.title}</p>
                  <p className="text-xs text-muted-foreground">{option.text}</p>
                </button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5"><Label htmlFor="arr-nombre">Nombre y apellido</Label><Input id="arr-nombre" required minLength={2} maxLength={120} autoComplete="name" value={nombre} onChange={(event) => setNombre(event.target.value)} className="h-12 rounded-xl" /></div>
              <div className="space-y-1.5"><Label htmlFor="arr-email">Email</Label><Input id="arr-email" type="email" required maxLength={160} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-12 rounded-xl" /></div>
              <div className="space-y-1.5"><Label htmlFor="arr-tel">Teléfono (opcional)</Label><Input id="arr-tel" type="tel" maxLength={40} autoComplete="tel" value={telefono} onChange={(event) => setTelefono(event.target.value)} className="h-12 rounded-xl" /></div>
              <div className="space-y-1.5"><Label htmlFor="arr-pedido">Número o fecha del pedido (opcional)</Label><Input id="arr-pedido" maxLength={60} value={pedido} onChange={(event) => setPedido(event.target.value)} className="h-12 rounded-xl" /></div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="arr-motivo">Motivo (opcional)</Label>
              <textarea id="arr-motivo" maxLength={1000} rows={4} value={motivo} onChange={(event) => setMotivo(event.target.value)} className="w-full rounded-xl border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            </div>
            {error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
            <Button type="submit" disabled={sending} className="h-12 w-full rounded-full font-extrabold">{sending && <Loader2 className="h-4 w-4 animate-spin" />}Enviar solicitud</Button>
            <p className="text-xs text-muted-foreground">Los alimentos y productos perecederos tienen excepciones legales al derecho de revocar. Igual revisamos cada caso. Si tu pedido llegó mal, también podés reportarlo desde <Link to="/app/pedidos" className="font-bold underline">Mis pedidos</Link>.</p>
          </form>
        )}
      </main>
    </div>
  );
}

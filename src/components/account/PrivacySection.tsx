import { FormEvent, useState } from "react";
import { Download, Loader2, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { db, errorMessage } from "@/lib/delivery";

const CONFIRM_WORD = "ELIMINAR";

/** Privacidad: descargar mis datos y eliminar la cuenta. */
export function PrivacySection() {
  const { user, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [word, setWord] = useState("");
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const exportData = async () => {
    setExporting(true);
    const { data, error } = await db.rpc("delivery_exportar_mis_datos");
    setExporting(false);
    if (error) return toast.error(errorMessage(error));
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `mis-datos-woref-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success("Descargamos tus datos");
  };

  const remove = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.email || word !== CONFIRM_WORD) return;
    setDeleting(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (verifyError) { setDeleting(false); return toast.error("La contraseña no es correcta"); }
    const { error } = await db.rpc("delivery_eliminar_cuenta");
    if (error) { setDeleting(false); return toast.error(errorMessage(error)); }
    toast.success("Tu cuenta fue eliminada. ¡Gracias por haber usado Woref!");
    await signOut();
  };

  return (
    <div className="space-y-8">
      <section>
        <h3 className="flex items-center gap-2 font-extrabold"><Download className="h-5 w-5 text-primary" />Descargar mis datos</h3>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">Te armamos un archivo con tu perfil, direcciones, favoritos, pedidos, envíos, opiniones y reclamos. Es tuyo: guardalo o llevalo adonde quieras.</p>
        <Button variant="outline" className="mt-3 rounded-full" onClick={exportData} disabled={exporting}>{exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Descargar mis datos (JSON)</Button>
      </section>

      <section className="rounded-3xl border border-destructive/40 bg-destructive/5 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-extrabold text-destructive"><ShieldAlert className="h-5 w-5" />Eliminar mi cuenta</h3>
        <p className="mt-1 max-w-xl text-sm text-muted-foreground">Borramos tu nombre, teléfono, direcciones, favoritos y dispositivos, y cerramos tu acceso. Tus pedidos anteriores quedan de forma anónima porque los comercios y repartidores los necesitan para sus cuentas. No se puede deshacer.</p>
        <Button variant="destructive" className="mt-3 rounded-full" onClick={() => { setOpen(true); setWord(""); setPassword(""); }}><Trash2 className="h-4 w-4" />Eliminar mi cuenta</Button>
      </section>

      <Dialog open={open} onOpenChange={(next) => !deleting && setOpen(next)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-xl font-black">¿Eliminar tu cuenta?</DialogTitle>
          <DialogDescription>Esta acción es definitiva. Para confirmar, escribí <span className="font-bold text-foreground">{CONFIRM_WORD}</span> e ingresá tu contraseña.</DialogDescription>
          <form onSubmit={remove} className="space-y-3">
            <Input value={word} onChange={(event) => setWord(event.target.value)} placeholder={CONFIRM_WORD} aria-label="Escribí ELIMINAR para confirmar" autoComplete="off" />
            <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tu contraseña" aria-label="Contraseña" autoComplete="current-password" maxLength={128} />
            <Button type="submit" variant="destructive" className="w-full rounded-full" disabled={deleting || word !== CONFIRM_WORD || !password}>{deleting && <Loader2 className="h-4 w-4 animate-spin" />}Eliminar definitivamente</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

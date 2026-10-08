import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { errorMessage } from "@/lib/delivery";
import { iniciarConsulta, MAX_MENSAJE, mensajeValido } from "@/services/messaging";

/** "Escribir al vendedor": abre una consulta privada con el local (sin cuenta pide ingresar primero). */
export function AskSeller({ storeId, storeName, productId, productName, className, label = "Escribir al vendedor" }: { storeId: string; storeName: string; productId?: string; productName?: string; className?: string; label?: string }) {
  const { session } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const abrir = () => {
    if (!session) { navigate(`/auth?next=${encodeURIComponent(location.pathname)}`); return; }
    setOpen(true);
  };
  const enviar = async () => {
    if (!mensajeValido(texto) || enviando) return;
    setEnviando(true);
    try { const id = await iniciarConsulta(storeId, texto, productId); setOpen(false); setTexto(""); toast.success("Mensaje enviado"); navigate(`/app/mensajes?h=${id}`); }
    catch (error) { toast.error(errorMessage(error)); } finally { setEnviando(false); }
  };

  return (
    <>
      <Button type="button" variant="outline" className={className ?? "w-full rounded-full font-bold"} onClick={abrir}><MessageCircle className="h-4 w-4" />{label}</Button>
      <Dialog open={open} onOpenChange={(v) => !enviando && setOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-extrabold">Escribile a {storeName}</DialogTitle>
          <DialogDescription>{productName ? `Tu consulta sobre “${productName}” es privada: solo la ve el local.` : "Tu consulta es privada: solo la ve el local."} Te avisamos cuando responda.</DialogDescription>
          <Textarea aria-label="Tu mensaje" placeholder="Escribí tu consulta…" value={texto} maxLength={MAX_MENSAJE} onChange={(e) => setTexto(e.target.value)} className="min-h-[110px] resize-none" autoFocus />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs tabular-nums text-muted-foreground">{texto.length}/{MAX_MENSAJE}</span>
            <div className="flex gap-2"><Button variant="ghost" className="rounded-full" disabled={enviando} onClick={() => setOpen(false)}>Cancelar</Button><Button className="rounded-full" disabled={!mensajeValido(texto) || enviando} onClick={enviar}>{enviando && <Loader2 className="h-4 w-4 animate-spin" />}Enviar</Button></div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

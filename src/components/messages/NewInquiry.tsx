import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Search, SquarePen, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage } from "@/lib/delivery";
import { iniciarConsulta, MAX_MENSAJE, mensajeValido } from "@/services/messaging";

type Local = { id: string; nombre: string; slug: string; logo_url: string | null; rubro: string | null };

/**
 * "Nueva consulta" desde Mensajes: elegís un local y le escribís (preguntar por un producto, stock, horarios…).
 * Solo se puede escribir a locales activos; el local responde desde su panel.
 */
export function NewInquiry({ onCreated, className }: { onCreated?: () => void; className?: string }) {
  const [, setParams] = useSearchParams();
  const [open, setOpen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [locales, setLocales] = useState<Local[] | null>(null);
  const [elegido, setElegido] = useState<Local | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!open || elegido) return;
    let active = true;
    const t = window.setTimeout(async () => {
      let q = db.from("delivery_comercios").select("id,nombre,slug,logo_url,rubro").eq("activo", true).eq("aprobado", true).order("nombre").limit(30);
      const termino = busqueda.trim().replace(/[%_,()]/g, " ");
      if (termino) q = q.ilike("nombre", `%${termino}%`);
      const { data } = await q;
      if (active) setLocales((data ?? []) as Local[]);
    }, 250);
    return () => { active = false; window.clearTimeout(t); };
  }, [open, busqueda, elegido]);

  const cerrar = (v: boolean) => { if (enviando) return; setOpen(v); if (!v) { setElegido(null); setTexto(""); setBusqueda(""); } };
  const enviar = async () => {
    if (!elegido || !mensajeValido(texto) || enviando) return;
    setEnviando(true);
    try {
      const id = await iniciarConsulta(elegido.id, texto);
      toast.success(`Mensaje enviado a ${elegido.nombre}`);
      setOpen(false); setElegido(null); setTexto("");
      onCreated?.();
      setParams({ h: id });
    } catch (error) { toast.error(errorMessage(error)); } finally { setEnviando(false); }
  };

  return (
    <>
      <Button type="button" className={className ?? "rounded-full"} onClick={() => setOpen(true)}><SquarePen className="h-4 w-4" />Nueva consulta</Button>
      <Dialog open={open} onOpenChange={cerrar}>
        <DialogContent className="flex max-h-[85vh] max-w-md flex-col gap-3">
          <DialogTitle className="text-xl font-extrabold">{elegido ? `Escribile a ${elegido.nombre}` : "¿A qué local le querés escribir?"}</DialogTitle>
          <DialogDescription>{elegido ? "Tu consulta es privada: solo la ve el local. Te avisamos cuando responda." : "Buscá el local y preguntale lo que necesites: productos, stock, horarios o un pedido especial."}</DialogDescription>
          {elegido ? (
            <>
              <button type="button" onClick={() => setElegido(null)} className="flex items-center gap-1 self-start text-sm font-bold text-primary"><ArrowLeft className="h-4 w-4" />Elegir otro local</button>
              <Textarea aria-label="Tu mensaje" placeholder="Escribí tu consulta…" value={texto} maxLength={MAX_MENSAJE} onChange={(e) => setTexto(e.target.value)} className="min-h-[120px] resize-none" autoFocus />
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs tabular-nums text-muted-foreground">{texto.length}/{MAX_MENSAJE}</span>
                <Button className="rounded-full" disabled={!mensajeValido(texto) || enviando} onClick={enviar}>{enviando && <Loader2 className="h-4 w-4 animate-spin" />}Enviar</Button>
              </div>
            </>
          ) : (
            <>
              <label className="flex h-11 items-center gap-2 rounded-full border bg-background px-3 text-sm focus-within:border-primary">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar local" aria-label="Buscar local" className="min-w-0 flex-1 bg-transparent outline-none" autoFocus />
              </label>
              <ul className="min-h-0 flex-1 divide-y overflow-y-auto rounded-2xl border">
                {!locales && <li className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></li>}
                {locales?.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No encontramos locales con ese nombre.</li>}
                {locales?.map((l) => (
                  <li key={l.id}>
                    <button type="button" onClick={() => setElegido(l)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/60">
                      {l.logo_url ? <img src={l.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Store className="h-5 w-5" /></span>}
                      <span className="min-w-0"><span className="block truncate font-bold">{l.nombre}</span>{l.rubro && <span className="block truncate text-xs text-muted-foreground">{l.rubro}</span>}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

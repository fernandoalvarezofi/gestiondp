import { FormEvent, useCallback, useEffect, useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, errorMessage } from "@/lib/delivery";
import { supabase } from "@/integrations/supabase/client";

type Resumen = {
  nombre: string; modo: "eliminar" | "baja"; pedidos: number; pedidos_activos: number; turnos: number; turnos_futuros: number;
  sin_liquidar: number; productos: number; sucursales: number; bloqueos: string[];
};
export type ResultadoEliminacion = { resultado: "eliminada" | "baja"; nombre: string; archivos?: string[] };

/**
 * Eliminar una tienda. Primero muestra qué va a pasar con ESTA tienda (se borra del todo si no tiene historial; si tiene pedidos
 * o turnos se da de baja y el historial se conserva) y qué la bloquea. Para confirmar hay que escribir el nombre exacto.
 * El servidor vuelve a validar todo: permisos (solo el dueño o administración), bloqueos y confirmación.
 */
export function DeleteStorePanel({ storeId, onDone }: { storeId: string; onDone: (r: ResultadoEliminacion) => void }) {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    const { data, error: falla } = await db.rpc("delivery_tienda_eliminacion_resumen", { p_comercio: storeId });
    if (falla) { setError(new Error(errorMessage(falla))); return; }
    setResumen(data as Resumen);
  }, [storeId]);
  useEffect(() => { cargar(); }, [cargar]);

  if (error) return <ErrorState title="No pudimos revisar la tienda" error={error} onRetry={cargar} />;
  if (!resumen) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const coincide = texto.trim().toLowerCase() === resumen.nombre.trim().toLowerCase();
  const bloqueada = resumen.bloqueos.length > 0;
  const borrar = resumen.modo === "eliminar";

  const enviar = async (event: FormEvent) => {
    event.preventDefault();
    if (!coincide || bloqueada || enviando) return;
    setEnviando(true);
    const { data, error: falla } = await db.rpc("delivery_eliminar_tienda", { p_comercio: storeId, p_confirmacion: texto });
    setEnviando(false);
    if (falla) { toast.error(errorMessage(falla)); cargar(); return; }
    const r = data as ResultadoEliminacion;
    // Fotos que eran solo de esta tienda: se borran del almacenamiento (la base no puede hacerlo). Si alguna no se puede
    // (p. ej. la subió otra persona del equipo), queda guardada sin afectar nada.
    if (r.archivos?.length) await supabase.storage.from("delivery").remove(r.archivos).catch(() => undefined);
    toast.success(r.resultado === "eliminada" ? `Eliminaste “${r.nombre}”` : `Diste de baja “${r.nombre}”`);
    onDone(r);
  };

  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.04] p-4">
        <p className="flex items-center gap-2 font-extrabold text-destructive"><AlertTriangle className="h-5 w-5" />{borrar ? "Se va a eliminar del todo" : "Se va a dar de baja"}</p>
        {borrar ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>Se borran la tienda, sus {resumen.productos} {resumen.productos === 1 ? "producto" : "productos"}, el diseño de la tienda online, cupones, colecciones y servicios.</li>
            <li>No tiene pedidos ni turnos, así que no se pierde ningún registro de ventas.</li>
            <li>No se puede deshacer.</li>
          </ul>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            <li>Deja de aparecer para los clientes al instante y sale de tu panel.</li>
            <li>Sus {resumen.productos} {resumen.productos === 1 ? "producto pasa" : "productos pasan"} a archivados y se libera su dirección web.</li>
            <li>Como tiene historial ({resumen.pedidos} {resumen.pedidos === 1 ? "pedido" : "pedidos"}{resumen.turnos ? ` y ${resumen.turnos} ${resumen.turnos === 1 ? "turno" : "turnos"}` : ""}), las ventas, liquidaciones y facturación se conservan.</li>
            <li>Si te arrepentís, administración puede restaurarla.</li>
          </ul>
        )}
        {resumen.sucursales > 0 && <p className="mt-2 text-sm text-muted-foreground">Sus {resumen.sucursales} {resumen.sucursales === 1 ? "sucursal sigue" : "sucursales siguen"} funcionando por separado.</p>}
      </div>

      {bloqueada ? (
        <div role="alert" className="rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <p className="font-bold">Antes de continuar:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">{resumen.bloqueos.map((b) => <li key={b}>{b}</li>)}</ul>
        </div>
      ) : (
        <form onSubmit={enviar} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="confirmar-nombre">Para confirmar, escribí <span className="font-extrabold">{resumen.nombre}</span></Label>
            <Input id="confirmar-nombre" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off" spellCheck={false} maxLength={120} />
          </div>
          <Button type="submit" variant="destructive" className="rounded-full" disabled={!coincide || enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{borrar ? "Eliminar tienda" : "Dar de baja la tienda"}
          </Button>
        </form>
      )}
    </div>
  );
}

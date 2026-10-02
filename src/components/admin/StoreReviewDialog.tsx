import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { vatLabel, StoreLegal } from "@/components/merchant/StoreVerification";
import { DocumentViewer } from "@/components/verification/DocumentViewer";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { db, DeliveryStore } from "@/lib/delivery";
import { formatCuit } from "@/lib/verification";

/** Para administración: datos legales y documentos de un comercio antes de aprobarlo. */
export function StoreReviewDialog({ store, onClose }: { store: DeliveryStore | null; onClose: () => void }) {
  const [legal, setLegal] = useState<(StoreLegal & { cuit: string }) | null | undefined>(undefined);

  useEffect(() => {
    if (!store) return;
    let active = true;
    setLegal(undefined);
    db.from("delivery_comercio_legal").select("razon_social,cuit,condicion_iva").eq("comercio_id", store.id).maybeSingle().then(({ data }: { data: (StoreLegal & { cuit: string }) | null }) => { if (active) setLegal(data); });
    return () => { active = false; };
  }, [store]);

  return (
    <Dialog open={Boolean(store)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogTitle className="text-xl font-black">Verificación de {store?.nombre}</DialogTitle>
        <DialogDescription>{store?.direccion}{store?.telefono && ` · ${store.telefono}`}</DialogDescription>
        {legal === undefined ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : legal ? (
          <dl className="grid gap-2 rounded-2xl border bg-muted/40 p-4 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Razón social</dt><dd className="font-bold">{legal.razon_social}</dd></div>
            <div><dt className="text-muted-foreground">CUIT</dt><dd className="font-bold">{formatCuit(legal.cuit)}</dd></div>
            <div><dt className="text-muted-foreground">IVA</dt><dd className="font-bold">{vatLabel[legal.condicion_iva]}</dd></div>
          </dl>
        ) : <p className="rounded-xl bg-warning/15 p-3 text-sm font-semibold">Todavía no cargó el CUIT ni la razón social: no se puede aprobar.</p>}
        {store && <DocumentViewer entidad="comercio" entidadId={store.id} />}
      </DialogContent>
    </Dialog>
  );
}

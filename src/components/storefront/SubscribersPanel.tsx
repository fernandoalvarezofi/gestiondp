import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "@/lib/csv";
import { db, errorMessage } from "@/lib/delivery";

type Suscriptor = { id: string; email: string; creado_at: string };

/** Emails que dejaron los clientes en el bloque de suscripción de la tienda. Solo los ve quien gestiona la tienda. */
export function SubscribersPanel({ storeId, storeSlug }: { storeId: string; storeSlug: string }) {
  const [lista, setLista] = useState<Suscriptor[] | null>(null);
  const [total, setTotal] = useState(0);

  const cargar = useCallback(async () => {
    const { data, count } = await db.from("delivery_tienda_suscriptores").select("id, email, creado_at", { count: "exact" }).eq("comercio_id", storeId).order("creado_at", { ascending: false }).limit(1000);
    setLista((data || []) as Suscriptor[]);
    setTotal(count ?? (data || []).length);
  }, [storeId]);
  useEffect(() => { cargar(); }, [cargar]);

  const quitar = async (item: Suscriptor) => {
    const { error } = await db.from("delivery_tienda_suscriptores").delete().eq("id", item.id);
    if (error) { toast.error(errorMessage(error)); return; }
    cargar();
  };
  const descargar = () => downloadCsv(`suscriptores-${storeSlug}.csv`, toCsv(["Email", "Fecha de alta"], (lista || []).map((s) => [s.email, new Date(s.creado_at).toLocaleDateString("es-AR")])));

  return (
    <section className="rounded-3xl border bg-card p-4 sm:p-5 lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold">Suscriptores</h3>
          <p className="mt-1 text-sm text-muted-foreground">Emails de clientes que quieren recibir tus novedades. Agregá el bloque “Suscripción por email” en tu tienda para juntarlos.</p>
        </div>
        <Button type="button" variant="outline" className="rounded-full" onClick={descargar} disabled={!lista || lista.length === 0}><Download className="h-4 w-4" />Descargar planilla</Button>
      </div>
      {!lista ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        : lista.length === 0 ? <p className="mt-4 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Todavía no hay suscriptores.</p>
        : (
          <>
            <p className="mt-4 text-sm font-bold">{total} {total === 1 ? "suscriptor" : "suscriptores"}</p>
            <ul className="mt-2 max-h-64 divide-y overflow-y-auto rounded-2xl border">
              {lista.slice(0, 100).map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{s.email}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{new Date(s.creado_at).toLocaleDateString("es-AR")}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={`Quitar ${s.email}`} onClick={() => quitar(s)}><Trash2 className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          </>
        )}
    </section>
  );
}

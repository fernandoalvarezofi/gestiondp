import { useCallback, useEffect, useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarPicker } from "@/components/market/Stars";
import { img, errorMessage } from "@/lib/delivery";
import { crearOpinion, fetchProductosSinOpinar, ProductoSinOpinar } from "@/services/reviews";

/** "Contanos qué te pareció": productos entregados de un pedido que todavía no se calificaron. */
export function RateProducts({ orderId }: { orderId: string }) {
  const [items, setItems] = useState<ProductoSinOpinar[]>([]);
  const load = useCallback(async () => { setItems(await fetchProductosSinOpinar(orderId)); }, [orderId]);
  useEffect(() => { load(); }, [load]);
  if (items.length === 0) return null;
  return (
    <section className="mt-4 rounded-3xl border border-primary/30 bg-primary/5 p-4 sm:p-5" aria-label="Calificá tus productos">
      <h2 className="flex items-center gap-2 text-lg font-extrabold"><Star className="h-5 w-5 text-primary" />Calificá lo que compraste</h2>
      <p className="text-sm text-muted-foreground">Tu opinión ayuda a otros a elegir. Se muestra como “Compra verificada”.</p>
      <ul className="mt-3 space-y-3">{items.map((item) => <Row key={item.item_id} item={item} onDone={load} />)}</ul>
    </section>
  );
}

function Row({ item, onDone }: { item: ProductoSinOpinar; onDone: () => void }) {
  const [puntaje, setPuntaje] = useState(0);
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);
  const send = async () => {
    setSaving(true);
    try { await crearOpinion(item.item_id, puntaje, comentario); toast.success("¡Gracias por tu opinión!"); onDone(); } catch (error) { toast.error(errorMessage(error)); } finally { setSaving(false); }
  };
  return (
    <li className="rounded-2xl border bg-card p-3">
      <div className="flex items-center gap-3">
        <img src={img(item.imagen_url, 120)} alt="" loading="lazy" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1"><p className="truncate font-bold">{item.nombre}</p><StarPicker value={puntaje} onChange={setPuntaje} label={`Puntaje para ${item.nombre}`} /></div>
      </div>
      {puntaje > 0 && (
        <div className="mt-3 space-y-2">
          <Textarea aria-label={`Comentario sobre ${item.nombre}`} value={comentario} maxLength={500} onChange={(event) => setComentario(event.target.value)} placeholder="Contá cómo te fue con el producto (opcional)" className="min-h-[64px] resize-none" />
          <Button className="rounded-full" size="sm" onClick={send} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Publicar opinión</Button>
        </div>
      )}
    </li>
  );
}

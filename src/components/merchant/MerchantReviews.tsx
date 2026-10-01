import { useState } from "react";
import { MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export type StoreReview = { id: string; puntaje: number; comentario?: string | null; respuesta?: string | null; created_at: string; cliente?: { nombre: string } | null };

export function MerchantReviews({ reviews, onChange }: { reviews: StoreReview[]; onChange: () => void }) {
  if (!reviews.length) return <EmptyState icon={<MessageSquare className="h-7 w-7" />} title="Todavía no tenés opiniones" text="Cuando tus clientes califiquen sus pedidos, las vas a ver y responder acá." />;
  const average = reviews.reduce((total, review) => total + review.puntaje, 0) / reviews.length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 rounded-3xl border bg-card p-4 sm:p-5">
        <div><p className="font-display text-4xl font-extrabold">{average.toFixed(1)}</p><p className="text-sm text-muted-foreground">{reviews.length} opiniones recientes</p></div>
        <div className="min-w-[200px] flex-1 space-y-1">
          {[5, 4, 3, 2, 1].map((score) => {
            const count = reviews.filter((review) => review.puntaje === score).length;
            return <div key={score} className="flex items-center gap-2 text-xs"><span className="w-3 tabular-nums">{score}</span><Star className="h-3 w-3 fill-warning text-warning" /><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-warning" style={{ width: `${(count / reviews.length) * 100}%` }} /></div><span className="w-6 text-right tabular-nums text-muted-foreground">{count}</span></div>;
          })}
        </div>
      </div>
      {reviews.map((review) => <ReviewItem key={review.id} review={review} onChange={onChange} />)}
    </div>
  );
}

function ReviewItem({ review, onChange }: { review: StoreReview; onChange: () => void }) {
  const [reply, setReply] = useState(review.respuesta || "");
  const [editing, setEditing] = useState(false);
  const save = async () => {
    const { error } = await db.rpc("delivery_responder_resena", { p_resena: review.id, p_respuesta: reply });
    if (error) return toast.error(errorMessage(error));
    toast.success("Respuesta publicada");
    setEditing(false);
    onChange();
  };
  return (
    <article className="rounded-3xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold">{review.cliente?.nombre || "Cliente"}</p>
        <span className="flex gap-0.5">{[1, 2, 3, 4, 5].map((value) => <Star key={value} className={cn("h-4 w-4", value <= review.puntaje ? "fill-warning text-warning" : "text-muted")} />)}</span>
      </div>
      <p className="text-xs text-muted-foreground">{formatDateTime(review.created_at)}</p>
      {review.comentario && <p className="mt-2 text-sm">{review.comentario}</p>}
      {review.respuesta && !editing ? (
        <div className="mt-3 rounded-xl bg-muted p-3 text-sm"><span className="font-bold">Tu respuesta: </span>{review.respuesta}<button type="button" className="ml-2 font-bold text-primary" onClick={() => setEditing(true)}>Editar</button></div>
      ) : editing || !review.respuesta ? (
        editing ? (
          <div className="mt-3 space-y-2">
            <Textarea value={reply} maxLength={500} onChange={(event) => setReply(event.target.value)} placeholder="Agradecé o contá cómo lo vas a mejorar" className="min-h-[64px]" />
            <div className="flex gap-2"><Button size="sm" className="rounded-full" onClick={save}>Publicar</Button><Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button></div>
          </div>
        ) : <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => setEditing(true)}><MessageSquare className="h-4 w-4" />Responder</Button>
      ) : null}
    </article>
  );
}

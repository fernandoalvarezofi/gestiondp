import { FormEvent, useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Loader2, MessageCircleQuestion, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage } from "@/lib/delivery";
import type { Pregunta } from "@/lib/marketplace";

const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

/** Preguntas y respuestas de un producto: cualquiera las lee, quien tiene sesión pregunta y el vendedor responde. */
export function ProductQuestions({ productId, disabled }: { productId: string; disabled?: boolean }) {
  const { user } = useAuth();
  const location = useLocation();
  const [items, setItems] = useState<Pregunta[] | null>(null);
  const [mine, setMine] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [all, setAll] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_producto_preguntas").select("id,producto_id,pregunta,respuesta,respondida_at,created_at").eq("producto_id", productId).order("created_at", { ascending: false }).limit(60);
    setItems((data ?? []) as Pregunta[]);
  }, [productId]);
  useEffect(() => { setItems(null); load(); }, [load]);

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (text.trim().length < 5) { toast.error("Escribí tu pregunta (mínimo 5 letras)"); return; }
    setSending(true);
    const { data, error } = await db.rpc("delivery_preguntar", { p_producto: productId, p_texto: text });
    setSending(false);
    if (error) { toast.error(errorMessage(error)); return; }
    if (typeof data === "string") setMine((current) => new Set(current).add(data));
    setText("");
    toast.success("Enviamos tu pregunta. El vendedor te responde acá mismo.");
    await load();
  };
  const remove = async (id: string) => {
    const { error } = await db.rpc("delivery_borrar_mi_pregunta", { p_id: id });
    if (error) { toast.error(errorMessage(error)); return; }
    await load();
  };

  const answered = (items ?? []).filter((item) => item.respuesta);
  const pending = (items ?? []).filter((item) => !item.respuesta && mine.has(item.id));
  const shown = all ? answered : answered.slice(0, 4);

  return (
    <section aria-labelledby="preguntas-titulo">
      <h2 id="preguntas-titulo" className="text-xl font-extrabold sm:text-2xl">Preguntas y respuestas</h2>

      {disabled ? (
        <p className="mt-4 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Este comercio todavía no recibe preguntas.</p>
      ) : user ? (
        <form onSubmit={ask} className="mt-4">
          <label htmlFor="pregunta" className="mb-1.5 block text-sm font-semibold">Preguntale al vendedor</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="pregunta" value={text} onChange={(event) => setText(event.target.value)} maxLength={300} placeholder="Escribí tu pregunta…" className="h-11 min-w-0 flex-1 border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-[color:var(--sf-accent,hsl(var(--primary)))]" style={{ borderRadius: "var(--sf-radius, 0.75rem)" }} />
            <button type="submit" disabled={sending} className="inline-flex h-11 items-center justify-center gap-2 px-6 text-sm font-bold disabled:opacity-60" style={{ background: "var(--sf-accent)", color: "var(--sf-on-accent)", borderRadius: "var(--sf-radius, 0.75rem)" }}>{sending && <Loader2 className="h-4 w-4 animate-spin" />}Preguntar</button>
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">Preguntá sobre el producto. Por seguridad no se pueden incluir enlaces, mails ni teléfonos.</p>
        </form>
      ) : (
        <p className="mt-4 rounded-2xl bg-muted p-4 text-sm">
          <Link to={`/auth?next=${encodeURIComponent(location.pathname)}`} className="font-bold underline underline-offset-4">Ingresá</Link> o <Link to={`/auth?registro=1&next=${encodeURIComponent(location.pathname)}`} className="font-bold underline underline-offset-4">creá tu cuenta</Link> para hacerle una pregunta al vendedor.
        </p>
      )}

      {pending.length > 0 && (
        <ul className="mt-4 space-y-2">
          {pending.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded-2xl border border-dashed p-3 text-sm">
              <MessageCircleQuestion className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1"><p className="font-semibold">{item.pregunta}</p><p className="text-xs text-muted-foreground">Esperando respuesta del vendedor…</p></div>
              <button type="button" aria-label="Borrar mi pregunta" onClick={() => remove(item.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        {items === null && <div className="h-20 animate-pulse rounded-2xl bg-muted" />}
        {items !== null && answered.length === 0 && <p className="text-sm text-muted-foreground">Todavía no hay preguntas respondidas. ¡Sé el primero en preguntar!</p>}
        <ul className="space-y-4">
          {shown.map((item) => (
            <li key={item.id}>
              <p className="font-semibold">{item.pregunta}</p>
              <p className="mt-1 flex gap-2 text-sm text-muted-foreground"><span aria-hidden className="select-none">↳</span><span>{item.respuesta} <span className="whitespace-nowrap text-xs opacity-70">· Respondió el vendedor{item.respondida_at ? ` el ${fecha(item.respondida_at)}` : ""}</span></span></p>
            </li>
          ))}
        </ul>
        {answered.length > 4 && !all && <button type="button" onClick={() => setAll(true)} className="mt-4 text-sm font-bold underline underline-offset-4">Ver las {answered.length} preguntas</button>}
      </div>
    </section>
  );
}

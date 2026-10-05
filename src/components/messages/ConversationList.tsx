import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { hace } from "@/services/notifications";

export type FilaConversacion = { id: string; titulo: string; subtitulo: string | null; ultimo_texto: string | null; ultimo_mensaje_at: string; sin_leer: boolean; avatar?: ReactNode };

/** Lista de conversaciones: la seleccionada resaltada y un punto en las que tienen mensajes sin leer. */
export function ConversationList({ filas, activa, onSelect }: { filas: FilaConversacion[]; activa: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className="divide-y" aria-label="Conversaciones">
      {filas.map((f) => (
        <li key={f.id}>
          <button type="button" onClick={() => onSelect(f.id)} aria-current={activa === f.id} className={cn("flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", activa === f.id && "bg-muted")}>
            {f.avatar}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2"><span className={cn("truncate", f.sin_leer ? "font-extrabold" : "font-semibold")}>{f.titulo}</span><span className="shrink-0 text-xs text-muted-foreground">{hace(f.ultimo_mensaje_at)}</span></span>
              {f.subtitulo && <span className="block truncate text-xs font-semibold text-primary">{f.subtitulo}</span>}
              <span className={cn("block truncate text-sm", f.sin_leer ? "text-foreground" : "text-muted-foreground")}>{f.ultimo_texto ?? "Sin mensajes"}</span>
            </span>
            {f.sin_leer && <span aria-label="Sin leer" className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}
          </button>
        </li>
      ))}
    </ul>
  );
}

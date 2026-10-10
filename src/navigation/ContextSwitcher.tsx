import { Link, useLocation, useNavigate } from "react-router-dom";
import { Check, ChevronRight, Plus } from "lucide-react";
import { DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { cn } from "@/lib/utils";
import { contextFromPath, contextsFor } from "./contexts";
import { tono, tonoDe, TONO_CONTEXTO } from "@/lib/tonos";

/**
 * Opciones de "cambiar de contexto" para cualquier menú desplegable (cabecera del cliente y de los paneles).
 * Es el único lugar que decide qué contextos ve cada cuenta: la sesión se mantiene, solo cambia la navegación.
 */
export function ContextMenuItems() {
  const roles = useDeliveryRoles();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const current = contextFromPath(pathname);
  const { available, joinable } = contextsFor(roles);

  return (
    <>
      <DropdownMenuLabel className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">Cambiar de contexto</DropdownMenuLabel>
      {available.map((ctx) => (
        <DropdownMenuItem key={ctx.id} onClick={() => ctx.id !== current && navigate(ctx.base)} className="gap-2.5">
          <ctx.icon className="h-4 w-4" />
          <span className="min-w-0 flex-1"><span className="block font-semibold">{ctx.label}</span><span className="block text-[11px] text-muted-foreground">{ctx.description}</span></span>
          {ctx.id === current && <Check className="h-4 w-4 text-primary" aria-label="Contexto actual" />}
        </DropdownMenuItem>
      ))}
      {!roles.loading && joinable.length > 0 && (
        <>
          <DropdownMenuSeparator />
          {joinable.map((ctx) => (
            <DropdownMenuItem key={ctx.id} onClick={() => navigate(ctx.base)} className="gap-2.5 text-muted-foreground">
              <Plus className="h-4 w-4" /><span>{ctx.join!.label}</span>
            </DropdownMenuItem>
          ))}
        </>
      )}
    </>
  );
}

/** Tarjeta "Contexto actual" para Mi cuenta: muestra los contextos de la cuenta y cómo sumarse a otros. */
export function ContextSwitcherCard({ className }: { className?: string }) {
  const roles = useDeliveryRoles();
  const { pathname } = useLocation();
  const current = contextFromPath(pathname);
  const { available, joinable } = contextsFor(roles);

  return (
    <section className={cn("rounded-3xl border bg-card p-4 sm:p-5", className)} aria-labelledby="contextos-titulo">
      <h3 id="contextos-titulo" className="font-extrabold">Tus perfiles en Woref</h3>
      <p className="text-sm text-muted-foreground">Cada uno tiene su propio panel. Cambiá cuando quieras sin cerrar sesión.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {available.map((ctx) => (
          <li key={ctx.id}>
            <Link to={ctx.base} aria-current={ctx.id === current ? "page" : undefined} className={cn("flex items-center gap-3 rounded-2xl border p-3 transition-colors hover:bg-muted", ctx.id === current && "border-primary/40 bg-primary/5")}>
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tono(TONO_CONTEXTO[ctx.id] ?? tonoDe(ctx.id)))}><ctx.icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold">{ctx.label}</span><span className="block truncate text-xs text-muted-foreground">{ctx.id === current ? "Estás acá" : ctx.description}</span></span>
              {ctx.id === current ? <Check className="h-4 w-4 text-primary" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            </Link>
          </li>
        ))}
        {!roles.loading && joinable.map((ctx) => (
          <li key={ctx.id}>
            <Link to={ctx.base} className="flex items-center gap-3 rounded-2xl border border-dashed p-3 transition-colors hover:bg-muted">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><ctx.icon className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block font-bold">{ctx.join!.label}</span><span className="block truncate text-xs text-muted-foreground">{ctx.join!.description}</span></span>
              <Plus className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

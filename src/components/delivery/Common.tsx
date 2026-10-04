import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { isRootPath, pageTitle, useGoBack } from "@/lib/navigation";
import { cn } from "@/lib/utils";

/** Botón "Volver" y título de la pantalla actual; no aparece en las pantallas principales. */
export function BackBar({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const goBack = useGoBack();
  if (isRootPath(pathname)) return null;
  const title = pageTitle(pathname) || (/^\/app\/perfil\//.test(pathname) ? "Mi cuenta" : "");
  return (
    <div className={cn("border-b bg-card/95 backdrop-blur-xl", className)}>
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-2 sm:px-5 lg:px-7">
        <button type="button" onClick={goBack} aria-label="Volver" className="flex h-10 items-center gap-1 rounded-full pl-2 pr-3 text-sm font-extrabold hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />{title || "Volver"}
        </button>
      </div>
    </div>
  );
}

export function Rail({ title, subtitle, to, children }: { title: string; subtitle?: string; to?: string; children: ReactNode }) {
  return (
    <section className="pt-9">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold sm:text-2xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {to && <Link to={to} className="flex shrink-0 items-center gap-0.5 text-sm font-bold text-primary">Ver todo<ChevronRight className="h-4 w-4" /></Link>}
      </div>
      <div className="scrollbar-none -mx-4 flex gap-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">{children}</div>
    </section>
  );
}

export function EmptyState({ icon, title, text, action, className }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-3xl border border-dashed bg-card px-6 py-14 text-center", className)}>
      {icon && <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>}
      <p className="font-display text-lg font-bold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Encabezado de pantalla. El botón "Volver" lo pone la barra global (BackBar), así es igual en todas las pantallas. */
export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-wide text-primary">{eyebrow}</p>}
          <h1 className="mt-0.5 text-2xl font-extrabold sm:text-3xl">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-l-4 border-l-brand-orange bg-card p-4">
      <div className="flex items-center justify-between gap-2 text-sm font-semibold text-muted-foreground">{label}{icon}</div>
      <p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

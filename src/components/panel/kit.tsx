import { Children, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Kit visual de los paneles (comercio, repartidor, administración). Un solo lenguaje:
 *  - Superficies: borde fino, radio 16, sin sombra; el relieve se reserva para lo que flota.
 *  - Métricas: una sola franja con divisores (no una tarjeta por número).
 *  - Texto: etiquetas 12.5 px en gris, cifras grandes con cifras de ancho fijo, secundarios claramente secundarios.
 *  - Color: el negro lleva la acción y el énfasis; el naranja de marca solo marca "lo importante ahora"; verde/rojo solo para estados y variaciones.
 */

/** Encabezado de página: título, una línea de contexto y las acciones principales a la derecha. */
export function PageIntro({ title, description, actions, className }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  if (!title && !description && !actions) return null;
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-3", className)}>
      <div className="min-w-0">
        {title && <h2 className="text-[22px] font-extrabold leading-tight tracking-tight sm:text-2xl">{title}</h2>}
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Superficie base. `flush` quita el relleno (para tablas y listas que llegan al borde). */
export function Surface({ className, flush, children }: { className?: string; flush?: boolean; children: ReactNode }) {
  return <div className={cn("rounded-2xl border bg-card shadow-soft", !flush && "p-4 sm:p-5", className)}>{children}</div>;
}

/** Sección: el título vive fuera de la superficie, con una acción opcional a la derecha. */
export function Section({ title, description, action, children, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-2.5 flex items-end justify-between gap-3 px-0.5">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[15px] font-extrabold leading-tight"><span aria-hidden className="h-3.5 w-1 shrink-0 rounded-full bg-brand-yellow" />{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="shrink-0 text-[13px] font-bold">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Enlace de acción de una sección ("Ver todos →"). */
export function SectionLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="inline-flex items-center gap-1 text-primary hover:underline">{children}<ArrowRight className="h-3.5 w-3.5" /></Link>;
}

/** Variación contra un período anterior. `inverse` invierte el color (menos es mejor, p. ej. cancelaciones). */
export function Delta({ current, previous, inverse, suffix }: { current: number; previous: number; inverse?: boolean; suffix?: string }) {
  if (!previous) return <span className="text-muted-foreground">{current ? "Primer período con datos" : "Sin datos previos"}</span>;
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return <span className="text-muted-foreground">Sin cambios{suffix ? ` ${suffix}` : ""}</span>;
  const good = inverse ? change < 0 : change > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-bold tabular-nums", good ? "text-success" : "text-destructive")}>
      {change > 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{Math.abs(change)}%{suffix && <span className="ml-1 font-medium text-muted-foreground">{suffix}</span>}
    </span>
  );
}

/** Franja de métricas: un solo contenedor con divisores. Admite cualquier cantidad de métricas sin celdas vacías raras. */
export function MetricStrip({ children, className, cols }: { children: ReactNode; className?: string; /** Columnas en pantallas grandes. Con una métrica destacada (ocupa 2) usá una más que la cantidad. */ cols?: 2 | 3 | 4 | 5 | 6 }) {
  const count = Children.toArray(children).length;
  const n = cols ?? Math.min(6, Math.max(2, count));
  const lg = { 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-5", 6: "lg:grid-cols-6" }[n];
  return (
    <div className={cn("overflow-hidden rounded-2xl border bg-card shadow-soft", className)}>
      <div className={cn("-m-px grid grid-cols-2", lg)}>{children}</div>
    </div>
  );
}

const metricTones = {
  brand: "bg-primary/10 text-primary ring-primary/15",
  accent: "bg-brand-yellow/20 text-[hsl(40_80%_30%)] ring-brand-yellow/35",
  ink: "bg-ink/[0.07] text-ink ring-ink/10 dark:bg-white/10 dark:text-white",
  info: "bg-info/10 text-info ring-info/15",
  danger: "bg-destructive/10 text-destructive ring-destructive/15",
} as const;

/** Métrica. `icon` agrega un ícono en un cuadro de color (`tone`); `featured` la destaca con el amarillo de marca. */
export function Metric({ label, value, hint, delta, spark, featured, icon, tone = "brand", className }: { label: ReactNode; value: ReactNode; hint?: ReactNode; delta?: ReactNode; spark?: number[]; featured?: boolean; icon?: ReactNode; tone?: keyof typeof metricTones; className?: string }) {
  return (
    <div className={cn("group/metric relative border-l border-t p-4 transition-colors hover:bg-muted/40 sm:p-5", featured && "col-span-2 bg-[linear-gradient(135deg,hsl(46_100%_47%/0.12),transparent_55%)]", className)}>
      {featured && <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-[linear-gradient(90deg,hsl(var(--brand-yellow)),hsl(var(--primary)))]" />}
      <div className="flex items-center gap-2">
        {icon && <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset [&_svg]:h-4 [&_svg]:w-4", metricTones[featured ? "accent" : tone])}>{icon}</span>}
        <p className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
      </div>
      <p className={cn("mt-2 font-display font-extrabold leading-none tracking-tight text-ink tabular-nums dark:text-foreground", featured ? "text-[34px] sm:text-[40px]" : "text-[26px] sm:text-[28px]")}>{value}</p>
      {(delta || hint) && <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted-foreground">{delta}{delta && hint && <span aria-hidden>·</span>}{hint}</p>}
      {spark && spark.length > 1 && <Sparkline values={spark} className="absolute right-5 top-1/2 hidden h-14 w-36 -translate-y-1/2 text-primary/70 sm:block" />}
    </div>
  );
}

/** Línea mínima de tendencia (sin ejes): solo la forma de los datos. */
export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  // Sin datos (o todo en cero) no hay tendencia que mostrar: una línea plana solo confunde.
  if (values.length < 2 || values.every((v) => !v)) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${100 - ((v - min) / span) * 86 - 7}`);
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={className} aria-hidden>
      <polyline points={points.join(" ")} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={100} cy={Number(points[points.length - 1].split(",")[1])} r="3.2" className="fill-brand-yellow" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Barras simples y legibles. La más alta lleva el color de marca; el resto, un gris suave. */
export function BarSeries({ data, label, format, height = 168 }: { data: { key: string; value: number; label: string; hint?: string }[]; label: string; format?: (n: number) => string; height?: number }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const top = data.reduce((best, d) => (d.value > best.value ? d : best), data[0] ?? { value: 0, key: "" });
  const every = Math.max(1, Math.ceil(data.length / 8));
  return (
    <div role="img" aria-label={label}>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d) => (
          <div key={d.key} className="group relative flex h-full min-w-0 flex-1 items-end justify-center" title={`${d.label}${format ? ` · ${format(d.value)}` : ` · ${d.value}`}${d.hint ? ` · ${d.hint}` : ""}`}>
            <div className={cn("w-full max-w-[44px] rounded-t-[3px] transition-colors", d.value === 0 ? "bg-muted" : d.key === top.key ? "bg-brand-yellow" : "bg-ink/15 group-hover:bg-ink/35 dark:bg-foreground/15")} style={{ height: `${Math.max(d.value ? 4 : 1.5, (d.value / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px] text-[11px] text-muted-foreground">
        {data.map((d, i) => <span key={d.key} className="relative min-w-0 flex-1 text-center"><span className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap">{i % every === 0 ? d.label : ""}</span>&nbsp;</span>)}
      </div>
    </div>
  );
}

const tones = {
  neutral: "bg-muted text-muted-foreground ring-foreground/10",
  info: "bg-info/10 text-info ring-info/20",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/15 text-warning-foreground ring-warning/30 dark:text-warning",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  brand: "bg-brand-yellow/25 text-brand-yellow-foreground ring-brand-yellow/40",
} as const;
export type Tone = keyof typeof tones;

/** Estado en una píldora compacta, con punto de color opcional. */
export function StatusPill({ tone = "neutral", dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-bold leading-5 ring-1 ring-inset", tones[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}{children}
    </span>
  );
}

/** Fila de lista con ícono/imagen a la izquierda, contenido y un extremo derecho. Para listas "inteligentes" (sin tarjeta por fila). */
export function ListRow({ lead, title, meta, trailing, to, className }: { lead?: ReactNode; title: ReactNode; meta?: ReactNode; trailing?: ReactNode; to?: string; className?: string }) {
  const body = (
    <>
      {lead && <span className="shrink-0">{lead}</span>}
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold leading-tight">{title}</span>{meta && <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">{meta}</span>}</span>
      {trailing && <span className="shrink-0 text-right text-sm">{trailing}</span>}
    </>
  );
  const cls = cn("flex items-center gap-3 px-4 py-3 transition-colors", to && "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none", className);
  return to ? <Link to={to} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

/** Contenedor de filas con divisores finos (lista de una superficie). */
export function RowList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("divide-y overflow-hidden rounded-2xl border bg-card shadow-soft", className)}>{children}</div>;
}

/** Anillo de progreso (completar el local, cumplimiento, etc.). */
export function ProgressRing({ value, size = 44, children }: { value: number; size?: number; children?: ReactNode }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${value}% completado`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-primary transition-all" strokeDasharray={c} strokeDashoffset={c - (Math.min(100, Math.max(0, value)) / 100) * c} />
      </svg>
      <span className="absolute text-[11px] font-extrabold tabular-nums">{children ?? `${value}%`}</span>
    </span>
  );
}

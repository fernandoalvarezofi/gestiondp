import { useEffect, useState } from "react";
import { Bug, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Group = { huella: string; mensaje: string; stack: string | null; url: string | null; agente: string | null; veces: number; usuarios: number; primero: string; ultimo: string };
const ranges = [[24, "24 horas"], [72, "3 días"], [168, "7 días"], [720, "30 días"]] as const;

/** Errores que ven las personas en la app, agrupados: cuántas veces, a cuántas personas y dónde. */
export function ErrorsPanel() {
  const [hours, setHours] = useState<number>(72);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setGroups(null);
    db.rpc("delivery_admin_errores", { p_horas: hours }).then(({ data, error }: { data: Group[] | null; error: unknown }) => {
      if (!active) return;
      if (error) { toast.error(errorMessage(error)); setGroups([]); } else setGroups(data || []);
    });
    return () => { active = false; };
  }, [hours]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {ranges.map(([value, label]) => <button key={value} type="button" onClick={() => setHours(value)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", hours === value ? "border-foreground bg-foreground text-background" : "bg-card")}>Últimas {label}</button>)}
      </div>
      {!groups ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : groups.length === 0 ? <EmptyState icon={<Bug className="h-7 w-7" />} title="Sin errores en este período" text="Cuando alguien tenga un problema en la app, aparece acá." /> : (
        <ul className="space-y-2">
          {groups.map((group) => (
            <li key={group.huella} className="rounded-2xl border bg-card">
              <button type="button" onClick={() => setOpen(open === group.huella ? null : group.huella)} className="flex w-full items-start gap-3 p-3 text-left" aria-expanded={open === group.huella}>
                <span className="flex h-10 min-w-10 items-center justify-center rounded-xl bg-destructive/10 px-2 text-sm font-black text-destructive">{group.veces}×</span>
                <span className="min-w-0 flex-1"><span className="block break-words text-sm font-bold">{group.mensaje}</span><span className="block text-xs text-muted-foreground">{group.usuarios} {group.usuarios === 1 ? "persona" : "personas"} · última vez {formatDateTime(group.ultimo)} · {group.url ?? ""}</span></span>
              </button>
              {open === group.huella && (
                <div className="space-y-2 border-t p-3 text-xs">
                  <p className="text-muted-foreground">Primera vez: {formatDateTime(group.primero)} · {group.agente}</p>
                  {group.stack && <pre className="max-h-64 overflow-auto rounded-xl bg-muted p-3 font-mono text-[11px]">{group.stack}</pre>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

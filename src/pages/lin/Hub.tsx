import { useSearchParams, NavLink } from "react-router-dom";
import { Suspense, lazy } from "lucide-react" && undefined as never;
import { lazy as _lazy, Suspense as _Suspense } from "react";
import { MessagesSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const Foro = _lazy(() => import("./Foro"));
const Comunidades = _lazy(() => import("./Comunidades"));

export default function Hub() {
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get("tab") === "comunidades" ? "comunidades" : "foro") as "foro" | "comunidades";

  const setTab = (t: "foro" | "comunidades") => {
    const next = new URLSearchParams(sp);
    next.set("tab", t);
    setSp(next, { replace: true });
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Header unificado */}
      <header className="mb-4 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Comunidad</p>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Conversá, preguntá, construí.
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            Foro abierto y espacios temáticos — todo en un solo hub.
          </p>
        </div>

        <div className="inline-flex shrink-0 items-center gap-0.5 rounded-full border bg-secondary/60 p-1 backdrop-blur">
          <TabBtn active={tab === "foro"} onClick={() => setTab("foro")} icon={MessagesSquare}>
            Foro
          </TabBtn>
          <TabBtn active={tab === "comunidades"} onClick={() => setTab("comunidades")} icon={Users}>
            Comunidades
          </TabBtn>
        </div>
      </header>

      <_Suspense fallback={<div className="py-10 text-center text-xs text-muted-foreground">Cargando…</div>}>
        {tab === "foro" ? <Foro /> : <Comunidades />}
      </_Suspense>
    </div>
  );
}

function TabBtn({
  active, onClick, icon: Icon, children,
}: { active: boolean; onClick: () => void; icon: any; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all",
        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

import { Bug, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Los errores de la app se guardan en la base de administración aparte; esta pantalla lleva a la Consola. */
export function ErrorsPanel() {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-l-4 border-l-brand-orange bg-card p-6 sm:p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(220_14%_16%)] text-brand-orange"><Bug className="h-6 w-6" /></span>
      <h2 className="mt-4 text-xl font-extrabold">Los errores están en la Consola</h2>
      <p className="mt-2 text-sm text-muted-foreground">Los errores de la app se envían a la base de administración, agrupados por tipo y con su detalle técnico, fuera del alcance de las cuentas de los usuarios.</p>
      <Button asChild className="mt-5 rounded-full font-bold"><a href="/consola" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Abrir la Consola</a></Button>
    </div>
  );
}

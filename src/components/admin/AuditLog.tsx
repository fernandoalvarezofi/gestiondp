import { ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * La auditoría ya no se guarda ni se lee en la base de los usuarios: vive en una base aparte, solo de lectura para
 * la administración, con login propio y verificación en dos pasos. Esta pantalla solo lleva hacia allá.
 */
export function AuditLog() {
  return (
    <div className="mx-auto max-w-xl rounded-3xl border border-l-4 border-l-brand-orange bg-card p-6 sm:p-8">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[hsl(220_14%_16%)] text-brand-orange"><ShieldCheck className="h-6 w-6" /></span>
      <h2 className="mt-4 text-xl font-extrabold">La auditoría está en la Consola</h2>
      <p className="mt-2 text-sm text-muted-foreground">Por seguridad, el registro de acciones de administración se guarda en una base de datos aparte, que no comparte nada con las cuentas de la app. Nadie puede modificarlo ni borrarlo, y cada registro está encadenado al anterior para detectar cualquier alteración.</p>
      <Button asChild className="mt-5 rounded-full font-bold"><a href="/consola" target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" />Abrir la Consola</a></Button>
    </div>
  );
}

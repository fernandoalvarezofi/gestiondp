import { Download, Smartphone, Share, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  variant?: "hero" | "card" | "floating";
  className?: string;
}

export function InstallAppCTA({ variant = "card", className }: Props) {
  const { canInstall, installed, isStandalone, showIOSHelper, promptInstall } = useInstallPrompt();
  const [showIOSSteps, setShowIOSSteps] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (isStandalone || installed) return null;
  if (!canInstall && !showIOSHelper) return null;
  if (variant === "floating" && dismissed) return null;

  const handleClick = async () => {
    if (canInstall) {
      await promptInstall();
    } else if (showIOSHelper) {
      setShowIOSSteps((s) => !s);
    }
  };

  if (variant === "hero") {
    return (
      <Button onClick={handleClick} size="lg" variant="outline" className={cn("gap-1.5", className)}>
        <Download className="h-4 w-4" />
        {showIOSHelper ? "Instalar en iPhone" : "Instalar app"}
      </Button>
    );
  }

  if (variant === "floating") {
    return (
      <div className={cn("fixed bottom-4 left-1/2 z-50 -translate-x-1/2 w-[calc(100%-2rem)] max-w-md rounded-2xl border bg-card p-3 shadow-2xl animate-in slide-in-from-bottom-4", className)}>
        <div className="flex items-center gap-3">
          <img src="/icon-192.png" alt="Woref" className="h-10 w-10 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Instalar Woref</p>
            <p className="truncate text-xs text-muted-foreground">Acceso rápido y experiencia tipo app</p>
          </div>
          <Button onClick={handleClick} size="sm" className="rounded-full">Instalar</Button>
          <button onClick={() => setDismissed(true)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>
        {showIOSSteps && (
          <IOSSteps className="mt-3" />
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-start gap-4 rounded-2xl border bg-gradient-to-br from-primary/5 to-secondary/40 p-5", className)}>
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Smartphone className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Instalá Woref en tu dispositivo</p>
        <p className="text-sm text-muted-foreground">Funciona como app nativa en móvil y escritorio. Sin tiendas, sin descargas pesadas.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={handleClick} size="sm" className="gap-1.5">
            <Download className="h-4 w-4" />
            {showIOSHelper ? "Ver cómo instalar" : "Instalar ahora"}
          </Button>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="h-3.5 w-3.5 text-primary" /> Funciona offline · Notificaciones · Ícono en pantalla
          </span>
        </div>
        {showIOSSteps && <IOSSteps className="mt-3" />}
      </div>
    </div>
  );
}

function IOSSteps({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-lg border bg-background p-3 text-xs", className)}>
      <p className="mb-1 font-semibold">En iPhone / iPad (Safari):</p>
      <ol className="list-inside list-decimal space-y-0.5 text-muted-foreground">
        <li>Tocá el botón <Share className="inline h-3 w-3" /> Compartir</li>
        <li>Elegí "Agregar a pantalla de inicio"</li>
        <li>Confirmá con "Agregar"</li>
      </ol>
    </div>
  );
}

import { Download, Smartphone, Share, Check, Apple, Monitor, Chrome, MoreVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface Props {
  variant?: "hero" | "card" | "floating" | "icon";
  className?: string;
}

type Platform = "ios" | "android" | "desktop-chromium" | "desktop-safari" | "desktop-firefox" | "other";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "other";
  const ua = window.navigator.userAgent;
  const lower = ua.toLowerCase();
  if (/iphone|ipad|ipod/.test(lower)) return "ios";
  if (/android/.test(lower)) return "android";
  if (/firefox/.test(lower)) return "desktop-firefox";
  if (/edg\//i.test(ua) || /chrome|chromium|crios/i.test(ua)) return "desktop-chromium";
  if (/safari/i.test(ua)) return "desktop-safari";
  return "other";
}

export function InstallAppCTA({ variant = "card", className }: Props) {
  const { canInstall, installed, isStandalone, promptInstall } = useInstallPrompt();
  const [open, setOpen] = useState(false);
  const platform = useMemo(detectPlatform, []);

  if (isStandalone || installed) return null;

  const handleClick = async () => {
    if (canInstall) {
      const r = await promptInstall();
      if (r === "accepted") return;
    }
    setOpen(true);
  };

  const trigger =
    variant === "hero" ? (
      <Button onClick={handleClick} size="lg" variant="outline" className={cn("gap-1.5", className)}>
        <Download className="h-4 w-4" />
        Descargar app
      </Button>
    ) : variant === "icon" ? (
      <Button onClick={handleClick} variant="ghost" size="icon" className={cn("rounded-full", className)} aria-label="Descargar app">
        <Download className="h-5 w-5" />
      </Button>
    ) : variant === "floating" ? (
      <button
        onClick={handleClick}
        className={cn(
          "fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-2xl shadow-primary/30 hover:scale-105 transition",
          className
        )}
      >
        <Download className="h-4 w-4" />
        Instalar Woref
      </button>
    ) : (
      <div className={cn("relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-secondary/40 p-6 sm:p-8", className)}>
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <img src="/icon-192.png" alt="" className="h-12 w-12 rounded-xl" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold">Llevate Woref en el bolsillo</p>
            <p className="mt-1 text-sm text-muted-foreground">App instalable en iPhone, Android, Mac y Windows. Sin tiendas, sin pesos. Notificaciones, modo offline e ícono propio.</p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button onClick={handleClick} className="gap-1.5">
                <Download className="h-4 w-4" /> Instalar ahora
              </Button>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="h-3.5 w-3.5 text-primary" /> Gratis · 2 MB · Sin anuncios
              </span>
            </div>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      </div>
    );

  return (
    <>
      {trigger}
      <InstallDialog open={open} onOpenChange={setOpen} platform={platform} canInstall={canInstall} promptInstall={promptInstall} />
    </>
  );
}

function InstallDialog({
  open, onOpenChange, platform, canInstall, promptInstall,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  platform: Platform;
  canInstall: boolean;
  promptInstall: () => Promise<any>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <img src="/icon-192.png" alt="Woref" className="h-12 w-12 rounded-xl" />
          </div>
          <DialogTitle className="text-center">Instalar Woref</DialogTitle>
          <DialogDescription className="text-center">
            Elegí tu dispositivo para ver los pasos exactos.
          </DialogDescription>
        </DialogHeader>

        {canInstall && (
          <Button onClick={() => { promptInstall(); onOpenChange(false); }} className="w-full gap-1.5">
            <Download className="h-4 w-4" /> Instalar automáticamente
          </Button>
        )}

        <PlatformGuide initial={platform} />

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Una vez instalada, abrí Woref desde el ícono. Funciona offline y recibe notificaciones.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function PlatformGuide({ initial }: { initial: Platform }) {
  const [tab, setTab] = useState<Platform>(initial === "other" ? "desktop-chromium" : initial);
  const tabs: { id: Platform; label: string; Icon: any }[] = [
    { id: "ios", label: "iPhone", Icon: Apple },
    { id: "android", label: "Android", Icon: Smartphone },
    { id: "desktop-chromium", label: "Chrome/Edge", Icon: Chrome },
    { id: "desktop-safari", label: "Mac Safari", Icon: Monitor },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-secondary p-1">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition",
              tab === id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-card p-4 text-sm">
        {tab === "ios" && (
          <ol className="space-y-2">
            <Step n={1}>Abrí <b>Safari</b> en este sitio.</Step>
            <Step n={2}>Tocá el botón <Share className="inline h-3.5 w-3.5 align-text-bottom" /> <b>Compartir</b> abajo.</Step>
            <Step n={3}>Deslizá y elegí <b>"Agregar a pantalla de inicio"</b>.</Step>
            <Step n={4}>Confirmá con <b>Agregar</b>.</Step>
          </ol>
        )}
        {tab === "android" && (
          <ol className="space-y-2">
            <Step n={1}>Abrí este sitio en <b>Chrome</b>.</Step>
            <Step n={2}>Tocá <MoreVertical className="inline h-3.5 w-3.5 align-text-bottom" /> (menú superior derecho).</Step>
            <Step n={3}>Elegí <b>"Instalar app"</b> o <b>"Agregar a pantalla de inicio"</b>.</Step>
            <Step n={4}>Confirmá. Listo, Woref aparece como app nativa.</Step>
          </ol>
        )}
        {tab === "desktop-chromium" && (
          <ol className="space-y-2">
            <Step n={1}>En la barra de direcciones, buscá el ícono <Download className="inline h-3.5 w-3.5 align-text-bottom" /> a la derecha.</Step>
            <Step n={2}>Si no aparece, abrí el menú (⋮) → <b>"Instalar Woref"</b> o <b>"Apps → Instalar este sitio"</b>.</Step>
            <Step n={3}>Confirmá <b>Instalar</b>.</Step>
            <Step n={4}>Woref abre en su propia ventana, con ícono en el escritorio.</Step>
          </ol>
        )}
        {tab === "desktop-safari" && (
          <ol className="space-y-2">
            <Step n={1}>En la barra de menú: <b>Archivo → Agregar al Dock</b>.</Step>
            <Step n={2}>Confirmá con <b>Agregar</b>.</Step>
            <Step n={3}>Woref queda en tu Dock como app independiente.</Step>
          </ol>
        )}
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{n}</span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}

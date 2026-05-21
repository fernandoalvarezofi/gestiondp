import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ReactNode } from "react";

interface Props {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  onBack?: () => void;
  sticky?: boolean;
}

/**
 * Header con botón "Volver" estilo X / Instagram.
 * Sticky por defecto, blur de fondo, alta densidad informativa.
 */
export function BackHeader({ title, subtitle, right, onBack, sticky = true }: Props) {
  const navigate = useNavigate();
  const handleBack = () => {
    if (onBack) return onBack();
    if (window.history.length > 1) navigate(-1);
    else navigate("/lin");
  };

  return (
    <header
      className={`${sticky ? "sticky top-0 z-30" : ""} -mx-4 mb-3 flex items-center gap-2 border-b border-border/60 bg-background/85 px-3 py-2.5 backdrop-blur-md md:-mx-6 md:px-4`}
    >
      <button
        onClick={handleBack}
        className="-ml-1 flex h-9 w-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-secondary"
        aria-label="Volver"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        {title && <h1 className="font-display truncate text-[16px] font-bold leading-tight tracking-tight">{title}</h1>}
        {subtitle && <p className="truncate text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}

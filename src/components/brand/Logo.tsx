import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Isotipo de Woref: un pin de ubicación con una "w" calada. Pin = entrega en tu puerta; la "w" = Woref.
 * Se dibuja en SVG para que se vea nítido en cualquier tamaño y en los íconos de la app.
 */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const gradient = useId();
  return (
    <svg viewBox="0 0 64 64" className={cn("h-9 w-9", className)} role="img" aria-label="Woref">
      <defs>
        <linearGradient id={gradient} x1="10" y1="4" x2="54" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#34AE8B" />
          <stop offset="1" stopColor="#21765D" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={inverted ? "#fff" : `url(#${gradient})`} stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
      {/* Pin */}
      <path
        d="M32 9.5c-10.2 0-18.2 8-18.2 18 0 13 15.4 25.7 16.9 26.9a2 2 0 0 0 2.6 0c1.5-1.2 16.9-13.9 16.9-26.9 0-10-8-18-18.2-18Z"
        fill={inverted ? `url(#${gradient})` : "#fff"}
      />
      {/* "w" calada */}
      <path
        d="M21.5 22.5 25.6 34a1.4 1.4 0 0 0 2.6 0L32 24.6 35.8 34a1.4 1.4 0 0 0 2.6 0l4.1-11.5"
        fill="none"
        stroke={inverted ? "#fff" : "#F0B900"}
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Logotipo completo: isotipo + "woref" en tipografía redondeada. */
export function Logo({ className, inverted = false, compact = false }: { className?: string; inverted?: boolean; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)} aria-label="Woref">
      <LogoMark className="h-9 w-9 shrink-0" inverted={inverted} />
      {!compact && (
        <span className={cn("font-brand text-[1.65rem] font-black leading-none tracking-[-0.04em]", inverted ? "text-white" : "text-primary")}>
          woref
        </span>
      )}
    </span>
  );
}

import { useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { img } from "@/lib/delivery";
import { cn } from "@/lib/utils";

/**
 * Foto con respaldo de marca: mientras carga muestra un fondo con la marca y, si la foto falla o no existe,
 * se queda con ese fondo en vez de un hueco gris vacío.
 */
export function SmartImage({ src, width = 640, alt = "", className, loading = "lazy" }: { src?: string | null; width?: number; alt?: string; className?: string; loading?: "lazy" | "eager" }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const missing = !src || failed;
  return (
    <span className="absolute inset-0 block overflow-hidden bg-gradient-to-br from-[hsl(220_14%_24%)] to-[hsl(220_16%_11%)]">
      <span aria-hidden className="absolute inset-0 flex items-center justify-center"><LogoMark className="h-1/3 w-auto max-h-16 opacity-25" /></span>
      {!missing && (
        <img
          src={img(src, width)}
          alt={alt}
          loading={loading}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn("absolute inset-0 h-full w-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0", className)}
        />
      )}
    </span>
  );
}

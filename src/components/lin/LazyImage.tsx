import { useState } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt?: string;
  wrapperClassName?: string;
}

export function LazyImage({ src, alt = "", className, wrapperClassName, ...rest }: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-secondary/40", wrapperClassName)}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-secondary" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "h-full w-full transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
        {...rest}
      />
    </div>
  );
}

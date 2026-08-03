import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bed, Bath, Car, Maximize, MapPin, Box, Heart } from "lucide-react";
import { formatPrecio, formatM2, labelOperacion, labelTipo, ubicacionCorta } from "@/lib/inmobiliaria";

type Props = {
  p: any;
  fav?: boolean;
  onToggleFav?: (id: string) => void;
};

export function PropiedadCard({ p, fav, onToggleFav }: Props) {
  const ubic = ubicacionCorta(p);
  return (
    <Card className="group h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
      <Link to={`/lin/propiedades/${p.slug}`} className="block">
        <div className="relative aspect-[4/3] overflow-hidden bg-secondary/40">
          {p.portada_url ? (
            <img
              src={p.portada_url}
              alt={p.titulo}
              loading="lazy"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground/40">
              <Box className="h-12 w-12" />
            </div>
          )}
          <Badge className="absolute left-2 top-2">{labelOperacion(p.operacion)}</Badge>
          {p.tour_estado === "listo" && (
            <Badge variant="secondary" className="absolute right-2 top-2 gap-1">
              <Box className="h-3 w-3" /> Tour 3D
            </Badge>
          )}
        </div>
      </Link>
      <CardContent className="space-y-2 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-display text-lg font-extrabold text-primary">
            {formatPrecio(Number(p.precio), p.moneda, p.operacion)}
          </p>
          {onToggleFav && (
            <button
              type="button"
              aria-label={fav ? "Quitar de guardadas" : "Guardar propiedad"}
              onClick={() => onToggleFav(p.id)}
              className="rounded-full p-1 text-muted-foreground transition hover:bg-secondary"
            >
              <Heart className={`h-4 w-4 ${fav ? "fill-primary text-primary" : ""}`} />
            </button>
          )}
        </div>
        <Link to={`/lin/propiedades/${p.slug}`} className="block">
          <p className="line-clamp-1 font-semibold leading-snug hover:text-primary">{p.titulo}</p>
        </Link>
        {ubic && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{ubic}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
          <span>{labelTipo(p.tipo)}</span>
          {p.dormitorios != null && (
            <span className="inline-flex items-center gap-1"><Bed className="h-3.5 w-3.5" />{p.dormitorios}</span>
          )}
          {p.banos != null && (
            <span className="inline-flex items-center gap-1"><Bath className="h-3.5 w-3.5" />{p.banos}</span>
          )}
          {p.cocheras ? (
            <span className="inline-flex items-center gap-1"><Car className="h-3.5 w-3.5" />{p.cocheras}</span>
          ) : null}
          {p.m2_totales && (
            <span className="inline-flex items-center gap-1"><Maximize className="h-3.5 w-3.5" />{formatM2(p.m2_totales)}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

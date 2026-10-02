import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { EmptyState } from "@/components/delivery/Common";
import { db, formatDateTime } from "@/lib/delivery";
import { formatKm } from "@/lib/geo";

type Row = { latitud: number; longitud: number; personas: number; solicitudes: number; ultima: string; direccion_ejemplo: string | null; comercio_mas_cercano_km: number | null };

/** Dónde hay gente pidiendo sin cobertura: sirve para decidir en qué zona sumar comercios y repartidores. */
export function ZoneDemand() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    db.rpc("delivery_admin_demanda_zonas").then(({ data }: { data: Row[] | null }) => setRows(data || []));
  }, []);

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!rows.length) return <EmptyState title="Todavía no hay pedidos de zonas sin cobertura" text="Cuando alguien pida que le avisen desde un lugar al que no llegamos, aparece acá." />;

  return (
    <div className="overflow-x-auto rounded-3xl border bg-card">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Zona (ejemplo)</th><th className="p-3 text-right">Personas</th><th className="p-3 text-right">Comercio más cercano</th><th className="p-3">Último pedido</th><th className="p-3" /></tr></thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={`${row.latitud}-${row.longitud}`}>
              <td className="p-3 font-bold">{row.direccion_ejemplo || `${Number(row.latitud).toFixed(2)}, ${Number(row.longitud).toFixed(2)}`}</td>
              <td className="p-3 text-right font-extrabold">{row.personas}</td>
              <td className="p-3 text-right">{row.comercio_mas_cercano_km != null ? formatKm(Number(row.comercio_mas_cercano_km)) : "—"}</td>
              <td className="p-3">{formatDateTime(row.ultima)}</td>
              <td className="p-3 text-right"><a className="font-bold text-primary" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${row.latitud}&mlon=${row.longitud}#map=14/${row.latitud}/${row.longitud}`}>Ver mapa</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

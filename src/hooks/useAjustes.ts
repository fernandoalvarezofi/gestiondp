import { useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "@/lib/delivery";

export type Ajuste = { clave: string; valor: number; etiqueta: string; ayuda: string | null; unidad: string; minimo: number; maximo: number };

/** Ajustes de la plataforma (tarifa de servicio, tiempos…) que administración puede cambiar. */
export function useAjustes() {
  const query = useQuery({
    queryKey: ["delivery-ajustes"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await db.from("delivery_ajustes").select("*").order("clave");
      if (error) throw error;
      return ((data || []) as Ajuste[]).map((item) => ({ ...item, valor: Number(item.valor), minimo: Number(item.minimo), maximo: Number(item.maximo) }));
    },
  });
  const client = useQueryClient();
  return { ...query, ajustes: query.data ?? [], refresh: () => client.invalidateQueries({ queryKey: ["delivery-ajustes"] }) };
}

export const ajusteValor = (ajustes: Ajuste[], clave: string, defecto: number) => ajustes.find((item) => item.clave === clave)?.valor ?? defecto;

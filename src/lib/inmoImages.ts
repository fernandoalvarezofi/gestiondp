import casa from "@/assets/inmo-casa-lincoln.jpg";
import campo from "@/assets/inmo-campo-lincoln.jpg";
import plaza from "@/assets/inmo-plaza-lincoln.jpg";
import local from "@/assets/inmo-local-lincoln.jpg";

export const inmoFallbacks = { casa, campo, plaza, local };

export function getFallbackImage(tipo_propiedad?: string | null): string {
  switch (tipo_propiedad) {
    case "campo":
    case "chacra":
    case "quinta":
      return campo;
    case "local":
    case "oficina":
    case "galpon":
      return local;
    case "departamento":
    case "ph":
      return plaza;
    default:
      return casa;
  }
}

export const TIPO_OPERACION_LABEL: Record<string, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  alquiler_temporario: "Alquiler temporario",
  local_comercial: "Local comercial",
  oficina: "Oficina",
  campo_rural: "Campo / rural",
};

export const TIPO_PROPIEDAD_LABEL: Record<string, string> = {
  casa: "Casa",
  departamento: "Departamento",
  ph: "PH",
  local: "Local",
  oficina: "Oficina",
  galpon: "Galpón",
  terreno: "Terreno",
  campo: "Campo",
  chacra: "Chacra",
  quinta: "Quinta",
  otro: "Otro",
};

export const TIPO_USUARIO_LABEL: Record<string, string> = {
  dueno_directo: "Dueño directo",
  inmobiliaria: "Inmobiliaria",
  agente_independiente: "Agente independiente",
};

export function formatPrecio(precio: number | null, moneda: string = "ARS"): string {
  if (precio == null) return "Consultar";
  const symbol = moneda === "USD" ? "US$" : "$";
  return `${symbol} ${new Intl.NumberFormat("es-AR").format(precio)}`;
}

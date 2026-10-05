// Interfaz común de los proveedores de pago. La lógica de negocio (estados, montos, libro) vive en la base y no sabe de Mercado Pago:
// para sumar otro proveedor alcanza con implementar esta interfaz y agregarlo a `obtenerProveedor`.
export type PagoProveedor = {
  externalId: string;
  /** Identificador de lo que se cobró (hoy, el pedido). */
  referencia: string | null;
  /** Estado tal como lo informa el proveedor; la base lo traduce a los estados propios. */
  estado: string;
  monto: number;
  detalle: string | null;
};

export interface ProveedorPagos {
  readonly id: "mercadopago";
  /** Consulta el pago al proveedor con nuestra credencial (nunca se confía en el contenido del aviso). */
  obtenerPago(externalId: string): Promise<PagoProveedor>;
  /** Pide el reintegro total. La clave de idempotencia evita devolver dos veces ante un reintento. */
  reintegrar(externalId: string, claveIdempotencia: string): Promise<void>;
  /** Verifica la firma de un aviso entrante. */
  verificarAviso(aviso: { cabeceraFirma: string | null; idPeticion: string | null; idDato: string }): Promise<"ok" | "ausente" | "invalida" | "vencida">;
}

export class ErrorProveedor extends Error {
  constructor(mensaje: string, readonly estadoHttp: number) { super(mensaje); }
}

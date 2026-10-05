import { verificarFirma } from "./firma.ts";
import { ErrorProveedor, type PagoProveedor, type ProveedorPagos } from "./proveedor.ts";

const API = "https://api.mercadopago.com/v1/payments";

export function mercadoPago(opts: { token: string; secretoWebhook?: string | null }): ProveedorPagos {
  const headers = { Authorization: `Bearer ${opts.token}` };
  return {
    id: "mercadopago",
    async obtenerPago(externalId) {
      const response = await fetch(`${API}/${encodeURIComponent(externalId)}`, { headers });
      if (!response.ok) throw new ErrorProveedor("consulta de pago", response.status);
      const pago = await response.json();
      return {
        externalId: String(pago.id), referencia: pago.external_reference ? String(pago.external_reference) : null,
        estado: String(pago.status), monto: Number(pago.transaction_amount), detalle: pago.status_detail ?? null,
      } satisfies PagoProveedor;
    },
    async reintegrar(externalId, claveIdempotencia) {
      const response = await fetch(`${API}/${encodeURIComponent(externalId)}/refunds`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json", "X-Idempotency-Key": claveIdempotencia }, body: "{}",
      });
      if (!response.ok) throw new ErrorProveedor("reintegro", response.status);
    },
    async verificarAviso(aviso) {
      // Sin clave secreta configurada no hay con qué verificar: se acepta (el pago se reconsulta igual a la API).
      if (!opts.secretoWebhook) return "ok";
      return verificarFirma({ secreto: opts.secretoWebhook, xSignature: aviso.cabeceraFirma, xRequestId: aviso.idPeticion, dataId: aviso.idDato });
    },
  };
}

import { DeliveryOrder, DeliveryStore, formatDateTime, formatSlot, metodoPagoLabel, money, optionsLabel, shortId } from "@/lib/delivery";

export type PrintSettings = { auto: boolean; paper: "58" | "80"; copies: number };
const KEY = "woref-merchant-print";
const defaults: PrintSettings = { auto: false, paper: "80", copies: 1 };

export function readPrintSettings(): PrintSettings {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || "null") as Partial<PrintSettings> | null;
    return { auto: Boolean(saved?.auto), paper: saved?.paper === "58" ? "58" : "80", copies: Math.min(3, Math.max(1, Number(saved?.copies) || 1)) };
  } catch {
    return defaults;
  }
}

export function writePrintSettings(settings: PrintSettings) {
  try { window.localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* sin almacenamiento: queda solo en esta sesión */ }
}

const STYLES = (width: number) => `
  @page { margin: 2mm; }
  body { font-family: "Courier New", monospace; font-size: 12px; margin: 0; width: ${width}mm; color: #000; }
  h1 { font-size: 16px; margin: 0 0 2px; }
  .big { font-size: 22px; font-weight: bold; margin: 4px 0; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .r { display: flex; justify-content: space-between; gap: 6px; }
  .s { padding-left: 10px; font-size: 11px; }
  .b { font-weight: bold; }
  .ticket { page-break-after: always; }
  .ticket:last-child { page-break-after: auto; }
`;

/** Arma una comanda. Todo se escribe con el DOM (textContent), así nada de lo que escribió el cliente puede ejecutarse. */
function buildTicket(doc: Document, order: DeliveryOrder, store: DeliveryStore, copy: number, copies: number) {
  const root = doc.createElement("div");
  root.className = "ticket";
  const add = (text: string, className?: string, tag = "div") => { const el = doc.createElement(tag); el.textContent = text; if (className) el.className = className; root.appendChild(el); return el; };
  const rule = () => root.appendChild(doc.createElement("hr"));

  add(store.nombre, undefined, "h1");
  add(`Pedido ${shortId(order.id)}${copies > 1 ? ` (copia ${copy}/${copies})` : ""}`, "big");
  add(formatDateTime(order.created_at));
  add(order.tipo_entrega === "retiro" ? "RETIRA EN EL LOCAL" : "ENVÍO A DOMICILIO", "b");
  if (order.programado_para) add(`PROGRAMADO: ${formatSlot(order.programado_para)}`, "b");
  add(`Cliente: ${order.cliente?.nombre || "—"}${order.telefono_contacto ? ` · ${order.telefono_contacto}` : ""}`);
  if (order.tipo_entrega !== "retiro") add(`Entrega: ${order.direccion_entrega}`);
  rule();
  (order.items || []).forEach((item) => {
    const row = doc.createElement("div");
    row.className = "r b";
    const left = doc.createElement("span"); left.textContent = `${item.cantidad}x ${item.nombre}`;
    const right = doc.createElement("span"); right.textContent = money(item.precio_unitario * item.cantidad);
    row.append(left, right);
    root.appendChild(row);
    if (item.opciones?.length) add(optionsLabel(item.opciones), "s");
    if (item.notas) add(`» ${item.notas}`, "s");
  });
  rule();
  if (order.notas) add(`NOTA: ${order.notas}`, "b");
  add(`Pago: ${metodoPagoLabel[order.metodo_pago]}${order.metodo_pago === "efectivo" && order.efectivo_paga_con != null ? ` · paga con ${money(order.efectivo_paga_con)} (vuelto ${money(Number(order.efectivo_paga_con) - Number(order.total))})` : ""}`);
  add(`TOTAL ${money(order.total)}`, "big");
  return root;
}

/**
 * Imprime la comanda sin abrir ventanas (un marco oculto): sirve para la impresión automática
 * porque los navegadores no bloquean los marcos como bloquean las ventanas emergentes.
 */
export function printOrderTicket(order: DeliveryOrder, store: DeliveryStore, settings: PrintSettings = readPrintSettings(), copies = settings.copies) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return false; }

  doc.title = `Comanda ${shortId(order.id)}`;
  const style = doc.createElement("style");
  style.textContent = STYLES(settings.paper === "58" ? 48 : 72);
  doc.head.appendChild(style);
  for (let copy = 1; copy <= copies; copy += 1) doc.body.appendChild(buildTicket(doc, order, store, copy, copies));

  const cleanup = () => window.setTimeout(() => frame.remove(), 1000);
  win.addEventListener("afterprint", cleanup);
  window.setTimeout(() => { win.focus(); win.print(); window.setTimeout(cleanup, 60000); }, 150);
  return true;
}

/** Aviso del navegador (funciona con la pestaña abierta aunque estés en otra ventana). */
export function desktopNotificationsState(): "granted" | "denied" | "default" | "unsupported" {
  return typeof Notification === "undefined" ? "unsupported" : Notification.permission;
}

export function notifyDesktop(title: string, body: string, tag: string) {
  if (desktopNotificationsState() !== "granted") return;
  try {
    const notification = new Notification(title, { body, tag, icon: "/icon-192.png", requireInteraction: true });
    notification.onclick = () => { window.focus(); notification.close(); };
  } catch { /* algunos navegadores solo permiten avisos desde un service worker */ }
}

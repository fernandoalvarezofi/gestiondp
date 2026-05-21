export const PAYMENT_METHOD_OPTIONS = [
  { id: "stripe_link", label: "Stripe Payment Link", icon: "💳", placeholder: "https://buy.stripe.com/..." },
  { id: "mercadopago", label: "MercadoPago", icon: "🇦🇷", placeholder: "https://link.mercadopago.com/..." },
  { id: "paypal", label: "PayPal.me", icon: "🅿️", placeholder: "https://paypal.me/usuario" },
  { id: "gumroad", label: "Gumroad", icon: "🛒", placeholder: "https://gumroad.com/l/..." },
  { id: "lemon", label: "Lemon Squeezy", icon: "🍋", placeholder: "https://store.lemonsqueezy.com/..." },
  { id: "paddle", label: "Paddle", icon: "🧾", placeholder: "https://pay.paddle.io/..." },
  { id: "binance", label: "Binance Pay / USDT", icon: "₿", placeholder: "Dirección o link de Binance Pay" },
  { id: "transferencia", label: "Transferencia / CBU / CVU", icon: "🏦", placeholder: "CBU/CVU/Alias o instrucciones" },
  { id: "coordinar", label: "Coordinar por DM", icon: "💬", placeholder: "" },
  { id: "otro", label: "Otro link de pago", icon: "🔗", placeholder: "https://..." },
] as const;

export type PaymentMethodId = typeof PAYMENT_METHOD_OPTIONS[number]["id"];

export type PayoutMethod = {
  id: PaymentMethodId;
  link: string;
  label?: string;
};

export const PRODUCT_TYPES = [
  { id: "archivo", label: "Archivo descargable", icon: "📦" },
  { id: "licencia", label: "Licencia / código", icon: "🔑" },
  { id: "servicio", label: "Servicio / consultoría", icon: "🤝" },
  { id: "curso", label: "Curso / membresía", icon: "🎓" },
  { id: "web", label: "Web / landing / plantilla", icon: "🌐" },
  { id: "ia", label: "Producto con IA", icon: "🤖" },
] as const;

export function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export function formatPrice(amount: number, currency = "USD") {
  if (amount === 0) return "Gratis";
  try {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function findMethodMeta(id: string) {
  return PAYMENT_METHOD_OPTIONS.find((m) => m.id === id) ?? { id, label: id, icon: "🔗", placeholder: "" };
}

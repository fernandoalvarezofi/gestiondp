import { useEffect, useState } from "react";
import { Copy, Ticket } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, Rail } from "@/components/delivery/Common";
import { StoreCard } from "@/components/delivery/StoreCard";
import { COMERCIO_COLS, Coupon, couponValue, db, DeliveryStore, money } from "@/lib/delivery";

export default function Promotions() {
  const [coupons, setCoupons] = useState<(Coupon & { comercio?: { nombre: string } | null })[]>([]);
  const [stores, setStores] = useState<DeliveryStore[]>([]);

  useEffect(() => {
    db.from("delivery_cupones").select("*, comercio:delivery_comercios(nombre)").eq("activo", true).order("created_at").then(({ data }: { data: (Coupon & { comercio?: { nombre: string } | null })[] | null }) => {
      setCoupons((data || []).filter((coupon) => !coupon.vence_at || new Date(coupon.vence_at) > new Date()));
    });
    db.from("delivery_comercios").select(COMERCIO_COLS).eq("activo", true).not("promo_texto", "is", null).then(({ data }: { data: DeliveryStore[] | null }) => setStores(data || []));
  }, []);

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Copiaste ${code}. Pegalo en el carrito.`);
    } catch {
      toast.info(`Tu código es ${code}`);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Ahorrá" title="Cupones y promociones" subtitle="Aplicá el código en el carrito antes de confirmar el pedido." />
      {coupons.length ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coupons.map((coupon) => (
            <article key={coupon.id} className="relative flex overflow-hidden rounded-3xl border bg-card">
              <div className="flex w-28 shrink-0 flex-col items-center justify-center bg-primary p-3 text-center text-primary-foreground">
                <Ticket className="h-6 w-6" />
                <span className="mt-1 font-display text-lg font-extrabold leading-tight">{couponValue(coupon)}</span>
              </div>
              <div className="min-w-0 flex-1 border-l-2 border-dashed p-4">
                <p className="text-sm font-semibold">{coupon.descripcion}</p>
                <p className="mt-1 text-xs text-muted-foreground">{coupon.comercio?.nombre ? `Solo en ${coupon.comercio.nombre}` : "Válido en todos los comercios"}{Number(coupon.minimo) > 0 && ` · Mínimo ${money(coupon.minimo)}`}</p>
                {coupon.automatico ? <p className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary">Se aplica solo en el carrito</p> : (
                  <button type="button" onClick={() => copy(coupon.codigo)} className="mt-3 flex items-center gap-2 rounded-full border border-dashed border-primary px-3 py-1.5 font-mono text-sm font-bold text-primary hover:bg-primary/5">
                    {coupon.codigo}<Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState className="mt-6" icon={<Ticket className="h-7 w-7" />} title="No hay cupones activos" text="Volvé pronto: publicamos promociones nuevas todas las semanas." />
      )}
      {stores.length > 0 && <Rail title="Comercios con descuento">{stores.map((store) => <StoreCard key={store.id} store={store} variant="row" />)}</Rail>}
    </div>
  );
}

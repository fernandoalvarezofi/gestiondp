import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { PanelShell } from "@/components/panel/PanelShell";
import { StoreReviewDialog } from "@/components/admin/StoreReviewDialog";
import type { CourierRow } from "@/components/admin/CouriersManager";
import { changeOrderStatus } from "@/components/merchant/MerchantOrders";
import { StoreFormValues, StoreSettingsForm, storeToFormValues } from "@/components/merchant/StoreSettingsForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Coupon, db, DeliveryOrder, DeliveryStore, EstadoPedido, errorMessage, pedidoActivo } from "@/lib/delivery";
import { adminNav } from "@/navigation/menus";

const adminOrderSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario), comercio:delivery_comercios(nombre,slug,imagen_url,direccion), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";

/** Datos y acciones compartidos por las secciones de administración. */
export type AdminContext = {
  stores: DeliveryStore[];
  orders: DeliveryOrder[];
  couriers: CourierRow[];
  coupons: Coupon[];
  stats: { gmv: number; count: number; active: number; stores: number; online: number };
  counts: { pendingStores: number; pendingIdentities: number; openClaims: number; reportedReviews: number; refunds: number };
  loadStores: () => Promise<void>;
  loadOrders: () => Promise<void>;
  loadCouriers: () => Promise<void>;
  loadCoupons: () => Promise<void>;
  loadIdentities: () => Promise<void>;
  setOpenClaims: (count: number) => void;
  setReportedReviews: (count: number) => void;
  updateStore: (store: DeliveryStore, patch: Partial<DeliveryStore>) => Promise<void>;
  setCommission: (store: DeliveryStore, raw: string) => Promise<void>;
  moderate: (store: DeliveryStore, approve: boolean) => Promise<void>;
  advance: (order: DeliveryOrder, estado: EstadoPedido) => Promise<void>;
  editStore: (store: DeliveryStore) => void;
  reviewStore: (store: DeliveryStore) => void;
};
export const useAdmin = () => useOutletContext<AdminContext>();

/**
 * Contexto Administración: layout propio con su barra lateral y una ruta por sección (/app/admin/:seccion).
 * Solo se monta para administradores (guarda `RequireRole` en la ruta); cada acción la vuelve a validar el servidor.
 */
export default function AdminLayout() {
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [editing, setEditing] = useState<DeliveryStore | null>(null);
  const [reviewing, setReviewing] = useState<DeliveryStore | null>(null);
  const [openClaims, setOpenClaims] = useState(0);
  const [reportedReviews, setReportedReviews] = useState(0);
  const [pendingIdentities, setPendingIdentities] = useState(0);

  const loadStores = useCallback(async () => {
    const { data } = await db.rpc("delivery_admin_comercios");
    setStores(data || []);
  }, []);
  const loadOrders = useCallback(async () => {
    const { data } = await db.from("delivery_pedidos").select(adminOrderSelect).order("created_at", { ascending: false }).limit(200);
    setOrders(data || []);
  }, []);
  const loadCouriers = useCallback(async () => {
    const { data } = await db.from("delivery_repartidores").select("*, perfil:perfiles(nombre)").order("created_at", { ascending: false });
    setCouriers(data || []);
  }, []);
  const loadIdentities = useCallback(async () => {
    const { count } = await db.from("delivery_identidad").select("perfil_id", { count: "exact", head: true }).eq("estado", "en_revision");
    setPendingIdentities(count ?? 0);
  }, []);
  const loadCoupons = useCallback(async () => {
    const { data } = await db.from("delivery_cupones").select("*, comercio:delivery_comercios(nombre)").order("created_at", { ascending: false });
    setCoupons(data || []);
  }, []);

  useEffect(() => {
    loadStores(); loadOrders(); loadCouriers(); loadCoupons(); loadIdentities();
    db.rpc("delivery_admin_resenas_reportadas").then(({ data }: { data: unknown[] | null }) => setReportedReviews(data?.length ?? 0), () => undefined);
    const channel = db.channel("admin-pedidos").on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos" }, loadOrders).subscribe();
    return () => { db.removeChannel(channel); };
  }, [loadStores, loadOrders, loadCouriers, loadCoupons, loadIdentities]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter((order) => new Date(order.created_at).toDateString() === today && order.estado !== "cancelado");
    return {
      gmv: todayOrders.reduce((total, order) => total + Number(order.total), 0),
      count: todayOrders.length,
      active: orders.filter((order) => pedidoActivo(order.estado)).length,
      stores: stores.filter((store) => store.activo !== false).length,
      online: couriers.filter((courier) => courier.disponible && courier.activo).length,
    };
  }, [orders, stores, couriers]);

  const counts = {
    pendingStores: stores.filter((store) => store.aprobado === false).length,
    pendingIdentities,
    openClaims,
    reportedReviews,
    refunds: orders.filter((order) => order.pago_estado === "a_reintegrar").length,
  };

  const updateStore = async (store: DeliveryStore, patch: Partial<DeliveryStore>) => {
    const { error } = await db.from("delivery_comercios").update(patch).eq("id", store.id);
    if (error) { toast.error(errorMessage(error)); return; }
    loadStores();
  };
  const setCommission = async (store: DeliveryStore, raw: string) => {
    const pct = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(pct) || pct < 0 || pct > 50) { toast.error("La comisión debe estar entre 0 y 50 %"); return; }
    if (pct === Number(store.comision_pct ?? 10)) return;
    const { error } = await db.rpc("delivery_admin_comision", { p_comercio: store.id, p_pct: pct });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(`Comisión de ${store.nombre}: ${pct}%`);
    loadStores();
  };
  const moderate = async (store: DeliveryStore, approve: boolean) => {
    const motivo = approve ? null : window.prompt("¿Por qué lo rechazás? (lo verá el dueño del comercio)", "Faltan fotos o datos del local");
    if (!approve && motivo === null) return;
    const { error } = await db.rpc("delivery_moderar_comercio", { p_comercio: store.id, p_aprobado: approve, p_motivo: motivo });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(approve ? `${store.nombre} ya está visible para los clientes` : "Comercio rechazado");
    loadStores();
  };
  const advance = async (order: DeliveryOrder, estado: EstadoPedido) => {
    const motivo = estado === "cancelado" ? window.prompt("Motivo de la cancelación (lo verá el cliente)", "Cancelado por soporte") : undefined;
    if (estado === "cancelado" && motivo === null) return;
    if (await changeOrderStatus(order.id, estado, motivo || undefined)) { toast.success("Pedido actualizado"); loadOrders(); }
  };

  const context: AdminContext = {
    stores, orders, couriers, coupons, stats, counts,
    loadStores, loadOrders, loadCouriers, loadCoupons, loadIdentities, setOpenClaims, setReportedReviews,
    updateStore, setCommission, moderate, advance, editStore: setEditing, reviewStore: setReviewing,
  };

  return (
    <PanelShell
      panel="Administración"
      groups={adminNav({ pedidos: stats.active, soporte: openClaims, comercios: counts.pendingStores, identidades: pendingIdentities, pagos: counts.refunds, opiniones: reportedReviews })}
    >
      <Outlet context={context} />

      <StoreReviewDialog store={reviewing} onClose={() => setReviewing(null)} />

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl font-extrabold">Editar {editing?.nombre}</DialogTitle></DialogHeader>
          {editing && (
            <StoreSettingsForm
              key={editing.id}
              initial={storeToFormValues(editing)}
              submitLabel="Guardar"
              onSubmit={async (values: StoreFormValues) => { await updateStore(editing, values); setEditing(null); toast.success("Comercio actualizado"); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}

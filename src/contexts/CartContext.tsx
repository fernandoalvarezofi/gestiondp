import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ChosenOption } from "@/lib/delivery";
import { agregarLinea, cambiarCantidad, cantidadDe, CartGroup, leerGuardado, quitarGrupo, quitarUnidad, reemplazarGrupo, subtotalDe, totalGeneral, totalUnidades } from "@/lib/cart";

export type CartProduct = {
  id: string;
  comercio_id: string;
  nombre: string;
  precio: number;
  imagen_url?: string | null;
};

export type CartStore = {
  id: string;
  nombre: string;
  slug: string;
  costo_envio: number;
  pedido_minimo?: number;
  envio_gratis_desde?: number | null;
  imagen_url?: string | null;
};

/** Una línea del carrito: el mismo producto con distintas opciones son líneas distintas. `precio` ya incluye los extras. */
export type CartItem = CartProduct & { lineId: string; cantidad: number; notas?: string; opciones: ChosenOption[]; precioBase: number; varianteId?: string };

/** Variante elegida de un producto: pisa el precio base y se manda al servidor para validar y descontar su stock. */
export type ChosenVariant = { id: string; nombre: string; precio: number | null };

export type DeliveryAddress = { id?: string | null; alias?: string; direccion: string; lat?: number | null; lng?: number | null }

type CartContextValue = {
  /** Comercio con el que se está armando el pedido ahora (el activo). Las pantallas de pago trabajan con este. */
  store: CartStore | null;
  /** Líneas del comercio activo. */
  items: CartItem[];
  /** Unidades en TODO el carrito (todos los comercios). */
  itemCount: number;
  /** Subtotal del comercio activo. */
  subtotal: number;
  /** Subtotal de todos los comercios. */
  totalGeneral: number;
  /** Un grupo por comercio: cada uno se confirma y se paga por separado. */
  groups: CartGroup[];
  activeStoreId: string | null;
  setActiveStore: (storeId: string) => void;
  /** Líneas y subtotal de un comercio en particular. */
  groupOf: (storeId: string) => { items: CartItem[]; subtotal: number };
  address: DeliveryAddress | null;
  setAddress: (address: DeliveryAddress | null) => void;
  /** Agrega productos al grupo de su comercio. Devuelve false si ya hay 5 comercios en el carrito y no se pudo agregar. */
  addItem: (product: CartProduct, store: CartStore, quantity?: number, notas?: string, opciones?: ChosenOption[], variante?: ChosenVariant) => boolean;
  /** Reemplaza las líneas de UN comercio (usado por "Repetir pedido"); los otros comercios no se tocan. */
  replaceCart: (store: CartStore, lines: { product: CartProduct; cantidad: number; notas?: string; opciones?: ChosenOption[] }[]) => boolean;
  updateQuantity: (lineId: string, quantity: number) => void;
  /** Unidades de un producto sumando todas sus combinaciones de opciones. */
  quantityOf: (productId: string) => number;
  /** Resta una unidad de la última línea agregada de ese producto. */
  decrementProduct: (productId: string) => void;
  /** Vacía el comercio activo (tras confirmar su pedido o con "Vaciar"). Los otros siguen en el carrito. */
  clearCart: () => void;
  /** Vacía todo el carrito. */
  clearAll: () => void;
  removeStore: (storeId: string) => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "woref-delivery-cart";
const ADDRESS_KEY = "woref-delivery-address";

const lineKey = (productId: string, opciones: ChosenOption[], varianteId?: string) => [productId, varianteId || "", ...opciones.map((option) => option.id).sort()].join("|");

function readStorage<T>(key: string): T | null {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // El almacenamiento puede no estar disponible (modo privado); el carrito sigue funcionando en memoria.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const saved = useMemo(() => leerGuardado(readStorage<unknown>(STORAGE_KEY)), []);
  const [groups, setGroups] = useState<CartGroup[]>(saved.groups);
  const [activeId, setActiveId] = useState<string | null>(saved.active);
  const [address, setAddressState] = useState<DeliveryAddress | null>(() => readStorage<DeliveryAddress>(ADDRESS_KEY));

  useEffect(() => { writeStorage(STORAGE_KEY, { groups, active: activeId }); }, [groups, activeId]);

  // El comercio activo siempre existe mientras haya productos (si se vació, pasa al último que quede).
  const active = groups.find((g) => g.store.id === activeId) ?? groups[groups.length - 1] ?? null;

  const setAddress = useCallback((next: DeliveryAddress | null) => {
    setAddressState(next);
    writeStorage(ADDRESS_KEY, next);
  }, []);

  const addItem = useCallback((product: CartProduct, nextStore: CartStore, quantity = 1, notas?: string, opciones: ChosenOption[] = [], variante?: ChosenVariant) => {
    const lineId = lineKey(product.id, opciones, variante?.id);
    const basePrice = variante?.precio != null ? Number(variante.precio) : Number(product.precio);
    const unit = basePrice + opciones.reduce((total, option) => total + Number(option.precio), 0);
    // Solo los campos necesarios: el producto puede traer grupos de opciones y otros datos pesados.
    const line: CartItem = { id: product.id, comercio_id: product.comercio_id, nombre: variante ? `${product.nombre} · ${variante.nombre}` : product.nombre, imagen_url: product.imagen_url, lineId, cantidad: quantity, notas, opciones, precioBase: basePrice, precio: unit, varianteId: variante?.id };
    const next = agregarLinea(groups, nextStore, line);
    if (!next) return false;
    setGroups(next);
    setActiveId(nextStore.id);
    return true;
  }, [groups]);

  const replaceCart = useCallback((nextStore: CartStore, lines: { product: CartProduct; cantidad: number; notas?: string; opciones?: ChosenOption[] }[]) => {
    const items: CartItem[] = lines.map(({ product, cantidad, notas, opciones = [] }) => ({
      id: product.id, comercio_id: product.comercio_id, nombre: product.nombre, imagen_url: product.imagen_url,
      lineId: lineKey(product.id, opciones), cantidad: Math.min(cantidad, 50), notas, opciones,
      precioBase: Number(product.precio), precio: Number(product.precio) + opciones.reduce((total, option) => total + Number(option.precio), 0),
    }));
    const next = reemplazarGrupo(groups, nextStore, items);
    if (!next) return false;
    setGroups(next);
    setActiveId(nextStore.id);
    return true;
  }, [groups]);

  const updateQuantity = useCallback((lineId: string, quantity: number) => setGroups((current) => cambiarCantidad(current, lineId, quantity)), []);
  const decrementProduct = useCallback((productId: string) => setGroups((current) => quitarUnidad(current, productId)), []);
  const removeStore = useCallback((storeId: string) => setGroups((current) => quitarGrupo(current, storeId)), []);
  const clearCart = useCallback(() => { if (active) setGroups((current) => quitarGrupo(current, active.store.id)); }, [active]);
  const clearAll = useCallback(() => { setGroups([]); setActiveId(null); }, []);
  const groupOf = useCallback((storeId: string) => { const items = groups.find((g) => g.store.id === storeId)?.items ?? []; return { items, subtotal: subtotalDe(items) }; }, [groups]);
  const quantityOf = useCallback((productId: string) => cantidadDe(groups, productId), [groups]);

  const value = useMemo(() => ({
    store: active?.store ?? null,
    items: active?.items ?? [],
    itemCount: totalUnidades(groups),
    subtotal: active ? subtotalDe(active.items) : 0,
    totalGeneral: totalGeneral(groups),
    groups,
    activeStoreId: active?.store.id ?? null,
    setActiveStore: setActiveId,
    groupOf,
    address,
    setAddress,
    addItem,
    replaceCart,
    updateQuantity,
    quantityOf,
    decrementProduct,
    clearCart,
    clearAll,
    removeStore,
  }), [active, groups, groupOf, address, setAddress, addItem, replaceCart, updateQuantity, quantityOf, decrementProduct, clearCart, clearAll, removeStore]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ChosenOption } from "@/lib/delivery";

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
export type CartItem = CartProduct & { lineId: string; cantidad: number; notas?: string; opciones: ChosenOption[]; precioBase: number };

export type DeliveryAddress = { id?: string | null; alias?: string; direccion: string; lat?: number | null; lng?: number | null }

type CartContextValue = {
  store: CartStore | null;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  address: DeliveryAddress | null;
  setAddress: (address: DeliveryAddress | null) => void;
  /** Agrega productos. Devuelve false si el carrito tenía productos de otro comercio y se reemplazó. */
  addItem: (product: CartProduct, store: CartStore, quantity?: number, notas?: string, opciones?: ChosenOption[]) => boolean;
  /** Reemplaza todo el carrito de una vez (usado por "Repetir pedido"). */
  replaceCart: (store: CartStore, lines: { product: CartProduct; cantidad: number; notas?: string; opciones?: ChosenOption[] }[]) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  /** Unidades de un producto sumando todas sus combinaciones de opciones. */
  quantityOf: (productId: string) => number;
  /** Resta una unidad de la última línea agregada de ese producto. */
  decrementProduct: (productId: string) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "woref-delivery-cart";
const ADDRESS_KEY = "woref-delivery-address";

const lineKey = (productId: string, opciones: ChosenOption[]) => [productId, ...opciones.map((option) => option.id).sort()].join("|");

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

/** Carritos guardados por versiones anteriores no tenían líneas ni opciones. */
function normalize(items: Partial<CartItem>[] | undefined): CartItem[] {
  return (items || []).filter((item) => item.id && item.cantidad).map((item) => ({
    ...(item as CartItem),
    opciones: item.opciones || [],
    precioBase: item.precioBase ?? Number(item.precio),
    lineId: item.lineId || lineKey(item.id!, item.opciones || []),
  }));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const saved = useMemo(() => readStorage<{ store?: CartStore | null; items?: Partial<CartItem>[] }>(STORAGE_KEY), []);
  const [store, setStore] = useState<CartStore | null>(saved?.store ?? null);
  const [items, setItems] = useState<CartItem[]>(() => normalize(saved?.items));
  const [address, setAddressState] = useState<DeliveryAddress | null>(() => readStorage<DeliveryAddress>(ADDRESS_KEY));

  useEffect(() => {
    writeStorage(STORAGE_KEY, { store: items.length ? store : null, items });
  }, [store, items]);

  const setAddress = useCallback((next: DeliveryAddress | null) => {
    setAddressState(next);
    writeStorage(ADDRESS_KEY, next);
  }, []);

  const clearCart = useCallback(() => {
    setStore(null);
    setItems([]);
  }, []);

  const addItem = useCallback((product: CartProduct, nextStore: CartStore, quantity = 1, notas?: string, opciones: ChosenOption[] = []) => {
    const sameStore = !store || store.id === nextStore.id;
    const lineId = lineKey(product.id, opciones);
    const unit = Number(product.precio) + opciones.reduce((total, option) => total + Number(option.precio), 0);
    setStore(nextStore);
    setItems((current) => {
      const base = sameStore ? current : [];
      const existing = base.find((item) => item.lineId === lineId);
      if (!existing) {
        // Solo los campos necesarios: el producto puede traer grupos de opciones y otros datos pesados.
        const line: CartItem = { id: product.id, comercio_id: product.comercio_id, nombre: product.nombre, imagen_url: product.imagen_url, lineId, cantidad: quantity, notas, opciones, precioBase: Number(product.precio), precio: unit };
        return [...base, line];
      }
      return base.map((item) => (item.lineId === lineId ? { ...item, cantidad: Math.min(item.cantidad + quantity, 50), notas: notas ?? item.notas } : item));
    });
    return sameStore;
  }, [store]);

  const replaceCart = useCallback((nextStore: CartStore, lines: { product: CartProduct; cantidad: number; notas?: string; opciones?: ChosenOption[] }[]) => {
    setStore(nextStore);
    setItems(lines.map(({ product, cantidad, notas, opciones = [] }) => ({
      id: product.id, comercio_id: product.comercio_id, nombre: product.nombre, imagen_url: product.imagen_url,
      lineId: lineKey(product.id, opciones), cantidad: Math.min(cantidad, 50), notas, opciones,
      precioBase: Number(product.precio), precio: Number(product.precio) + opciones.reduce((total, option) => total + Number(option.precio), 0),
    })));
  }, []);

  const updateQuantity = useCallback((lineId: string, quantity: number) => {
    setItems((current) => current
      .map((item) => (item.lineId === lineId ? { ...item, cantidad: Math.min(quantity, 50) } : item))
      .filter((item) => item.cantidad > 0));
  }, []);

  const decrementProduct = useCallback((productId: string) => {
    setItems((current) => {
      const last = [...current].reverse().find((item) => item.id === productId);
      if (!last) return current;
      return current
        .map((item) => (item.lineId === last.lineId ? { ...item, cantidad: item.cantidad - 1 } : item))
        .filter((item) => item.cantidad > 0);
    });
  }, []);

  const quantityOf = useCallback((productId: string) => items.filter((item) => item.id === productId).reduce((total, item) => total + item.cantidad, 0), [items]);

  const value = useMemo(() => ({
    store: items.length ? store : null,
    items,
    itemCount: items.reduce((total, item) => total + item.cantidad, 0),
    subtotal: items.reduce((total, item) => total + item.precio * item.cantidad, 0),
    address,
    setAddress,
    addItem,
    replaceCart,
    updateQuantity,
    quantityOf,
    decrementProduct,
    clearCart,
  }), [store, items, address, setAddress, addItem, replaceCart, updateQuantity, quantityOf, decrementProduct, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}

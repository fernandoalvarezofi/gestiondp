import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

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

export type CartItem = CartProduct & { cantidad: number; notas?: string };

export type DeliveryAddress = { id?: string | null; alias?: string; direccion: string };

type CartContextValue = {
  store: CartStore | null;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  address: DeliveryAddress | null;
  setAddress: (address: DeliveryAddress | null) => void;
  /** Agrega productos. Devuelve false si el carrito tenía productos de otro comercio y se reemplazó. */
  addItem: (product: CartProduct, store: CartStore, quantity?: number, notas?: string) => boolean;
  updateQuantity: (productId: string, quantity: number) => void;
  quantityOf: (productId: string) => number;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "woref-delivery-cart";
const ADDRESS_KEY = "woref-delivery-address";

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
  const saved = useMemo(() => readStorage<{ store?: CartStore | null; items?: CartItem[] }>(STORAGE_KEY), []);
  const [store, setStore] = useState<CartStore | null>(saved?.store ?? null);
  const [items, setItems] = useState<CartItem[]>(saved?.items ?? []);
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

  const addItem = useCallback((product: CartProduct, nextStore: CartStore, quantity = 1, notas?: string) => {
    const sameStore = !store || store.id === nextStore.id;
    setStore(nextStore);
    setItems((current) => {
      const base = sameStore ? current : [];
      const existing = base.find((item) => item.id === product.id);
      if (!existing) return [...base, { ...product, cantidad: quantity, notas }];
      return base.map((item) => (item.id === product.id ? { ...item, cantidad: Math.min(item.cantidad + quantity, 50), notas: notas ?? item.notas } : item));
    });
    return sameStore;
  }, [store]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((current) => current
      .map((item) => (item.id === productId ? { ...item, cantidad: Math.min(quantity, 50) } : item))
      .filter((item) => item.cantidad > 0));
  }, []);

  const quantityOf = useCallback((productId: string) => items.find((item) => item.id === productId)?.cantidad ?? 0, [items]);

  const value = useMemo(() => ({
    store: items.length ? store : null,
    items,
    itemCount: items.reduce((total, item) => total + item.cantidad, 0),
    subtotal: items.reduce((total, item) => total + item.precio * item.cantidad, 0),
    address,
    setAddress,
    addItem,
    updateQuantity,
    quantityOf,
    clearCart,
  }), [store, items, address, setAddress, addItem, updateQuantity, quantityOf, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}

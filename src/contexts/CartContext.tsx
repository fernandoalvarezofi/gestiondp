import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

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
};

export type CartItem = CartProduct & { cantidad: number };

type CartContextValue = {
  store: CartStore | null;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  addItem: (product: CartProduct, store: CartStore) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "woref-delivery-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<CartStore | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as { store?: CartStore; items?: CartItem[] };
      setStore(parsed.store ?? null);
      setItems(parsed.items ?? []);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ store, items }));
  }, [store, items]);

  const clearCart = () => {
    setStore(null);
    setItems([]);
  };

  const addItem = (product: CartProduct, nextStore: CartStore) => {
    if (store && store.id !== nextStore.id) {
      setStore(nextStore);
      setItems([{ ...product, cantidad: 1 }]);
      return;
    }
    setStore(nextStore);
    setItems((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (!existing) return [...current, { ...product, cantidad: 1 }];
      return current.map((item) => item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item);
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems((current) => current
      .map((item) => item.id === productId ? { ...item, cantidad: quantity } : item)
      .filter((item) => item.cantidad > 0));
    if (items.length === 1 && items[0]?.id === productId && quantity <= 0) setStore(null);
  };

  const value = useMemo(() => ({
    store,
    items,
    itemCount: items.reduce((total, item) => total + item.cantidad, 0),
    subtotal: items.reduce((total, item) => total + item.precio * item.cantidad, 0),
    addItem,
    updateQuantity,
    clearCart,
  }), [store, items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart debe usarse dentro de CartProvider");
  return context;
}
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@/types/product';

interface CartItem extends Product {
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  totalItems: () => number;
  totalPrice: () => number;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (product, quantity = 1) => {
        const currentItems = get().items;
        const existingItem = currentItems.find((item) => item.id === product.id);

        if (product.stock <= 0) return;

        if (existingItem) {
          const newQuantity = Math.min(existingItem.quantity + quantity, product.stock);
          set({
            items: currentItems.map((item) =>
              item.id === product.id
                ? { ...item, ...product, quantity: newQuantity }
                : item
            ),
          });
        } else {
          set({ items: [...currentItems, { ...product, quantity: Math.min(quantity, product.stock) }] });
        }
      },
      removeItem: (id) => {
        const currentItems = get().items;
        set({ items: currentItems.filter((item) => item.id !== id) });
      },
      clearCart: () => set({ items: [] }),
      totalItems: () => get().items.reduce((acc, item) => acc + item.quantity, 0),
      totalPrice: () => get().items.reduce((acc, item) => acc + item.price * item.quantity, 0),
    }),
    {
      name: 'lumina-cart-storage',
    }
  )
);

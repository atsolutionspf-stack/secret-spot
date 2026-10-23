import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { addItem, countItems, removeItem, setQuantity, type CartLine } from "./cart";

const STORAGE_KEY = "ss_cart_v1";

interface CartValue {
  lines: CartLine[];
  count: number;
  add: (id: string, qty?: number) => void;
  set: (id: string, qty: number) => void;
  remove: (id: string) => void;
  replace: (lines: CartLine[]) => void;
  clear: () => void;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setOpen: (o: boolean) => void;
}

const CartContext = createContext<CartValue | null>(null);

function load(): CartLine[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter(
      (l): l is CartLine => !!l && typeof l.menuItemId === "string" && Number.isInteger(l.quantity) && l.quantity > 0,
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load);
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines]);

  const add = useCallback((id: string, qty = 1) => setLines((l) => addItem(l, id, qty)), []);
  const set = useCallback((id: string, qty: number) => setLines((l) => setQuantity(l, id, qty)), []);
  const remove = useCallback((id: string) => setLines((l) => removeItem(l, id)), []);
  const replace = useCallback((next: CartLine[]) => setLines(next), []);
  const clear = useCallback(() => setLines([]), []);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  const value = useMemo<CartValue>(
    () => ({ lines, count: countItems(lines), add, set, remove, replace, clear, isOpen, open, close, setOpen }),
    [lines, add, set, remove, replace, clear, isOpen, open, close],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart outside CartProvider");
  return ctx;
}

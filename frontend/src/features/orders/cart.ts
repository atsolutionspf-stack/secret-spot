// Pure cart logic — no React, no network. Money is handled in integer cents.
// The cart stores only ids + quantities; prices always come from the live menu,
// and the server recomputes everything again on confirmation.
import type { MenuItem } from "../../lib/types";

export interface CartLine {
  menuItemId: string;
  quantity: number;
}

export interface CartRow {
  item: MenuItem;
  quantity: number;
  unitCents: number;
  lineCents: number;
}

export interface PricedCart {
  rows: CartRow[];
  missing: string[]; // ids no longer on the menu / hidden
  itemCount: number;
  subtotalCents: number;
  totalCents: number;
}

export const MAX_QTY = 50;

export const toCents = (euros: number): number => Math.round(euros * 100);
export const fromCents = (cents: number): number => cents / 100;

const clamp = (q: number) => Math.max(0, Math.min(MAX_QTY, Math.floor(q)));

export function setQuantity(lines: CartLine[], menuItemId: string, quantity: number): CartLine[] {
  const q = clamp(quantity);
  const exists = lines.some((l) => l.menuItemId === menuItemId);
  if (q === 0) return lines.filter((l) => l.menuItemId !== menuItemId);
  if (!exists) return [...lines, { menuItemId, quantity: q }];
  return lines.map((l) => (l.menuItemId === menuItemId ? { ...l, quantity: q } : l));
}

export function addItem(lines: CartLine[], menuItemId: string, quantity = 1): CartLine[] {
  const current = lines.find((l) => l.menuItemId === menuItemId)?.quantity ?? 0;
  return setQuantity(lines, menuItemId, current + quantity);
}

export function removeItem(lines: CartLine[], menuItemId: string): CartLine[] {
  return setQuantity(lines, menuItemId, 0);
}

export function quantityOf(lines: CartLine[], menuItemId: string): number {
  return lines.find((l) => l.menuItemId === menuItemId)?.quantity ?? 0;
}

export function countItems(lines: CartLine[]): number {
  return lines.reduce((n, l) => n + l.quantity, 0);
}

export function priceCart(lines: CartLine[], menu: MenuItem[]): PricedCart {
  const byId = new Map(menu.map((m) => [m.id, m]));
  const rows: CartRow[] = [];
  const missing: string[] = [];
  for (const line of lines) {
    const item = byId.get(line.menuItemId);
    if (!item || !item.available) {
      missing.push(line.menuItemId);
      continue;
    }
    const unitCents = toCents(item.price);
    rows.push({ item, quantity: line.quantity, unitCents, lineCents: unitCents * line.quantity });
  }
  const subtotalCents = rows.reduce((s, r) => s + r.lineCents, 0);
  return {
    rows,
    missing,
    itemCount: rows.reduce((n, r) => n + r.quantity, 0),
    subtotalCents,
    totalCents: subtotalCents, // pickup only: no delivery or service fees
  };
}

/** Lines still valid against the menu (drops removed/hidden items). */
export function pruneCart(lines: CartLine[], menu: MenuItem[]): CartLine[] {
  const ok = new Set(menu.filter((m) => m.available).map((m) => m.id));
  return lines.filter((l) => ok.has(l.menuItemId));
}

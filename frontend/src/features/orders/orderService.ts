// The single place the UI talks to the order backend.
// Config: GET /api/orders/config on the Cloudflare Worker (never a direct Supabase RPC).
// Submit: TEST MODE ONLY — nothing is sent or saved until the full flow is verified.
import { useQuery } from "@tanstack/react-query";
import { errorCode, fetchOrderConfig as fetchConfig } from "@/lib/data";
import { fromCents, type CartRow } from "./cart";
import type { OrderConfig, OrderCreate, OrderResult } from "./types";

/** Flip only after the real POST /api/orders flow has been verified end to end. */
export const ORDERS_LIVE = true;

export const orderKeys = { config: ["orders", "config"] as const };

export function fetchOrderConfig(): Promise<OrderConfig> {
  return fetchConfig();
}

/** Test-mode order: built in the browser, no network request, persisted = false. */
export async function submitOrder(body: OrderCreate, rows: CartRow[]): Promise<OrderResult> {
  const items = rows.map((r) => ({
    menu_item_id: r.item.id,
    name: r.item.name,
    unit_price: fromCents(r.unitCents),
    quantity: r.quantity,
    line_total: fromCents(r.lineCents),
  }));
  const totalCents = rows.reduce((s, r) => s + r.lineCents, 0);
  const now = new Date().toISOString();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return {
    persisted: false,
    mode: "demo",
    order: {
      id: `test-${suffix}`,
      order_number: `TEST-${suffix}`,
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      notes: body.notes,
      pickup_at: now,
      pickup_time: body.pickup_time,
      items,
      subtotal: fromCents(totalCents),
      total: fromCents(totalCents),
      currency: "EUR",
      fulfillment: "pickup",
      payment: "pay_at_pickup",
      status: "pending",
      created_at: now,
    },
  };
}

export function useOrderConfig() {
  return useQuery({ queryKey: orderKeys.config, queryFn: fetchOrderConfig, refetchInterval: 60_000 });
}

export function orderErrorCode(err: unknown): string {
  return errorCode(err);
}

/** Ordering buttons are always shown (owner's choice); while not live, the UI says it's a test. */
export function useOrderingVisible(): boolean {
  return true;
}

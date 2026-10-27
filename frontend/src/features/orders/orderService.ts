// The single place the UI talks to the order backend. The UI never knows where orders are stored:
// Supabase RPCs create_order / order_config validate hours, items and prices server-side.
import { useQuery } from "@tanstack/react-query";
import { createOrder, errorCode, fetchOrderConfig as fetchConfig } from "@/lib/data";
import type { OrderConfig, OrderCreate, OrderResult } from "./types";

export const orderKeys = { config: ["orders", "config"] as const };

export function fetchOrderConfig(): Promise<OrderConfig> {
  return fetchConfig();
}

export function submitOrder(body: OrderCreate): Promise<OrderResult> {
  return createOrder(body);
}

export function useOrderConfig() {
  return useQuery({ queryKey: orderKeys.config, queryFn: fetchOrderConfig, refetchInterval: 60_000 });
}

/** Error code from a failed submit (the Supabase function raises the code as its message). */
export function orderErrorCode(err: unknown): string {
  return errorCode(err);
}

/**
 * Ordering buttons are always shown (owner's choice), also on the published site.
 * While mode is "demo" the order sheet and confirmation clearly state that the order
 * is NOT saved and does not reach the restaurant.
 */
export function useOrderingVisible(): boolean {
  return true;
}

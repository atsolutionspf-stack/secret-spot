// The single place the UI talks to the order backend. The UI never knows where orders are stored:
// the backend decides (demo store today, Supabase once DATABASE_URL is configured).
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { OrderConfig, OrderCreate, OrderResult } from "./types";

export const orderKeys = { config: ["orders", "config"] as const };

export function fetchOrderConfig(): Promise<OrderConfig> {
  return apiGet<OrderConfig>("/orders/config");
}

export function submitOrder(body: OrderCreate): Promise<OrderResult> {
  return apiPost<OrderResult>("/orders", body);
}

export function useOrderConfig() {
  return useQuery({ queryKey: orderKeys.config, queryFn: fetchOrderConfig, refetchInterval: 60_000 });
}

/** Error code from a failed submit (backend sends {detail: "<code>"}). */
export function orderErrorCode(err: unknown): string {
  if (err instanceof ApiError && err.body && typeof err.body === "object" && "detail" in err.body) {
    const d = (err.body as { detail: unknown }).detail;
    if (typeof d === "string") return d;
  }
  return "generic";
}

/**
 * Ordering buttons are always shown (owner's choice), also on the published site.
 * While mode is "demo" the order sheet and confirmation clearly state that the order
 * is NOT saved and does not reach the restaurant.
 */
export function useOrderingVisible(): boolean {
  return true;
}

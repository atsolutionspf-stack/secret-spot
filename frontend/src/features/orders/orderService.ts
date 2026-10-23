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

export function isPreviewHost(hostname: string = window.location.hostname): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".preview.emergentagent.com");
}

/**
 * Ordering buttons are shown when orders really reach the restaurant (Supabase connected),
 * or on the preview/test site so the flow can be tried. On the published site in demo mode
 * they stay hidden so real customers never place an order that goes nowhere.
 */
export function useOrderingVisible(): boolean {
  const { data, isError } = useOrderConfig();
  if (data && !isError && data.mode === "supabase") return true;
  return isPreviewHost();
}

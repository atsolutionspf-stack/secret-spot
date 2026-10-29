
import { useQuery } from "@tanstack/react-query";
import { ApiError, apiPost } from "@/lib/api";
import { errorCode, fetchOrderConfig as fetchConfig } from "@/lib/data";
import { fromCents, type CartRow } from "./cart";
import type {
  Order,
  OrderConfig,
  OrderCreate,
  OrderResult,
} from "./types";

/**
 * Pedidos reales: Cloudflare API -> Supabase.
 * No cambiar a false en producción.
 */
export const ORDERS_LIVE = true;

export const orderKeys = {
  config: ["orders", "config"] as const,
};

interface CreatedOrderResponse {
  order_number: string;
  status: string;
  pickup_time: string;
  total: number;
  currency: string;
}

export function fetchOrderConfig(): Promise<OrderConfig> {
  return fetchConfig();
}

export async function submitOrder(
  body: OrderCreate,
  rows: CartRow[],
): Promise<OrderResult> {
  if (!ORDERS_LIVE) {
    throw new Error("Los pedidos reales no están activados.");
  }

  // Enviar el pedido al backend. No generar pedidos ficticios.
  const saved = await apiPost<CreatedOrderResponse>(
    "/orders",
    body,
  );

  const now = new Date().toISOString();

  const subtotalCents = rows.reduce(
    (sum, row) => sum + row.lineCents,
    0,
  );

  const order: Order = {
    id: saved.order_number,
    order_number: saved.order_number,
    customer_name: body.customer_name,
    customer_phone: body.customer_phone,
    notes: body.notes,
    pickup_at: now,
    pickup_time: saved.pickup_time,
    items: rows.map((row) => ({
      menu_item_id: row.item.id,
      name: row.item.name,
      unit_price: fromCents(row.unitCents),
      quantity: row.quantity,
      line_total: fromCents(row.lineCents),
    })),
    subtotal: fromCents(subtotalCents),
    total: Number(saved.total),
    currency: saved.currency === "EUR" ? "EUR" : "EUR",
    fulfillment: "pickup",
    payment: "pay_at_pickup",
    status: saved.status as Order["status"],
    created_at: now,
  };

  return {
    persisted: true,
    mode: "supabase",
    order,
  };
}

export function useOrderConfig() {
  return useQuery({
    queryKey: orderKeys.config,
    queryFn: fetchOrderConfig,
    refetchInterval: 60_000,
  });
}

export function orderErrorCode(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as {
      detail?: { code?: string };
      code?: string;
    } | null;

    const code = body?.detail?.code ?? body?.code;

    switch (code) {
      case "orders_closed":
        return "closed";

      case "slot_unavailable":
        return "invalid_pickup_time";

      case "product_unavailable":
      case "product_not_found":
        return "item_unavailable";

      default:
        return "generic";
    }
  }

  return errorCode(err);
}

/** Los botones de pedidos se muestran siempre. */
export function useOrderingVisible(): boolean {
  return true;
}

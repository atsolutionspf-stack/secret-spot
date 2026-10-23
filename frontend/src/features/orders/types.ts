// Mirrors backend/models/orders.py — keep in sync. This is also the shape stored in Supabase
// (tables `orders` + `order_items`, see backend/alembic/versions/0001_create_orders.py).

export type OrderStatus = "pending" | "preparing" | "ready" | "collected" | "cancelled";
export type StoreMode = "demo" | "supabase";

export interface OrderItemIn {
  menu_item_id: string;
  quantity: number;
}

export interface OrderCreate {
  customer_name: string;
  customer_phone: string;
  notes: string;
  pickup_time: string; // "HH:MM", one of OrderConfig.pickup_slots
  items: OrderItemIn[];
}

export interface OrderLine {
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
  pickup_at: string; // ISO datetime (Europe/Madrid offset)
  pickup_time: string;
  items: OrderLine[];
  subtotal: number;
  total: number;
  currency: "EUR";
  fulfillment: "pickup";
  payment: "pay_at_pickup";
  status: OrderStatus;
  created_at: string;
}

export interface OrderConfig {
  mode: StoreMode; // "demo" = orders are NOT saved anywhere
  accepting: boolean;
  reason: "closed" | "last_orders" | null;
  pickup_slots: string[];
  prep_minutes: number;
}

export interface OrderResult {
  order: Order;
  persisted: boolean; // false in demo mode
  mode: StoreMode;
}

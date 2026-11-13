// All data access for the site goes through here (Supabase: tables under RLS + public RPCs).
// Public writes only happen through SQL functions that validate hours, inputs and prices
// (see backend/alembic/versions/0002_full_supabase.sql).
import { apiGet } from "./api";
import { supabase } from "./supabase";
import type {
  AdminStats,
  Booking,
  BookingCreate,
  BookingStatus,
  MenuItem,
  MenuItemCreate,
  MenuItemUpdate,
  Message,
  MessageCreate,
} from "./types";
import type { OrderConfig, OrderStatus } from "@/features/orders/types";

const RESTAURANT_ID = "71691b13-c118-4c6e-a554-b50d76de0924";

export class DataError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

function check<T>(res: { data: unknown; error: { message: string } | null }): T {
  if (res.error) throw new DataError(res.error.message || "generic");
  return res.data as T;
}

// Prevent an unavailable or stuck auth storage lock from leaving /admin loading forever.
function withTimeout<T>(promise: PromiseLike<T>, ms: number, code: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new DataError(code)), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export const errorCode = (e: unknown): string => (e instanceof DataError ? e.code : "generic");

/** Invoke the Supabase Edge Function that sends email notifications. */
export async function notify(type: "booking" | "booking_status" | "message" | "order" | "order_status", id: string): Promise<void> {
  const { error } = await supabase.functions.invoke("notify", { body: { type, id } });
  if (error) throw new DataError(error.message || "notification_failed");
}

// ---------- Public ----------
const MENU_COLS = "id,name,category,description_es,description_en,price,price_note,tags,allergens,available,sort_order";

export async function fetchMenu(): Promise<MenuItem[]> {
  return check<MenuItem[]>(await supabase.from("menu_items").select(MENU_COLS).eq("available", true).order("sort_order"));
}

export async function createBooking(body: BookingCreate): Promise<Booking> {
  const b = check<Booking>(
    await supabase.rpc("create_booking", { p: body })
  );

  if (
    !b ||
    typeof b.date !== "string" ||
    typeof b.time !== "string" ||
    typeof b.id !== "string" ||
    typeof b.code !== "string"
  ) {
    throw new DataError("invalid_booking_response");
  }

  void notify("booking", b.id).catch((error) => console.error("Booking email notification failed", error));
  return b;
}

export async function createMessage(body: MessageCreate): Promise<{ id: string }> {
  const m = check<{ id: string }>(await supabase.rpc("create_message", { p: body }));
  void notify("message", m.id).catch((error) => console.error("Message email notification failed", error));
  return m;
}

/** Order config comes from the Cloudflare Worker (it holds RESTAURANT_ID + the server key). */
export async function fetchOrderConfig(): Promise<OrderConfig> {
  const c = await apiGet<Partial<OrderConfig>>("/orders/config");
  return {
    mode: c.mode ?? "supabase",
    accepting: c.accepting === true,
    reason: c.reason ?? (c.accepting === true ? null : "closed"),
    pickup_slots: Array.isArray(c.pickup_slots) ? c.pickup_slots.map(String) : [],
    prep_minutes: typeof c.prep_minutes === "number" ? c.prep_minutes : 20,
  };
}

// ---------- Admin (RLS: only users listed in public.admins) ----------
export async function isAdmin(): Promise<boolean> {
  const { data: s } = await withTimeout(supabase.auth.getSession(), 8000, "auth_timeout");
  if (!s.session) return false;
  return check<boolean>(await withTimeout(supabase.rpc("is_admin"), 8000, "admin_check_timeout"));
}

export async function fetchStats(today: string): Promise<AdminStats> {
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const r = await q;
    if (r.error) throw new DataError(r.error.message);
    return r.count ?? 0;
  };
  const head = { count: "exact" as const, head: true };
  const [pending, upcoming, unread, items, pendingOrders] = await Promise.all([
    count(supabase.from("reservations").select("id", head).eq("restaurant_id", RESTAURANT_ID).eq("status", "pending")),
    count(supabase.from("reservations").select("id", head).eq("restaurant_id", RESTAURANT_ID).gte("reservation_date", today).in("status", ["pending", "confirmed"])),
    count(supabase.from("messages").select("id", head).eq("read", false)),
    count(supabase.from("menu_items").select("id", head)),
    count(supabase.from("orders").select("id", head).eq("restaurant_id", RESTAURANT_ID).eq("status", "pending")),
  ]);
  return { pending_bookings: pending, upcoming_bookings: upcoming, unread_messages: unread, menu_items: items, pending_orders: pendingOrders };
}

type ReservationRow = {
  id: string;
  code: string | null;
  customer_name: string;
  customer_phone: string;
  email: string | null;
  reservation_date: string;
  reservation_time: string;
  party_size: number;
  notes: string | null;
  lang: "es" | "en";
  status: BookingStatus;
  created_at: string;
};

const RESERVATION_COLS = "id,code,customer_name,customer_phone,email,reservation_date,reservation_time,party_size,notes,lang,status,created_at";

function toBooking(row: ReservationRow): Booking {
  return {
    id: row.id,
    code: row.code ?? "",
    name: row.customer_name,
    phone: row.customer_phone,
    email: row.email ?? "",
    date: row.reservation_date,
    time: String(row.reservation_time).slice(0, 5),
    party_size: row.party_size,
    note: row.notes ?? "",
    lang: row.lang === "en" ? "en" : "es",
    status: row.status,
    created_at: row.created_at,
  };
}

export async function listBookings(status: string): Promise<Booking[]> {
  let q = supabase.from("reservations").select(RESERVATION_COLS).eq("restaurant_id", RESTAURANT_ID).order("reservation_date").order("reservation_time");
  if (status !== "all") q = q.eq("status", status);
  return check<ReservationRow[]>(await q).map(toBooking);
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
  const row = check<ReservationRow>(
    await supabase.from("reservations").update({ status }).eq("restaurant_id", RESTAURANT_ID).eq("id", id).select(RESERVATION_COLS).single()
  );
  if (status === "confirmed" || status === "cancelled") {
    await notify("booking_status", id);
  }
  return toBooking(row);
}


export type AdminOrderStatus = OrderStatus;
export interface AdminOrderItem {
  id: string;
  name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}
export interface AdminOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  notes: string | null;
  pickup_at: string;
  pickup_time: string | null;
  subtotal: number;
  total: number;
  currency: string;
  status: AdminOrderStatus;
  created_at: string;
  order_items: AdminOrderItem[];
}

const ORDER_ADMIN_COLS = "id,order_number,customer_name,customer_phone,customer_email,notes,pickup_at,pickup_time,subtotal,total,currency,status,created_at,order_items(id,name,unit_price,quantity,line_total)";

export async function listOrders(): Promise<AdminOrder[]> {
  return check<AdminOrder[]>(
    await supabase.from("orders").select(ORDER_ADMIN_COLS)
      .eq("restaurant_id", RESTAURANT_ID)
      .order("created_at", { ascending: false }),
  );
}

export async function updateOrderStatus(id: string, status: AdminOrderStatus): Promise<void> {
  const patch = status === "preparing"
    ? { status, confirmed_at: new Date().toISOString() }
    : { status };
  check(
    await supabase.from("orders").update(patch)
      .eq("restaurant_id", RESTAURANT_ID)
      .eq("id", id)
      .eq("status", "pending")
      .select("id")
      .single(),
  );
  if (status === "preparing" || status === "cancelled") {
    await notify("order_status", id);
  }
}

export async function listMessages(): Promise<Message[]> {
  return check<Message[]>(
    await supabase.from("messages").select("id,name,email,phone,subject,message,read,created_at").order("created_at", { ascending: false }),
  );
}

export async function setMessageRead(id: string, read: boolean): Promise<void> {
  check(await supabase.from("messages").update({ read }).eq("id", id));
}

export async function deleteMessage(id: string): Promise<void> {
  check(await supabase.from("messages").delete().eq("id", id));
}

export async function adminMenu(): Promise<MenuItem[]> {
  return check<MenuItem[]>(await supabase.from("menu_items").select(MENU_COLS).order("sort_order"));
}

export async function saveMenuItem(id: string | null, body: MenuItemCreate | MenuItemUpdate): Promise<MenuItem> {
  const q = id
    ? supabase.from("menu_items").update(body).eq("id", id).select(MENU_COLS).single()
    : supabase.from("menu_items").insert(body).select(MENU_COLS).single();
  return check<MenuItem>(await q);
}

export async function deleteMenuItem(id: string): Promise<void> {
  check(await supabase.from("menu_items").delete().eq("id", id));
}

// ---------- Auth (owner) ----------
export async function signInWithPassword(email: string, password: string): Promise<void> {
  check(await supabase.auth.signInWithPassword({ email, password }));
}
export async function sendPhoneCode(phone: string): Promise<void> {
  check(await supabase.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } }));
}
export async function verifyPhoneCode(phone: string, token: string): Promise<void> {
  check(await supabase.auth.verifyOtp({ phone, token, type: "sms" }));
}
export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

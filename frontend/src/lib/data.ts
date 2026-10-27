// All data access for the site goes through here (Supabase: tables under RLS + public RPCs).
// Public writes only happen through SQL functions that validate hours, inputs and prices
// (see backend/alembic/versions/0002_full_supabase.sql).
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
import type { OrderConfig, OrderCreate, OrderResult } from "@/features/orders/types";

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

export const errorCode = (e: unknown): string => (e instanceof DataError ? e.code : "generic");

/** Fire-and-forget email notification (Supabase Edge Function "notify"). Never blocks the UI. */
export function notify(type: "booking" | "booking_status" | "message" | "order", id: string): void {
  supabase.functions.invoke("notify", { body: { type, id } }).catch(() => undefined);
}

// ---------- Public ----------
const MENU_COLS = "id,name,category,description_es,description_en,price,price_note,tags,allergens,available,sort_order";

export async function fetchMenu(): Promise<MenuItem[]> {
  return check<MenuItem[]>(await supabase.from("menu_items").select(MENU_COLS).eq("available", true).order("sort_order"));
}

export async function createBooking(body: BookingCreate): Promise<Booking> {
  const b = check<Booking>(await supabase.rpc("create_booking", { p: body }));
  notify("booking", b.id);
  return b;
}

export async function createMessage(body: MessageCreate): Promise<{ id: string }> {
  const m = check<{ id: string }>(await supabase.rpc("create_message", { p: body }));
  notify("message", m.id);
  return m;
}

export async function fetchOrderConfig(): Promise<OrderConfig> {
  return check<OrderConfig>(await supabase.rpc("order_config"));
}

export async function createOrder(body: OrderCreate): Promise<OrderResult> {
  const r = check<OrderResult>(await supabase.rpc("create_order", { p: body }));
  notify("order", r.order.id);
  return r;
}

// ---------- Admin (RLS: only users listed in public.admins) ----------
export async function isAdmin(): Promise<boolean> {
  const { data: s } = await supabase.auth.getSession();
  if (!s.session) return false;
  return check<boolean>(await supabase.rpc("is_admin"));
}

export async function fetchStats(today: string): Promise<AdminStats> {
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const r = await q;
    if (r.error) throw new DataError(r.error.message);
    return r.count ?? 0;
  };
  const head = { count: "exact" as const, head: true };
  const [pending, upcoming, unread, items] = await Promise.all([
    count(supabase.from("bookings").select("id", head).eq("status", "pending")),
    count(supabase.from("bookings").select("id", head).gte("date", today).in("status", ["pending", "confirmed"])),
    count(supabase.from("messages").select("id", head).eq("read", false)),
    count(supabase.from("menu_items").select("id", head)),
  ]);
  return { pending_bookings: pending, upcoming_bookings: upcoming, unread_messages: unread, menu_items: items };
}

const BOOKING_COLS = "id,code,name,phone,email,date,time,party_size,note,lang,status,created_at";

export async function listBookings(status: string): Promise<Booking[]> {
  let q = supabase.from("bookings").select(BOOKING_COLS).order("date").order("time");
  if (status !== "all") q = q.eq("status", status);
  return check<Booking[]>(await q);
}

export async function updateBookingStatus(id: string, status: BookingStatus): Promise<Booking> {
  const b = check<Booking>(await supabase.from("bookings").update({ status }).eq("id", id).select(BOOKING_COLS).single());
  if (status === "confirmed" || status === "cancelled") notify("booking_status", id);
  return b;
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

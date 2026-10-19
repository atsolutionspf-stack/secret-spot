// Hand-written mirrors of backend/models/restaurant.py — keep in sync.
export type Category = "burgers" | "alitas" | "poke" | "sides" | "sweets";
export type Tag = "vegan" | "spicy" | "star" | "new";
export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed";

export interface MenuItemBase {
  name: string;
  category: Category;
  description_es: string;
  description_en: string;
  price: number;
  price_note: string;
  tags: Tag[];
  allergens: string;
  available: boolean;
  sort_order: number;
}
export type MenuItemCreate = MenuItemBase;
export type MenuItemUpdate = Partial<MenuItemBase>;
export interface MenuItem extends MenuItemBase {
  id: string;
}

export interface BookingCreate {
  name: string;
  phone: string;
  email: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  party_size: number;
  note: string;
}
export interface Booking extends BookingCreate {
  id: string;
  code: string;
  status: BookingStatus;
  created_at: string;
}
export interface BookingStatusUpdate {
  status: BookingStatus;
}

export interface MessageCreate {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
}
export interface Message extends MessageCreate {
  id: string;
  read: boolean;
  created_at: string;
}
export interface MessageUpdate {
  read: boolean;
}

export interface HoursStatus {
  today: string;
  is_open: boolean;
  now_time: string;
  weekday: number; // 0=Mon..6=Sun
}

export interface PinLogin {
  pin: string;
}
export interface AdminMe {
  authenticated: boolean;
}
export interface AdminStats {
  pending_bookings: number;
  upcoming_bookings: number;
  unread_messages: number;
  menu_items: number;
}

export const CATEGORIES: Category[] = ["burgers", "alitas", "poke", "sides", "sweets"];
export const TAGS: Tag[] = ["vegan", "spicy", "star", "new"];
export const BOOKING_STATUSES: BookingStatus[] = ["pending", "confirmed", "cancelled", "completed"];

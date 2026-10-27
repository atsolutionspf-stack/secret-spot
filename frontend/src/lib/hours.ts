// Opening hours in Europe/Madrid. Mirrors the SQL rules in Supabase (_booking_error / _pickup_slots),
// which are the source of truth for bookings and orders.
import { useEffect, useState } from "react";
import type { HoursStatus } from "./types";

const OPEN_FROM = 19 * 60;
// weekday Mon=0 → service length in minutes from 19:00
const CLOSE_LEN: Record<number, number> = { 3: 300, 4: 360, 5: 360, 6: 360 };

export function slotsFor(weekdayMon0: number): string[] {
  const len = CLOSE_LEN[weekdayMon0];
  if (len === undefined) return [];
  const out: string[] = [];
  for (let m = OPEN_FROM; m <= OPEN_FROM + len - 30; m += 30) {
    const mm = m % (24 * 60);
    out.push(`${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`);
  }
  return out;
}

/** Minutes from 19:00 of the service day, so 00:30 sorts after 23:30. */
export function slotMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const mins = h * 60 + m;
  return mins < 12 * 60 ? mins + 24 * 60 : mins;
}

/** Monday=0 weekday for a YYYY-MM-DD string (timezone-independent). */
export function weekdayOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function madridNowParts(): HoursStatus {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  const now_time = `${get("hour")}:${get("minute")}`;
  const weekday = weekdayOf(today);
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  let open = weekday in CLOSE_LEN && minutes >= OPEN_FROM;
  const prev = (weekday + 6) % 7;
  if (!open && prev in CLOSE_LEN) {
    const tail = OPEN_FROM + CLOSE_LEN[prev] - 24 * 60;
    open = tail > 0 && minutes < tail;
  }
  return { today, now_time, weekday, is_open: open };
}

export function useHours(): HoursStatus {
  const [now, setNow] = useState(madridNowParts);
  useEffect(() => {
    const id = setInterval(() => setNow(madridNowParts()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

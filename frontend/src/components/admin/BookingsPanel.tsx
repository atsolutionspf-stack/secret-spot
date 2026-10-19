import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, MessageSquareText, Phone, Users } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { formatDate } from "@/lib/site";
import { BOOKING_STATUSES, type Booking, type BookingStatus, type BookingStatusUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  confirmed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  cancelled: "border-red-500/30 bg-red-500/10 text-red-400",
  completed: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400",
};

const ACTIONS: { status: BookingStatus; key: "confirm" | "cancel" | "complete"; cls: string }[] = [
  { status: "confirmed", key: "confirm", cls: "bg-emerald-500 text-black hover:bg-emerald-400" },
  { status: "completed", key: "complete", cls: "border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/10" },
  { status: "cancelled", key: "cancel", cls: "border border-red-500/40 text-red-300 hover:bg-red-500/10" },
];

export default function BookingsPanel() {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState<string>("all");
  const q = useQuery({
    queryKey: ["admin", "bookings", filter],
    queryFn: () => apiGet<Booking[]>(`/admin/bookings${filter === "all" ? "" : `?status=${filter}`}`),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: BookingStatusUpdate }) => apiPatch<Booking>(`/admin/bookings/${id}`, body),
    onSuccess: () => {
      toast.success(t.admin.updated);
      queryClient.invalidateQueries({ queryKey: ["admin", "bookings"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: () => toast.error(t.admin.error),
  });

  const rows = q.data && !q.isError ? q.data : [];
  const groups = rows.reduce<Record<string, Booking[]>>((acc, b) => {
    (acc[b.date] ||= []).push(b);
    return acc;
  }, {});
  const labels: Record<string, string> = { all: t.admin.all, ...t.admin.statuses };

  return (
    <div data-testid="admin-bookings-panel">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-sm text-stone-400">{t.admin.filter}</span>
        <Select value={filter} onValueChange={(v: string) => setFilter(v)}>
          <SelectTrigger data-testid="admin-bookings-filter" className="w-48 border-white/10 bg-[#141923]">
            <SelectValue>{(v) => labels[v as string]}</SelectValue>
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#141923]">
            {["all", ...BOOKING_STATUSES].map((s) => (
              <SelectItem key={s} value={s} data-testid={`admin-bookings-filter-${s}`}>{labels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 && !q.isLoading && (
        <p data-testid="admin-bookings-empty" className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-stone-400">{t.admin.noBookings}</p>
      )}

      <div className="space-y-8">
        {Object.entries(groups).map(([date, list]) => (
          <section key={date}>
            <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-widest text-stone-400 capitalize">{formatDate(date, lang)}</h3>
            <ul className="space-y-3">
              {list.map((b) => (
                <li key={b.id} data-testid={`admin-booking-${b.id}`} className="rounded-2xl border border-white/[0.07] bg-[#1C2331] p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-4">
                      <span className="rounded-xl bg-[#0B0E14] px-3 py-2 font-mono text-lg font-bold text-amber-400">{b.time}</span>
                      <div>
                        <p data-testid="admin-booking-name" className="font-semibold text-white">{b.name}</p>
                        <p className="flex items-center gap-1 text-sm text-stone-400">
                          <Users className="size-3.5" /> {b.party_size} {t.admin.guests} · <span className="font-mono text-xs">{b.code}</span>
                        </p>
                      </div>
                    </div>
                    <span data-testid="admin-booking-status" className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase", STATUS_STYLE[b.status])}>
                      {t.admin.statuses[b.status]}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-300">
                    <a href={`tel:${b.phone}`} className="inline-flex items-center gap-1 hover:text-amber-400"><Phone className="size-3.5" /> {b.phone}</a>
                    <a href={`mailto:${b.email}`} className="inline-flex items-center gap-1 break-all hover:text-amber-400"><Mail className="size-3.5" /> {b.email}</a>
                  </div>
                  {b.note && (
                    <p className="mt-2 flex items-start gap-1.5 text-sm text-stone-400"><MessageSquareText className="mt-0.5 size-3.5 shrink-0" /> {b.note}</p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ACTIONS.filter((a) => a.status !== b.status).map((a) => (
                      <button
                        key={a.key}
                        type="button"
                        data-testid={`admin-booking-${a.key}-button`}
                        disabled={update.isPending}
                        onClick={() => update.mutate({ id: b.id, body: { status: a.status } })}
                        className={cn("rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-50", a.cls)}
                      >
                        {t.admin[a.key]}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

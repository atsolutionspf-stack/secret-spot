import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Clock3, MessageSquareText, Phone, X } from "lucide-react";
import { toast } from "sonner";
import { listOrders, updateOrderStatus, type AdminOrder, type AdminOrderStatus } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { formatPrice } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_STYLE: Record<AdminOrderStatus, string> = {
  pending: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  preparing: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  ready: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
  collected: "border-white/10 bg-white/5 text-stone-400",
  cancelled: "border-red-500/30 bg-red-500/10 text-red-300",
};

type Filter = "all" | AdminOrderStatus;

export default function OrdersPanel() {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const q = useQuery({ queryKey: ["admin", "orders"], queryFn: listOrders, refetchInterval: 30_000 });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminOrderStatus }) => updateOrderStatus(id, status),
    onSuccess: () => {
      toast.success(t.admin.updated);
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
      toast.error(t.admin.error);
    },
  });

  const rows = useMemo(() => (q.data ?? []).filter((o) => filter === "all" || o.status === filter), [q.data, filter]);
  const labels = t.admin.orderStatuses;
  const fmt = new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid",
  });

  if (q.isLoading) {
    return <p className="rounded-2xl border border-white/10 p-8 text-center text-stone-400">{lang === "es" ? "Cargando pedidos…" : "Loading orders…"}</p>;
  }
  if (q.isError) {
    return <p role="alert" className="rounded-2xl border border-red-500/20 p-8 text-center text-red-300">{t.admin.error}</p>;
  }

  return (
    <div data-testid="admin-orders-panel">
      <div className="mb-5 flex items-center gap-3">
        <span className="text-sm text-stone-400">{t.admin.filter}</span>
        <Select value={filter} onValueChange={(v: string) => setFilter(v as Filter)}>
          <SelectTrigger data-testid="admin-orders-filter" className="w-56 border-white/10 bg-[#141923]">
            <SelectValue>{(v) => v === "all" ? t.admin.all : labels[v as AdminOrderStatus]}</SelectValue>
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#141923]">
            {(["all", "pending", "preparing", "ready", "collected", "cancelled"] as Filter[]).map((s) => (
              <SelectItem key={s} value={s} data-testid={`admin-orders-filter-${s}`}>{s === "all" ? t.admin.all : labels[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 && (
        <p data-testid="admin-orders-empty" className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-stone-400">{t.admin.noOrders}</p>
      )}

      <ul className="space-y-3">
        {rows.map((o: AdminOrder) => (
          <li key={o.id} data-testid={`admin-order-${o.id}`} className={cn("rounded-2xl border bg-[#1C2331] p-4 sm:p-5", o.status === "pending" ? "border-amber-500/30" : "border-white/[0.07]")}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-lg font-bold text-amber-400">{o.order_number}</p>
                <p className="mt-1 font-semibold text-white">{o.customer_name}</p>
                <a href={`tel:${o.customer_phone}`} className="mt-1 inline-flex items-center gap-1 text-sm text-stone-400 hover:text-amber-400"><Phone className="size-3.5" />{o.customer_phone}</a>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span data-testid="admin-order-status" className={cn("rounded-full border px-2.5 py-1 text-xs font-semibold uppercase", STATUS_STYLE[o.status])}>{labels[o.status]}</span>
                <span className="inline-flex items-center gap-1 text-xs text-stone-400"><Clock3 className="size-3.5" />{fmt.format(new Date(o.pickup_at))}</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-[#0B0E14] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-stone-500">{t.admin.orderItems}</p>
              <ul className="space-y-1.5">
                {(o.order_items ?? []).map((line) => (
                  <li key={line.id} className="flex justify-between gap-3 text-sm">
                    <span className="text-stone-200">{line.quantity} × {line.name}</span>
                    <span className="shrink-0 font-mono text-stone-400">{formatPrice(Number(line.line_total), lang)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-white/10 pt-2 font-semibold">
                <span className="text-stone-300">{t.admin.orderTotal}</span>
                <span className="font-mono text-amber-400">{formatPrice(Number(o.total), lang)}</span>
              </div>
            </div>

            {o.notes && <p className="mt-3 flex items-start gap-1.5 text-sm text-stone-400"><MessageSquareText className="mt-0.5 size-3.5 shrink-0" />{o.notes}</p>}

            {o.status === "pending" && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" data-testid="admin-order-accept-button" disabled={update.isPending} onClick={() => update.mutate({ id: o.id, status: "preparing" })} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-xs font-bold uppercase text-black hover:bg-emerald-400 disabled:opacity-50">
                  <Check className="size-3.5" />{t.admin.acceptOrder}
                </button>
                <button type="button" data-testid="admin-order-reject-button" disabled={update.isPending} onClick={() => update.mutate({ id: o.id, status: "cancelled" })} className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 px-4 py-2 text-xs font-bold uppercase text-red-300 hover:bg-red-500/10 disabled:opacity-50">
                  <X className="size-3.5" />{t.admin.rejectOrder}
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

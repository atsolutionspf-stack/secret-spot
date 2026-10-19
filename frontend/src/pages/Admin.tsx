import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { CalendarClock, ExternalLink, Inbox, LogOut, UtensilsCrossed } from "lucide-react";
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { endSession } from "@/lib/session";
import type { AdminMe, AdminStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { LangToggle } from "@/components/site/common";
import PinGate from "@/components/admin/PinGate";
import BookingsPanel from "@/components/admin/BookingsPanel";
import MessagesPanel from "@/components/admin/MessagesPanel";
import MenuPanel from "@/components/admin/MenuPanel";

type TabKey = "bookings" | "messages" | "menu";
const TABS: { k: TabKey; Icon: typeof Inbox }[] = [
  { k: "bookings", Icon: CalendarClock },
  { k: "messages", Icon: Inbox },
  { k: "menu", Icon: UtensilsCrossed },
];

function Dashboard() {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>("bookings");
  const stats = useQuery({ queryKey: ["admin", "stats"], queryFn: () => apiGet<AdminStats>("/admin/stats") });
  const s = stats.data && !stats.isError ? stats.data : null;
  const cards = [
    { k: "pending", label: t.admin.stats.pending, v: s?.pending_bookings, accent: "text-amber-400" },
    { k: "upcoming", label: t.admin.stats.upcoming, v: s?.upcoming_bookings, accent: "text-white" },
    { k: "unread", label: t.admin.stats.unread, v: s?.unread_messages, accent: "text-neon-soft" },
    { k: "items", label: t.admin.stats.items, v: s?.menu_items, accent: "text-cyan-400" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.k} data-testid={`admin-stat-${c.k}`} className="rounded-2xl border border-white/[0.07] bg-[#1C2331] p-4">
            <p className="text-xs uppercase tracking-wider text-stone-500">{c.label}</p>
            <p className={cn("mt-1 font-mono text-3xl font-bold", c.accent)}>{c.v ?? "–"}</p>
          </div>
        ))}
      </div>

      <div role="tablist" className="mt-8 flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-[#141923] p-1">
        {TABS.map(({ k, Icon }) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            data-testid={`admin-tab-${k}`}
            onClick={() => setTab(k)}
            className={cn("relative flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors", tab === k ? "text-white" : "text-stone-400 hover:text-white")}
          >
            {tab === k && <motion.span layoutId="admin-tab-pill" className="absolute inset-0 rounded-full bg-neon" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
            <Icon className="relative size-4" />
            <span className="relative">{t.admin.tabs[k]}</span>
            {k === "messages" && !!s?.unread_messages && (
              <span className="relative rounded-full bg-white px-1.5 font-mono text-[10px] font-bold text-black">{s.unread_messages}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "bookings" && <BookingsPanel />}
        {tab === "messages" && <MessagesPanel />}
        {tab === "menu" && <MenuPanel />}
      </div>
    </div>
  );
}

export default function Admin() {
  const { t } = useI18n();
  const me = useQuery({ queryKey: ["admin", "me"], queryFn: () => apiGet<AdminMe>("/admin/me"), retry: false });
  const authed = !!me.data?.authenticated && !me.isError;

  return (
    <div className="min-h-screen bg-[#0B0E14] text-stone-100" data-testid="admin-page">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B0E14]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-lg font-black uppercase text-white">Secret</span>
            <span className="font-heading text-lg font-black uppercase neon-text">Spot</span>
            <span className="hidden font-mono text-xs uppercase tracking-widest text-stone-500 sm:inline">/ admin</span>
          </div>
          <div className="flex items-center gap-2">
            <LangToggle />
            <Link to="/" data-testid="admin-view-site-link" className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-stone-300 hover:text-white">
              <ExternalLink className="size-3.5" /> <span className="hidden sm:inline">{t.admin.backToSite}</span>
            </Link>
            {authed && (
              <button
                type="button"
                data-testid="admin-logout-button"
                onClick={() => endSession("/admin")}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-stone-300 hover:border-red-400/50 hover:text-red-300"
              >
                <LogOut className="size-3.5" /> {t.admin.logout}
              </button>
            )}
          </div>
        </div>
      </header>
      {me.isLoading ? null : authed ? <Dashboard /> : <PinGate />}
    </div>
  );
}

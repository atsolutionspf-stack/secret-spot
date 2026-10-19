import { motion } from "motion/react";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { useHours } from "@/lib/hours";
import { cn } from "@/lib/utils";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionLabel({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p data-testid={testId} className="font-mono text-xs font-semibold uppercase tracking-[0.25em] text-amber-400/90">
      <span className="mr-2 inline-block h-px w-8 translate-y-[-3px] bg-neon align-middle" />
      {children}
    </p>
  );
}

export function OpenBadge({ className, testId = "open-status-badge" }: { className?: string; testId?: string }) {
  const { t } = useI18n();
  const { is_open } = useHours();
  return (
    <span
      data-testid={testId}
      data-open={is_open}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
        is_open ? "border-emerald-500/30 bg-[#062E20] text-emerald-400" : "border-red-500/25 bg-[#2A1818] text-red-400",
        className,
      )}
    >
      <span className={cn("size-2 rounded-full", is_open ? "animate-glow bg-emerald-400" : "bg-red-400")} />
      {is_open ? t.status.open : t.status.closed}
    </span>
  );
}

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={cn("inline-flex rounded-full border border-white/10 bg-white/5 p-0.5 font-mono text-xs", className)}>
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          data-testid={`lang-toggle-${l}`}
          onClick={() => setLang(l)}
          className={cn(
            "rounded-full px-2.5 py-1 font-semibold uppercase transition-colors duration-200",
            lang === l ? "bg-neon text-white" : "text-stone-400 hover:text-stone-100",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function HoursList({ testIdPrefix = "hours" }: { testIdPrefix?: string }) {
  const { t } = useI18n();
  const { weekday } = useHours();
  const rows = [
    { key: "mon-wed", label: t.hours.monWed, value: t.hours.closed, days: [0, 1, 2] },
    { key: "thu", label: t.hours.thu, value: "19:00 – 00:00", days: [3] },
    { key: "fri-sun", label: t.hours.friSun, value: "19:00 – 01:00", days: [4, 5, 6] },
  ];
  return (
    <ul className="divide-y divide-white/5">
      {rows.map((r) => {
        const isToday = r.days.includes(weekday);
        return (
          <li
            key={r.key}
            data-testid={`${testIdPrefix}-row-${r.key}`}
            className={cn("flex items-center justify-between gap-4 py-2.5 text-sm", isToday ? "text-white" : "text-stone-400")}
          >
            <span className="flex items-center gap-2">
              {isToday && <span className="size-1.5 rounded-full bg-neon" />}
              {r.label}
            </span>
            <span className={cn("font-mono", r.value === t.hours.closed ? "text-stone-500" : "text-amber-400")}>{r.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

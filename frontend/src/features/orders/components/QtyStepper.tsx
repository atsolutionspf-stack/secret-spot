import { Minus, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_QTY } from "../cart";

export function QtyStepper({
  value,
  onChange,
  testId,
  size = "md",
}: {
  value: number;
  onChange: (q: number) => void;
  testId: string;
  size?: "sm" | "md";
}) {
  const btn = cn(
    "inline-flex items-center justify-center rounded-full border border-white/10 bg-[#1C2331] text-white transition-[transform,background-color] duration-150 hover:bg-[#232B3B] active:scale-90 disabled:opacity-40",
    size === "sm" ? "size-8" : "size-10",
  );
  return (
    <div className="inline-flex items-center gap-1.5" data-testid={testId}>
      <button type="button" aria-label="-" data-testid={`${testId}-decrease`} className={btn} onClick={() => onChange(value - 1)}>
        {value === 1 ? <Trash2 className="size-3.5 text-red-300" /> : <Minus className="size-4" />}
      </button>
      <span data-testid={`${testId}-value`} className="w-7 text-center font-mono text-base font-bold text-white">
        {value}
      </span>
      <button
        type="button"
        aria-label="+"
        data-testid={`${testId}-increase`}
        className={btn}
        disabled={value >= MAX_QTY}
        onClick={() => onChange(value + 1)}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

import { Bean, Carrot, Egg, Fish, Flower, Milk, Nut, Shell, Shrimp, Sprout, Wheat, Wine, CircleDot, Leaf } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/lib/i18n";

// Index 0 = allergen #1. Numbering follows the restaurant's own list.
const ICONS: LucideIcon[] = [Wheat, Shrimp, Egg, Fish, Nut, Bean, Milk, Nut, Carrot, CircleDot, Sprout, Wine, Flower, Shell];

/** "1, 3, 10" → [1, 3, 10] (ignores anything outside 1–14). */
export function parseAllergens(raw: string): number[] {
  return Array.from(
    new Set(
      raw
        .split(/[^0-9]+/)
        .map(Number)
        .filter((n) => Number.isInteger(n) && n >= 1 && n <= 14),
    ),
  ).sort((a, b) => a - b);
}

export function AllergenChips({ raw }: { raw: string }) {
  const { t } = useI18n();
  const nums = parseAllergens(raw);
  if (!nums.length) return null;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t.menu.allergens} data-testid="menu-item-allergens">
      {nums.map((n) => {
        const Icon = ICONS[n - 1] ?? Leaf;
        return (
          <li
            key={n}
            data-testid={`menu-allergen-${n}`}
            title={`${n}. ${t.menu.allergenNames[n - 1]}`}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#0B0E14] px-2 py-0.5 text-[11px] text-stone-300"
          >
            <Icon className="size-3 text-amber-400" />
            {t.menu.allergenNames[n - 1]}
          </li>
        );
      })}
    </ul>
  );
}

export function AllergenLegend() {
  const { t } = useI18n();
  return (
    <div data-testid="allergen-legend" className="mt-10 rounded-2xl border border-white/[0.07] bg-[#141923] p-5 sm:p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">{t.menu.allergenLegend}</p>
        <p className="text-xs text-stone-500">{t.menu.allergenHint}</p>
      </div>
      <ol className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 lg:grid-cols-7">
        {t.menu.allergenNames.map((name, i) => {
          const Icon = ICONS[i];
          return (
            <li key={i} data-testid={`allergen-legend-${i + 1}`} className="flex items-center gap-2 text-sm text-stone-300">
              <span className="w-5 text-right font-mono text-xs text-stone-500">{i + 1}</span>
              <Icon className="size-4 shrink-0 text-amber-400" />
              {name}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

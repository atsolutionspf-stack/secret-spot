import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { Flame, Leaf, Sparkles, Star } from "lucide-react";
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { IMAGES, formatPrice } from "@/lib/site";
import { CATEGORIES, type Category, type MenuItem, type Tag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Reveal, SectionLabel } from "./common";
import { AllergenChips, AllergenLegend } from "./Allergens";

const TAG_STYLE: Record<Tag, { cls: string; Icon: typeof Leaf }> = {
  vegan: { cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400", Icon: Leaf },
  spicy: { cls: "border-red-500/30 bg-red-500/10 text-red-400", Icon: Flame },
  star: { cls: "border-amber-500/30 bg-amber-500/10 text-amber-400", Icon: Star },
  new: { cls: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400", Icon: Sparkles },
};

export function TagBadge({ tag, label }: { tag: Tag; label: string }) {
  const { cls, Icon } = TAG_STYLE[tag];
  return (
    <span data-testid={`menu-tag-${tag}`} className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", cls)}>
      <Icon className="size-3" /> {label}
    </span>
  );
}

export default function MenuSection() {
  const { t, lang } = useI18n();
  const [cat, setCat] = useState<Category>("burgers");
  const { data, isLoading, isError } = useQuery({ queryKey: ["menu"], queryFn: () => apiGet<MenuItem[]>("/menu") });
  const items = !isError && data ? data.filter((i) => i.category === cat) : [];

  return (
    <section id="menu" data-testid="menu-section" className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <Reveal className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <SectionLabel>{t.menu.label}</SectionLabel>
          <h2 data-testid="menu-title" className="mt-4 font-heading text-5xl font-black uppercase leading-[0.9] tracking-tight text-white sm:text-6xl">
            {t.menu.title}
          </h2>
        </div>
        <p className="max-w-sm text-stone-400">{t.menu.subtitle}</p>
      </Reveal>

      <div className="sticky top-16 z-30 -mx-4 mt-10 overflow-x-auto bg-[#0B0E14]/90 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-full sm:border sm:border-white/10 sm:px-2 sm:py-2">
        <div role="tablist" className="flex w-max gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={cat === c}
              data-testid={`menu-tab-${c}`}
              onClick={() => setCat(c)}
              className={cn(
                "relative rounded-full px-5 py-2.5 font-heading text-sm font-bold uppercase tracking-wide transition-colors duration-200",
                cat === c ? "text-white" : "text-stone-400 hover:text-stone-100",
              )}
            >
              {cat === c && (
                <motion.span layoutId="menu-tab-pill" className="absolute inset-0 rounded-full bg-neon shadow-[0_0_24px_-6px_rgba(255,87,34,.9)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
              )}
              <span className="relative">{t.menu.categories[c]}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={cat}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
          className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 lg:col-span-4">
            <img src={IMAGES[cat]} alt={t.menu.categories[cat]} className="h-56 w-full object-cover lg:h-full lg:min-h-[420px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <p className="font-heading text-4xl font-black uppercase text-white">{t.menu.categories[cat]}</p>
              {cat === "burgers" && <p data-testid="menu-burgers-note" className="mt-2 text-sm text-amber-300">{t.menu.burgersNote}</p>}
            </div>
          </div>

          <div className="lg:col-span-8">
            {isLoading && <p data-testid="menu-loading" className="py-10 text-stone-400">{t.menu.loading}</p>}
            {!isLoading && items.length === 0 && (
              <p data-testid="menu-empty" className="rounded-2xl border border-dashed border-white/10 p-8 text-stone-400">{t.menu.empty}</p>
            )}
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {items.map((item, i) => (
                <motion.li
                  key={item.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04, duration: 0.3 }}
                  data-testid={`menu-item-${item.id}`}
                  className="group flex flex-col rounded-2xl border border-white/[0.07] bg-[#1C2331] p-5 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-[0_10px_30px_-10px_rgba(255,87,34,0.25)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 data-testid="menu-item-name" className="font-heading text-lg font-bold uppercase leading-tight text-white">{item.name}</h3>
                    <p data-testid="menu-item-price" className="shrink-0 font-mono text-lg font-bold text-amber-400">
                      {formatPrice(item.price, lang)}
                      {item.price_note && <span className="ml-1 text-xs font-normal text-stone-400">/{lang === "es" ? item.price_note : t.menu.perUnit}</span>}
                    </p>
                  </div>
                  <p data-testid="menu-item-description" className="mt-2 text-sm leading-relaxed text-stone-400">
                    {lang === "es" ? item.description_es : item.description_en || item.description_es}
                  </p>
                  <div className="mt-auto flex flex-col gap-3 pt-4">
                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap items-center gap-2">
                        {item.tags.map((tag) => (
                          <TagBadge key={tag} tag={tag} label={t.menu.tags[tag]} />
                        ))}
                      </div>
                    )}
                    <AllergenChips raw={item.allergens} />
                  </div>
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </AnimatePresence>

      <AllergenLegend />
    </section>
  );
}

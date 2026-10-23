import { ShoppingBag } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useCart } from "../CartProvider";
import { useOrderingVisible } from "../orderService";

type Variant = "header" | "hero" | "menu" | "mobile";

const STYLES: Record<Variant, string> = {
  header:
    "hidden sm:inline-flex items-center gap-2 rounded-full border border-amber-400/50 bg-amber-400/10 px-4 py-2 text-sm font-bold text-amber-300 transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-amber-400/20",
  hero:
    "whitespace-nowrap inline-flex items-center justify-center gap-2 rounded-full border border-amber-400/60 bg-amber-400/10 px-7 py-4 font-heading text-base font-bold uppercase tracking-wide text-amber-300 backdrop-blur transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-amber-400/20",
  menu:
    "inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-3 font-heading text-sm font-bold uppercase tracking-wide text-black transition-[transform,background-color] duration-200 hover:-translate-y-0.5 hover:bg-amber-300",
  mobile:
    "relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-3 text-sm font-bold text-amber-300 active:bg-white/10",
};

export default function OrderButton({ variant, className }: { variant: Variant; className?: string }) {
  const { t } = useI18n();
  const { count, open } = useCart();
  const visible = useOrderingVisible();
  if (!visible) return null;
  const label = variant === "hero" ? t.order.ctaLong : variant === "mobile" ? t.order.short : t.order.cta;
  return (
    <button type="button" data-testid={`order-open-button-${variant}`} onClick={open} className={cn(STYLES[variant], className)}>
      <ShoppingBag className="size-4" />
      {label}
      {count > 0 && (
        <span
          data-testid={`order-cart-count-${variant}`}
          className={cn(
            "rounded-full bg-neon px-1.5 font-mono text-[11px] font-bold leading-5 text-white",
            variant === "mobile" && "absolute right-1 top-0.5",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

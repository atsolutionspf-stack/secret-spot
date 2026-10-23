import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, FlaskConical, MapPin, Phone, ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { SITE, formatPrice } from "@/lib/site";
import { CATEGORIES, type Category, type MenuItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { TagBadge } from "@/components/site/MenuSection";
import { fromCents, priceCart, pruneCart, quantityOf, type PricedCart } from "../cart";
import { useCart } from "../CartProvider";
import { orderErrorCode, orderKeys, submitOrder, useOrderConfig } from "../orderService";
import type { OrderConfig, OrderCreate, OrderResult } from "../types";
import { QtyStepper } from "./QtyStepper";

type Step = "menu" | "cart" | "details" | "summary" | "done";
const STEPS: Exclude<Step, "done">[] = ["menu", "cart", "details", "summary"];

interface Details {
  customer_name: string;
  customer_phone: string;
  pickup_time: string;
  notes: string;
}
const EMPTY_DETAILS: Details = { customer_name: "", customer_phone: "", pickup_time: "", notes: "" };

const field =
  "h-12 rounded-xl border-white/10 bg-[#141923] text-base text-white placeholder:text-stone-500 focus-visible:border-amber-500/60 focus-visible:ring-amber-500/30";

const primaryBtn =
  "flex h-14 w-full items-center justify-center gap-2 rounded-full bg-neon font-heading text-base font-bold uppercase tracking-wide text-white shadow-[0_0_32px_-8px_rgba(255,87,34,.9)] transition-[transform,opacity] duration-200 hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none";

/* ------------------------------ Steps ------------------------------ */

function MenuStep({ menu, loading }: { menu: MenuItem[]; loading: boolean }) {
  const { t, lang } = useI18n();
  const cart = useCart();
  const [cat, setCat] = useState<Category>("burgers");
  const items = menu.filter((m) => m.category === cat);
  return (
    <div>
      <div className="sticky top-0 z-10 -mx-5 overflow-x-auto bg-[#0B0E14]/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex w-max gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              data-testid={`order-category-${c}`}
              onClick={() => setCat(c)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wide transition-colors duration-200",
                cat === c ? "bg-neon text-white" : "bg-white/5 text-stone-400 hover:text-white",
              )}
            >
              {t.menu.categories[c]}
            </button>
          ))}
        </div>
      </div>
      {loading && <p className="py-8 text-stone-400">{t.menu.loading}</p>}
      {!loading && items.length === 0 && <p className="py-8 text-stone-400">{t.menu.empty}</p>}
      <ul className="divide-y divide-white/5">
        {items.map((m) => {
          const q = quantityOf(cart.lines, m.id);
          return (
            <li key={m.id} data-testid={`order-menu-item-${m.id}`} className="flex items-start gap-3 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p data-testid="order-menu-item-name" className="font-heading font-bold uppercase text-white">{m.name}</p>
                  {m.tags.map((tag) => <TagBadge key={tag} tag={tag} label={t.menu.tags[tag]} />)}
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-stone-400">{lang === "es" ? m.description_es : m.description_en || m.description_es}</p>
                <p data-testid="order-menu-item-price" className="mt-1.5 font-mono text-sm font-bold text-amber-400">
                  {formatPrice(m.price, lang)}
                  {m.price_note && <span className="ml-1 text-xs font-normal text-stone-500">{t.order.each}</span>}
                </p>
              </div>
              <div className="shrink-0 pt-1">
                {q > 0 ? (
                  <QtyStepper size="sm" value={q} onChange={(n) => cart.set(m.id, n)} testId={`order-qty-${m.id}`} />
                ) : (
                  <button
                    type="button"
                    data-testid={`order-add-${m.id}`}
                    onClick={() => {
                      cart.add(m.id);
                      toast.success(`${m.name} · ${t.order.added}`, { duration: 1500 });
                    }}
                    className="rounded-full border border-amber-400/50 px-4 py-2 text-sm font-bold text-amber-300 transition-[background-color,transform] duration-150 hover:bg-amber-400/15 active:scale-95"
                  >
                    + {t.order.add}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Totals({ priced }: { priced: PricedCart }) {
  const { t, lang } = useI18n();
  return (
    <dl className="space-y-1.5 text-sm">
      <div className="flex justify-between text-stone-400">
        <dt>{t.order.subtotal}</dt>
        <dd data-testid="order-subtotal" className="font-mono">{formatPrice(fromCents(priced.subtotalCents), lang)}</dd>
      </div>
      <div className="flex justify-between border-t border-white/10 pt-2 text-lg font-bold text-white">
        <dt>{t.order.total}</dt>
        <dd data-testid="order-total" className="font-mono text-amber-400">{formatPrice(fromCents(priced.totalCents), lang)}</dd>
      </div>
    </dl>
  );
}

function CartStep({ priced, onBrowse }: { priced: PricedCart; onBrowse: () => void }) {
  const { t, lang } = useI18n();
  const cart = useCart();
  if (priced.rows.length === 0) {
    return (
      <div data-testid="order-cart-empty" className="flex flex-col items-center py-16 text-center">
        <ShoppingBag className="size-10 text-stone-600" />
        <p className="mt-4 font-semibold text-white">{t.order.empty}</p>
        <p className="mt-1 text-sm text-stone-400">{t.order.emptyHint}</p>
        <button type="button" data-testid="order-cart-browse" onClick={onBrowse} className="mt-6 rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white hover:border-amber-400/60">
          {t.order.keepOrdering}
        </button>
      </div>
    );
  }
  return (
    <div className="py-4">
      <ul className="space-y-3">
        {priced.rows.map((r) => (
          <li key={r.item.id} data-testid={`order-cart-line-${r.item.id}`} className="rounded-2xl border border-white/[0.07] bg-[#1C2331] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p data-testid="order-cart-line-name" className="font-heading font-bold uppercase text-white">{r.item.name}</p>
                <p data-testid="order-cart-line-unit" className="font-mono text-xs text-stone-400">
                  {formatPrice(fromCents(r.unitCents), lang)} {t.order.each}
                </p>
              </div>
              <p data-testid="order-cart-line-total" className="font-mono text-base font-bold text-amber-400">{formatPrice(fromCents(r.lineCents), lang)}</p>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <QtyStepper size="sm" value={r.quantity} onChange={(n) => cart.set(r.item.id, n)} testId={`order-cart-qty-${r.item.id}`} />
              <button type="button" data-testid={`order-cart-remove-${r.item.id}`} onClick={() => cart.remove(r.item.id)} className="text-xs font-semibold text-stone-400 hover:text-red-300">
                {t.order.remove}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" data-testid="order-keep-ordering" onClick={onBrowse} className="mt-4 text-sm font-semibold text-amber-400 hover:text-amber-300">
        + {t.order.keepOrdering}
      </button>
      <div className="mt-6 rounded-2xl border border-white/[0.07] bg-[#141923] p-4">
        <Totals priced={priced} />
      </div>
    </div>
  );
}

function DetailsStep({ details, setDetails, config }: { details: Details; setDetails: (d: Details) => void; config: OrderConfig | null }) {
  const { t } = useI18n();
  const set = (k: keyof Details, v: string) => setDetails({ ...details, [k]: v });
  const slots = config?.pickup_slots ?? [];
  return (
    <div data-testid="order-details-form" className="grid gap-5 py-5">
      <div className="space-y-2">
        <Label htmlFor="o-name" className="text-stone-300">{t.order.name} *</Label>
        <Input id="o-name" data-testid="order-name-input" autoComplete="name" maxLength={80} className={field} value={details.customer_name} onChange={(e) => set("customer_name", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="o-phone" className="text-stone-300">{t.order.phone} *</Label>
        <Input id="o-phone" type="tel" data-testid="order-phone-input" autoComplete="tel" maxLength={25} className={field} value={details.customer_phone} onChange={(e) => set("customer_phone", e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label className="text-stone-300">{t.order.pickupTime} *</Label>
        <Select value={details.pickup_time} onValueChange={(v: string) => set("pickup_time", v)} disabled={slots.length === 0}>
          <SelectTrigger data-testid="order-pickup-select" className={cn(field, "w-full")}>
            <Clock className="size-4 text-amber-400" />
            <SelectValue>{(v) => (v ? (v as string) : t.order.pickPickup)}</SelectValue>
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-[#141923]">
            {slots.map((s) => (
              <SelectItem key={s} value={s} data-testid={`order-pickup-option-${s.replace(":", "")}`}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {config && <p className="text-xs text-stone-500">{t.order.prepNote.replace("{n}", String(config.prep_minutes))}</p>}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="o-notes" className="text-stone-300">{t.order.notes}</Label>
          <span className="font-mono text-xs text-stone-500">{details.notes.length} / 500</span>
        </div>
        <Textarea id="o-notes" data-testid="order-notes-input" maxLength={500} placeholder={t.order.notesPh} className="min-h-24 rounded-xl border-white/10 bg-[#141923] text-base text-white placeholder:text-stone-500" value={details.notes} onChange={(e) => set("notes", e.target.value)} />
      </div>
    </div>
  );
}

function SummaryStep({ priced, details }: { priced: PricedCart; details: Details }) {
  const { t, lang } = useI18n();
  const info = [
    { k: "pickup", label: t.order.pickupAt, v: t.order.todayAt.replace("{time}", details.pickup_time) },
    { k: "customer", label: t.order.customer, v: `${details.customer_name.trim()} · ${details.customer_phone.trim()}` },
    { k: "where", label: t.order.where, v: `Secret Spot · ${SITE.addressLine1}` },
    { k: "payment", label: t.order.payment, v: t.order.paymentValue },
  ];
  return (
    <div data-testid="order-summary" className="space-y-5 py-5">
      <p className="text-sm text-stone-300">{t.order.summaryTitle}</p>
      <dl className="divide-y divide-white/5 rounded-2xl border border-white/[0.07] bg-[#141923] px-4">
        {info.map((i) => (
          <div key={i.k} className="flex justify-between gap-4 py-3 text-sm">
            <dt className="text-stone-500">{i.label}</dt>
            <dd data-testid={`order-summary-${i.k}`} className="text-right text-white">{i.v}</dd>
          </div>
        ))}
        {details.notes.trim() && (
          <div className="py-3 text-sm">
            <dt className="text-stone-500">{t.order.notes}</dt>
            <dd data-testid="order-summary-notes" className="mt-1 whitespace-pre-wrap text-white">{details.notes.trim()}</dd>
          </div>
        )}
      </dl>
      <div className="rounded-2xl border border-white/[0.07] bg-[#1C2331] p-4">
        <ul className="mb-4 space-y-2">
          {priced.rows.map((r) => (
            <li key={r.item.id} data-testid={`order-summary-line-${r.item.id}`} className="flex justify-between gap-3 text-sm">
              <span className="text-white">
                <span className="font-mono text-amber-400">{r.quantity}×</span> {r.item.name}
              </span>
              <span className="font-mono text-stone-300">{formatPrice(fromCents(r.lineCents), lang)}</span>
            </li>
          ))}
        </ul>
        <Totals priced={priced} />
      </div>
    </div>
  );
}

function DoneStep({ result }: { result: OrderResult }) {
  const { t, lang } = useI18n();
  const { order, persisted } = result;
  return (
    <div data-testid="order-confirmation" data-persisted={persisted} className="space-y-5 py-6">
      <span className={cn("inline-flex size-14 items-center justify-center rounded-full", persisted ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400")}>
        {persisted ? <CheckCircle2 className="size-8" /> : <FlaskConical className="size-7" />}
      </span>
      <div>
        <h3 data-testid="order-confirmation-title" className="font-heading text-3xl font-black uppercase text-white">
          {persisted ? t.order.doneTitle : t.order.doneTitleDemo}
        </h3>
        <p data-testid="order-confirmation-message" className="mt-2 text-stone-300">
          {persisted ? t.order.doneBody.replace("{time}", order.pickup_time) : t.order.doneBodyDemo}
        </p>
        {!persisted && (
          <a href={SITE.phoneHref} data-testid="order-confirmation-call" className="mt-3 inline-flex items-center gap-2 font-mono font-semibold text-amber-400">
            <Phone className="size-4" /> {SITE.phone}
          </a>
        )}
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#141923] p-5">
        <p className="text-xs uppercase tracking-wider text-stone-500">{t.order.orderNumber}</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p data-testid="order-confirmation-number" className="font-mono text-2xl font-bold text-amber-400">{order.order_number}</p>
          {!persisted && (
            <span data-testid="order-confirmation-test-badge" className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-300">
              {t.order.testOrder}
            </span>
          )}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-stone-500">{t.order.pickupAt}</dt>
            <dd data-testid="order-confirmation-pickup" className="font-mono text-white">{t.order.todayAt.replace("{time}", order.pickup_time)}</dd>
          </div>
          <div>
            <dt className="text-stone-500">{t.order.total}</dt>
            <dd data-testid="order-confirmation-total" className="font-mono font-bold text-amber-400">{formatPrice(order.total, lang)}</dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-1 border-t border-white/5 pt-3 text-sm">
          {order.items.map((l) => (
            <li key={l.menu_item_id} className="flex justify-between gap-3 text-stone-300">
              <span>{l.quantity}× {l.name}</span>
              <span className="font-mono">{formatPrice(l.line_total, lang)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="flex items-center gap-2 text-sm text-stone-400">
        <MapPin className="size-4 text-amber-400" /> Secret Spot · {SITE.addressLine1}
      </p>
    </div>
  );
}

/* ------------------------------ Sheet ------------------------------ */

export default function OrderSheet() {
  const { t, lang } = useI18n();
  const cart = useCart();
  const menuQ = useQuery({ queryKey: ["menu"], queryFn: () => apiGet<MenuItem[]>("/menu") });
  const cfgQ = useOrderConfig();
  const menu = useMemo(() => (menuQ.data && !menuQ.isError ? menuQ.data : []), [menuQ.data, menuQ.isError]);
  const config = cfgQ.data && !cfgQ.isError ? cfgQ.data : null;
  const priced = useMemo(() => priceCart(cart.lines, menu), [cart.lines, menu]);

  const [step, setStep] = useState<Step>("menu");
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [result, setResult] = useState<OrderResult | null>(null);

  // Drop items that disappeared from the menu (hidden by the owner / deleted).
  const { replace, lines } = cart;
  useEffect(() => {
    if (menuQ.isSuccess && priced.missing.length > 0) {
      replace(pruneCart(lines, menu));
      toast.warning(t.order.missing);
    }
  }, [menuQ.isSuccess, priced.missing.length, replace, lines, menu, t.order.missing]);

  // A chosen pickup slot can expire while the sheet is open.
  useEffect(() => {
    if (config && details.pickup_time && !config.pickup_slots.includes(details.pickup_time)) {
      setDetails((d) => ({ ...d, pickup_time: "" }));
    }
  }, [config, details.pickup_time]);

  const submit = useMutation({
    mutationFn: (body: OrderCreate) => submitOrder(body),
    onSuccess: (res) => {
      setResult(res);
      setStep("done");
      cart.clear();
      setDetails((d) => ({ ...d, pickup_time: "", notes: "" }));
      queryClient.invalidateQueries({ queryKey: orderKeys.config });
    },
    onError: (err) => {
      const code = orderErrorCode(err);
      toast.error(t.order.errors[code] ?? t.order.errors.generic);
      if (code === "invalid_pickup_time" || code === "closed" || code === "last_orders") {
        queryClient.invalidateQueries({ queryKey: orderKeys.config });
        setStep("details");
      } else if (code === "item_unavailable") {
        queryClient.invalidateQueries({ queryKey: ["menu"] });
        setStep("cart");
      }
    },
  });

  const accepting = !!config?.accepting;
  const isDemo = config?.mode !== "supabase";
  const detailsValid =
    details.customer_name.trim().length >= 2 &&
    details.customer_phone.trim().length >= 6 &&
    !!config?.pickup_slots.includes(details.pickup_time);

  const onOpenChange = (o: boolean) => {
    cart.setOpen(o);
    if (!o && step === "done") {
      setStep("menu");
      setResult(null);
    }
  };

  const confirm = () => {
    submit.mutate({
      customer_name: details.customer_name.trim(),
      customer_phone: details.customer_phone.trim(),
      notes: details.notes.trim(),
      pickup_time: details.pickup_time,
      items: priced.rows.map((r) => ({ menu_item_id: r.item.id, quantity: r.quantity })),
    });
  };

  const stepIndex = step === "done" ? STEPS.length : STEPS.indexOf(step);
  const blockedMsg = !config ? t.order.unavailable : config.reason === "last_orders" ? t.order.lastOrders : t.order.closed;
  const itemsLabel = `${priced.itemCount} ${priced.itemCount === 1 ? t.order.item : t.order.items}`;

  return (
    <Sheet open={cart.isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        data-testid="order-sheet"
        className="flex h-full flex-col gap-0 border-white/10 bg-[#0B0E14] p-0 text-stone-100 data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        {/* Header */}
        <div className="border-b border-white/10 px-5 pb-4 pt-5 sm:px-6">
          <div className="flex items-center gap-2 pr-10">
            {step !== "menu" && step !== "done" && (
              <button
                type="button"
                data-testid="order-back-button"
                aria-label={t.order.back}
                onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)])}
                className="-ml-1 rounded-full p-1.5 text-stone-300 hover:bg-white/5 hover:text-white"
              >
                <ArrowLeft className="size-5" />
              </button>
            )}
            <SheetTitle className="font-heading text-2xl font-black uppercase text-white">{t.order.title}</SheetTitle>
          </div>
          <SheetDescription className="mt-1 flex items-center gap-1.5 text-xs text-stone-400">
            <Store className="size-3.5 text-amber-400" /> {t.order.pickupOnly}
          </SheetDescription>

          {step !== "done" && (
            <ol className="mt-4 grid grid-cols-4 gap-1.5" data-testid="order-steps">
              {STEPS.map((s, i) => (
                <li key={s} data-testid={`order-step-${s}`} data-active={i === stepIndex}>
                  <span className={cn("block h-1 rounded-full transition-colors duration-300", i <= stepIndex ? "bg-neon" : "bg-white/10")} />
                  <span className={cn("mt-1.5 block text-[11px] font-semibold uppercase tracking-wide", i === stepIndex ? "text-white" : "text-stone-500")}>
                    {t.order.steps[s]}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {isDemo && (
            <p data-testid="order-demo-banner" className="mt-4 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium leading-relaxed text-amber-200">
              <FlaskConical className="mt-0.5 size-4 shrink-0" /> {t.order.demoBanner}
            </p>
          )}
          {!accepting && step !== "done" && (
            <p data-testid="order-closed-banner" className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/25 bg-[#2A1818] p-3 text-xs leading-relaxed text-red-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {blockedMsg}
            </p>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.22 }}>
              {step === "menu" && <MenuStep menu={menu} loading={menuQ.isLoading} />}
              {step === "cart" && <CartStep priced={priced} onBrowse={() => setStep("menu")} />}
              {step === "details" && <DetailsStep details={details} setDetails={setDetails} config={config} />}
              {step === "summary" && <SummaryStep priced={priced} details={details} />}
              {step === "done" && result && <DoneStep result={result} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10 bg-[#0B0E14] px-5 pb-5 pt-4 sm:px-6">
          {step === "menu" && (
            <button type="button" data-testid="order-view-cart-button" disabled={priced.rows.length === 0} onClick={() => setStep("cart")} className={primaryBtn}>
              <ShoppingBag className="size-5" />
              {t.order.viewCart} · {itemsLabel} · {formatPrice(fromCents(priced.totalCents), lang)}
            </button>
          )}
          {step === "cart" && (
            <button type="button" data-testid="order-continue-button" disabled={priced.rows.length === 0 || !accepting} onClick={() => setStep("details")} className={primaryBtn}>
              {t.order.continue} · {formatPrice(fromCents(priced.totalCents), lang)}
            </button>
          )}
          {step === "details" && (
            <button
              type="button"
              data-testid="order-review-button"
              disabled={!accepting}
              onClick={() => (detailsValid ? setStep("summary") : toast.error(t.order.required))}
              className={primaryBtn}
            >
              {t.order.review}
            </button>
          )}
          {step === "summary" && (
            <div className="space-y-2">
              <button type="button" data-testid="order-confirm-button" disabled={submit.isPending || !accepting || priced.rows.length === 0} onClick={confirm} className={primaryBtn}>
                {submit.isPending ? t.order.confirming : `${t.order.confirm} · ${formatPrice(fromCents(priced.totalCents), lang)}`}
              </button>
              <button type="button" data-testid="order-edit-button" onClick={() => setStep("cart")} className="w-full py-2 text-sm font-semibold text-stone-400 hover:text-white">
                {t.order.edit}
              </button>
            </div>
          )}
          {step === "done" && (
            <div className="grid grid-cols-2 gap-2">
              <button type="button" data-testid="order-new-button" onClick={() => { setResult(null); setStep("menu"); }} className="h-12 rounded-full border border-white/15 text-sm font-semibold text-white hover:border-amber-400/60">
                {t.order.newOrder}
              </button>
              <button type="button" data-testid="order-close-button" onClick={() => onOpenChange(false)} className="h-12 rounded-full bg-white text-sm font-bold text-black hover:bg-amber-400">
                {t.order.close}
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

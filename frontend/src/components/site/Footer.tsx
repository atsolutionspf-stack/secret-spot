import { Link } from "react-router-dom";
import { CalendarCheck, Phone, UtensilsCrossed } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { HoursList } from "./common";
import { Logo } from "./Header";
import OrderButton from "@/features/orders/components/OrderButton";

export function Footer() {
  const { t } = useI18n();
  const legal = [
    { k: "owner", label: t.footer.owner, v: SITE.legal.name },
    { k: "address", label: t.footer.address, v: SITE.legal.address },
    { k: "phone", label: t.footer.phone, v: SITE.legal.phone },
    { k: "email", label: t.footer.email, v: SITE.legal.email },
    { k: "tax", label: t.footer.taxId, v: SITE.legal.taxId },
  ];
  return (
    <footer data-testid="site-footer" className="border-t border-white/10 bg-[#080B10] pb-28 md:pb-10">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm text-stone-400">{t.footer.tagline}</p>
        </div>
        <div className="space-y-2 text-sm">
          <a href={SITE.phoneHref} data-testid="footer-phone-link" className="block font-mono text-white hover:text-amber-400">{SITE.phone}</a>
          <a href={`mailto:${SITE.email}`} data-testid="footer-email-link" className="block break-all text-stone-300 hover:text-amber-400">{SITE.email}</a>
          <p className="text-stone-400">{SITE.addressLine1}<br />{SITE.addressLine2}</p>
        </div>
        <div>
          <HoursList testIdPrefix="footer-hours" />
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 border-t border-white/5 px-4 pt-6 text-xs text-stone-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>© {new Date().getFullYear()} Secret Spot · {t.footer.rights}</p>
        <div className="flex gap-5">
          <Dialog>
            <DialogTrigger data-testid="footer-legal-button" className="hover:text-white">{t.footer.legal}</DialogTrigger>
            <DialogContent data-testid="legal-dialog" className="border-white/10 bg-[#141923] text-stone-200">
              <DialogHeader>
                <DialogTitle className="font-heading text-2xl font-black uppercase text-white">{t.footer.legalTitle}</DialogTitle>
                <DialogDescription className="text-stone-400">{t.footer.legalIntro}</DialogDescription>
              </DialogHeader>
              <dl className="divide-y divide-white/5 text-sm">
                {legal.map((l) => (
                  <div key={l.k} className="flex justify-between gap-4 py-2">
                    <dt className="text-stone-500">{l.label}</dt>
                    <dd data-testid={`legal-${l.k}`} className="text-right text-white">{l.v}</dd>
                  </div>
                ))}
              </dl>
            </DialogContent>
          </Dialog>
          <Link to="/admin" data-testid="footer-admin-link" className="hover:text-white">{t.footer.admin}</Link>
        </div>
      </div>
    </footer>
  );
}

export function MobileBar() {
  const { t } = useI18n();
  return (
    <div data-testid="mobile-action-bar" className="fixed inset-x-3 bottom-3 z-40 flex gap-1 rounded-full border border-white/10 bg-[#141923]/90 p-1.5 shadow-2xl backdrop-blur-xl md:hidden">
      <a href={SITE.phoneHref} data-testid="mobile-bar-call" aria-label={t.mobile.call} className="flex w-12 shrink-0 items-center justify-center rounded-full py-3 text-stone-200 active:bg-white/10">
        <Phone className="size-4" />
      </a>
      <a href="#menu" data-testid="mobile-bar-menu" className="flex flex-1 items-center justify-center gap-1.5 rounded-full py-3 text-sm font-semibold text-stone-200 active:bg-white/10">
        <UtensilsCrossed className="size-4" /> {t.mobile.menu}
      </a>
      <OrderButton variant="mobile" />
      <a href="#reservar" data-testid="mobile-bar-book" className="flex flex-[1.3] items-center justify-center gap-1.5 rounded-full bg-neon py-3 text-sm font-bold text-white shadow-[0_0_20px_-6px_rgba(255,87,34,.9)]">
        <CalendarCheck className="size-4" /> {t.mobile.book}
      </a>
    </div>
  );
}

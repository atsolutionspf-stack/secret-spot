import { useEffect, useState } from "react";
import { Menu as MenuIcon, Phone } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { LangToggle, OpenBadge } from "./common";

const LINKS = [
  { id: "historia", key: "story" },
  { id: "servicios", key: "services" },
  { id: "menu", key: "menu" },
  { id: "reservar", key: "book" },
  { id: "contacto", key: "contact" },
] as const;

export function Logo({ className }: { className?: string }) {
  return (
    <a href="#top" data-testid="header-logo-link" className={cn("group flex items-baseline gap-1 leading-none", className)}>
      <span className="font-heading text-xl font-black uppercase tracking-tight text-white">Secret</span>
      <span className="animate-flicker font-heading text-xl font-black uppercase tracking-tight neon-text">Spot</span>
    </a>
  );
}

export default function Header() {
  const { t } = useI18n();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-testid="site-header"
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300",
        scrolled ? "border-b border-white/10 bg-[#0B0E14]/85 backdrop-blur-xl" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4">
          <Logo />
          <OpenBadge className="hidden sm:inline-flex" testId="header-open-badge" />
        </div>

        <nav className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.id}
              href={`#${l.id}`}
              data-testid={`nav-link-${l.id}`}
              className="rounded-full px-3 py-2 text-sm font-medium text-stone-300 transition-colors duration-200 hover:bg-white/5 hover:text-white"
            >
              {t.nav[l.key]}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LangToggle />
          <a
            href="#reservar"
            data-testid="header-book-button"
            className="hidden rounded-full bg-neon px-4 py-2 text-sm font-bold text-white shadow-[0_0_24px_-6px_rgba(255,87,34,.8)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_32px_-4px_rgba(255,87,34,.9)] sm:inline-flex"
          >
            {t.nav.bookCta}
          </a>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              data-testid="mobile-menu-button"
              aria-label="Menu"
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white lg:hidden"
            >
              <MenuIcon className="size-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-[82vw] max-w-sm border-white/10 bg-[#0B0E14] p-6">
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <div className="mt-6 flex flex-col gap-1">
                <OpenBadge className="mb-4 self-start" testId="mobile-open-badge" />
                {LINKS.map((l) => (
                  <a
                    key={l.id}
                    href={`#${l.id}`}
                    data-testid={`mobile-nav-link-${l.id}`}
                    onClick={() => setOpen(false)}
                    className="border-b border-white/5 py-3 font-heading text-2xl font-bold uppercase text-stone-100 transition-colors hover:text-neon-soft"
                  >
                    {t.nav[l.key]}
                  </a>
                ))}
                <a
                  href={SITE.phoneHref}
                  data-testid="mobile-nav-call-link"
                  className="mt-6 inline-flex items-center gap-2 font-mono text-amber-400"
                >
                  <Phone className="size-4" /> {SITE.phone}
                </a>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

import {
  Accessibility,
  Baby,
  Building2,
  CarFront,
  CreditCard,
  Gem,
  Music,
  PartyPopper,
  PawPrint,
  ShoppingBag,
  Sun,
  UtensilsCrossed,
  Waves,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { IMAGES } from "@/lib/site";
import { Reveal, SectionLabel } from "./common";

export function Story() {
  const { t } = useI18n();
  const stats = [
    { n: "8", l: t.story.stat1 },
    { n: "12+", l: t.story.stat2 },
    { n: "50", l: t.story.stat3 },
  ];
  return (
    <section id="historia" data-testid="story-section" className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
        <Reveal className="relative lg:col-span-5">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] border border-white/10">
            <img src={IMAGES.story} alt="Secret Spot kitchen" className="h-full w-full object-cover" />
          </div>
          <div className="absolute -bottom-8 -right-4 hidden w-48 overflow-hidden rounded-2xl border-4 border-[#0B0E14] sm:block lg:-right-10">
            <img src={IMAGES.storyNight} alt="Beach at night" className="aspect-square w-full object-cover" />
          </div>
        </Reveal>
        <div className="lg:col-span-6 lg:col-start-7">
          <Reveal>
            <SectionLabel testId="story-label">{t.story.label}</SectionLabel>
            <h2 data-testid="story-title" className="mt-4 font-heading text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-5xl">
              {t.story.title}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-6 text-base leading-relaxed text-stone-300 sm:text-lg">{t.story.p1}</p>
            <p className="mt-4 text-base leading-relaxed text-stone-400">{t.story.p2}</p>
          </Reveal>
          <Reveal delay={0.2} className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
            {stats.map((s, i) => (
              <div key={i} data-testid={`story-stat-${i}`}>
                <p className="font-mono text-3xl font-bold text-amber-400 sm:text-4xl">{s.n}</p>
                <p className="mt-1 text-xs uppercase tracking-wider text-stone-400">{s.l}</p>
              </div>
            ))}
          </Reveal>
        </div>
      </div>
    </section>
  );
}

const SERVICE_ICONS = {
  terrace: Sun,
  seaview: Waves,
  rooftop: Building2,
  music: Music,
  pets: PawPrint,
  kids: Baby,
  parking: CarFront,
  access: Accessibility,
  takeaway: ShoppingBag,
  catering: UtensilsCrossed,
  weddings: Gem,
  events: PartyPopper,
} as const;

export function Services() {
  const { t } = useI18n();
  const keys = Object.keys(SERVICE_ICONS) as (keyof typeof SERVICE_ICONS)[];
  return (
    <section id="servicios" data-testid="services-section" className="relative border-y border-white/5 bg-[#141923]">
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <Reveal className="max-w-2xl">
          <SectionLabel>{t.services.label}</SectionLabel>
          <h2 className="mt-4 font-heading text-4xl font-black uppercase leading-[0.95] tracking-tight text-white sm:text-5xl">
            {t.services.title}
          </h2>
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {keys.map((k, i) => {
            const Icon = SERVICE_ICONS[k];
            const big = i === 0 || i === 1;
            return (
              <Reveal key={k} delay={(i % 4) * 0.05} className={big ? "md:col-span-1 lg:col-span-2" : ""}>
                <div
                  data-testid={`service-card-${k}`}
                  className="group flex h-full items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#1C2331] p-4 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-amber-500/40 hover:shadow-[0_10px_30px_-10px_rgba(255,87,34,0.25)] sm:p-5"
                >
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-neon/10 text-neon-soft transition-colors duration-300 group-hover:bg-neon group-hover:text-white">
                    <Icon className="size-5" />
                  </span>
                  <span className={big ? "font-heading text-base font-bold text-white sm:text-lg" : "text-sm font-semibold text-stone-100"}>
                    {t.services.items[k]}
                  </span>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal className="mt-14 flex flex-col gap-4 rounded-2xl border border-white/[0.07] bg-[#0B0E14]/60 p-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-stone-300">
            <CreditCard className="size-5 text-amber-400" />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">{t.services.payLabel}</span>
          </div>
          <div className="flex flex-wrap gap-2" data-testid="payment-options">
            {t.services.pay.map((p, i) => (
              <span key={i} data-testid={`payment-option-${i}`} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-stone-200">
                {p}
              </span>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

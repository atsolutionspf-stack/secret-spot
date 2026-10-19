import { motion } from "motion/react";
import { ArrowRight, Flame, MapPin } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { IMAGES, formatPrice } from "@/lib/site";
import { OpenBadge } from "./common";

export default function Hero() {
  const { t, lang } = useI18n();
  return (
    <section id="top" data-testid="hero-section" className="grain relative overflow-hidden">
      <div className="absolute inset-0">
        <img src={IMAGES.hero} alt="" className="h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,14,20,0.85)_0%,rgba(11,14,20,0.65)_50%,#0B0E14_100%)]" />
        <div className="absolute -left-40 top-20 size-[420px] rounded-full bg-neon/20 blur-[120px]" />
        <div className="absolute -right-20 bottom-10 size-[360px] rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto grid min-h-[92vh] max-w-7xl grid-cols-1 items-center gap-10 px-4 pb-16 pt-28 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8">
        <div className="lg:col-span-7">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.25em] text-amber-400">
              <MapPin className="size-3.5" /> {t.hero.kicker}
            </span>
            <OpenBadge testId="hero-open-badge" />
          </motion.div>

          <motion.h1
            data-testid="hero-title"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 font-heading text-[3.4rem] font-black uppercase leading-[0.88] tracking-tighter text-white sm:text-7xl lg:text-[6.5rem]"
          >
            {t.hero.title1}
            <br />
            <span className="animate-flicker neon-text">{t.hero.title2}</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-stone-300 sm:text-lg"
          >
            {t.hero.subtitle}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-9 flex flex-col gap-3 sm:flex-row"
          >
            <a
              href="#reservar"
              data-testid="hero-book-button"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-neon px-7 py-4 font-heading text-base font-bold uppercase tracking-wide text-white shadow-[0_0_40px_-8px_rgba(255,87,34,.9)] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_48px_-4px_rgba(255,87,34,1)] active:translate-y-0"
            >
              {t.hero.book}
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
            <a
              href="#menu"
              data-testid="hero-menu-button"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 font-heading text-base font-bold uppercase tracking-wide text-white backdrop-blur transition-[background-color,border-color] duration-200 hover:border-amber-400/60 hover:bg-white/10"
            >
              {t.hero.menu}
            </a>
          </motion.div>
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-stone-500">{t.hero.tonight}</p>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative hidden lg:col-span-5 lg:block"
        >
          <div className="animate-float relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-[2rem] neon-border">
            <img src={IMAGES.heroBurger} alt="Big Secret burger" className="h-full w-full object-cover" />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">{t.hero.signature}</p>
              <div className="mt-1 flex items-end justify-between">
                <p className="font-heading text-3xl font-black uppercase text-white">Big Secret</p>
                <p data-testid="hero-signature-price" className="font-mono text-2xl font-bold text-amber-400">
                  {formatPrice(14.5, lang)}
                </p>
              </div>
            </div>
          </div>
          <div className="absolute -left-6 top-10 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#141923]/90 px-4 py-3 backdrop-blur-xl">
            <Flame className="size-5 text-neon" />
            <div>
              <p className="text-sm font-bold text-white">Wing Lover</p>
              <p className="font-mono text-xs text-amber-400">{formatPrice(13.5, lang)}</p>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="relative border-y border-white/10 bg-neon py-3">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {[...t.marquee, ...t.marquee, ...t.marquee, ...t.marquee].map((w, i) => (
            <span key={i} className="font-heading text-lg font-black uppercase tracking-tight text-white">
              {w} <span className="ml-10 text-black/40">✦</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

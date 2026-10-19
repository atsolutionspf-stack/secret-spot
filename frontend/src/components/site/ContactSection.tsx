import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { SITE } from "@/lib/site";
import type { Message, MessageCreate } from "@/lib/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fieldCls } from "./BookingSection";
import { HoursList, OpenBadge, Reveal, SectionLabel } from "./common";

const EMPTY: MessageCreate = { name: "", email: "", phone: "", subject: "", message: "" };

export default function ContactSection() {
  const { t } = useI18n();
  const [form, setForm] = useState<MessageCreate>(EMPTY);
  const set = (k: keyof MessageCreate, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (body: MessageCreate) => apiPost<Message>("/messages", body),
    onSuccess: () => {
      toast.success(t.contact.sent);
      setForm(EMPTY);
    },
    onError: () => toast.error(t.contact.error),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.subject.trim() || !form.message.trim()) {
      toast.error(t.booking.required);
      return;
    }
    mutation.mutate(form);
  };

  const cards = [
    { k: "call", Icon: Phone, label: t.contact.call, value: SITE.phone, href: SITE.phoneHref },
    { k: "email", Icon: Mail, label: t.contact.write, value: SITE.email, href: `mailto:${SITE.email}` },
  ];

  return (
    <section id="contacto" data-testid="contact-section" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
      <Reveal className="max-w-2xl">
        <SectionLabel>{t.contact.label}</SectionLabel>
        <h2 data-testid="contact-title" className="mt-4 font-heading text-5xl font-black uppercase leading-[0.9] tracking-tight text-white sm:text-6xl">
          {t.contact.title}
        </h2>
        <p className="mt-4 text-stone-300">{t.contact.subtitle}</p>
      </Reveal>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <Reveal className="space-y-4 lg:col-span-5">
          {cards.map(({ k, Icon, label, value, href }) => (
            <a
              key={k}
              href={href}
              data-testid={`contact-${k}-link`}
              className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#1C2331] p-5 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-amber-500/40"
            >
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-neon/10 text-neon-soft transition-colors duration-300 group-hover:bg-neon group-hover:text-white">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs uppercase tracking-wider text-stone-500">{label}</span>
                <span className="block truncate font-mono text-base font-semibold text-white">{value}</span>
              </span>
            </a>
          ))}
          <div className="rounded-2xl border border-white/[0.07] bg-[#1C2331] p-5">
            <div className="flex items-start gap-4">
              <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-neon/10 text-neon-soft">
                <MapPin className="size-5" />
              </span>
              <div>
                <span className="block text-xs uppercase tracking-wider text-stone-500">{t.contact.find}</span>
                <p data-testid="contact-address" className="mt-0.5 text-white">{SITE.addressLine1}</p>
                <p className="text-stone-400">{SITE.addressLine2}</p>
                <a
                  href={SITE.mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="contact-map-link"
                  className="mt-3 inline-flex rounded-full border border-amber-400/40 px-4 py-1.5 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-400 hover:text-black"
                >
                  {t.contact.showMap} →
                </a>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/[0.07] bg-[#1C2331] p-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
                <Clock className="size-4" /> {t.contact.hours}
              </p>
              <OpenBadge testId="contact-open-badge" />
            </div>
            <HoursList testIdPrefix="contact-hours" />
          </div>
        </Reveal>

        <Reveal delay={0.1} className="lg:col-span-7">
          <form data-testid="contact-form" onSubmit={submit} className="grid grid-cols-1 gap-5 rounded-[1.75rem] border border-white/10 bg-[#141923] p-5 sm:grid-cols-2 sm:p-8">
            <div className="space-y-2">
              <Label htmlFor="c-name" className="text-stone-300">{t.contact.name} *</Label>
              <Input id="c-name" data-testid="contact-name-input" className={fieldCls} value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-email" className="text-stone-300">{t.contact.email} *</Label>
              <Input id="c-email" type="email" data-testid="contact-email-input" className={fieldCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone" className="text-stone-300">{t.contact.phone}</Label>
              <Input id="c-phone" type="tel" data-testid="contact-phone-input" className={fieldCls} value={form.phone} maxLength={25} onChange={(e) => set("phone", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-subject" className="text-stone-300">{t.contact.subject} *</Label>
              <Input id="c-subject" data-testid="contact-subject-input" className={fieldCls} value={form.subject} maxLength={120} onChange={(e) => set("subject", e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="c-message" className="text-stone-300">{t.contact.message} *</Label>
                <span data-testid="contact-message-counter" className="font-mono text-xs text-stone-500">{form.message.length} / 500</span>
              </div>
              <Textarea
                id="c-message"
                data-testid="contact-message-input"
                className="min-h-36 rounded-xl border-white/10 bg-[#0B0E14] text-base text-white"
                value={form.message}
                maxLength={500}
                onChange={(e) => set("message", e.target.value)}
              />
            </div>
            <button
              type="submit"
              data-testid="contact-submit-button"
              disabled={mutation.isPending}
              className="h-14 rounded-full bg-white font-heading text-base font-bold uppercase tracking-wide text-black transition-[transform,background-color,opacity] duration-200 hover:-translate-y-0.5 hover:bg-amber-400 disabled:opacity-60 sm:col-span-2"
            >
              {mutation.isPending ? t.contact.sending : t.contact.send}
            </button>
          </form>
        </Reveal>
      </div>
    </section>
  );
}

import { useMemo, useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { format } from "date-fns";
import { enGB, es as esLocale } from "date-fns/locale";
import { CalendarDays, CheckCircle2, Clock, Users } from "lucide-react";
import { toast } from "sonner";
import { createBooking, errorCode } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { slotMinutes, slotsFor, useHours, weekdayOf } from "@/lib/hours";
import { formatDate } from "@/lib/site";
import type { Booking, BookingCreate } from "@/lib/types";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { HoursList, Reveal, SectionLabel } from "./common";

const EMPTY = { name: "", phone: "", email: "", date: "", time: "", party_size: "2", note: "" };
const PARTY = Array.from({ length: 20 }, (_, i) => String(i + 1));

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export const fieldCls =
  "h-12 rounded-xl border-white/10 bg-[#0B0E14] text-base text-white placeholder:text-stone-500 focus-visible:border-amber-500/60 focus-visible:ring-amber-500/30";

export default function BookingSection() {
  const { t, lang } = useI18n();
  const { today, now_time } = useHours();
  const [form, setForm] = useState(EMPTY);
  const [dateOpen, setDateOpen] = useState(false);
  const [done, setDone] = useState<Booking | null>(null);
  const maxIso = addDays(today, 90);

  const slots = useMemo(() => {
    if (!form.date) return [];
    const all = slotsFor(weekdayOf(form.date));
    if (form.date !== today) return all;
    const [h, m] = now_time.split(":").map(Number);
    const nowMin = h * 60 + m;
    return all.filter((s) => slotMinutes(s) > nowMin);
  }, [form.date, today, now_time]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const mutation = useMutation({
    mutationFn: (body: BookingCreate) => createBooking(body),
    onSuccess: (b) => {
      setDone(b);
      setForm(EMPTY);
    },
    onError: (err) => {
      const code = errorCode(err);
      toast.error(t.booking.errors[code] ?? t.booking.errors.generic);
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim() || !form.date || !form.time) {
      toast.error(t.booking.required);
      return;
    }
    mutation.mutate({ ...form, name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), party_size: Number(form.party_size), lang });
  };

  const timeLabel = (s: string) => (slotMinutes(s) >= 24 * 60 ? `${s} ${t.booking.afterMidnight}` : s);

  return (
    <section id="reservar" data-testid="booking-section" className="relative overflow-hidden border-y border-white/5 bg-[#141923]">
      <div className="absolute -right-40 top-0 size-[480px] rounded-full bg-neon/10 blur-[140px]" />
      <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 py-24 sm:px-6 lg:grid-cols-12 lg:px-8 lg:py-32">
        <div className="lg:col-span-5">
          <Reveal>
            <SectionLabel>{t.booking.label}</SectionLabel>
            <h2 data-testid="booking-title" className="mt-4 font-heading text-5xl font-black uppercase leading-[0.9] tracking-tight text-white sm:text-6xl">
              {t.booking.title}
            </h2>
            <p className="mt-6 max-w-md text-stone-300">{t.booking.subtitle}</p>
          </Reveal>
          <Reveal delay={0.1} className="mt-10 rounded-2xl border border-white/[0.07] bg-[#0B0E14]/60 p-6">
            <p className="mb-2 flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.2em] text-amber-400/90">
              <Clock className="size-4" /> {t.contact.hours}
            </p>
            <HoursList testIdPrefix="booking-hours" />
          </Reveal>
        </div>

        <Reveal delay={0.1} className="lg:col-span-7">
          <div className="rounded-[1.75rem] border border-white/10 bg-[#1C2331]/80 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
            <AnimatePresence mode="wait">
              {done ? (
                <motion.div
                  key="done"
                  data-testid="booking-confirmation"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-start gap-5 py-6"
                >
                  <span className="inline-flex size-14 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                    <CheckCircle2 className="size-8" />
                  </span>
                  <div>
                    <h3 className="font-heading text-3xl font-black uppercase text-white">{t.booking.successTitle}</h3>
                    <p className="mt-2 text-stone-300">{t.booking.successBody}</p>
                  </div>
                  <dl className="grid w-full grid-cols-2 gap-3 rounded-2xl border border-white/10 bg-[#0B0E14] p-5 text-sm">
                    <div>
                      <dt className="text-stone-500">{t.booking.code}</dt>
                      <dd data-testid="booking-confirmation-code" className="font-mono text-lg font-bold text-amber-400">{done.code}</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">{t.admin.filter}</dt>
                      <dd data-testid="booking-confirmation-status" className="font-semibold text-amber-300">{t.admin.statuses[done.status]}</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">{t.booking.date}</dt>
                      <dd data-testid="booking-confirmation-date" className="capitalize text-white">{formatDate(done.date, lang)}</dd>
                    </div>
                    <div>
                      <dt className="text-stone-500">{t.booking.time}</dt>
                      <dd data-testid="booking-confirmation-time" className="font-mono text-white">{done.time} · {done.party_size} {done.party_size === 1 ? t.booking.person : t.booking.people}</dd>
                    </div>
                  </dl>
                  <button
                    type="button"
                    data-testid="booking-another-button"
                    onClick={() => setDone(null)}
                    className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-amber-400/60"
                  >
                    {t.booking.another}
                  </button>
                </motion.div>
              ) : (
                <motion.form key="form" data-testid="booking-form" onSubmit={submit} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="b-name" className="text-stone-300">{t.booking.name} *</Label>
                    <Input id="b-name" data-testid="booking-name-input" className={fieldCls} value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} autoComplete="name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="b-phone" className="text-stone-300">{t.booking.phone} *</Label>
                    <Input id="b-phone" type="tel" data-testid="booking-phone-input" className={fieldCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} maxLength={25} autoComplete="tel" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="b-email" className="text-stone-300">{t.booking.email} *</Label>
                    <Input id="b-email" type="email" data-testid="booking-email-input" className={fieldCls} value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-stone-300">{t.booking.date} *</Label>
                    <Popover open={dateOpen} onOpenChange={setDateOpen}>
                      <PopoverTrigger
                        data-testid="booking-date-trigger"
                        className={`${fieldCls} flex w-full items-center gap-2 border px-3 text-left capitalize ${form.date ? "text-white" : "text-stone-500"}`}
                      >
                        <CalendarDays className="size-4 text-amber-400" />
                        {form.date ? formatDate(form.date, lang) : t.booking.pickDate}
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-auto border-white/10 bg-[#141923] p-2" data-testid="booking-date-popover">
                        <Calendar
                          mode="single"
                          locale={lang === "es" ? esLocale : enGB}
                          weekStartsOn={1}
                          selected={form.date ? new Date(`${form.date}T12:00:00`) : undefined}
                          onSelect={(d) => {
                            if (!d) return;
                            setForm((f) => ({ ...f, date: format(d, "yyyy-MM-dd"), time: "" }));
                            setDateOpen(false);
                          }}
                          disabled={(d) => {
                            const iso = format(d, "yyyy-MM-dd");
                            return iso < today || iso > maxIso || slotsFor(weekdayOf(iso)).length === 0;
                          }}
                        />
                        <p className="px-2 pb-1 text-xs text-stone-500">{t.booking.closedDays}</p>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-stone-300">{t.booking.time} *</Label>
                    <Select value={form.time} onValueChange={(v: string) => set("time", v)} disabled={!form.date || slots.length === 0}>
                      <SelectTrigger data-testid="booking-time-select" className={`${fieldCls} w-full`}>
                        <SelectValue>
                          {(v) => (v ? timeLabel(v as string) : form.date && slots.length === 0 ? t.booking.noSlots : t.booking.pickTime)}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#141923]">
                        {slots.map((s) => (
                          <SelectItem key={s} value={s} data-testid={`booking-time-option-${s.replace(":", "")}`}>
                            {timeLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-stone-300">{t.booking.party} *</Label>
                    <Select value={form.party_size} onValueChange={(v: string) => set("party_size", v)}>
                      <SelectTrigger data-testid="booking-party-select" className={`${fieldCls} w-full`}>
                        <Users className="size-4 text-amber-400" />
                        <SelectValue>{(v) => `${v} ${v === "1" ? t.booking.person : t.booking.people}`}</SelectValue>
                      </SelectTrigger>
                      <SelectContent className="border-white/10 bg-[#141923]">
                        {PARTY.map((p) => (
                          <SelectItem key={p} value={p} data-testid={`booking-party-option-${p}`}>
                            {p} {p === "1" ? t.booking.person : t.booking.people}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="b-note" className="text-stone-300">{t.booking.note}</Label>
                    <Textarea
                      id="b-note"
                      data-testid="booking-note-input"
                      className="min-h-24 rounded-xl border-white/10 bg-[#0B0E14] text-base text-white placeholder:text-stone-500"
                      placeholder={t.booking.notePh}
                      value={form.note}
                      maxLength={500}
                      onChange={(e) => set("note", e.target.value)}
                    />
                  </div>

                  <button
                    type="submit"
                    data-testid="booking-submit-button"
                    disabled={mutation.isPending}
                    className="h-14 rounded-full bg-neon font-heading text-base font-bold uppercase tracking-wide text-white shadow-[0_0_32px_-8px_rgba(255,87,34,.9)] transition-[transform,box-shadow,opacity] duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_40px_-4px_rgba(255,87,34,1)] disabled:opacity-60 sm:col-span-2"
                  >
                    {mutation.isPending ? t.booking.sending : t.booking.submit}
                  </button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

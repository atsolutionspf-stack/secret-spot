import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock3, Save } from "lucide-react";
import { toast } from "sonner";
import { fetchAdminSchedule, saveAdminSchedule, type ScheduleSettings, type WeeklyHours } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DAYS = ["0","1","2","3","4","5","6"];
const DEFAULT_HOURS: WeeklyHours = {
  "3": { open: "19:00", close: "00:00" },
  "4": { open: "19:00", close: "01:00" },
  "5": { open: "19:00", close: "01:00" },
  "6": { open: "19:00", close: "01:00" },
};
const blank = (): ScheduleSettings => ({
  business_hours: { ...DEFAULT_HOURS },
  reservation_hours: { ...DEFAULT_HOURS },
  order_hours: { ...DEFAULT_HOURS },
  accepting_orders: true,
  pickup_interval_minutes: 15,
  preparation_minutes: 15,
  last_pickup_before_close_min: 15,
  days_ahead: 7,
});
const inputCls = "h-10 border-white/10 bg-[#0B0E14] text-white";

function HoursEditor({ title, value, onChange, names, closed }: {
  title: string; value: WeeklyHours; onChange: (v: WeeklyHours) => void; names: string[]; closed: string;
}) {
  return <section className="rounded-2xl border border-white/[0.08] bg-[#1C2331] p-4 sm:p-5">
    <div className="mb-4 flex items-center gap-2"><Clock3 className="size-4 text-amber-400"/><h3 className="font-semibold text-white">{title}</h3></div>
    <div className="space-y-2">
      {DAYS.map((day) => {
        const hours = value[day];
        return <div key={day} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-white/5 py-2 last:border-0">
          <span className="text-sm text-stone-300">{names[Number(day)]}</span>
          {hours ? <>
            <Input aria-label={names[Number(day)] + " apertura"} type="time" className={inputCls+" w-28"} value={hours.open} onChange={(e) => onChange({ ...value, [day]: { ...hours, open: e.target.value } })}/>
            <Input aria-label={names[Number(day)] + " cierre"} type="time" className={inputCls+" w-28"} value={hours.close} onChange={(e) => onChange({ ...value, [day]: { ...hours, close: e.target.value } })}/>
          </> : <span className="col-span-2 text-right text-xs text-stone-500">{closed}</span>}
          <label className="col-span-3 flex items-center gap-2 text-xs text-stone-500">
            <Checkbox checked={!hours} onCheckedChange={(v) => {
              if (v) { const next={...value}; delete next[day]; onChange(next); }
              else onChange({ ...value, [day]: { open: "19:00", close: "23:00" } });
            }}/>
            {closed}
          </label>
        </div>;
      })}
    </div>
    <p className="mt-2 text-xs text-stone-500">Si la hora de cierre es anterior o igual a la apertura, se interpreta como cierre después de medianoche.</p>
  </section>;
}

export default function SettingsPanel() {
  const { t } = useI18n();
  const q = useQuery({ queryKey: ["admin","schedule-settings"], queryFn: fetchAdminSchedule });
  const [form,setForm] = useState<ScheduleSettings>(blank);
  useEffect(() => { if(q.data) setForm(q.data); }, [q.data]);
  const save = useMutation({
    mutationFn: () => saveAdminSchedule(form),
    onSuccess: () => { toast.success(t.admin.saved); queryClient.invalidateQueries(); },
    onError: () => toast.error(t.admin.error),
  });
  if(q.isLoading) return <p className="rounded-2xl border border-white/10 p-8 text-center text-stone-400">{t.admin.loadingSettings}</p>;
  if(q.isError) return <p role="alert" className="rounded-2xl border border-red-500/20 p-8 text-center text-red-300">{t.admin.error}</p>;
  const setNumber = (key: "preparation_minutes" | "pickup_interval_minutes" | "last_pickup_before_close_min" | "days_ahead", value: string) => setForm(f => ({...f,[key]:Number(value)}));
  const submit = (e: FormEvent) => { e.preventDefault(); save.mutate(); };
  return <form data-testid="admin-settings-panel" onSubmit={submit} className="space-y-5">
    <div><h2 className="font-heading text-xl font-black uppercase text-white">{t.admin.settingsTitle}</h2><p className="mt-1 text-sm text-stone-400">{t.admin.settingsHint}</p></div>
    <HoursEditor title={t.admin.businessHours} value={form.business_hours} onChange={v=>setForm(f=>({...f,business_hours:v}))} names={t.admin.dayNames} closed={t.admin.closedDay}/>
    <HoursEditor title={t.admin.reservationHours} value={form.reservation_hours} onChange={v=>setForm(f=>({...f,reservation_hours:v}))} names={t.admin.dayNames} closed={t.admin.closedDay}/>
    <HoursEditor title={t.admin.orderHours} value={form.order_hours} onChange={v=>setForm(f=>({...f,order_hours:v}))} names={t.admin.dayNames} closed={t.admin.closedDay}/>
    <section className="rounded-2xl border border-white/[0.08] bg-[#1C2331] p-4 sm:p-5 space-y-4">
      <h3 className="font-semibold text-white">{t.admin.orderOptions}</h3>
      <label className="flex items-center gap-3 text-sm text-stone-200"><Checkbox checked={form.accepting_orders} onCheckedChange={v=>setForm(f=>({...f,accepting_orders:!!v}))}/>{t.admin.acceptingOrders}</label>
      <div className="grid gap-4 sm:grid-cols-2">
        {([
          ["preparation_minutes",t.admin.prepMinutes,0,240],
          ["pickup_interval_minutes",t.admin.pickupInterval,5,60],
          ["last_pickup_before_close_min",t.admin.lastPickup,0,180],
          ["days_ahead",t.admin.daysAhead,1,30],
        ] as const).map(([key,label,min,max])=><div key={key} className="space-y-1.5"><Label className="text-stone-300">{label}</Label><Input type="number" min={min} max={max} className={inputCls} value={form[key]} onChange={e=>setNumber(key,e.target.value)}/></div>)}
      </div>
    </section>
    <button type="submit" disabled={save.isPending} data-testid="admin-settings-save" className="inline-flex h-11 items-center gap-2 rounded-full bg-neon px-6 text-sm font-bold text-white disabled:opacity-50"><Save className="size-4"/>{save.isPending?t.admin.savingSettings:t.admin.saveSchedule}</button>
  </form>;
}

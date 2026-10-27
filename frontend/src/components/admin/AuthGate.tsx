import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { Lock, Mail, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { errorCode, isAdmin, sendPhoneCode, signInWithPassword, signOut, verifyPhoneCode } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const field = "h-12 rounded-xl border-white/10 bg-[#0B0E14] text-base text-white";
const primary = "h-12 w-full rounded-xl bg-neon text-sm font-bold uppercase text-white transition-[opacity,transform] active:scale-[0.98] disabled:opacity-50";

export default function AuthGate() {
  const { t } = useI18n();
  const [tab, setTab] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("+34");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    if (!(await isAdmin())) {
      await signOut();
      toast.error(t.admin.notAdmin);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["admin", "me"] });
  };

  const run = async (fn: () => Promise<void>, onError: (code: string) => string) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(onError(errorCode(e)));
    } finally {
      setBusy(false);
    }
  };

  const submitEmail = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      await signInWithPassword(email.trim(), password);
      await finish();
    }, () => t.admin.loginError);
  };

  const submitPhone = (e: FormEvent) => {
    e.preventDefault();
    const p = phone.replace(/\s+/g, "");
    if (!codeSent) {
      run(async () => {
        await sendPhoneCode(p);
        setCodeSent(true);
        toast.success(t.admin.codeSent);
      }, (c) => (/provider|sms|phone/i.test(c) ? t.admin.phoneUnavailable : t.admin.error));
    } else {
      run(async () => {
        await verifyPhoneCode(p, code.trim());
        await finish();
      }, () => t.admin.codeError);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        data-testid="admin-auth-card"
        className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-[#141923]/90 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-neon/15 text-neon-soft">
            <Lock className="size-5" />
          </span>
          <h1 className="mt-4 font-heading text-2xl font-black uppercase text-white">{t.admin.pinTitle}</h1>
          <p className="mt-1 text-sm text-stone-400">{t.admin.authSubtitle}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full border border-white/10 bg-[#0B0E14] p-1">
          {(["email", "phone"] as const).map((k) => (
            <button
              key={k}
              type="button"
              data-testid={`admin-auth-tab-${k}`}
              onClick={() => setTab(k)}
              className={cn("flex items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-colors", tab === k ? "bg-neon text-white" : "text-stone-400 hover:text-white")}
            >
              {k === "email" ? <Mail className="size-4" /> : <Smartphone className="size-4" />}
              {k === "email" ? t.admin.tabEmail : t.admin.tabPhone}
            </button>
          ))}
        </div>

        {tab === "email" ? (
          <form onSubmit={submitEmail} data-testid="admin-email-form" className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="a-email" className="text-stone-300">{t.admin.email}</Label>
              <Input id="a-email" type="email" autoComplete="username" data-testid="admin-email-input" className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-pass" className="text-stone-300">{t.admin.password}</Label>
              <Input id="a-pass" type="password" autoComplete="current-password" data-testid="admin-password-input" className={field} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button type="submit" data-testid="admin-email-submit" disabled={busy || !email || !password} className={primary}>{t.admin.enter}</button>
          </form>
        ) : (
          <form onSubmit={submitPhone} data-testid="admin-phone-form" className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="a-phone" className="text-stone-300">{t.admin.phone}</Label>
              <Input id="a-phone" type="tel" autoComplete="tel" data-testid="admin-phone-input" className={field} value={phone} disabled={codeSent} onChange={(e) => setPhone(e.target.value)} />
            </div>
            {codeSent && (
              <div className="space-y-1.5">
                <Label htmlFor="a-code" className="text-stone-300">{t.admin.smsCode}</Label>
                <Input id="a-code" inputMode="numeric" autoComplete="one-time-code" data-testid="admin-sms-code-input" className={cn(field, "text-center font-mono tracking-[0.4em]")} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))} />
              </div>
            )}
            <button type="submit" data-testid="admin-phone-submit" disabled={busy || phone.length < 8 || (codeSent && code.length < 6)} className={primary}>
              {codeSent ? t.admin.verify : t.admin.sendCode}
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

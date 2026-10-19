import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Delete, Lock } from "lucide-react";
import { apiPost } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { beginSession } from "@/lib/session";
import type { AdminMe, PinLogin } from "@/lib/types";
import { cn } from "@/lib/utils";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export default function PinGate() {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [shake, setShake] = useState(0);
  const [error, setError] = useState(false);

  const login = useMutation({
    mutationFn: (body: PinLogin) => apiPost<AdminMe>("/admin/login", body),
    onSuccess: () => {
      // Clearing the cache orphans the mounted "me" observer, so reload into a clean session.
      beginSession();
      window.location.reload();
    },
    onError: () => {
      setError(true);
      setShake((s) => s + 1);
      setPin("");
    },
  });

  const press = (k: string) => {
    setError(false);
    setPin((p) => (p.length < 8 ? p + k : p));
  };
  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (pin) login.mutate({ pin });
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-10">
      <motion.form
        key={shake}
        onSubmit={submit}
        data-testid="admin-pin-form"
        animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : { opacity: 1, y: 0 }}
        initial={shake ? false : { opacity: 0, y: 16 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-xs rounded-[2rem] border border-white/10 bg-[#141923]/90 p-6 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex flex-col items-center text-center">
          <span className="inline-flex size-12 items-center justify-center rounded-full bg-neon/15 text-neon-soft">
            <Lock className="size-5" />
          </span>
          <h1 className="mt-4 font-heading text-2xl font-black uppercase text-white">{t.admin.pinTitle}</h1>
          <p className="mt-1 text-sm text-stone-400">{t.admin.pinSubtitle}</p>
        </div>

        <input
          data-testid="admin-pin-input"
          type="password"
          inputMode="numeric"
          autoFocus
          value={pin}
          onChange={(e) => {
            setError(false);
            setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
          }}
          className={cn(
            "mt-6 h-14 w-full rounded-xl border bg-[#0B0E14] text-center font-mono text-2xl tracking-[0.5em] text-white outline-none transition-colors",
            error ? "border-red-500/60" : "border-white/10 focus:border-amber-500/60",
          )}
          aria-label="PIN"
        />
        <p data-testid="admin-pin-error" className={cn("mt-2 h-5 text-center text-sm text-red-400", !error && "invisible")}>
          {t.admin.wrongPin}
        </p>

        <div className="mt-2 grid grid-cols-3 gap-2">
          {KEYS.map((k) => (
            <button
              key={k}
              type="button"
              data-testid={`admin-pin-key-${k}`}
              onClick={() => press(k)}
              className="h-14 rounded-xl border border-white/[0.07] bg-[#1C2331] font-mono text-xl font-bold text-white transition-[transform,background-color] duration-100 hover:bg-[#232B3B] active:scale-95"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            data-testid="admin-pin-clear"
            onClick={() => setPin((p) => p.slice(0, -1))}
            aria-label={t.admin.clear}
            className="flex h-14 items-center justify-center rounded-xl text-stone-400 transition-transform active:scale-95"
          >
            <Delete className="size-5" />
          </button>
          <button
            type="button"
            data-testid="admin-pin-key-0"
            onClick={() => press("0")}
            className="h-14 rounded-xl border border-white/[0.07] bg-[#1C2331] font-mono text-xl font-bold text-white transition-[transform,background-color] duration-100 hover:bg-[#232B3B] active:scale-95"
          >
            0
          </button>
          <button
            type="submit"
            data-testid="admin-pin-submit"
            disabled={!pin || login.isPending}
            className="h-14 rounded-xl bg-neon text-sm font-bold uppercase text-white transition-[transform,opacity] active:scale-95 disabled:opacity-50"
          >
            {t.admin.enter}
          </button>
        </div>
      </motion.form>
    </div>
  );
}

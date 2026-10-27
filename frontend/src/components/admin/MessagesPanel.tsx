import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Mail, MailOpen, Phone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMessage, listMessages, setMessageRead } from "@/lib/data";
import { useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import type { Message, MessageUpdate } from "@/lib/types";
import { cn } from "@/lib/utils";

const invalidate = () => {
  queryClient.invalidateQueries({ queryKey: ["admin", "messages"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
};

export default function MessagesPanel() {
  const { t, lang } = useI18n();
  const [openId, setOpenId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["admin", "messages"], queryFn: listMessages });
  const mark = useMutation({
    mutationFn: ({ id, body }: { id: string; body: MessageUpdate }) => setMessageRead(id, body.read),
    onSuccess: invalidate,
    onError: () => toast.error(t.admin.error),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteMessage(id),
    onSuccess: () => {
      toast.success(t.admin.deleted);
      invalidate();
    },
    onError: () => toast.error(t.admin.error),
  });

  const rows = q.data && !q.isError ? q.data : [];
  const fmt = new Intl.DateTimeFormat(lang === "es" ? "es-ES" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Madrid" });

  const toggleOpen = (m: Message) => {
    const next = openId === m.id ? null : m.id;
    setOpenId(next);
    if (next && !m.read) mark.mutate({ id: m.id, body: { read: true } });
  };

  if (rows.length === 0 && !q.isLoading) {
    return <p data-testid="admin-messages-empty" className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-stone-400">{t.admin.noMessages}</p>;
  }

  return (
    <ul data-testid="admin-messages-panel" className="space-y-3">
      {rows.map((m) => (
        <li key={m.id} data-testid={`admin-message-${m.id}`} data-read={m.read} className={cn("rounded-2xl border bg-[#1C2331] transition-colors", m.read ? "border-white/[0.07]" : "border-neon/40")}>
          <button type="button" data-testid="admin-message-toggle" onClick={() => toggleOpen(m)} className="flex w-full items-start gap-3 p-4 text-left sm:p-5">
            <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", m.read ? "bg-transparent" : "bg-neon")} />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span data-testid="admin-message-subject" className={cn("truncate", m.read ? "text-stone-300" : "font-bold text-white")}>{m.subject}</span>
                <span className="font-mono text-xs text-stone-500">{fmt.format(new Date(m.created_at))}</span>
              </span>
              <span className="block text-sm text-stone-400">{m.name}</span>
              {openId !== m.id && <span className="mt-1 block truncate text-sm text-stone-500">{m.message}</span>}
            </span>
          </button>
          {openId === m.id && (
            <div className="border-t border-white/5 px-4 pb-4 pt-3 sm:px-5">
              <p data-testid="admin-message-body" className="whitespace-pre-wrap text-sm leading-relaxed text-stone-200">{m.message}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-stone-300">
                <a href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject)}`} className="inline-flex items-center gap-1 hover:text-amber-400"><Mail className="size-3.5" /> {m.email}</a>
                {m.phone && <a href={`tel:${m.phone}`} className="inline-flex items-center gap-1 hover:text-amber-400"><Phone className="size-3.5" /> {m.phone}</a>}
              </div>
            </div>
          )}
          <div className="flex gap-2 px-4 pb-4 sm:px-5">
            <button
              type="button"
              data-testid="admin-message-read-toggle"
              onClick={() => mark.mutate({ id: m.id, body: { read: !m.read } })}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-stone-300 hover:text-white"
            >
              {m.read ? <Mail className="size-3.5" /> : <MailOpen className="size-3.5" />}
              {m.read ? t.admin.markUnread : t.admin.markRead}
            </button>
            <button
              type="button"
              data-testid="admin-message-delete-button"
              onClick={() => window.confirm(t.admin.deleteConfirm) && del.mutate(m.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/10"
            >
              <Trash2 className="size-3.5" /> {t.admin.delete}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

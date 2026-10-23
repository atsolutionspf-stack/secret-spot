import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { queryClient } from "@/lib/queryClient";
import { formatPrice } from "@/lib/site";
import { CATEGORIES, TAGS, type Category, type MenuItem, type MenuItemCreate, type MenuItemUpdate, type Tag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const invalidate = () => {
  queryClient.invalidateQueries({ queryKey: ["admin", "menu"] });
  queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
  queryClient.invalidateQueries({ queryKey: ["menu"] });
};

const BLANK: MenuItemCreate = {
  name: "", category: "burgers", description_es: "", description_en: "", price: 0, price_note: "", tags: [], allergens: "", available: true, sort_order: 100,
};

const inputCls = "border-white/10 bg-[#0B0E14] text-white";

function ItemDialog({ item, open, onClose }: { item: MenuItem | null; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<MenuItemCreate>(() => (item ? { ...item } : BLANK));
  const [price, setPrice] = useState(() => String(item ? item.price : ""));
  const set = <K extends keyof MenuItemCreate>(k: K, v: MenuItemCreate[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: (body: MenuItemCreate) => (item ? apiPatch<MenuItem>(`/admin/menu/${item.id}`, body as MenuItemUpdate) : apiPost<MenuItem>("/admin/menu", body)),
    onSuccess: () => {
      toast.success(t.admin.saved);
      invalidate();
      onClose();
    },
    onError: () => toast.error(t.admin.error),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = Number(price.replace(",", "."));
    if (!form.name.trim() || Number.isNaN(p) || p < 0) {
      toast.error(t.admin.error);
      return;
    }
    save.mutate({ ...form, name: form.name.trim(), price: p });
  };

  const toggleTag = (tag: Tag, on: boolean) => set("tags", on ? [...form.tags, tag] : form.tags.filter((x) => x !== tag));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="admin-menu-dialog" className="max-h-[90vh] overflow-y-auto border-white/10 bg-[#141923] text-stone-200 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl font-black uppercase text-white">{item ? t.admin.editItem : t.admin.addItem}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>{t.admin.name}</Label>
            <Input data-testid="admin-menu-name-input" className={inputCls} value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.category}</Label>
            <Select value={form.category} onValueChange={(v: string) => set("category", v as Category)}>
              <SelectTrigger data-testid="admin-menu-category-select" className={cn(inputCls, "w-full")}>
                <SelectValue>{(v) => t.menu.categories[v as Category]}</SelectValue>
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-[#141923]">
                {CATEGORIES.map((c) => <SelectItem key={c} value={c} data-testid={`admin-menu-category-${c}`}>{t.menu.categories[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.price}</Label>
            <Input data-testid="admin-menu-price-input" inputMode="decimal" className={cn(inputCls, "font-mono")} value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t.admin.descEs}</Label>
            <Textarea data-testid="admin-menu-desc-es-input" className={inputCls} value={form.description_es} maxLength={300} onChange={(e) => set("description_es", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>{t.admin.descEn}</Label>
            <Textarea data-testid="admin-menu-desc-en-input" className={inputCls} value={form.description_en} maxLength={300} onChange={(e) => set("description_en", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.allergens}</Label>
            <Input data-testid="admin-menu-allergens-input" className={inputCls} placeholder="1, 3, 10" value={form.allergens} maxLength={40} onChange={(e) => set("allergens", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t.admin.priceNote}</Label>
            <Input data-testid="admin-menu-price-note-input" className={inputCls} value={form.price_note} maxLength={20} onChange={(e) => set("price_note", e.target.value)} />
          </div>
          <div className="col-span-2 space-y-2">
            <Label>{t.admin.tags}</Label>
            <div className="flex flex-wrap gap-4">
              {TAGS.map((tag) => (
                <label key={tag} className="flex items-center gap-2 text-sm">
                  <Checkbox data-testid={`admin-menu-tag-${tag}`} checked={form.tags.includes(tag)} onCheckedChange={(c) => toggleTag(tag, !!c)} />
                  {t.menu.tags[tag]}
                </label>
              ))}
            </div>
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <Checkbox data-testid="admin-menu-available-checkbox" checked={form.available} onCheckedChange={(c) => set("available", !!c)} />
            {t.admin.visible}
          </label>
          <button type="submit" data-testid="admin-menu-save-button" disabled={save.isPending} className="col-span-2 h-12 rounded-full bg-neon font-bold uppercase text-white disabled:opacity-60">
            {t.admin.save}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function MenuPanel() {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const q = useQuery({ queryKey: ["admin", "menu"], queryFn: () => apiGet<MenuItem[]>("/admin/menu") });
  const toggle = useMutation({
    mutationFn: (m: MenuItem) => apiPatch<MenuItem>(`/admin/menu/${m.id}`, { available: !m.available } satisfies MenuItemUpdate),
    onSuccess: () => {
      toast.success(t.admin.updated);
      invalidate();
    },
    onError: () => toast.error(t.admin.error),
  });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete<void>(`/admin/menu/${id}`),
    onSuccess: () => {
      toast.success(t.admin.deleted);
      invalidate();
    },
    onError: () => toast.error(t.admin.error),
  });

  const rows = q.data && !q.isError ? q.data : [];
  const openDialog = (m: MenuItem | null) => {
    setEditing(m);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  };

  return (
    <div data-testid="admin-menu-panel">
      <button
        type="button"
        data-testid="admin-menu-add-button"
        onClick={() => openDialog(null)}
        className="mb-6 inline-flex items-center gap-2 rounded-full bg-neon px-5 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
      >
        <Plus className="size-4" /> {t.admin.addItem}
      </button>

      <div className="space-y-8">
        {CATEGORIES.map((c) => {
          const list = rows.filter((r) => r.category === c);
          if (!list.length) return null;
          return (
            <section key={c}>
              <h3 className="mb-3 font-heading text-sm font-bold uppercase tracking-widest text-stone-400">{t.menu.categories[c]}</h3>
              <ul className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#1C2331]">
                {list.map((m) => (
                  <li key={m.id} data-testid={`admin-menu-item-${m.id}`} className={cn("flex items-center gap-3 px-4 py-3", !m.available && "opacity-55")}>
                    <div className="min-w-0 flex-1">
                      <p data-testid="admin-menu-item-name" className="truncate font-semibold text-white">{m.name}</p>
                      <p className="truncate text-xs text-stone-500">{lang === "es" ? m.description_es : m.description_en}</p>
                    </div>
                    <span data-testid="admin-menu-item-price" className="font-mono text-sm font-bold text-amber-400">{formatPrice(m.price, lang)}</span>
                    <button
                      type="button"
                      data-testid="admin-menu-visibility-toggle"
                      onClick={() => toggle.mutate(m)}
                      title={m.available ? t.admin.hide : t.admin.show}
                      className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold", m.available ? "border-emerald-500/30 text-emerald-400" : "border-white/10 text-stone-400")}
                    >
                      {m.available ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                      <span className="hidden sm:inline">{m.available ? t.admin.visible : t.admin.hidden}</span>
                    </button>
                    <button type="button" data-testid="admin-menu-edit-button" onClick={() => openDialog(m)} aria-label={t.admin.editItem} className="rounded-full p-2 text-stone-300 hover:bg-white/5 hover:text-white">
                      <Pencil className="size-4" />
                    </button>
                    <button
                      type="button"
                      data-testid="admin-menu-delete-button"
                      onClick={() => window.confirm(t.admin.deleteConfirm) && del.mutate(m.id)}
                      aria-label={t.admin.delete}
                      className="rounded-full p-2 text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <ItemDialog key={dialogKey} item={editing} open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

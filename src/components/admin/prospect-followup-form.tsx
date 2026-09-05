"use client";

import { useActionState, useEffect, useState } from "react";
import { CalendarPlus, Pencil, Check, X } from "lucide-react";
import { upsertProspectFollowupAction, type FollowupActionState } from "@/app/(dashboard)/admin/prospects/actions";
import { TodayCallBadge } from "@/components/leads/lead-indicators";
import { cn, formatRelativeDays } from "@/lib/utils";

const fieldClass =
  "w-full rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink-900 focus-visible:border-accent-400 focus-visible:outline-none";

const initialState: FollowupActionState = { error: null };

/** "Sonraki Takip" hucresi: tarih goster, tiklayinca duzenle - kayittaki telefon/not takibini tamamlar. */
export function ProspectFollowupForm({
  prospectId,
  nextFollowupAt,
  nextFollowupNote,
}: {
  prospectId: string;
  nextFollowupAt: string | null;
  nextFollowupNote: string | null;
}) {
  const [open, setOpen] = useState(false);
  const boundAction = upsertProspectFollowupAction.bind(null, prospectId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);

  useEffect(() => {
    if (!isPending && state.error === null) setOpen(false);
  }, [isPending, state.error]);

  const defaultDays = (() => {
    if (!nextFollowupAt) return "";
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(nextFollowupAt);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
    return diffDays >= 0 ? String(diffDays) : "0";
  })();

  if (!open) {
    if (!nextFollowupAt) {
      return (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-accent-500/30 bg-accent-500/[0.08] px-2.5 py-1.5 text-xs font-medium text-accent-600 transition-colors duration-150 hover:border-accent-500/50 hover:bg-accent-500/[0.14]"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Takip Ekle
        </button>
      );
    }
    const relativeLabel = formatRelativeDays(nextFollowupAt);
    const isOverdue = Boolean(relativeLabel?.includes("gecikti"));
    const isToday = relativeLabel === "Bugün";

    return (
      <button type="button" onClick={() => setOpen(true)} className="group flex items-start gap-1.5 text-left">
        <span>
          {isToday ? (
            <TodayCallBadge />
          ) : (
            <span className={cn("text-xs font-medium", isOverdue ? "text-danger-600" : "text-ink-900")}>{relativeLabel}</span>
          )}
          {nextFollowupNote ? <span className="block text-xs text-ink-500">{nextFollowupNote}</span> : null}
        </span>
        <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-ink-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <form action={formAction} className="flex min-w-[180px] flex-col gap-1.5">
      <label className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-ink-500">Kaç gün sonra aransın?</span>
        <input type="number" name="followup_days" min={0} step={1} required defaultValue={defaultDays} placeholder="ör. 3" className={fieldClass} />
      </label>
      <p className="text-[10px] leading-tight text-ink-400">Görüşme Takvimi'ne otomatik eklenir.</p>
      <input type="text" name="followup_note" defaultValue={nextFollowupNote ?? ""} placeholder="Not (ör. tekrar ara)" className={fieldClass} />
      <div className="flex items-center gap-1.5">
        <button
          type="submit"
          disabled={isPending}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-success-600 transition-colors duration-150 hover:bg-success-500/10 disabled:opacity-50"
          aria-label="Kaydet"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-400 transition-colors duration-150 hover:bg-white/[0.06]"
          aria-label="İptal"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        {state.error ? <span className="text-[10px] text-[#ffb4a3]">{state.error}</span> : null}
      </div>
    </form>
  );
}

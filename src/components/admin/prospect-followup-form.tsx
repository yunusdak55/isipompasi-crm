"use client";

import { useActionState, useEffect, useState } from "react";
import { CalendarClock, Pencil, Check, X } from "lucide-react";
import { upsertProspectFollowupAction, type FollowupActionState } from "@/app/(dashboard)/admin/prospects/actions";
import { formatDateTime } from "@/lib/utils";

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

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="group flex items-start gap-1.5 text-left">
        {nextFollowupAt ? (
          <span>
            <span className="flex items-center gap-1 text-xs font-medium text-ink-900">
              <CalendarClock className="h-3 w-3 text-accent-500" />
              {formatDateTime(nextFollowupAt)}
            </span>
            {nextFollowupNote ? <span className="block text-xs text-ink-500">{nextFollowupNote}</span> : null}
          </span>
        ) : (
          <span className="text-xs text-ink-400">Takip planlanmadı</span>
        )}
        <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-ink-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <form action={formAction} className="flex min-w-[180px] flex-col gap-1.5">
      <input
        type="datetime-local"
        name="followup_date"
        required
        defaultValue={nextFollowupAt ? nextFollowupAt.slice(0, 16) : ""}
        className={fieldClass}
      />
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

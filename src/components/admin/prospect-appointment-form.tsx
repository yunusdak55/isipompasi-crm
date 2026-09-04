"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import {
  upsertProspectFollowupAction,
  createProspectWithFollowupAction,
  type FollowupActionState,
} from "@/app/(dashboard)/admin/prospects/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProspectSelectItem } from "@/lib/data/prospects";

const fieldClass =
  "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.07] focus-visible:outline-none [&>option]:bg-surface [&>option]:text-[#111827]";

const initialState: FollowupActionState = { error: null };

type Mode = "existing" | "new";

/** Takvimden dogrudan (liste sayfasina gitmeden) takip/randevu olusturma formu. */
export function ProspectAppointmentForm({ prospects }: { prospects: ProspectSelectItem[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("existing");
  const [existingId, setExistingId] = useState(prospects[0]?.id ?? "");
  const boundAction = mode === "existing" ? upsertProspectFollowupAction.bind(null, existingId) : createProspectWithFollowupAction;
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !isPending && state.error === null) {
      setOpen(false);
      setMode("existing");
      submittedRef.current = false;
    }
  }, [isPending, state]);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="gap-1.5">
        <CalendarPlus className="h-4 w-4" />
        Takip Ekle
      </Button>
    );
  }

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="animate-slide-up flex flex-col gap-3 rounded-xl border border-white/12 bg-white/[0.04] p-3.5"
    >
      <div className="flex gap-1 rounded-lg border border-white/12 bg-white/[0.03] p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 transition-colors duration-150",
            mode === "existing" ? "bg-accent-500 text-white" : "text-white/55 hover:text-white"
          )}
        >
          Var Olan Aday
        </button>
        <button
          type="button"
          onClick={() => setMode("new")}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 transition-colors duration-150",
            mode === "new" ? "bg-accent-500 text-white" : "text-white/55 hover:text-white"
          )}
        >
          Yeni Aday Ekle
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {mode === "existing" ? (
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">Aday</span>
            <select value={existingId} onChange={(e) => setExistingId(e.target.value)} className={fieldClass}>
              {prospects.length === 0 ? <option value="">Önce bir aday ekleyin</option> : null}
              {prospects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.company_name}
                  {p.contact_name ? ` — ${p.contact_name}` : ""}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-white/55">Firma Adı</span>
              <input type="text" name="new_company_name" required placeholder="ör. Yılmaz Isı Sistemleri" className={fieldClass} />
            </label>
            <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-white/55">Telefon</span>
              <input type="tel" name="new_company_phone" placeholder="05xx xxx xx xx" className={fieldClass} />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/55">Tarih &amp; Saat</span>
          <input type="datetime-local" name="followup_date" required className={fieldClass} />
        </label>

        <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-white/55">Not (opsiyonel)</span>
          <input type="text" name="followup_note" placeholder="ör. tekrar ara" className={fieldClass} />
        </label>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={isPending || (mode === "existing" && !existingId)}>
            {isPending ? "Kaydediliyor…" : "Kaydet"}
          </Button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-white/60 transition-colors duration-150 hover:bg-white/[0.08] hover:text-white"
            aria-label="İptal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { createAppointmentAction, type FollowupActionState } from "@/app/(dashboard)/leads/actions";
import { Button } from "@/components/ui/button";
import { LeadSearchSelect } from "@/components/leads/lead-search-select";
import { cn } from "@/lib/utils";
import type { LeadSelectItem } from "@/lib/data/leads";

const fieldClass =
  "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.07] focus-visible:outline-none [&>option]:bg-surface [&>option]:text-[#111827]";

const initialState: FollowupActionState = { error: null };

type LeadMode = "existing" | "new";

/** Takvimden dogrudan (lead detayina gitmeden) randevu/takip olusturma formu. */
export function AppointmentForm({ leads }: { leads: LeadSelectItem[] }) {
  const [open, setOpen] = useState(false);
  const [leadMode, setLeadMode] = useState<LeadMode>("existing");
  const [state, formAction, isPending] = useActionState(createAppointmentAction, initialState);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !isPending && state.error === null) {
      setOpen(false);
      setLeadMode("existing");
      submittedRef.current = false;
    }
  }, [isPending, state]);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="gap-1.5">
        <CalendarPlus className="h-4 w-4" />
        Randevu Ekle
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
          onClick={() => setLeadMode("existing")}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 transition-colors duration-150",
            leadMode === "existing" ? "bg-accent-500 text-white" : "text-white/55 hover:text-white"
          )}
        >
          Var Olan Lead
        </button>
        <button
          type="button"
          onClick={() => setLeadMode("new")}
          className={cn(
            "flex-1 rounded-md px-2.5 py-1.5 transition-colors duration-150",
            leadMode === "new" ? "bg-accent-500 text-white" : "text-white/55 hover:text-white"
          )}
        >
          Yeni Lead Ekle
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {leadMode === "existing" ? (
          <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">Lead</span>
            <LeadSearchSelect leads={leads} />
          </label>
        ) : (
          <>
            <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-white/55">Ad Soyad</span>
              <input type="text" name="new_lead_name" required placeholder="ör. Ahmet Yılmaz" className={fieldClass} />
            </label>
            <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
              <span className="text-xs font-medium text-white/55">Telefon</span>
              <input type="tel" name="new_lead_phone" required placeholder="05xx xxx xx xx" className={fieldClass} />
            </label>
          </>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/55">Tarih &amp; Saat</span>
          <input type="datetime-local" name="followup_date" required className={fieldClass} />
        </label>

        <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-white/55">Not (opsiyonel)</span>
          <input type="text" name="followup_note" placeholder="ör. keşif randevusu" className={fieldClass} />
        </label>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={isPending}>
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

"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { MapPinPlus, X } from "lucide-react";
import { createDiscoveryVisitAction, type DiscoveryVisitActionState } from "@/app/(dashboard)/leads/discoveries/actions";
import { Button } from "@/components/ui/button";
import { LeadSearchSelect } from "@/components/leads/lead-search-select";
import type { LeadSelectItem } from "@/lib/data/leads";

const fieldClass =
  "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.07] focus-visible:outline-none [&>option]:bg-surface [&>option]:text-[#111827]";

const initialState: DiscoveryVisitActionState = { error: null };

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** "Keşif Ekle" formu: kime, ne zaman, nerede kesife gidildigi + nasil gectigi (spec). */
export function DiscoveryVisitForm({ leads }: { leads: LeadSelectItem[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createDiscoveryVisitAction, initialState);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !isPending && state.error === null) {
      setOpen(false);
      submittedRef.current = false;
    }
  }, [isPending, state]);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="gap-1.5">
        <MapPinPlus className="h-4 w-4" />
        Keşif Ekle
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
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-white/55">Lead</span>
          <LeadSearchSelect leads={leads} />
        </label>

        <label className="flex w-40 flex-col gap-1.5">
          <span className="text-xs font-medium text-white/55">Ziyaret Tarihi</span>
          <input type="date" name="visit_date" required defaultValue={todayIso()} className={fieldClass} />
        </label>

        <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-white/55">Nerede</span>
          <input type="text" name="location" placeholder="ör. Sakarya / Sapanca" className={fieldClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-white/55">Nasıl Geçti</span>
        <textarea
          name="outcome_note"
          rows={2}
          placeholder="ör. Villa yerinde incelendi, teklif hazırlanacak"
          className={fieldClass}
        />
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

      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

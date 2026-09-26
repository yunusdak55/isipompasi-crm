"use client";

import { useActionState, useEffect, useRef } from "react";
import { CalendarClock, Check, Handshake, NotebookPen, XCircle } from "lucide-react";
import { logProspectOutcomeAction, type LogProspectOutcomeState } from "@/app/(dashboard)/admin/prospects/actions";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const initialState: LogProspectOutcomeState = { error: null };

const fieldClass =
  "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:outline-none";

const outcomeButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-all duration-150 ease-snappy active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60";

/**
 * "Görüşme Sonucu" (spec: "bir müşteriyi aradım; görüşmede ne oldu? Ondan
 * sonra 3 farklı seçenek: takibe alırım, kayıp olarak işaretlerim ya da
 * satış olarak işaretlerim"). Tek form, tek tık: not + sonuç birlikte
 * kaydolur, not tarih-saatiyle zaman çizelgesine düşer. "Sadece not" durumu
 * değiştirmeden not almak içindir.
 */
export function ProspectOutcomeForm({ prospectId }: { prospectId: string }) {
  const boundAction = logProspectOutcomeAction.bind(null, prospectId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (justSaved) formRef.current?.reset();
  }, [justSaved]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-600">Görüşmede ne oldu?</span>
        <textarea
          name="note"
          rows={3}
          placeholder="ör. Aradım, fiyat teklifiyle ilgileniyor, hafta sonu karar verecek."
          className={cn(fieldClass, "w-full resize-none")}
        />
      </label>

      <div className="flex flex-wrap items-end gap-2">
        <div className="flex items-stretch overflow-hidden rounded-lg border border-warning-500/40 bg-warning-500/10">
          <button
            type="submit"
            name="outcome"
            value="followup"
            disabled={isPending}
            className={cn(outcomeButton, "rounded-none border-0 bg-transparent text-warning-500 hover:bg-warning-500/15")}
          >
            <CalendarClock className="h-4 w-4" />
            Takibe Al
          </button>
          <label className="flex items-center gap-1.5 border-l border-warning-500/30 pl-2.5 pr-2">
            <input
              type="number"
              name="followup_days"
              min={0}
              step={1}
              placeholder="kaç gün sonra?"
              aria-label="Kaç gün sonra aransın"
              className="w-28 bg-transparent py-2 text-sm text-ink-900 placeholder:text-ink-400 focus-visible:outline-none"
            />
          </label>
        </div>

        <button
          type="submit"
          name="outcome"
          value="won"
          disabled={isPending}
          className={cn(outcomeButton, "border-success-500/40 bg-success-500/15 text-[#7ee2ad] hover:bg-success-500/25")}
        >
          <Handshake className="h-4 w-4" />
          Satış
        </button>

        <button
          type="submit"
          name="outcome"
          value="lost"
          disabled={isPending}
          className={cn(outcomeButton, "border-danger-500/40 bg-danger-500/15 text-[#ffb4a3] hover:bg-danger-500/25")}
        >
          <XCircle className="h-4 w-4" />
          Kayıp
        </button>

        <button
          type="submit"
          name="outcome"
          value="note"
          disabled={isPending}
          className={cn(outcomeButton, "border-line bg-transparent text-ink-600 hover:bg-white/[0.06] hover:text-ink-900")}
        >
          <NotebookPen className="h-4 w-4" />
          Sadece Not
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : justSaved ? (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8ef0b8]">
          <Check className="h-3.5 w-3.5" />
          Kaydedildi
        </p>
      ) : isPending ? (
        <p className="text-xs text-ink-600">Kaydediliyor…</p>
      ) : null}
    </form>
  );
}

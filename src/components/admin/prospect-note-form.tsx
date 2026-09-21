"use client";

import { useActionState, useEffect, useRef } from "react";
import { NotebookPen, Check } from "lucide-react";
import { addProspectNoteAction, type AddProspectNoteState } from "@/app/(dashboard)/admin/prospects/actions";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const initialState: AddProspectNoteState = { error: null };

/**
 * Profil sayfasindaki "Not Ekle" formu (spec: "istediğim zaman NOT
 * alabileyim ve aldığım not burada tarihi ve zamanıyla birlikte kendisi
 * gözüksün"). Kaydedilince zaman çizelgesine (agency_prospect_activities)
 * düşer, formun kendisi temizlenir - tek amacı hızlı, tekrar tekrar not
 * eklemek.
 */
export function ProspectNoteForm({ prospectId }: { prospectId: string }) {
  const boundAction = addProspectNoteAction.bind(null, prospectId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (justSaved) formRef.current?.reset();
  }, [justSaved]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-xs font-medium text-ink-600">
          <NotebookPen className="h-3.5 w-3.5" />
          Not Ekle
        </span>
        <textarea
          name="body"
          required
          rows={3}
          placeholder="ör. Aradım, fiyat teklifiyle ilgileniyor, hafta sonu karar verecek."
          className="w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:outline-none"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          variant="secondary"
          disabled={isPending}
          className={cn(justSaved && "border-success-500/40 bg-success-500/20 text-[#8ef0b8] hover:bg-success-500/20")}
        >
          {isPending ? (
            "Kaydediliyor…"
          ) : justSaved ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Eklendi
            </span>
          ) : (
            "Not Ekle"
          )}
        </Button>
      </div>
    </form>
  );
}

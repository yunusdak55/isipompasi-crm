"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { updateProspectAction, type UpdateProspectState } from "@/app/(dashboard)/admin/prospects/actions";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink-900 focus-visible:border-accent-400 focus-visible:outline-none";

const initialState: UpdateProspectState = { error: null };

/**
 * Firma/iletişim kişisi/telefon/not satır-içi düzenleme - kaydettiğinde
 * son temas tarihi de tazelenir (bkz. updateProspectAction).
 */
export function EditProspectForm({
  prospectId,
  companyName,
  contactName,
  phone,
  notes,
}: {
  prospectId: string;
  companyName: string;
  contactName: string | null;
  phone: string | null;
  notes: string | null;
}) {
  const [open, setOpen] = useState(false);
  const boundAction = updateProspectAction.bind(null, prospectId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (justSaved) setOpen(false);
  }, [justSaved]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="group flex w-full items-start gap-1.5 text-left">
        <span className="min-w-0 flex-1">
          <p className="font-medium text-ink-900">{companyName}</p>
          <p className="truncate text-xs text-ink-600">
            {[contactName, phone].filter(Boolean).join(" · ") || "—"}
          </p>
          {notes ? <p className="mt-0.5 truncate text-xs text-ink-400" title={notes}>{notes}</p> : null}
        </span>
        <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-ink-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <form action={formAction} className="flex min-w-[220px] flex-col gap-1.5">
      <input
        ref={inputRef}
        type="text"
        name="company_name"
        defaultValue={companyName}
        required
        placeholder="Firma adı"
        className={fieldClass}
      />
      <input type="text" name="contact_name" defaultValue={contactName ?? ""} placeholder="İlgili kişi" className={fieldClass} />
      <input type="tel" name="phone" defaultValue={phone ?? ""} placeholder="Telefon" className={fieldClass} />
      <textarea name="notes" defaultValue={notes ?? ""} placeholder="Not" rows={2} className={cn(fieldClass, "resize-none")} />
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

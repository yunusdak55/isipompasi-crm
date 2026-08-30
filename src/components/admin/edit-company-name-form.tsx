"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Pencil, Check, X } from "lucide-react";
import { updateCompanyNameAction, type UpdateCompanyNameState } from "@/app/(dashboard)/admin/actions";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const initialState: UpdateCompanyNameState = { error: null };

/**
 * Firma karşılaştırma tablosundaki isim hücresi üzerine gelinceki kalem
 * ikonuyla açılan satır-içi düzenleme - eskiden firma adı sadece
 * oluşturma anında girilip bir daha hiç değiştirilemiyordu (spec: "admin
 * panelimden yeni firma eklediğimde onların isimlerini de düzenleyebileyim").
 */
export function EditCompanyNameForm({ companyId, name, city }: { companyId: string; name: string; city: string | null }) {
  const [open, setOpen] = useState(false);
  const boundAction = updateCompanyNameAction.bind(null, companyId);
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex items-center gap-1.5 text-left"
        aria-label={`${name} adını düzenle`}
      >
        <span>
          <p className="font-medium text-ink-900">{name}</p>
          <p className="text-xs text-ink-600">{city ?? "—"}</p>
        </span>
        <Pencil className="h-3 w-3 shrink-0 text-ink-400 opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="text"
        name="name"
        defaultValue={name}
        required
        className="w-36 rounded-md border border-line bg-canvas px-2 py-1 text-sm text-ink-900 focus-visible:border-accent-400"
      />
      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-success-600 transition-colors duration-150 hover:bg-success-500/10 disabled:opacity-50"
        )}
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
    </form>
  );
}

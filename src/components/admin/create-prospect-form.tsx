"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { createProspectAction, type CreateProspectState } from "@/app/(dashboard)/admin/prospects/actions";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const fieldClass =
  "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.07] focus-visible:outline-none";

const initialState: CreateProspectState = { error: null };

/** Ajansin aradigi yeni bir musteri adayi (firma) ekleme formu. */
export function CreateProspectForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createProspectAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (justSaved) {
      formRef.current?.reset();
      setOpen(false);
    }
  }, [justSaved]);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="gap-1.5">
        <Plus className="h-4 w-4" />
        Yeni Aday Ekle
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="animate-slide-up flex flex-col gap-3 rounded-xl border border-white/12 bg-white/[0.04] p-3.5"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/55">Firma Adı *</span>
          <input type="text" name="company_name" required placeholder="ör. Yılmaz Isı Sistemleri" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/55">İlgili Kişi</span>
          <input type="text" name="contact_name" placeholder="ör. Ahmet Bey" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/55">Telefon</span>
          <input type="tel" name="phone" placeholder="05xx xxx xx xx" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-white/55">Not</span>
          <input type="text" name="notes" placeholder="ör. WhatsApp'tan ulaşıldı, geri arayacak" className={fieldClass} />
        </label>
      </div>

      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="primary"
          disabled={isPending}
          className={cn(justSaved && "border-success-500/40 bg-success-500/20 text-[#8ef0b8]")}
        >
          {isPending ? (
            "Ekleniyor…"
          ) : justSaved ? (
            <span className="inline-flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Eklendi
            </span>
          ) : (
            "Aday Ekle"
          )}
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
    </form>
  );
}

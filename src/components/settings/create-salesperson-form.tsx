"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Plus, X, Check } from "lucide-react";
import { createSalespersonAction, type CreateSalespersonState } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03]";

const initialState: CreateSalespersonState = { error: null };

/**
 * Firma sahibinin ISIM BAZLI satis personeli eklemesi - giris hesabi DEGIL
 * (spec: "Firma sahipleri herhangi bir hesap oluşturma yetkisine SAHİP
 * OLMASIN, yalnızca bir satış personeli ismi belirlesin"). Eskiden burada
 * e-posta/sifre alanlariyla gercek bir hesap aciliyordu - kaldirildi.
 */
export function CreateSalespersonForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createSalespersonAction, initialState);
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
        Kişi Ekle
      </Button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="animate-slide-up flex flex-col gap-3 rounded-lg border border-line p-3.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-600">Ad Soyad *</span>
        <input type="text" name="full_name" required autoFocus placeholder="ör. Ahmet Yılmaz" className={inputClass} />
      </label>

      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="submit"
          variant="secondary"
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
            "Ekle"
          )}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink-600 transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink-900"
          aria-label="İptal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}

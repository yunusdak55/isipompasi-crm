"use client";

import { useActionState, useEffect, useRef } from "react";
import { Plus, Check } from "lucide-react";
import { createProductCategoryAction, type CreateCategoryState } from "@/app/(dashboard)/settings/actions";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const inputClass =
  "flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03]";

const initialState: CreateCategoryState = { error: null };

/** Firma sahibinin kendi urun/hizmet kategorisini eklemesi. */
export function CreateCategoryForm() {
  const [state, formAction, isPending] = useActionState(createProductCategoryAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (justSaved) formRef.current?.reset();
  }, [justSaved]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input type="text" name="label" required placeholder="ör. Havalandırma Sistemleri" className={inputClass} />
        <Button
          type="submit"
          variant="secondary"
          disabled={isPending}
          className={cn("shrink-0", justSaved && "border-success-500/40 bg-success-500/20 text-[#8ef0b8]")}
        >
          {isPending ? (
            "Ekleniyor…"
          ) : justSaved ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <>
              <Plus className="h-3.5 w-3.5" />
              Ekle
            </>
          )}
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

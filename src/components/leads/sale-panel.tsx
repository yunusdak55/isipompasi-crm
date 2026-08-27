"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { upsertSaleAction, type SaleActionState } from "@/app/(dashboard)/leads/actions";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const inputClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03]";

const initialState: SaleActionState = { error: null };

/** Gercek satis tutarini `sales` tablosuna kaydeder (sadece owner/admin - ciro hassas veri). */
export function SalePanel({ leadId, currentSaleAmount }: { leadId: string; currentSaleAmount: number | null }) {
  const boundAction = upsertSaleAction.bind(null, leadId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-600">Satış Tutarı (₺)</span>
        <input
          type="number"
          name="sale_amount"
          min="0"
          step="1"
          required
          defaultValue={currentSaleAmount ?? ""}
          placeholder="ör. 425000"
          className={inputClass}
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
              Kaydedildi
            </span>
          ) : (
            "Satışı Kaydet"
          )}
        </Button>
      </div>
    </form>
  );
}

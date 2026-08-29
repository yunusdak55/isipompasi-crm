"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { setContactedByAction, type ContactedByActionState } from "@/app/(dashboard)/leads/actions";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";
import type { Salesperson } from "@/lib/data/salespeople";

const selectClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03] [&>option]:text-[#111827]";

const initialState: ContactedByActionState = { error: null };

/**
 * assign-panel.tsx'teki gercek hesap atamasindan (RLS/erisim) BAGIMSIZ -
 * firma sahibinin Firma Ayarları'nda isim bazlı tanımladığı kişilerden
 * (bkz. salespeople.ts) "bu leadle kim görüştü" bilgisini seçmesi icin.
 */
export function ContactedByPanel({
  leadId,
  currentContactedBy,
  salespeople,
}: {
  leadId: string;
  currentContactedBy: string | null;
  salespeople: Salesperson[];
}) {
  const boundAction = setContactedByAction.bind(null, leadId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);

  if (salespeople.length === 0) {
    return (
      <p className="text-xs text-ink-400">
        Henüz tanımlı kişi yok — Firma Ayarları&apos;ndan isim ekleyin.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {/* key={currentContactedBy}: assign-panel.tsx / meeting-outcome-form.tsx
          ile ayni React <select defaultValue> re-sync duzeltmesi. */}
      <select key={currentContactedBy ?? "none"} name="contacted_by" defaultValue={currentContactedBy ?? ""} className={selectClass}>
        <option value="">Belirtilmedi</option>
        {salespeople.map((p) => (
          <option key={p.id} value={p.id}>
            {p.full_name}
          </option>
        ))}
      </select>
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
            "Kaydet"
          )}
        </Button>
      </div>
    </form>
  );
}

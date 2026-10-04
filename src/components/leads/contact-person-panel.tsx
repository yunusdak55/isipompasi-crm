"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import { setContactPersonAction, type ContactPersonState } from "@/app/(dashboard)/leads/actions";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const selectClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03] [&>option]:text-[#111827]";

const initialState: ContactPersonState = { error: null };

export type ContactPersonOption = { value: string; label: string };

/**
 * TEK "Görüşen Kişi" secimi (spec 2026-10-02: "Görüşen Kişi/Satış Personeli
 * iki kısım var, teke indir"). Eskiden "Satış Personeli Ata" (giris hesabi)
 * ve "Görüşen Kişi" (isim listesi) iki ayri kart olarak sunuluyordu; secenekler
 * artik tek listede, deger on eki kaynagi belirler (bkz. setContactPersonAction).
 */
export function ContactPersonPanel({
  leadId,
  currentValue,
  options,
}: {
  leadId: string;
  currentValue: string;
  options: ContactPersonOption[];
}) {
  const boundAction = setContactPersonAction.bind(null, leadId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);

  if (options.length === 0) {
    return <p className="text-xs text-ink-400">Henüz tanımlı kişi yok — Firma Ayarları&apos;ndan isim ekleyin.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      {/* key={currentValue}: React <select defaultValue> re-sync duzeltmesi (diger paneller ile ayni). */}
      <select key={currentValue || "none"} name="person" defaultValue={currentValue} className={selectClass}>
        <option value="">Belirtilmedi</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
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

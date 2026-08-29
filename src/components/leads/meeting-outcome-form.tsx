"use client";

import { useActionState, useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { logMeetingOutcomeAction, type MeetingOutcomeState } from "@/app/(dashboard)/leads/actions";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS } from "@/lib/constants/lead";
import { Button } from "@/components/ui/button";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/types/domain";

const fieldClass =
  "w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03] [&>option]:text-[#111827]";

const initialState: MeetingOutcomeState = { error: null };

/**
 * Gorusme sonrasi TEK yerden: durum degistir + not yaz (spec: "görüşmenin
 * sonucuna göre lead durumunu seçsin - görüştük, şöyle oldu böyle oldu diye").
 * Onceden ayri "Durum" kutusu ve ayri "Not ekle" formu vardi - agent sadece
 * WhatsApp'tan lead olusturabildigi, telefon gorusmesine erisemedigi icin bu
 * adimi her zaman firma sahibi/satis personeli elle yapar; iki ayri islemi
 * tek forma indirdik.
 */
export function MeetingOutcomeForm({ leadId, currentStatus }: { leadId: string; currentStatus: LeadStatus }) {
  const boundAction = logMeetingOutcomeAction.bind(null, leadId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // SADECE not alanini temizliyoruz - eskiden formRef.current?.reset() TUM
  // formu (durum secimini de) sifirliyordu, bu da az once secilen durumun
  // "— Değiştirme —"ye geri donmus gibi gorunmesine yol aciyordu (bildirilen
  // bug: "Merve'yi teklif olarak seçtim ama değiştirme kısmına tekrar
  // düşüyor" - kayit aslinda basariyla oluyordu, sadece secim gorsel olarak
  // sifirlaniyordu). Durum secimi kaydedilen degeri gostermeye devam eder.
  useEffect(() => {
    if (justSaved && noteRef.current) noteRef.current.value = "";
  }, [justSaved]);

  const isWon = currentStatus === "won";

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-600">Potansiyel Müşterinin Durumu</span>
        {isWon ? (
          <>
            {/* Satis zaten Kanban'daki tutar akisiyla kaydedildi - burada
                yanlislikla "Lead"e geri dusurulmesin diye secim kapatilir. */}
            <input type="hidden" name="status" value="" />
            <div className={cn(fieldClass, "cursor-not-allowed text-ink-400")}>Satış — durum burada değiştirilemez</div>
          </>
        ) : (
          // key={currentStatus}: React, "select"in secili degerini defaultValue
          // prop'undan sadece MOUNT aninda degil, HER re-render'da yeniden
          // hesaplar (input/textarea'nin aksine, bu React'in bilinen bir
          // ozelligi) - form kaydedilip sayfa henuz sunucudan taze veriyi
          // almadan araya giren bir re-render, kullanicinin az once sectigi
          // degeri ESKI currentStatus'a geri dusurebiliyordu (bildirilen bug:
          // "Keşif seçtim ama tekrar Lead'e dönüşüyor"). key, currentStatus
          // GERCEKTEN degisince (yani kayit gercekten sunucuya yansiyinca)
          // secim kutusunu TEMIZ SIFIRDAN kurar - ara render'larda kullanicinin
          // secimine dokunulmaz, kaydedilince de dogru degerle acilir.
          <select key={currentStatus} name="status" defaultValue={currentStatus} className={fieldClass}>
            {LEAD_STATUS_ORDER.filter((s) => s !== "won").map((s) => (
              <option key={s} value={s}>
                {LEAD_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        )}
        {!isWon ? (
          <span className="text-[11px] text-ink-400">
            Satış tutarını girmek için Kanban&apos;da &quot;Satış&quot; kolonuna taşıyın — tutar oradan kaydedilir.
          </span>
        ) : null}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-600">Görüşmede ne oldu? (opsiyonel not)</span>
        <textarea
          ref={noteRef}
          name="note"
          rows={3}
          placeholder="ör. Aradım, önümüzdeki hafta keşif için müsait…"
          className={fieldClass}
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
            "Kaydet"
          )}
        </Button>
      </div>
    </form>
  );
}

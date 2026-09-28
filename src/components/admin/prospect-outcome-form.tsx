"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarClock, Check, Handshake, NotebookPen, XCircle } from "lucide-react";
import { logProspectOutcomeAction, type LogProspectOutcomeState } from "@/app/(dashboard)/admin/prospects/actions";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { cn } from "@/lib/utils";

const initialState: LogProspectOutcomeState = { error: null };

const fieldClass =
  "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:outline-none";

const outcomeButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ease-snappy active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60";

// Bir satiscinin telefonda en sik soyledigi araliklar - tek tikla doldurmak
// icin (spec 2026-10-01: "kaç gün sonra takip edilsin kısmını estetikleştir,
// bir tık daha iyileştir").
const QUICK_FOLLOWUP_DAYS = [1, 3, 7, 14];

/**
 * "Görüşme Sonucu" - GORUSME KAYDININ TEK YERI (spec 2026-09-30: "ben bunu
 * bir yerden belirlerim farklı farklı yerlerden değil"). Onceden ayrica bir
 * "Durum" dropdown'i ve ayrica bir "Sonraki Takip" karti da vardi - ikisi de
 * kaldirildi (bkz. [id]/page.tsx, prospects/page.tsx), status/next_followup_at
 * artik SADECE bu formdan degisiyor.
 *
 * "Takibe Al" etkilesimi (spec: "5 gün sonrası yazdığımda onu onaylayacak
 * bir ikon çıksın, ona basınca onaylasın ve kayıt etsin takvime"): gun sayisi
 * girilen input'un hemen yaninda AYRI bir yesil onay (check) ikon-butonu var -
 * yazip o ikona basmak tek basina yeterli, ayni anda notu da gonderiyor.
 *
 * DUZELTME (spec 2026-09-30, "her şey üst üste biniyor, kaydırma ikonu var
 * onu kaldır, kaç gün sonra takip edilsin içeride değil aşağıda yazsın"):
 * "kaç gün sonra?" metni ARTIK input'un icinde (placeholder) DEGIL, ayri bir
 * etiket olarak ustte - uzun placeholder input'u dolduruyor, check butonuyla
 * ust uste biniyordu. Tarayicinin varsayilan sayi ok ikonlari da globals.css'te
 * (input[type=number] kurali, TUM uygulama icin) kaldirildi.
 *
 * DUZELTME (spec 2026-10-01, "içime sinmedi, bir tık daha iyileştir"): input
 * ve onay butonu ARTIK ayri iki kutu (gap ile yan yana) degil, TEK bir
 * cerceve icinde birlesik tek parca bir kontrol - ayrica altina 1/3/7/14 gun
 * icin tek-tikla dolduran hizli secim cipleri eklendi (telefonda "1 hafta
 * sonra arayayım" gibi bir cumleyi yazmadan tek tikla girebilmek icin).
 */
export function ProspectOutcomeForm({ prospectId }: { prospectId: string }) {
  const boundAction = logProspectOutcomeAction.bind(null, prospectId);
  const [state, formAction, isPending] = useActionState(boundAction, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);
  const formRef = useRef<HTMLFormElement>(null);
  const [days, setDays] = useState("");

  useEffect(() => {
    if (justSaved) {
      formRef.current?.reset();
      setDays("");
    }
  }, [justSaved]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-600">Görüşmede ne oldu?</span>
        <textarea
          name="note"
          rows={3}
          placeholder="ör. Aradım, fiyat teklifiyle ilgileniyor, hafta sonu karar verecek."
          className={cn(fieldClass, "w-full resize-none")}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-ink-600">Kaç gün sonra takip edilsin?</span>
        <div
          className={cn(
            "flex items-center gap-2 rounded-lg border bg-warning-500/10 py-1.5 pl-3 pr-1.5 transition-colors duration-150",
            "border-warning-500/40 focus-within:border-warning-500/70"
          )}
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-warning-500" />
          <input
            type="number"
            name="followup_days"
            min={0}
            step={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="3"
            aria-label="Kaç gün sonra aransın"
            className="w-9 shrink-0 bg-transparent text-center text-sm font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus-visible:outline-none"
          />
          <span className="flex-1 whitespace-nowrap text-xs text-ink-500">gün sonra</span>
          <button
            type="submit"
            name="outcome"
            value="followup"
            disabled={isPending || days.trim() === ""}
            aria-label="Takip tarihini onayla ve takvime kaydet"
            title="Onayla ve takvime kaydet"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all duration-150 ease-snappy active:scale-90",
              days.trim() === "" ? "text-ink-300" : "bg-warning-500 text-white shadow-sm hover:bg-warning-600"
            )}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-500">Hızlı seç:</span>
          {QUICK_FOLLOWUP_DAYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(String(d))}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors duration-150",
                days === String(d)
                  ? "border-warning-500/50 bg-warning-500/15 text-warning-600"
                  : "border-line text-ink-500 hover:border-warning-500/30 hover:text-ink-900"
              )}
            >
              {d} gün
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="outcome"
          value="won"
          disabled={isPending}
          className={cn(outcomeButton, "border-success-500/40 bg-success-500/15 text-[#7ee2ad] hover:bg-success-500/25")}
        >
          <Handshake className="h-4 w-4" />
          Satış
        </button>

        <button
          type="submit"
          name="outcome"
          value="lost"
          disabled={isPending}
          className={cn(outcomeButton, "border-danger-500/40 bg-danger-500/15 text-[#ffb4a3] hover:bg-danger-500/25")}
        >
          <XCircle className="h-4 w-4" />
          Kayıp
        </button>

        <button
          type="submit"
          name="outcome"
          value="note"
          disabled={isPending}
          className={cn(outcomeButton, "border-line bg-white/[0.03] text-ink-600 hover:bg-white/[0.06] hover:text-ink-900")}
        >
          <NotebookPen className="h-4 w-4" />
          Sadece Not
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : justSaved ? (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8ef0b8]">
          <Check className="h-3.5 w-3.5" />
          Kaydedildi
        </p>
      ) : isPending ? (
        <p className="text-xs text-ink-600">Kaydediliyor…</p>
      ) : null}
    </form>
  );
}

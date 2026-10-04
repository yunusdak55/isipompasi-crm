"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarClock, Check, Handshake, NotebookPen, XCircle } from "lucide-react";
import { useSaveFeedback } from "@/lib/hooks/use-save-feedback";
import { formatFollowupDate, parseFollowupDays, resolveFollowupAt } from "@/lib/followup";
import { cn } from "@/lib/utils";

export type OutcomeState = { error: string | null };
export type OutcomeAction = (prevState: OutcomeState, formData: FormData) => Promise<OutcomeState>;

const initialState: OutcomeState = { error: null };

const fieldClass =
  "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:outline-none";

const outcomeButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ease-snappy active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60";

const QUICK_FOLLOWUP_DAYS = [1, 3, 7, 14, 30];

/**
 * "GÖRÜŞME SONUCU" - hem ajans admin panelindeki aday detayinda hem firma
 * panelindeki lead detayinda AYNI form (spec 2026-10-02: "firma panelinde
 * görüşmede ne oldu kısmı benim paneldeki gibi olsun"). Yazilan not HER
 * ZAMAN zaman cizelgesine tarih/saatiyle eklenir; sonuc butonlari
 * (takibe al / satis / kayip / sadece not) durumu ve takibi tek adimda gunceller.
 *
 * GELISTIRMELER (admin formundaki eksikler):
 *  - Yazilan not artik KONTROLLU state'te: sunucu hata dondurse bile
 *    kaybolmaz, yalnizca BASARILI kayittan sonra temizlenir.
 *  - Secilen gun sayisinin gercek tarihi/gunu canli onizlenir ("Salı 6 Ekim
 *    10:00"), hafta sonuna denk gelirse uyarilir.
 *  - Hizli secimler 1/3/7/14/30 gun.
 *  - Firma panelinde "Satış" icin tutar (zorunlu) sorulur.
 */
export function OutcomeForm({
  action,
  winLabel = "Satış",
  askSaleAmount = false,
  canWin = true,
}: {
  action: OutcomeAction;
  winLabel?: string;
  /** true: "Satış" sonucu tutar ister (firma paneli). */
  askSaleAmount?: boolean;
  /** false: satis sonucu bu rol icin gizlenir (ör. "sales" rolu satis kaydedemez). */
  canWin?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const justSaved = useSaveFeedback(isPending, state.error);

  const [note, setNote] = useState("");
  const [days, setDays] = useState("");
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleAmount, setSaleAmount] = useState("");

  useEffect(() => {
    if (justSaved) {
      setNote("");
      setDays("");
      setSaleOpen(false);
      setSaleAmount("");
    }
  }, [justSaved]);

  const checkRef = useRef<HTMLButtonElement>(null);

  const parsedDays = parseFollowupDays(days);
  const preview = parsedDays !== null ? resolveFollowupAt(parsedDays) : null;
  // Pazar=0, Cumartesi=6 (Turkiye saatine gore hesaplanir)
  const weekdayTR = preview
    ? new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(preview)
    : null;
  const isWeekend = weekdayTR === "Sat" || weekdayTR === "Sun";

  // GUVENLIK: bir <input>'ta Enter, tarayicida formun ilk AKTIF submit
  // butonunu tetikler - gun alani bosken bu "Satış"/"Kayıp" olabiliyordu
  // (yanlislikla kapanis). Enter yalnizca gecerli gun alaninda onay
  // ikonunu tetikler, diger input'larda hicbir sey yapmaz.
  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement)) return;
    e.preventDefault();
    if (e.target.name === "followup_days" && parsedDays !== null && !isPending) {
      checkRef.current?.click();
    }
  }

  return (
    <form action={formAction} onKeyDown={handleKeyDown} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-ink-600">Görüşmede ne oldu?</span>
        <textarea
          name="note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="ör. Aradım, fiyat teklifiyle ilgileniyor, hafta sonu karar verecek."
          className={cn(fieldClass, "w-full resize-none")}
        />
        <span className="text-[11px] text-ink-500">Yazdığınız not, tarih ve saatiyle Zaman Çizelgesi&apos;ne eklenir.</span>
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
            max={3650}
            step={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            placeholder="3"
            aria-label="Kaç gün sonra aransın"
            className="w-12 shrink-0 bg-transparent text-center text-sm font-semibold text-ink-900 placeholder:font-normal placeholder:text-ink-400 focus-visible:outline-none"
          />
          <span className="flex-1 whitespace-nowrap text-xs text-ink-500">gün sonra</span>
          <button
            ref={checkRef}
            type="submit"
            name="outcome"
            value="followup"
            disabled={isPending || parsedDays === null}
            aria-label="Takip tarihini onayla ve takvime kaydet"
            title="Onayla ve takvime kaydet"
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all duration-150 ease-snappy active:scale-90",
              parsedDays === null ? "text-ink-300" : "bg-warning-500 text-white shadow-sm hover:bg-warning-600"
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
              {d === 30 ? "1 ay" : `${d} gün`}
            </button>
          ))}
        </div>

        {preview ? (
          <div className="animate-fade-in flex flex-col gap-1.5">
            <p className="text-xs text-ink-600">
              Takip tarihi: <span className="font-medium text-ink-900">{formatFollowupDate(preview)}</span>
              {isWeekend ? <span className="ml-1.5 font-medium text-warning-500">(hafta sonu)</span> : null}
            </p>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {canWin ? (
          askSaleAmount ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setSaleOpen((v) => !v)}
              aria-expanded={saleOpen}
              className={cn(
                outcomeButton,
                "border-success-500/40 bg-success-500/15 text-[#7ee2ad] hover:bg-success-500/25",
                saleOpen && "bg-success-500/25"
              )}
            >
              <Handshake className="h-4 w-4" />
              {winLabel}
            </button>
          ) : (
            <button
              type="submit"
              name="outcome"
              value="won"
              disabled={isPending}
              className={cn(outcomeButton, "border-success-500/40 bg-success-500/15 text-[#7ee2ad] hover:bg-success-500/25")}
            >
              <Handshake className="h-4 w-4" />
              {winLabel}
            </button>
          )
        ) : null}

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

      {askSaleAmount && canWin && saleOpen ? (
        <div className="animate-fade-in flex flex-col gap-2 rounded-lg border border-success-500/30 bg-success-500/[0.08] p-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-600">Satış tutarı (₺)</span>
            <input
              type="number"
              name="sale_amount"
              min={0}
              step="1"
              value={saleAmount}
              onChange={(e) => setSaleAmount(e.target.value)}
              placeholder="ör. 425000"
              autoFocus
              className={cn(fieldClass, "w-full")}
            />
          </label>
          <button
            type="submit"
            name="outcome"
            value="won"
            disabled={isPending || saleAmount.trim() === ""}
            className={cn(outcomeButton, "border-success-500/50 bg-success-500/25 text-[#8ef0b8] hover:bg-success-500/35")}
          >
            <Check className="h-4 w-4" />
            Satışı Kaydet
          </button>
        </div>
      ) : null}

      {state.error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : justSaved ? (
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8ef0b8]">
          <Check className="h-3.5 w-3.5" />
          Kaydedildi — Zaman Çizelgesi&apos;ne eklendi
        </p>
      ) : isPending ? (
        <p className="text-xs text-ink-600">Kaydediliyor…</p>
      ) : null}
    </form>
  );
}

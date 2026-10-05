"use client";

import { useActionState, useState } from "react";
import { CalendarCheck, Check, Flag, HandCoins, Pencil, Quote, Timer, UserRound } from "lucide-react";
import { saveSaleNoteAction, type SaleNoteState } from "@/app/(dashboard)/leads/actions";
import { SalePanel } from "@/components/leads/sale-panel";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const RING_R = 44;
const RING_C = 2 * Math.PI * RING_R;

const initialState: SaleNoteState = { error: null };

/** Teklife gore satis orani - halka (en fazla tam tur) + ortada yuzde. */
function OfferRing({ ratio }: { ratio: number }) {
  const pct = Math.round(ratio * 100);
  const offset = RING_C * (1 - Math.min(ratio, 1));
  return (
    <div className="relative flex h-[124px] w-[124px] shrink-0 items-center justify-center">
      <svg viewBox="0 0 108 108" className="h-full w-full -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="sale-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#8ef0b8" />
            <stop offset="100%" stopColor="#2f8558" />
          </linearGradient>
        </defs>
        <circle cx="54" cy="54" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
        <circle
          cx="54"
          cy="54"
          r={RING_R}
          fill="none"
          stroke="url(#sale-ring-gradient)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          strokeDashoffset={offset}
          className="sale-ring"
          style={{ "--ring-c": RING_C } as React.CSSProperties}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold tabular-nums leading-none text-white">%{pct}</span>
        <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/50">teklife göre</span>
      </div>
    </div>
  );
}

/**
 * "YAPILAN SATIŞ" vitrini (spec 2026-10-05). Yalnizca satis KAYDI VARSA gosterilir;
 * tutar "Görüşme Sonucu -> Satış" adiminda girilir (eskiden satis yokken de bos bir
 * tutar formu duruyordu). Icerik: satis degeri, tarih / kac gunde kapandi / gorusen
 * kisi, teklife gore oran halkasi, lead -> satis yolu ve satis notu. Not kaydedilince
 * Zaman Cizelgesi'ne satis ikonuyla duser (saveSaleNoteAction).
 *
 * Tum animasyonlar TEK SEFERLIK (halka cizimi, yol cizgisi) - surekli donen efekt yok.
 * Tarih / para bicimleri lib/utils'te Turkiye saatine sabit; gun farki sunucuda hesaplanir.
 */
export function SaleShowcase({
  leadId,
  amount,
  saleDate,
  note,
  offeredAmount,
  leadCreatedAt,
  daysToClose,
  contactName,
}: {
  leadId: string;
  amount: number;
  saleDate: string;
  note: string | null;
  offeredAmount: number | null;
  leadCreatedAt: string;
  /** Lead'in gelisinden satisa kadar gecen gun (Turkiye takvimi, sunucuda hesaplanir). */
  daysToClose: number;
  contactName: string | null;
}) {
  const [state, formAction, isPending] = useActionState(saveSaleNoteAction.bind(null, leadId), initialState);
  // Duzenleme, o an KAYITLI olan not metni icin acilir: kayit basarili olup sunucudan
  // yeni not gelince (prop degisir) okuma gorunumune kendiliginden donulur.
  const [editingFor, setEditingFor] = useState<string | null>(null);
  const editingNote = !note || editingFor === note;
  const [draft, setDraft] = useState(note ?? "");
  const [editingAmount, setEditingAmount] = useState(false);

  const ratio = offeredAmount && offeredAmount > 0 ? amount / offeredAmount : null;

  return (
    <section className="animate-slide-up relative isolate overflow-hidden rounded-2xl border border-success-500/30 shadow-elevated-lg">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: "linear-gradient(135deg, rgba(47,133,88,0.30) 0%, rgba(15,38,69,0.92) 46%, #0b1f3a 100%)" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-28 -z-10 h-72 w-72 rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(142,240,184,0.22), transparent)" }}
      />
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8ef0b8]/70 to-transparent" />

      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-500 text-white shadow-elevated ring-1 ring-inset ring-white/25">
              <HandCoins className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8ef0b8]">Yapılan Satış</p>
            <button
              type="button"
              onClick={() => setEditingAmount((v) => !v)}
              aria-expanded={editingAmount}
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/50 transition-colors duration-150 hover:border-white/25 hover:text-white sm:ml-2"
            >
              <Pencil className="h-3 w-3" />
              Tutarı düzelt
            </button>
          </div>

          <p className="sale-amount mt-3 text-[2.6rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[3.4rem]">
            {formatCurrency(amount)}
          </p>

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-white/75 ring-1 ring-inset ring-white/10">
              <CalendarCheck className="h-3.5 w-3.5 text-[#8ef0b8]" />
              {formatDate(saleDate)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-white/75 ring-1 ring-inset ring-white/10">
              <Timer className="h-3.5 w-3.5 text-[#8ef0b8]" />
              {daysToClose <= 0 ? "Aynı gün kapandı" : `${daysToClose} günde kapandı`}
            </span>
            {contactName ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-white/75 ring-1 ring-inset ring-white/10">
                <UserRound className="h-3.5 w-3.5 text-[#8ef0b8]" />
                {contactName}
              </span>
            ) : null}
          </div>

          {/* Lead -> Satış yolu: cizgi soldan saga bir kez cizilir, satis noktasi ardindan belirir. */}
          <div className="mt-5 flex max-w-md items-center gap-3 text-[11px] text-white/55">
            <span className="flex shrink-0 flex-col">
              <span className="font-medium text-white/80">Lead geldi</span>
              <span>{formatDate(leadCreatedAt)}</span>
            </span>
            <span className="relative h-px flex-1 bg-white/10">
              <span className="sale-journey-line absolute inset-0 bg-gradient-to-r from-white/40 to-[#8ef0b8]" />
              <span className="absolute -left-1 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white/60" />
              <span className="sale-journey-end absolute -right-1.5 top-1/2 flex h-3.5 w-3.5 -translate-y-1/2 items-center justify-center rounded-full bg-[#8ef0b8] text-brand-950">
                <Flag className="h-2 w-2" strokeWidth={3} />
              </span>
            </span>
            <span className="flex shrink-0 flex-col text-right">
              <span className="font-medium text-[#8ef0b8]">Satış</span>
              <span>{formatDate(saleDate)}</span>
            </span>
          </div>
        </div>

        {ratio !== null ? (
          <div className="flex shrink-0 items-center gap-4 sm:flex-col sm:gap-2">
            <OfferRing ratio={ratio} />
            <p className="text-xs text-white/55 sm:text-center">
              Teklif <span className="font-medium tabular-nums text-white/80">{formatCurrency(offeredAmount)}</span>
            </p>
          </div>
        ) : null}
      </div>

      {editingAmount ? (
        <div className="animate-fade-in border-t border-white/10 px-5 py-4 sm:px-6">
          <div className="max-w-xs">
            <SalePanel leadId={leadId} currentSaleAmount={amount} />
          </div>
        </div>
      ) : null}

      <div className="border-t border-white/10 bg-black/[0.12] px-5 py-4 sm:px-6">
        {note && !editingNote ? (
          <div className="flex items-start gap-3">
            <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[#8ef0b8]" />
            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#7ee2ad]">Satış notu</p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/85">{note}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraft(note);
                setEditingFor(note);
              }}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/50 transition-colors duration-150 hover:border-white/25 hover:text-white"
            >
              <Pencil className="h-3 w-3" />
              Düzenle
            </button>
          </div>
        ) : (
          <form action={formAction} className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#7ee2ad]">Satış notu</span>
              <textarea
                name="sale_note"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ödeme şekli, taksit, teslim tarihi, satılan ürün ve miktar…"
                className="w-full resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-[#8ef0b8]/60 focus-visible:outline-none"
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                disabled={isPending || draft.trim() === "" || draft.trim() === (note ?? "")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border border-success-500/50 bg-success-500/25 px-3.5 py-2 text-sm font-medium text-[#8ef0b8] transition-all duration-150 ease-snappy hover:bg-success-500/35 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <Check className="h-4 w-4" />
                {isPending ? "Kaydediliyor…" : "Notu Kaydet"}
              </button>
              {note ? (
                <button type="button" onClick={() => setEditingFor(null)} className="text-xs text-white/50 hover:text-white">
                  Vazgeç
                </button>
              ) : null}
              <span className="text-[11px] text-white/40">Not, satış ikonuyla Zaman Çizelgesi&apos;ne eklenir.</span>
            </div>
            {state.error ? (
              <p role="alert" className="text-xs text-[#ffb4a3]">
                {state.error}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}

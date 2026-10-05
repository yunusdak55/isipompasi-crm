"use client";

import { useActionState, useState } from "react";
import { CalendarCheck, Check, HandCoins, Pencil, Quote } from "lucide-react";
import { upsertSaleAction, type SaleActionState } from "@/app/(dashboard)/leads/actions";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const initialState: SaleActionState = { error: null };

const fieldClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-[#8ef0b8]/60 focus-visible:outline-none";

type Sale = { amount: number; saleDate: string; note: string | null };

/**
 * SATIŞ - "Görüşme Sonucu"ndan AYRI, sade bolum (spec 2026-10-05): satis yalnizca
 * iki bilgidir - TUTAR ve (istege bagli) SATIS NOTU. "Satış Yapıldı"ya basinca bu iki
 * alan acilir; gorusme notu SORULMAZ (o zamana kadarki surec zaten Zaman Cizelgesi'nde).
 * Kaydedilince tutar ve not burada gorunur, Zaman Cizelgesi'ne satis ikonuyla duser.
 *
 * Yalnizca gercek veri gosterilir: tutar, satis tarihi, not. (Bir ara eklenen "teklife
 * gore oran" halkasi ve lead -> satis cizgisi kaldirildi: istenmeyen, turetilmis
 * gostergelerdi.)
 */
export function SaleSection({ leadId, sale }: { leadId: string; sale: Sale | null }) {
  const [state, formAction, isPending] = useActionState(upsertSaleAction.bind(null, leadId), initialState);

  // Form, o an KAYITLI olan satis icin acilir: kayit basarili olup sunucudan yeni
  // deger gelince (anahtar degisir) okuma gorunumune kendiliginden donulur.
  const saleKey = sale ? `${sale.amount}|${sale.note ?? ""}` : "yok";
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === saleKey;

  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  function openForm() {
    setAmount(sale ? String(sale.amount) : "");
    setNote(sale?.note ?? "");
    setOpenFor(saleKey);
  }

  const unchanged = sale !== null && Number(amount) === sale.amount && note.trim() === (sale.note ?? "");

  return (
    <section
      className={cn(
        "animate-slide-up relative isolate overflow-hidden rounded-2xl border",
        sale ? "border-success-500/35 shadow-elevated-lg" : "border-line bg-surface"
      )}
    >
      {sale ? (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{ background: "linear-gradient(135deg, rgba(47,133,88,0.32) 0%, rgba(15,38,69,0.94) 52%, #0b1f3a 100%)" }}
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-20 -top-24 -z-10 h-64 w-64 rounded-full"
            style={{ background: "radial-gradient(closest-side, rgba(142,240,184,0.20), transparent)" }}
          />
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8ef0b8]/70 to-transparent" />
        </>
      ) : null}

      {!open ? (
        sale ? (
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-500 text-white shadow-elevated ring-1 ring-inset ring-white/25">
                <HandCoins className="h-[18px] w-[18px]" strokeWidth={2} />
              </span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8ef0b8]">Yapılan Satış</p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-xs text-white/70 ring-1 ring-inset ring-white/10">
                <CalendarCheck className="h-3.5 w-3.5 text-[#8ef0b8]" />
                {formatDate(sale.saleDate)}
              </span>
              <button
                type="button"
                onClick={openForm}
                className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-white/55 transition-colors duration-150 hover:border-white/25 hover:text-white"
              >
                <Pencil className="h-3 w-3" />
                Düzenle
              </button>
            </div>

            <p className="sale-amount mt-4 text-[2.75rem] font-semibold leading-none tracking-tight tabular-nums sm:text-[3.5rem]">
              {formatCurrency(sale.amount)}
            </p>

            {sale.note ? (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-white/10 bg-black/[0.14] px-4 py-3">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[#8ef0b8]" />
                <div className="min-w-0">
                  <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[#7ee2ad]">Satış notu</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-white/85">{sale.note}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-ink-900">Satış</p>
              <p className="mt-0.5 text-xs text-ink-600">Bu müşteriye satış yapıldıysa tutarı ve notu buradan kaydedin.</p>
            </div>
            <button
              type="button"
              onClick={openForm}
              className="inline-flex items-center gap-2 rounded-lg border border-success-500/50 bg-success-500/20 px-4 py-2.5 text-sm font-semibold text-[#8ef0b8] transition-all duration-150 ease-snappy hover:bg-success-500/30 active:scale-[0.97]"
            >
              <HandCoins className="h-4 w-4" />
              Satış Yapıldı
            </button>
          </div>
        )
      ) : (
        <form action={formAction} className={cn("flex flex-col gap-3 p-5 sm:p-6", !sale && "bg-success-500/[0.06]")}>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#8ef0b8]">
            <HandCoins className="h-4 w-4" />
            {sale ? "Satışı düzenle" : "Satış yapıldı"}
          </p>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/70">Satış tutarı (₺)</span>
            <input
              type="number"
              name="sale_amount"
              min={0}
              step="1"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="ör. 425000"
              className={cn(fieldClass, "max-w-xs text-base font-semibold tabular-nums")}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/70">
              Satış notu <span className="font-normal text-white/40">(isteğe bağlı)</span>
            </span>
            <textarea
              name="sale_note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ödeme şekli, taksit, teslim tarihi, satılan ürün ve miktar…"
              className={cn(fieldClass, "resize-none")}
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isPending || amount.trim() === "" || unchanged}
              className="inline-flex items-center gap-1.5 rounded-lg border border-success-500/50 bg-success-500/25 px-4 py-2.5 text-sm font-semibold text-[#8ef0b8] transition-all duration-150 ease-snappy hover:bg-success-500/35 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              {isPending ? "Kaydediliyor…" : "Satışı Kaydet"}
            </button>
            <button type="button" onClick={() => setOpenFor(null)} className="text-sm text-white/55 transition-colors hover:text-white">
              Vazgeç
            </button>
          </div>
          {state.error ? (
            <p role="alert" className="text-xs text-[#ffb4a3]">
              {state.error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  );
}

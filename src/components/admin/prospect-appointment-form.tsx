"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CalendarPlus, X } from "lucide-react";
import { createProspectWithFollowupAction, type FollowupActionState } from "@/app/(dashboard)/admin/prospects/actions";
import { Button } from "@/components/ui/button";

const fieldClass =
  "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.07] focus-visible:outline-none";

const initialState: FollowupActionState = { error: null };

/**
 * Takvimden dogrudan YENI bir musteri adayi + ilk arama tarihi ekleme.
 * DUZELTME (spec 2026-09-30: "ben bunu bir yerden belirlerim, farklı
 * farklı yerlerden değil"): daha once burada VAR OLAN bir adayin takip
 * tarihini de degistirebiliyordunuz - bu, [id] sayfasindaki "Görüşme
 * Sonucu" formuyla AYNI islevi ikinci bir yerden yapiyordu. Kaldirildi -
 * var olan bir adayin tarihini degistirmek/sonucunu kaydetmek artik
 * SADECE profilindeki "Görüşme Sonucu" formundan yapiliyor.
 */
export function ProspectAppointmentForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(createProspectWithFollowupAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !isPending && state.error === null) {
      setOpen(false);
      formRef.current?.reset();
      submittedRef.current = false;
    }
  }, [isPending, state]);

  if (!open) {
    return (
      <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="gap-1.5">
        <CalendarPlus className="h-4 w-4" />
        Yeni Aday + İlk Arama Tarihi
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="animate-slide-up flex flex-wrap items-end gap-3 rounded-xl border border-white/12 bg-white/[0.04] p-3.5"
    >
      <label className="flex min-w-[160px] flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium text-white/55">Firma Adı</span>
        <input type="text" name="new_company_name" required placeholder="ör. Yılmaz Isı Sistemleri" className={fieldClass} />
      </label>
      <label className="flex min-w-[140px] flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium text-white/55">Telefon</span>
        <input type="tel" name="new_company_phone" placeholder="05xx xxx xx xx" className={fieldClass} />
      </label>
      <label className="flex w-32 flex-col gap-1.5">
        <span className="text-xs font-medium text-white/55">Kaç Gün Sonra?</span>
        <input type="number" name="followup_days" min={0} step={1} required placeholder="ör. 3" className={fieldClass} />
      </label>
      <label className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        <span className="text-xs font-medium text-white/55">Not (opsiyonel)</span>
        <input type="text" name="followup_note" placeholder="ör. tekrar ara" className={fieldClass} />
      </label>

      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Kaydediliyor…" : "Kaydet"}
        </Button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 text-white/60 transition-colors duration-150 hover:bg-white/[0.08] hover:text-white"
          aria-label="İptal"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {state.error ? (
        <p role="alert" className="w-full text-xs text-[#ffb4a3]">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

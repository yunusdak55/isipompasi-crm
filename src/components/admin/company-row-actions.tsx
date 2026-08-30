"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toggleCompanyActiveAction, deleteCompanyAction } from "@/app/(dashboard)/admin/actions";
import { cn } from "@/lib/utils";

/**
 * Firma karşılaştırma tablosundaki "Durum" hücresi - eskiden sadece salt
 * okunur bir "Aktif/Pasif" rozetiydi, degistirilemiyordu. Yanina kalici
 * SILME de eklendi (spec: "istediğim firmayı pasif hale getirmenin yanı
 * sıra kaldırabileyim, silebiliyim yani") - bu, firmaya bagli gercek giris
 * hesaplarini da kaldirir, GERİ ALINAMAZ.
 */
export function CompanyRowActions({ companyId, name, isActive }: { companyId: string; name: string; isActive: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending || isDeleting}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await toggleCompanyActiveAction(companyId, !isActive, { error: null });
            if (result.error) setError(result.error);
          });
        }}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 disabled:opacity-60",
          isActive ? "bg-success-500/70" : "bg-ink-100"
        )}
        aria-label={isActive ? "Firmayı pasifleştir" : "Firmayı aktifleştir"}
        title={isActive ? "Aktif - pasifleştirmek için tıkla" : "Pasif - aktifleştirmek için tıkla"}
      >
        <span
          className={cn(
            "absolute h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-150",
            isActive ? "translate-x-[18px]" : "translate-x-0.5"
          )}
        />
      </button>
      <button
        type="button"
        disabled={isPending || isDeleting}
        onClick={() => {
          if (
            !window.confirm(
              `${name} firmasını KALICI OLARAK silmek istediğinize emin misiniz? Bu firmanın tüm lead, satış, takip kayıtları ve giriş hesapları da silinecek. Bu işlem geri alınamaz.`
            )
          )
            return;
          setError(null);
          startDelete(async () => {
            const result = await deleteCompanyAction(companyId, { error: null });
            if (result.error) setError(result.error);
          });
        }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-400 transition-colors duration-150 hover:bg-danger-500/10 hover:text-danger-500 disabled:opacity-50"
        aria-label={`${name} firmasını sil`}
        title="Firmayı kalıcı olarak sil"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      {error ? <span className="text-[10px] text-[#ffb4a3]">{error}</span> : null}
    </div>
  );
}

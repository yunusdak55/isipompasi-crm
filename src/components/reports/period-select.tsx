"use client";

import { useRouter } from "next/navigation";
import type { ReportPeriodOption } from "@/lib/data/reports";

/**
 * Raporlar sayfasi donem secici (spec: "her ayın raporları farklı olsun...
 * TÜM ZAMANLAR ayarı da olsun"). Secim aninda URL'i (?period=...) gunceller -
 * lead-filters.tsx'teki durum secimiyle ayni "buton beklemeden aninda
 * filtrele" davranisi.
 */
export function PeriodSelect({ options, value }: { options: ReportPeriodOption[]; value: string }) {
  const router = useRouter();

  return (
    <select
      key={value}
      defaultValue={value}
      onChange={(e) => router.push(`/reports?period=${e.target.value}`)}
      className="rounded-lg border border-line bg-canvas px-3 py-2 text-sm font-medium text-ink-900 transition-colors duration-150 focus-visible:border-accent-400 [&>option]:text-[#111827]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

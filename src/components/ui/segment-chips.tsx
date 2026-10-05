"use client";

import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  count: number;
  /** "danger": sayi > 0 iken kirmizi vurgu (gecikenler). */
  tone?: "accent" | "danger";
};

/**
 * Liste ustu AYIRMA rozetleri (spec 2026-10-05: "takipte kısmı leadlerdeki gibi
 * ayrılsın"). Gorunum Leadler'deki durum seridiyle ayni dildedir; fark: burada
 * filtre sunucuya gitmeden, zaten yuklenmis liste uzerinde aninda uygulanir.
 */
export function SegmentChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (next: T) => void;
  /** Ekran okuyucu icin grubun adi. */
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        const danger = option.tone === "danger" && option.count > 0;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all duration-150 ease-snappy",
              active
                ? danger
                  ? "border-danger-500/60 bg-danger-500/[0.16] text-white"
                  : "border-accent-400/50 bg-accent-500/[0.12] text-white shadow-glow-accent"
                : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
            )}
          >
            {option.label}{" "}
            <span className={cn("tabular-nums", danger ? "font-semibold text-[#ffb4a3]" : "opacity-70")}>({option.count})</span>
          </button>
        );
      })}
    </div>
  );
}

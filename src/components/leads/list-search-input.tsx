"use client";

import { Search, X } from "lucide-react";

/**
 * Uzun takip/gecikme listeleri için anında (sunucuya gitmeden) filtreleyen arama kutusu.
 * Filtrelemeyi liste bileşeni yapar; bu yalnızca kutunun kendisidir.
 */
export function ListSearchInput({
  value,
  onChange,
  resultCount,
  total,
}: {
  value: string;
  onChange: (next: string) => void;
  resultCount: number;
  total: number;
}) {
  const filtering = value.trim().length > 0;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="relative block w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="İsim veya telefonla ara…"
          aria-label="Listede ara"
          className="w-full rounded-lg border border-white/15 bg-white/[0.06] py-2 pl-9 pr-9 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.09] focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
        />
        {filtering ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Aramayı temizle"
            className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-white/45 hover:bg-white/10 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </label>
      {filtering ? (
        <p className="text-xs text-white/50">
          {resultCount.toLocaleString("tr-TR")} / {total.toLocaleString("tr-TR")} kayıt
        </p>
      ) : null}
    </div>
  );
}

import { Search } from "lucide-react";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS } from "@/lib/constants/lead";

/**
 * Duz HTML GET form: JS gerektirmez, URL'i (?q=...&status=...) gunceller.
 * Server Component olarak kalir. Koyu lacivert panel zemini icin uyarlandi
 * (bg-white/10 + white metin) - marka revizyonu: Leadler/Kanban artik dark
 * panel icinde.
 */
export function LeadFilters({ defaultSearch, defaultStatus }: { defaultSearch?: string; defaultStatus?: string }) {
  return (
    <form action="/leads" method="GET" className="flex flex-wrap items-center gap-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          name="q"
          defaultValue={defaultSearch}
          placeholder="İsim veya telefon ara…"
          className="w-64 rounded-lg border border-white/15 bg-white/[0.07] py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.11]"
        />
      </div>

      <select
        name="status"
        defaultValue={defaultStatus ?? ""}
        className="rounded-lg border border-white/15 bg-white/[0.07] px-3 py-2 text-sm text-white transition-colors duration-150 focus-visible:border-accent-400 [&>option]:text-[#111827]"
      >
        <option value="">Tüm Durumlar</option>
        {LEAD_STATUS_ORDER.map((status) => (
          <option key={status} value={status}>
            {LEAD_STATUS_LABELS[status]}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="rounded-lg border border-white/15 bg-white/[0.07] px-3.5 py-2 text-sm font-medium text-white transition-all duration-150 ease-snappy hover:border-white/25 hover:bg-white/[0.12] active:scale-[0.97]"
      >
        Filtrele
      </button>
    </form>
  );
}

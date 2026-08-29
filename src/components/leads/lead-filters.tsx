"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS } from "@/lib/constants/lead";
import { searchLeadSuggestionsAction, type LeadSuggestion } from "@/app/(dashboard)/leads/actions";

const fieldClass =
  "rounded-lg border border-white/15 bg-white/[0.07] text-sm text-white transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.11] focus-visible:outline-none";

/**
 * ESKIDEN duz bir HTML GET form'du - "Filtrele" butonuna basmadan hicbir
 * sey degismiyordu (bildirilen bug: "durumu seçiyorum ama filtrelemiyor" -
 * aslinda filtre mantığı çalışıyordu, sadece kullanıcı submit'e basmadan
 * bir şey olmuyordu). Simdi client component: durum seçimi ANINDA URL'i
 * (ve dolayisiyla server component'teki sonuc listesini) gunceller, arama
 * kutusu ise hem tabloyu debounce ile otomatik filtreler HEM DE Google
 * tarzi canli bir oneri kutusu gosterir (spec: "S yazınca S ile
 * başlayanlar direkt gözüksün").
 */
export function LeadFilters({ defaultSearch, defaultStatus }: { defaultSearch?: string; defaultStatus?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(defaultSearch ?? "");
  // Arama kutusu debounce'i URL'i guncellerken GUNCEL durum filtresini de
  // korumali - defaultStatus prop'u sadece ILK sunucu render'ini yansitir,
  // kullanici durum secip SONRA arama yazarsa defaultStatus'a guvenmek
  // secilen durumu sessizce sifirlardi. Bu yuzden ayrica state'te tutuluyor.
  const [status, setStatus] = useState(defaultStatus ?? "");
  const [suggestions, setSuggestions] = useState<LeadSuggestion[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function updateUrl(nextQ: string, nextStatus: string) {
    const sp = new URLSearchParams();
    if (nextQ) sp.set("q", nextQ);
    if (nextStatus) sp.set("status", nextStatus);
    // Yeni filtrede sayfa 1'e donulur - "page" bilerek eklenmiyor.
    router.replace(`/leads${sp.size > 0 ? `?${sp.toString()}` : ""}`);
  }

  // Durum secimi: buton beklemeden aninda filtrele (spec: "FİLTRELE
  // butonuna gerek kalmasın otomatik seçince filtrelensin").
  function handleStatusChange(value: string) {
    setStatus(value);
    updateUrl(query, value);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSearching(value.trim().length > 0);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateUrl(value, status);

      const term = value.trim();
      if (term.length === 0) {
        setSuggestions([]);
        setSuggestOpen(false);
        setSearching(false);
        return;
      }

      const requestId = ++requestIdRef.current;
      searchLeadSuggestionsAction(term).then((results) => {
        if (requestId !== requestIdRef.current) return; // eski istek - gecersiz kilindi
        setSuggestions(results);
        setSuggestOpen(true);
        setSearching(false);
      });
    }, 300);
  }

  function handlePickSuggestion(lead: LeadSuggestion) {
    setSuggestOpen(false);
    router.push(`/leads/${lead.id}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div ref={containerRef} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setSuggestOpen(true)}
          placeholder="İsim veya telefon ara…"
          autoComplete="off"
          className={`w-64 py-2 pl-9 pr-8 ${fieldClass} placeholder:text-white/40`}
        />
        {searching ? (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-white/40" />
        ) : null}

        {/* GOOGLE TARZI CANLI ÖNERİ KUTUSU */}
        {suggestOpen && suggestions.length > 0 ? (
          <div className="animate-slide-up absolute z-20 mt-1.5 w-80 max-w-[80vw] overflow-hidden rounded-lg border border-white/15 bg-brand-950 shadow-elevated-lg">
            {suggestions.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => handlePickSuggestion(lead)}
                className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left transition-colors duration-100 hover:bg-white/[0.08]"
              >
                <span>
                  <span className="block text-sm font-medium text-white">
                    {lead.first_name} {lead.last_name ?? ""}
                  </span>
                  <span className="block text-xs text-white/45">{lead.phone}</span>
                </span>
                <span className="shrink-0 text-[11px] text-white/40">{LEAD_STATUS_LABELS[lead.status]}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <select
        defaultValue={defaultStatus ?? ""}
        onChange={(e) => handleStatusChange(e.target.value)}
        className={`px-3 py-2 ${fieldClass} [&>option]:text-[#111827]`}
      >
        <option value="">Tüm Durumlar</option>
        {LEAD_STATUS_ORDER.map((status) => (
          <option key={status} value={status}>
            {LEAD_STATUS_LABELS[status]}
          </option>
        ))}
      </select>
    </div>
  );
}

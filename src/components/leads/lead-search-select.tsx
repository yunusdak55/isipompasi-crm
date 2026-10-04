"use client";

import { useEffect, useRef, useState } from "react";
import { searchOpenLeadsAction } from "@/app/(dashboard)/leads/search-actions";
import type { LeadSelectItem } from "@/lib/data/leads";
import { leadDisplayName } from "@/lib/utils";

const fieldClass =
  "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.07] focus-visible:outline-none";

const DEBOUNCE_MS = 200;

/**
 * Isim/telefon yazarak aranan lead secici (spec: "LEAD seçin kısmı manuel
 * olarak kişinin ismi aratılarak yapılabilsin"). Gercek secim gizli bir
 * input'ta (name=lead_id) tutulur - form her zamanki gibi normal submit olur.
 *
 * PERFORMANS (2026-10-04): lead listesi artik sayfa yuklenirken TUMUYLE
 * getirilmez; yazdikca sunucudan (debounce'lu, en fazla 8 sonuc) aranir.
 * Eskiden kutuya tiklayinca binlerce lead DOM'a basiliyor ve tarayici
 * donuyordu.
 */
export function LeadSearchSelect({ name = "lead_id" }: { name?: string }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<LeadSelectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Acikken ve bir lead SECILMEMISKEN: yazdikca (debounce) sunucudan ara. Eski
  // bir yanit gec gelirse (cancelled) yeni sonucu ezmez.
  useEffect(() => {
    if (!open || selectedId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await searchOpenLeadsAction(query);
        if (!cancelled) setResults(found);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, selectedId]);

  function handlePick(lead: LeadSelectItem) {
    setSelectedId(lead.id);
    setQuery(leadDisplayName(lead));
    setOpen(false);
  }

  function handleChange(value: string) {
    setQuery(value);
    if (selectedId) setSelectedId("");
    setOpen(true);
  }

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={selectedId} />
      <input
        type="text"
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => setOpen(true)}
        placeholder="İsim veya telefon yazın…"
        autoComplete="off"
        className={fieldClass}
      />
      {open ? (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-white/15 bg-brand-950 py-1 shadow-elevated-lg">
          {!query.trim() && results.length > 0 ? (
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">Son eklenenler</p>
          ) : null}
          {results.length === 0 ? (
            <p className="px-3 py-2 text-xs text-white/40">{loading ? "Aranıyor…" : "Eşleşen lead yok."}</p>
          ) : (
            results.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => handlePick(lead)}
                className="flex w-full flex-col items-start px-3 py-1.5 text-left transition-colors duration-100 hover:bg-white/[0.08]"
              >
                <span className="text-sm font-medium text-white">{leadDisplayName(lead)}</span>
                <span className="text-xs text-white/45">{lead.phone}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

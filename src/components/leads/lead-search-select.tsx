"use client";

import { useEffect, useRef, useState } from "react";
import type { LeadSelectItem } from "@/lib/data/leads";

const fieldClass =
  "w-full rounded-lg border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-white/35 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.07] focus-visible:outline-none";

/**
 * Isim/telefon yazarak filtrelenen lead secici - duz <select> ile buyuk
 * listelerde kaydirarak arama yapmak zor oluyordu (spec: "LEAD seçin kısmı
 * manuel olarak kişinin ismi aratılarak yapılabilsin"). Gercek secim gizli
 * bir input'ta (name=lead_id) tutulur - form her zamanki gibi normal submit
 * olur, actions.ts tarafinda hicbir degisiklik gerekmez.
 */
export function LeadSearchSelect({ leads, name = "lead_id" }: { leads: LeadSelectItem[]; name?: string }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [open, setOpen] = useState(false);
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

  const normalizedQuery = query.trim().toLocaleLowerCase("tr");
  const filtered = normalizedQuery
    ? leads.filter((l) => {
        const fullName = `${l.first_name} ${l.last_name ?? ""}`.toLocaleLowerCase("tr");
        return fullName.includes(normalizedQuery) || l.phone.includes(normalizedQuery);
      })
    : leads;

  function handlePick(lead: LeadSelectItem) {
    setSelectedId(lead.id);
    setQuery(`${lead.first_name} ${lead.last_name ?? ""}`.trim());
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
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-xs text-white/40">Eşleşen lead yok.</p>
          ) : (
            filtered.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => handlePick(lead)}
                className="flex w-full flex-col items-start px-3 py-1.5 text-left transition-colors duration-100 hover:bg-white/[0.08]"
              >
                <span className="text-sm font-medium text-white">
                  {lead.first_name} {lead.last_name ?? ""}
                </span>
                <span className="text-xs text-white/45">{lead.phone}</span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

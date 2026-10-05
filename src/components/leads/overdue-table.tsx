"use client";

import { useState } from "react";
import { IntentLink as Link } from "@/components/ui/intent-link";
import { StatusBadge } from "@/components/ui/badge";
import { OverdueBadge } from "@/components/leads/lead-indicators";
import { formatCurrency, formatDateTime, formatOverdueDays, leadContactPerson, leadDisplayName } from "@/lib/utils";
import { ListSearchInput } from "@/components/leads/list-search-input";
import type { LeadListItem } from "@/lib/data/leads";

// DUZELTME (performans denetimi 2026-10-01 - bkz. followup-table.tsx'teki
// ayni aciklama): canli olculdu, 15.211 DOM dugumu olusuyordu.
const RENDER_LIMIT = 150;
const REVEAL_STEP = 300;

/**
 * "Gecikenler" ekrani (spec 2026-10-02): takibe alinmis ve takip tarihinin
 * uzerinden 24 saatten fazla gecmis (bkz. isLeadOverdue) leadler.
 *
 * SIRALAMA (spec 2026-10-04): GECIKME GUN SAYISINA gore kucukten buyuge -
 * 1 gun, 2 gun, 5 gun, 10 gun... Veri zaten bu sirayla gelir (bkz.
 * data/leads.ts getLeadsOverdue); "Gecikme" kolonu o sirayi gorunur kilar
 * (eskiden burada "Son Görüşme" yaziyordu - alakasiz saatler listeyi
 * karisik gosteriyordu).
 */
export function OverdueTable({ leads }: { leads: LeadListItem[] }) {
  const [revealCount, setRevealCount] = useState(RENDER_LIMIT);
  const [query, setQuery] = useState("");
  // Arama TUM listeyi suzer (yalnizca gorunen 150 satiri degil), sonra gosterim siniri uygulanir.
  const needle = query.trim().toLocaleLowerCase("tr");
  const filtered = needle
    ? leads.filter((lead) => leadDisplayName(lead).toLocaleLowerCase("tr").includes(needle) || lead.phone.includes(needle))
    : leads;
  const visibleLeads = filtered.slice(0, revealCount);
  const remaining = filtered.length - visibleLeads.length;

  if (leads.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center">
        <p className="text-sm font-medium text-white">Gecikmiş lead yok</p>
        <p className="text-sm text-white/50">Takibe alınan hiçbir müşterinin takip tarihi 24 saatten fazla geçmemiş.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ListSearchInput value={query} onChange={setQuery} resultCount={filtered.length} total={leads.length} />
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.06]">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-medium uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-medium">Müşteri</th>
            <th className="px-4 py-3 font-medium">Gecikme</th>
            <th className="px-4 py-3 font-medium">Durum</th>
            <th className="px-4 py-3 font-medium">Teklif</th>
            <th className="px-4 py-3 font-medium">Görüşen Kişi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {visibleLeads.map((lead, index) => {
            const lateLabel = formatOverdueDays(lead.next_followup_at);

            return (
              <tr
                key={lead.id}
                className="group animate-slide-up transition-all duration-150 ease-snappy hover:bg-white/[0.05] hover:shadow-[inset_2px_0_0_0_#ff6a52]"
                style={{ animationDelay: `${Math.min(index, 12) * 6}ms` }}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <OverdueBadge />
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-white transition-colors group-hover:text-accent-300"
                    >
                      {leadDisplayName(lead)}
                    </Link>
                  </div>
                  <p className="mt-0.5 text-xs text-white/45">{lead.phone}</p>
                </td>
                <td className="px-4 py-3.5">
                  <p className="font-medium text-[#ffb4a3]">{lateLabel ?? "—"}</p>
                  <p className="mt-0.5 text-xs text-white/45">Takip: {formatDateTime(lead.next_followup_at)}</p>
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3.5 tabular-nums text-white/70">{formatCurrency(lead.offered_amount)}</td>
                <td className="px-4 py-3.5 text-white/70">{leadContactPerson(lead) ?? "Belirtilmedi"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 ? (
        <p className="border-t border-white/10 p-6 text-center text-sm text-white/50">Aramanızla eşleşen lead yok.</p>
      ) : null}
      {remaining > 0 ? (
        <div className="border-t border-white/10 p-3 text-center">
          <button
            type="button"
            onClick={() => setRevealCount((prev) => prev + REVEAL_STEP)}
            className="rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-white/50 transition-colors duration-150 hover:border-white/25 hover:text-white/75"
          >
            + {Math.min(remaining, REVEAL_STEP)} daha göster ({remaining} kaldı)
          </button>
        </div>
      ) : null}
    </div>
    </div>
  );
}

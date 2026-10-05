"use client";

import { useState } from "react";
import { IntentLink as Link } from "@/components/ui/intent-link";
import { StatusBadge } from "@/components/ui/badge";
import { NewLeadBadge, OverdueBadge, TodayCallBadge } from "@/components/leads/lead-indicators";
import { formatCurrency, formatRelativeDays, formatRelativeTimeAgo, isLeadNew, isLeadOverdue, leadContactPerson, leadDisplayName } from "@/lib/utils";
import { ListSearchInput } from "@/components/leads/list-search-input";
import type { LeadListItem } from "@/lib/data/leads";

// DUZELTME (performans denetimi 2026-10-01, canli kanit: izole test ortaminda
// 5.000 lead'lik bir firmada bu sayfa 16.474 DOM dugumu olusturuyordu - TUM
// takipteki lead'ler tek tabloya aninda yaziliyordu. Kanban panosundaki AYNI
// cozum (bkz. kanban-board.tsx RENDER_LIMIT_PER_COLUMN yorumu): HICBIR veri
// gizlenmez/kaybolmaz, sadece ayni anda DOM'a yazilan satir sayisi sinirlanir.
const RENDER_LIMIT = 150;
const REVEAL_STEP = 300;

/** "Takipte" ekrani (spec md.4): satiscinin takip isini tek yerde toplar. */
export function FollowupTable({ leads }: { leads: LeadListItem[] }) {
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
        <p className="text-sm font-medium text-white">Takipte bekleyen lead yok</p>
        <p className="text-sm text-white/50">Bir lead&apos;e takip tarihi verdiğinizde burada listelenir.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ListSearchInput value={query} onChange={setQuery} resultCount={filtered.length} total={leads.length} />
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.06]">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-medium uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-medium">Müşteri</th>
            <th className="px-4 py-3 font-medium">Takip Tarihi</th>
            <th className="px-4 py-3 font-medium">Durum</th>
            <th className="px-4 py-3 font-medium">Son Görüşme</th>
            <th className="px-4 py-3 font-medium">Teklif</th>
            <th className="px-4 py-3 font-medium">Görüşen Kişi</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {visibleLeads.map((lead, index) => {
            const followupLabel = formatRelativeDays(lead.next_followup_at);
            const followupOverdue = Boolean(followupLabel?.includes("gecikti"));
            const followupToday = followupLabel === "Bugün";
            const lastContactLabel = formatRelativeTimeAgo(lead.last_contact_at);
            const overdueInput = {
              status: lead.status,
              lastContactAt: lead.last_contact_at,
              createdAt: lead.created_at,
              nextFollowupAt: lead.next_followup_at,
              lastActivityAt: lead.last_activity_at,
            };
            const showOverdue = isLeadOverdue(overdueInput);
            const showNew = isLeadNew(overdueInput);

            return (
              <tr
                key={lead.id}
                className={`group animate-slide-up transition-all duration-150 ease-snappy hover:bg-white/[0.05] hover:shadow-[inset_2px_0_0_0_var(--color-accent-500)] ${
                  followupToday ? "bg-accent-500/[0.07] shadow-[inset_2px_0_0_0_var(--color-accent-500)]" : ""
                }`}
                style={{ animationDelay: `${Math.min(index, 12) * 6}ms` }}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {showOverdue ? <OverdueBadge /> : null}
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-white transition-colors group-hover:text-accent-300"
                    >
                      {leadDisplayName(lead)}
                    </Link>
                    {showNew ? <NewLeadBadge /> : null}
                  </div>
                  <p className="mt-0.5 text-xs text-white/45">{lead.phone}</p>
                </td>
                <td className={`px-4 py-3.5 font-medium ${followupOverdue ? "text-[#ffb4a3]" : "text-white"}`}>
                  {followupToday ? <TodayCallBadge /> : (followupLabel ?? "—")}
                  {lead.next_followup_note ? (
                    <p className="mt-0.5 text-xs font-normal text-white/50">{lead.next_followup_note}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3.5 text-white/70">{lastContactLabel ?? "Hiç görüşülmedi"}</td>
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

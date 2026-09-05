import { OverdueBadge, TodayCallBadge } from "@/components/leads/lead-indicators";
import { ProspectStatusBadge } from "@/components/ui/badge";
import { formatRelativeDays, formatRelativeTimeAgo, isLeadOverdue } from "@/lib/utils";
import type { AgencyProspect } from "@/lib/types/domain";

/** "Takipte" ekrani: takvime eklenen her aday buraya, tek listede toplanir. */
export function ProspectFollowupTable({ prospects }: { prospects: AgencyProspect[] }) {
  if (prospects.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center">
        <p className="text-sm font-medium text-white">Takipte bekleyen aday yok</p>
        <p className="text-sm text-white/50">Bir adaya takip tarihi verdiğinizde burada listelenir.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-medium uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-medium">Firma</th>
            <th className="px-4 py-3 font-medium">Takip</th>
            <th className="px-4 py-3 font-medium">Durum</th>
            <th className="px-4 py-3 font-medium">Son Görüşme</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {prospects.map((p, index) => {
            const followupLabel = formatRelativeDays(p.next_followup_at);
            const followupOverdue = Boolean(followupLabel?.includes("gecikti"));
            const followupToday = followupLabel === "Bugün";
            const lastContactLabel = formatRelativeTimeAgo(p.last_contact_at);
            const showOverdue = isLeadOverdue({
              status: p.status,
              lastContactAt: p.last_contact_at,
              createdAt: p.created_at,
              nextFollowupAt: p.next_followup_at,
            });

            return (
              <tr
                key={p.id}
                className={`group animate-slide-up transition-all duration-150 ease-snappy hover:bg-white/[0.05] hover:shadow-[inset_2px_0_0_0_var(--color-accent-500)] ${
                  followupToday ? "bg-accent-500/[0.07] shadow-[inset_2px_0_0_0_var(--color-accent-500)]" : ""
                }`}
                style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {showOverdue ? <OverdueBadge /> : null}
                    <span className="font-medium text-white">{p.company_name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-white/45">{[p.contact_name, p.phone].filter(Boolean).join(" · ") || "—"}</p>
                </td>
                <td className={`px-4 py-3.5 font-medium ${followupOverdue ? "text-[#ffb4a3]" : "text-white"}`}>
                  {followupToday ? <TodayCallBadge /> : (followupLabel ?? "—")}
                  {p.next_followup_note ? <p className="mt-0.5 text-xs font-normal text-white/50">{p.next_followup_note}</p> : null}
                </td>
                <td className="px-4 py-3.5">
                  <ProspectStatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3.5 text-white/70">{lastContactLabel ?? "Hiç görüşülmedi"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

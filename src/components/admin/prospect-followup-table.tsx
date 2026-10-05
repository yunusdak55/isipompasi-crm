import { IntentLink as Link } from "@/components/ui/intent-link";
import { OverdueBadge, TodayCallBadge } from "@/components/leads/lead-indicators";
import { ProspectStatusBadge } from "@/components/ui/badge";
import { formatDateTime, formatRelativeDays, formatRelativeTimeAgo, isProspectOverdue } from "@/lib/utils";
import type { ProspectLastNote } from "@/lib/data/prospects";
import type { AgencyProspect } from "@/lib/types/domain";

/**
 * "Takipte" ve "Gecikenler" ekranlari: takip tarihi olan adaylar tek listede.
 * Her adayin EN SON notu + tarihi yaninda gorunur (spec: "şu tarihte şunu
 * demiş" bir bakista okunabilsin).
 */
export function ProspectFollowupTable({
  prospects,
  lastNotes = {},
  emptyTitle = "Takipte bekleyen aday yok",
  emptyBody = "Bir adaya takip tarihi verdiğinizde burada listelenir.",
}: {
  prospects: AgencyProspect[];
  lastNotes?: Record<string, ProspectLastNote>;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  if (prospects.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center">
        <p className="text-sm font-medium text-white">{emptyTitle}</p>
        <p className="text-sm text-white/50">{emptyBody}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.06]">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-medium uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-medium">Firma</th>
            <th className="px-4 py-3 font-medium">Takip</th>
            <th className="px-4 py-3 font-medium">Durum</th>
            <th className="px-4 py-3 font-medium">Son Not</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {prospects.map((p, index) => {
            const followupLabel = formatRelativeDays(p.next_followup_at);
            const followupOverdue = Boolean(followupLabel?.includes("gecikti"));
            const followupToday = followupLabel === "Bugün";
            const lastContactLabel = formatRelativeTimeAgo(p.last_contact_at);
            const lastNote = lastNotes[p.id];
            const showOverdue = isProspectOverdue({
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
                style={{ animationDelay: `${Math.min(index, 12) * 6}ms` }}
              >
                <td className="px-4 py-3.5">
                  <Link href={`/admin/prospects/${p.id}`} className="group/link inline-block">
                    <div className="flex items-center gap-1.5">
                      {showOverdue ? <OverdueBadge /> : null}
                      <span className="font-medium text-white group-hover/link:text-accent-300">{p.company_name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-white/45">{[p.contact_name, p.phone].filter(Boolean).join(" · ") || "—"}</p>
                  </Link>
                </td>
                <td className={`px-4 py-3.5 font-medium ${followupOverdue ? "text-[#ffb4a3]" : "text-white"}`}>
                  {followupToday ? <TodayCallBadge /> : <span>{followupLabel ?? "—"}</span>}
                  {p.next_followup_note ? <p className="mt-0.5 text-xs font-normal text-white/50">{p.next_followup_note}</p> : null}
                </td>
                <td className="px-4 py-3.5">
                  <ProspectStatusBadge status={p.status} />
                </td>
                <td className="max-w-[300px] px-4 py-3.5 align-top">
                  {lastNote ? (
                    <>
                      <p className="line-clamp-2 text-white/80">{lastNote.description}</p>
                      <p className="mt-0.5 text-xs text-white/45">{formatDateTime(lastNote.created_at)}</p>
                    </>
                  ) : (
                    <span className="text-white/50">{lastContactLabel ?? "Hiç görüşülmedi"}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

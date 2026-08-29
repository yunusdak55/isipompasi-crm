import Link from "next/link";
import { Phone } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { NewLeadBadge, OverdueBadge, ContactedBadge } from "@/components/leads/lead-indicators";
import { PROPERTY_TYPE_LABELS } from "@/lib/constants/lead";
import { formatCurrency, formatRelativeDays, isLeadNew, isLeadOverdue } from "@/lib/utils";
import type { LeadListItem } from "@/lib/data/leads";
import type { PropertyType } from "@/lib/types/domain";

function propertyTypeLabel(value: string | null) {
  if (!value) return null;
  return PROPERTY_TYPE_LABELS[value as PropertyType] ?? value;
}

/** Koyu lacivert panel icinde "cam" yuzeyli tablo (marka revizyonu: Leadler artik dark panel). */
export function LeadTable({ leads }: { leads: LeadListItem[] }) {
  if (leads.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center">
        <p className="text-sm font-medium text-white">Henüz lead yok</p>
        <p className="text-sm text-white/50">Filtrelerinize uyan veya sisteme eklenmiş bir lead bulunamadı.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-medium uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-medium">Müşteri</th>
            <th className="px-4 py-3 font-medium">Konum</th>
            <th className="px-4 py-3 font-medium">Konut / m²</th>
            <th className="px-4 py-3 font-medium">Teklif</th>
            <th className="px-4 py-3 font-medium">Atanan</th>
            <th className="px-4 py-3 font-medium">Durum</th>
            <th className="px-4 py-3 font-medium">Takip</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {leads.map((lead, index) => {
            const followupLabel = formatRelativeDays(lead.next_followup_at);
            const followupOverdue = Boolean(followupLabel?.includes("gecikti"));
            const showNew = isLeadNew(lead.status);
            const showOverdue = isLeadOverdue({
              status: lead.status,
              lastContactAt: lead.last_contact_at,
              createdAt: lead.created_at,
              nextFollowupAt: lead.next_followup_at,
            });

            return (
              <tr
                key={lead.id}
                className="group animate-slide-up transition-all duration-150 ease-snappy hover:bg-white/[0.05] hover:shadow-[inset_2px_0_0_0_var(--color-accent-500)]"
                style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    {showOverdue ? <OverdueBadge /> : null}
                    <Link
                      href={`/leads/${lead.id}`}
                      className={`font-medium text-white transition-colors group-hover:text-accent-300 ${
                        lead.status === "lost" ? "lost-name" : ""
                      }`}
                    >
                      {lead.first_name} {lead.last_name ?? ""}
                    </Link>
                    {showNew ? <NewLeadBadge /> : null}
                    {lead.last_contact_at ? <ContactedBadge /> : null}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-white/60">
                    <Phone className="h-3 w-3 shrink-0 text-white/40" strokeWidth={2} />
                    {lead.phone}
                  </p>
                </td>
                <td className="px-4 py-3.5 text-white/70">{lead.city ?? "—"}</td>
                <td className="px-4 py-3.5 text-white/70">
                  {propertyTypeLabel(lead.property_type) ?? "—"}
                  {lead.area_m2 ? ` · ${lead.area_m2} m²` : ""}
                </td>
                <td className="px-4 py-3.5 tabular-nums text-white/70">{formatCurrency(lead.offered_amount)}</td>
                <td className="px-4 py-3.5 text-white/70">{lead.assigned_profile?.full_name ?? "Atanmadı"}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={lead.status} />
                </td>
                <td className={`px-4 py-3.5 ${followupOverdue ? "font-medium text-[#ffb4a3]" : "text-white/70"}`}>
                  {followupLabel ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

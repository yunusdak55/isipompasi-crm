import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { OverdueBadge } from "@/components/leads/lead-indicators";
import { formatCurrency, formatRelativeTimeAgo } from "@/lib/utils";
import type { LeadListItem } from "@/lib/data/leads";

/** "Gecikenler" ekrani (spec md.5): 48 saattir gorusulmemis, hala acik leadler. */
export function OverdueTable({ leads }: { leads: LeadListItem[] }) {
  if (leads.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center">
        <p className="text-sm font-medium text-white">Gecikmiş lead yok</p>
        <p className="text-sm text-white/50">Tüm aktif leadlerle son 48 saat içinde ilgilenilmiş.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-medium uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-medium">Müşteri</th>
            <th className="px-4 py-3 font-medium">Son Görüşme</th>
            <th className="px-4 py-3 font-medium">Durum</th>
            <th className="px-4 py-3 font-medium">Teklif</th>
            <th className="px-4 py-3 font-medium">Sorumlu</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {leads.map((lead, index) => {
            const lastContactLabel = formatRelativeTimeAgo(lead.last_contact_at ?? lead.created_at);

            return (
              <tr
                key={lead.id}
                className="group animate-slide-up transition-all duration-150 ease-snappy hover:bg-white/[0.05] hover:shadow-[inset_2px_0_0_0_#ff6a52]"
                style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
              >
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-1.5">
                    <OverdueBadge />
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-white transition-colors group-hover:text-accent-300"
                    >
                      {lead.first_name} {lead.last_name ?? ""}
                    </Link>
                  </div>
                  <p className="mt-0.5 text-xs text-white/45">{lead.phone}</p>
                </td>
                <td className="px-4 py-3.5 font-medium text-[#ffb4a3]">{lastContactLabel}</td>
                <td className="px-4 py-3.5">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-3.5 tabular-nums text-white/70">{formatCurrency(lead.offered_amount)}</td>
                <td className="px-4 py-3.5 text-white/70">{lead.assigned_profile?.full_name ?? "Atanmadı"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

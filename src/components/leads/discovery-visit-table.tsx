import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { formatDate, leadDisplayName } from "@/lib/utils";
import type { DiscoveryVisitListItem } from "@/lib/data/discovery-visits";

/** "Keşifler" ekrani: ay icindeki kesif ziyaretlerinin gunlugu (spec). */
export function DiscoveryVisitTable({ visits }: { visits: DiscoveryVisitListItem[] }) {
  if (visits.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center">
        <p className="text-sm font-medium text-white">Bu ay kayıtlı keşif yok</p>
        <p className="text-sm text-white/50">Keşif Ekle ile ilk ziyareti kaydedin.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-medium uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-medium">Müşteri</th>
            <th className="px-4 py-3 font-medium">Tarih</th>
            <th className="px-4 py-3 font-medium">Nerede</th>
            <th className="px-4 py-3 font-medium">Nasıl Geçti</th>
            <th className="px-4 py-3 font-medium">Kaydeden</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.06]">
          {visits.map((visit, index) => (
            <tr
              key={visit.id}
              className="group animate-slide-up transition-all duration-150 ease-snappy hover:bg-white/[0.05] hover:shadow-[inset_2px_0_0_0_var(--color-accent-500)]"
              style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
            >
              <td className="px-4 py-3.5">
                {visit.lead ? (
                  <>
                    <Link
                      href={`/leads/${visit.lead.id}`}
                      className="font-medium text-white transition-colors group-hover:text-accent-300"
                    >
                      {leadDisplayName(visit.lead)}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-white/60">
                      <Phone className="h-3 w-3 shrink-0 text-white/40" strokeWidth={2} />
                      {visit.lead.phone}
                    </p>
                  </>
                ) : (
                  <span className="text-white/40">Lead silinmiş</span>
                )}
              </td>
              <td className="px-4 py-3.5 font-medium text-white">{formatDate(visit.visit_date)}</td>
              <td className="px-4 py-3.5 text-white/70">
                {visit.location ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0 text-white/40" />
                    {visit.location}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="max-w-xs px-4 py-3.5 text-white/70">{visit.outcome_note ?? "—"}</td>
              <td className="px-4 py-3.5 text-white/55">{visit.created_by_profile?.full_name ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

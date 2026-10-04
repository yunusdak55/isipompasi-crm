import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { leadDisplayName } from "@/lib/utils";
import type { UndatedFollowupLead } from "@/lib/data/leads";

/**
 * "Takip" aşamasında ama takip tarihi olmayan leadler için uyarı. Bu kayıtlar
 * tarihe göre çalışan Takipte listesinde görünmez; sessizce unutulmasınlar diye
 * burada adlarıyla gösterilir (tıklayınca lead açılır, Görüşme Sonucu'ndan tarih verilir).
 */
export function UndatedFollowupNotice({ count, leads }: { count: number; leads: UndatedFollowupLead[] }) {
  if (count === 0) return null;

  return (
    <div role="note" className="animate-fade-in flex items-start gap-3 rounded-xl border border-warning-500/40 bg-warning-500/[0.10] px-4 py-3.5">
      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning-500" />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-white">
          {count.toLocaleString("tr-TR")} lead “Takip” aşamasında ama takip tarihi yok
        </p>
        <p className="mt-0.5 text-xs text-white/60">
          Bu müşteriler aşağıdaki listede görünmez. Lead&apos;i açıp “Görüşme Sonucu”ndan kaç gün sonra takip edileceğini girin.
        </p>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/leads/${lead.id}`}
                className="inline-flex items-center rounded-full border border-warning-500/30 bg-warning-500/10 px-2.5 py-1 text-xs font-medium text-white transition-colors duration-150 hover:border-warning-500/60 hover:bg-warning-500/20"
              >
                {leadDisplayName(lead)}
                <span className="ml-1.5 text-white/45">{lead.phone}</span>
              </Link>
            </li>
          ))}
          {count > leads.length ? (
            <li className="inline-flex items-center px-1 text-xs text-white/50">+ {(count - leads.length).toLocaleString("tr-TR")} kişi daha</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AnimatedStatValue } from "@/components/ui/animated-number";
import { DonutRing } from "@/components/charts/donut-ring";
import { LEAD_STATUS_CHART_COLOR, LEAD_STATUS_LABELS } from "@/lib/constants/lead";
import { cn, formatCurrency } from "@/lib/utils";
import type { DashboardToday } from "@/lib/data/dashboard";
import type { LeadStatus } from "@/lib/types/domain";

/**
 * Satis hatti iki gruba ayrilir; TOPLAM = ACIK + SONUCLANAN her zaman tutar:
 *  - Acik aşamalar: hala is yapilan leadler (Lead, Keşif/Teklif, Takip)
 *  - Sonuçlanan: kapanmis leadler (Satış, Kayıp)
 * "Lead" bir ASAMA ADIDIR (Kanban'daki ilk sutun); tum kayitlar degil. Halka
 * ortasindaki toplam bu 5 asamanin toplamidir.
 */
const GROUPS: { title: string; hint: string; stages: LeadStatus[] }[] = [
  { title: "Açık aşamalar", hint: "hâlâ üzerinde çalışılan", stages: ["new", "discovery_offer", "followup"] },
  { title: "Sonuçlanan", hint: "satışa dönen ya da kaybedilen", stages: ["won", "lost"] },
];

const fmt = (n: number) => n.toLocaleString("tr-TR");

/**
 * Satis hatti: durum dagilimi halkasi (ortada toplam lead) + gruplu, tiklanabilir
 * aciklama listesi + bu ayin satisi ve potansiyel satis degeri. Her satir
 * ilgili durumla filtrelenmis Leadler sayfasina gider. "%" = o asamadaki lead /
 * TOPLAM lead (sutun basliginda "Pay" olarak yazar, satirin ipucunda cumleyle).
 */
export function PipelineCard({ today, className }: { today: DashboardToday; className?: string }) {
  const { stats, month } = today;
  const countOf = (status: LeadStatus) => stats.byStatus.find((s) => s.status === status)?.count ?? 0;
  const total = GROUPS.reduce((sum, g) => sum + g.stages.reduce((a, st) => a + countOf(st), 0), 0);
  const pctOf = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  // Halka dilimleri legend ile AYNI sirada (acik -> sonuclanan).
  const segments = GROUPS.flatMap((g) => g.stages).map((status) => ({
    key: status,
    value: countOf(status),
    color: LEAD_STATUS_CHART_COLOR[status],
  }));

  return (
    <Card className={cn("overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line bg-gradient-to-r from-[#5b86c4]/[0.10] to-transparent px-4 py-3.5 sm:px-5">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5b86c4]/20 text-[#b9d3f5] shadow-[0_0_20px_-4px_rgba(91,134,196,0.6)] ring-1 ring-inset ring-[#5b86c4]/30">
            <Target className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink-900">Satış Hattı</h2>
            <p className="mt-0.5 text-[11px] text-ink-400">Tüm leadlerin aşamalara göre dağılımı</p>
          </div>
        </div>
        <Link
          href="/leads"
          className="group/more inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-white"
        >
          Leadler
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover/more:translate-x-0.5" />
        </Link>
      </div>

      <div className="flex flex-col items-center gap-5 px-4 py-5 sm:flex-row sm:px-5">
        <DonutRing segments={segments} size={140} stroke={14} glow ariaLabel={`Toplam ${total} lead`}>
          <p className="text-[1.7rem] font-semibold tabular-nums leading-none tracking-tight text-white">
            <AnimatedStatValue value={fmt(total)} />
          </p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">tüm leadler</p>
        </DonutRing>

        <div className="w-full min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-white/35">
            <span className="flex-1">Aşama</span>
            <span className="w-8 text-right">Pay</span>
            <span className="w-10 text-right">Lead</span>
          </div>

          {GROUPS.map((group) => {
            const subtotal = group.stages.reduce((sum, st) => sum + countOf(st), 0);
            return (
              <div key={group.title} className="mb-1.5 last:mb-0">
                <div
                  className="flex items-center gap-2.5 rounded-md bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/70"
                  title={`${group.title}: ${group.hint} — ${fmt(subtotal)} lead, toplamın %${pctOf(subtotal)}'i`}
                >
                  <span className="flex-1">{group.title}</span>
                  <span className="w-8 text-right tabular-nums text-white/45">%{pctOf(subtotal)}</span>
                  <span className="w-10 text-right tabular-nums text-white">{fmt(subtotal)}</span>
                </div>
                <ul className="mt-0.5">
                  {group.stages.map((status) => {
                    const count = countOf(status);
                    return (
                      <li key={status}>
                        <Link
                          href={`/leads?status=${status}`}
                          title={`${LEAD_STATUS_LABELS[status]} aşamasında ${fmt(count)} lead var — toplam ${fmt(total)} lead'in %${pctOf(count)}'i`}
                          className="group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 transition-colors duration-150 hover:bg-white/[0.06]"
                        >
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: LEAD_STATUS_CHART_COLOR[status], boxShadow: `0 0 8px ${LEAD_STATUS_CHART_COLOR[status]}88` }}
                          />
                          <span className="flex-1 whitespace-nowrap text-xs font-medium text-ink-600 transition-colors group-hover:text-white">
                            {LEAD_STATUS_LABELS[status]}
                          </span>
                          <span className="w-8 text-right text-[11px] tabular-nums text-ink-400">%{pctOf(count)}</span>
                          <span className="w-10 text-right text-sm font-semibold tabular-nums text-ink-900">{fmt(count)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-line border-t border-line bg-white/[0.02]">
        <div className="px-4 py-4 sm:px-5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-400">
            <TrendingUp className="h-3.5 w-3.5 text-[#9af0c3]" />
            Bu Ay Satış
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-[#9af0c3]">
            <AnimatedStatValue value={formatCurrency(month.revenue)} />
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">{month.salesCount > 0 ? `${fmt(month.salesCount)} satış kapandı` : "henüz satış yok"}</p>
        </div>
        <div className="px-4 py-4 sm:px-5">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink-400">
            <Target className="h-3.5 w-3.5 text-accent-300" />
            Potansiyel Satış
          </p>
          <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight text-accent-300">
            <AnimatedStatValue value={formatCurrency(stats.pipelineValue)} />
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">açık aşamalardaki tekliflerin toplamı</p>
        </div>
      </div>
    </Card>
  );
}

import { LEAD_STATUS_CHART_COLOR, LEAD_STATUS_FLOW_ORDER, LEAD_STATUS_LABELS } from "@/lib/constants/lead";
import type { LeadStatus } from "@/lib/types/domain";

/**
 * "Lead hunisi" - asama bazli yatay cubuklar. Renkler halka grafikle (Dashboard / Aylik
 * Karsilastirma) AYNI: bir asamayi her ekranda ayni renkten taniyin. Cubuk uzunlugu en kalabalik
 * asamaya, yuzde ise TOPLAMA gore (satir sonunda). Acilista soldan saga bir kez dolar.
 */
export function StatusBars({ funnel }: { funnel: { status: LeadStatus; count: number }[] }) {
  const countOf = (status: LeadStatus) => funnel.find((f) => f.status === status)?.count ?? 0;
  const max = Math.max(1, ...LEAD_STATUS_FLOW_ORDER.map(countOf));
  const total = LEAD_STATUS_FLOW_ORDER.reduce((sum, st) => sum + countOf(st), 0);

  return (
    <div className="flex flex-col gap-3">
      {LEAD_STATUS_FLOW_ORDER.map((status, index) => {
        const count = countOf(status);
        const color = LEAD_STATUS_CHART_COLOR[status];
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={status} className="animate-slide-up flex items-center gap-3" style={{ animationDelay: `${index * 50}ms` }}>
            <span className="flex w-28 shrink-0 items-center gap-2 text-xs font-medium text-ink-600">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}99` }} />
              {LEAD_STATUS_LABELS[status]}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="grow-x h-full rounded-full"
                style={{
                  width: `${count === 0 ? 0 : Math.max(2, (count / max) * 100)}%`,
                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                  boxShadow: `0 0 14px -2px ${color}80`,
                  animationDelay: `${index * 60 + 100}ms`,
                }}
              />
            </div>
            <span className="w-24 shrink-0 text-right text-xs tabular-nums text-ink-400">
              <span className="font-semibold text-ink-900">{count.toLocaleString("tr-TR")}</span> · %{pct < 1 && pct > 0 ? "<1" : pct.toFixed(0)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

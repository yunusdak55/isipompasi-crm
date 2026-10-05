import { formatCurrency, getInitials } from "@/lib/utils";

type SalespersonPoint = { name: string; count: number; revenue: number };

// Ilk uc sira: altin / gumus / bronz madalya zemini (emoji yerine - her cihazda ayni gorunur).
const RANK_STYLE: Record<number, { bg: string; text: string }> = {
  0: { bg: "linear-gradient(135deg, #ffe08a, #e8a317)", text: "#4a3200" },
  1: { bg: "linear-gradient(135deg, #eef2f7, #aab6c8)", text: "#2a3547" },
  2: { bg: "linear-gradient(135deg, #f4c9a0, #c0773a)", text: "#4a2608" },
};

/**
 * "Satış Personeli Performansı" - yatay siralanmis cubuklar. TASARIM YUKSELTMESI:
 * birinci sira parlayan ISI turuncusu, digerleri BUZ mavisi (tek olcum = ayni tur
 * cubuk; vurgu yalnizca lidere); sira rozeti madalya renklerinde. Saf CSS hover,
 * sunucuda uretilir (istemci durumu yok); cubuklar soldan TRANSFORM ile dolar.
 */
export function SalespersonPerformanceChart({ data }: { data: SalespersonPoint[] }) {
  const maxRevenue = Math.max(1, ...data.map((s) => s.revenue));
  const totalRevenue = data.reduce((sum, s) => sum + s.revenue, 0);

  return (
    <div className="flex flex-col gap-4">
      {data.map((sp, index) => {
        const widthPct = Math.max(4, (sp.revenue / maxRevenue) * 100);
        const share = totalRevenue > 0 ? (sp.revenue / totalRevenue) * 100 : 0;
        const rank = RANK_STYLE[index];

        return (
          <div
            key={sp.name}
            className="group animate-slide-up flex flex-col gap-2"
            style={{ animationDelay: `${Math.min(index, 12) * 10}ms` }}
          >
            <div className="flex items-center gap-2.5">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm transition-transform duration-150 group-hover:scale-110"
                style={
                  rank
                    ? { background: rank.bg, color: rank.text }
                    : { background: "var(--color-ink-100)", color: "var(--color-ink-600)" }
                }
              >
                {rank ? index + 1 : getInitials(sp.name)}
              </span>
              <p className="truncate text-sm font-medium text-ink-900">{sp.name}</p>
              <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-ink-900">{formatCurrency(sp.revenue)}</span>
            </div>

            <div className="flex items-center gap-2 pl-[38px]">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={
                    "grow-x h-full rounded-full transition-[filter] duration-150 group-hover:brightness-110 " +
                    (index === 0
                      ? "bg-gradient-to-r from-accent-600 via-accent-500 to-flame-hot shadow-[0_0_16px_-2px_rgba(244,124,32,0.7)]"
                      : "bg-gradient-to-r from-ice-600 to-ice-300")
                  }
                  style={{ width: `${widthPct}%`, animationDelay: `${Math.min(index, 12) * 10 + 40}ms` }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-[11px] tabular-nums text-ink-400">
                {sp.count} satış · %{share.toFixed(0)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

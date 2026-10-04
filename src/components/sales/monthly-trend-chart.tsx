import { formatCurrency } from "@/lib/utils";

type TrendPoint = { key: string; label: string; count: number; revenue: number };

/** Y ekseni icin "temiz" (yuvarlak) bir tavan deger bulur - 0/1.000/2.000 gibi. */
function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = 10 ** exponent;
  const normalized = value / magnitude;
  const step = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return step * magnitude;
}

function formatAxisTick(value: number): string {
  if (value === 0) return "₺0";
  if (value >= 1_000_000) return `₺${(value / 1_000_000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} Mn`;
  if (value >= 1_000) return `₺${Math.round(value / 1000)} Bin`;
  return formatCurrency(value);
}

/**
 * "Aylik Satis Trendi" - gridline + eksen etiketli bar grafik. TASARIM YUKSELTMESI:
 *  - Gecmis aylar BUZ mavisi, icinde bulunulan ay (son sutun) parlayan ISI turuncusu:
 *    "gecmis soguk, simdi sicak" - hangi ayin gundemde oldugu renkle okunur.
 *  - Satis olmayan aylar bos birakilmaz, ince bir taban cizgisi (pill) gosterilir.
 *  - Tooltip SAF CSS (group-hover / odak): grafik artik sunucuda uretilir, tarayiciya
 *    JS/durum yuku binmez. Barlar tabandan TRANSFORM ile buyur (kompozitor, tek seferlik).
 */
export function MonthlyTrendChart({ data }: { data: TrendPoint[] }) {
  const maxRevenue = niceCeiling(Math.max(1, ...data.map((m) => m.revenue)));
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const lastIndex = data.length - 1;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-4 text-[11px] text-ink-400">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-ice-400" />
          Geçmiş aylar
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-accent-500 shadow-[0_0_8px_rgba(244,124,32,0.8)]" />
          Bu ay
        </span>
      </div>

      <div className="relative mt-2 flex h-56 gap-2 pl-12 sm:gap-3">
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0" aria-hidden="true">
          {gridSteps.map((step) => (
            <div key={step} className="absolute left-0 right-0 flex items-center" style={{ bottom: `${step * 100}%` }}>
              <span className="w-11 shrink-0 pr-2 text-right text-[10px] tabular-nums text-ink-400">
                {formatAxisTick(Math.round(maxRevenue * step))}
              </span>
              <span className={step === 0 ? "h-px flex-1 bg-white/20" : "h-px flex-1 border-t border-dashed border-white/[0.08]"} />
            </div>
          ))}
        </div>

        {data.map((m, index) => {
          const heightPct = m.revenue > 0 ? Math.max(3, (m.revenue / maxRevenue) * 100) : 0;
          const isCurrent = index === lastIndex;

          return (
            <div key={m.key} className="group relative z-10 flex flex-1 flex-col items-center gap-2 outline-none" tabIndex={0}>
              <div className="flex w-full flex-1 items-end">
                <div className="relative flex h-full w-full flex-col items-center justify-end">
                  {m.revenue > 0 ? (
                    <>
                      <span
                        className={
                          "mb-1.5 text-[11px] font-semibold tabular-nums transition-transform duration-200 ease-premium group-hover:-translate-y-0.5 " +
                          (isCurrent ? "text-accent-300" : "text-ink-600")
                        }
                      >
                        {formatCurrency(m.revenue)}
                      </span>
                      <div
                        className={
                          "grow-y w-full max-w-[64px] rounded-t-xl rounded-b-[4px] transition-[filter,transform] duration-200 ease-premium group-hover:scale-x-[1.04] group-hover:brightness-110 " +
                          (isCurrent
                            ? "bg-gradient-to-t from-accent-600 via-accent-500 to-flame-hot shadow-[0_0_28px_-4px_rgba(244,124,32,0.65)]"
                            : "bg-gradient-to-t from-ice-600 via-ice-500 to-ice-300 shadow-[0_0_22px_-6px_rgba(91,188,248,0.5)]")
                        }
                        style={{ height: `${heightPct}%`, animationDelay: `${index * 70}ms` }}
                      />
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute left-1/2 z-20 w-max -translate-x-1/2 translate-y-1 rounded-lg border border-line bg-brand-950 px-3 py-2 text-left opacity-0 shadow-elevated-lg transition-[opacity,transform] duration-150 ease-premium group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                        style={{ bottom: `calc(${heightPct}% + 30px)` }}
                      >
                        <p className="text-xs font-semibold text-white">{m.label}</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums text-accent-300">{formatCurrency(m.revenue)}</p>
                        <p className="text-[11px] text-white/55">{m.count} satış</p>
                      </div>
                    </>
                  ) : (
                    <div className="mb-px h-1 w-7 rounded-full bg-white/[0.12]" />
                  )}
                </div>
              </div>
              <span className={"text-xs font-medium " + (isCurrent ? "text-accent-300" : "text-ink-600")}>{m.label}</span>
            </div>
          );
        })}
      </div>

      <p className="sr-only">
        {data.map((m) => `${m.label}: ${formatCurrency(m.revenue)}, ${m.count} satış`).join(". ")}
      </p>
    </div>
  );
}

import { cn } from "@/lib/utils";
import type { WeekDay } from "@/components/dashboard/view-model";

const BAR_AREA = 104; // px - en yuksek cubugun yuksekligi

/**
 * "Onumuzdeki 7 gun" takip yogunlugu: bugunden baslayarak her gun kac takip
 * var. Bugun turuncu (parlayan), diger gunler cam beyazi; bos gunler ince bir
 * cizgi. Saf SVG/CSS, sunucuda uretilir - cubuklar tabandan bir kez buyur.
 */
export function WeekChart({ days }: { days: WeekDay[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const peak = days.reduce((best, d) => (d.count > best.count ? d : best), days[0]);

  return (
    <div className="relative flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Önümüzdeki 7 gün</p>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="text-2xl font-semibold tabular-nums leading-none tracking-tight text-white">{total}</span>
            <span className="text-xs text-white/50">planlı takip</span>
          </p>
        </div>
        {peak.count > 0 ? (
          <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-medium text-white/60 ring-1 ring-inset ring-white/10">
            En yoğun: <span className="text-white/85">{peak.isToday ? "bugün" : peak.label === "Yarın" ? "yarın" : peak.weekdayLong}</span>
          </span>
        ) : null}
      </div>

      <div className="relative mt-5" style={{ height: BAR_AREA + 24 }}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-between" style={{ height: BAR_AREA + 24 }} aria-hidden="true">
          <span className="border-t border-dashed border-white/[0.07]" />
          <span className="border-t border-dashed border-white/[0.07]" />
          <span className="border-t border-dashed border-white/[0.07]" />
          <span className="border-t border-white/[0.14]" />
        </div>

        <ul className="relative flex h-full items-end gap-2 sm:gap-3">
          {days.map((d, i) => {
            const barPx = d.count === 0 ? 3 : Math.max(16, Math.round((d.count / max) * BAR_AREA));
            return (
              <li
                key={i}
                className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5"
                title={`${d.full}: ${d.count} takip${d.carry > 0 ? ` (${d.carry} tanesi dünden kaldı)` : ""}`}
                aria-label={`${d.full}: ${d.count} takip${d.carry > 0 ? ` (${d.carry} tanesi dünden kaldı)` : ""}`}
              >
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums transition-transform duration-200 ease-premium group-hover:-translate-y-0.5",
                    d.isToday ? "text-accent-300" : d.count === 0 ? "text-white/25" : "text-white/80"
                  )}
                >
                  {d.count}
                </span>
                <span
                  className={cn(
                    "grow-y w-full max-w-[38px] transition-[filter] duration-200 group-hover:brightness-125",
                    d.count === 0
                      ? "rounded-full bg-white/[0.12]"
                      : d.isToday
                        ? "rounded-t-xl rounded-b-[5px] bg-gradient-to-t from-accent-600 via-accent-500 to-accent-300 shadow-[0_0_26px_-2px_rgba(244,124,32,0.6)]"
                        : d.weekend
                          ? "rounded-t-xl rounded-b-[5px] bg-gradient-to-t from-ice-600/30 to-ice-400/40"
                          : "rounded-t-xl rounded-b-[5px] bg-gradient-to-t from-ice-600/70 via-ice-500/70 to-ice-300/90 shadow-[0_0_20px_-6px_rgba(91,188,248,0.45)]"
                  )}
                  style={{ height: barPx, animationDelay: `${i * 55}ms` }}
                />
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="mt-2.5 flex gap-2 sm:gap-3" aria-hidden="true">
        {days.map((d, i) => (
          <li key={i} className="flex flex-1 flex-col items-center gap-0.5">
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-semibold leading-tight",
                d.isToday
                  ? "bg-accent-500/20 text-accent-300 ring-1 ring-inset ring-accent-500/30"
                  : d.weekend
                    ? "text-white/35"
                    : "text-white/60"
              )}
            >
              {d.label}
            </span>
            <span className={cn("text-[10px] tabular-nums", d.isToday ? "text-accent-300/70" : "text-white/30")}>{d.dayNumber}</span>
          </li>
        ))}
      </ul>

      {days[0]?.carry > 0 ? (
        <p className="mt-3 text-[11px] leading-snug text-white/40">
          Bugün sütunu, dünden kalan <span className="text-white/65">{days[0].carry}</span> takibi de içerir.
        </p>
      ) : null}
    </div>
  );
}

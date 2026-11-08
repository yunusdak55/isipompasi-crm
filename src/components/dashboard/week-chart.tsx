import { RiseNumber } from "@/components/ui/rise-number";
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

  return (
    <div className="rise relative flex flex-col rounded-2xl border border-[var(--card-line)] bg-[var(--card-bg-2)] p-4 shadow-[inset_0_1px_0_rgba(214,232,255,0.06)] sm:p-5" style={{ "--i": 3 } as React.CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="ik-eyebrow">Önümüzdeki 7 gün</p>
          <p className="mt-1.5 flex items-baseline gap-1.5">
            <span className="font-display text-2xl font-semibold tabular-nums leading-none tracking-[-0.03em] text-[var(--text)]">
              <RiseNumber value={total} delayMs={420} />
            </span>
            <span className="text-xs text-[var(--text-3)]">planlı takip</span>
          </p>
        </div>
      </div>

      <div className="relative mt-5" style={{ height: BAR_AREA + 24 }}>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col justify-between" style={{ height: BAR_AREA + 24 }} aria-hidden="true">
          <span className="border-t border-dashed border-[var(--line-soft)]" />
          <span className="border-t border-dashed border-[var(--line-soft)]" />
          <span className="border-t border-dashed border-[var(--line-soft)]" />
          <span className="border-t border-[var(--line-strong)]" />
        </div>

        <ul className="relative flex h-full items-end gap-2 sm:gap-3">
          {days.map((d, i) => {
            const barPx = d.count === 0 ? 3 : Math.max(16, Math.round((d.count / max) * BAR_AREA));
            return (
              <li
                key={i}
                className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                title={`${d.full}: ${d.count} takip${d.carry > 0 ? ` (${d.carry} tanesi dünden kaldı)` : ""}`}
                aria-label={`${d.full}: ${d.count} takip${d.carry > 0 ? ` (${d.carry} tanesi dünden kaldı)` : ""}`}
              >
                <span
                  className={cn(
                    "text-xs font-semibold tabular-nums transition-transform duration-200 ease-premium group-hover:-translate-y-0.5",
                    d.isToday ? "text-[var(--accent-text)]" : d.count === 0 ? "text-[var(--text-4)]" : "text-[var(--text-2)]"
                  )}
                >
                  {d.count}
                </span>
                {/* Cubuk alttan buyur. "Bugun" once buz mavisi buyur, sonra turuncuya ISINIR
                    (ustteki sicak katmanin opakligi acilir) - isi pompasi fikri, yalniz opacity. */}
                <span
                  className={cn(
                    "bar-grow relative w-full max-w-[38px] transition-[filter] duration-200 group-hover:brightness-125",
                    d.count === 0
                      ? "rounded-full bg-[var(--line-strong)]"
                      : d.weekend && !d.isToday
                        ? "rounded-t-xl rounded-b-[5px] bg-[linear-gradient(0deg,rgba(31,127,192,0.3),rgba(91,188,248,0.4))]"
                        : "rounded-t-xl rounded-b-[5px] bg-[linear-gradient(0deg,rgba(31,127,192,0.75),rgba(47,158,230,0.72)_50%,rgba(143,211,255,0.92))] shadow-[0_0_20px_-6px_rgba(91,188,248,0.45)]"
                  )}
                  style={{ height: barPx, "--d": i } as React.CSSProperties}
                >
                  {d.isToday && d.count > 0 ? (
                    <span aria-hidden="true" className="bar-warm bg-[linear-gradient(0deg,var(--accent-lo),var(--accent)_45%,var(--accent-hi))] shadow-[0_0_26px_-2px_rgba(244,124,32,0.6)]" />
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="mt-2.5 flex gap-2 sm:gap-3" aria-hidden="true">
        {days.map((d, i) => (
          <li key={i} className="flex min-w-0 flex-1 flex-col items-center gap-0.5">
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-tight sm:px-2",
                d.isToday
                  ? "border border-[var(--accent-line)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : d.weekend
                    ? "text-[var(--text-4)]"
                    : "text-[var(--text-3)]"
              )}
            >
              {d.label}
            </span>
            <span className={cn("text-[10px] tabular-nums", d.isToday ? "text-[var(--accent-text)] opacity-70" : "text-[var(--text-4)]")}>{d.dayNumber}</span>
          </li>
        ))}
      </ul>

    </div>
  );
}

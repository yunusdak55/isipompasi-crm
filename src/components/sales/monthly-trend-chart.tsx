"use client";

import { useState } from "react";
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
 * "Aylik Satis Trendi" - gercek gridline + eksen etiketli, hover tooltipli
 * premium bar grafik (spec: "en premium grafikleri kullan"). Marka rengi
 * (accent, tek seri) korunur - dataviz yontemi: tek seri = tek renk, ayri
 * bir kategorik renklendirmeye gerek yok (bkz. dataviz skill, color-formula:
 * "nominal categorical, one series -> same slot-1 hue").
 */
export function MonthlyTrendChart({ data }: { data: TrendPoint[] }) {
  const [hovered, setHovered] = useState<string | null>(null);

  const maxRevenue = niceCeiling(Math.max(1, ...data.map((m) => m.revenue)));
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="flex flex-col gap-1">
      <div className="relative flex h-56 gap-3 pl-12">
        {/* Gridlines + Y ekseni etiketleri - kirli/dashed degil, tek-adim-yuzeyden-uzak gri, ince (hairline). */}
        <div className="pointer-events-none absolute inset-y-0 left-0 right-0">
          {gridSteps.map((step) => (
            <div
              key={step}
              className="absolute left-0 right-0 flex items-center"
              style={{ bottom: `${step * 100}%` }}
            >
              <span className="w-11 shrink-0 pr-2 text-right text-[10px] tabular-nums text-ink-400">
                {formatAxisTick(Math.round(maxRevenue * step))}
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
          ))}
        </div>

        {data.map((m, index) => {
          const heightPct = m.revenue > 0 ? Math.max(2, (m.revenue / maxRevenue) * 100) : 0;
          const isHovered = hovered === m.key;

          return (
            <div
              key={m.key}
              className="relative z-10 flex flex-1 flex-col items-center gap-2"
              onMouseEnter={() => setHovered(m.key)}
              onMouseLeave={() => setHovered((h) => (h === m.key ? null : h))}
            >
              <div className="flex w-full flex-1 items-end">
                {/* DUZELTME (bildirilen bug: "animasyon gözükmüyor"): bu sarmalayici
                    (tooltip'i barla birlikte konumlandirmak icin eklendi) flex/h-full
                    OLMADAN barin `height: var(--bar-h)` (YUZDE) degerini COZUMLEYECEGI
                    bir "containing block" saglamiyordu - yukseklik BELIRSIZ/auto kalinca
                    (auto yukseklik, kendi icerigine gore hesaplanir, ama icerik de
                    YUZDEYE gore hesaplaniyor - dongusel bagimlilik) CSS speci geregi
                    yuzde 0'a cozumleniyordu, bar HIC BUYUMUYORDU (gorunmez kaliyordu).
                    h-full, bu div'e ebeveyninden (200px, kesin) GERCEK bir yukseklik
                    verir; flex flex-col justify-end de barin ALTA (baseline) yaslanip
                    YUKARI dogru buyumesini saglar - digerlerinde oldugu gibi. */}
                <div className="group relative h-full w-full flex flex-col justify-end">
                  {/* Deger etiketi barin TAM tepesinde (spec: "trendin tam üstünde gözüksün, aralarına
                      boşluk koyma") - hover'da ayrica ay + satış adedini de gösteren bir tooltip'e büyür. */}
                  {m.revenue > 0 ? (
                    <span className="absolute -top-[18px] left-0 right-0 text-center text-[11px] font-medium tabular-nums text-ink-600">
                      {formatCurrency(m.revenue)}
                    </span>
                  ) : null}
                  <div
                    className="sales-bar-grow relative w-full origin-bottom rounded-t-[4px] bg-gradient-to-t from-accent-600 to-accent-300 transition-[filter,transform] duration-150 ease-snappy"
                    style={{
                      ["--bar-h" as string]: `${heightPct}%`,
                      animationDelay: `${index * 60}ms`,
                      filter: isHovered ? "brightness(1.12)" : undefined,
                      transform: isHovered ? "scaleX(1.04)" : undefined,
                    }}
                  />

                  {/* Hover tooltip - deger zaten dogrudan etiketli (marks-and-anatomy: "direkt
                      etiketler onceliklidir") ama ay adedi/satis sayisi sadece burada gorunur. */}
                  {isHovered ? (
                    <div
                      role="tooltip"
                      className="animate-scale-in pointer-events-none absolute bottom-full left-1/2 z-20 mb-6 w-max -translate-x-1/2 rounded-lg border border-line bg-brand-950 px-3 py-2 text-left shadow-elevated-lg"
                    >
                      <p className="text-xs font-semibold text-white">{m.label}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-accent-300">{formatCurrency(m.revenue)}</p>
                      <p className="text-[11px] text-white/55">{m.count} satış</p>
                    </div>
                  ) : null}
                </div>
              </div>
              <span className="text-xs font-medium text-ink-600">{m.label}</span>
            </div>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">
        {hovered ? (() => {
          const point = data.find((m) => m.key === hovered);
          return point ? `${point.label}: ${formatCurrency(point.revenue)}, ${point.count} satış` : "";
        })() : ""}
      </p>
    </div>
  );
}

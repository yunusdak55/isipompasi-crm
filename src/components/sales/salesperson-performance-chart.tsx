"use client";

import { useState } from "react";
import { formatCurrency, getInitials } from "@/lib/utils";

type SalespersonPoint = { name: string; count: number; revenue: number };

const RANK_MEDAL: Record<number, string> = { 0: "🥇", 1: "🥈", 2: "🥉" };

/**
 * "Satış Personeli Performansı" - yatay siralanmis premium bar grafik.
 * Dataviz yontemi: tek olcum (ciro) birden fazla ADLANDIRILMIS kategoriye
 * (kisi) gore karsilastiriliyor - "nominal categorical, one series" -> HER
 * bar AYNI slot-1 rengi (accent) tasir, kimlik renkle degil AD + CUBUK
 * UZUNLUGUYLA okunur (renk kimligi bosa harcanmaz, bkz. color-formula.md).
 */
export function SalespersonPerformanceChart({ data }: { data: SalespersonPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const maxRevenue = Math.max(1, ...data.map((s) => s.revenue));
  const totalRevenue = data.reduce((sum, s) => sum + s.revenue, 0);

  return (
    <div className="flex flex-col gap-3.5">
      {data.map((sp, index) => {
        const widthPct = Math.max(4, (sp.revenue / maxRevenue) * 100);
        const share = totalRevenue > 0 ? (sp.revenue / totalRevenue) * 100 : 0;
        const isHovered = hovered === index;

        return (
          <div
            key={sp.name}
            className="animate-slide-up flex flex-col gap-1.5"
            style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered((h) => (h === index ? null : h))}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white transition-transform duration-150 " +
                  (isHovered ? "scale-110" : "")
                }
                style={{
                  background:
                    index in RANK_MEDAL
                      ? "linear-gradient(135deg, var(--color-accent-500), var(--color-flame-ember))"
                      : "var(--color-ink-100)",
                  color: index in RANK_MEDAL ? "#fff" : "var(--color-ink-600)",
                }}
              >
                {RANK_MEDAL[index] ?? getInitials(sp.name)}
              </span>
              <p className="truncate text-sm font-medium text-ink-900">{sp.name}</p>
              <span className="ml-auto shrink-0 text-sm font-semibold tabular-nums text-ink-900">{formatCurrency(sp.revenue)}</span>
            </div>

            <div className="relative flex items-center gap-2 pl-[38px]">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="salesperson-bar-grow h-full rounded-full bg-gradient-to-r from-accent-600 to-accent-300 transition-[filter] duration-150"
                  style={{
                    ["--bar-w" as string]: `${widthPct}%`,
                    animationDelay: `${Math.min(index, 12) * 40 + 120}ms`,
                    filter: isHovered ? "brightness(1.15)" : undefined,
                  }}
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

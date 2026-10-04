"use client";

import { useState } from "react";
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AnimatedStatValue } from "@/components/ui/animated-number";
import { DonutRing } from "@/components/charts/donut-ring";
import { LEAD_STATUS_CHART_COLOR } from "@/lib/constants/lead";
import { cn } from "@/lib/utils";
import type { MonthlyFunnelPoint } from "@/lib/data/reports";

const selectClass =
  "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03] [&>option]:text-[#111827]";

type Segment = { label: string; value: number; color: string };

// Durum bazli, BIRBIRIYLE KESISMEYEN dilimler - toplamlari her zaman
// leadCount'a esittir (spec: "Arandı" gibi ortusen/yanlis bir kategori yok).
// Renkler Dashboard halkasi ve Lead hunisiyle AYNI (lib/constants/lead.ts).
function buildSegments(point: MonthlyFunnelPoint): Segment[] {
  return [
    { label: "Lead", value: point.newCount, color: LEAD_STATUS_CHART_COLOR.new },
    { label: "Keşif/Teklif", value: point.discoveryCount, color: LEAD_STATUS_CHART_COLOR.discovery_offer },
    { label: "Takip", value: point.followupCount, color: LEAD_STATUS_CHART_COLOR.followup },
    { label: "Satış", value: point.wonCount, color: LEAD_STATUS_CHART_COLOR.won },
    { label: "Kayıp", value: point.lostCount, color: LEAD_STATUS_CHART_COLOR.lost },
  ];
}

/** Bir ayin huni dagilimini halka grafik olarak gosterir - merkezde toplam lead sayisi. */
function Donut({ point, size = 140 }: { point: MonthlyFunnelPoint; size?: number }) {
  const segments = buildSegments(point).map((seg) => ({ key: seg.label, value: seg.value, color: seg.color }));
  return (
    <DonutRing segments={segments} size={size} stroke={size >= 130 ? 14 : 11} glow ariaLabel={`${point.label}: ${point.leadCount} lead`} className="animate-scale-in">
      <span className={cn("font-semibold tabular-nums tracking-tight text-ink-900", size >= 130 ? "text-2xl" : "text-lg")}>
        <AnimatedStatValue value={point.leadCount} />
      </span>
      <span className="text-[10px] text-ink-600">Lead</span>
    </DonutRing>
  );
}

function DonutLegend({ point }: { point: MonthlyFunnelPoint }) {
  const segments = buildSegments(point);
  return (
    <ul className="flex flex-col gap-1.5">
      {segments.map((seg) => (
        <li key={seg.label} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: seg.color, boxShadow: `0 0 8px ${seg.color}99` }} />
          <span className="text-ink-600">{seg.label}</span>
          <span className="ml-auto font-medium tabular-nums text-ink-900">{seg.value}</span>
        </li>
      ))}
    </ul>
  );
}

function computeChange(current: number, previous: number): { pct: number | null; direction: "up" | "down" | "flat" } {
  if (previous === 0) {
    if (current === 0) return { pct: 0, direction: "flat" };
    return { pct: null, direction: "up" };
  }
  const pct = ((current - previous) / previous) * 100;
  return { pct, direction: pct > 0.05 ? "up" : pct < -0.05 ? "down" : "flat" };
}

function ChangeTile({ label, current, previous }: { label: string; current: number; previous: number }) {
  const { pct, direction } = computeChange(current, previous);

  const toneClass =
    direction === "up" ? "text-success-500 bg-success-500/10" : direction === "down" ? "text-danger-500 bg-danger-500/10" : "text-ink-600 bg-white/[0.06]";
  const Icon = direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;

  return (
    <div className="animate-scale-in rounded-xl border border-line bg-surface p-4">
      <p className="text-xs font-medium text-ink-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-ink-900">
        <AnimatedStatValue value={current} />
      </p>
      <span className={cn("mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", toneClass)}>
        <Icon className="h-3 w-3" />
        {pct === null ? "Yeni" : `${pct > 0 ? "+" : ""}${pct.toFixed(0)}%`}
      </span>
    </div>
  );
}

/** Ay secip gecmis bir ayla kiyaslayarak lead/kesif/satis degisimini donut grafik + yuzde olarak gosteren premium arac. */
export function MonthlyComparisonPanel({ data }: { data: MonthlyFunnelPoint[] }) {
  const reversedOptions = [...data].reverse();
  const defaultSelected = data[data.length - 1]?.key ?? "";
  const defaultCompare = data[data.length - 2]?.key ?? defaultSelected;

  const [selectedKey, setSelectedKey] = useState(defaultSelected);
  const [compareKey, setCompareKey] = useState(defaultCompare);
  const [showComparison, setShowComparison] = useState(false);

  const selected = data.find((m) => m.key === selectedKey);
  const compare = data.find((m) => m.key === compareKey);

  if (!selected) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-600">Ay</span>
          <select
            value={selectedKey}
            onChange={(e) => {
              setSelectedKey(e.target.value);
              setShowComparison(false);
            }}
            className={selectClass}
          >
            {reversedOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-600">Kıyasla</span>
          <select
            value={compareKey}
            onChange={(e) => {
              setCompareKey(e.target.value);
              setShowComparison(false);
            }}
            className={selectClass}
          >
            {reversedOptions.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setShowComparison(true)}
          disabled={selectedKey === compareKey}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-flame-hot via-accent-500 to-flame-ember px-3.5 py-2 text-sm font-medium text-white shadow-glow-accent transition-all duration-150 ease-snappy hover:-translate-y-px hover:shadow-glow-accent-lg active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Kıyasla
        </button>
      </div>

      <div key={selectedKey} className="flex flex-wrap items-center gap-6">
        <Donut point={selected} />
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-900">{selected.label}</p>
          <DonutLegend point={selected} />
        </div>

        {showComparison && compare ? (
          <>
            <div className="hidden h-24 w-px bg-line sm:block" />
            <Donut point={compare} size={104} />
            <div>
              <p className="mb-1.5 text-sm font-medium text-ink-900">{compare.label}</p>
              <DonutLegend point={compare} />
            </div>
          </>
        ) : null}
      </div>

      {showComparison && compare ? (
        <div key={`${selectedKey}-${compareKey}`} className="flex flex-col gap-2">
          <p className="text-xs text-ink-600">
            <span className="font-medium text-ink-900">{selected.label}</span> — <span className="font-medium text-ink-900">{compare.label}</span> ile
            kıyaslandı
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ChangeTile label="Gelen Lead Değişimi" current={selected.leadCount} previous={compare.leadCount} />
            <ChangeTile label="Keşif Değişimi" current={selected.discoveryCount} previous={compare.discoveryCount} />
            <ChangeTile label="Satış Değişimi" current={selected.wonCount} previous={compare.wonCount} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

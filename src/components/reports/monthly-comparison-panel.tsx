"use client";

import { useState } from "react";
import { ArrowLeftRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { AnimatedStatValue } from "@/components/ui/animated-number";
import { cn } from "@/lib/utils";
import type { MonthlyFunnelPoint } from "@/lib/data/reports";

const selectClass =
  "rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink-900 transition-colors duration-150 focus-visible:border-accent-400 focus-visible:bg-white/[0.03] [&>option]:text-[#111827]";

type Segment = { label: string; value: number; colorVar: string; dotClass: string };

function buildSegments(point: MonthlyFunnelPoint): Segment[] {
  const other = Math.max(0, point.leadCount - point.calledCount - point.discoveryCount - point.wonCount);
  return [
    { label: "Satış", value: point.wonCount, colorVar: "var(--color-success-500)", dotClass: "bg-success-500" },
    { label: "Keşif", value: point.discoveryCount, colorVar: "var(--color-accent-500)", dotClass: "bg-accent-500" },
    { label: "Arandı", value: point.calledCount, colorVar: "var(--color-brand-500)", dotClass: "bg-brand-500" },
    { label: "Diğer", value: other, colorVar: "var(--color-ink-300)", dotClass: "bg-ink-300" },
  ];
}

/** Bir ayin huni dagilimini yuvarlak (donut) grafik olarak gosterir - merkezde toplam lead sayisi. */
function Donut({ point, size = 140 }: { point: MonthlyFunnelPoint; size?: number }) {
  const segments = buildSegments(point);
  const total = point.leadCount;
  let cursor = 0;
  const stops = segments.map((seg) => {
    const start = (cursor / Math.max(1, total)) * 360;
    cursor += seg.value;
    const end = (cursor / Math.max(1, total)) * 360;
    return `${seg.colorVar} ${start}deg ${end}deg`;
  });
  const gradient = total > 0 ? `conic-gradient(${stops.join(", ")})` : "conic-gradient(var(--color-line) 0deg 360deg)";

  return (
    <div
      className="animate-scale-in relative shrink-0 rounded-full transition-[background] duration-500 ease-settle"
      style={{ width: size, height: size, background: gradient }}
    >
      <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-surface">
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-ink-900">
          <AnimatedStatValue value={total} />
        </span>
        <span className="text-[10px] text-ink-600">Lead</span>
      </div>
    </div>
  );
}

function DonutLegend({ point }: { point: MonthlyFunnelPoint }) {
  const segments = buildSegments(point);
  return (
    <ul className="flex flex-col gap-1.5">
      {segments.map((seg) => (
        <li key={seg.label} className="flex items-center gap-2 text-xs">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", seg.dotClass)} />
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

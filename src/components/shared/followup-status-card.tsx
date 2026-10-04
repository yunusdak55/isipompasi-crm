"use client";

import { useState, useTransition } from "react";
import { CalendarClock, CalendarOff, Clock, AlarmClockOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FollowupSummary } from "@/lib/followup";

type ActionResult = { error: string | null };

const TONE_STYLES: Record<FollowupSummary["tone"], string> = {
  none: "border-line bg-white/[0.03] text-ink-600",
  upcoming: "border-warning-500/30 bg-warning-500/[0.08] text-ink-900",
  today: "border-accent-500/40 bg-accent-500/[0.12] text-ink-900",
  grace: "border-warning-500/40 bg-warning-500/[0.12] text-ink-900",
  overdue: "border-danger-500/40 bg-danger-500/[0.12] text-ink-900",
};

const SNOOZE_OPTIONS = [
  { days: 1, label: "Yarın" },
  { days: 3, label: "3 gün" },
  { days: 7, label: "1 hafta" },
];

/**
 * "Sonraki takip" ozeti + hizli islemler. Eskiden iki panelde de takibi
 * ertelemenin ya da iptal etmenin yolu yoktu (tek cikis: yeni bir gorusme
 * sonucu girmek). Metinler SUNUCUDA hesaplanip prop olarak gelir
 * (bkz. lib/followup.ts describeFollowup) - istemci saatine bagli hidrasyon
 * uyumsuzlugu olmaz.
 */
export function FollowupStatusCard({
  summary,
  snoozeAction,
  clearAction,
}: {
  summary: FollowupSummary;
  snoozeAction: (days: number) => Promise<ActionResult>;
  clearAction: () => Promise<ActionResult>;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
      setConfirmClear(false);
    });
  }

  if (summary.tone === "none") {
    return (
      <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-xs", TONE_STYLES.none)}>
        <CalendarOff className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <p>
          <span className="font-medium text-ink-900">Takip planlanmadı.</span> Aşağıya &quot;kaç gün sonra&quot; yazıp onay
          ikonuna basarak takibe alabilirsiniz.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2.5 rounded-lg border px-3 py-2.5", TONE_STYLES[summary.tone])}>
      <div className="flex items-start gap-2.5">
        <CalendarClock
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            summary.tone === "overdue" ? "text-danger-500" : summary.tone === "today" ? "text-accent-400" : "text-warning-500"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-500">Sonraki takip</p>
          <p className="text-sm font-medium">{summary.dateText}</p>
          <p
            className={cn(
              "mt-0.5 text-xs font-medium",
              summary.tone === "overdue" ? "text-[#ffb4a3]" : summary.tone === "grace" ? "text-warning-500" : "text-ink-600"
            )}
          >
            {summary.relativeText}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 pt-2">
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-500">
          <Clock className="h-3 w-3" />
          Ertele (bugünden):
        </span>
        {SNOOZE_OPTIONS.map((o) => (
          <button
            key={o.days}
            type="button"
            disabled={isPending}
            onClick={() => run(() => snoozeAction(o.days))}
            className="rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-ink-600 transition-colors duration-150 hover:border-warning-500/40 hover:text-ink-900 disabled:opacity-50"
          >
            {o.label}
          </button>
        ))}
        <span className="flex-1" />
        {confirmClear ? (
          <span className="inline-flex items-center gap-1.5 text-[11px]">
            <span className="text-ink-600">Takip kaldırılsın mı?</span>
            <button
              type="button"
              disabled={isPending}
              onClick={() => run(clearAction)}
              className="rounded-full bg-danger-500/20 px-2.5 py-1 font-medium text-[#ffb4a3] hover:bg-danger-500/30 disabled:opacity-50"
            >
              Evet, kaldır
            </button>
            <button type="button" onClick={() => setConfirmClear(false)} className="text-ink-500 hover:text-ink-900">
              Vazgeç
            </button>
          </span>
        ) : (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-ink-500 transition-colors duration-150 hover:text-[#ffb4a3] disabled:opacity-50"
          >
            <AlarmClockOff className="h-3 w-3" />
            Takibi kaldır
          </button>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-[#ffb4a3]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

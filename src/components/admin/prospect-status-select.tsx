"use client";

import { useState, useTransition } from "react";
import { updateProspectStatusAction } from "@/app/(dashboard)/admin/prospects/actions";
import { PROSPECT_STATUS_ORDER, PROSPECT_STATUS_LABELS, PROSPECT_STATUS_COLOR } from "@/lib/constants/prospects";
import { cn } from "@/lib/utils";
import type { ProspectStatus } from "@/lib/types/domain";

const toneBg: Record<string, string> = {
  brand: "bg-brand-500/15 text-brand-100 border-brand-500/30",
  accent: "bg-accent-500/15 text-accent-300 border-accent-500/30",
  success: "bg-success-500/15 text-success-500 border-success-500/30",
  warning: "bg-warning-500/15 text-warning-500 border-warning-500/30",
  danger: "bg-danger-500/15 text-danger-500 border-danger-500/30",
};

/** Durum degistirme - "Kayıp" dahil, tek tikla (istediğinde kayıp olarak işaretleyeceğim). */
export function ProspectStatusSelect({ prospectId, status }: { prospectId: string; status: ProspectStatus }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tone = PROSPECT_STATUS_COLOR[status];

  return (
    <div className="flex flex-col gap-1">
      <select
        value={status}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as ProspectStatus;
          setError(null);
          startTransition(async () => {
            const result = await updateProspectStatusAction(prospectId, next, { error: null });
            if (result.error) setError(result.error);
          });
        }}
        className={cn(
          "rounded-lg border px-2 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-60 [&>option]:bg-surface [&>option]:text-[#111827]",
          toneBg[tone]
        )}
      >
        {PROSPECT_STATUS_ORDER.map((value) => (
          <option key={value} value={value}>
            {PROSPECT_STATUS_LABELS[value]}
          </option>
        ))}
      </select>
      {error ? <span className="text-[10px] text-[#ffb4a3]">{error}</span> : null}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { setIntegrationStatusAction } from "@/app/(dashboard)/admin/actions";
import { INTEGRATION_STATUS_LABELS, INTEGRATION_STATUS_TONE } from "@/lib/constants/admin";
import { cn } from "@/lib/utils";
import type { IntegrationProvider, IntegrationStatus } from "@/lib/types/domain";

const toneBg: Record<string, string> = {
  ink: "bg-white/[0.06] text-white/70 border-white/15",
  warning: "bg-warning-500/15 text-warning-500 border-warning-500/30",
  success: "bg-success-500/15 text-success-500 border-success-500/30",
  danger: "bg-danger-500/15 text-danger-500 border-danger-500/30",
};

/** Firmalar x Entegrasyonlar matrisinde tek bir hucre - durumu elle isaretlemek icin. */
export function IntegrationStatusSelect({
  companyId,
  provider,
  status,
}: {
  companyId: string;
  provider: IntegrationProvider;
  status: IntegrationStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tone = INTEGRATION_STATUS_TONE[status];

  return (
    <div className="flex flex-col gap-1">
      <select
        value={status}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value as IntegrationStatus;
          setError(null);
          startTransition(async () => {
            const result = await setIntegrationStatusAction(companyId, provider, next, { error: null });
            if (result.error) setError(result.error);
          });
        }}
        className={cn(
          "rounded-lg border px-2 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-60 [&>option]:bg-surface [&>option]:text-[#111827]",
          toneBg[tone]
        )}
      >
        {Object.entries(INTEGRATION_STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {error ? <span className="text-[10px] text-[#ffb4a3]">{error}</span> : null}
    </div>
  );
}

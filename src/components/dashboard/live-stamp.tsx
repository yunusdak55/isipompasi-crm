"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "17:42 itibarıyla güncel" damgasi + elle yenileme dugmesi. Otomatik yenileme
 * mantigi (aralik / odak / geri-ileri) DashboardLive'dadir; bu bilesen yalnizca
 * gosterir. Damgadaki saat SUNUCUDA uretilir: "bu rakamlar su saatte
 * veritabanindan okundu".
 */
export function LiveStamp({ timeLabel, pending, onRefresh }: { timeLabel: string; pending: boolean; onRefresh: () => void }) {
  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={pending}
      title={`Rakamlar veritabanından ${timeLabel} itibarıyla okundu. Sayfa açıkken dakikada bir kendiliğinden yenilenir; tıklayarak şimdi yenileyebilirsiniz.`}
      className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--card-line-2)] bg-[var(--card-bg-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-3)] transition-colors duration-150 hover:border-[var(--accent-line)] hover:text-[var(--text)] disabled:cursor-default"
    >
      {/* sabit isik (nabiz yok: surekli yanip sonen hicbir sey yok) */}
      <span className="ik-live-dot" aria-hidden="true" />
      <span className="tabular-nums">{timeLabel}</span>
      <span className="hidden sm:inline">itibarıyla güncel</span>
      <RefreshCw className={cn("h-3 w-3 text-[var(--text-4)] transition-colors group-hover:text-[var(--accent-text)]", pending && "animate-spin")} />
    </button>
  );
}

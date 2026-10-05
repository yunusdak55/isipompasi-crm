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
      className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[11px] font-medium text-white/60 transition-colors duration-150 hover:border-white/25 hover:bg-white/10 hover:text-white disabled:cursor-default"
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-500/60 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success-500" />
      </span>
      <span className="tabular-nums">{timeLabel}</span>
      <span className="hidden sm:inline">itibarıyla güncel</span>
      <RefreshCw className={cn("h-3 w-3 text-white/40 transition-colors group-hover:text-white/80", pending && "animate-spin")} />
    </button>
  );
}

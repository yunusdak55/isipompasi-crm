import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Yeni Lead" gostergesi: dolu yesil pill, beyaz metin - kucuk yesil nokta/outline
 * DEGIL (spec: "ilk bakista okunabilmeli", premium ama kompakt).
 */
export function NewLeadBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "animate-scale-in inline-flex items-center rounded-full bg-success-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm shadow-success-900/10",
        className
      )}
    >
      Yeni
    </span>
  );
}

/**
 * "Gecikmis Lead" gostergesi: dolu kirmizi pill + kucuk unlem ikonu, beyaz metin.
 * Sadece ikon degil - kullanici ilk bakista "Gecikmiş" metnini okuyabilmeli.
 */
export function OverdueBadge({ className }: { className?: string }) {
  return (
    <span
      title="48 saatten uzun süredir görüşme yapılmadı"
      className={cn(
        "animate-scale-in inline-flex items-center gap-1 rounded-full bg-danger-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm shadow-danger-900/10",
        className
      )}
    >
      <AlertTriangle className="h-2.5 w-2.5" strokeWidth={2.5} />
      Gecikmiş
    </span>
  );
}

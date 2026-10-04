import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLOR } from "@/lib/constants/lead";
import { PROSPECT_STATUS_LABELS, PROSPECT_STATUS_COLOR } from "@/lib/constants/prospects";
import type { LeadStatus, ProspectStatus } from "@/lib/types/domain";

export type Tone = "brand" | "accent" | "success" | "danger" | "warning" | "ink" | "ice";

// Pastel -50/-100 dolgular acik zemin icindi; koyu lacivert temada bunun yerine
// dusuk opakli renk dolgusu + acik renkli metin ("cam" rozet) kullaniliyor -
// brand/accent/success/danger/warning skalalarina (marka renkleri, kasitli
// olarak flip edilmedi) dokunmadan sadece rozet tarifi koyu temaya uyarlandi.
const toneClasses: Record<Tone, string> = {
  // "brand" (ör. Lead durumu) artik BUZ mavisiyle: koyu lacivert zeminde daha okunur, paletle uyumlu.
  brand: "bg-ice-500/15 text-ice-200 ring-ice-500/30",
  ice: "bg-ice-500/15 text-ice-200 ring-ice-500/30",
  accent: "bg-accent-500/15 text-accent-300 ring-accent-500/30",
  success: "bg-success-500/15 text-success-100 ring-success-500/30",
  danger: "bg-danger-500/15 text-danger-100 ring-danger-500/30",
  warning: "bg-warning-500/15 text-warning-100 ring-warning-500/30",
  ink: "bg-ink-50 text-ink-600 ring-ink-100",
};

export function Badge({
  tone = "ink",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // Basta rozet rengini tasiyan minik nokta (before) - durum bir bakista renkle de okunur.
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition-colors duration-150 ease-snappy before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-current before:opacity-80 before:content-['']",
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: LeadStatus }) {
  // Migration 0006 calisip veritabanindaki eski 'pre_offer' satirlari
  // 'discovery_offer'a tasinana kadar gecici olarak boyle bir durumla
  // karsilasilabilir - bos/kirik gorunum yerine guvenli bir dusun.
  const safeStatus: LeadStatus = status in LEAD_STATUS_LABELS ? status : "discovery_offer";
  return <Badge tone={LEAD_STATUS_COLOR[safeStatus] as Tone}>{LEAD_STATUS_LABELS[safeStatus]}</Badge>;
}

export function ProspectStatusBadge({ status }: { status: ProspectStatus }) {
  return <Badge tone={PROSPECT_STATUS_COLOR[status] as Tone}>{PROSPECT_STATUS_LABELS[status]}</Badge>;
}

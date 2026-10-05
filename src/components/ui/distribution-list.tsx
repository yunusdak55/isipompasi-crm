import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Raporlar ve Dijital Ajan sayfalari arasinda paylasilan dagilim cubugu
 * ("hangi sehirden kac lead geldi" gibi). Onceden Raporlar sayfasinda tek
 * basina yasiyordu, Dijital Ajan da ayni gorseli kullandigi icin buraya
 * tasindi (spec: "kod tekrari yaratma").
 */
export function EmptyState({ body, title }: { body: string; title?: string }) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-9 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ice-500/10 text-ice-300 ring-1 ring-inset ring-ice-500/25">
        <BarChart3 className="h-[18px] w-[18px]" />
      </span>
      {title ? <p className="text-sm font-semibold text-ink-900">{title}</p> : null}
      <p className="max-w-xs text-sm text-ink-600">{body}</p>
    </div>
  );
}

/** "Diğer (N şehir)" / "Belirtilmemiş" gibi toplayici satirlar soluk renkte gosterilir. */
const MUTED_LABEL = /^(Diğer|Belirtilmemiş)/;

export function DistributionList({
  items,
  unit,
  className,
}: {
  items: { label: string; count: number }[];
  unit: string;
  className?: string;
}) {
  if (items.length === 0) return <EmptyState body="Henüz veri yok." />;
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((sum, i) => sum + i.count, 0);
  // En kalabalik (soluk olmayan) satir turuncu, diger ayirt edilebilir satirlar buz mavisi.
  const leaderIndex = items.findIndex((i) => !MUTED_LABEL.test(i.label) && i.count === Math.max(...items.filter((x) => !MUTED_LABEL.test(x.label)).map((x) => x.count)));

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {items.map((item, index) => {
        const muted = MUTED_LABEL.test(item.label);
        const pct = total > 0 ? (item.count / total) * 100 : 0;
        return (
          <div key={item.label} className="animate-slide-up flex flex-col gap-1.5" style={{ animationDelay: `${Math.min(index, 12) * 10}ms` }}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className={cn("truncate font-medium", muted ? "text-ink-400" : "text-ink-900")}>{item.label}</span>
              <span className="shrink-0 tabular-nums text-ink-600">
                <span className={cn("font-semibold", muted ? "text-ink-400" : "text-ink-900")}>{item.count.toLocaleString("tr-TR")}</span> {unit}
                <span className="ml-1.5 text-ink-400">%{pct < 1 && pct > 0 ? "<1" : pct.toFixed(0)}</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  "grow-x h-full rounded-full",
                  muted
                    ? "bg-gradient-to-r from-ink-300 to-ink-400/80"
                    : index === leaderIndex
                      ? "bg-gradient-to-r from-accent-600 via-accent-500 to-flame-hot shadow-[0_0_14px_-2px_rgba(244,124,32,0.6)]"
                      : "bg-gradient-to-r from-ice-600 to-ice-300"
                )}
                style={{ width: `${(item.count / max) * 100}%`, animationDelay: `${Math.min(index, 12) * 10 + 40}ms` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

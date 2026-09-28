import { cn } from "@/lib/utils";

/**
 * Raporlar ve Dijital Ajan sayfalari arasinda paylasilan basit dagilim
 * cubugu ("hangi sehirden kac lead geldi" gibi). Onceden Raporlar
 * sayfasinda tek basina yasiyordu, Dijital Ajan da ayni gorseli
 * kullandigi icin buraya tasindi (spec: "kod tekrari yaratma").
 */
export function EmptyState({ body }: { body: string }) {
  return (
    <div className="animate-fade-in flex items-center justify-center rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm text-ink-600">{body}</p>
    </div>
  );
}

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
  const max = Math.max(...items.map((i) => i.count));

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {items.map((item, index) => (
        <div key={item.label} className="animate-slide-up flex flex-col gap-1" style={{ animationDelay: `${index * 40}ms` }}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-ink-900">{item.label}</span>
            <span className="tabular-nums text-ink-600">
              {item.count} {unit}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-accent-500 transition-all duration-500 ease-settle"
              style={{ width: `${(item.count / max) * 100}%`, transitionDelay: `${index * 40}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

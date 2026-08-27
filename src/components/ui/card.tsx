import { cn } from "@/lib/utils";
import { AnimatedStatValue } from "@/components/ui/animated-number";

export function Card({
  children,
  className,
  hoverable = false,
}: {
  children: React.ReactNode;
  className?: string;
  /** Liste/kanban gibi tiklanabilir kart baglaminda hafif hover elevation acar. */
  hoverable?: boolean;
}) {
  return (
    <div
      className={cn(
        // Duz tek renk yerine ustte cok hafif bir isik gradienti - "surface
        // layering" hissi (spec: "kartlar tek tip duz kutular olmaktan cikar").
        // bg-surface (renk) + bg-gradient-to-b (image) ayni oge uzerinde birlikte
        // calisir; gradient sadece uzerine cok hafif bir parlaklik katmani ekler.
        "rounded-2xl border border-line bg-surface bg-gradient-to-b from-white/[0.04] to-transparent shadow-sm shadow-black/20 transition-all duration-200 ease-premium",
        hoverable && "hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-elevated",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center justify-between border-b border-line px-5 py-4", className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-sm font-semibold text-ink-900", className)}>{children}</h3>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

type StatTone = "brand" | "accent" | "success" | "danger" | "warning" | "ink";

const statDotClasses: Record<StatTone, string> = {
  brand: "bg-brand-500",
  accent: "bg-accent-500",
  success: "bg-success-500",
  danger: "bg-danger-500",
  warning: "bg-warning-500",
  ink: "bg-ink-400",
};

const statChangeClasses: Record<"success" | "danger" | "ink", string> = {
  success: "text-[#7ee2ad]",
  danger: "text-[#ffb4a3]",
  ink: "text-ink-400",
};

/** Dashboard durum sayaclari. tone verilirse etiketin yaninda kucuk bir renk noktasi
 * gosterir - pipeline "sicaklik" hikayesini (lacivert->turuncu->yesil) yansitir. */
export function StatCard({
  label,
  value,
  changeLabel,
  tone,
}: {
  label: string;
  value: string | number;
  changeLabel?: string | null;
  tone?: StatTone;
}) {
  const changeTone: "success" | "danger" | "ink" = tone === "success" ? "success" : tone === "danger" ? "danger" : "ink";

  return (
    <Card hoverable className="animate-slide-up px-5 py-4">
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-600">
        {tone ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statDotClasses[tone])} /> : null}
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink-900">
        <AnimatedStatValue value={value} />
      </p>
      {changeLabel ? (
        <p className={cn("mt-1 text-xs font-medium tabular-nums", statChangeClasses[changeTone])}>{changeLabel}</p>
      ) : null}
    </Card>
  );
}

/**
 * Dashboard hero paneli icin "cam" (glass) yuzeyli oncelikli metrik karti -
 * koyu lacivert zemin uzerinde translucent surface + turuncu vurgulu rakam.
 */
export function HeroStatCard({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="animate-slide-up flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3.5 backdrop-blur-sm transition-all duration-200 ease-premium hover:border-white/20 hover:bg-white/[0.09]">
      {icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/15 text-accent-400 ring-1 ring-inset ring-accent-500/25">
          {icon}
        </span>
      ) : null}
      <div>
        <p className="text-xs font-medium text-white/55">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-white">
          <AnimatedStatValue value={value} />
        </p>
      </div>
    </div>
  );
}

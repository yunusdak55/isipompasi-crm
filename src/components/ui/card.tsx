import { cn } from "@/lib/utils";
import { AnimatedStatValue } from "@/components/ui/animated-number";
import { Sparkline } from "@/components/charts/sparkline";

export function Card({
  children,
  className,
  hoverable = false,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  /** Liste/kanban gibi tiklanabilir kart baglaminda hafif hover elevation acar. */
  hoverable?: boolean;
  /** Sayfa ici çapa navigasyonu (ör. hizli-gecis menusu) icin opsiyonel. */
  id?: string;
}) {
  return (
    <div
      id={id}
      className={cn(
        // YUZEY DERINLIGI (tasarim yukseltmesi): ustte yumusak isik "sheen" gradyani,
        // ince ic hairline + asagida yayilmis koyu golge (shadow-card). Hover'da
        // yalnizca transform/kenar/golge degisir (animasyonlu blur/filtre yok).
        "rounded-2xl border border-line bg-surface bg-gradient-to-b from-white/[0.055] via-white/[0.012] to-transparent shadow-card transition-[transform,border-color,box-shadow] duration-200 ease-premium",
        hoverable && "hover:-translate-y-0.5 hover:border-white/[0.18] hover:shadow-card-hover",
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
  return <h3 className={cn("text-sm font-semibold tracking-tight text-ink-900", className)}>{children}</h3>;
}

export function CardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("px-5 py-4", className)}>{children}</div>;
}

type StatTone = "brand" | "accent" | "success" | "danger" | "warning" | "ink";

const statDotClasses: Record<StatTone, string> = {
  brand: "bg-ice-400 shadow-[0_0_8px_rgba(91,188,248,0.7)]",
  accent: "bg-accent-500 shadow-[0_0_8px_rgba(244,124,32,0.7)]",
  success: "bg-success-500 shadow-[0_0_8px_rgba(47,133,88,0.7)]",
  danger: "bg-danger-500 shadow-[0_0_8px_rgba(196,67,46,0.7)]",
  warning: "bg-warning-500 shadow-[0_0_8px_rgba(201,154,46,0.7)]",
  ink: "bg-ink-400",
};

/** Kartin ust kenarindaki ince, tona gore renklenen isik cizgisi. */
const statEdgeClasses: Record<StatTone, string> = {
  brand: "via-ice-400/60",
  accent: "via-accent-500/70",
  success: "via-success-500/60",
  danger: "via-danger-500/60",
  warning: "via-warning-500/60",
  ink: "via-white/25",
};

const statSparkColor: Record<StatTone, string> = {
  brand: "#5bbcf8",
  accent: "#f47c20",
  success: "#34a56b",
  danger: "#d9553f",
  warning: "#e3b341",
  ink: "#8a9ab5",
};

const statChangeClasses: Record<"success" | "danger" | "ink", string> = {
  success: "text-[#7ee2ad]",
  danger: "text-[#ffb4a3]",
  ink: "text-ink-400",
};

/** Dashboard/Rapor durum sayaclari. tone verilirse etiketin yaninda parlayan bir renk noktasi ve
 * kartin ust kenarinda ayni tonda ince bir isik cizgisi gosterir; `sparkline` verilirse sag altta
 * minik bir trend cizgisi cizer. */
export function StatCard({
  label,
  value,
  changeLabel,
  tone,
  sparkline,
}: {
  label: string;
  value: string | number;
  changeLabel?: string | null;
  tone?: StatTone;
  /** Son N donemin degerleri (eskiden yeniye) - minik trend cizgisi. */
  sparkline?: number[];
}) {
  const changeTone: "success" | "danger" | "ink" = tone === "success" ? "success" : tone === "danger" ? "danger" : "ink";

  return (
    <Card hoverable className="animate-slide-up relative overflow-hidden px-5 py-4">
      {tone ? (
        <span
          aria-hidden="true"
          className={cn("pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent", statEdgeClasses[tone])}
        />
      ) : null}
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-ink-600">
        {tone ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statDotClasses[tone])} /> : null}
        {label}
      </p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tabular-nums tracking-tight text-ink-900">
          <AnimatedStatValue value={value} />
        </p>
        {sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} color={statSparkColor[tone ?? "ink"]} className="mb-0.5 shrink-0" /> : null}
      </div>
      {changeLabel ? (
        <p className={cn("mt-1 text-xs font-medium tabular-nums", statChangeClasses[changeTone])}>{changeLabel}</p>
      ) : null}
    </Card>
  );
}

/**
 * Hero paneli icin "cam" (glass) yuzeyli oncelikli metrik karti - koyu lacivert zemin uzerinde
 * translucent surface + turuncu vurgulu rakam. (backdrop-blur KALDIRILDI: zemin zaten sade bir
 * gradyan, blur gorsel fark yaratmiyor ama her kaydirmada GPU'da yeniden hesaplaniyordu.)
 */
export function HeroStatCard({
  label,
  value,
  icon,
  sparkline,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  sparkline?: number[];
}) {
  return (
    <div className="animate-slide-up flex items-center gap-3 rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.09] to-white/[0.03] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-[border-color,background-color] duration-200 ease-premium hover:border-white/20 hover:bg-white/[0.09]">
      {icon ? (
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500/15 text-accent-400 ring-1 ring-inset ring-accent-500/25 shadow-[0_0_16px_-4px_rgba(244,124,32,0.5)]">
          {icon}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-white/55">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-white">
          <AnimatedStatValue value={value} />
        </p>
      </div>
      {sparkline && sparkline.length > 1 ? <Sparkline values={sparkline} color="#ffb454" className="shrink-0" /> : null}
    </div>
  );
}

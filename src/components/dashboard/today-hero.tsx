import { AlertTriangle, CalendarClock, CalendarDays, Sparkles } from "lucide-react";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { AnimatedStatValue } from "@/components/ui/animated-number";
import { WeekChart } from "@/components/dashboard/week-chart";
import { LiveStamp } from "@/components/dashboard/live-stamp";
import { cn } from "@/lib/utils";
import type { DashboardToday } from "@/lib/data/dashboard";
import type { WeekDay } from "@/components/dashboard/view-model";

type TileTone = "accent" | "danger" | "success";

const TILE_TONE: Record<TileTone, { box: string; chip: string; glow: string; glowColor: string }> = {
  accent: {
    box: "border-accent-500/40 bg-gradient-to-br from-accent-500/[0.20] via-accent-500/[0.07] to-transparent",
    chip: "bg-accent-500/25 text-accent-200 ring-accent-500/40",
    glow: "",
    glowColor: "rgba(244,124,32,0.42)",
  },
  danger: {
    box: "border-danger-500/35 bg-gradient-to-br from-danger-500/[0.18] via-danger-500/[0.06] to-transparent",
    chip: "bg-danger-500/25 text-[#ffc2b4] ring-danger-500/40",
    glow: "",
    glowColor: "rgba(196,67,46,0.38)",
  },
  success: {
    box: "border-success-500/35 bg-gradient-to-br from-success-500/[0.17] via-success-500/[0.06] to-transparent",
    chip: "bg-success-500/25 text-[#9af0c3] ring-success-500/40",
    glow: "",
    glowColor: "rgba(47,133,88,0.38)",
  },
};

function PriorityTile({
  href,
  label,
  caption,
  value,
  icon,
  tone,
  index,
}: {
  href: string;
  label: string;
  caption: string;
  value: number;
  icon: React.ReactNode;
  tone: TileTone;
  index: number;
}) {
  const active = value > 0;
  return (
    <a
      href={href}
      className={cn(
        "animate-slide-up group relative block overflow-hidden rounded-2xl border p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition-all duration-200 ease-premium sm:p-4",
        "hover:-translate-y-0.5 hover:border-white/30",
        active ? TILE_TONE[tone].box : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
      )}
      style={{ animationDelay: `${120 + index * 70}ms` }}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-80 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: `radial-gradient(closest-side, ${TILE_TONE[tone].glowColor}, transparent)` }}
        />
      ) : null}
      <div className="relative flex items-start justify-between gap-2">
        <p className={cn("text-[10.5px] font-semibold uppercase tracking-[0.14em]", active ? "text-white/70" : "text-white/40")}>{label}</p>
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
            active ? TILE_TONE[tone].chip : "bg-white/[0.06] text-white/35 ring-white/10"
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "relative mt-3 text-[2.5rem] font-semibold tabular-nums leading-none tracking-tight sm:text-5xl",
          active ? "text-white" : "text-white/30"
        )}
      >
        <AnimatedStatValue value={value} />
      </p>
      <p className={cn("relative mt-2 text-xs leading-snug", active ? "text-white/60" : "text-white/35")}>{caption}</p>
    </a>
  );
}

function Bold({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-white">{children}</strong>;
}

/** Ozet cumlesi: sadece sifirdan buyuk olanlari sayar; hepsi sifirsa "bekleyen is yok" der. */
function Summary({ today, weekTotal }: { today: DashboardToday; weekTotal: number }) {
  const { due, overdue, fresh } = today.counts;
  const parts: React.ReactNode[] = [];
  if (due > 0) parts.push(<span key="due"><Bold>{due}</Bold> bugünkü takip</span>);
  if (overdue > 0) parts.push(<span key="over"><Bold>{overdue}</Bold> gecikmiş takip</span>);
  if (fresh > 0) parts.push(<span key="new"><Bold>{fresh}</Bold> yeni lead</span>);

  if (parts.length === 0) {
    return (
      <>
        Bugünlük bekleyen bir iş yok.{" "}
        {weekTotal > 0 ? (
          <>
            Önümüzdeki 7 günde <Bold>{weekTotal}</Bold> takip planlı.
          </>
        ) : null}
      </>
    );
  }

  return (
    <>
      Bugün ilgilenmeniz gereken:{" "}
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 ? (i === parts.length - 1 ? " ve " : ", ") : ""}
          {part}
        </span>
      ))}
      .
    </>
  );
}

/**
 * "Bugun" ekraninin ust paneli: selamlama + ozet cumle + uc oncelik kutusu
 * (her biri ilgili listeye ucar) + onumuzdeki 7 gunun takip grafigi. Koyu
 * lacivert zemin, turuncu vurgu, cam yuzeyler - uygulamanin tasarim dilini
 * korur, katmanli isik/derinlikle ust seviyeye tasir.
 */
export function TodayHero({
  greeting,
  firstName,
  dateLabel,
  today,
  week,
  timeLabel,
  refreshing,
  onRefresh,
}: {
  greeting: string;
  firstName: string | null;
  dateLabel: string;
  today: DashboardToday;
  week: WeekDay[];
  /** Verinin sunucuda okundugu saat yazisi + yenileme durumu - bkz. LiveStamp / DashboardLive. */
  timeLabel: string;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { due, overdue, fresh, dueCarry } = today.counts;
  const weekTotal = week.reduce((sum, d) => sum + d.count, 0);

  return (
    <section
      className="animate-fade-in relative isolate overflow-hidden rounded-[28px] shadow-elevated-lg ring-1 ring-inset ring-white/10"
      style={{ background: "linear-gradient(135deg, #12305a 0%, #0b1f3a 42%, #071426 100%)" }}
    >
      <HvacBackdrop intensity="hero" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-52 -top-52 h-[520px] w-[520px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(244,124,32,0.17), transparent)" }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-56 -right-16 h-[620px] w-[620px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(74,120,189,0.24), transparent)" }}
      />
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

      <div className="relative grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-9">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent-300">
              <CalendarDays className="h-3.5 w-3.5" />
              {dateLabel}
            </p>
            <LiveStamp timeLabel={timeLabel} pending={refreshing} onRefresh={onRefresh} />
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-[2.6rem] sm:leading-[1.1]">
            <span className="text-white/75">{greeting}</span>
            {firstName ? (
              <>
                <span className="text-white/40">, </span>
                <span className="bg-gradient-to-r from-white via-white to-accent-200 bg-clip-text text-transparent">{firstName}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
            <Summary today={today} weekTotal={weekTotal} />
          </p>

          <div className="mt-auto grid grid-cols-3 gap-2.5 pt-7 sm:gap-3">
            <PriorityTile
              href="#bugun"
              label="Bugünkü Takip"
              caption={due === 0 ? "planlı takip yok" : dueCarry === 0 ? "bugün için planlı" : dueCarry === due ? "hepsi dünden kaldı" : `${dueCarry} tanesi dünden kaldı`}
              value={due}
              icon={<CalendarClock className="h-4 w-4" />}
              tone="accent"
              index={0}
            />
            <PriorityTile
              href="#yeni"
              label="Yeni Lead"
              caption={fresh > 0 ? "son 24 saatte geldi" : "yeni gelen yok"}
              value={fresh}
              icon={<Sparkles className="h-4 w-4" />}
              tone="success"
              index={1}
            />
            <PriorityTile
              href="#geciken"
              label="Geciken"
              caption={overdue > 0 ? "takibi 24 saati aştı" : "geciken yok"}
              value={overdue}
              icon={<AlertTriangle className="h-4 w-4" />}
              tone="danger"
              index={2}
            />
          </div>
        </div>

        <WeekChart days={week} />
      </div>
    </section>
  );
}

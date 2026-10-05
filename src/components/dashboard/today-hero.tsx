import { WeekChart } from "@/components/dashboard/week-chart";
import { LiveStamp } from "@/components/dashboard/live-stamp";
import { cn, formatCurrency } from "@/lib/utils";
import type { DashboardToday } from "@/lib/data/dashboard";
import type { WeekDay } from "@/components/dashboard/view-model";

type Tone = "accent" | "danger" | "success";

/** Sayi rengi + sol kenar cizgisi; deger 0 ise kutu notr kalir (dikkat cekmez). */
const TONE: Record<Tone, { value: string; bar: string }> = {
  accent: { value: "text-accent-300", bar: "bg-accent-500" },
  danger: { value: "text-[#ff9f8a]", bar: "bg-danger-500" },
  success: { value: "text-[#8ef0b8]", bar: "bg-success-500" },
};

/** Tek bir ozet sayisi. Bilerek link DEGIL: ilgili listenin tek girisi, asagidaki kartin "Tümünü gör"udur. */
function Stat({ label, value, caption, tone }: { label: string; value: React.ReactNode; caption: string; tone: Tone }) {
  const active = value !== 0;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 sm:px-5 sm:py-4">
      {active ? <span aria-hidden="true" className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", TONE[tone].bar)} /> : null}
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p className={cn("mt-2 text-[2rem] font-semibold tabular-nums leading-none tracking-tight sm:text-[2.5rem]", active ? TONE[tone].value : "text-white/30")}>
        {value}
      </p>
      <p className="mt-2 text-xs text-white/45">{caption}</p>
    </div>
  );
}

/**
 * "Bugun" ekraninin ust paneli - SADE (spec 2026-10-05: "çorbaya benziyor,
 * basitleştir"). Tek sakin zemin; selamlama + bugunun uc sayisi + bu ayin iki
 * para rakami + onumuzdeki 7 gun. Eskiden burada ayni bilgi dort kez vardi
 * (ozet cumlesi, tiklanabilir kutular, liste basliklarindaki sayilar, noktali
 * teknik arka plan) ve ayni listeye uc ayri baglanti gidiyordu; simdi sayilar
 * yalnizca burada, baglanti yalnizca ilgili listenin basliginda.
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
  const { month, stats } = today;

  return (
    <section
      className="animate-fade-in relative isolate overflow-hidden rounded-3xl ring-1 ring-inset ring-white/10"
      style={{ background: "linear-gradient(140deg, #123057 0%, #0c2140 48%, #081729 100%)" }}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-56 h-[460px] w-[460px] rounded-full"
        style={{ background: "radial-gradient(closest-side, rgba(244,124,32,0.13), transparent)" }}
      />
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent" />

      <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{dateLabel}</p>
            <LiveStamp timeLabel={timeLabel} pending={refreshing} onRefresh={onRefresh} />
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-[2.5rem] sm:leading-[1.1]">
            {greeting}
            {firstName ? (
              <>
                , <span className="capitalize">{firstName}</span>
              </>
            ) : null}
          </h1>

          <div className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-3">
            <Stat
              label="Bugünkü takip"
              value={due}
              caption={due === 0 ? "planlı takip yok" : dueCarry === 0 ? "bugün için planlı" : dueCarry === due ? "hepsi dünden kaldı" : `${dueCarry} tanesi dünden kaldı`}
              tone="accent"
            />
            <Stat label="Geciken" value={overdue} caption={overdue > 0 ? "takibi 24 saati aştı" : "geciken yok"} tone="danger" />
            <Stat label="Yeni lead" value={fresh} caption={fresh > 0 ? "son 24 saatte geldi" : "yeni gelen yok"} tone="success" />
          </div>

          {/* Bu ayin iki para rakami - eskiden ayri, kalabalik "Satış Hattı" kartindaydi. */}
          <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-1 pt-6 text-sm">
            <div>
              <dt className="text-xs text-white/45">Bu ay satış</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-[#8ef0b8]">
                {formatCurrency(month.revenue)}
                <span className="ml-2 text-xs font-normal text-white/45">
                  {month.salesCount > 0 ? `${month.salesCount.toLocaleString("tr-TR")} satış` : "henüz satış yok"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-white/45">Açık tekliflerin toplamı</dt>
              <dd className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-white">{formatCurrency(stats.pipelineValue)}</dd>
            </div>
          </dl>
        </div>

        <WeekChart days={week} />
      </div>
    </section>
  );
}

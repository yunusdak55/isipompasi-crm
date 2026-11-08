import { WeekChart } from "@/components/dashboard/week-chart";
import { LiveStamp } from "@/components/dashboard/live-stamp";
import { RiseNumber } from "@/components/ui/rise-number";
import { cn, formatCurrency } from "@/lib/utils";
import type { DashboardToday } from "@/lib/data/dashboard";
import type { WeekDay } from "@/components/dashboard/view-model";

type Tone = "accent" | "danger" | "success";

/** Sayi rengi + sol kenar cizgisi; deger 0 ise kutu notr kalir (dikkat cekmez). */
const TONE: Record<Tone, { value: string; bar: string }> = {
  accent: { value: "text-[var(--accent-text)]", bar: "bg-[linear-gradient(180deg,var(--accent-hi),var(--accent-lo))] shadow-[0_0_12px_rgba(255,171,92,0.7)]" },
  danger: { value: "text-[var(--danger)]", bar: "bg-[var(--danger-solid)] shadow-[0_0_12px_rgba(217,85,63,0.6)]" },
  success: { value: "text-[var(--ok)]", bar: "bg-[var(--ok-solid)] shadow-[0_0_12px_rgba(52,165,107,0.6)]" },
};

/**
 * Kartin gok tonu, verinin okundugu saate gore (timeLabel "13:42"): safak,
 * gunduz, aksam, gece. Selamlamayla ayni ritim; yeni veri yok.
 */
function skyFor(timeLabel: string): "dawn" | "day" | "dusk" | "night" {
  const h = Number(/(\d{1,2}):\d{2}/.exec(timeLabel)?.[1] ?? 12);
  if (h >= 5 && h < 9) return "dawn";
  if (h >= 9 && h < 17) return "day";
  if (h >= 17 && h < 20) return "dusk";
  return "night";
}

/** Tek bir ozet sayisi. Bilerek link DEGIL: ilgili listenin tek girisi, asagidaki kartin "Tümünü gör"udur. */
function Stat({ label, value, caption, tone, index }: { label: string; value: number; caption: string; tone: Tone; index: number }) {
  const active = value !== 0;
  return (
    <div className="rise relative overflow-hidden rounded-2xl border border-[var(--card-line)] bg-[var(--card-bg-2)] px-4 py-3.5 shadow-[inset_0_1px_0_rgba(214,232,255,0.06)] sm:px-5 sm:py-4" style={{ "--i": index + 2 } as React.CSSProperties}>
      {active ? <span aria-hidden="true" className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", TONE[tone].bar)} /> : null}
      <p className="ik-eyebrow !text-[10.5px] !tracking-[0.14em]">{label}</p>
      {active && tone === "danger" ? <span aria-hidden="true" className="ik-alert-pulse" /> : null}
      <p className={cn("relative mt-2 font-display text-[2rem] font-semibold tabular-nums leading-none tracking-[-0.03em] sm:text-[2.6rem]", active ? TONE[tone].value : "text-[var(--text-4)]")}>
        <RiseNumber value={value} delayMs={260 + index * 90} />
      </p>
      <p className="mt-2 text-xs text-[var(--text-3)]">{caption}</p>
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
    <section className="ik-card ik-hero rise relative isolate overflow-hidden !rounded-[26px]" data-sky={skyFor(timeLabel)}>
      {/* giris ekranindaki evin bulanik bir dilimi: giristen panele sureklilik */}
      <span aria-hidden="true" className="ik-hero-scene" />
      {/* sicak (sag ust) ve soguk (sol alt) iki isik: kartin icinde de ayni termal hikaye */}
      <span aria-hidden="true" className="ik-hero-warm" />
      <span aria-hidden="true" className="ik-hero-cool" />

      <div className="relative grid grid-cols-1 gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        <div className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="ik-eyebrow !tracking-[0.2em]">{dateLabel}</p>
            <LiveStamp timeLabel={timeLabel} pending={refreshing} onRefresh={onRefresh} />
          </div>

          <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.035em] text-[var(--text)] sm:text-[2.6rem] sm:leading-[1.1]">
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
              index={0}
            />
            <Stat label="Geciken" value={overdue} caption={overdue > 0 ? "takibi 24 saati aştı" : "geciken yok"} tone="danger" index={1} />
            <Stat label="Yeni lead" value={fresh} caption={fresh > 0 ? "son 24 saatte geldi" : "yeni gelen yok"} tone="success" index={2} />
          </div>

          {/* Bu ayin iki para rakami - eskiden ayri, kalabalik "Satış Hattı" kartindaydi. */}
          <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-1 pt-6 text-sm">
            <div>
              <dt className="text-xs text-[var(--text-3)]">Bu ay satış</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums tracking-[-0.02em] text-[var(--ok)]">
                <RiseNumber value={formatCurrency(month.revenue)} delayMs={520} />
                <span className="ml-2 font-sans text-xs font-normal text-[var(--text-3)]">
                  {month.salesCount > 0 ? `${month.salesCount.toLocaleString("tr-TR")} satış` : "henüz satış yok"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--text-3)]">Açık tekliflerin toplamı</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold tabular-nums tracking-[-0.02em] text-[var(--text)]">
                <RiseNumber value={formatCurrency(stats.pipelineValue)} delayMs={600} />
              </dd>
            </div>
          </dl>
        </div>

        <WeekChart days={week} />
      </div>
    </section>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getProspectsCalendar, getOpenProspectsForSelect } from "@/lib/data/prospects";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { ProspectAppointmentForm } from "@/components/admin/prospect-appointment-form";
import { ProspectCalendarGrid, type ProspectCalendarCell } from "@/components/admin/prospect-calendar-grid";
import type { AgencyProspect } from "@/lib/types/domain";

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function buildHref(year: number, month: number) {
  return `/admin/prospects/calendar?y=${year}&m=${month}`;
}

/** Pazartesi=0..Pazar=6 olacak sekilde JS'in Pazar=0 haftasini donusturur. */
function mondayIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

/**
 * Görüşme Takvimi - firmanın kendi müşteri takvimiyle (leads/calendar)
 * AYNI desen: gün hücresine tıklayınca o günün tam listesi modalda açılır
 * (spec: "firmanın kullandığı panele benzer... daha düzenli"). Saat de
 * anlamlı hale geldi (spec: "zaman dilimiyle beraber takip") - bkz.
 * ProspectCalendarGrid ve prospect-followup-form.tsx.
 */
export default async function ProspectsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const now = new Date();
  const year = params.y ? Number(params.y) : now.getFullYear();
  const month = params.m ? Number(params.m) : now.getMonth();

  const [prospects, selectable] = await Promise.all([
    getProspectsCalendar(year, month),
    getOpenProspectsForSelect(),
  ]);

  const byDay = new Map<number, AgencyProspect[]>();
  for (const p of prospects) {
    if (!p.next_followup_at) continue;
    const day = new Date(p.next_followup_at).getDate();
    const list = byDay.get(day) ?? [];
    list.push(p);
    byDay.set(day, list);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = mondayIndex(new Date(year, month, 1).getDay());
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  const cells: ProspectCalendarCell[] = Array.from({ length: totalCells }).map((_, i) => {
    const dayNum = i - firstWeekday + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
    return {
      dayNum,
      inMonth,
      isToday: inMonth && `${year}-${month}-${dayNum}` === todayKey,
      prospects: inMonth ? (byDay.get(dayNum) ?? []) : [],
    };
  });

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/prospects"
        className="group inline-flex w-fit items-center gap-1.5 text-sm text-ink-600 transition-colors duration-150 hover:text-ink-900"
      >
        <ChevronLeft className="h-4 w-4 transition-transform duration-150 ease-snappy group-hover:-translate-x-0.5" />
        Satış Görüşmeleri
      </Link>

      <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
        <HvacBackdrop intensity="ambient" />

        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-white">Görüşme Takvimi</h1>
              <p className="text-sm text-white/55">Saati planlanmış görüşmeler ay görünümünde - bir güne tıklayınca tam liste açılır.</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={buildHref(prevMonth.y, prevMonth.m)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-white transition-all duration-150 ease-snappy hover:border-white/25 hover:bg-white/[0.12] active:scale-95"
                aria-label="Önceki ay"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
              <span className="w-36 text-center text-sm font-medium text-white">
                {TR_MONTHS[month]} {year}
              </span>
              <Link
                href={buildHref(nextMonth.y, nextMonth.m)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] text-white transition-all duration-150 ease-snappy hover:border-white/25 hover:bg-white/[0.12] active:scale-95"
                aria-label="Sonraki ay"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <ProspectAppointmentForm prospects={selectable} />

          <ProspectCalendarGrid cells={cells} monthLabel={`${TR_MONTHS[month]} ${year}`} />

          {prospects.length === 0 ? (
            <p className="text-center text-sm text-white/40">Bu ay için planlanmış görüşme yok.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

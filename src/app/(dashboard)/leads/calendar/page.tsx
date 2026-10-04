import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getLeadsCalendar } from "@/lib/data/leads";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { AppointmentForm } from "@/components/leads/appointment-form";
import { CalendarGrid, type CalendarCell } from "@/components/leads/calendar-grid";
import type { LeadListItem } from "@/lib/data/leads";
import { daysInMonth, firstWeekdayOfMonth, parseYearMonth, partsTR } from "@/lib/time";

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

function buildHref(year: number, month: number) {
  return `/leads/calendar?y=${year}&m=${month}`;
}

/** Pazartesi=0..Pazar=6 olacak sekilde JS'in Pazar=0 haftasini donusturur. */
function mondayIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

export default async function LeadsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  // DUZELTME (denetim bulgusu, bkz. dashboard/page.tsx ayni aciklama).
  const profile = await requireProfile();
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  const params = await searchParams;
  const today = partsTR(new Date());
  const { year, month } = parseYearMonth(params.y, params.m, { year: today.year, month: today.month });

  const leads = await getLeadsCalendar(year, month);

  const byDay = new Map<number, LeadListItem[]>();
  for (const lead of leads) {
    if (!lead.next_followup_at) continue;
    const day = partsTR(new Date(lead.next_followup_at)).day;
    const list = byDay.get(day) ?? [];
    list.push(lead);
    byDay.set(day, list);
  }

  const totalDays = daysInMonth(year, month);
  const firstWeekday = mondayIndex(firstWeekdayOfMonth(year, month));
  const totalCells = Math.ceil((firstWeekday + totalDays) / 7) * 7;

  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  const todayKey = `${today.year}-${today.month}-${today.day}`;

  const cells: CalendarCell[] = Array.from({ length: totalCells }).map((_, i) => {
    const dayNum = i - firstWeekday + 1;
    const inMonth = dayNum >= 1 && dayNum <= totalDays;
    return {
      dayNum,
      inMonth,
      isToday: inMonth && `${year}-${month}-${dayNum}` === todayKey,
      leads: inMonth ? (byDay.get(dayNum) ?? []) : [],
    };
  });

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Takvim</h1>
            <p className="text-sm text-white/55">Takip tarihi olan leadler ay görünümünde. Takipler saat seçilmeden, o günün sabah 10:00&apos;una planlanır.</p>
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

        <AppointmentForm />

        <CalendarGrid cells={cells} monthLabel={`${TR_MONTHS[month]} ${year}`} />

        {leads.length === 0 ? (
          <p className="text-center text-sm text-white/40">Bu ay için planlanmış takip/keşif tarihi yok.</p>
        ) : null}
      </div>
    </div>
  );
}

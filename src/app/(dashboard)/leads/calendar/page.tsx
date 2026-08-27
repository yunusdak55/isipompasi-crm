import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getLeadsCalendar, getOpenLeadsForSelect } from "@/lib/data/leads";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { OverdueBadge } from "@/components/leads/lead-indicators";
import { AppointmentForm } from "@/components/leads/appointment-form";
import { isLeadOverdue } from "@/lib/utils";
import type { LeadListItem } from "@/lib/data/leads";

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

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
  const params = await searchParams;
  const now = new Date();
  const year = params.y ? Number(params.y) : now.getFullYear();
  const month = params.m ? Number(params.m) : now.getMonth();

  const [leads, selectableLeads] = await Promise.all([
    getLeadsCalendar(year, month),
    getOpenLeadsForSelect(),
  ]);

  const byDay = new Map<number, LeadListItem[]>();
  for (const lead of leads) {
    if (!lead.next_followup_at) continue;
    const day = new Date(lead.next_followup_at).getDate();
    const list = byDay.get(day) ?? [];
    list.push(lead);
    byDay.set(day, list);
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = mondayIndex(new Date(year, month, 1).getDay());
  const totalCells = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;

  const prevMonth = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const nextMonth = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };

  const todayKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Takvim</h1>
            <p className="text-sm text-white/55">Takip tarihi olan (keşif/randevu) leadler ay görünümünde.</p>
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

        <AppointmentForm leads={selectableLeads} />

        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-white/40">
          {TR_WEEKDAYS.map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {Array.from({ length: totalCells }).map((_, i) => {
            const dayNum = i - firstWeekday + 1;
            const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
            const dayLeads = inMonth ? (byDay.get(dayNum) ?? []) : [];
            const isToday = inMonth && `${year}-${month}-${dayNum}` === todayKey;

            return (
              <div
                key={i}
                className={
                  "flex min-h-[92px] flex-col gap-1 rounded-lg border p-1.5 " +
                  (inMonth ? "border-white/10 bg-white/[0.03]" : "border-transparent")
                }
              >
                {inMonth ? (
                  <>
                    <span
                      className={
                        "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium " +
                        (isToday ? "bg-accent-500 text-white" : "text-white/50")
                      }
                    >
                      {dayNum}
                    </span>
                    <div className="flex flex-col gap-1">
                      {dayLeads.slice(0, 3).map((lead) => {
                        const overdue = isLeadOverdue({
                          status: lead.status,
                          lastContactAt: lead.last_contact_at,
                          createdAt: lead.created_at,
                          nextFollowupAt: lead.next_followup_at,
                        });
                        return (
                          <Link
                            key={lead.id}
                            href={`/leads/${lead.id}`}
                            className="truncate rounded border border-accent-500/25 bg-accent-500/[0.12] px-1.5 py-0.5 text-[11px] font-medium text-accent-200 transition-colors hover:bg-accent-500/[0.2]"
                          >
                            {overdue ? <OverdueBadge className="mr-1 px-1 py-0 text-[8px]" /> : null}
                            {lead.first_name} {lead.last_name ?? ""}
                          </Link>
                        );
                      })}
                      {dayLeads.length > 3 ? (
                        <span className="px-1.5 text-[10px] text-white/40">+{dayLeads.length - 3} daha</span>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            );
          })}
        </div>

        {leads.length === 0 ? (
          <p className="text-center text-sm text-white/40">Bu ay için planlanmış takip/keşif tarihi yok.</p>
        ) : null}
      </div>
    </div>
  );
}

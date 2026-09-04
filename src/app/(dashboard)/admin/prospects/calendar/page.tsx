import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getProspectsCalendar, getOpenProspectsForSelect } from "@/lib/data/prospects";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { OverdueBadge } from "@/components/leads/lead-indicators";
import { ProspectAppointmentForm } from "@/components/admin/prospect-appointment-form";
import { isLeadOverdue } from "@/lib/utils";
import type { AgencyProspect } from "@/lib/types/domain";

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];
const TR_WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const TIME_FORMATTER = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

function buildHref(year: number, month: number) {
  return `/admin/prospects/calendar?y=${year}&m=${month}`;
}

/** Pazartesi=0..Pazar=6 olacak sekilde JS'in Pazar=0 haftasini donusturur. */
function mondayIndex(jsDay: number) {
  return (jsDay + 6) % 7;
}

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
              <p className="text-sm text-white/55">Takip tarihi planlanmış müşteri adayları ay görünümünde.</p>
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

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-white/40">
            {TR_WEEKDAYS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: totalCells }).map((_, i) => {
              const dayNum = i - firstWeekday + 1;
              const inMonth = dayNum >= 1 && dayNum <= daysInMonth;
              const dayItems = inMonth ? (byDay.get(dayNum) ?? []) : [];
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
                        {dayItems.slice(0, 3).map((p) => {
                          const overdue = isLeadOverdue({
                            status: p.status,
                            lastContactAt: p.last_contact_at,
                            createdAt: p.created_at,
                            nextFollowupAt: p.next_followup_at,
                          });
                          return (
                            <span
                              key={p.id}
                              className="truncate rounded border border-accent-500/25 bg-accent-500/[0.12] px-1.5 py-0.5 text-[11px] font-medium text-accent-200"
                              title={`${TIME_FORMATTER.format(new Date(p.next_followup_at as string))} — ${p.company_name}`}
                            >
                              {overdue ? <OverdueBadge className="mr-1 px-1 py-0 text-[8px]" /> : null}
                              <span className="text-accent-100/80">{TIME_FORMATTER.format(new Date(p.next_followup_at as string))}</span>{" "}
                              {p.company_name}
                            </span>
                          );
                        })}
                        {dayItems.length > 3 ? (
                          <span className="px-1.5 text-[10px] text-white/40">+{dayItems.length - 3} daha</span>
                        ) : null}
                      </div>
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>

          {prospects.length === 0 ? (
            <p className="text-center text-sm text-white/40">Bu ay için planlanmış takip tarihi yok.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

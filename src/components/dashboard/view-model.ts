import { DAY_MS, TR_TZ, startOfDayTR } from "@/lib/time";
import { formatCurrency, formatOverdueDays, formatRelativeDays, formatRelativeTimeAgo, leadDisplayName } from "@/lib/utils";
import type { DashboardToday, TodayLead } from "@/lib/data/dashboard";

/**
 * "Bugun" ekraninin gorunum modeli. TUM zaman/metin hesaplari SUNUCUDA yapilir
 * (sayfa dinamik server component): istemci saatine bagli hidrasyon
 * uyumsuzlugu olmaz, bilesenler saf ve bagimsiz kalir.
 */

export type ChipTone = "accent" | "warning" | "danger" | "success";

export type TaskItem = {
  id: string;
  name: string;
  /** "İstanbul · 5300004460 · Teklif ₺138.178" */
  sub: string;
  href: string;
  chip: { text: string; tone: ChipTone };
  /** Ajanda satirlarinda sol saat kolonu ("14:30"). */
  clock?: string;
};

export type WeekDay = {
  /** "Bugün" / "Yarın" / "Çar" */
  label: string;
  /** Tam gun adi ("Cuma"). */
  weekdayLong: string;
  /** Ayin gunu ("8"). */
  dayNumber: string;
  /** Ekran okuyucu / ipucu icin tam ifade: "8 Ekim Çarşamba". */
  full: string;
  count: number;
  /** Bugun sutununda: sayinin icindeki "dunden kalan" takip sayisi (ipucu/dipnot icin). */
  carry: number;
  isToday: boolean;
  weekend: boolean;
};

const clockFormatter = new Intl.DateTimeFormat("tr-TR", { timeZone: TR_TZ, hour: "2-digit", minute: "2-digit" });
const dateParts = new Intl.DateTimeFormat("tr-TR", { timeZone: TR_TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortWeekday = new Intl.DateTimeFormat("tr-TR", { timeZone: TR_TZ, weekday: "short" });
const longWeekday = new Intl.DateTimeFormat("tr-TR", { timeZone: TR_TZ, weekday: "long" });
const fullDay = new Intl.DateTimeFormat("tr-TR", { timeZone: TR_TZ, day: "numeric", month: "long", weekday: "long" });
const dayNumber = new Intl.DateTimeFormat("tr-TR", { timeZone: TR_TZ, day: "numeric" });
const weekdayIndex = new Intl.DateTimeFormat("en-US", { timeZone: TR_TZ, weekday: "short" });
const hourFormatter = new Intl.DateTimeFormat("en-GB", { timeZone: TR_TZ, hour: "2-digit", hourCycle: "h23" });

export function formatClock(iso: string): string {
  return clockFormatter.format(new Date(iso));
}

/** "Pazar · 4 Ekim 2026" (Turkiye saatine gore). */
export function formatTodayLabel(now: Date): string {
  const parts = Object.fromEntries(dateParts.formatToParts(now).map((p) => [p.type, p.value]));
  return `${parts.weekday} · ${parts.day} ${parts.month} ${parts.year}`;
}

export function greetingFor(now: Date): string {
  const hour = Number(hourFormatter.format(now));
  if (hour >= 5 && hour < 12) return "Günaydın";
  if (hour >= 12 && hour < 18) return "İyi günler";
  if (hour >= 18 && hour < 23) return "İyi akşamlar";
  return "İyi geceler";
}

/** Yeni gelen lead icin dakika hassasiyetli "ne zaman geldi" ("12 dk önce"). */
function formatArrival(iso: string, nowMs: number): string {
  const minutes = Math.floor((nowMs - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "Az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  return formatRelativeTimeAgo(iso) ?? "";
}

function subLine(lead: TodayLead): string {
  const parts: string[] = [];
  if (lead.city) parts.push(lead.city);
  parts.push(lead.phone);
  if (lead.offered_amount) parts.push(`Teklif ${formatCurrency(lead.offered_amount)}`);
  return parts.join(" · ");
}

function baseItem(lead: TodayLead): Omit<TaskItem, "chip"> {
  return { id: lead.id, name: leadDisplayName(lead), sub: subLine(lead), href: `/leads/${lead.id}` };
}

/** Onumuzdeki 7 gun (bugun dahil): etiketler Turkiye takvimine gore. */
function buildWeek(counts: number[], carry: number, now: Date): WeekDay[] {
  const start = startOfDayTR(now).getTime();
  return counts.map((count, i) => {
    // Gun ortasi (12:00 TR) - saat dilimi kaymalarindan etkilenmeyen guvenli ornek an.
    const sample = new Date(start + i * DAY_MS + 12 * 60 * 60 * 1000);
    const wd = weekdayIndex.format(sample);
    return {
      label: i === 0 ? "Bugün" : i === 1 ? "Yarın" : shortWeekday.format(sample),
      weekdayLong: longWeekday.format(sample),
      dayNumber: dayNumber.format(sample),
      full: fullDay.format(sample),
      count,
      carry: i === 0 ? carry : 0,
      isToday: i === 0,
      weekend: wd === "Sat" || wd === "Sun",
    };
  });
}

export type TodayView = {
  due: TaskItem[];
  overdue: TaskItem[];
  fresh: TaskItem[];
  week: WeekDay[];
};

export function buildTodayView(today: DashboardToday, now: Date = new Date()): TodayView {
  const nowMs = now.getTime();

  const due = today.due.map((lead): TaskItem => {
    const at = lead.next_followup_at as string;
    const base = { ...baseItem(lead), clock: formatClock(at) };
    if (new Date(at).getTime() > nowMs) return { ...base, chip: { text: "Bugün", tone: "accent" } };
    // Saati gecmis ama henuz "geciken" sayilmayan (24 saat dolmamis) takip:
    // dunku ise "Dün" yazilir, bugunku ise saati gectigi belirtilir.
    return { ...base, chip: { text: formatRelativeDays(at) === "Dün" ? "Dün" : "Saati geçti", tone: "warning" } };
  });

  const overdue = today.overdue.map(
    (lead): TaskItem => ({
      ...baseItem(lead),
      chip: { text: formatOverdueDays(lead.next_followup_at, nowMs) ?? "Gecikti", tone: "danger" },
    })
  );

  const fresh = today.fresh.map(
    (lead): TaskItem => ({ ...baseItem(lead), chip: { text: formatArrival(lead.created_at, nowMs), tone: "success" } })
  );

  return { due, overdue, fresh, week: buildWeek(today.week, today.counts.dueCarry, now) };
}

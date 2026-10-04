import { DAY_MS, TR_TZ, followupDateTR, startOfDayTR } from "@/lib/time";
import { formatRelativeDays } from "@/lib/utils";

/** Takip icin en fazla 10 yil sonrasi (gecersiz tarih/asiri deger koruması). */
export const MAX_FOLLOWUP_DAYS = 3650;

/** "Kaç gün sonra?" girdisi -> tam sayi (0..MAX) ya da gecersizse/bossa null. */
export function parseFollowupDays(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const days = Number(trimmed);
  if (!Number.isFinite(days) || !Number.isInteger(days) || days < 0 || days > MAX_FOLLOWUP_DAYS) return null;
  return days;
}

/**
 * Gercek takip zamani: bugunden `days` gun sonrasinin 10:00'i (Turkiye saati).
 * ESKISINDE "0 gun sonra" bugunun 10:00'ina yaziliyordu - saat 10:00'u
 * gectiyse takip daha olusturulurken GECMISTE oluyordu. Artik bugun icin ve
 * 10:00 gectiyse, simdiden en az 30 dk sonraki ilk tam saate yazilir.
 */
export function resolveFollowupAt(days: number, now: Date = new Date()): Date {
  const planned = followupDateTR(days);
  if (planned.getTime() > now.getTime()) return planned;
  const HOUR = 60 * 60 * 1000;
  return new Date(Math.ceil((now.getTime() + 30 * 60 * 1000) / HOUR) * HOUR);
}

/**
 * TAKIP LISTELERI ICIN TEK SIRALAMA KURALI (spec 2026-10-04: "geciken
 * müşterilerin sıralaması gecikme gün sayısına göre olsun, 1 gün, 2, 5, 10...
 * en düşükten en büyüğe — en yenileri takibi kolay sağlansın, DİĞER YERLERDE
 * DE ÖYLE"). Takipte gibi hem gecmis hem gelecek tarihleri iceren listelerde:
 *   1) BUGUN takip edilecekler (saate gore, erkenden gece'ye)
 *   2) GECIKMISLER - en az geciken en ustte, en cok geciken en altta
 *   3) GELECEK takipler - en yakin tarih en ustte
 * Eski kural ("simdiye mutlak uzaklik") gecmis ve gelecegi birbirine
 * karistiriyordu (1 gun gecikmis ile 1 gun sonrasi yan yana).
 */
export function sortByFollowupUrgency<T>(items: T[], getAt: (item: T) => string, now: Date = new Date()): T[] {
  const dayStart = startOfDayTR(now).getTime();
  const dayEnd = dayStart + DAY_MS;
  const rank = (t: number) => (t >= dayStart && t < dayEnd ? 0 : t < dayStart ? 1 : 2);

  return [...items].sort((a, b) => {
    const ta = new Date(getAt(a)).getTime();
    const tb = new Date(getAt(b)).getTime();
    const ra = rank(ta);
    const rb = rank(tb);
    if (ra !== rb) return ra - rb;
    // Gecmis grup: tarihi buyuk (= daha az gecikmis) olan once.
    return ra === 1 ? tb - ta : ta - tb;
  });
}

const followupDateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatFollowupDate(value: string | Date): string {
  return followupDateFormatter.format(typeof value === "string" ? new Date(value) : value);
}

export type FollowupTone = "none" | "today" | "upcoming" | "grace" | "overdue";

export type FollowupSummary = {
  tone: FollowupTone;
  /** "Salı 6 Ekim 10:00" */
  dateText: string | null;
  /** "3 gün sonra" / "Bugün" / "5 saat gecikti" ... */
  relativeText: string | null;
};

/**
 * Takip durumunun SUNUCUDA hesaplanan ozeti (istemci Date.now() ile
 * hidrasyon uyumsuzlugu olmasin diye metinler sayfada uretilip karta prop
 * olarak gecirilir). `overdue`, isLeadOverdue/isProspectOverdue sonucudur
 * (24 saat kurali) - "grace": takip zamani gecti ama 24 saat dolmadi.
 */
export function describeFollowup(
  nextFollowupAt: string | null,
  overdue: boolean,
  now: Date = new Date()
): FollowupSummary {
  if (!nextFollowupAt) return { tone: "none", dateText: null, relativeText: null };

  const at = new Date(nextFollowupAt);
  const diffMs = at.getTime() - now.getTime();
  const dateText = formatFollowupDate(at);

  if (overdue) {
    const hoursLate = Math.max(1, Math.floor(-diffMs / (60 * 60 * 1000)));
    const relativeText = hoursLate < 48 ? `${hoursLate} saattir gecikmiş` : `${Math.floor(hoursLate / 24)} gündür gecikmiş`;
    return { tone: "overdue", dateText, relativeText };
  }
  if (diffMs <= 0) {
    return { tone: "grace", dateText, relativeText: "Takip zamanı geçti — 24 saat içinde dönüş yapın" };
  }
  const rel = formatRelativeDays(nextFollowupAt);
  return { tone: rel === "Bugün" ? "today" : "upcoming", dateText, relativeText: rel };
}

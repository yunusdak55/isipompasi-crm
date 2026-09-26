/**
 * TURKIYE SAATI (Europe/Istanbul) YARDIMCILARI - sunucu VE istemcide ayni sonucu verir.
 *
 * NEDEN: Uygulama Turkiye'deki firmalar icin; ama sunucu (Hostinger/Node) genelde UTC
 * calisir. `new Date().setHours(0,0,0,0)`, `getDate()`, `toLocaleDateString()` gibi
 * "yerel saat" cagrilari sunucuda UTC'ye gore hesaplanir: "bugun"un siniri 03:00'e
 * kayar (gece 00:00-03:00 arasi dun sayilir), ay/gun kovalari 3 saat sapar, sunucuda
 * uretilen saatler 3 saat geri gorunur. Gelistirici makinesi Turkiye saatinde oldugu icin
 * bu hata YEREL'DE HIC GORUNMEZ. Tarih/gun sinirlari icin DAIMA bu modulu kullanin.
 *
 * Turkiye 2016'dan beri kalici UTC+3 (yaz saati uygulamasi yok) - sabit ofset guvenlidir.
 */
export const TR_TZ = "Europe/Istanbul";
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Verilen anin Turkiye takvim gununun BASLANGICI (00:00 TR) - mutlak zaman olarak. */
export function startOfDayTR(d: Date = new Date()): Date {
  return new Date(Math.floor((d.getTime() + TR_OFFSET_MS) / DAY_MS) * DAY_MS - TR_OFFSET_MS);
}

/** Verilen anin Turkiye takvim gununun SONU (23:59:59 TR). */
export function endOfDayTR(d: Date = new Date()): Date {
  return new Date(startOfDayTR(d).getTime() + DAY_MS - 1000);
}

/** Bugunden `days` gun sonrasinin Turkiye saatiyle `hour`:00'i (takip/randevu tarihi). */
export function followupDateTR(days: number, hour = 10): Date {
  return new Date(startOfDayTR().getTime() + days * DAY_MS + hour * 60 * 60 * 1000);
}

/** Turkiye takvimine gore yil / ay (0-11) / gun / haftanin gunu (0 = Pazar). */
export function partsTR(d: Date): { year: number; month: number; day: number; weekday: number } {
  const s = new Date(d.getTime() + TR_OFFSET_MS);
  return { year: s.getUTCFullYear(), month: s.getUTCMonth(), day: s.getUTCDate(), weekday: s.getUTCDay() };
}

/** Turkiye takvimine gore ayin ilk aninin (00:00 TR) mutlak zamani. month0: 0-11 (tasma gecerli). */
export function monthStartTR(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0, 1) - TR_OFFSET_MS);
}

/** (year, month0) + delta ay -> normalize edilmis {year, month}. */
export function shiftMonth(year: number, month0: number, delta: number): { year: number; month: number } {
  const total = year * 12 + month0 + delta;
  return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
}

/** Bir ayin gun sayisi (yil/ay takvim degeridir, saat diliminden bagimsiz). */
export function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Ayin ilk gununun haftanin gunu (0 = Pazar). */
export function firstWeekdayOfMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0, 1)).getUTCDay();
}

/** URL'den gelen ?y=&m= degerlerini guvenli araliga oturtur (gecersizse verilen varsayilan). */
export function parseYearMonth(y: string | undefined, m: string | undefined, fallback: { year: number; month: number }) {
  const year = Number(y);
  const month = Number(m);
  return {
    year: Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : fallback.year,
    month: Number.isInteger(month) && month >= 0 && month <= 11 ? month : fallback.month,
  };
}

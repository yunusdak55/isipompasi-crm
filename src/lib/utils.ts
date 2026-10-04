import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { DAY_MS, TR_TZ, startOfDayTR } from "@/lib/time";

/** Tailwind class isimlerini guvenle birlestirir (cakisan utility'leri cozer). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return currencyFormatter.format(value);
}

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TZ, // sunucu UTC olsa da Turkiye saati gosterilir (bkz. lib/time.ts)
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TR_TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

export function formatRelativeDays(value: string | null | undefined) {
  if (!value) return null;
  const diffMs = startOfDayTR(new Date(value)).getTime() - startOfDayTR().getTime();
  const diffDays = Math.round(diffMs / DAY_MS);

  if (diffDays === 0) return "Bugün";
  if (diffDays === 1) return "Yarın";
  if (diffDays > 1) return `${diffDays} gün sonra`;

  // GECMIS: 24 saati asmis takip "N gün gecikti" - Gecikenler ekraniyla AYNI
  // sayi (overdueDaysCount tek kaynak; eskiden takvim gunu farki kullaniliyordu,
  // "2 gün gecikti" ile "1 gün gecikti" ayni kisi icin farkli ekranlarda
  // gorunebiliyordu). Henuz 24 saat dolmamis dunku takip "Dün" kalir.
  if (Date.now() - new Date(value).getTime() > FOLLOWUP_OVERDUE_HOURS * 60 * 60 * 1000) {
    return formatOverdueDays(value);
  }
  return "Dün";
}

/**
 * Yuzde gosterimi: cok kucuk ama SIFIR OLMAYAN oranlar "%0.0" olarak
 * yuvarlanip "hic satis yok" gibi okunmasin (5.000 lead'de 1 satis = %0.02).
 * 0 -> "%0.0", >= 0.1 -> bir ondalik, 0.01..0.1 -> iki ondalik, daha kucuk -> "<%0.01".
 */
export function formatRate(rate: number): string {
  if (!Number.isFinite(rate) || rate <= 0) return "%0.0";
  if (rate >= 0.1) return `%${rate.toFixed(1)}`;
  if (rate >= 0.01) return `%${rate.toFixed(2)}`;
  return "<%0.01";
}

/**
 * Kac GUN gecikti? (takip tarihinden bu yana gecen TAM gun sayisi). Gecikmis
 * listesindeki siralamanin ve "N gün gecikti" yazisinin TEK kaynagi - ikisi de
 * ayni sayidan turedigi icin liste ile yazi birbirini yalanlamaz. Gecikmis
 * sayilmak icin 24 saat gecmesi gerekir (en az "1 gün"); henuz gecikmemisse
 * (gelecek ya da 24 saat dolmamis) null doner.
 */
export function overdueDaysCount(value: string | null | undefined, now: number = Date.now()): number | null {
  if (!value) return null;
  const lateMs = now - new Date(value).getTime();
  if (lateMs <= FOLLOWUP_OVERDUE_HOURS * 60 * 60 * 1000) return null;
  return Math.max(1, Math.floor(lateMs / DAY_MS));
}

/** "1 gün gecikti" / "12 gün gecikti" - bkz. overdueDaysCount. */
export function formatOverdueDays(value: string | null | undefined, now: number = Date.now()): string | null {
  const days = overdueDaysCount(value, now);
  return days === null ? null : `${days} gün gecikti`;
}

/** Gecmise donuk saat/gun hassasiyetli goreli zaman ("3 saat önce", "2 gün önce"). */
export function formatRelativeTimeAgo(value: string | null | undefined) {
  if (!value) return null;
  const diffHours = (Date.now() - new Date(value).getTime()) / (1000 * 60 * 60);
  if (diffHours < 1) return "Az önce";
  if (diffHours < 24) return `${Math.floor(diffHours)} saat önce`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Dün";
  return `${diffDays} gün önce`;
}

/**
 * "Gecikmis" esigi (spec 2026-10-02, kelimesi kelimesine: "gecikmiş YALNIZCA
 * TAKİBE ALINAN MÜŞTERİLERİN TAKİP TARİHİNİN 24 SAAT GECİKMESİNDEN SONRA
 * söylensin" - chatbot dahil her yerde). Eski "24 saattir hic aranmamis lead
 * = gecikmis" kurali KALDIRILDI: takibe alinmamis bir lead asla gecikmis degildir.
 */
export const FOLLOWUP_OVERDUE_HOURS = 24;

/**
 * "Yeni" esigi (spec 2026-10-04: "bir lead 24 saate kadar yeni sayılsın"; "arayıp
 * aramadığını nerden bileceksin"). Eski kural (durum='new' = "henuz aranmadi")
 * bir VARSAYIMDI - gercekte aranip aranmadigi bilinemez. Artik yeni = SADECE
 * olusturulma zamani: lead kapanmadiysa ilk 24 saat boyunca yenidir.
 */
export const NEW_LEAD_HOURS = 24;

/**
 * "Yeni Lead" gostergesi - kapanmamis (satis/kayip degil), son NEW_LEAD_HOURS
 * (24) saatte olusturulmus VE gecikmemis. Dashboard'daki "Yeni" sayisi/listesi
 * (migration 0032 dashboard_today) AYNI kurali SQL'de uygular.
 */
export function isLeadNew(params: Parameters<typeof isLeadOverdue>[0]) {
  if (params.status === "won" || params.status === "lost") return false;
  if (Date.now() - new Date(params.createdAt).getTime() > NEW_LEAD_HOURS * 60 * 60 * 1000) return false;
  return !isLeadOverdue(params);
}

/**
 * "Gecikmis Lead" gostergesi - TEK, net kural: lead TAKIBE ALINMIS olmali
 * (next_followup_at dolu, durum satis/kayip degil) VE takip tarihinin
 * uzerinden FOLLOWUP_OVERDUE_HOURS (24) saatten fazla gecmis olmali.
 * Istisna (onceki spec'ten korunan "gerekli guncellemeyi almazsa"): takip
 * zamanindan bu yana lead uzerinde herhangi bir aktivite (not, durum
 * degisikligi - bkz. last_activity_at ve onu guncelleyen trigger)
 * kaydedildiyse takip ISLENMIS sayilir, gecikmis degildir.
 */
export function isLeadOverdue(params: {
  status: string;
  lastContactAt: string | null;
  createdAt: string;
  nextFollowupAt?: string | null;
  lastActivityAt?: string | null;
}) {
  if (params.status === "won" || params.status === "lost") return false;
  if (!params.nextFollowupAt) return false;

  const followupAt = new Date(params.nextFollowupAt).getTime();
  if (Date.now() - followupAt <= FOLLOWUP_OVERDUE_HOURS * 60 * 60 * 1000) return false;

  const lastUpdate = new Date(params.lastActivityAt ?? params.createdAt).getTime();
  return lastUpdate < followupAt;
}

/**
 * Ajansin KENDI musteri adaylari (agency_prospects - admin/prospects) icin
 * "gecikmis" hesabi. Spec 2026-10-02: firma paneli ve chatbot ile AYNI kural -
 * yalnizca takibe alinmis (next_followup_at dolu, kapanmamis) aday, takip
 * tarihinin uzerinden 24 saatten fazla gectiyse gecikmistir (eski 48 saatlik
 * "hic aranmamis" ve gun-bazli kurallar kaldirildi). Aktivite istisnasi YOK:
 * adaylarda last_activity_at izleme kolonu bulunmuyor - "islendi" sayilmak icin
 * Gorusme Sonucu formundan yeni takip tarihi girilir ya da takip kaldirilir.
 */
export function isProspectOverdue(params: {
  status: string;
  lastContactAt: string | null;
  createdAt: string;
  nextFollowupAt?: string | null;
}) {
  if (params.status === "won" || params.status === "lost") return false;
  if (!params.nextFollowupAt) return false;
  return Date.now() - new Date(params.nextFollowupAt).getTime() > FOLLOWUP_OVERDUE_HOURS * 60 * 60 * 1000;
}

/**
 * Agent (WhatsApp) profil adini bulamazsa first_name/last_name bos
 * kalabilir (spec: "bu olmazsa boş bırakacak") - listelerde/kartlarda bos
 * bir isim yerine tutarli bir yer tutucu gosterir.
 */
export function leadDisplayName(lead: { first_name: string | null; last_name?: string | null }) {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim();
  return name || "İsimsiz Lead";
}

export function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase();
}

/**
 * TEK "Gorusen Kisi" kavrami (spec 2026-10-02: "Görüşen Kişi/Satış Personeli
 * iki kısım var, teke indir, Görüşen Kişi olsun sadece"): isim-bazli
 * Gorusen Kisi (contacted_by) varsa o, yoksa leade atanmis gercek hesabin
 * adi (assigned_salesperson - RLS icin korunur, bkz. 0016 aciklamasi).
 */
export function leadContactPerson(lead: {
  contacted_by_person?: { full_name: string | null } | null;
  assigned_profile?: { full_name: string | null } | null;
}): string | null {
  return lead.contacted_by_person?.full_name?.trim() || lead.assigned_profile?.full_name?.trim() || null;
}

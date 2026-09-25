import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

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
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

const dateTimeFormatter = new Intl.DateTimeFormat("tr-TR", {
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
  const target = new Date(value);
  const now = new Date();
  const diffMs = target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Bugün";
  if (diffDays === 1) return "Yarın";
  if (diffDays === -1) return "Dün";
  if (diffDays > 1) return `${diffDays} gün sonra`;
  return `${Math.abs(diffDays)} gün gecikti`;
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

/** "Hiç cevap verilmeyen" lead esigi (spec: "Gecikenler kısmı 24 saat boyunca dönüş yapılmayan leadler olarak güncellensin"). */
export const NO_CONTACT_OVERDUE_HOURS = 24;

/** Item: "Yeni Lead" gostergesi - status='new' zaten "henuz ilk temas kurulmadi" anlamina gelir. */
export function isLeadNew(status: string) {
  return status === "new";
}

/**
 * "Gecikmis Lead" gostergesi - IKI BAGIMSIZ tetikleyici (spec, kelimesi
 * kelimesine): (A) "hiç cevap verilmeyen leadler" - hic gercek temas
 * kurulmamis (last_contact_at bos) VE olusturulmasindan 24 saatten fazla
 * gecmis; (B) "takipteki görüşmeler eğer günü geldiğinde gerekli
 * güncellemeyi almazsa" - planli bir takip GUNU tamamen gecmis VE o gunden
 * beri lead uzerinde HICBIR aktivite (durum degisikligi DEGIL, "zaman
 * çizelgesindeki herhangi bir not bile durum değişikliği sayılır" - yani
 * activities tablosuna dusen HERHANGI bir kayit, bkz. last_activity_at ve
 * onu guncelleyen trigger) olmamis.
 *
 * Kontrastla: bir kez temas kurulmus (last_contact_at dolu) ama HENUZ bir
 * takip tarihi atanmamis lead artik "gecikmis" SAYILMAZ - spec'te bu ucuncu
 * bir tetikleyici olarak tanimlanmadi (eski 48-saatlik genel esik kaldirildi).
 */
export function isLeadOverdue(params: {
  status: string;
  lastContactAt: string | null;
  createdAt: string;
  nextFollowupAt?: string | null;
  lastActivityAt?: string | null;
}) {
  if (params.status === "won" || params.status === "lost") return false;

  // Kural A: hic cevap verilmemis.
  if (!params.lastContactAt) {
    const hoursSinceCreated = (Date.now() - new Date(params.createdAt).getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreated > NO_CONTACT_OVERDUE_HOURS) return true;
  }

  // Kural B: takip gunu tamamen gecti VE o gunden beri hicbir aktivite yok.
  if (params.nextFollowupAt) {
    const followupDayStart = new Date(params.nextFollowupAt);
    followupDayStart.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (followupDayStart.getTime() < todayStart.getTime()) {
      const lastUpdate = params.lastActivityAt ?? params.createdAt;
      if (new Date(lastUpdate).getTime() < followupDayStart.getTime()) return true;
    }
  }

  return false;
}

const PROSPECT_OVERDUE_HOURS = 48;

/**
 * Ajansin KENDI musteri adaylari (agency_prospects - admin/prospects) icin
 * "gecikmis" hesabi. BILEREK isLeadOverdue'dan AYRI: bu domain (ajansin yeni
 * musteri kazanmak icin aradigi firmalar) spec'teki "Gecikenler" degisikligi
 * kapsamina hic girmedi ve last_activity_at gibi bir aktivite-tabanli izleme
 * hic olmadi - eski (48 saat, last_contact_at??created_at) davranisi
 * degismeden burada korunur.
 */
export function isProspectOverdue(params: {
  status: string;
  lastContactAt: string | null;
  createdAt: string;
  nextFollowupAt?: string | null;
}) {
  if (params.status === "won" || params.status === "lost") return false;
  if (params.nextFollowupAt) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (new Date(params.nextFollowupAt).getTime() >= todayStart.getTime()) return false;
  }
  const reference = params.lastContactAt ?? params.createdAt;
  const hoursSince = (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60);
  return hoursSince > PROSPECT_OVERDUE_HOURS;
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

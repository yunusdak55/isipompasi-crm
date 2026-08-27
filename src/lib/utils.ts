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

export const OVERDUE_HOURS = 48;

/** Item: "Yeni Lead" gostergesi - status='new' zaten "henuz ilk temas kurulmadi" anlamina gelir. */
export function isLeadNew(status: string) {
  return status === "new";
}

/**
 * Item: "Gecikmis Lead" gostergesi. Musteriyle son gercek temas (last_contact_at;
 * hic temas yoksa lead'in olusturulma tarihi) uzerinden 48 saatten fazla gecmisse
 * ve lead hala aktifse (satis/kayip degilse) gecikmis sayilir.
 *
 * DUZELTME: eger lead'in ILERIDE (henuz gelmemis) planli bir takibi varsa artik
 * gecikmis sayilmiyor - bir sonraki arama zaten takvimde, "gecikmis" damgasi
 * yanlis alarm veriyordu (denetim raporu: 156 leadin %61'i bu yuzden gecikmis
 * gorunuyordu). Takip tarihinin KENDISI de gecmisse (planlanan aramayi da
 * kacirdiysa) bu istisna gecerli degil - o durumda hala gecikmis sayilir.
 */
export function isLeadOverdue(params: {
  status: string;
  lastContactAt: string | null;
  createdAt: string;
  nextFollowupAt?: string | null;
}) {
  if (params.status === "won" || params.status === "lost") return false;
  if (params.nextFollowupAt && new Date(params.nextFollowupAt).getTime() > Date.now()) return false;
  const reference = params.lastContactAt ?? params.createdAt;
  const hoursSince = (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60);
  return hoursSince > OVERDUE_HOURS;
}

export function getInitials(name: string | null | undefined) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : "";
  return (first + last).toUpperCase();
}

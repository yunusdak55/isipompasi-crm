import type { ProspectStatus } from "@/lib/types/domain";

/**
 * Ajansin kendi musteri adayi (yeni musteri kazanma) huniisi icin durum
 * sirasi/etiket/renk eslesmesi - leads.ts'teki LEAD_STATUS_* uclusuyle ayni
 * tasarim (kod anahtari ingilizce, arayuz Turkce). "Gorusuldu" durumu
 * kaldirildi (bkz. migration 0023): aranacak / takipte / musteri oldu / kayip.
 */
export const PROSPECT_STATUS_ORDER: ProspectStatus[] = ["new", "followup", "won", "lost"];

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "Aranacak",
  followup: "Takipte",
  won: "Müşteri Oldu",
  lost: "Kayıp",
};

export const PROSPECT_STATUS_COLOR: Record<ProspectStatus, string> = {
  new: "brand",
  followup: "warning",
  won: "success",
  lost: "danger",
};

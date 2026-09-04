import type { ProspectStatus } from "@/lib/types/domain";

/**
 * Ajansin kendi musteri adayi (yeni musteri kazanma) huniisi icin durum
 * sirasi/etiket/renk eslesmesi - leads.ts'teki LEAD_STATUS_* uclusuyle ayni
 * tasarim (kod anahtari ingilizce, arayuz Turkce).
 */
export const PROSPECT_STATUS_ORDER: ProspectStatus[] = ["new", "contacted", "followup", "won", "lost"];

export const PROSPECT_STATUS_LABELS: Record<ProspectStatus, string> = {
  new: "Aranacak",
  contacted: "Görüşüldü",
  followup: "Takipte",
  won: "Müşteri Oldu",
  lost: "Kayıp",
};

export const PROSPECT_STATUS_COLOR: Record<ProspectStatus, string> = {
  new: "brand",
  contacted: "accent",
  followup: "warning",
  won: "success",
  lost: "danger",
};

import type {
  LeadStatus,
  PropertyType,
  BuildingStatus,
  HeatingType,
  PurchaseTimeline,
  UserRole,
} from "@/lib/types/domain";

/**
 * Veritabaninda ingilizce anahtar (status='won' gibi) tutup, arayuzde
 * Turkce etiket gostermek icin merkezi eslesme tablosu.
 *
 * TASARIM KARARI: Kod/veri anahtarlari ingilizce, kullaniciya gosterilen
 * her sey Turkce. Boylece ileride coklu dil eklemek veya raporlama/entegrasyon
 * yaparken Turkce karakter (I/i, ş, ğ vb.) kaynakli sorunlarla ugrasilmaz.
 */

// Ana satis pipeline'i (sirali): Lead -> Arandi -> Kesif/Teklif -> Satis.
// "On Teklif" ve "Ulasilamadi" asamalari kaldirildi (spec: kullanicida
// gercek bir karsiligi olmadigi icin ayri tutulmuyor - bkz. migration
// 0006/0007). Takip/Kayip ana hat disinda, ayri (yan) durumlardir; ana
// hattan herhangi bir noktada bu ikisine gecilebilir.
export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "new",
  "called",
  "discovery_offer",
  "won",
  "followup",
  "lost",
];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Lead",
  called: "Arandı",
  discovery_offer: "Keşif/Teklif",
  won: "Satış",
  followup: "Takip",
  lost: "Kayıp",
};

/** Kanban/durum rozetlerinde kullanilacak renk tonu (bkz. globals.css @theme). */
export const LEAD_STATUS_COLOR: Record<LeadStatus, string> = {
  new: "brand",
  called: "brand",
  discovery_offer: "accent",
  won: "success",
  followup: "warning",
  lost: "danger",
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  villa: "Villa",
  detached_house: "Müstakil Ev",
  apartment: "Apartman Dairesi",
  workplace: "İş Yeri",
  factory: "Fabrika",
  hotel: "Otel",
  other: "Diğer",
};

export const BUILDING_STATUS_LABELS: Record<BuildingStatus, string> = {
  new_building: "Yeni Bina",
  existing_building: "Mevcut Bina",
  under_construction: "İnşaat Aşamasında",
  other: "Diğer",
};

export const HEATING_TYPE_LABELS: Record<HeatingType, string> = {
  combi_gas: "Kombi / Doğalgaz",
  solid_fuel: "Katı Yakıt",
  electric: "Elektrikli Sistem",
  air_conditioner: "Klima",
  central: "Merkezi Sistem",
  none: "Isıtma Yok",
  other: "Diğer",
};

export const PURCHASE_TIMELINE_LABELS: Record<PurchaseTimeline, string> = {
  immediate: "Hemen",
  "0_1_month": "0–1 Ay",
  "1_3_month": "1–3 Ay",
  "3_6_month": "3–6 Ay",
  "6_plus_month": "6+ Ay",
  undecided: "Kararsız",
};

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Ajans Admin",
  owner: "Firma Sahibi",
  sales: "Satış Personeli",
};

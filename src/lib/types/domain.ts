import type { Database } from "./database.types";

/**
 * Uygulama genelinde kullanilan, veritabani satirlarindan turetilmis
 * pratik alan (domain) tipleri. Bilesenler dogrudan Database["public"]...
 * yerine bu tipleri import etmelidir - okunabilirlik daha yuksek olur.
 */

export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type Activity = Database["public"]["Tables"]["activities"]["Row"];
export type Followup = Database["public"]["Tables"]["followups"]["Row"];
export type Sale = Database["public"]["Tables"]["sales"]["Row"];
export type Competitor = Database["public"]["Tables"]["competitors"]["Row"];
export type Integration = Database["public"]["Tables"]["integrations"]["Row"];
export type ProductCategory = Database["public"]["Tables"]["product_categories"]["Row"];

export type UserRole = Profile["role"];
export type LeadStatus = Lead["status"];
export type LeadPriority = Lead["priority"];
export type PropertyType = NonNullable<Lead["property_type"]>;
export type BuildingStatus = NonNullable<Lead["building_status"]>;
export type HeatingType = NonNullable<Lead["heating_type"]>;
export type PurchaseTimeline = NonNullable<Lead["purchase_timeline"]>;
export type ProductInterest = NonNullable<Lead["product_interest"]>;
export type IntegrationProvider = Integration["provider"];
export type IntegrationStatus = Integration["status"];

/** Dashboard ust kisimdaki durum sayaclari (spec md.7). */
export type PipelineStats = {
  status: LeadStatus;
  count: number;
};

export type DashboardStats = {
  totalLeads: number;
  byStatus: PipelineStats[];
  pipelineValue: number;
  leadChangePct: number | null;
  offerChangePct: number | null;
  saleChangePct: number | null;
};

import { createClient } from "@/lib/supabase/server";
import type { IntegrationProvider, IntegrationStatus } from "@/lib/types/domain";

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  "whatsapp",
  "meta_ads",
  "telegram",
  "google_analytics",
  "search_console",
];

/**
 * Ajans admin paneli icin firma bazinda ozet veri - sadece "admin" rolu
 * RLS geregi tum firmalarin satirlarini gorebildigi icin calisir (bkz.
 * 0002_rls_policies.sql, 'admin' her tabloda company_id filtresiz gorur).
 * Kucuk olcek (V1) icin gruplama JS tarafinda yapiliyor - reports.ts'teki
 * ayni yaklasim.
 */

export type AgencyCompanyStat = {
  id: string;
  name: string;
  city: string | null;
  isActive: boolean;
  leadCount: number;
  pipelineValue: number;
  totalSales: number;
  salesCount: number;
  conversionRate: number;
};

export async function getAgencyCompanyStats(): Promise<AgencyCompanyStat[]> {
  const supabase = await createClient();

  const [companiesRes, leadsRes, salesRes] = await Promise.all([
    supabase.from("companies").select("id, name, city, is_active").order("name"),
    supabase.from("leads").select("company_id, status, offered_amount"),
    supabase.from("sales").select("company_id, sale_amount"),
  ]);

  if (companiesRes.error || !companiesRes.data) {
    if (companiesRes.error) console.error("getAgencyCompanyStats companies error:", companiesRes.error.message);
    return [];
  }
  if (leadsRes.error) console.error("getAgencyCompanyStats leads error:", leadsRes.error.message);
  if (salesRes.error) console.error("getAgencyCompanyStats sales error:", salesRes.error.message);

  const leads = leadsRes.data ?? [];
  const sales = salesRes.data ?? [];

  return companiesRes.data.map((company) => {
    const companyLeads = leads.filter((l) => l.company_id === company.id);
    const companySales = sales.filter((s) => s.company_id === company.id);
    const pipelineValue = companyLeads
      .filter((l) => l.status !== "won" && l.status !== "lost")
      .reduce((sum, l) => sum + (l.offered_amount ?? 0), 0);
    const totalSales = companySales.reduce((sum, s) => sum + Number(s.sale_amount), 0);

    return {
      id: company.id,
      name: company.name,
      city: company.city,
      isActive: company.is_active,
      leadCount: companyLeads.length,
      pipelineValue,
      totalSales,
      salesCount: companySales.length,
      conversionRate: companyLeads.length > 0 ? (companySales.length / companyLeads.length) * 100 : 0,
    };
  });
}

export type CompanySelectItem = { id: string; name: string };

/** Kullanici olusturma formundaki firma secim dropdown'u icin. */
export async function getCompaniesForSelect(): Promise<CompanySelectItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("companies").select("id, name").order("name");
  if (error) {
    console.error("getCompaniesForSelect error:", error.message);
    return [];
  }
  return data ?? [];
}

export type AdminUserRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: "admin" | "owner" | "sales";
  isActive: boolean;
  companyName: string | null;
};

/** Ajans admin'in Kullanicilar sayfasi icin tum firmalardaki tum kullanicilar. */
export async function getAllUsersWithCompany(): Promise<AdminUserRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, company:companies(name)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllUsersWithCompany error:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as Array<{
    id: string;
    full_name: string | null;
    email: string | null;
    role: "admin" | "owner" | "sales";
    is_active: boolean;
    company: { name: string } | null;
  }>).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    companyName: row.company?.name ?? null,
  }));
}

export type CompanyIntegrationRow = {
  companyId: string;
  companyName: string;
  statuses: Record<IntegrationProvider, IntegrationStatus>;
};

/**
 * Entegrasyonlar sayfasi icin firma x saglayici durum matrisi. Her firma
 * icin 5 saglayicinin de bir durumu vardir - `integrations` tablosunda satiri
 * olmayan kombinasyonlar "disconnected" varsayilir (henuz hic dokunulmamis).
 */
export async function getIntegrationsGrid(): Promise<CompanyIntegrationRow[]> {
  const supabase = await createClient();

  const [companiesRes, integrationsRes] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("integrations").select("company_id, provider, status"),
  ]);

  if (companiesRes.error || !companiesRes.data) {
    if (companiesRes.error) console.error("getIntegrationsGrid companies error:", companiesRes.error.message);
    return [];
  }
  if (integrationsRes.error) console.error("getIntegrationsGrid integrations error:", integrationsRes.error.message);

  const integrations = integrationsRes.data ?? [];

  return companiesRes.data.map((company) => {
    const statuses = Object.fromEntries(
      INTEGRATION_PROVIDERS.map((provider) => {
        const row = integrations.find((i) => i.company_id === company.id && i.provider === provider);
        return [provider, row?.status ?? "disconnected"];
      })
    ) as Record<IntegrationProvider, IntegrationStatus>;

    return { companyId: company.id, companyName: company.name, statuses };
  });
}

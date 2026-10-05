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

  // PERF (jet hizi): eskiden tum firmalarin TUM lead/satis satirlari cekilip JS'te
  // gruplaniyordu. Simdi veritabani firma basina tek satir dondurur (migration
  // 0025, SECURITY INVOKER - RLS aynen gecerli).
  const { data, error } = await supabase.rpc("agency_company_stats");

  if (error || !data) {
    if (error) console.error("getAgencyCompanyStats error:", error.message);
    return [];
  }

  return data.map((row) => {
    const leadCount = Number(row.lead_count);
    const salesCount = Number(row.sales_count);
    return {
      id: row.id,
      name: row.name,
      city: row.city,
      isActive: row.is_active,
      leadCount,
      pipelineValue: Number(row.pipeline_value),
      totalSales: Number(row.total_sales),
      salesCount,
      conversionRate: leadCount > 0 ? (salesCount / leadCount) * 100 : 0,
    };
  });
}

export type CompanySelectItem = { id: string; name: string; leadCount: number };

/**
 * Kullanici olusturma formundaki firma secim dropdown'u icin. `leadCount`:
 * secilen firmaya eklenen kullanici o firmanin MEVCUT bu kadar lead'ini
 * gorecek (RLS firma bazli) - form bunu admin'e acikca soyler, boylece
 * "yeni hesap actim ama icinde leadler var" karisikligi yasanmaz.
 */
export async function getCompaniesForSelect(): Promise<CompanySelectItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("agency_company_stats");
  if (error || !data) {
    if (error) console.error("getCompaniesForSelect error:", error.message);
    return [];
  }
  return data.map((row) => ({ id: row.id, name: row.name, leadCount: Number(row.lead_count) }));
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

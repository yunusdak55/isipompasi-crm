import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/constants/lead";
import type { LeadStatus, PropertyType } from "@/lib/types/domain";

/**
 * Raporlar sayfasi icin genel analiz verileri - `leads` / `followups`
 * tablolarindan, satis/gelir metrikleri ise gercek `sales` tablosundan
 * (bkz. lib/data/sales.ts) turetilir - tek dogru kaynak.
 */

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

/** Ay kiyaslama araci icin genis (12 aylik) pencere - "Agustos ile Temmuz'u kiyasla" gibi secimler icin. */
function lastNMonthBuckets(n: number) {
  const now = new Date();
  const months: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: `${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }
  return months;
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export type ReportsData = {
  totalLeads: number;
  funnel: { status: LeadStatus; label: string; count: number }[];
  conversionRate: number;
  followupStats: { total: number; completed: number; pending: number; overdue: number };
  cityDistribution: { city: string; count: number }[];
  propertyTypeDistribution: { label: string; count: number }[];
  productInterestDistribution: { label: string; count: number }[];
  avgOfferAmount: number;
  avgSaleAmount: number;
  monthlyFunnel: MonthlyFunnelPoint[];
};

/** Ay bazinda huni kirilimi (spec: "bu ay kac lead geldi, kaci arandi, kaci kesif oldu, kaci satis oldu"). */
export type MonthlyFunnelPoint = {
  key: string;
  label: string;
  leadCount: number;
  calledCount: number;
  discoveryCount: number;
  wonCount: number;
};

export async function getReportsData(): Promise<ReportsData> {
  const supabase = await createClient();

  const [leadsRes, salesRes, followupsRes] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, status, city, property_type, offered_amount, created_at, product_category:product_categories(label)"
      ),
    supabase.from("sales").select("sale_amount, sale_date"),
    supabase.from("followups").select("is_completed, followup_date"),
  ]);

  if (leadsRes.error || !leadsRes.data) {
    if (leadsRes.error) console.error("getReportsData leads error:", leadsRes.error.message);
    return {
      totalLeads: 0,
      funnel: [],
      conversionRate: 0,
      followupStats: { total: 0, completed: 0, pending: 0, overdue: 0 },
      cityDistribution: [],
      propertyTypeDistribution: [],
      productInterestDistribution: [],
      avgOfferAmount: 0,
      avgSaleAmount: 0,
      monthlyFunnel: [],
    };
  }
  if (salesRes.error) console.error("getReportsData sales error:", salesRes.error.message);

  const leads = leadsRes.data;
  const sales = salesRes.data ?? [];

  // Funnel: pipeline sirasina gore durum sayaclari.
  const funnelMap = new Map<LeadStatus, number>();
  for (const lead of leads) {
    const status = lead.status as LeadStatus;
    funnelMap.set(status, (funnelMap.get(status) ?? 0) + 1);
  }
  const funnel = LEAD_STATUS_ORDER.map((status) => ({ status, label: LEAD_STATUS_LABELS[status], count: funnelMap.get(status) ?? 0 }));

  const conversionRate = leads.length > 0 ? (sales.length / leads.length) * 100 : 0;

  // Takip performansi.
  if (followupsRes.error) console.error("getReportsData followups error:", followupsRes.error.message);
  const followups = followupsRes.data ?? [];
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  for (const f of followups) {
    if (f.is_completed) {
      completed += 1;
    } else if (new Date(f.followup_date) < todayStart) {
      overdue += 1;
    } else {
      pending += 1;
    }
  }

  // Sehir dagilimi (en fazla 8).
  const cityCounts = new Map<string, number>();
  for (const lead of leads) {
    const city = lead.city?.trim() || "Belirtilmemiş";
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }
  const cityDistribution = [...cityCounts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Konut tipi dagilimi.
  const propertyCounts = new Map<string, number>();
  for (const lead of leads) {
    const label = lead.property_type ? PROPERTY_TYPE_LABELS[lead.property_type as PropertyType] : "Belirtilmemiş";
    propertyCounts.set(label, (propertyCounts.get(label) ?? 0) + 1);
  }
  const propertyTypeDistribution = [...propertyCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  // Urun ilgi dagilimi (spec: hem isi pompasi hem klima/VRF satan "iklimlendirme"
  // firmalari icin lead'leri urun bazinda ayirt edebilmek). Kategoriler artik
  // firmaya ozel (product_categories tablosu), sabit enum degil.
  const productCounts = new Map<string, number>();
  for (const lead of leads) {
    const label = lead.product_category?.label ?? "Belirtilmemiş";
    productCounts.set(label, (productCounts.get(label) ?? 0) + 1);
  }
  const productInterestDistribution = [...productCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const offersWithAmount = leads.filter((l) => l.offered_amount !== null);
  const avgOfferAmount =
    offersWithAmount.length > 0 ? offersWithAmount.reduce((sum, l) => sum + (l.offered_amount ?? 0), 0) / offersWithAmount.length : 0;

  const avgSaleAmount =
    sales.length > 0 ? sales.reduce((sum, s) => sum + Number(s.sale_amount), 0) / sales.length : 0;

  // Aylik huni: o ay olusturulan leadler, su anki durumlarina gore. Basit ve
  // dogrudan - "o ay gelenlerden kaci su an hangi asamada" (cohort-tarihi
  // aktivite izleme yerine, mevcut leads.status'u okuyan sade yaklasim).
  const monthlyFunnel: MonthlyFunnelPoint[] = lastNMonthBuckets(12).map((m) => {
    const monthLeads = leads.filter((l) => monthKey(l.created_at) === m.key);
    return {
      key: m.key,
      label: m.label,
      leadCount: monthLeads.length,
      calledCount: monthLeads.filter((l) => l.status === "called").length,
      discoveryCount: monthLeads.filter((l) => l.status === "discovery_offer").length,
      wonCount: monthLeads.filter((l) => l.status === "won").length,
    };
  });

  return {
    totalLeads: leads.length,
    funnel,
    conversionRate,
    followupStats: { total: followups.length, completed, pending, overdue },
    cityDistribution,
    propertyTypeDistribution,
    productInterestDistribution,
    avgOfferAmount,
    avgSaleAmount,
    monthlyFunnel,
  };
}

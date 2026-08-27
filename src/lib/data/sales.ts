import { createClient } from "@/lib/supabase/server";

/**
 * Satislar sayfasi icin gercek veriye dayali metrikler.
 *
 * Artik gercekten kullanilan `sales` tablosundan okunuyor - lead detay
 * sayfasindaki "Yapılan Satış" formu (bkz. sale-panel.tsx / upsertSaleAction)
 * buraya yaziyor. RLS geregi bu tablo sadece owner/admin icin gorunur ("ciro
 * hassas veri") - sales rolundeki bir kullanici bu sayfayi actiginda sorgu
 * bos donuyor (hata degil, sessizce filtreleniyor).
 */

const TR_MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export type SalesStats = {
  totalLeads: number;
  totalSales: number;
  totalRevenue: number;
  avgSaleValue: number;
  conversionRate: number;
  pipelineValue: number;
  monthlyTrend: { key: string; label: string; count: number; revenue: number }[];
  bySalesperson: { name: string; count: number; revenue: number }[];
  hasAnySale: boolean;
};

export async function getSalesStats(): Promise<SalesStats> {
  const supabase = await createClient();

  const [leadsRes, salesRes] = await Promise.all([
    supabase.from("leads").select("status, offered_amount"),
    supabase
      .from("sales")
      .select("sale_amount, sale_date, salesperson_profile:profiles!sales_salesperson_fkey(full_name)")
      .order("sale_date", { ascending: true }),
  ]);

  if (leadsRes.error || !leadsRes.data) {
    if (leadsRes.error) console.error("getSalesStats leads error:", leadsRes.error.message);
    return {
      totalLeads: 0,
      totalSales: 0,
      totalRevenue: 0,
      avgSaleValue: 0,
      conversionRate: 0,
      pipelineValue: 0,
      monthlyTrend: [],
      bySalesperson: [],
      hasAnySale: false,
    };
  }
  if (salesRes.error) {
    console.error("getSalesStats sales error:", salesRes.error.message);
  }

  type SaleRow = { sale_amount: number; sale_date: string; salesperson_profile: { full_name: string | null } | null };

  const leads = leadsRes.data;
  const sales = (salesRes.data ?? []) as unknown as SaleRow[];

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.sale_amount), 0);
  const totalSales = sales.length;
  const pipelineValue = leads
    .filter((l) => l.status !== "won" && l.status !== "lost")
    .reduce((sum, l) => sum + (l.offered_amount ?? 0), 0);

  const bySalespersonMap = new Map<string, { name: string; count: number; revenue: number }>();
  for (const s of sales) {
    const name = s.salesperson_profile?.full_name ?? "Atanmamış";
    const entry = bySalespersonMap.get(name) ?? { name, count: 0, revenue: 0 };
    entry.count += 1;
    entry.revenue += Number(s.sale_amount);
    bySalespersonMap.set(name, entry);
  }
  const bySalesperson = [...bySalespersonMap.values()].sort((a, b) => b.revenue - a.revenue);

  const now = new Date();
  const months: { key: string; label: string; count: number; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${TR_MONTHS[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`,
      count: 0,
      revenue: 0,
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));

  for (const s of sales) {
    const d = new Date(s.sale_date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const idx = monthIndex.get(key);
    if (idx === undefined) continue; // pencerenin (son 6 ay) disinda
    months[idx].count += 1;
    months[idx].revenue += Number(s.sale_amount);
  }

  return {
    totalLeads: leads.length,
    totalSales,
    totalRevenue,
    avgSaleValue: totalSales > 0 ? totalRevenue / totalSales : 0,
    conversionRate: leads.length > 0 ? (totalSales / leads.length) * 100 : 0,
    pipelineValue,
    monthlyTrend: months,
    bySalesperson,
    hasAnySale: totalSales > 0,
  };
}

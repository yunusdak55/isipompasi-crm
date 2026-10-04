import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/data/paginate";
import { partsTR, shiftMonth } from "@/lib/time";
import type { RawLeadRow, RawSaleRow } from "@/lib/data/reports";

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
  /**
   * "Satış" asamasinda (status=won) ama KAYITLI satis tutari olmayan lead sayisi. 0 olmali:
   * uygulamada satis tutari girilmeden "Satış"a gecilemez; >0 ise veri tutarsizdir (elle/aktarimla
   * eklenmis kayitlar) ve ciro/donusum bu leadleri SAYMAZ.
   */
  wonWithoutSale: number;
};

/**
 * PERF (jet hizi): `raw` verilirse (bkz. lib/data/agent-digest.ts) hicbir
 * sorgu atilmaz - Dijital Ajan sayfasi zaten `getReportsData` icin cektigi
 * AYNI leads/sales verisini burada TEKRAR CEKMEDEN paylasir (eskiden bu iki
 * fonksiyon ayni tabloyu ayri ayri iki kez sorguluyordu - bkz. reports.ts
 * fetchReportsRawData aciklamasi). /sales sayfasi eskisi gibi parametresiz
 * cagirir, kendi (daha dar kolonlu) sorgusunu atar - davranis degismedi.
 */
export async function getSalesStats(raw?: { allLeads: RawLeadRow[] | null; allSales: RawSaleRow[] }): Promise<SalesStats> {
  type SaleRow = { lead_id: string; sale_amount: number; sale_date: string; salesperson_profile: { full_name: string | null } | null };
  type LeadRow = { id: string; status: string; offered_amount: number | null };

  let leads: LeadRow[];
  let sales: SaleRow[];

  if (raw) {
    leads = raw.allLeads ?? [];
    sales = raw.allSales;
  } else {
    const supabase = await createClient();
    const [leadsRes, salesRes] = await Promise.all([
      // fetchAllRows: PostgREST 1000 satirda sessizce keser (bkz. data/paginate.ts).
      fetchAllRows((from, to) => supabase.from("leads").select("id, status, offered_amount").order("id").range(from, to)),
      fetchAllRows((from, to) =>
        supabase
          .from("sales")
          .select("id, lead_id, sale_amount, sale_date, salesperson_profile:profiles!sales_salesperson_fkey(full_name)")
          .order("sale_date", { ascending: true })
          .order("id")
          .range(from, to)
      ),
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
        wonWithoutSale: 0,
      };
    }
    if (salesRes.error) {
      console.error("getSalesStats sales error:", salesRes.error.message);
    }

    leads = leadsRes.data;
    sales = (salesRes.data ?? []) as unknown as SaleRow[];
  }

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

  const cur = partsTR(new Date());
  const months: { key: string; label: string; count: number; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = shiftMonth(cur.year, cur.month, -i);
    months.push({
      key: `${d.year}-${d.month}`,
      label: `${TR_MONTHS[d.month]} '${String(d.year).slice(2)}`,
      count: 0,
      revenue: 0,
    });
  }
  const monthIndex = new Map(months.map((m, i) => [m.key, i]));

  for (const s of sales) {
    const p = partsTR(new Date(s.sale_date));
    const key = `${p.year}-${p.month}`;
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
    wonWithoutSale: (() => {
      const soldLeadIds = new Set(sales.map((s) => s.lead_id));
      return leads.filter((l) => l.status === "won" && !soldLeadIds.has(l.id)).length;
    })(),
  };
}

export type SaleListItem = {
  id: string;
  saleAmount: number;
  saleDate: string;
  lead: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string;
    city: string | null;
    productLabel: string | null;
  } | null;
  salespersonName: string | null;
};

/**
 * Satışlar sayfasında SADECE toplam rakamlar degil, kime ne satildigi da
 * gorunsun diye (spec: "adam kime ne sattığını görsün") - "sales" satirlarini
 * ilgili lead'in adi/telefonu/urun ilgisiyle birlikte getirir. `sales.
 * product_service` alani hicbir ekrandan hic doldurulmuyor (surekli bos) -
 * "ne sattı" sorusuna lead'in kendi urun_kategorisi (Isı Pompası/VRF/Klima)
 * ile, gercekten var olan veriyle cevap veriyoruz.
 */
export async function getSalesList(): Promise<SaleListItem[]> {
  const supabase = await createClient();

  const { data, error } = await fetchAllRows((from, to) =>
    supabase
      .from("sales")
      .select(
        `id, sale_amount, sale_date,
      lead:leads(id, first_name, last_name, phone, city, product_category:product_categories(label)),
      salesperson_profile:profiles!sales_salesperson_fkey(full_name)`
      )
      .order("sale_date", { ascending: false })
      .order("id")
      .range(from, to)
  );

  if (error || !data) {
    if (error) console.error("getSalesList error:", error.message);
    return [];
  }

  type Row = {
    id: string;
    sale_amount: number;
    sale_date: string;
    lead: {
      id: string;
      first_name: string | null;
      last_name: string | null;
      phone: string;
      city: string | null;
      product_category: { label: string } | null;
    } | null;
    salesperson_profile: { full_name: string | null } | null;
  };

  return (data as unknown as Row[]).map((row) => ({
    id: row.id,
    saleAmount: Number(row.sale_amount),
    saleDate: row.sale_date,
    lead: row.lead
      ? {
          id: row.lead.id,
          firstName: row.lead.first_name,
          lastName: row.lead.last_name,
          phone: row.lead.phone,
          city: row.lead.city,
          productLabel: row.lead.product_category?.label ?? null,
        }
      : null,
    salespersonName: row.salesperson_profile?.full_name ?? null,
  }));
}

import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/constants/lead";
import type { LeadStatus, PropertyType } from "@/lib/types/domain";

/**
 * Raporlar sayfasi icin genel analiz verileri - `leads` / `followups`
 * tablolarindan, satis/gelir metrikleri ise gercek `sales` tablosundan
 * (bkz. lib/data/sales.ts) turetilir - tek dogru kaynak.
 *
 * DONEM (PERIOD) MOTORU (spec: "her ayın raporları farklı olsun... TÜM
 * ZAMANLAR ayarı da olsun"): "period" parametresi "all" veya "YYYY-MM"
 * (insan-okunur, 1-indexli ay) olabilir. TEK bir sorguyla TUM leads/sales
 * cekilip, donem secimine gore JS tarafinda filtrelenir - hem "Tüm
 * Zamanlar" hem "Ağustos 2026" ayni ham veriden turer, tutarsizlik olmaz,
 * ikinci bir DB round-trip'e gerek kalmaz.
 *
 * BILEREK DONEMDEN BAGIMSIZ birakilanlar:
 * - "Geciken Takip": kullanici karari ("gecikenler sıfırlanmasın") - hangi
 *   ay secilirse secilsin HER ZAMAN su an gercekten gecikmis olan TUM
 *   kayitlari gosterir. Aksi halde gecen ay unutulan bir lead yeni ayda
 *   "sorun yok" gibi gorunurdu - CRM'in "hiçbir lead kaybolmasın" amacina
 *   aykiri olurdu.
 * - "Aylık Karşılaştırma" paneli (monthlyFunnel): zaten kendi 12 aylik
 *   penceresini gosteren ayri bir arac, sayfadaki donem secicisinden
 *   etkilenmez.
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

export type ReportPeriodOption = { value: string; label: string };

/** Raporlar sayfasindaki donem secici icin secenekler: son 12 ay + "Tüm Zamanlar". */
export function getReportPeriodOptions(): ReportPeriodOption[] {
  const now = new Date();
  const options: ReportPeriodOption[] = [{ value: "all", label: "Tüm Zamanlar" }];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = i === 0 ? `Bu Ay (${TR_MONTHS[d.getMonth()]})` : i === 1 ? `Geçen Ay (${TR_MONTHS[d.getMonth()]})` : `${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

/** "YYYY-MM" (1-indeksli, insan-okunur) -> [baslangic, bitis) tarih araligi. "all" veya gecersiz format -> null (filtre yok). */
function periodToRange(period: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  return { start: new Date(year, monthIndex, 1), end: new Date(year, monthIndex + 1, 1) };
}

function inRange(dateStr: string, range: { start: Date; end: Date } | null) {
  if (!range) return true;
  const d = new Date(dateStr);
  return d >= range.start && d < range.end;
}

export type ReportsData = {
  period: string;
  periodLabel: string;
  totalLeads: number;
  funnel: { status: LeadStatus; label: string; count: number }[];
  conversionRate: number;
  followupStats: { total: number; completed: number; pending: number; overdue: number };
  cityDistribution: { city: string; count: number }[];
  districtDistribution: { city: string; count: number }[];
  propertyTypeDistribution: { label: string; count: number }[];
  productInterestDistribution: { label: string; count: number }[];
  avgOfferAmount: number;
  avgSaleAmount: number;
  totalSaleAmount: number;
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

export async function getReportsData(period: string = "all"): Promise<ReportsData> {
  const supabase = await createClient();
  const range = periodToRange(period);
  const periodLabel = getReportPeriodOptions().find((o) => o.value === period)?.label ?? "Tüm Zamanlar";

  const emptyResult: ReportsData = {
    period,
    periodLabel,
    totalLeads: 0,
    funnel: [],
    conversionRate: 0,
    followupStats: { total: 0, completed: 0, pending: 0, overdue: 0 },
    cityDistribution: [],
    districtDistribution: [],
    propertyTypeDistribution: [],
    productInterestDistribution: [],
    avgOfferAmount: 0,
    avgSaleAmount: 0,
    totalSaleAmount: 0,
    monthlyFunnel: [],
  };

  // TEK sorguyla TUM veri cekilir (donem filtresi yok) - "Tüm Zamanlar" ve
  // tek bir ayin gorunumu ayni ham kumeden turer, JS tarafinda filtrelenir.
  const [leadsRes, salesRes, followupsRes] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, status, city, district, property_type, offered_amount, created_at, last_contact_at, product_category:product_categories(label)"
      ),
    supabase.from("sales").select("sale_amount, sale_date"),
    supabase.from("followups").select("is_completed, followup_date, completed_at"),
  ]);

  if (leadsRes.error || !leadsRes.data) {
    if (leadsRes.error) console.error("getReportsData leads error:", leadsRes.error.message);
    return emptyResult;
  }
  if (salesRes.error) console.error("getReportsData sales error:", salesRes.error.message);
  if (followupsRes.error) console.error("getReportsData followups error:", followupsRes.error.message);

  const allLeads = leadsRes.data;
  const allSales = salesRes.data ?? [];
  const allFollowups = followupsRes.data ?? [];

  // Donem secimine gore filtrelenmis kumeler - asagidaki TUM istatistikler
  // (Geciken Takip ve Aylık Karşılaştırma haric) bunlardan turer.
  const leads = allLeads.filter((l) => inRange(l.created_at, range));
  const sales = allSales.filter((s) => inRange(s.sale_date, range));

  // Funnel: pipeline sirasina gore durum sayaclari.
  const funnelMap = new Map<LeadStatus, number>();
  for (const lead of leads) {
    const status = lead.status as LeadStatus;
    funnelMap.set(status, (funnelMap.get(status) ?? 0) + 1);
  }
  const funnel = LEAD_STATUS_ORDER.map((status) => ({ status, label: LEAD_STATUS_LABELS[status], count: funnelMap.get(status) ?? 0 }));

  const conversionRate = leads.length > 0 ? (sales.length / leads.length) * 100 : 0;

  // Takip performansi.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  for (const f of allFollowups) {
    if (f.is_completed) {
      // "Tamamlanan" donem bazli: HANGI AY TAMAMLANDIYSA o ayda sayilir
      // (completed_at) - takip Haziran'da planlanip Temmuz'da yapilmis
      // olabilir, performans olarak Temmuz'a yazilmasi dogru olan budur.
      if (inRange(f.completed_at ?? f.followup_date, range)) completed += 1;
    } else if (new Date(f.followup_date) < todayStart) {
      // GECIKEN: kullanici karari geregi donemden BAGIMSIZ, HER ZAMAN
      // su anki gercek gecikme durumunu yansitir (bkz. dosya basi aciklama).
      overdue += 1;
    } else if (inRange(f.followup_date, range)) {
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

  // Ilce dagilimi (spec: "hangi şehirler hangi ilçelerden... talep olmuş").
  const districtCounts = new Map<string, number>();
  for (const lead of leads) {
    const district = lead.district?.trim() || "Belirtilmemiş";
    districtCounts.set(district, (districtCounts.get(district) ?? 0) + 1);
  }
  const districtDistribution = [...districtCounts.entries()]
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

  const totalSaleAmount = sales.reduce((sum, s) => sum + Number(s.sale_amount), 0);
  const avgSaleAmount = sales.length > 0 ? totalSaleAmount / sales.length : 0;

  // Aylik huni ("Aylık Karşılaştırma" paneli): BILEREK donem filtresinden
  // BAGIMSIZ, her zaman TUM leadler uzerinden son 12 ayi gosterir - bu zaten
  // kendi basina bir "ay ay kiyasla" araci.
  const monthlyFunnel: MonthlyFunnelPoint[] = lastNMonthBuckets(12).map((m) => {
    const monthLeads = allLeads.filter((l) => monthKey(l.created_at) === m.key);
    return {
      key: m.key,
      label: m.label,
      leadCount: monthLeads.length,
      // "Arandi" artik ayri bir status degil (bkz. migration 0015) - en az bir
      // kez gercek temas kurulmus mu diye last_contact_at'e bakiyoruz.
      calledCount: monthLeads.filter((l) => l.last_contact_at !== null).length,
      discoveryCount: monthLeads.filter((l) => l.status === "discovery_offer").length,
      wonCount: monthLeads.filter((l) => l.status === "won").length,
    };
  });

  return {
    period,
    periodLabel,
    totalLeads: leads.length,
    funnel,
    conversionRate,
    followupStats: { total: completed + pending + overdue, completed, pending, overdue },
    cityDistribution,
    districtDistribution,
    propertyTypeDistribution,
    productInterestDistribution,
    avgOfferAmount,
    avgSaleAmount,
    totalSaleAmount,
    monthlyFunnel,
  };
}

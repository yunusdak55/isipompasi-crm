import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUS_ORDER, LEAD_STATUS_LABELS, PROPERTY_TYPE_LABELS } from "@/lib/constants/lead";
import { fetchAllRows } from "@/lib/data/paginate";
import { getOverdueLeadCount } from "@/lib/data/dashboard";
import { monthStartTR, partsTR, shiftMonth } from "@/lib/time";
import { FOLLOWUP_OVERDUE_HOURS } from "@/lib/utils";
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
  const cur = partsTR(new Date());
  const months: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = shiftMonth(cur.year, cur.month, -i);
    months.push({ key: `${d.year}-${d.month}`, label: `${TR_MONTHS[d.month]} ${d.year}` });
  }
  return months;
}

/** Turkiye takvimine gore "yil-ay" kovasi (sunucu saat diliminden bagimsiz). */
function monthKey(dateStr: string) {
  const p = partsTR(new Date(dateStr));
  return `${p.year}-${p.month}`;
}

export type ReportPeriodOption = { value: string; label: string };

/** Raporlar sayfasindaki donem secici icin secenekler: son 12 ay + "Tüm Zamanlar". */
export function getReportPeriodOptions(): ReportPeriodOption[] {
  const cur = partsTR(new Date());
  const options: ReportPeriodOption[] = [{ value: "all", label: "Tüm Zamanlar" }];
  for (let i = 0; i < 12; i++) {
    const d = shiftMonth(cur.year, cur.month, -i);
    const value = `${d.year}-${String(d.month + 1).padStart(2, "0")}`;
    const label = i === 0 ? `Bu Ay (${TR_MONTHS[d.month]})` : i === 1 ? `Geçen Ay (${TR_MONTHS[d.month]})` : `${TR_MONTHS[d.month]} ${d.year}`;
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
  return { start: monthStartTR(year, monthIndex), end: monthStartTR(year, monthIndex + 1) };
}

function inRange(dateStr: string, range: { start: Date; end: Date } | null) {
  if (!range) return true;
  const d = new Date(dateStr);
  return d >= range.start && d < range.end;
}

export type RawLeadRow = {
  id: string;
  status: LeadStatus;
  city: string | null;
  district: string | null;
  property_type: string | null;
  offered_amount: number | null;
  created_at: string;
  last_contact_at: string | null;
  product_category: { label: string } | null;
};
export type RawSaleRow = {
  id: string;
  lead_id: string;
  sale_amount: number;
  sale_date: string;
  salesperson_profile: { full_name: string | null } | null;
};
export type RawFollowupRow = { id: string; is_completed: boolean; followup_date: string; completed_at: string | null };

export type ReportsRawData = {
  allLeads: RawLeadRow[] | null;
  allSales: RawSaleRow[];
  allFollowups: RawFollowupRow[];
  /**
   * Su an GECIKMIS lead sayisi - Dashboard/Gecikenler ile AYNI tek kaynak
   * (getOverdueLeadCount). null = okunamadi; o zaman eski `followups` tablosundan hesaplanir.
   */
  overdueLeadCount: number | null;
};

/**
 * PERF (jet hizi): Raporlar/Satislar/Dijital Ajan sayfalarinin HEPSI ayni
 * `leads`/`sales` (ve raporlar icin ayrica `followups`) tablolarinin
 * degisik kesitlerini/turevlerini gosteriyor. Eskiden `getReportsData` ve
 * `getSalesStats` HER BIRI kendi `leads`+`sales` sorgusunu ayri ayri
 * atiyordu - Dijital Ajan sayfasi (agent-digest.ts) ikisini de BIRLIKTE
 * cagirdigi icin AYNI iki tabloyu (leads, sales) fuzul yere IKI KEZ
 * cekiyordu (paralel calisiyor olsalar da her biri kendi ag turunu/
 * connection pool slotunu tuketiyor - olculen ~370-410ms TTFB'nin sebebi
 * budur, diger sayfalar ~100-260ms). Bu fonksiyon TEK, PAYLASILAN bir ham
 * veri ceker; `getReportsData`/`getSalesStats` opsiyonel bir `raw` parametresi
 * alip verilmisse KENDI sorgusunu atlar - agent-digest.ts artik ucunu de
 * (leads+sales+followups) TEK SEFER ceker, ikisine de aynen paylasir.
 */
export async function fetchReportsRawData(): Promise<ReportsRawData> {
  const supabase = await createClient();

  const [leadsRes, salesRes, followupsRes, overdueLeadCount] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from("leads")
        .select(
          "id, status, city, district, property_type, offered_amount, created_at, last_contact_at, product_category:product_categories(label)"
        )
        .order("id")
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase
        .from("sales")
        .select("id, lead_id, sale_amount, sale_date, salesperson_profile:profiles!sales_salesperson_fkey(full_name)")
        .order("id")
        .range(from, to)
    ),
    fetchAllRows((from, to) =>
      supabase.from("followups").select("id, is_completed, followup_date, completed_at").order("id").range(from, to)
    ),
    getOverdueLeadCount(),
  ]);

  if (leadsRes.error) console.error("fetchReportsRawData leads error:", leadsRes.error.message);
  if (salesRes.error) console.error("fetchReportsRawData sales error:", salesRes.error.message);
  if (followupsRes.error) console.error("fetchReportsRawData followups error:", followupsRes.error.message);

  return {
    allLeads: (leadsRes.data as unknown as RawLeadRow[] | null) ?? (leadsRes.error ? null : []),
    allSales: (salesRes.data as unknown as RawSaleRow[] | null) ?? [],
    allFollowups: (followupsRes.data as unknown as RawFollowupRow[] | null) ?? [],
    overdueLeadCount,
  };
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

/**
 * Ay bazinda huni kirilimi (spec: "bu ay kac lead geldi, kaci kesif oldu,
 * kaci satis oldu"). DUZELTME: "calledCount" (last_contact_at doluysa
 * "Arandı" sayilirdi) kaldirildi - spec: "ARANDI ROZETİNİ HER TÜRLÜ
 * KALDIR". Ayrica bu, status bazli diger sayaçlarla ORTUSEBİLEN
 * (ayni lead'i iki kez sayan) bir metrikti - ornegin "Keşif/Teklif"
 * durumundaki bir lead'in last_contact_at'i de dolu olacagi icin hem
 * "Keşif" hem "Arandı" dilimine giriyordu. Bunun yerine durum (status)
 * BASINA, birbiriyle KESISMEYEN sayaçlar kullanilir - toplamlari her
 * zaman tam olarak leadCount'a eşittir.
 */
export type MonthlyFunnelPoint = {
  key: string;
  label: string;
  leadCount: number;
  newCount: number;
  discoveryCount: number;
  followupCount: number;
  wonCount: number;
  lostCount: number;
};

/**
 * Dagilim listesi: en kalabalik `limit` kayit + kalanlarin toplami "Diger (N sehir)"
 * olarak SONDA - boylece gorunen satirlarin toplami her zaman toplam lead'e esittir
 * (eskiden ilk 8 sehir gosterilip kalan kayitlar sessizce kayboluyordu: 3.387 / 5.000).
 */
function topWithOther(counts: Map<string, number>, limit: number, noun: string): { city: string; count: number }[] {
  const sorted = [...counts.entries()].map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  if (rest.length > 0) {
    top.push({ city: `Diğer (${rest.length} ${noun})`, count: rest.reduce((sum, r) => sum + r.count, 0) });
  }
  return top;
}

export async function getReportsData(period: string = "all", raw?: ReportsRawData): Promise<ReportsData> {
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
  // `raw` verilmisse (bkz. agent-digest.ts) hic sorgu atilmaz, cagiranin
  // zaten cektigi veri kullanilir.
  const { allLeads, allSales, allFollowups, overdueLeadCount } = raw ?? (await fetchReportsRawData());

  if (!allLeads) {
    return emptyResult;
  }

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
  const overdueCutoff = Date.now() - FOLLOWUP_OVERDUE_HOURS * 60 * 60 * 1000;
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  for (const f of allFollowups) {
    if (f.is_completed) {
      // "Tamamlanan" donem bazli: HANGI AY TAMAMLANDIYSA o ayda sayilir
      // (completed_at) - takip Haziran'da planlanip Temmuz'da yapilmis
      // olabilir, performans olarak Temmuz'a yazilmasi dogru olan budur.
      if (inRange(f.completed_at ?? f.followup_date, range)) completed += 1;
    } else if (new Date(f.followup_date).getTime() < overdueCutoff) {
      // GECIKEN: kullanici karari geregi donemden BAGIMSIZ, HER ZAMAN
      // su anki gercek gecikme durumunu yansitir (bkz. dosya basi aciklama).
      overdue += 1;
    } else if (inRange(f.followup_date, range)) {
      pending += 1;
    }
  }

  // GECIKEN: Dashboard ve Gecikenler ile AYNI sayi (leadlerin takip tarihi + 24 saat kurali + aktivite
  // istisnasi, tek kaynak). Eskiden eski `followups` tablosundan sayiliyordu ve ekranlar birbirini
  // tutmuyordu (ör. Raporlar 248, Gecikenler 217). Okunamazsa eski hesaba dusulur.
  const overdueFinal = overdueLeadCount ?? overdue;

  // Sehir dagilimi (en fazla 8).
  const cityCounts = new Map<string, number>();
  for (const lead of leads) {
    const city = lead.city?.trim() || "Belirtilmemiş";
    cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
  }
  const cityDistribution = topWithOther(cityCounts, 8, "şehir");

  // Ilce dagilimi (spec: "hangi şehirler hangi ilçelerden... talep olmuş").
  const districtCounts = new Map<string, number>();
  for (const lead of leads) {
    const district = lead.district?.trim() || "Belirtilmemiş";
    districtCounts.set(district, (districtCounts.get(district) ?? 0) + 1);
  }
  const districtDistribution = topWithOther(districtCounts, 8, "ilçe");

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
      newCount: monthLeads.filter((l) => l.status === "new").length,
      discoveryCount: monthLeads.filter((l) => l.status === "discovery_offer").length,
      followupCount: monthLeads.filter((l) => l.status === "followup").length,
      wonCount: monthLeads.filter((l) => l.status === "won").length,
      lostCount: monthLeads.filter((l) => l.status === "lost").length,
    };
  });

  return {
    period,
    periodLabel,
    totalLeads: leads.length,
    funnel,
    conversionRate,
    followupStats: { total: completed + pending + overdueFinal, completed, pending, overdue: overdueFinal },
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

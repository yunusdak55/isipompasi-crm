import { getReportsData } from "@/lib/data/reports";
import { getLeadsOverdue } from "@/lib/data/leads";
import { getSalesStats } from "@/lib/data/sales";
import { formatCurrency, formatRelativeDays, formatRelativeTimeAgo } from "@/lib/utils";

/**
 * Dijital Ajan sayfasinin TEK gercek veri kaynagi. Hem sayfadaki hazir
 * ("kurallı") ic goruleri, hem gercek LLM'e gonderilecek baglami BURADAN
 * uretiyoruz - iki yerde ayri ayri hesaplanip birbirinden sapmasin diye.
 *
 * Spec (2026-09-28): "panelden verileri incelesin, durumuna gore degisen
 * uyarilar versin (gecikmis takip, cok fazla takipte kalan musteri vb.)".
 * Bu dosyadaki `buildAgentInsights` o kuralli (LLM'siz, ucretsiz, aninda)
 * uyarilari uretir - sayfa acilir acilmaz gorunur, API anahtari gerekmez.
 */

export type MonthComparison = {
  thisMonthLabel: string;
  lastMonthLabel: string;
  leadCountThis: number;
  leadCountLast: number;
  wonCountThis: number;
  wonCountLast: number;
  revenueThis: number;
  revenueLast: number;
  /** null = geçen ay 0 lead/ciro vardı, yüzde anlamsız (bölme hatası). */
  leadChangePct: number | null;
  revenueChangePct: number | null;
};

export type AgentDigest = {
  totalLeads: number;
  overdueCount: number;
  conversionRate: number;
  totalRevenue: number;
  avgSaleValue: number;
  avgOfferAmount: number;
  pipelineValue: number;
  funnel: { status: string; label: string; count: number }[];
  cityDistribution: { label: string; count: number }[];
  productInterestDistribution: { label: string; count: number }[];
  bySalesperson: { name: string; count: number; revenue: number }[];
  overdueLeads: { name: string; city: string | null; daysText: string }[];
  hasAnySale: boolean;
  /** null = henuz 2 aylik veri yok (ör. yeni firma) - kiyaslama gosterilmez. */
  monthComparison: MonthComparison | null;
};

export type AgentInsight = {
  id: string;
  tone: "danger" | "warning" | "success" | "info";
  text: string;
};

export async function getAgentDigest(): Promise<AgentDigest> {
  const [report, overdueLeads, salesStats] = await Promise.all([getReportsData("all"), getLeadsOverdue(), getSalesStats()]);

  const overdueForDisplay = overdueLeads.slice(0, 8).map((lead) => {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || lead.phone;
    const daysText = formatRelativeDays(lead.next_followup_at) ?? `${formatRelativeTimeAgo(lead.created_at)} geldi, yanıt yok`;
    return { name, city: lead.city, daysText };
  });

  // AY KARŞILAŞTIRMASI - ek bir sorgu YOK, zaten cekilen "Aylık Karşılaştırma"
  // (report.monthlyFunnel, son 12 ay) ve satis trendinden (salesStats.
  // monthlyTrend, son 6 ay) turuyor - ikisi de en eskiden en yeniye siralı,
  // son eleman = bu ay, ondan onceki = gecen ay (bkz. reports.ts/sales.ts).
  const fThis = report.monthlyFunnel.at(-1);
  const fLast = report.monthlyFunnel.at(-2);
  const sThis = salesStats.monthlyTrend.at(-1);
  const sLast = salesStats.monthlyTrend.at(-2);
  const monthComparison: MonthComparison | null =
    fThis && fLast
      ? {
          thisMonthLabel: fThis.label,
          lastMonthLabel: fLast.label,
          leadCountThis: fThis.leadCount,
          leadCountLast: fLast.leadCount,
          wonCountThis: fThis.wonCount,
          wonCountLast: fLast.wonCount,
          revenueThis: sThis?.revenue ?? 0,
          revenueLast: sLast?.revenue ?? 0,
          leadChangePct: fLast.leadCount > 0 ? ((fThis.leadCount - fLast.leadCount) / fLast.leadCount) * 100 : null,
          revenueChangePct:
            sLast && sLast.revenue > 0 ? (((sThis?.revenue ?? 0) - sLast.revenue) / sLast.revenue) * 100 : null,
        }
      : null;

  return {
    totalLeads: report.totalLeads,
    overdueCount: overdueLeads.length,
    conversionRate: report.conversionRate,
    totalRevenue: salesStats.totalRevenue,
    avgSaleValue: salesStats.avgSaleValue,
    avgOfferAmount: report.avgOfferAmount,
    pipelineValue: salesStats.pipelineValue,
    funnel: report.funnel,
    cityDistribution: report.cityDistribution.map((c) => ({ label: c.city, count: c.count })),
    productInterestDistribution: report.productInterestDistribution,
    bySalesperson: salesStats.bySalesperson,
    overdueLeads: overdueForDisplay,
    hasAnySale: salesStats.hasAnySale,
    monthComparison,
  };
}

/**
 * Kuralli (LLM'siz) ic gorusler - esikler kasitli olarak "cok agresif
 * uyarma" ile "hicbir sey soylememe" arasinda, gercekci orta nokta.
 * Her kural GERCEK sayidan turer, hicbir metin uydurulmuyor.
 */
export function buildAgentInsights(d: AgentDigest): AgentInsight[] {
  const insights: AgentInsight[] = [];

  const followupCount = d.funnel.find((f) => f.status === "followup")?.count ?? 0;
  const discoveryCount = d.funnel.find((f) => f.status === "discovery_offer")?.count ?? 0;
  const wonCount = d.funnel.find((f) => f.status === "won")?.count ?? 0;
  const openCount = d.totalLeads - wonCount - (d.funnel.find((f) => f.status === "lost")?.count ?? 0);

  // 1) Gecikmis takip - en dogrudan, en acil sinyal.
  if (d.overdueCount > 0) {
    const ratio = d.totalLeads > 0 ? d.overdueCount / d.totalLeads : 0;
    const names = d.overdueLeads.slice(0, 3).map((l) => l.name).join(", ");
    insights.push({
      id: "overdue",
      tone: ratio > 0.25 ? "danger" : "warning",
      text:
        `${d.overdueCount} müşteri gecikmiş takip bekliyor (${names}${d.overdueCount > 3 ? " ve diğerleri" : ""}). ` +
        `Bunlara bugün dönüş yapmazsanız kaybetme riski artıyor` +
        (ratio > 0.25 ? " — bu oran lead havuzunuzun dörtte birinden fazlası, acil müdahale gerekiyor." : "."),
    });
  }

  // 1b) Ay karsilastirmasi - "gecen aya gore" trend (spec 2026-09-30: "ay
  // karşılaştırması eklensin"). Sadece anlamli bir sinyal varsa gosterilir -
  // iki ay da 0 lead ise soyleyecek bir sey yok, gurultu yaratmasin.
  if (d.monthComparison && (d.monthComparison.leadCountThis > 0 || d.monthComparison.leadCountLast > 0)) {
    const mc = d.monthComparison;
    const leadDelta = mc.leadCountThis - mc.leadCountLast;
    const trendWord = leadDelta > 0 ? "artış" : leadDelta < 0 ? "azalış" : "değişim yok";
    const pctText = mc.leadChangePct !== null ? ` (%${Math.abs(mc.leadChangePct).toFixed(0)} ${trendWord})` : "";
    let revenueText = "";
    if (mc.revenueThis > 0 || mc.revenueLast > 0) {
      const revDelta = mc.revenueThis - mc.revenueLast;
      const revPct = mc.revenueChangePct !== null ? ` (%${Math.abs(mc.revenueChangePct).toFixed(0)} ${revDelta >= 0 ? "artış" : "azalış"})` : "";
      revenueText = ` Ciro ${formatCurrency(mc.revenueThis)}${revPct}, geçen ay ${formatCurrency(mc.revenueLast)} idi.`;
    }
    insights.push({
      id: "month-comparison",
      tone: leadDelta < 0 && (mc.leadChangePct ?? 0) < -20 ? "warning" : "info",
      text: `${mc.thisMonthLabel}: ${mc.leadCountThis} lead geldi${pctText}, geçen ay (${mc.lastMonthLabel}) ${mc.leadCountLast} lead vardı.${revenueText}`,
    });
  }

  // 2) Takipte/kesif-teklif'te tikanma - cok musteri var ama kapanmiyor.
  if (openCount > 0 && followupCount / openCount > 0.4 && followupCount >= 5) {
    insights.push({
      id: "followup-bottleneck",
      tone: "warning",
      text:
        `Açık lead'lerinizin %${Math.round((followupCount / openCount) * 100)}'i "Takip" aşamasında bekliyor (${followupCount} kişi). ` +
        `Bu kadar çok müşterinin takipte kalması dönüşüm oranını doğrudan düşürüyor — bu grubun üzerine gidip kesin bir "evet/hayır" almanız satışları artırır.`,
    });
  }

  if (openCount > 0 && discoveryCount / openCount > 0.35 && discoveryCount >= 5) {
    insights.push({
      id: "discovery-bottleneck",
      tone: "warning",
      text:
        `${discoveryCount} lead "Keşif/Teklif" aşamasında bekliyor ama henüz satışa dönmedi. ` +
        `Teklif verilen müşterilerde takip süresi uzadıkça kapanma ihtimali düşer — bu listeyi önceliklendirip teklifleri hatırlatın.`,
    });
  }

  // 3) Dusuk donusum orani (yeterli hacim varken).
  if (d.totalLeads >= 15 && d.conversionRate < 10) {
    insights.push({
      id: "low-conversion",
      tone: "warning",
      text: `Dönüşüm oranınız %${d.conversionRate.toFixed(1)} — ${d.totalLeads} lead'e karşılık bu düşük. Fiyatlandırma, geri dönüş hızı veya keşif kalitesinden kaynaklanıyor olabilir.`,
    });
  }

  // 4) Satis temsilcileri arasi buyuk fark (en az 2 temsilci ve anlamli hacim varsa).
  const activeSalespeople = d.bySalesperson.filter((s) => s.count > 0);
  if (activeSalespeople.length >= 2) {
    const sorted = [...activeSalespeople].sort((a, b) => b.revenue - a.revenue);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    if (top.revenue > 0 && bottom.revenue < top.revenue * 0.3) {
      insights.push({
        id: "salesperson-gap",
        tone: "info",
        text: `${top.name} (${formatCurrency(top.revenue)}) ile ${bottom.name} (${formatCurrency(bottom.revenue)}) arasında ciddi bir performans farkı var. ${bottom.name}'in sürecini incelemek faydalı olabilir.`,
      });
    }
  }

  // 5) Her sey yolundaysa da bir seyi soylemek lazim - sessizlik guven vermez.
  if (insights.length === 0) {
    insights.push({
      id: "all-good",
      tone: "success",
      text:
        d.totalLeads > 0
          ? "Şu anda kritik bir sorun görünmüyor — gecikmiş takip yok, pipeline dengeli dağılmış. İyi gidiyorsunuz."
          : "Henüz bir lead kaydınız yok. İlk lead geldiğinde işletmenizin durumunu burada analiz etmeye başlayacağım.",
    });
  }

  return insights;
}

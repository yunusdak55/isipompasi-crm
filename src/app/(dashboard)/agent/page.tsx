import Link from "next/link";
import { Sparkles, AlertTriangle, MapPin, Tag, ArrowRight } from "lucide-react";
import { AgentFigure } from "@/components/agent/agent-figure";
import { AgentInsightsChat } from "@/components/agent/agent-insights-chat";
import { Card, CardHeader, CardTitle, CardBody, StatCard } from "@/components/ui/card";
import { DistributionList, EmptyState } from "@/components/ui/distribution-list";
import { getReportsData } from "@/lib/data/reports";
import { getLeadsOverdue } from "@/lib/data/leads";
import { formatCurrency, formatRelativeDays, formatRelativeTimeAgo } from "@/lib/utils";

/**
 * Dijital Ajan — artik "Ajan ile Sohbet / Rakip Analizi / Sektor Durumu"
 * diye UC AYRI, ikisi tamamen bos placeholder sayfaya bolunmus degil, TEK
 * bir sayfa (spec 2026-09-28: "dijital ajan kısmını tek'e indir, rakip
 * analizi sektör analizi falan kalksın, o tek kısımdan şirkete dair bilgi
 * versin"). Rakip/sektor analizi kaldirildi - CRM'in hicbir gercek veri
 * kaynagi yok (disaridan rakip/sektor verisi cekilmiyor), o yuzden onlar
 * hep "baglanti bekleniyor" bos kabuktu. Bunun yerine ajan artik GERCEK
 * sirket verisiyle (leads/sales/followups) calisiyor - hem ust ozette hem
 * alttaki soru-cevap kutusunda hicbir sayi uydurulmuyor.
 */
export default async function AgentOverviewPage() {
  const [report, overdueLeads] = await Promise.all([getReportsData("all"), getLeadsOverdue()]);

  const topCity = report.cityDistribution[0] ?? null;
  const topProduct = report.productInterestDistribution[0] ?? null;
  const hasData = report.totalLeads > 0;

  const overdueForDisplay = overdueLeads.slice(0, 5).map((lead) => {
    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ").trim() || lead.phone;
    const daysText = formatRelativeDays(lead.next_followup_at) ?? `${formatRelativeTimeAgo(lead.created_at)} geldi, yanıt yok`;
    return { id: lead.id, name, city: lead.city, daysText };
  });

  const digest = {
    totalLeads: report.totalLeads,
    overdueCount: overdueLeads.length,
    conversionRate: report.conversionRate,
    totalSaleAmount: report.totalSaleAmount,
    avgOfferAmount: report.avgOfferAmount,
    avgSaleAmount: report.avgSaleAmount,
    cityDistribution: report.cityDistribution.map((c) => ({ label: c.city, count: c.count })),
    productInterestDistribution: report.productInterestDistribution,
    funnel: report.funnel,
    overdueLeads: overdueForDisplay.map((l) => ({ name: l.name, daysText: l.daysText })),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-7 shadow-elevated-lg sm:p-10">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-brand-500/25 blur-[120px]" />
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full bg-accent-500/[0.14] blur-[120px]" />
        </div>

        <div className="relative flex flex-col items-center gap-8 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="sm:max-w-lg">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-500/15 px-3 py-1 text-xs font-medium text-accent-300 ring-1 ring-inset ring-accent-500/25">
              <Sparkles className="h-3 w-3" />
              Dijital Ajan
            </span>
            <h1 className="mt-3.5 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
              İşletmenizin şu anki durumu
            </h1>
            {hasData ? (
              <p className="mt-2 text-sm leading-relaxed text-white/60 sm:text-[15px]">
                Toplam <span className="font-semibold text-white">{digest.totalLeads}</span> lead yönetiyorsunuz
                {digest.overdueCount > 0 ? (
                  <>
                    , bunlardan <span className="font-semibold text-danger-300">{digest.overdueCount}</span> tanesi gecikmiş
                    takip bekliyor
                  </>
                ) : (
                  <> ve şu anda gecikmiş takip yok</>
                )}
                . Dönüşüm oranınız <span className="font-semibold text-white">%{digest.conversionRate.toFixed(1)}</span>
                {topCity ? (
                  <>
                    , en çok talep <span className="font-semibold text-white">{topCity.city}</span>&apos;den geliyor
                  </>
                ) : null}
                {topProduct ? (
                  <>
                    , en çok ilgi gören hizmet <span className="font-semibold text-white">{topProduct.label}</span>
                  </>
                ) : null}
                .
              </p>
            ) : (
              <p className="mt-2 text-sm leading-relaxed text-white/60 sm:text-[15px]">
                Henüz bir lead kaydınız yok — ilk lead geldiğinde burada işletmeniz hakkında gerçek zamanlı bir özet
                göreceksiniz.
              </p>
            )}
          </div>

          <AgentFigure size={160} className="animate-scale-in" />
        </div>
      </div>

      {hasData ? (
        <>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <StatCard label="Toplam Lead" value={digest.totalLeads} tone="brand" />
            <StatCard
              label="Gecikmiş Takip"
              value={digest.overdueCount}
              tone={digest.overdueCount > 0 ? "danger" : "success"}
            />
            <StatCard label="Dönüşüm Oranı" value={`%${digest.conversionRate.toFixed(1)}`} tone="accent" />
            <StatCard label="Toplam Ciro" value={formatCurrency(digest.totalSaleAmount)} tone="success" />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card hoverable className="animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ink-400" />
                  Şehir Dağılımı
                </CardTitle>
              </CardHeader>
              <CardBody>
                <DistributionList items={digest.cityDistribution} unit="lead" />
              </CardBody>
            </Card>

            <Card hoverable className="animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-ink-400" />
                  Hizmet İlgi Dağılımı
                </CardTitle>
              </CardHeader>
              <CardBody>
                <DistributionList items={digest.productInterestDistribution} unit="lead" />
              </CardBody>
            </Card>
          </div>

          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-danger-500" />
                Öncelikli Aksiyonlar
              </CardTitle>
              {digest.overdueCount > 5 ? (
                <Link href="/leads/overdue" className="text-xs font-medium text-accent-500 hover:text-accent-600">
                  Tümünü gör ({digest.overdueCount})
                </Link>
              ) : null}
            </CardHeader>
            <CardBody>
              {overdueForDisplay.length === 0 ? (
                <EmptyState body="Şu anda dönüş bekleyen gecikmiş bir lead yok — harika gidiyor." />
              ) : (
                <div className="flex flex-col divide-y divide-line">
                  {overdueForDisplay.map((lead, index) => (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="animate-slide-up group flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <div>
                        <p className="text-sm font-medium text-ink-900 group-hover:text-accent-600">{lead.name}</p>
                        <p className="text-xs text-ink-500">{lead.city ?? "Şehir belirtilmemiş"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-danger-500">{lead.daysText}</span>
                        <ArrowRight className="h-3.5 w-3.5 text-ink-300 transition-transform duration-150 ease-snappy group-hover:translate-x-0.5 group-hover:text-accent-500" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : null}

      <div className="min-h-0">
        <AgentInsightsChat digest={digest} />
      </div>
    </div>
  );
}

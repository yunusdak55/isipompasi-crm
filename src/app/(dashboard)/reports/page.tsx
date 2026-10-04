import { redirect } from "next/navigation";
import { Filter, MapPin, Home, CalendarClock, Tag, CalendarRange } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getReportsData, getReportPeriodOptions } from "@/lib/data/reports";
import { Card, CardHeader, CardTitle, CardBody, StatCard } from "@/components/ui/card";
import { DistributionList, EmptyState } from "@/components/ui/distribution-list";
import { MonthlyComparisonPanel } from "@/components/reports/monthly-comparison-panel";
import { PeriodSelect } from "@/components/reports/period-select";
import { StatusBars } from "@/components/charts/status-bars";
import { formatCurrency, formatRate } from "@/lib/utils";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  // DUZELTME (denetim bulgusu, bkz. dashboard/page.tsx ayni aciklama).
  const profile = await requireProfile();
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  const { period } = await searchParams;
  const data = await getReportsData(period ?? "all");
  const periodOptions = getReportPeriodOptions();

  return (
    <div className="stagger flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-900">Raporlar</h1>
          <p className="text-sm text-ink-600">
            Satış hunisini ve dağılımları tek ekranda görün — <span className="font-medium text-ink-900">{data.periodLabel}</span> gösteriliyor.
          </p>
          <p className="mt-0.5 text-[11px] text-ink-400">
            Dönem seçimi üstteki kutulara, huniye ve dağılımlara uygulanır (leadin oluşturulma tarihine göre). “Aylık Karşılaştırma” kendi ay
            seçicilerini, “Geciken Takip” ise her zaman şu anki durumu kullanır.
          </p>
        </div>
        <PeriodSelect options={periodOptions} value={data.period} />
      </div>

      {data.totalLeads === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              body={
                data.period === "all"
                  ? "Henüz hiç lead kaydı yok - raporlar veri geldikçe burada oluşacak."
                  : `${data.periodLabel} döneminde kayıtlı lead yok - farklı bir dönem seçebilirsiniz.`
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-5">
            <StatCard label="Toplam Lead" value={data.totalLeads} tone="brand" />
            <StatCard label="Satışa Dönüşüm" value={formatRate(data.conversionRate)} tone="success" />
            <StatCard label="Toplam Ciro" value={formatCurrency(data.totalSaleAmount)} tone="success" />
            <StatCard label="Ortalama Teklif" value={formatCurrency(data.avgOfferAmount)} tone="accent" />
            <StatCard label="Ortalama Satış" value={formatCurrency(data.avgSaleAmount)} tone="ink" />
          </div>

          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-ink-400" />
                Aylık Karşılaştırma
              </CardTitle>
            </CardHeader>
            <CardBody>
              <MonthlyComparisonPanel data={data.monthlyFunnel} />
            </CardBody>
          </Card>

          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-ink-400" />
                Lead → Satış Hunisi
              </CardTitle>
            </CardHeader>
            <CardBody>
              <StatusBars funnel={data.funnel} />
            </CardBody>
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card hoverable className="animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-ink-400" />
                  Ürün İlgi Dağılımı
                </CardTitle>
              </CardHeader>
              <CardBody>
                <DistributionList items={data.productInterestDistribution} unit="lead" />
              </CardBody>
            </Card>

            <Card hoverable className="animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ink-400" />
                  Şehir Dağılımı
                </CardTitle>
              </CardHeader>
              <CardBody>
                <DistributionList items={data.cityDistribution.map((c) => ({ label: c.city, count: c.count }))} unit="lead" />
              </CardBody>
            </Card>

            <Card hoverable className="animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-ink-400" />
                  İlçe Dağılımı
                </CardTitle>
              </CardHeader>
              <CardBody>
                <DistributionList items={data.districtDistribution.map((c) => ({ label: c.city, count: c.count }))} unit="lead" />
              </CardBody>
            </Card>

            <Card hoverable className="animate-slide-up">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-ink-400" />
                  Konut Tipi Dağılımı
                </CardTitle>
              </CardHeader>
              <CardBody>
                <DistributionList items={data.propertyTypeDistribution} unit="lead" />
              </CardBody>
            </Card>
          </div>

          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-ink-400" />
                Takip Performansı
              </CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-3.5">
                <StatCard label="Tamamlanan Takip" value={data.followupStats.completed} tone="success" />
                <StatCard label="Bekleyen Takip" value={data.followupStats.pending} tone="brand" />
                <StatCard label="Geciken Takip" value={data.followupStats.overdue} tone="danger" />
              </div>
              <p className="text-[11px] text-ink-400">
                Tamamlanan/Bekleyen {data.periodLabel.toLocaleLowerCase("tr")} dönemine göre hesaplanır. Geciken Takip ise seçili dönemden
                bağımsız, her zaman şu an gerçekten gecikmiş olan tüm kayıtları gösterir — geçmiş bir ay seçmeniz onu sıfırlamaz.
              </p>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

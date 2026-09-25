import { Wallet, Percent, Users, Layers, TrendingUp, ReceiptText } from "lucide-react";
import { getSalesStats, getSalesList } from "@/lib/data/sales";
import { Card, CardHeader, CardTitle, CardBody, StatCard, HeroStatCard } from "@/components/ui/card";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { SalesTable } from "@/components/leads/sales-table";
import { MonthlyTrendChart } from "@/components/sales/monthly-trend-chart";
import { SalespersonPerformanceChart } from "@/components/sales/salesperson-performance-chart";
import { formatCurrency } from "@/lib/utils";

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line px-4 py-10 text-center">
      <p className="text-sm font-medium text-ink-900">{title}</p>
      <p className="max-w-sm text-sm text-ink-600">{body}</p>
    </div>
  );
}

export default async function SalesPage() {
  const [stats, salesList] = await Promise.all([getSalesStats(), getSalesList()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-6 shadow-elevated-lg sm:p-7">
        <HvacBackdrop intensity="hero" />
        <div className="relative">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Satışlar</h1>
          <p className="mt-1 text-sm text-white/55">Satış performansınızı ve gerçekleşen sonuçları takip edin.</p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <HeroStatCard label="Toplam Satış Tutarı" value={formatCurrency(stats.totalRevenue)} icon={<Wallet className="h-4 w-4" />} />
            <HeroStatCard label="Potansiyel Satış Değeri" value={formatCurrency(stats.pipelineValue)} icon={<Layers className="h-4 w-4" />} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatCard label="Toplam Satış" value={stats.totalSales} tone="success" />
        <StatCard label="Ortalama Satış Değeri" value={formatCurrency(stats.avgSaleValue)} tone="accent" />
        <StatCard label="Satışa Dönüşüm Oranı" value={`%${stats.conversionRate.toFixed(1)}`} tone="brand" />
        <StatCard label="Toplam Lead" value={stats.totalLeads} tone="ink" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card hoverable className="animate-slide-up lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-ink-400" />
              Aylık Satış Trendi
            </CardTitle>
          </CardHeader>
          <CardBody>
            {stats.hasAnySale ? (
              <MonthlyTrendChart data={stats.monthlyTrend} />
            ) : (
              <EmptyState
                title="Henüz gerçekleşmiş satış yok"
                body="Bir lead “Satış” durumuna taşındığında burada aylık satış trendi olarak görünecek."
              />
            )}
          </CardBody>
        </Card>

        <Card hoverable className="animate-slide-up">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-ink-400" />
              Satış Personeli Performansı
            </CardTitle>
          </CardHeader>
          <CardBody>
            {stats.bySalesperson.length === 0 ? (
              <EmptyState title="Veri yok" body="Satış gerçekleştiğinde personel bazlı performans burada listelenecek." />
            ) : (
              <SalespersonPerformanceChart data={stats.bySalesperson} />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4 text-ink-400" />
            Kime Ne Satıldı
          </CardTitle>
        </CardHeader>
        <CardBody>
          <SalesTable sales={salesList} />
        </CardBody>
      </Card>

      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-ink-400" />
            Genel Bakış
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="text-sm leading-relaxed text-ink-600">
            Toplam {stats.totalLeads} leadin {stats.totalSales} tanesi satışa dönüştü
            {stats.totalLeads > 0 ? ` (dönüşüm oranı %${stats.conversionRate.toFixed(1)})` : ""}. Açık pipelinedeki{" "}
            {formatCurrency(stats.pipelineValue)} değerindeki fırsatlar henüz sonuçlanmadı.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

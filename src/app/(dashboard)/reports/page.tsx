import { Filter, MapPin, Home, CalendarClock, Tag, CalendarRange } from "lucide-react";
import { getReportsData } from "@/lib/data/reports";
import { Card, CardHeader, CardTitle, CardBody, StatCard } from "@/components/ui/card";
import { MonthlyComparisonPanel } from "@/components/reports/monthly-comparison-panel";
import { formatCurrency } from "@/lib/utils";

function EmptyState({ body }: { body: string }) {
  return (
    <div className="animate-fade-in flex items-center justify-center rounded-xl border border-dashed border-line px-4 py-8 text-center">
      <p className="text-sm text-ink-600">{body}</p>
    </div>
  );
}

function DistributionList({ items, unit }: { items: { label: string; count: number }[]; unit: string }) {
  if (items.length === 0) return <EmptyState body="Henüz veri yok." />;
  const max = Math.max(...items.map((i) => i.count));

  return (
    <div className="flex flex-col gap-2.5">
      {items.map((item, index) => (
        <div key={item.label} className="animate-slide-up flex flex-col gap-1" style={{ animationDelay: `${index * 40}ms` }}>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-ink-900">{item.label}</span>
            <span className="tabular-nums text-ink-600">
              {item.count} {unit}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
            <div
              className="h-full rounded-full bg-accent-500 transition-all duration-500 ease-settle"
              style={{ width: `${(item.count / max) * 100}%`, transitionDelay: `${index * 40}ms` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function ReportsPage() {
  const data = await getReportsData();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-900">Raporlar</h1>
        <p className="text-sm text-ink-600">Satış hunisini ve dağılımları tek ekranda görün.</p>
      </div>

      {data.totalLeads === 0 ? (
        <Card>
          <CardBody>
            <EmptyState body="Henüz hiç lead kaydı yok - raporlar veri geldikçe burada oluşacak." />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
            <StatCard label="Toplam Lead" value={data.totalLeads} tone="brand" />
            <StatCard label="Satışa Dönüşüm" value={`%${data.conversionRate.toFixed(1)}`} tone="success" />
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
              <div className="flex flex-col gap-2">
                {data.funnel.map((stage, index) => {
                  const max = Math.max(1, ...data.funnel.map((s) => s.count));
                  return (
                    <div
                      key={stage.status}
                      className="animate-slide-up flex items-center gap-3"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <span className="w-24 shrink-0 text-xs font-medium text-ink-600">{stage.label}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-500 ease-settle"
                          style={{ width: `${(stage.count / max) * 100}%`, transitionDelay: `${index * 40}ms` }}
                        />
                      </div>
                      <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums text-ink-900">{stage.count}</span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          <div className="grid gap-5 lg:grid-cols-3">
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
            <CardBody>
              <div className="grid grid-cols-3 gap-3.5">
                <StatCard label="Tamamlanan Takip" value={data.followupStats.completed} tone="success" />
                <StatCard label="Bekleyen Takip" value={data.followupStats.pending} tone="brand" />
                <StatCard label="Geciken Takip" value={data.followupStats.overdue} tone="danger" />
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}

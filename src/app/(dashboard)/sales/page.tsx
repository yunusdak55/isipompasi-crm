import { Wallet, Percent, Users, Layers, TrendingUp, ReceiptText } from "lucide-react";
import { getSalesStats, getSalesList } from "@/lib/data/sales";
import { Card, CardHeader, CardTitle, CardBody, StatCard, HeroStatCard } from "@/components/ui/card";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { SalesTable } from "@/components/leads/sales-table";
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
  const maxRevenue = Math.max(1, ...stats.monthlyTrend.map((m) => m.revenue));

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
              <div className="flex h-48 items-stretch justify-between gap-3">
                {stats.monthlyTrend.map((m, index) => (
                  <div
                    key={m.key}
                    className="animate-slide-up flex flex-1 flex-col items-center gap-2"
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    {/* items-end (eski hal) satirdaki her ay sutununu SADECE
                        icerik kadar yukseklige sigdirip h-48'e hic
                        "stretch" etmiyordu - bu yuzden bu kutu (flex-1)
                        buyuyecegi belirli bir yukseklik hic bulamiyor, "auto"
                        kaliyordu. Alttaki .sales-bar-grow'un `height: var(--bar-h)`
                        (bir YUZDE) bu belirsiz/auto yukseklige gore
                        cozumlenemedigi icin CSS spec geregi gorunmez oluyordu -
                        bar hic buyumuyor gibi gorunuyordu (bildirilen bug:
                        "animasyon hala bozuk gözükmüyor"). items-stretch, her
                        ay sutununu h-48'e GERCEKTEN geriyor; boylece bu kutu
                        kesin bir piksel yuksekligi kazaniyor ve --bar-h yuzdesi
                        artik dogru cozumleniyor.

                        Tutar etiketi ARTIK ayri bir satir/flex ogesi degil -
                        bar'in kendi icinde, mutlak konumlu (absolute) olarak
                        barin TAM USTUNE oturtuluyor (spec: "satış miktarı
                        trendin tam üstünde gözüksün aralarına boşluk
                        koyma") - boylece kisa barlarda bile etiket havada
                        asili kalmiyor, barin GERCEK tepe noktasini takip
                        ediyor (buyume animasyonuyla birlikte yukari cikiyor).
                        --bar-h en fazla %82'ye kadar cikar (100 degil) - en
                        yuksek bar bile etikete yer birakir, hicbir zaman
                        kart tepesine yapisip etiketi disariya itmez. */}
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className="sales-bar-grow relative w-full rounded-t-md bg-gradient-to-t from-accent-600 to-accent-400 transition-[filter] duration-150 hover:brightness-110"
                        style={{
                          ["--bar-h" as string]: `${Math.max(3, (m.revenue / maxRevenue) * 82)}%`,
                          animationDelay: `${index * 60}ms`,
                        }}
                      >
                        {m.revenue > 0 ? (
                          <span className="absolute -top-[18px] left-0 right-0 text-center text-[11px] font-medium tabular-nums text-ink-600">
                            {formatCurrency(m.revenue)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-xs font-medium text-ink-600">{m.label}</span>
                    <span className="text-[10px] tabular-nums text-ink-400">{m.count} satış</span>
                  </div>
                ))}
              </div>
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
          <CardBody className="flex flex-col gap-3">
            {stats.bySalesperson.length === 0 ? (
              <EmptyState title="Veri yok" body="Satış gerçekleştiğinde personel bazlı performans burada listelenecek." />
            ) : (
              stats.bySalesperson.map((sp, index) => (
                <div
                  key={sp.name}
                  className="animate-slide-up flex items-center justify-between gap-3 rounded-lg border border-line px-3.5 py-3 transition-colors duration-150 hover:border-brand-200"
                  style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }}
                >
                  <div>
                    <p className="text-sm font-medium text-ink-900">{sp.name}</p>
                    <p className="text-xs text-ink-600">{sp.count} satış</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums text-ink-900">{formatCurrency(sp.revenue)}</p>
                </div>
              ))
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

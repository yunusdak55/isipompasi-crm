import { redirect } from "next/navigation";
import { Building2, Users, Wallet, Layers } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getAgencyCompanyStats } from "@/lib/data/admin";
import { Card, CardHeader, CardTitle, CardBody, StatCard, HeroStatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { CreateCompanyForm } from "@/components/admin/create-company-form";
import { EditCompanyNameForm } from "@/components/admin/edit-company-name-form";
import { formatCurrency } from "@/lib/utils";

/**
 * Ajans admin paneli: hizmet verilen tum firmalarin lead/pipeline/satis
 * performansini tek ekranda karsilastirir - spec: "ajans olarak musterilerimi
 * tek yerden gormek istiyorum". Sadece "admin" (Ajans Admin) rolu erisir.
 */
export default async function AdminCompaniesPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const companies = await getAgencyCompanyStats();

  const totals = companies.reduce(
    (acc, c) => ({
      leadCount: acc.leadCount + c.leadCount,
      pipelineValue: acc.pipelineValue + c.pipelineValue,
      totalSales: acc.totalSales + c.totalSales,
    }),
    { leadCount: 0, pipelineValue: 0, totalSales: 0 }
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-6 shadow-elevated-lg sm:p-7">
        <HvacBackdrop intensity="hero" />
        <div className="relative">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Firmalar</h1>
          <p className="mt-1 text-sm text-white/55">Hizmet verdiğiniz tüm firmaların performansını tek ekrandan karşılaştırın.</p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <HeroStatCard label="Toplam Satış Tutarı" value={formatCurrency(totals.totalSales)} icon={<Wallet className="h-4 w-4" />} />
            <HeroStatCard label="Açık Pipeline Değeri" value={formatCurrency(totals.pipelineValue)} icon={<Layers className="h-4 w-4" />} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        <StatCard label="Toplam Firma" value={companies.length} tone="brand" />
        <StatCard label="Toplam Lead" value={totals.leadCount} tone="ink" />
        <StatCard label="Toplam Satış Tutarı" value={formatCurrency(totals.totalSales)} tone="success" />
      </div>

      <CreateCompanyForm />

      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-ink-400" />
            Firma Karşılaştırması
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {companies.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
              <Users className="mb-1 h-5 w-5 text-ink-400" />
              <p className="text-sm font-medium text-ink-900">Henüz firma yok</p>
              <p className="text-sm text-ink-600">Yeni bir müşteri firma ekledikçe burada listelenecek.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-line text-xs font-medium uppercase tracking-wide text-ink-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Firma</th>
                    <th className="px-5 py-3 font-medium">Lead</th>
                    <th className="px-5 py-3 font-medium">Açık Pipeline</th>
                    <th className="px-5 py-3 font-medium">Toplam Satış</th>
                    <th className="px-5 py-3 font-medium">Dönüşüm</th>
                    <th className="px-5 py-3 font-medium">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {companies.map((c, index) => (
                    <tr
                      key={c.id}
                      className="animate-slide-up transition-colors duration-150 hover:bg-white/[0.03]"
                      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                    >
                      <td className="px-5 py-3.5">
                        <EditCompanyNameForm companyId={c.id} name={c.name} city={c.city} />
                      </td>
                      <td className="px-5 py-3.5 tabular-nums text-ink-900">{c.leadCount}</td>
                      <td className="px-5 py-3.5 tabular-nums text-ink-900">{formatCurrency(c.pipelineValue)}</td>
                      <td className="px-5 py-3.5 tabular-nums text-ink-900">{formatCurrency(c.totalSales)}</td>
                      <td className="px-5 py-3.5 tabular-nums text-ink-900">%{c.conversionRate.toFixed(1)}</td>
                      <td className="px-5 py-3.5">
                        <Badge tone={c.isActive ? "success" : "ink"}>{c.isActive ? "Aktif" : "Pasif"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

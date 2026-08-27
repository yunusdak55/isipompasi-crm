import { redirect } from "next/navigation";
import { Plug } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getIntegrationsGrid, INTEGRATION_PROVIDERS } from "@/lib/data/admin";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { IntegrationStatusSelect } from "@/components/admin/integration-status-select";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { INTEGRATION_PROVIDER_LABELS } from "@/lib/constants/admin";

/**
 * Ajans admin'in hangi musteride hangi entegrasyonun (WhatsApp/Meta Ads/n8n
 * vb.) hangi asamada oldugunu takip ettigi panel. Gercek OAuth/webhook
 * baglantisi bu uygulamanin disinda kurulur (n8n) - burasi sadece durum
 * takibi, gizli anahtar/token TUTMAZ.
 */
export default async function AdminIntegrationsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const grid = await getIntegrationsGrid();

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-6 shadow-elevated-lg sm:p-7">
        <HvacBackdrop intensity="hero" />
        <div className="relative">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Entegrasyonlar</h1>
          <p className="mt-1 text-sm text-white/55">
            Her firma için hangi kanalın (WhatsApp, Meta Ads, n8n vb.) bağlı olduğunu takip edin.
          </p>
        </div>
      </div>

      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-ink-400" />
            Firma Bağlantı Durumları
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {grid.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
              <p className="text-sm font-medium text-ink-900">Henüz firma yok</p>
              <p className="text-sm text-ink-600">Firma ekledikçe burada listelenecek.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-line text-xs font-medium uppercase tracking-wide text-ink-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Firma</th>
                    {INTEGRATION_PROVIDERS.map((provider) => (
                      <th key={provider} className="px-5 py-3 font-medium">
                        {INTEGRATION_PROVIDER_LABELS[provider]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {grid.map((row, index) => (
                    <tr
                      key={row.companyId}
                      className="animate-slide-up transition-colors duration-150 hover:bg-white/[0.03]"
                      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                    >
                      <td className="px-5 py-3.5 font-medium text-ink-900">{row.companyName}</td>
                      {INTEGRATION_PROVIDERS.map((provider) => (
                        <td key={provider} className="px-5 py-3.5">
                          <IntegrationStatusSelect
                            companyId={row.companyId}
                            provider={provider}
                            status={row.statuses[provider]}
                          />
                        </td>
                      ))}
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

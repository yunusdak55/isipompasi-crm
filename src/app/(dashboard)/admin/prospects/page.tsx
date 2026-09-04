import { redirect } from "next/navigation";
import { PhoneCall, CalendarDays, Users } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getProspects } from "@/lib/data/prospects";
import { Card, CardHeader, CardTitle, CardBody, StatCard } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/button";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { CreateProspectForm } from "@/components/admin/create-prospect-form";
import { EditProspectForm } from "@/components/admin/edit-prospect-form";
import { ProspectStatusSelect } from "@/components/admin/prospect-status-select";
import { ProspectFollowupForm } from "@/components/admin/prospect-followup-form";
import { DeleteProspectButton } from "@/components/admin/delete-prospect-button";
import { OverdueBadge } from "@/components/leads/lead-indicators";
import { isLeadOverdue } from "@/lib/utils";

/**
 * Ajansin KENDI musteri adayi (yeni musteri kazanmak icin aradigi isi
 * pompasi kurulumcusu firmalar) takibi. Spec: "aradığım firmaların yaptığım
 * görüşmeleri kayıt edebileceğim, takip edebileceğim, istediğimde kayıp
 * olarak işaretleyebileceğim bir yer - not olsun, numara olsun".
 * Sadece "admin" (Ajans Admin) rolu erisir - leads tablosundaki tenant
 * musteri verisiyle karistirilmamalidir.
 */
export default async function AdminProspectsPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const prospects = await getProspects();

  const openCount = prospects.filter((p) => p.status !== "won" && p.status !== "lost").length;
  const followupCount = prospects.filter((p) => p.status === "followup").length;
  const wonCount = prospects.filter((p) => p.status === "won").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-6 shadow-elevated-lg sm:p-7">
        <HvacBackdrop intensity="hero" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Satış Görüşmeleri</h1>
            <p className="mt-1 text-sm text-white/55">
              Yeni müşteri kazanmak için aradığınız firmaları kaydedin, takip edin, gerekirse kayıp olarak işaretleyin.
            </p>
          </div>
          <LinkButton href="/admin/prospects/calendar" variant="secondary" className="gap-1.5">
            <CalendarDays className="h-4 w-4" />
            Takvim
          </LinkButton>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatCard label="Toplam Aday" value={prospects.length} tone="ink" />
        <StatCard label="Açık" value={openCount} tone="brand" />
        <StatCard label="Takipte" value={followupCount} tone="warning" />
        <StatCard label="Müşteri Oldu" value={wonCount} tone="success" />
      </div>

      <CreateProspectForm />

      <Card className="animate-slide-up">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-ink-400" />
            Müşteri Adayları
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {prospects.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-1 px-4 py-10 text-center">
              <Users className="mb-1 h-5 w-5 text-ink-400" />
              <p className="text-sm font-medium text-ink-900">Henüz aday yok</p>
              <p className="text-sm text-ink-600">Aradığınız firmaları ekledikçe burada listelenecek.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead className="border-b border-line text-xs font-medium uppercase tracking-wide text-ink-600">
                  <tr>
                    <th className="px-5 py-3 font-medium">Firma / İletişim / Not</th>
                    <th className="px-5 py-3 font-medium">Sonraki Takip</th>
                    <th className="px-5 py-3 font-medium">Durum</th>
                    <th className="px-5 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {prospects.map((p, index) => {
                    const overdue = isLeadOverdue({
                      status: p.status,
                      lastContactAt: p.last_contact_at,
                      createdAt: p.created_at,
                      nextFollowupAt: p.next_followup_at,
                    });
                    return (
                      <tr
                        key={p.id}
                        className="animate-slide-up transition-colors duration-150 hover:bg-white/[0.03]"
                        style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
                      >
                        <td className="max-w-[280px] px-5 py-3.5 align-top">
                          <div className="flex items-start gap-1.5">
                            {overdue ? <OverdueBadge className="mt-0.5 shrink-0" /> : null}
                            <EditProspectForm
                              prospectId={p.id}
                              companyName={p.company_name}
                              contactName={p.contact_name}
                              phone={p.phone}
                              notes={p.notes}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          <ProspectFollowupForm
                            prospectId={p.id}
                            nextFollowupAt={p.next_followup_at}
                            nextFollowupNote={p.next_followup_note}
                          />
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          <ProspectStatusSelect prospectId={p.id} status={p.status} />
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          <DeleteProspectButton prospectId={p.id} companyName={p.company_name} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

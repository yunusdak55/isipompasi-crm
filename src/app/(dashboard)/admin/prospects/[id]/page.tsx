import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Phone, Building2 } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getProspectById, getProspectActivities } from "@/lib/data/prospects";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { ProspectStatusBadge } from "@/components/ui/badge";
import { OutcomeForm } from "@/components/shared/outcome-form";
import { FollowupStatusCard } from "@/components/shared/followup-status-card";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import {
  clearProspectFollowupAction,
  logProspectOutcomeAction,
  snoozeProspectFollowupAction,
} from "@/app/(dashboard)/admin/prospects/actions";
import { describeFollowup } from "@/lib/followup";
import { EditProspectForm } from "@/components/admin/edit-prospect-form";
import { OverdueBadge } from "@/components/leads/lead-indicators";
import { isProspectOverdue } from "@/lib/utils";

/**
 * Musteri adayi profili - liste sayfasindaki hizli satir yerine, tek bir
 * adayin TUM gecmisine odaklanan yer (spec: "bu kayıt edilen profillere
 * giriş yaptığımda bir zaman çizelgesi notlar kısmı olsun").
 *
 * DUZELTME (spec 2026-09-30, "birbirini tekrarlayan bilgilerin olduğu
 * kısımlar var... bir yerden belirlerim farklı farklı yerlerden değil"):
 * onceden burada AYRI bir "Durum" karti (dropdown) VE AYRI bir "Sonraki
 * Takip" karti vardi - ikisi de "Görüşme Sonucu" formunun zaten yaptigi
 * ISI ikinci/ucuncu bir yerden yapiyordu. Ikisi de kaldirildi; durum ve
 * bir sonraki takip artik SADECE okunabilir bir ozet olarak ustte
 * gosteriliyor, degistirmenin TEK yolu "Görüşme Sonucu" formu.
 */
export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // PERF: profil, aday ve zaman cizelgesi birbirine bagimli degil - ayni ag turunda
  // (bkz. dashboard/page.tsx); veri RLS'li oturumla okunur.
  const [profile, prospect, activities] = await Promise.all([requireProfile(), getProspectById(id), getProspectActivities(id)]);
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  if (!prospect) {
    notFound();
  }

  const overdue = isProspectOverdue({
    status: prospect.status,
    lastContactAt: prospect.last_contact_at,
    createdAt: prospect.created_at,
    nextFollowupAt: prospect.next_followup_at,
  });

  const followupSummary = describeFollowup(prospect.next_followup_at, overdue);

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/prospects"
        className="group inline-flex w-fit items-center gap-1.5 text-sm text-ink-600 transition-colors duration-150 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-150 ease-snappy group-hover:-translate-x-0.5" />
        Satış Görüşmeleri
      </Link>

      <div className="animate-fade-in flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-500/10 text-accent-500">
              <Building2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {overdue ? <OverdueBadge /> : null}
                <h1 className="truncate text-lg font-semibold text-ink-900">{prospect.company_name}</h1>
              </div>
              <p className="mt-0.5 text-sm text-ink-600">{prospect.contact_name || "İlgili kişi girilmemiş"}</p>
            </div>
          </div>
          {prospect.phone ? (
            <a
              href={`tel:${prospect.phone}`}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent-500/30 bg-accent-500/[0.08] px-3 py-2 text-sm font-medium text-accent-600 transition-colors duration-150 hover:border-accent-500/50 hover:bg-accent-500/[0.14]"
            >
              <Phone className="h-3.5 w-3.5" />
              {prospect.phone}
            </a>
          ) : null}
        </div>

        {/* Durum burada SADECE okunabilir ozet; degistirmenin TEK yolu asagidaki
            "Görüşme Sonucu" formu. Sonraki takip ozeti de ayni kartta (tekrar yok). */}
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3.5">
          <span className="text-xs font-medium text-ink-500">Durum</span>
          <ProspectStatusBadge status={prospect.status} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card className="animate-slide-up">
            <CardHeader>
              <CardTitle>Görüşme Sonucu</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <FollowupStatusCard
                summary={followupSummary}
                snoozeAction={snoozeProspectFollowupAction.bind(null, prospect.id)}
                clearAction={clearProspectFollowupAction.bind(null, prospect.id)}
              />
              <OutcomeForm action={logProspectOutcomeAction.bind(null, prospect.id)} />
            </CardBody>
          </Card>

          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle>Zaman Çizelgesi</CardTitle>
            </CardHeader>
            <CardBody>
              <ActivityTimeline
                items={activities}
                emptyText="Henüz kayıt yok. Görüşme sonucunu yukarıdan ekleyebilirsin."
              />
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle>Firma Bilgileri</CardTitle>
            </CardHeader>
            <CardBody>
              <EditProspectForm
                prospectId={prospect.id}
                companyName={prospect.company_name}
                contactName={prospect.contact_name}
                phone={prospect.phone}
                notes={prospect.notes}
              />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

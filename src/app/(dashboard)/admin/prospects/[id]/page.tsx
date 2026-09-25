import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Phone, Building2 } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getProspectById, getProspectActivities } from "@/lib/data/prospects";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { ProspectStatusSelect } from "@/components/admin/prospect-status-select";
import { ProspectFollowupForm } from "@/components/admin/prospect-followup-form";
import { ProspectNoteForm } from "@/components/admin/prospect-note-form";
import { EditProspectForm } from "@/components/admin/edit-prospect-form";
import { OverdueBadge } from "@/components/leads/lead-indicators";
import { formatDateTime, isProspectOverdue } from "@/lib/utils";

/**
 * Musteri adayi profili - liste sayfasindaki hizli satir yerine, tek bir
 * adayin TUM gecmisine odaklanan yer (spec: "bu kayıt edilen profillere
 * giriş yaptığımda bir zaman çizelgesi notlar kısmı olsun"). leads/[id]
 * ile ayni iskelet: ust bilgi + durum/takip yonetimi, alt tarafta
 * kronolojik zaman cizelgesi (en yeni en ustte, tarih+saat ile).
 */
export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const { id } = await params;
  const prospect = await getProspectById(id);

  if (!prospect) {
    notFound();
  }

  const activities = await getProspectActivities(id);

  const overdue = isProspectOverdue({
    status: prospect.status,
    lastContactAt: prospect.last_contact_at,
    createdAt: prospect.created_at,
    nextFollowupAt: prospect.next_followup_at,
  });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/prospects"
        className="group inline-flex w-fit items-center gap-1.5 text-sm text-ink-600 transition-colors duration-150 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-150 ease-snappy group-hover:-translate-x-0.5" />
        Satış Görüşmeleri
      </Link>

      <div className="animate-fade-in flex items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
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

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle>Zaman Çizelgesi</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-5">
              <ProspectNoteForm prospectId={prospect.id} />

              <div className="border-t border-line pt-4">
                {activities.length === 0 ? (
                  <p className="text-sm text-ink-600">Henüz kayıt yok. İlk notunu yukarıdan ekleyebilirsin.</p>
                ) : (
                  <ol className="flex flex-col gap-4">
                    {activities.map((activity, index) => (
                      <li
                        key={activity.id}
                        className="animate-slide-up flex gap-3 text-sm"
                        style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-500" />
                        <div>
                          <p className="whitespace-pre-wrap text-ink-900">{activity.description}</p>
                          <p className="text-xs text-ink-600">{formatDateTime(activity.created_at)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle>Durum</CardTitle>
            </CardHeader>
            <CardBody>
              <ProspectStatusSelect prospectId={prospect.id} status={prospect.status} />
            </CardBody>
          </Card>

          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle>Sonraki Takip</CardTitle>
            </CardHeader>
            <CardBody>
              <ProspectFollowupForm
                prospectId={prospect.id}
                nextFollowupAt={prospect.next_followup_at}
                nextFollowupNote={prospect.next_followup_note}
              />
            </CardBody>
          </Card>

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

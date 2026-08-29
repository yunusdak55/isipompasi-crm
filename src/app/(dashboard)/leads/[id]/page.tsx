import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, Mail, MapPin, Clock, Tag, FileText, Home, CircleDollarSign } from "lucide-react";
import { getLeadById, getLeadActivities, getAssignableProfiles, getSaleForLead } from "@/lib/data/leads";
import { getSalespeople } from "@/lib/data/salespeople";
import { getCurrentProfile } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { AnimatedStatValue } from "@/components/ui/animated-number";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { NewLeadBadge, OverdueBadge, ContactedBadge } from "@/components/leads/lead-indicators";
import {
  PROPERTY_TYPE_LABELS,
  BUILDING_STATUS_LABELS,
  HEATING_TYPE_LABELS,
  PURCHASE_TIMELINE_LABELS,
} from "@/lib/constants/lead";
import { formatCurrency, formatDate, formatDateTime, isLeadNew, isLeadOverdue } from "@/lib/utils";
import { MeetingOutcomeForm } from "@/components/leads/meeting-outcome-form";
import { FollowupForm } from "@/components/leads/followup-panel";
import { AssignPanel } from "@/components/leads/assign-panel";
import { ContactedByPanel } from "@/components/leads/contacted-by-panel";
import { SalePanel } from "@/components/leads/sale-panel";
import { AgentNotePanel } from "@/components/leads/agent-note-panel";
import type { PropertyType, BuildingStatus, HeatingType, PurchaseTimeline } from "@/lib/types/domain";

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-600">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-900">{value}</dd>
    </div>
  );
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // getLeadById supabase select() icinde alias'li join (assigned_profile)
  // kullaniyor; supabase-js'in otomatik tip cikarimi bu tur takma adli
  // join'leri her zaman birebir yakalayamayabilir - gerekirse ileride bu
  // satir icin elle bir donus tipi tanimlanabilir.
  const lead = await getLeadById(id);

  if (!lead) {
    notFound();
  }

  const [activities, profile] = await Promise.all([getLeadActivities(id), getCurrentProfile()]);

  const canAssign = profile?.role === "owner" || profile?.role === "admin";
  const assignableProfiles = canAssign && lead.company_id ? await getAssignableProfiles(lead.company_id) : [];
  const salespeople = canAssign && lead.company_id ? await getSalespeople(lead.company_id) : [];
  // sales tablosu RLS geregi sadece owner/admin gorebilir ("ciro hassas veri") -
  // sales rolundeyken sorgu bile atilmiyor.
  const sale = canAssign ? await getSaleForLead(id) : null;

  const cityLine = [lead.city, lead.district].filter(Boolean).join(" / ");
  const showNew = isLeadNew(lead.status);
  const showOverdue = isLeadOverdue({
    status: lead.status,
    lastContactAt: lead.last_contact_at,
    createdAt: lead.created_at,
    nextFollowupAt: lead.next_followup_at,
  });

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/leads"
        className="group inline-flex w-fit items-center gap-1.5 text-sm text-ink-600 transition-colors duration-150 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-150 ease-snappy group-hover:-translate-x-0.5" />
        Leadlere dön
      </Link>

      {/* ÜST BÖLÜM: isim, telefon, email, durum, öncelik, satış personeli */}
      <div className="animate-slide-up flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-5 shadow-sm shadow-ink-900/[0.03]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {showOverdue ? <OverdueBadge /> : null}
            <h1 className={`text-xl font-semibold text-ink-900 ${lead.status === "lost" ? "lost-name" : ""}`}>
              {lead.first_name} {lead.last_name ?? ""}
            </h1>
            {showNew ? <NewLeadBadge /> : null}
            {lead.last_contact_at ? <ContactedBadge /> : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" />
              {lead.phone}
            </span>
            {lead.email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {lead.email}
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
            {cityLine ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {cityLine}
              </span>
            ) : null}
            {lead.purchase_timeline ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {PURCHASE_TIMELINE_LABELS[lead.purchase_timeline as PurchaseTimeline]}
              </span>
            ) : null}
            {lead.product_category?.label ? (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                {lead.product_category.label}
              </span>
            ) : null}
            {lead.offered_amount ? (
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                Teklif: {formatCurrency(lead.offered_amount)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <StatusBadge status={lead.status} />
          </div>
          <p className="text-xs text-ink-600">
            Satış Personeli:{" "}
            <span className="font-medium text-ink-900">{lead.assigned_profile?.full_name ?? "Atanmadı"}</span>
          </p>
          <p className="text-xs text-ink-600">
            Görüşen Kişi:{" "}
            <span className="font-medium text-ink-900">{lead.contacted_by_person?.full_name ?? "Belirtilmedi"}</span>
          </p>
          <LinkButton href={`/leads/${id}/edit`} variant="secondary" className="mt-1">
            Düzenle
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* AJAN GÖRÜŞÜ - dogrudan gorunur, duzenlemeye girmeden okunup
              guncellenebilir (spec: "düzenlemeye basmadan görmeyelim"). */}
          <AgentNotePanel leadId={id} notes={lead.notes} />

          {/* YAPILAN SATIŞ - gercek satis tutari, "sales" tablosuna kaydedilir.
              Sadece owner/admin gorur/kaydeder (RLS: ciro hassas veri). */}
          {canAssign ? (
            <Card hoverable className="animate-slide-up border-success-500/25 bg-gradient-to-br from-success-500/[0.12] to-transparent">
              <CardBody className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-500 text-white shadow-elevated">
                    <CircleDollarSign className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-success-700">Yapılan Satış</p>
                    <p className="mt-0.5 text-2xl font-semibold tabular-nums tracking-tight text-ink-900">
                      {sale ? <AnimatedStatValue value={formatCurrency(sale.sale_amount)} /> : "—"}
                    </p>
                  </div>
                </div>
                <div className="sm:w-56">
                  <SalePanel leadId={id} currentSaleAmount={sale?.sale_amount ?? null} />
                </div>
              </CardBody>
            </Card>
          ) : null}

          {/* EV / SİSTEM BİLGİLERİ */}
          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-4 w-4 text-ink-400" />
                Ev / Sistem Bilgileri
              </CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                <InfoItem
                  label="Konut Tipi"
                  value={lead.property_type ? PROPERTY_TYPE_LABELS[lead.property_type as PropertyType] : "—"}
                />
                <InfoItem label="Alan" value={lead.area_m2 ? `${lead.area_m2} m²` : "—"} />
                <InfoItem
                  label="Bina Durumu"
                  value={lead.building_status ? BUILDING_STATUS_LABELS[lead.building_status as BuildingStatus] : "—"}
                />
                <InfoItem
                  label="Mevcut Isıtma"
                  value={lead.heating_type ? HEATING_TYPE_LABELS[lead.heating_type as HeatingType] : "—"}
                />
                <InfoItem label="Yerden Isıtma" value={lead.underfloor_heating ? "Var" : "Yok"} />
                <InfoItem label="Radyatör" value={lead.radiator ? "Var" : "Yok"} />
              </dl>
            </CardBody>
          </Card>

          {/* ZAMAN ÇİZELGESİ - notlar, takip planlamalari ve durum degisiklikleri
              TEK bir kronolojik yerde birlesir (spec: "3 ayrı not kısmı... tek
              kısım olsun, hepsi birbirine bağlı olsun"). Giris noktasi artik
              "Görüşme Sonucu" karti (bkz. sag kolon) - buradaki tek is gecmisi
              okunabilir sekilde listelemek. */}
          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle>Zaman Çizelgesi</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {activities.length === 0 ? (
                <p className="text-sm text-ink-600">
                  Henüz aktivite kaydı yok. Lead {formatDate(lead.created_at)} tarihinde oluşturuldu.
                </p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {activities.map((activity, index) => (
                    <li
                      key={activity.id}
                      className="animate-slide-up flex gap-3 text-sm"
                      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                      <div>
                        <p className="text-ink-900">{activity.description}</p>
                        <p className="text-xs text-ink-600">{formatDateTime(activity.created_at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          {/* GÖRÜŞME SONUCU - durum degistirme ve not yazma TEK formda (spec:
              "görüşmenin sonucuna göre lead durumunu seçsin - görüştük, şöyle
              oldu böyle oldu diye"). */}
          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle>Görüşme Sonucu</CardTitle>
            </CardHeader>
            <CardBody>
              <MeetingOutcomeForm leadId={id} currentStatus={lead.status} />
            </CardBody>
          </Card>

          {/* ATAMA - sadece owner/admin */}
          {canAssign ? (
            <Card hoverable className="animate-slide-up">
              <CardHeader>
                <CardTitle>Satış Personeli Ata</CardTitle>
              </CardHeader>
              <CardBody>
                <AssignPanel
                  leadId={id}
                  currentAssigned={lead.assigned_salesperson}
                  assignableProfiles={assignableProfiles}
                />
              </CardBody>
            </Card>
          ) : null}

          {/* GÖRÜŞEN KİŞİ - firma sahibinin Firma Ayarları'ndan isim bazlı
              tanımladığı kişi (spec: "leadle görüşen kişiyi seçebilelim") -
              yukarıdaki gerçek hesap atamasından bilerek ayrı, bilgi amaçlı. */}
          {canAssign ? (
            <Card hoverable className="animate-slide-up">
              <CardHeader>
                <CardTitle>Görüşen Kişi</CardTitle>
              </CardHeader>
              <CardBody>
                <ContactedByPanel leadId={id} currentContactedBy={lead.contacted_by} salespeople={salespeople} />
              </CardBody>
            </Card>
          ) : null}

          {/* TAKİP */}
          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle>Takip</CardTitle>
            </CardHeader>
            <CardBody>
              <FollowupForm leadId={id} nextFollowupAt={lead.next_followup_at} nextFollowupNote={lead.next_followup_note} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Clock,
  Tag,
  FileText,
  Home,
  Building2,
  Flame,
  Waves,
  Heater,
  CircleDollarSign,
} from "lucide-react";
import { getLeadById, getLeadActivities, getAssignableProfiles, getSaleForLead } from "@/lib/data/leads";
import { getSalespeople } from "@/lib/data/salespeople";
import { getCurrentProfile } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { AnimatedStatValue } from "@/components/ui/animated-number";
import { StatusBadge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { NewLeadBadge, OverdueBadge } from "@/components/leads/lead-indicators";
import {
  PROPERTY_TYPE_LABELS,
  BUILDING_STATUS_LABELS,
  HEATING_TYPE_LABELS,
  PURCHASE_TIMELINE_LABELS,
} from "@/lib/constants/lead";
import { formatCurrency, formatDate, isLeadNew, isLeadOverdue, leadContactPerson, leadDisplayName } from "@/lib/utils";
import { OutcomeForm } from "@/components/shared/outcome-form";
import { FollowupStatusCard } from "@/components/shared/followup-status-card";
import { ActivityTimeline } from "@/components/ui/activity-timeline";
import { ContactPersonPanel, type ContactPersonOption } from "@/components/leads/contact-person-panel";
import { clearLeadFollowupAction, logLeadOutcomeAction, snoozeLeadFollowupAction } from "@/app/(dashboard)/leads/actions";
import { describeFollowup } from "@/lib/followup";
import { SalePanel } from "@/components/leads/sale-panel";
import { AgentNotePanel } from "@/components/leads/agent-note-panel";
import type { PropertyType, BuildingStatus, HeatingType, PurchaseTimeline } from "@/lib/types/domain";

function normalizeName(name: string | null | undefined) {
  return (name ?? "").trim().toLocaleLowerCase("tr-TR");
}

/**
 * TEK "Görüşen Kişi" listesi: isim-bazli kayitlar ("s:") + giris hesaplari
 * ("p:"). Ayni isimli hesap/kayit tek satir olarak gosterilir (isim kaydi
 * kazanir). Mevcut secim pasif/silinmis olsa bile listede kalir ki form
 * yanlislikla "Belirtilmedi"ye dusmesin.
 */
function buildContactOptions(
  salespeople: { id: string; full_name: string; is_active: boolean }[],
  profiles: { id: string; full_name: string | null }[],
  current: { contactedById: string | null; contactedName: string | null; assignedId: string | null; assignedName: string | null }
): ContactPersonOption[] {
  const options: ContactPersonOption[] = [];
  const seen = new Set<string>();

  for (const sp of salespeople) {
    if (!sp.is_active && sp.id !== current.contactedById) continue;
    options.push({ value: `s:${sp.id}`, label: sp.full_name });
    seen.add(normalizeName(sp.full_name));
  }
  for (const p of profiles) {
    if (seen.has(normalizeName(p.full_name))) continue;
    options.push({ value: `p:${p.id}`, label: p.full_name?.trim() || "İsimsiz hesap" });
    seen.add(normalizeName(p.full_name));
  }
  if (current.contactedById && !options.some((o) => o.value === `s:${current.contactedById}`)) {
    options.push({ value: `s:${current.contactedById}`, label: current.contactedName ?? "Silinmiş kişi" });
  }
  if (current.assignedId && !options.some((o) => o.value === `p:${current.assignedId}`) && !current.contactedById) {
    options.push({ value: `p:${current.assignedId}`, label: current.assignedName ?? "Hesap" });
  }
  return options;
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // getLeadById supabase select() icinde alias'li join (assigned_profile)
  // kullaniyor; supabase-js'in otomatik tip cikarimi bu tur takma adli
  // join'leri her zaman birebir yakalayamayabilir - gerekirse ileride bu
  // satir icin elle bir donus tipi tanimlanabilir.
  //
  // PERF DUZELTMESI (denetim: canli tur sirasinda bu sayfa 700-1000ms
  // suruyordu): activities/profile, lead'in SONUCUNA bagli degil - sadece
  // `id`'ye ihtiyaclari var, yine de eskiden lead COZULENE KADAR
  // baslatilmiyordu (sirali/gecikmis network round-trip'leri). Artik
  // UCU BIRDEN paralel baslatiliyor.
  const [lead, activities, profile] = await Promise.all([getLeadById(id), getLeadActivities(id), getCurrentProfile()]);

  if (!lead) {
    notFound();
  }

  // DUZELTME (denetim bulgusu, bkz. dashboard/page.tsx ayni aciklama): admin
  // dogrudan URL ile ([id] tahmin ederek dahil) bu tenant-only sayfaya
  // girebiliyordu.
  if (profile?.role === "admin") {
    redirect("/admin/companies");
  }

  // Admin buraya hic ulasamiyor artik (yukarida yonlendiriliyor), kalan tek "atayabilen" rol owner.
  const canAssign = profile?.role === "owner";
  // Ayni sekilde: bu ucu birbirine BAGIMLI degil, sirayla (await...await...await)
  // degil PARALEL cekilir - sales tablosu RLS geregi sadece owner/admin
  // gorebilir ("ciro hassas veri"), sales rolundeyken sorgu bile atilmaz.
  const [assignableProfiles, salespeople, sale] = await Promise.all([
    canAssign && lead.company_id ? getAssignableProfiles(lead.company_id) : Promise.resolve([]),
    canAssign && lead.company_id ? getSalespeople(lead.company_id) : Promise.resolve([]),
    canAssign ? getSaleForLead(id) : Promise.resolve(null),
  ]);

  const cityLine = [lead.city, lead.district].filter(Boolean).join(" / ");
  const housingText = [
    lead.property_type ? PROPERTY_TYPE_LABELS[lead.property_type as PropertyType] : null,
    lead.area_m2 ? `${lead.area_m2} m²` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const systemInfo = [
    housingText ? { key: "housing", title: "Konut tipi / alan", text: housingText, Icon: Home } : null,
    lead.building_status
      ? { key: "building", title: "Bina durumu", text: BUILDING_STATUS_LABELS[lead.building_status as BuildingStatus], Icon: Building2 }
      : null,
    lead.heating_type
      ? { key: "heating", title: "Mevcut ısıtma", text: HEATING_TYPE_LABELS[lead.heating_type as HeatingType], Icon: Flame }
      : null,
    lead.underfloor_heating ? { key: "underfloor", title: "Yerden ısıtma var", text: "Yerden ısıtma", Icon: Waves } : null,
    lead.radiator ? { key: "radiator", title: "Radyatör var", text: "Radyatör", Icon: Heater } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
  const overdueInput = {
    status: lead.status,
    lastContactAt: lead.last_contact_at,
    createdAt: lead.created_at,
    nextFollowupAt: lead.next_followup_at,
    lastActivityAt: lead.last_activity_at,
  };
  const showOverdue = isLeadOverdue(overdueInput);
  const showNew = isLeadNew(overdueInput);
  const followupSummary = describeFollowup(lead.next_followup_at, showOverdue);
  const contactOptions = buildContactOptions(salespeople, assignableProfiles, {
    contactedById: lead.contacted_by,
    contactedName: lead.contacted_by_person?.full_name ?? null,
    assignedId: lead.assigned_salesperson,
    assignedName: lead.assigned_profile?.full_name ?? null,
  });
  const contactValue = lead.contacted_by ? `s:${lead.contacted_by}` : lead.assigned_salesperson ? `p:${lead.assigned_salesperson}` : "";

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
              {leadDisplayName(lead)}
            </h1>
            {showNew ? <NewLeadBadge /> : null}
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
          {/* EV / SİSTEM BİLGİLERİ - eskiden ayri bir kartti (spec 2026-10-02:
              "gereksiz bir alan açmışsın, müşterinin numarası bölgesi falan
              olan en üstte, sistem bilgileri de orada olsun"). Sadece DOLU
              olanlar gosterilir; hicbiri yoksa satir hic cikmaz. */}
          {systemInfo.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-600">
              {systemInfo.map(({ key, title, text, Icon }) => (
                <span key={key} title={title} className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  {text}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <StatusBadge status={lead.status} />
          </div>
          <p className="text-xs text-ink-600">
            Görüşen Kişi:{" "}
            <span className="font-medium text-ink-900">{leadContactPerson(lead) ?? "Belirtilmedi"}</span>
          </p>
          <LinkButton href={`/leads/${id}/edit`} variant="secondary" className="mt-1">
            Düzenle
          </LinkButton>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          {/* GÖRÜŞME SONUCU - ajans admin panelindeki ile AYNI form (spec
              2026-10-02): "görüşmede ne oldu" notu zaman çizelgesine düşer;
              takip (gün sayısı + not + erteleme/kaldırma), satış ve kayıp
              tek yerden. Eski ayrı "Takip" ve "Durum" girişleri buraya taşındı. */}
          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle>Görüşme Sonucu</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              <FollowupStatusCard
                summary={followupSummary}
                snoozeAction={snoozeLeadFollowupAction.bind(null, id)}
                clearAction={clearLeadFollowupAction.bind(null, id)}
              />
              <OutcomeForm
                action={logLeadOutcomeAction.bind(null, id)}
                askSaleAmount
                canWin={profile?.role !== "sales"}
              />
            </CardBody>
          </Card>

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

          {/* ZAMAN ÇİZELGESİ - notlar, takip planlamalari ve durum degisiklikleri
              TEK bir kronolojik yerde birlesir (spec: "3 ayrı not kısmı... tek
              kısım olsun, hepsi birbirine bağlı olsun"). Giris noktasi artik
              "Görüşme Sonucu" karti (bkz. sag kolon) - buradaki tek is gecmisi
              okunabilir sekilde listelemek. */}
          <Card hoverable className="animate-slide-up">
            <CardHeader>
              <CardTitle>Zaman Çizelgesi</CardTitle>
            </CardHeader>
            <CardBody>
              <ActivityTimeline
                items={activities}
                emptyText={`Henüz aktivite kaydı yok. Lead ${formatDate(lead.created_at)} tarihinde oluşturuldu.`}
              />
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          {/* AJAN GÖRÜŞÜ - dogrudan gorunur, duzenlemeye girmeden okunup
              guncellenebilir (spec: "düzenlemeye basmadan görmeyelim"). */}
          <AgentNotePanel leadId={id} notes={lead.notes} />

          {/* GÖRÜŞEN KİŞİ - TEK kavram (eski "Satış Personeli Ata" + "Görüşen
              Kişi" iki karti birlestirildi). Sadece owner degistirebilir. */}
          {canAssign ? (
            <Card hoverable className="animate-slide-up">
              <CardHeader>
                <CardTitle>Görüşen Kişi</CardTitle>
              </CardHeader>
              <CardBody>
                <ContactPersonPanel leadId={id} currentValue={contactValue} options={contactOptions} />
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

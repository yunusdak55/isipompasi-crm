import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  Compass,
  Target,
  Lightbulb,
  ShieldQuestion,
  Flag,
  PhoneCall,
  Wrench,
  MapPin,
  Users2,
  Gauge,
  Megaphone,
  Inbox,
  Handshake,
} from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/card";
import { FullscreenToggle } from "@/components/ui/fullscreen-toggle";
import { CockpitBackdrop } from "@/components/decor/cockpit-backdrop";
import { SalesJourneyStepper } from "@/components/admin/sales-journey-stepper";
import { cn } from "@/lib/utils";

/**
 * SATIŞ KOKPİTİ - ajans admin'in İklimlen'in kendi hizmetini (reklam + CRM +
 * yapay zeka otomasyonu + marka/icerik) isi pompasi/iklimlendirme
 * kurulumcularina SATARKEN kullandigi baş ucu referansi.
 *
 * TASARIM TARIHCESI (2026-10-01, ucuncu revizyon):
 *  1) Ilk versiyon urunu "bir CRM" gibi sunuyordu -> iklimlen.com'un GERCEK
 *     dort basligina (Musteri Kazanma/Satis Yonetimi/AI&Otomasyon/Marka)
 *     gore duzeltildi.
 *  2) "Kaydiririz sorun yok, kesif sorularini detaylandir" -> 7 kategori,
 *     kategori basina 4 soru (28 soru) eklendi.
 *  3) BU REVIZYON - iki geri bildirim birlikte: (a) "soğuk arama yok, açılış
 *     kısmı KOMPLE gereksiz" -> scriptli Acilis blogu kaldirildi; (b)
 *     "Görev Dağılımı/Garanti/Hizmetlerimiz gibi SİTEDEN ÇALDIĞIN şeyleri
 *     kaldır, ben zaten biliyorum, gereksizin de gereksizi olmuş" -> site
 *     metnini AYNEN tekrar eden 3 bolum (Hizmetlerimiz, Süreç, Görev
 *     Dağılımı&Garanti) tamamen kaldirildi, Kesif Sorulari 7x4'ten 7x3'e
 *     siklastirildi (21 soru), Itirazlar 8'den 6'ya indi. (c) Gorsel
 *     onceligi: "sıradan CRM paneli gibi görünmesin, kontrol merkezi
 *     hissi versin" -> SalesJourneyStepper (yapiskan, IntersectionObserver
 *     ile aktif asama vurgulu "kokpit" seridi), CockpitBackdrop (soyut
 *     enerji halkasi + akis cizgisi SVG, stok gorsel yok), FullscreenToggle
 *     (gercek Fullscreen API) eklendi. Duz metin kutulari yerine (itiraz
 *     karti, teshis/cozum satirlari) gorsel olarak agirlikli kart/rozet
 *     tasarimlarina gecildi. Statik bir HTML prototipinde (ayni renk
 *     token'lariyla) gercekten goruntulenerek dogrulandi, sonra bu
 *     bilesenlere tasindi.
 *
 * Fiyat rakami BILEREK yazilmadi - ajansin kendi ticari karari.
 */

type Tone = "accent" | "success" | "warning" | "ink";

const toneBorder: Record<Tone, string> = {
  accent: "border-l-accent-500",
  success: "border-l-success-500",
  warning: "border-l-warning-500",
  ink: "border-l-ink-400",
};

const toneIconText: Record<Tone, string> = {
  accent: "text-accent-400",
  success: "text-success-500",
  warning: "text-warning-500",
  ink: "text-ink-400",
};

function SectionCard({
  id,
  icon: Icon,
  title,
  meta,
  tone = "ink",
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta?: string;
  tone?: Tone;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className={cn("scroll-mt-24 border-l-[3px]", toneBorder[tone])}>
      <CardHeader className="flex-wrap gap-2">
        <CardTitle className="flex items-center gap-2 text-[15px] font-bold text-white">
          <Icon className={cn("h-[17px] w-[17px]", toneIconText[tone])} />
          {title}
        </CardTitle>
        {meta ? <span className="text-xs text-ink-400">{meta}</span> : null}
      </CardHeader>
      <CardBody className="flex flex-col gap-3.5">{children}</CardBody>
    </Card>
  );
}

type DiscoveryGroup = { icon: React.ComponentType<{ className?: string }>; title: string; questions: string[] };

const DISCOVERY_GROUPS: DiscoveryGroup[] = [
  {
    icon: Wrench,
    title: "Hizmet & Uzmanlık",
    questions: [
      "Hangi hizmetleri veriyorsunuz — ısı pompası, klima, yerden ısıtma?",
      "Konut mu ticari mi ağırlıklı, yoksa ikisi de mi?",
      "Kurulum sonrası bakım/servis veriyor musunuz?",
    ],
  },
  {
    icon: MapPin,
    title: "Bölge & Coğrafya",
    questions: [
      "Hangi şehir/ilçelerde hizmet veriyorsunuz, merkeziniz neresi?",
      "Servis yarıçapınız ne kadar?",
      "Yeni bir bölgeye açılmayı düşünüyor musunuz?",
    ],
  },
  {
    icon: Users2,
    title: "Ekip & Organizasyon",
    questions: [
      "Kaç kişilik ekipsiniz, kim satış kim teknik tarafında?",
      "Keşfe kim gidiyor, teklifi kim hazırlıyor, kapanışı kim yapıyor?",
      "Yoğun dönemde darboğaz nerede oluşuyor?",
    ],
  },
  {
    icon: Gauge,
    title: "Kapasite",
    questions: [
      "Ayda ortalama kaç kurulum/proje kaldırabiliyorsunuz?",
      "Şu an kapasitenizin ne kadarı dolu?",
      "Sezonsallık var mı, hangi aylar en yoğun?",
    ],
  },
  {
    icon: Megaphone,
    title: "Mevcut Pazarlama",
    questions: [
      "Şu an reklam veriyor musunuz, bütçeniz ne kadar?",
      "Web siteniz var mı, satış odaklı mı?",
      "Google Haritalar'da ve sosyal medyada görünürlüğünüz nasıl?",
    ],
  },
  {
    icon: Inbox,
    title: "Mevcut Lead Süreci",
    questions: [
      "Talepler şu an hangi kanallardan geliyor?",
      "Gelen talebi nasıl kayıt/takip ediyorsunuz?",
      "Kaç talepten kaçı satışa dönüyor?",
    ],
  },
  {
    icon: Handshake,
    title: "Ticari & Karar",
    questions: [
      "Ortalama bir satışın/kurulumun değeri ne kadar?",
      "Bu kararı siz mi verirsiniz, ortağınıza mı danışırsınız?",
      "Reklam bütçesiyle hizmet bedelini ayrı düşünüyor musunuz?",
    ],
  },
];

const SYMPTOMS = ["Talep az geliyor", "Takip kaçıyor, unutuluyor", "Telefona yetişemiyoruz", "Bilinirlik zayıf, haritada yokuz"];

const SOLUTIONS = [
  <>Reklamdan gelen talebi <b className="font-semibold text-success-500">biz üretiriz</b>, siz sadece keşfe gidip kapatırsınız.</>,
  <>Her talep <b className="font-semibold text-success-500">otomatik CRM&apos;e</b> düşer, hiçbiri unutulmaz.</>,
  <><b className="font-semibold text-success-500">Yapay zekâ</b> ilk yanıtı anında verir, siz sadece ilgilenene odaklanırsınız.</>,
  <><b className="font-semibold text-success-500">Yerel SEO ve marka içeriğiyle</b> bölgenizde akla gelen isim siz olursunuz.</>,
];

const OBJECTIONS: { q: string; a: string }[] = [
  { q: "Reklam bütçesi ücrete dahil mi?", a: "Hayır. Hizmet bedeli ile reklam bütçesi ayrı — bütçe doğrudan reklamlara gider, şeffaf raporlanır." },
  { q: "Ne kadar sürede sonuç alırım?", a: "İlk 15 günde keşif randevusu garantisi. Gelmezse ücret iade." },
  { q: "Pahalı, bu paraya değer mi?", a: "Ayda kaç talebi kaçırdığınızı ve bir müşterinin ortalama değerini birlikte hesaplayalım." },
  { q: "Zaten bir ajans/CRM kullanıyoruz.", a: "Genel ajans her sektörle çalışır, sizi öğrenmesi zaman alır. Biz sadece bu sektördeyiz." },
  { q: "Gelen talebe yetişemeyiz.", a: "Reklam bütçesini kapasitenize göre ayarlarız — üzerine gidebileceğiniz kadar müşteri." },
  { q: "Düşünmem lazım.", a: "Sorun değil. Karar için hangi bilgi eksik? Net bir tarih koyup o gün tekrar arayayım." },
];

function DiscoveryCard({ group }: { group: DiscoveryGroup }) {
  const Icon = group.icon;
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-white/[0.02] p-3.5 transition-colors duration-150 ease-premium hover:border-accent-500/30 hover:bg-accent-500/[0.03]">
      <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-accent-500/[0.12] text-accent-400">
        <Icon className="h-[15px] w-[15px]" />
      </span>
      <p className="text-[12.5px] font-bold text-white">{group.title}</p>
      <ul className="flex flex-col gap-1.5">
        {group.questions.map((q) => (
          <li key={q} className="flex gap-1.5 text-[12.5px] leading-snug text-ink-600">
            <span className="mt-[6px] h-[3px] w-[3px] shrink-0 rounded-full bg-ink-400" />
            {q}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function ProspectPlaybookPage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/prospects"
        className="group inline-flex w-fit items-center gap-1.5 text-sm text-ink-600 transition-colors duration-150 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-150 ease-snappy group-hover:-translate-x-0.5" />
        Satış Görüşmeleri
      </Link>

      <div id="hero" className="animate-fade-in relative scroll-mt-24 overflow-hidden rounded-[22px] border border-white/[0.08] bg-gradient-to-br from-brand-900 to-brand-950 p-6 sm:p-7">
        <CockpitBackdrop className="opacity-90" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent-300">
              <span className="pulse-ring h-1.5 w-1.5 rounded-full bg-accent-400" />
              Satış Kokpiti
            </span>
            <h1 className="mt-2.5 max-w-xl text-[28px] font-extrabold leading-[1.15] tracking-tight text-white sm:text-[30px]">
              Görüşme sende. <span className="text-accent-400">Sonraki adım net.</span>
            </h1>
            <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-white/55">
              Isı pompası/iklimlendirme kurulumcusuyla görüşme akışı — sırayla ilerle, hangi aşamada olduğun altta her
              an işaretli.
            </p>
          </div>
          <FullscreenToggle />
        </div>
      </div>

      <SalesJourneyStepper />

      <SectionCard id="kesif" icon={Compass} title="İhtiyaç Analizi" meta="Adamla ilgili bilmen gereken her şey" tone="accent">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {DISCOVERY_GROUPS.map((g) => (
            <DiscoveryCard key={g.title} group={g} />
          ))}
        </div>
      </SectionCard>

      <SectionCard id="teshis" icon={Target} title="Teşhis" meta="Duyduğun belirtiyi tanı" tone="warning">
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {SYMPTOMS.map((s) => (
            <div
              key={s}
              className="flex items-center gap-2 rounded-xl border border-warning-500/25 bg-warning-500/[0.08] px-3.5 py-3 text-[12.5px] font-semibold text-ink-900"
            >
              <Target className="h-[15px] w-[15px] shrink-0 text-warning-500" />
              {s}
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard id="cozum" icon={Lightbulb} title="Çözüm" meta="Aynen bunu söyle" tone="success">
        <div className="flex flex-col gap-2">
          {SOLUTIONS.map((sol, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-success-500/20 bg-success-500/[0.06] px-3.5 py-3">
              <Lightbulb className="h-[15px] w-[15px] shrink-0 text-success-500" />
              <p className="text-[13px] leading-relaxed text-ink-900">{sol}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard id="itiraz" icon={ShieldQuestion} title="İtiraz Yönetimi" meta="Önce anla, sonra kısa cevap ver" tone="ink">
        <div className="grid gap-3 sm:grid-cols-2">
          {OBJECTIONS.map((o) => (
            <div key={o.q} className="relative rounded-xl border border-line bg-white/[0.02] py-4 pl-10 pr-4">
              <span className="absolute left-3 top-2.5 select-none font-serif text-[26px] font-bold leading-none text-accent-500/35">
                &ldquo;
              </span>
              <p className="text-[13.5px] font-bold italic text-white">{o.q}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-600">{o.a}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard id="sonraki" icon={Flag} title="Sonraki Adım" tone="accent">
        <div className="flex gap-2.5 rounded-xl border border-accent-500/20 bg-accent-500/[0.05] px-3.5 py-3">
          <PhoneCall className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-400" />
          <p className="text-sm italic leading-relaxed text-ink-900">
            <span className="mr-1.5 not-italic font-semibold text-ink-500">Sonraki adımı al:</span>
            &quot;Anlattıklarımdan hangisi sizi en çok ilgilendirdi? Bir sonraki adım, ekibinizle 20 dakikalık bir
            sistem gösterimi — [gün] [saat] uyar mı?&quot;
          </p>
        </div>
        <div className="flex gap-2.5 rounded-xl border border-accent-500/20 bg-accent-500/[0.05] px-3.5 py-3">
          <PhoneCall className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent-400" />
          <p className="text-sm italic leading-relaxed text-ink-900">
            <span className="mr-1.5 not-italic font-semibold text-ink-500">Erteleme:</span>
            &quot;Sorun değil, bugün karar vermenize gerek yok. Karar için hangi bilgi eksik? [Tarih]&apos;te tekrar
            arayayım.&quot;
          </p>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-danger-500/25 bg-danger-500/[0.06] px-3.5 py-3">
          <ShieldQuestion className="mt-0.5 h-[15px] w-[15px] shrink-0 text-danger-500" />
          <p className="text-xs leading-relaxed text-ink-600">
            <span className="font-semibold text-white">Arama biter bitmez:</span> hemen profildeki &quot;Görüşme
            Sonucu&quot; formunu doldur — ne konuştuğunu, sonraki adımı ve tarihi kaydet.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}

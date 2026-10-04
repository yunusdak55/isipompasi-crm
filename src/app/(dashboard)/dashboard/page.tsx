import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarClock, RefreshCw, Sparkles } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getDashboardToday } from "@/lib/data/dashboard";
import { TodayHero } from "@/components/dashboard/today-hero";
import { TaskSection } from "@/components/dashboard/task-section";
import { PipelineCard } from "@/components/dashboard/pipeline-card";
import { buildTodayView, formatClock, formatTodayLabel, greetingFor } from "@/components/dashboard/view-model";

/**
 * DASHBOARD = "BUGUN NE YAPMALIYIM?" (spec 2026-10-04). Eskiden sadece
 * sayaclar vardi; simdi gunun is listesi: bugunku takipler (saat sirasiyla),
 * geciken takipler (en az geciken en ustte), son 24 saatte gelen yeni leadler,
 * onumuzdeki 7 gunun takip yogunlugu ve satis hatti - hepsi tek veritabani
 * turuyla (migration 0032 dashboard_today).
 *
 * Dil KASITLI olarak "takip" (arama degil): bir takibin telefonla yapilip
 * yapilmadigi sistem tarafindan bilinemez; ekran hicbir sey "aranmadi/
 * tamamlandi" diye varsaymaz.
 */
export default async function DashboardPage() {
  // DUZELTME (denetim bulgusu, 2026-10-01: "çelişki bul"): admin'in KENDI
  // firmasi yok (company_id = null) - bu ve asagidaki diger tum tenant-only
  // sayfalar (leads/*, sales, reports, agent) eskiden SADECE settings/page.tsx'te
  // vardi ("admin -> /admin/companies") ama BURADA hic yoktu. Sidebar admin'e bu
  // linkleri hic GOSTERMEZ ama dogrudan URL ile giren bir admin, RLS'nin admin'e
  // tanidigi TUM-firmalar erisimi yuzunden TUM MUSTERILERIN karisik toplam
  // rakamini goruyordu - kafa karistirici ve tutarsizdi. Artik settings ile
  // AYNI davranis: admin buraya hic giremez, /admin/companies'e yonlendirilir.
  const profile = await requireProfile();
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  const today = await getDashboardToday();

  if (!today.ok) {
    // Sessizce "0 is var" gostermek yaniltici olurdu (veri okunamadiysa
    // kullanici her seyin yolunda oldugunu sanar) - acik hata + yenile.
    return (
      <div className="animate-fade-in mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-line bg-surface px-6 py-14 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-500/15 text-[#ffb4a3] ring-1 ring-inset ring-danger-500/25">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <h1 className="text-base font-semibold text-ink-900">Bugünün listesi yüklenemedi</h1>
        <p className="text-sm text-ink-400">Bağlantıda geçici bir sorun olabilir. Birkaç saniye sonra yeniden deneyin.</p>
        <Link
          href="/dashboard"
          className="mt-2 inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-colors duration-150 hover:bg-accent-600"
        >
          <RefreshCw className="h-4 w-4" />
          Yeniden dene
        </Link>
      </div>
    );
  }

  const now = new Date();
  const view = buildTodayView(today, now);
  const firstName = profile.full_name?.trim().split(/\s+/)[0] ?? null;

  return (
    <div className="stagger flex flex-col gap-6">
      <TodayHero
        greeting={greetingFor(now)}
        firstName={firstName}
        dateLabel={formatTodayLabel(now)}
        today={today}
        week={view.week}
        renderedAt={now.getTime()}
        timeLabel={formatClock(now.toISOString())}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-6">
          <TaskSection
            id="bugun"
            title="Bugünkü Takipler"
            icon={<CalendarClock className="h-4 w-4" />}
            tone="accent"
            count={today.counts.due}
            countLabel={today.counts.dueCarry > 0 ? `saat sırasıyla · ${today.counts.dueCarry} tanesi dünden kaldı` : "saat sırasıyla"}
            items={view.due}
            agenda
            moreHref="/leads/followups"
            moreLabel="Takipte'de gör"
            remaining={today.counts.due - view.due.length}
            emptyTitle="Bugün için planlı takip yok"
            emptyBody="Bir müşteriye takip tarihi verdiğinizde, saat sırasıyla burada görünür."
          />

          <TaskSection
            id="yeni"
            title="Yeni Gelenler"
            icon={<Sparkles className="h-4 w-4" />}
            tone="success"
            count={today.counts.fresh}
            countLabel="son 24 saat"
            items={view.fresh}
            moreHref="/leads"
            moreLabel="Leadler'de gör"
            remaining={today.counts.fresh - view.fresh.length}
            emptyTitle="Yeni lead yok"
            emptyBody="Son 24 saatte yeni bir müşteri gelmedi."
          />
        </div>

        <div className="flex flex-col gap-6">
          <TaskSection
            id="geciken"
            title="Geciken Takipler"
            icon={<AlertTriangle className="h-4 w-4" />}
            tone="danger"
            count={today.counts.overdue}
            countLabel="en az geciken önce"
            items={view.overdue}
            moreHref="/leads/overdue"
            moreLabel="Gecikenler'de gör"
            remaining={today.counts.overdue - view.overdue.length}
            emptyTitle="Geciken takip yok"
            emptyBody="Takibe aldığınız hiçbir müşterinin tarihi 24 saatten fazla geçmemiş."
          />

          <PipelineCard today={today} />
        </div>
      </div>
    </div>
  );
}

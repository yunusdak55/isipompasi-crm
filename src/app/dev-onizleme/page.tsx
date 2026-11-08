import { notFound } from "next/navigation";
import { now as nowMs } from "@/lib/perf-log";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardLive } from "@/components/dashboard/dashboard-live";
import type { Profile } from "@/lib/types/domain";
import type { DashboardToday, TodayLead } from "@/lib/data/dashboard";

/**
 * YALNIZ YEREL GELISTIRME: gorsel dil calismasi icin kabuk + Dashboard'u ORNEK
 * veriyle, giris yapmadan ve veritabanina hic dokunmadan gosterir. Canli
 * derlemede (NODE_ENV=production) sayfa yoktur (404); proxy de bu yolu yalniz
 * gelistirmede acik sayar (bkz. src/proxy.ts).
 */
export default function DevPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const now = nowMs();
  const h = (hours: number) => new Date(now + hours * 3_600_000).toISOString();
  const lead = (id: string, first: string, last: string, city: string, status: string, followup: number | null, created: number, amount: number | null = null): TodayLead => ({
    id,
    first_name: first,
    last_name: last,
    phone: "05xx xxx xx xx",
    city,
    status,
    offered_amount: amount,
    next_followup_at: followup === null ? null : h(followup),
    created_at: h(created),
  });

  const today: DashboardToday = {
    ok: true,
    counts: { overdue: 2, due: 5, dueCarry: 1, fresh: 3 },
    week: [5, 3, 6, 2, 4, 1, 3],
    month: { salesCount: 2, revenue: 450000 },
    due: [
      lead("d1", "Ayşe", "Kaya", "Samsun", "followup", 1, -60),
      lead("d2", "Mehmet", "Demir", "Ordu", "discovery_offer", 2, -90, 185000),
      lead("d3", "Zeynep", "Çelik", "Samsun", "new", 3, -20),
      lead("d4", "Ali", "Yıldız", "Giresun", "followup", 5, -200),
      lead("d5", "Elif", "Aydın", "Amasya", "discovery_offer", -2, -48, 240000),
    ],
    overdue: [
      lead("o1", "Hasan", "Öztürk", "Tokat", "followup", -30, -300),
      lead("o2", "Fatma", "Arslan", "Samsun", "discovery_offer", -52, -400, 160000),
    ],
    fresh: [
      lead("f1", "Burak", "Şahin", "Samsun", "new", null, -2),
      lead("f2", "Merve", "Koç", "Ordu", "new", null, -6),
      lead("f3", "Can", "Kurt", "Çorum", "new", null, -14),
    ],
    stats: { totalLeads: 48, byStatus: [], pipelineValue: 1240000, leadChangePct: null, offerChangePct: null, saleChangePct: null },
  };

  const profile = {
    id: "dev",
    company_id: "dev",
    role: "owner",
    full_name: "Yunus Dak",
    email: "ornek@firma.com",
    phone: null,
    is_active: true,
    created_at: h(-1000),
    updated_at: h(-1000),
  } as Profile;

  return (
    <AppShell profile={profile} companyName="Örnek Isı Sistemleri" dueFollowups={[]}>
      <DashboardLive initial={{ today, now }} firstName="Yunus" live={false} />
    </AppShell>
  );
}

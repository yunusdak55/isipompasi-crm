import { redirect } from "next/navigation";
import { Users, Wallet } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/data/dashboard";
import { StatCard, HeroStatCard } from "@/components/ui/card";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { LEAD_STATUS_LABELS, LEAD_STATUS_COLOR } from "@/lib/constants/lead";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  // DUZELTME (denetim bulgusu, 2026-10-01: "çelişki bul"): admin'in KENDI
  // firmasi yok (company_id = null) - bu ve asagidaki diger tum tenant-only
  // sayfalar (leads/*, sales, reports, agent) eskiden SADECE settings/page.tsx'te
  // vardi ("admin -> /admin/companies") ama BURADA hic yoktu. Sidebar admin'e bu
  // linkleri hic GOSTERMEZ ama dogrudan URL ile giren bir admin, RLS'nin admin'e
  // tanidigi TUM-firmalar erisimi yuzunden "Firmanızın güncel satış hattı durumu"
  // basligi altinda TUM MUSTERILERIN karisik toplam rakamini goruyordu - kafa
  // karistirici ve tutarsizdi. Artik settings ile AYNI davranis: admin buraya
  // hic giremez, /admin/companies'e yonlendirilir.
  const profile = await requireProfile();
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  const stats = await getDashboardStats();

  return (
    <div className="flex flex-col gap-6">
      {/* HERO - lacivert zemin + jenerik teknik atmosfer + oncelikli 2 metrik.
          Marka kimligi burada tek bir bilesende bulusuyor: koyu yuzey,
          turuncu vurgu, kontrollu derinlik (spec md.9). */}
      <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-6 shadow-elevated-lg sm:p-7">
        <HvacBackdrop intensity="hero" />
        <div className="relative">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Genel Bakış</h1>
          <p className="mt-1 text-sm text-white/55">Firmanızın güncel satış hattı durumu.</p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <HeroStatCard label="Toplam Lead" value={stats.totalLeads} icon={<Users className="h-4 w-4" />} />
            <HeroStatCard
              label="Potansiyel Satış Değeri"
              value={formatCurrency(stats.pipelineValue)}
              icon={<Wallet className="h-4 w-4" />}
            />
          </div>
        </div>
      </div>

      {/* Pipeline asama sayaclari - renk noktalari LEAD_STATUS_COLOR ile ayni
          "sicaklik" hikayesini tasir: lacivert (yeni) -> turuncu (isiniyor) ->
          yesil (kazanildi) / kirmizi (kayip). */}
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
        {stats.byStatus.map((item) => (
          <StatCard
            key={item.status}
            label={LEAD_STATUS_LABELS[item.status]}
            value={item.count}
            tone={LEAD_STATUS_COLOR[item.status] as "brand" | "accent" | "success" | "danger" | "warning" | "ink"}
          />
        ))}
      </div>
    </div>
  );
}

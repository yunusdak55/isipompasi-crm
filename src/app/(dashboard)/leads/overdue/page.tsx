import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getLeadsOverdue } from "@/lib/data/leads";
import { OverdueTable } from "@/components/leads/overdue-table";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";

export default async function OverduePage() {
  // DUZELTME (denetim bulgusu, bkz. dashboard/page.tsx ayni aciklama).
  // PERF: profil ile veri ayni ag turunda (bkz. dashboard/page.tsx).
  const [profile, leads] = await Promise.all([requireProfile(), getLeadsOverdue()]);
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />
      <div className="relative flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Gecikenler</h1>
          <p className="text-sm text-white/55">
            {leads.length} lead: takibe alınmış ve takip tarihinin üzerinden 24 saatten fazla geçmiş — en az geciken en üstte (1 gün, 2 gün, 5 gün…).
          </p>
        </div>

        <OverdueTable leads={leads} />
      </div>
    </div>
  );
}

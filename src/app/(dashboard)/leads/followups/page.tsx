import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getFollowupStageWithoutDate, getLeadsFollowup } from "@/lib/data/leads";
import { FollowupTable } from "@/components/leads/followup-table";
import { UndatedFollowupNotice } from "@/components/leads/undated-followup-notice";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";

export default async function FollowupsPage() {
  // DUZELTME (denetim bulgusu, bkz. dashboard/page.tsx ayni aciklama).
  // PERF: profil ile veri ayni ag turunda (bkz. dashboard/page.tsx).
  const [profile, leads, undated] = await Promise.all([requireProfile(), getLeadsFollowup(), getFollowupStageWithoutDate()]);
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />
      <div className="relative flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Takipte</h1>
          <p className="text-sm text-white/55">
            Takip tarihi belirlenmiş {leads.length} lead. Yaklaşanlar en yakın tarihten, gecikenler en az gecikenden başlar.
          </p>
        </div>

        <UndatedFollowupNotice count={undated.count} leads={undated.leads} />

        <FollowupTable leads={leads} />
      </div>
    </div>
  );
}

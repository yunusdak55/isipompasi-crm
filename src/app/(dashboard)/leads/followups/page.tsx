import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getFollowupStageWithoutDate, getLeadsFollowup } from "@/lib/data/leads";
import { FollowupTable } from "@/components/leads/followup-table";
import { UndatedFollowupNotice } from "@/components/leads/undated-followup-notice";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";

export default async function FollowupsPage() {
  // DUZELTME (denetim bulgusu, bkz. dashboard/page.tsx ayni aciklama).
  const profile = await requireProfile();
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  const [leads, undated] = await Promise.all([getLeadsFollowup(), getFollowupStageWithoutDate()]);

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />
      <div className="relative flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Takipte</h1>
          <p className="text-sm text-white/55">
            Takip tarihi belirlenmiş {leads.length} lead — önce bugünkü takipler, sonra gecikenler (en az geciken önce), sonra gelecek takipler.
          </p>
        </div>

        <UndatedFollowupNotice count={undated.count} leads={undated.leads} />

        <FollowupTable leads={leads} />
      </div>
    </div>
  );
}

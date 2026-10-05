import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getLastNotesByProspect, getProspectsFollowup } from "@/lib/data/prospects";
import { ProspectFollowupSegments } from "@/components/admin/prospect-followup-segments";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";

export default async function ProspectsFollowupsPage() {
  // PERF: profil ile veri ayni ag turunda (bkz. dashboard/page.tsx); veri RLS'li oturumla okunur.
  const [profile, prospects, lastNotes] = await Promise.all([requireProfile(), getProspectsFollowup(), getLastNotesByProspect()]);
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />
      <div className="relative flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Takipte</h1>
          <p className="text-sm text-white/55">
            Takip tarihi verdiğiniz {prospects.length} aday. Yaklaşanlar en yakın tarihten, gecikenler en az gecikenden başlar.
          </p>
        </div>

        <ProspectFollowupSegments prospects={prospects} lastNotes={lastNotes} />
      </div>
    </div>
  );
}

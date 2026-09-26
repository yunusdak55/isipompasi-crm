import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { getLastNotesByProspect, getProspectsOverdue } from "@/lib/data/prospects";
import { ProspectFollowupTable } from "@/components/admin/prospect-followup-table";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";

/** "Gecikenler" (spec: "gecikenlere takip tarihi geçen müşterileri koy"). */
export default async function ProspectsOverduePage() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    redirect("/dashboard");
  }

  const [prospects, lastNotes] = await Promise.all([getProspectsOverdue(), getLastNotesByProspect()]);

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />
      <div className="relative flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Gecikenler</h1>
          <p className="text-sm text-white/55">
            Takip tarihi geçmiş {prospects.length} aday, en eski tarihten başlayarak sıralı. Adaya girip görüşme sonucunu
            kaydedince listeden çıkar.
          </p>
        </div>

        <ProspectFollowupTable
          prospects={prospects}
          lastNotes={lastNotes}
          emptyTitle="Geciken aday yok"
          emptyBody="Takip tarihi geçen ve henüz sonuçlanmamış aday yok."
        />
      </div>
    </div>
  );
}

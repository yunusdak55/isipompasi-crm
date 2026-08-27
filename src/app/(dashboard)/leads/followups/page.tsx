import { getLeadsFollowup } from "@/lib/data/leads";
import { FollowupTable } from "@/components/leads/followup-table";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";

export default async function FollowupsPage() {
  const leads = await getLeadsFollowup();

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />
      <div className="relative flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Takipte</h1>
          <p className="text-sm text-white/55">
            Takip tarihi belirlenmiş {leads.length} lead, en yakın tarihten başlayarak sıralı.
          </p>
        </div>

        <FollowupTable leads={leads} />
      </div>
    </div>
  );
}

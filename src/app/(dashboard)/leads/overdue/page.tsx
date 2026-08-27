import { getLeadsOverdue } from "@/lib/data/leads";
import { OverdueTable } from "@/components/leads/overdue-table";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";

export default async function OverduePage() {
  const leads = await getLeadsOverdue();

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />
      <div className="relative flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Gecikenler</h1>
          <p className="text-sm text-white/55">
            {leads.length} lead ile 48 saatten uzun süredir görüşülmedi — en uzun süredir bekleyen önce.
          </p>
        </div>

        <OverdueTable leads={leads} />
      </div>
    </div>
  );
}

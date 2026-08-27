import Link from "next/link";
import { List } from "lucide-react";
import { getLeadsForBoard } from "@/lib/data/leads";
import { KanbanBoard } from "@/components/leads/kanban-board";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { requireProfile } from "@/lib/auth/session";

export default async function LeadsBoardPage() {
  const [leadsByStatus, profile] = await Promise.all([getLeadsForBoard(), requireProfile()]);
  // "sales" rolu ciro/tutar giremiyor (RLS: ciro hassas veri) - bu yuzden
  // "Satış"a tasirken tutar modali sadece owner/admin'e gosterilir, sales
  // icin eskisi gibi duz durum degisikligi yapilir (bkz. KanbanBoard).
  const canRecordSale = profile.role !== "sales";

  return (
    <div className="animate-fade-in relative flex h-full flex-col gap-5 overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-white">Potansiyel Müşterilerin Takibi</h1>
          <p className="text-sm text-white/55">Satış sürecindeki potansiyel müşterilerinizi tek ekrandan yönetin.</p>
        </div>
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.07] px-3.5 py-2 text-sm font-medium text-white transition-all duration-150 ease-snappy hover:border-white/25 hover:bg-white/[0.12] active:scale-[0.97]"
        >
          <List className="h-4 w-4" />
          Liste Görünümü
        </Link>
      </div>

      <div className="relative flex min-h-0 flex-1">
        <KanbanBoard initialLeadsByStatus={leadsByStatus} canRecordSale={canRecordSale} />
      </div>
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutGrid } from "lucide-react";
import { requireProfile } from "@/lib/auth/session";
import { getLeads } from "@/lib/data/leads";
import { getDashboardStats } from "@/lib/data/dashboard";
import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadTable } from "@/components/leads/lead-table";
import { LinkButton } from "@/components/ui/button";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
import { cn } from "@/lib/utils";
import { LEAD_STATUS_LABELS } from "@/lib/constants/lead";
import type { LeadStatus } from "@/lib/types/domain";

const PAGE_SIZE = 20;

type LeadsSearchParams = { q?: string; status?: string; page?: string };

function buildPageHref(params: LeadsSearchParams, page: number) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.status) sp.set("status", params.status);
  sp.set("page", String(page));
  return `/leads?${sp.toString()}`;
}

function buildStatusHref(params: LeadsSearchParams, status: LeadStatus | null) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (status) sp.set("status", status);
  return `/leads?${sp.toString()}`;
}

/**
 * GUCLENDIRME (spec 2026-10-01: "Leadler kısmı... en kolaylığı sağladığı
 * açıyla"). Tek bakista pipeline dagilimini gosteren, AYNI ZAMANDA tek
 * tikla filtreleyen rozet seridi - dashboard'daki sayilarla AYNI RPC'den
 * (dashboard_stats) besleniyor, ayrica bir sorgu/mantik icat edilmedi.
 */
function StatusOverviewStrip({
  byStatus,
  totalLeads,
  activeStatus,
  params,
}: {
  byStatus: { status: LeadStatus; count: number }[];
  totalLeads: number;
  activeStatus: LeadStatus | undefined;
  params: LeadsSearchParams;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href={buildStatusHref(params, null)}
        className={cn(
          "rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ease-snappy",
          !activeStatus
            ? "border-accent-400/50 bg-accent-500/[0.12] text-white shadow-glow-accent"
            : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
        )}
      >
        Tümü <span className="tabular-nums opacity-70">({totalLeads})</span>
      </Link>
      {byStatus.map(({ status, count }) => (
        <Link
          key={status}
          href={buildStatusHref(params, status)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 ease-snappy",
            activeStatus === status
              ? "border-accent-400/50 bg-accent-500/[0.12] text-white shadow-glow-accent"
              : "border-white/10 text-white/55 hover:border-white/25 hover:text-white/80"
          )}
        >
          {LEAD_STATUS_LABELS[status]} <span className="tabular-nums opacity-70">({count})</span>
        </Link>
      ))}
    </div>
  );
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<LeadsSearchParams>;
}) {
  // DUZELTME (denetim bulgusu, bkz. dashboard/page.tsx ayni aciklama): admin
  // bu tenant-only sayfaya dogrudan URL ile giremesin diye yonlendirme eklendi.
  const params = await searchParams;
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const status = (params.status as LeadStatus | undefined) || undefined;

  // PERF (jet hizi, oturumun geri kalaniyla ayni desen): ucu birbirinden
  // BAGIMSIZ - sirali degil paralel cekiliyor (profil dahil, bkz. dashboard/page.tsx).
  const [profile, { leads, count, pageSize }, dashboardStats] = await Promise.all([
    requireProfile(),
    getLeads({ search: params.q, status, page, pageSize: PAGE_SIZE }),
    getDashboardStats(),
  ]);
  if (profile.role === "admin") {
    redirect("/admin/companies");
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Leadler</h1>
            <p className="text-sm text-white/55">
              {count} lead bulundu <span className="text-white/35">· eklenme tarihine göre, en yeni en üstte</span>
            </p>
          </div>
          <div className="flex gap-2">
            <LinkButton href="/leads/board" variant="secondary">
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </LinkButton>
            <LinkButton href="/leads/new">Yeni Lead</LinkButton>
          </div>
        </div>

        <StatusOverviewStrip
          byStatus={dashboardStats.byStatus}
          totalLeads={dashboardStats.totalLeads}
          activeStatus={status}
          params={params}
        />

        <LeadFilters defaultSearch={params.q} defaultStatus={params.status} />

        <LeadTable leads={leads} />

        {totalPages > 1 ? (
          <div className="flex items-center justify-between text-sm text-white/55">
            <span>
              Sayfa {page} / {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <LinkButton variant="secondary" href={buildPageHref(params, page - 1)}>
                  Önceki
                </LinkButton>
              ) : null}
              {page < totalPages ? (
                <LinkButton variant="secondary" href={buildPageHref(params, page + 1)}>
                  Sonraki
                </LinkButton>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

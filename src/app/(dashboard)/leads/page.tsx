import { LayoutGrid } from "lucide-react";
import { getLeads } from "@/lib/data/leads";
import { LeadFilters } from "@/components/leads/lead-filters";
import { LeadTable } from "@/components/leads/lead-table";
import { LinkButton } from "@/components/ui/button";
import { HvacBackdrop } from "@/components/decor/hvac-backdrop";
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

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<LeadsSearchParams>;
}) {
  const params = await searchParams;
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const status = (params.status as LeadStatus | undefined) || undefined;

  const { leads, count, pageSize } = await getLeads({
    search: params.q,
    status,
    page,
    pageSize: PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(count / pageSize));

  return (
    <div className="animate-fade-in relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-900 to-brand-950 p-5 shadow-elevated-lg sm:p-6">
      <HvacBackdrop intensity="ambient" />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white">Leadler</h1>
            <p className="text-sm text-white/55">{count} lead bulundu</p>
          </div>
          <div className="flex gap-2">
            <LinkButton href="/leads/board" variant="secondary">
              <LayoutGrid className="h-4 w-4" />
              Kanban
            </LinkButton>
            <LinkButton href="/leads/new">Yeni Lead</LinkButton>
          </div>
        </div>

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

"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { OverdueBadge } from "@/components/leads/lead-indicators";
import { isLeadOverdue, formatDateTime } from "@/lib/utils";
import type { LeadListItem } from "@/lib/data/leads";

export type CalendarCell = {
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  leads: LeadListItem[];
};

const TR_WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/**
 * Takvim ay izgarasi + gun detay modali. Eskiden bir gunde 3'ten fazla
 * takip/kesif varsa sadece "+N daha" yazip hicbir yere gitmiyordu (spec:
 * "26 Eylül'de takip edilmesi gereken kişiler tam görünmüyor, +2 daha
 * yazmış, oraya basınca o günün takip listesi görünsün") - artik o etikete
 * (ya da gun hucresine) tiklayinca o gunun TAM listesini gosteren bir
 * modal aciliyor.
 */
export function CalendarGrid({ cells, monthLabel }: { cells: CalendarCell[]; monthLabel: string }) {
  const [openDay, setOpenDay] = useState<CalendarCell | null>(null);

  return (
    <>
      <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-white/40">
        {TR_WEEKDAYS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((cell, i) => {
          if (!cell.inMonth) {
            return <div key={i} className="min-h-[92px] rounded-lg border border-transparent" />;
          }

          const hasOverflow = cell.leads.length > 3;

          return (
            <button
              key={i}
              type="button"
              disabled={cell.leads.length === 0}
              onClick={() => setOpenDay(cell)}
              className={
                "flex min-h-[92px] flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors duration-150 " +
                "border-white/10 bg-white/[0.03] " +
                (cell.leads.length > 0 ? "cursor-pointer hover:border-accent-500/40 hover:bg-white/[0.06]" : "cursor-default")
              }
            >
              <span
                className={
                  "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium " +
                  (cell.isToday ? "bg-accent-500 text-white" : "text-white/50")
                }
              >
                {cell.dayNum}
              </span>
              <div className="flex flex-col gap-1">
                {cell.leads.slice(0, 3).map((lead) => {
                  const overdue = isLeadOverdue({
                    status: lead.status,
                    lastContactAt: lead.last_contact_at,
                    createdAt: lead.created_at,
                    nextFollowupAt: lead.next_followup_at,
                  });
                  return (
                    <span
                      key={lead.id}
                      className="truncate rounded border border-accent-500/25 bg-accent-500/[0.12] px-1.5 py-0.5 text-[11px] font-medium text-accent-200"
                    >
                      {overdue ? <OverdueBadge className="mr-1 px-1 py-0 text-[8px]" /> : null}
                      {lead.first_name} {lead.last_name ?? ""}
                    </span>
                  );
                })}
                {hasOverflow ? (
                  <span className="pulse-ring rounded border border-accent-400/40 bg-accent-500/[0.2] px-1.5 py-0.5 text-center text-[10px] font-semibold text-accent-100">
                    +{cell.leads.length - 3} daha
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {openDay ? (
        <div
          className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpenDay(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="animate-scale-in flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/10 bg-brand-950 shadow-elevated-lg"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-white">
                  {openDay.dayNum} {monthLabel}
                </p>
                <p className="text-xs text-white/50">{openDay.leads.length} takip/keşif planlanmış</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenDay(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition-colors duration-150 hover:bg-white/[0.08] hover:text-white"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="scrollbar-kanban flex flex-col gap-1.5 overflow-y-auto p-3">
              {openDay.leads.map((lead, index) => {
                const overdue = isLeadOverdue({
                  status: lead.status,
                  lastContactAt: lead.last_contact_at,
                  createdAt: lead.created_at,
                  nextFollowupAt: lead.next_followup_at,
                });
                return (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="animate-slide-up flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 transition-colors duration-150 hover:border-accent-400/40 hover:bg-white/[0.08]"
                    style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {overdue ? <OverdueBadge className="shrink-0" /> : null}
                      <span className="truncate text-sm font-medium text-white">
                        {lead.first_name} {lead.last_name ?? ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-white/45">
                      {lead.next_followup_at ? formatDateTime(lead.next_followup_at) : ""}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

"use client";

import { useState } from "react";
import { X, Phone } from "lucide-react";
import { OverdueBadge } from "@/components/leads/lead-indicators";
import { isLeadOverdue } from "@/lib/utils";
import type { AgencyProspect } from "@/lib/types/domain";

export type ProspectCalendarCell = {
  dayNum: number;
  inMonth: boolean;
  isToday: boolean;
  prospects: AgencyProspect[];
};

const TR_WEEKDAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
const TIME_FORMATTER = new Intl.DateTimeFormat("tr-TR", { hour: "2-digit", minute: "2-digit" });

/**
 * Görüşme takvimi ay izgarasi + gun detay modali - leads/calendar-grid.tsx
 * ile AYNI desen (spec: "firmanın kullandığı panele benzer"). Aday satirlari
 * SAAT ile birlikte gosterilir (spec: "zaman dilimiyle beraber takip") ve
 * detay sayfasi olmadigi icin (adaylar liste sayfasinda duzenleniyor) modal
 * dogrudan aranabilir bir telefon linki sunar - "kimi ne zaman arayacagim"
 * sorusuna tek ekranda cevap.
 */
export function ProspectCalendarGrid({ cells, monthLabel }: { cells: ProspectCalendarCell[]; monthLabel: string }) {
  const [openDay, setOpenDay] = useState<ProspectCalendarCell | null>(null);

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

          const hasOverflow = cell.prospects.length > 3;

          return (
            <button
              key={i}
              type="button"
              disabled={cell.prospects.length === 0}
              onClick={() => setOpenDay(cell)}
              className={
                "flex min-h-[92px] flex-col gap-1 rounded-lg border p-1.5 text-left transition-colors duration-150 " +
                "border-white/10 bg-white/[0.03] " +
                (cell.prospects.length > 0 ? "cursor-pointer hover:border-accent-500/40 hover:bg-white/[0.06]" : "cursor-default")
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
                {cell.prospects.slice(0, 3).map((p) => {
                  const overdue = isLeadOverdue({
                    status: p.status,
                    lastContactAt: p.last_contact_at,
                    createdAt: p.created_at,
                    nextFollowupAt: p.next_followup_at,
                  });
                  return (
                    <span
                      key={p.id}
                      className="truncate rounded border border-accent-500/25 bg-accent-500/[0.12] px-1.5 py-0.5 text-[11px] font-medium text-accent-200"
                      title={`${TIME_FORMATTER.format(new Date(p.next_followup_at as string))} — ${p.company_name}`}
                    >
                      {overdue ? <OverdueBadge className="mr-1 px-1 py-0 text-[8px]" /> : null}
                      <span className="text-accent-100/80">{TIME_FORMATTER.format(new Date(p.next_followup_at as string))}</span>{" "}
                      {p.company_name}
                    </span>
                  );
                })}
                {hasOverflow ? (
                  <span className="pulse-ring rounded border border-accent-400/40 bg-accent-500/[0.2] px-1.5 py-0.5 text-center text-[10px] font-semibold text-accent-100">
                    +{cell.prospects.length - 3} daha
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
                <p className="text-xs text-white/50">{openDay.prospects.length} görüşme planlanmış</p>
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
              {openDay.prospects.map((p, index) => {
                const overdue = isLeadOverdue({
                  status: p.status,
                  lastContactAt: p.last_contact_at,
                  createdAt: p.created_at,
                  nextFollowupAt: p.next_followup_at,
                });
                const row = (
                  <>
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5">
                        {overdue ? <OverdueBadge className="shrink-0" /> : null}
                        <span className="truncate text-sm font-medium text-white">{p.company_name}</span>
                      </span>
                      {p.contact_name || p.next_followup_note ? (
                        <span className="truncate text-xs text-white/45">
                          {[p.contact_name, p.next_followup_note].filter(Boolean).join(" — ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-xs tabular-nums text-white/60">
                        {p.next_followup_at ? TIME_FORMATTER.format(new Date(p.next_followup_at)) : ""}
                      </span>
                      {p.phone ? <Phone className="h-3.5 w-3.5 text-accent-300" /> : null}
                    </span>
                  </>
                );
                return p.phone ? (
                  <a
                    key={p.id}
                    href={`tel:${p.phone}`}
                    className="animate-slide-up flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3 transition-colors duration-150 hover:border-accent-400/40 hover:bg-white/[0.08]"
                    style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                  >
                    {row}
                  </a>
                ) : (
                  <div
                    key={p.id}
                    className="animate-slide-up flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-3"
                    style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                  >
                    {row}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

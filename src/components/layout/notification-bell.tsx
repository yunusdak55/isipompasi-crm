"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import type { DueFollowup } from "@/lib/data/leads";

/** Bugun/gecmis takip tarihi olan leadleri listeleyen zil - dis servis gerektirmez, mevcut verilerden. */
export function NotificationBell({ items }: { items: DueFollowup[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const overdueCount = items.filter((i) => i.overdue).length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Hatırlatmalar"
        className="group relative flex h-9 w-9 items-center justify-center rounded-lg text-white/70 transition-all duration-150 ease-snappy hover:bg-white/[0.08] hover:text-white active:scale-90"
      >
        <Bell className="h-4.5 w-4.5" />
        {items.length > 0 ? (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white",
              overdueCount > 0 ? "bg-danger-500" : "bg-accent-500"
            )}
          >
            {items.length > 9 ? "9+" : items.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="animate-panel-in absolute right-0 top-11 z-50 w-72 rounded-xl border border-line bg-surface p-2 shadow-elevated-lg">
          <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-600">Takip Hatırlatmaları</p>
          {items.length === 0 ? (
            <p className="px-2 py-3 text-sm text-ink-600">Bekleyen takip yok.</p>
          ) : (
            <ul className="flex max-h-80 flex-col gap-0.5 overflow-y-auto">
              {items.map((item, index) => (
                <li key={item.leadId} className="animate-slide-up" style={{ animationDelay: `${Math.min(index, 8) * 25}ms` }}>
                  <Link
                    href={`/leads/${item.leadId}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm transition-colors duration-150 hover:bg-white/[0.05] hover:translate-x-0.5"
                  >
                    <span className="truncate text-ink-900">{item.name}</span>
                    <span className={cn("shrink-0 text-xs font-medium", item.overdue ? "text-danger-500" : "text-ink-600")}>
                      {formatDate(item.date)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

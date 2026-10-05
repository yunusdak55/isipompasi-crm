"use client";

import { useState } from "react";
import { ProspectFollowupTable } from "@/components/admin/prospect-followup-table";
import { SegmentChips } from "@/components/ui/segment-chips";
import { isProspectOverdue } from "@/lib/utils";
import type { ProspectLastNote } from "@/lib/data/prospects";
import type { AgencyProspect } from "@/lib/types/domain";

type Segment = "upcoming" | "overdue";

/**
 * Ajans panelindeki "Takipte" listesinin ayirmasi - firma panelindeki Takipte ile ayni
 * iki sekme (bkz. components/leads/followup-table.tsx): "Yaklaşan Takipler" ve
 * "Geciken Takipler". Gecikme kurali rozetle ve Gecikenler sayfasiyla ayni (isProspectOverdue).
 */
export function ProspectFollowupSegments({
  prospects,
  lastNotes,
}: {
  prospects: AgencyProspect[];
  lastNotes: Record<string, ProspectLastNote>;
}) {
  const [segment, setSegment] = useState<Segment>("upcoming");

  const isOverdue = (p: AgencyProspect) =>
    isProspectOverdue({ status: p.status, lastContactAt: p.last_contact_at, createdAt: p.created_at, nextFollowupAt: p.next_followup_at });
  const overdue = prospects.filter(isOverdue);
  const upcoming = prospects.filter((p) => !isOverdue(p));

  return (
    <div className="flex flex-col gap-3">
      <SegmentChips
        label="Takip listesi"
        value={segment}
        onChange={setSegment}
        options={[
          { value: "upcoming", label: "Yaklaşan Takipler", count: upcoming.length },
          { value: "overdue", label: "Geciken Takipler", count: overdue.length, tone: "danger" },
        ]}
      />
      <ProspectFollowupTable
        prospects={segment === "overdue" ? overdue : upcoming}
        lastNotes={lastNotes}
        emptyTitle={segment === "overdue" ? "Geciken takip yok" : "Yaklaşan takip yok"}
        emptyBody={
          segment === "overdue"
            ? "Takip tarihi 24 saatten fazla geçmiş aday yok."
            : "Bir adaya takip tarihi verdiğinizde burada listelenir."
        }
      />
    </div>
  );
}

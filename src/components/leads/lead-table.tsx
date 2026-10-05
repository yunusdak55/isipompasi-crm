"use client";

// ISTEMCI BILESENI (olcum 2026-10-05, bkz. docs/performans-raporu-2026-10-05.md):
// bu tablo sunucu bileseniyken her satir (mobil kart + masaustu satiri, uzun sinif
// adlariyla) RSC yanitina HAZIR ELEMAN AGACI olarak yaziliyordu - 20 lead icin
// ~139 KB; canlida Leadler diger sayfalardan ~120 ms gec bitiyordu. Istemci
// bileseni olunca yanitta yalnizca lead verisi (JSON) gider, satirlar tarayicida
// cizilir. Ilk yuklemede HTML yine sunucuda uretilir (SSR); tarih/para bicimleri
// lib/utils'te Turkiye saatine sabit oldugu icin sunucu ve tarayici ayni metni uretir.

import { IntentLink as Link } from "@/components/ui/intent-link";
import { Phone, MapPin } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { NewLeadBadge, OverdueBadge } from "@/components/leads/lead-indicators";
import { PROPERTY_TYPE_LABELS } from "@/lib/constants/lead";
import { formatCurrency, formatRelativeDays, getInitials, isLeadNew, isLeadOverdue, leadContactPerson, leadDisplayName } from "@/lib/utils";
import type { LeadListItem } from "@/lib/data/leads";
import type { LeadStatus, PropertyType } from "@/lib/types/domain";

function propertyTypeLabel(value: string | null) {
  if (!value) return null;
  return PROPERTY_TYPE_LABELS[value as PropertyType] ?? value;
}

// GUCLENDIRME (spec 2026-10-01: "Leadler kısmı daha anlaşılabilir, zahmeti
// minimum ama en profesyonel en sağlam en güçlü gözükecek"). Durum rengi tek
// bir yerden (LEAD_STATUS_COLOR, zaten var olan tone eslemesi) turetilir -
// kanban/rozet/avatar/satir-seridi HEP AYNI renk dilini konusur, ayri bir
// renk tablosu icat edilmedi.
const STATUS_ACCENT: Record<LeadStatus, string> = {
  new: "var(--color-brand-200)",
  discovery_offer: "var(--color-accent-500)",
  won: "var(--color-success-500)",
  followup: "var(--color-warning-500)",
  lost: "var(--color-danger-500)",
};

const AVATAR_TONE: Record<LeadStatus, string> = {
  new: "bg-brand-500/20 text-brand-100 ring-brand-400/30",
  discovery_offer: "bg-accent-500/15 text-accent-300 ring-accent-500/25",
  won: "bg-success-500/15 text-[#7ee2ad] ring-success-500/25",
  followup: "bg-warning-500/15 text-[#f0cf7e] ring-warning-500/25",
  lost: "bg-danger-500/15 text-[#ffb4a3] ring-danger-500/25",
};

function LeadAvatar({ lead }: { lead: LeadListItem }) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-1 ring-inset ${AVATAR_TONE[lead.status]}`}
    >
      {getInitials(leadDisplayName(lead))}
    </span>
  );
}

function AssigneeAvatar({ name }: { name: string | null }) {
  if (!name) {
    return <span className="text-sm text-white/40">Belirtilmedi</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-white/70 ring-1 ring-inset ring-white/15">
        {getInitials(name)}
      </span>
      <span className="truncate text-sm text-white/75">{name}</span>
    </div>
  );
}

/**
 * Tek bir lead karti - masaustunde tablo satiri yerine, DAR (mobil) ekranda
 * kullanilir (spec: "müşteriye en kolaylığı sağladığı açıyla" - mobilde yatay
 * kaydirmali bir tablo yerine dogrudan dokunmasi kolay dikey kartlar).
 */
function LeadCard({ lead }: { lead: LeadListItem }) {
  const followupLabel = formatRelativeDays(lead.next_followup_at);
  const followupOverdue = Boolean(followupLabel?.includes("gecikti"));
  const overdueInput = {
    status: lead.status,
    lastContactAt: lead.last_contact_at,
    createdAt: lead.created_at,
    nextFollowupAt: lead.next_followup_at,
    lastActivityAt: lead.last_activity_at,
  };
  const showOverdue = isLeadOverdue(overdueInput);
  const showNew = isLeadNew(overdueInput);

  return (
    <Link
      href={`/leads/${lead.id}`}
      className="animate-slide-up flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-3.5 transition-all duration-150 ease-snappy active:scale-[0.99]"
      style={{ borderLeftWidth: 3, borderLeftColor: STATUS_ACCENT[lead.status] }}
    >
      <div className="flex items-start gap-3">
        <LeadAvatar lead={lead} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`truncate font-medium text-white ${lead.status === "lost" ? "lost-name" : ""}`}>
              {leadDisplayName(lead)}
            </span>
            {showNew ? <NewLeadBadge /> : null}
            {showOverdue ? <OverdueBadge /> : null}
          </div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-white/55">
            <Phone className="h-3 w-3 shrink-0" strokeWidth={2} />
            {lead.phone}
            {lead.city ? (
              <>
                <span className="text-white/25">·</span>
                <MapPin className="h-3 w-3 shrink-0" strokeWidth={2} />
                {lead.city}
              </>
            ) : null}
          </p>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <div className="flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
        <AssigneeAvatar name={leadContactPerson(lead)} />
        <div className="flex flex-col items-end gap-0.5">
          {lead.offered_amount ? (
            <span className="font-medium tabular-nums text-white/85">{formatCurrency(lead.offered_amount)}</span>
          ) : null}
          {followupLabel ? (
            <span className={followupOverdue ? "font-medium text-[#ffb4a3]" : "text-white/55"}>{followupLabel}</span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

/** Koyu lacivert panel icinde "cam" yuzeyli tablo (marka revizyonu: Leadler artik dark panel). */
export function LeadTable({ leads }: { leads: LeadListItem[] }) {
  if (leads.length === 0) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/15 bg-white/[0.03] py-16 text-center">
        <p className="text-sm font-medium text-white">Henüz lead yok</p>
        <p className="text-sm text-white/50">Filtrelerinize uyan veya sisteme eklenmiş bir lead bulunamadı.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobil: dikey kart listesi - yatay kaydirma yok, parmakla dokunmasi kolay. */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {leads.map((lead, index) => (
          <div key={lead.id} style={{ animationDelay: `${Math.min(index, 12) * 6}ms` }}>
            <LeadCard lead={lead} />
          </div>
        ))}
      </div>

      {/* Masaustu: yoğun bilgi tablosu. */}
      <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.06] md:block">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-medium uppercase tracking-wide text-white/45">
            <tr>
              <th className="px-4 py-3 font-medium">Müşteri</th>
              <th className="px-4 py-3 font-medium">Konum</th>
              <th className="px-4 py-3 font-medium">Konut / m²</th>
              <th className="px-4 py-3 font-medium">Teklif</th>
              <th className="px-4 py-3 font-medium">Görüşen Kişi</th>
              <th className="px-4 py-3 font-medium">Durum</th>
              <th className="px-4 py-3 font-medium">Takip</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {leads.map((lead, index) => {
              const followupLabel = formatRelativeDays(lead.next_followup_at);
              const followupOverdue = Boolean(followupLabel?.includes("gecikti"));
              const overdueInput = {
                status: lead.status,
                lastContactAt: lead.last_contact_at,
                createdAt: lead.created_at,
                nextFollowupAt: lead.next_followup_at,
                lastActivityAt: lead.last_activity_at,
              };
              const showOverdue = isLeadOverdue(overdueInput);
              const showNew = isLeadNew(overdueInput);

              return (
                <tr
                  key={lead.id}
                  className="group animate-slide-up relative transition-all duration-150 ease-snappy hover:bg-white/[0.05]"
                  style={{
                    animationDelay: `${Math.min(index, 12) * 6}ms`,
                    boxShadow: `inset 3px 0 0 0 ${STATUS_ACCENT[lead.status]}`,
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <LeadAvatar lead={lead} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={`/leads/${lead.id}`}
                            className={`truncate font-medium text-white transition-colors group-hover:text-accent-300 ${
                              lead.status === "lost" ? "lost-name" : ""
                            }`}
                          >
                            {leadDisplayName(lead)}
                          </Link>
                          {showNew ? <NewLeadBadge /> : null}
                          {showOverdue ? <OverdueBadge /> : null}
                        </div>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-white/60">
                          <Phone className="h-3 w-3 shrink-0 text-white/40" strokeWidth={2} />
                          {lead.phone}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-white/70">{lead.city ?? "—"}</td>
                  <td className="px-4 py-3.5 text-white/70">
                    {propertyTypeLabel(lead.property_type) ?? "—"}
                    {lead.area_m2 ? ` · ${lead.area_m2} m²` : ""}
                  </td>
                  <td className="px-4 py-3.5 tabular-nums text-white/70">{formatCurrency(lead.offered_amount)}</td>
                  <td className="px-4 py-3.5">
                    <AssigneeAvatar name={leadContactPerson(lead)} />
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className={`px-4 py-3.5 ${followupOverdue ? "font-medium text-[#ffb4a3]" : "text-white/70"}`}>
                    {followupLabel ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

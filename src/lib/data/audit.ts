import { createClient } from "@/lib/supabase/server";

export type AuditEvent = {
  id: number;
  at: string;
  action: string;
  tableName: string;
  rowId: string | null;
  actor: string | null;
  companyName: string | null;
  /** Kisa, okunabilir ozet (ne degisti). */
  summary: string;
};

const TABLE_LABELS: Record<string, string> = {
  profiles: "Kullanıcı",
  companies: "Firma",
  integrations: "Entegrasyon",
  sales: "Satış",
};

const FIELD_LABELS: Record<string, string> = {
  role: "rol",
  company_id: "firma",
  is_active: "aktiflik",
  email: "e-posta",
  name: "ad",
  status: "durum",
  sale_amount: "tutar",
  full_name: "ad soyad",
  phone: "telefon",
  city: "şehir",
  salesperson: "satış personeli",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "evet" : "hayır";
  if (typeof v === "string" && v.length > 40) return `${v.slice(0, 37)}…`;
  return String(v);
}

function summarize(action: string, tableName: string, changes: unknown): string {
  const c = (changes ?? {}) as Record<string, unknown>;
  if (action === "UPDATE") {
    return Object.entries(c)
      .slice(0, 4)
      .map(([field, diff]) => {
        const d = diff as { old?: unknown; new?: unknown };
        return `${FIELD_LABELS[field] ?? field}: ${formatValue(d?.old)} → ${formatValue(d?.new)}`;
      })
      .join(" · ");
  }
  const label = String(c.name ?? c.full_name ?? c.email ?? c.provider ?? c.sale_amount ?? "");
  return label ? `${action === "INSERT" ? "Eklendi" : "Silindi"}: ${formatValue(label)}` : action === "INSERT" ? "Eklendi" : "Silindi";
}

/** Son denetim olaylari (yalnizca admin okuyabilir - RLS). Aktor/firma adlari ayri sorguyla eslenir. */
export async function getAuditLog(limit = 200): Promise<AuditEvent[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("audit_log")
    .select("id, at, actor_id, action, table_name, row_id, company_id, changes")
    .order("id", { ascending: false })
    .limit(limit);

  if (error || !rows) {
    if (error) console.error("getAuditLog error:", error.message);
    return [];
  }

  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((v): v is string => !!v))];
  const companyIds = [...new Set(rows.map((r) => r.company_id).filter((v): v is string => !!v))];

  const [actors, companies] = await Promise.all([
    actorIds.length ? supabase.from("profiles").select("id, full_name, email").in("id", actorIds) : Promise.resolve({ data: [] }),
    companyIds.length ? supabase.from("companies").select("id, name").in("id", companyIds) : Promise.resolve({ data: [] }),
  ]);

  const actorName = new Map((actors.data ?? []).map((a) => [a.id, a.full_name || a.email || "—"]));
  const companyName = new Map((companies.data ?? []).map((c) => [c.id, c.name]));

  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    action: r.action,
    tableName: TABLE_LABELS[r.table_name] ?? r.table_name,
    rowId: r.row_id,
    actor: r.actor_id ? (actorName.get(r.actor_id) ?? "Silinmiş kullanıcı") : "Sistem",
    companyName: r.company_id ? (companyName.get(r.company_id) ?? "Silinmiş firma") : null,
    summary: summarize(r.action, r.table_name, r.changes),
  }));
}

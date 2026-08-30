import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUS_ORDER } from "@/lib/constants/lead";
import { OVERDUE_HOURS } from "@/lib/utils";
import type { LeadPriority, LeadStatus } from "@/lib/types/domain";

/** ILIKE joker karakterlerini ve .or() sozdizimini bozabilecek karakterleri temizler. */
export function sanitizeSearchTerm(term: string) {
  return term.replace(/[,()%_]/g, " ").trim();
}

export type LeadListItem = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  city: string | null;
  area_m2: number | null;
  property_type: string | null;
  status: LeadStatus;
  priority: "hot" | "cold";
  next_followup_at: string | null;
  next_followup_note: string | null;
  offered_amount: number | null;
  last_contact_at: string | null;
  created_at: string;
  assigned_profile: { full_name: string | null } | null;
};

const LEAD_LIST_COLUMNS =
  "id, first_name, last_name, phone, city, area_m2, property_type, status, priority, next_followup_at, next_followup_note, offered_amount, last_contact_at, created_at, assigned_profile:profiles!leads_assigned_salesperson_fkey(full_name)";

/**
 * Lead listesini SERVER-SIDE sayfalama + filtre ile getirir (spec md.29:
 * "server-side query" tercih edilmeli). RLS sayesinde donen satirlar zaten
 * oturum acan kullanicinin (admin/owner/sales) gorebilecegi satirlarla sinirli.
 */
export async function getLeads(params: { search?: string; status?: LeadStatus; page?: number; pageSize?: number }) {
  const supabase = await createClient();
  const page = Math.max(1, params.page ?? 1);
  const pageSize = params.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("leads")
    .select(LEAD_LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  if (params.search) {
    const term = sanitizeSearchTerm(params.search);
    if (term.length > 0) {
      query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`);
    }
  }

  const { data, count, error } = await query;

  if (error) {
    console.error("getLeads error:", error.message);
    return { leads: [] as LeadListItem[], count: 0, page, pageSize };
  }

  return { leads: (data ?? []) as unknown as LeadListItem[], count: count ?? 0, page, pageSize };
}

/** Lead detay sayfasi icin tek lead + atanan kisi. */
export async function getLeadById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .select(
      `*,
      assigned_profile:profiles!leads_assigned_salesperson_fkey(id, full_name),
      contacted_by_person:salespeople!leads_contacted_by_fkey(id, full_name),
      product_category:product_categories(id, label)`
    )
    .eq("id", id)
    .single();

  if (error) {
    console.error("getLeadById error:", error.message);
    return null;
  }

  return data;
}

/** Lead zaman cizelgesi (spec md.10). V1'de bos gelebilir; UI bunu ele alir. */
export async function getLeadActivities(leadId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getLeadActivities error:", error.message);
    return [];
  }

  return data ?? [];
}

/** Bir lead icin kayitli gercek satis (varsa). RLS: sadece owner/admin gorur. */
export async function getSaleForLead(leadId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sales")
    .select("id, sale_amount, sale_date")
    .eq("lead_id", leadId)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getSaleForLead error:", error.message);
    return null;
  }

  return data;
}

export type LeadSelectItem = { id: string; first_name: string; last_name: string | null; phone: string };

/** Takvimden dogrudan randevu olustururken lead secim dropdown'u icin acik leadler. */
export async function getOpenLeadsForSelect(): Promise<LeadSelectItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .select("id, first_name, last_name, phone")
    .not("status", "in", "(won,lost)")
    .order("first_name");

  if (error) {
    console.error("getOpenLeadsForSelect error:", error.message);
    return [];
  }

  return data ?? [];
}

/** Bir firmada lead atanabilecek kisiler (owner + sales). Atama dropdown'u icin. */
export async function getAssignableProfiles(companyId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .in("role", ["owner", "sales"])
    .order("full_name");

  if (error) {
    console.error("getAssignableProfiles error:", error.message);
    return [];
  }

  return data ?? [];
}

export type BoardLead = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  city: string | null;
  status: LeadStatus;
  priority: LeadPriority;
  offered_amount: number | null;
  last_contact_at: string | null;
  next_followup_at: string | null;
  created_at: string;
  assigned_profile: { full_name: string | null } | null;
};

/**
 * Kanban pipeline icin durum bazinda gruplanmis lead listesi. RLS sayesinde
 * kullanicinin (rol farketmeksizin) gorebilecegi leadlerle otomatik sinirli.
 */
export async function getLeadsForBoard(): Promise<Record<LeadStatus, BoardLead[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, first_name, last_name, phone, city, status, priority, offered_amount, last_contact_at, next_followup_at, created_at, assigned_profile:profiles!leads_assigned_salesperson_fkey(full_name)"
    )
    .order("created_at", { ascending: false });

  const grouped = Object.fromEntries(LEAD_STATUS_ORDER.map((status) => [status, [] as BoardLead[]])) as Record<
    LeadStatus,
    BoardLead[]
  >;

  if (error) {
    console.error("getLeadsForBoard error:", error.message);
    return grouped;
  }

  for (const lead of (data ?? []) as unknown as BoardLead[]) {
    grouped[lead.status]?.push(lead);
  }

  return grouped;
}

/**
 * "Takipte" ekrani (spec md.4): takip tarihi olan, henuz kapanmamis leadler,
 * en yakin tarih once. Kapanmis (satis/kayip) leadlerde takip anlamsizdir.
 */
export async function getLeadsFollowup(): Promise<LeadListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_LIST_COLUMNS)
    .not("next_followup_at", "is", null)
    .not("status", "in", "(won,lost)")
    .order("next_followup_at", { ascending: true });

  if (error) {
    console.error("getLeadsFollowup error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as LeadListItem[];
}

export type DueFollowup = { leadId: string; name: string; date: string; overdue: boolean };

/**
 * Topbar'daki hatirlatma zili icin: tarihi gelmis (bugun dahil) veya gecmis
 * takipler. Hafif bir liste - sadece isim + tarih, tam lead detayi degil.
 */
export async function getDueFollowups(): Promise<DueFollowup[]> {
  const supabase = await createClient();
  const now = new Date();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();

  const { data, error } = await supabase
    .from("leads")
    .select("id, first_name, last_name, next_followup_at")
    .not("next_followup_at", "is", null)
    .not("status", "in", "(won,lost)")
    .lte("next_followup_at", todayEnd)
    .order("next_followup_at", { ascending: true })
    .limit(20);

  if (error) {
    console.error("getDueFollowups error:", error.message);
    return [];
  }

  return (data ?? []).map((lead) => ({
    leadId: lead.id,
    name: [lead.first_name, lead.last_name].filter(Boolean).join(" "),
    date: lead.next_followup_at as string,
    overdue: new Date(lead.next_followup_at as string) < now,
  }));
}

/**
 * "Takvim" ekrani: verilen ay icinde takip/kesif tarihi olan leadler, gun
 * gun gruplanmak uzere ham liste olarak doner (gruplama sayfa tarafinda
 * yapilir). Kapanmis (satis/kayip) leadler haric - onlarin artik bir
 * randevusu olmaz.
 */
export async function getLeadsCalendar(year: number, month: number): Promise<LeadListItem[]> {
  const supabase = await createClient();

  const rangeStart = new Date(Date.UTC(year, month, 1)).toISOString();
  const rangeEnd = new Date(Date.UTC(year, month + 1, 1)).toISOString();

  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_LIST_COLUMNS)
    .gte("next_followup_at", rangeStart)
    .lt("next_followup_at", rangeEnd)
    .not("status", "in", "(won,lost)")
    .order("next_followup_at", { ascending: true });

  if (error) {
    console.error("getLeadsCalendar error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as LeadListItem[];
}

/**
 * "Gecikenler" ekrani (spec md.5): son temastan (last_contact_at, yoksa
 * created_at) 48 saatten fazla gecmis, hala aktif leadler - ILERIDE planli
 * bir takibi OLMAYAN leadler (varsa zaten "gecikmis" degil, bkz. isLeadOverdue).
 *
 * DUZELTME (denetim raporu): once tum aktif leadler cekilip JS tarafinda
 * filtreleniyordu ("kucuk olcekli V1 kumesi" varsayimiyla) - 100-200 leadde
 * bu sayfa olculebilir sekilde en yavas ekrandi. COALESCE(last_contact_at,
 * created_at) < esik mantigi, PostgREST'in .or()+.and() kombinasyonuyla
 * dogrudan SQL WHERE'e tasindi; JS'e sadece zaten kucuk olan sonuc kumesi
 * (gercekten gecikmis leadler) dusuyor, sirali cekiliyor.
 */
export async function getLeadsOverdue(): Promise<LeadListItem[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - OVERDUE_HOURS * 60 * 60 * 1000).toISOString();

  // DUZELTME (canli denetimde yakalanan celiski): bu satir eskiden `now`
  // (SAAT hassasiyeti) kullaniyordu - bugun icin planli ama saati gecmis bir
  // takibi olan lead burada "gecikmis" sayilip listeleniyordu, AYNI ANDA
  // isLeadOverdue() (Leadler/Takipte tablolarindaki GECIKMIS rozeti) o
  // leadi GUN bazli kural geregi "gecikmis degil" sayiyordu - kullanici ayni
  // lead icin Gecikenler sayfasinda rozet gorup Takipte sayfasinda gormuyordu.
  // Artik HER IKI yer de ayni GUN bazli esigi (gunun basi) kullaniyor.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_LIST_COLUMNS)
    .not("status", "in", "(won,lost)")
    .or(`last_contact_at.lt.${cutoff},and(last_contact_at.is.null,created_at.lt.${cutoff})`)
    .or(`next_followup_at.is.null,next_followup_at.lt.${todayStart.toISOString()}`);

  if (error) {
    console.error("getLeadsOverdue error:", error.message);
    return [];
  }

  return ((data ?? []) as unknown as LeadListItem[]).sort((a, b) => {
    const aRef = new Date(a.last_contact_at ?? a.created_at).getTime();
    const bRef = new Date(b.last_contact_at ?? b.created_at).getTime();
    return aRef - bRef;
  });
}

import { createClient } from "@/lib/supabase/server";
import { sanitizeSearchTerm, type DueFollowup } from "@/lib/data/leads";
import { fetchAllRows } from "@/lib/data/paginate";
import { endOfDayTR, monthStartTR } from "@/lib/time";
import { sortByFollowupUrgency } from "@/lib/followup";
import { FOLLOWUP_OVERDUE_HOURS, formatRelativeDays } from "@/lib/utils";
import type { AgencyProspect, ProspectActivity, ProspectStatus } from "@/lib/types/domain";

const PROSPECT_COLUMNS =
  "id, company_name, contact_name, phone, notes, status, next_followup_at, next_followup_note, last_contact_at, created_at, updated_at";

/**
 * Ajansin kendi musteri adayi listesi (spec: "aradığım firmaların yaptığım
 * görüşmeleri kayıt edip takip edebileceğim, kayıp olarak işaretleyebileceğim
 * bir yer"). RLS zaten sadece admin'in gorebilecegi sekilde sinirlar.
 */
export async function getProspects(params?: { status?: ProspectStatus; search?: string }): Promise<AgencyProspect[]> {
  const supabase = await createClient();

  let query = supabase.from("agency_prospects").select(PROSPECT_COLUMNS).order("created_at", { ascending: false });

  if (params?.status) {
    query = query.eq("status", params.status);
  }

  if (params?.search) {
    const term = sanitizeSearchTerm(params.search);
    if (term.length > 0) {
      query = query.or(`company_name.ilike.%${term}%,contact_name.ilike.%${term}%,phone.ilike.%${term}%`);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("getProspects error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as AgencyProspect[];
}

export async function getProspectById(id: string): Promise<AgencyProspect | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("agency_prospects").select(PROSPECT_COLUMNS).eq("id", id).single();

  if (error) {
    console.error("getProspectById error:", error.message);
    return null;
  }

  return data as unknown as AgencyProspect;
}

/**
 * Aday profilindeki zaman çizelgesi (spec: "bir zaman çizelgesi notlar
 * kısmı olsun... tarihi ve zamanıyla birlikte kendisi gözüksün") - en yeni
 * en üstte, leads.ts/getLeadActivities ile aynı desen.
 */
export async function getProspectActivities(prospectId: string): Promise<ProspectActivity[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agency_prospect_activities")
    .select("id, prospect_id, type, description, created_at")
    .eq("prospect_id", prospectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getProspectActivities error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as ProspectActivity[];
}

/**
 * "Takvim" ekrani: verilen ay icinde takip tarihi olan musteri adaylari.
 * Kapanmis (musteri oldu/kayip) adaylar haric - leads.ts/getLeadsCalendar
 * ile ayni yaklasim.
 */
export async function getProspectsCalendar(year: number, month: number): Promise<AgencyProspect[]> {
  const supabase = await createClient();

  const rangeStart = monthStartTR(year, month).toISOString();
  const rangeEnd = monthStartTR(year, month + 1).toISOString();

  const { data, error } = await supabase
    .from("agency_prospects")
    .select(PROSPECT_COLUMNS)
    .gte("next_followup_at", rangeStart)
    .lt("next_followup_at", rangeEnd)
    .not("status", "in", "(won,lost)")
    .order("next_followup_at", { ascending: true });

  if (error) {
    console.error("getProspectsCalendar error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as AgencyProspect[];
}

/**
 * "Takipte" ekrani: takip tarihi verilmis, henuz kapanmamis (musteri
 * oldu/kayip degil) adaylar - leads.ts/getLeadsFollowup ile ayni yaklasim
 * (spec: "takvime eklediğim kişiler oraya düşsün").
 *
 * SIRALAMA (spec 2026-10-04, "HER YER icin" - bkz. lib/followup.ts
 * sortByFollowupUrgency, leads.ts/getLeadsFollowup ile AYNI): bugunku
 * takipler, sonra gecikmisler (en az geciken en ustte), sonra gelecek
 * takipler (en yakin once).
 */
export async function getProspectsFollowup(): Promise<AgencyProspect[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agency_prospects")
    .select(PROSPECT_COLUMNS)
    .not("next_followup_at", "is", null)
    .not("status", "in", "(won,lost)")
    .order("next_followup_at", { ascending: true });

  if (error) {
    console.error("getProspectsFollowup error:", error.message);
    return [];
  }

  return sortByFollowupUrgency((data ?? []) as unknown as AgencyProspect[], (p) => p.next_followup_at as string);
}

/**
 * "Gecikenler" ekrani: YALNIZCA takibe alinmis, takip tarihinin uzerinden
 * 24 saatten fazla gecmis, kapanmamis adaylar (spec 2026-10-02 - firma
 * paneli/chatbot ile AYNI kural, bkz. lib/utils.ts isProspectOverdue; eski
 * gun-bazli "takip gunu gecmis" kurali rozetle celisiyordu).
 *
 * SIRALAMA (spec 2026-10-04, "HER YER icin" - leads.ts/getLeadsOverdue ile
 * AYNI): gecikme GUN SAYISINA gore kucukten buyuge - 1 gun gecikmis en
 * ustte, 2, 5, 10... asagida. Takip tarihine gore azalan siralama bunu verir.
 */
export async function getProspectsOverdue(): Promise<AgencyProspect[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - FOLLOWUP_OVERDUE_HOURS * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("agency_prospects")
    .select(PROSPECT_COLUMNS)
    .not("next_followup_at", "is", null)
    .lt("next_followup_at", cutoff)
    .not("status", "in", "(won,lost)")
    .order("next_followup_at", { ascending: false });

  if (error) {
    console.error("getProspectsOverdue error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as AgencyProspect[];
}

export type ProspectLastNote = { description: string; created_at: string };

/**
 * Her adayin EN SON notu + tarihi (liste/Takipte/Gecikenler'de "en son ne
 * demisti" bir bakista gorunsun diye). Tum notlar tarihe gore azalan cekilip
 * aday basina ilki alinir - kucuk olcekli (yuzlerce aday) bir ajans listesi.
 */
export async function getLastNotesByProspect(): Promise<Record<string, ProspectLastNote>> {
  const supabase = await createClient();

  // fetchAllRows: PostgREST 1000 satirda sessizce keser (bkz. data/paginate.ts).
  const { data, error } = await fetchAllRows((from, to) =>
    supabase
      .from("agency_prospect_activities")
      .select("id, prospect_id, description, created_at")
      .eq("type", "note")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, to)
  );

  if (error) {
    console.error("getLastNotesByProspect error:", error.message);
    return {};
  }

  const result: Record<string, ProspectLastNote> = {};
  for (const row of data ?? []) {
    if (!result[row.prospect_id]) {
      result[row.prospect_id] = { description: row.description, created_at: row.created_at };
    }
  }
  return result;
}

/**
 * Ajans admin'in zil hatirlatmasi: bugun/gecmis takip tarihi olan musteri
 * adaylari. ESKIDEN admin icin zil, tenant lead'lerini (RLS admin'e hepsini
 * gosterir) listeliyordu ve /leads/.. linkleri admin'i yonlendirip
 * geri atiyordu - ajansin KENDI takipleri hic hatirlatilmiyordu.
 */
export async function getDueProspectFollowups(): Promise<DueFollowup[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agency_prospects")
    .select("id, company_name, next_followup_at")
    .not("next_followup_at", "is", null)
    .not("status", "in", "(won,lost)")
    .lte("next_followup_at", endOfDayTR().toISOString())
    .order("next_followup_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("getDueProspectFollowups error:", error.message);
    return [];
  }

  const now = new Date();
  return (data ?? []).map((p) => ({
    id: p.id,
    href: `/admin/prospects/${p.id}`,
    name: p.company_name,
    date: p.next_followup_at as string,
    overdue: new Date(p.next_followup_at as string) < now,
    label: formatRelativeDays(p.next_followup_at) ?? "",
  }));
}

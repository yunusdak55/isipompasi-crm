import { createClient } from "@/lib/supabase/server";
import type { AgencyProspect, ProspectStatus } from "@/lib/types/domain";

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
    const term = params.search.replace(/[,()%_]/g, " ").trim();
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
 * "Takvim" ekrani: verilen ay icinde takip tarihi olan musteri adaylari.
 * Kapanmis (musteri oldu/kayip) adaylar haric - leads.ts/getLeadsCalendar
 * ile ayni yaklasim.
 */
export async function getProspectsCalendar(year: number, month: number): Promise<AgencyProspect[]> {
  const supabase = await createClient();

  const rangeStart = new Date(Date.UTC(year, month, 1)).toISOString();
  const rangeEnd = new Date(Date.UTC(year, month + 1, 1)).toISOString();

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

export type ProspectSelectItem = { id: string; company_name: string; contact_name: string | null };

/** Takvimden dogrudan takip eklerken aday secim dropdown'u icin acik adaylar. */
export async function getOpenProspectsForSelect(): Promise<ProspectSelectItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agency_prospects")
    .select("id, company_name, contact_name")
    .not("status", "in", "(won,lost)")
    .order("company_name");

  if (error) {
    console.error("getOpenProspectsForSelect error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as ProspectSelectItem[];
}

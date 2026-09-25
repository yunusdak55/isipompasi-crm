import { createClient } from "@/lib/supabase/server";

export type DiscoveryVisitListItem = {
  id: string;
  visit_date: string;
  location: string | null;
  outcome_note: string | null;
  created_at: string;
  lead: { id: string; first_name: string | null; last_name: string | null; phone: string } | null;
  created_by_profile: { full_name: string | null } | null;
};

/**
 * "Keşifler" ekrani (spec: "ay içerisinde yapılan keşifler, gidilen yerler
 * ve nasıl geçti gibi bilgileri içersin - kime ne zaman nerede kesife
 * gidildigi bilgisini görüşmeyi yapan kişi burada girebilsin"). leads/
 * calendar.tsx'teki ay araligi deseniyle AYNI (gte/lt [year-month-1,
 * year-(month+1)-1)).
 */
export async function getDiscoveryVisitsForMonth(year: number, month: number): Promise<DiscoveryVisitListItem[]> {
  const supabase = await createClient();

  const rangeStart = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const rangeEnd = new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("discovery_visits")
    .select(
      `id, visit_date, location, outcome_note, created_at,
      lead:leads(id, first_name, last_name, phone),
      created_by_profile:profiles!discovery_visits_created_by_fkey(full_name)`
    )
    .gte("visit_date", rangeStart)
    .lt("visit_date", rangeEnd)
    .order("visit_date", { ascending: false });

  if (error) {
    console.error("getDiscoveryVisitsForMonth error:", error.message);
    return [];
  }

  return (data ?? []) as unknown as DiscoveryVisitListItem[];
}

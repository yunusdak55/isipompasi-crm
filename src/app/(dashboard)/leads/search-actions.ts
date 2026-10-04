"use server";

import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { sanitizeSearchTerm, type LeadSelectItem } from "@/lib/data/leads";

const MAX_RESULTS = 8;
const MAX_TOKENS = 3;

/**
 * Lead secicisi (Takvim randevusu, Keşif ziyareti) icin SUNUCU TARAFLI arama.
 * ESKISINDE sayfa tum acik leadleri (binlerce satir, ~400 KB) yukleyip
 * tarayicida suzuyordu; kutuya tiklaninca hepsi DOM'a basiliyordu (10.000+
 * dugum -> donma). Simdi her tus vurusunda (debounce'lu) en fazla 8 sonuc gelir.
 *
 * - Bos arama = en son eklenen 8 acik lead.
 * - "ahmet yildiz" gibi cok kelimeli aramada her kelime ad/soyad/telefondan
 *   birinde gecmeli (VE).
 * - RLS gecerli: kullanici yalnizca gorebildigi leadleri bulur.
 */
export async function searchOpenLeadsAction(term: string): Promise<LeadSelectItem[]> {
  await requireProfile();
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("id, first_name, last_name, phone")
    .not("status", "in", "(won,lost)")
    .order("created_at", { ascending: false })
    .order("id")
    .limit(MAX_RESULTS);

  const tokens = sanitizeSearchTerm(String(term ?? ""))
    .split(" ")
    .filter(Boolean)
    .slice(0, MAX_TOKENS);

  for (const token of tokens) {
    query = query.or(`first_name.ilike.%${token}%,last_name.ilike.%${token}%,phone.ilike.%${token}%`);
  }

  const { data, error } = await query;
  if (error) {
    console.error("searchOpenLeadsAction error:", error.message);
    return [];
  }
  return (data ?? []) as LeadSelectItem[];
}

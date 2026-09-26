import type { PostgrestError } from "@supabase/supabase-js";

/**
 * PostgREST tek istekte EN FAZLA 1000 satir dondurur (Supabase `max_rows`) ve fazlasini
 * SESSIZCE keser - hata vermez. `.limit(5000)` yazmak bunu ASMAZ. Bir firmanin lead/satis/
 * takip sayisi 1000'i gecince, tum satirlari tek sorguyla cekip toplayan sayfalar
 * (raporlar, satislar, kanban) eksik veri gostermeye baslar. Bu yardimci sayfa sayfa ceker.
 *
 * KULLANIM: `build` her cagrida AYNI sorguyu `.range(from, to)` ile kurmali ve sonuc
 * SIRASI KARARLI olmali (benzersiz bir kolonla bitiren `.order(...)`, orn. `.order("id")`),
 * yoksa sayfalar arasinda satir kayabilir/tekrarlanabilir.
 *
 *   const { data, error } = await fetchAllRows((from, to) =>
 *     supabase.from("leads").select("id, status").order("id").range(from, to)
 *   );
 */
const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  maxRows = 20_000
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const all: T[] = [];
  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    all.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return { data: all, error: null };
}

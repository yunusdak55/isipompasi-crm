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

/**
 * DUZELTME (performans denetimi 2026-10-01, kanit: izole test projesinde
 * 5.000 satirlik bir firma icin olculdu - bkz. getLeadsForBoard/getLeadsFollowup
 * kullanimlari). Eskiden sayfalar SIRAYLA (birbirini bekleyerek) cekiliyordu:
 * 5 sayfa icin 5 ayri ag turu ust uste biniyor, 5.000 satirlik bir kanban
 * panosu 2123ms suruyordu - her sayfanin VERITABANI sorgusu kendi basina
 * ~2ms gibi hizli olsa bile. Sayfalar birbirinden BAGIMSIZ (farkli .range()
 * araliklari) oldugu icin sirali beklemeye hic gerek yok: ilk sayfa (en
 * yaygin durum - coğu firma 1000 satirin altinda, TEK sayfa yeterli) once
 * cekilir; DOLU gelirse (daha fazla satir olabilecegini gosterir) sonraki
 * olasi sayfalar KADEMELI/KATLANAN (2, sonra 4, sonra 8...) gruplar halinde
 * PARALEL atilir - gercek satir sayisi onceden bilinmedigi icin "kac sayfa
 * daha var" tahmini yapilamiyor; katlanan grup boyutu, az satirli (1000-5000
 * arasi) firmalarda BOS "yoklama" istegi israfini sinirlarken cok satirli
 * firmalarda da hizla buyuyerek paralellik avantajini koruyor. Ayni veri
 * setinde olculen sonuc (5.000 satir, gercek fetchAllRows uzerinden): sirali
 * halde 2123ms -> bu kademeli-paralel halde ~500-700ms. `Promise.all`
 * sonuclari GIRDI sirasiyla dondurur (tamamlanma sirasiyla DEGIL), yani
 * satir sirasi hala kararli kalir - KULLANIM sozlesmesi (yorum altinda)
 * degismedi.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  maxRows = 20_000
): Promise<{ data: T[] | null; error: PostgrestError | null }> {
  const first = await build(0, PAGE_SIZE - 1);
  if (first.error) return { data: null, error: first.error };
  const firstRows = first.data ?? [];
  if (firstRows.length < PAGE_SIZE) {
    return { data: firstRows, error: null };
  }

  // Ilk paralel grup 5 sayfa (olcum 2026-10-05, 5.000 satir: 1 -> 2 -> 4 sayfalik
  // UC sirali tur yerine 1 -> 5 ile IKI tur; Raporlar bu yuzden ~0,8 sn suruyordu).
  // Bos gelen fazladan "yoklama" istekleri paralel ve ucuzdur; sirali tur pahalidir.
  const all = [...firstRows];
  let nextFrom = PAGE_SIZE;
  let batchPages = 5;
  while (nextFrom < maxRows) {
    const ranges: Array<[number, number]> = [];
    for (let i = 0; i < batchPages && nextFrom < maxRows; i++, nextFrom += PAGE_SIZE) {
      ranges.push([nextFrom, Math.min(nextFrom + PAGE_SIZE - 1, maxRows - 1)]);
    }
    const batch = await Promise.all(ranges.map(([from, to]) => build(from, to)));

    let hitShortPage = false;
    for (const r of batch) {
      if (r.error) return { data: null, error: r.error };
      const rows = r.data ?? [];
      all.push(...rows);
      if (rows.length < PAGE_SIZE) hitShortPage = true;
    }
    if (hitShortPage) break;
    batchPages *= 2;
  }
  return { data: all, error: null };
}

import { createClient } from "@/lib/supabase/server";

/**
 * Giris hesabi OLMAYAN, sadece isim bazli "Görüşen Kişi" kaydi (spec: "firma
 * sahipleri hesap oluşturma yetkisine sahip olmasın, yalnızca bir satış
 * personeli ismi belirlesin"). `assigned_salesperson`/getAssignableProfiles
 * (gercek hesap + RLS izolasyonu) ile KARISTIRILMAMALI - bu tamamen ayri,
 * bilgi amacli bir liste (bkz. supabase/migrations/0016_salespeople_roster.sql,
 * 0017_owner_in_contacted_list.sql).
 *
 * ONEMLI: bu isim daha once "Satış Personeli" olarak Firma Ayarları'nda,
 * "Görüşen Kişi" olarak da lead detayinda AYRI iki yer gibi sunuluyordu -
 * kullanici bir ismi ekleyip diger tarafta "gözükmüyor" diye sasirdi (aslinda
 * ayni tek listeydi, sadece etiketler farkliydi - kafa karistirici tasarim).
 * Artik TEK kavram: "Görüşen Kişi". Firma sahibinin kendisi de bu listede
 * OTOMATIK yer alir - elle eklenmesine gerek yok, silinemez (bkz. is_owner).
 */
export type Salesperson = { id: string; full_name: string; is_active: boolean; is_owner: boolean };

/**
 * Firma sahibini "Görüşen Kişi" listesinde HER ZAMAN garanti eder - satir
 * yoksa olusturur, isim degismisse senkron tutar. `getSalespeople` her
 * cagrisinda otomatik calisir, cagiran tarafin ayrica hatirlamasina gerek
 * yok (spec: "Firma Sahibi dahil olmak üzere eklensin").
 */
async function ensureOwnerSalesperson(companyId: string): Promise<void> {
  const supabase = await createClient();

  const { data: owner } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", companyId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (!owner) return; // henuz sahibi atanmamis bir firma

  const ownerName = owner.full_name?.trim() || "Firma Sahibi";

  const { data: existing } = await supabase
    .from("salespeople")
    .select("id, full_name")
    .eq("company_id", companyId)
    .eq("is_owner", true)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from("salespeople")
      .insert({ company_id: companyId, full_name: ownerName, is_owner: true, created_by: owner.id });
    if (error) console.error("ensureOwnerSalesperson insert error:", error.message);
  } else if (existing.full_name !== ownerName) {
    // Firma sahibi profildeki ismini degistirmis olabilir - senkron tut.
    const { error } = await supabase.from("salespeople").update({ full_name: ownerName }).eq("id", existing.id);
    if (error) console.error("ensureOwnerSalesperson update error:", error.message);
  }
}

export async function getSalespeople(companyId: string): Promise<Salesperson[]> {
  await ensureOwnerSalesperson(companyId);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("salespeople")
    .select("id, full_name, is_active, is_owner")
    .eq("company_id", companyId)
    .order("is_owner", { ascending: false })
    .order("full_name");

  if (error) {
    console.error("getSalespeople error:", error.message);
    return [];
  }

  return data ?? [];
}

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

const SALESPEOPLE_COLUMNS = "id, full_name, is_active, is_owner";

/**
 * PERF (jet hizi): "firma sahibi bu listede HER ZAMAN olsun" (spec: "Firma
 * Sahibi dahil olmak üzere eklensin") garantisi eskiden OKUMA yolunda 2 ek
 * SIRALI sorgu + asil liste = 3 art arda ag turuydu, her lead detay/ayarlar
 * gorunumunde. Simdi sahip profili ve liste AYNI turda paralel gelir; kayit
 * eksik/eski ise (nadir) sadece o zaman yazilir ve liste guncellenir.
 */
export async function getSalespeople(companyId: string): Promise<Salesperson[]> {
  const supabase = await createClient();

  const [ownerRes, listRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name").eq("company_id", companyId).eq("role", "owner").limit(1).maybeSingle(),
    supabase
      .from("salespeople")
      .select(SALESPEOPLE_COLUMNS)
      .eq("company_id", companyId)
      .order("is_owner", { ascending: false })
      .order("full_name"),
  ]);

  if (listRes.error) {
    console.error("getSalespeople error:", listRes.error.message);
    return [];
  }

  let list: Salesperson[] = listRes.data ?? [];
  const owner = ownerRes.data;
  if (!owner) return list; // henuz sahibi atanmamis bir firma

  const ownerName = owner.full_name?.trim() || "Firma Sahibi";
  const existing = list.find((sp) => sp.is_owner);

  if (!existing) {
    const { error } = await supabase
      .from("salespeople")
      .insert({ company_id: companyId, full_name: ownerName, is_owner: true, created_by: owner.id });
    if (error) {
      console.error("ensureOwnerSalesperson insert error:", error.message);
    } else {
      const { data } = await supabase
        .from("salespeople")
        .select(SALESPEOPLE_COLUMNS)
        .eq("company_id", companyId)
        .order("is_owner", { ascending: false })
        .order("full_name");
      list = data ?? list;
    }
  } else if (existing.full_name !== ownerName) {
    // Firma sahibi profildeki ismini degistirmis olabilir - senkron tut.
    const { error } = await supabase.from("salespeople").update({ full_name: ownerName }).eq("id", existing.id);
    if (error) {
      console.error("ensureOwnerSalesperson update error:", error.message);
    } else {
      list = list.map((sp) => (sp.id === existing.id ? { ...sp, full_name: ownerName } : sp));
    }
  }

  return list;
}

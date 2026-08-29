"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export type CompanyActionState = { error: string | null };

/** Firma bilgilerini gunceller - sadece owner/admin (spec: Firma Ayarlari salt okunur olmaktan cikar). */
export async function updateCompanyAction(
  companyId: string,
  prevState: CompanyActionState,
  formData: FormData
): Promise<CompanyActionState> {
  const profile = await requireProfile();
  if (profile.role === "sales") {
    return { error: "Bu işlem için yetkiniz yok." };
  }

  const str = (name: string) => {
    const v = String(formData.get(name) ?? "").trim();
    return v.length > 0 ? v : null;
  };

  const name = str("name");
  if (!name) return { error: "Firma adı zorunludur." };

  const supabase = await createClient();

  const { error } = await supabase
    .from("companies")
    .update({
      name,
      city: str("city"),
      contact_name: str("contact_name"),
      contact_email: str("contact_email"),
      contact_phone: str("contact_phone"),
    })
    .eq("id", companyId);

  if (error) {
    console.error("updateCompanyAction error:", error.message);
    return { error: `Kaydedilemedi: ${error.message}` };
  }

  revalidatePath("/settings");
  return { error: null };
}

// ----------------------------------------------------------------------------
// Satis Personeli (ISIM BAZLI, giris hesabi DEGIL): firma sahiplerinin artik
// hicbir hesap olusturma yetkisi yok (spec: "Firma sahipleri herhangi bir
// hesap oluşturma yetkisine SAHİP OLMASIN!") - eskiden burada auth.users'a
// gercek bir email/sifre hesabi acan createSalespersonAction/
// deleteSalespersonAction vardi, TAMAMEN KALDIRILDI. Gercek "sales" rolu
// hesaplari artik SADECE /admin panelinden (ajans) acilabiliyor - bkz.
// supabase/migrations/0016_salespeople_roster.sql'deki aciklama. Burada
// sadece bilgi amacli, giris yapamayan bir isim listesi yonetiliyor.
// ----------------------------------------------------------------------------

export type CreateSalespersonState = { error: string | null };

export async function createSalespersonAction(
  prevState: CreateSalespersonState,
  formData: FormData
): Promise<CreateSalespersonState> {
  const profile = await requireProfile();
  if (profile.role !== "owner") return { error: "Bu işlem için yetkiniz yok." };
  if (!profile.company_id) return { error: "Hesabınıza bağlı bir firma yok." };

  const fullName = String(formData.get("full_name") ?? "").trim();
  if (!fullName) return { error: "Ad soyad zorunludur." };

  const supabase = await createClient();
  const { error } = await supabase.from("salespeople").insert({
    company_id: profile.company_id,
    full_name: fullName,
    created_by: profile.id,
  });

  if (error) {
    console.error("createSalespersonAction error:", error.message);
    return { error: `Eklenemedi: ${error.message}` };
  }

  revalidatePath("/settings");
  return { error: null };
}

export type DeleteSalespersonState = { error: string | null };

export async function deleteSalespersonAction(
  salespersonId: string,
  prevState: DeleteSalespersonState
): Promise<DeleteSalespersonState> {
  const profile = await requireProfile();
  if (profile.role !== "owner") return { error: "Bu işlem için yetkiniz yok." };

  const supabase = await createClient();
  const { data: target, error: fetchError } = await supabase
    .from("salespeople")
    .select("id, company_id, is_owner")
    .eq("id", salespersonId)
    .single();

  if (fetchError || !target) return { error: "Kayıt bulunamadı." };
  if (target.company_id !== profile.company_id) {
    return { error: "Bu kaydı kaldırma yetkiniz yok." };
  }
  // Firma sahibinin kendi satirini (bkz. ensureOwnerSalesperson) UI'da zaten
  // gizliyoruz (silme butonu gosterilmiyor) - ama dogrudan cagrilirsa diye
  // sunucu tarafinda da kapatiyoruz.
  if (target.is_owner) {
    return { error: "Firma sahibi kaydı kaldırılamaz." };
  }

  const { error } = await supabase.from("salespeople").delete().eq("id", salespersonId);

  if (error) {
    console.error("deleteSalespersonAction error:", error.message);
    return { error: `Kaldırılamadı: ${error.message}` };
  }

  revalidatePath("/settings");
  return { error: null };
}

// ----------------------------------------------------------------------------
// Urun Kategorileri: her firma kendi urun/hizmet listesini kendisi yonetir
// (spec: "biri iklimlendirme firmasi biri sadece isitma sistemleri satiyor -
// bunu nasil halledecegim" - B sikki: firmaya ozel kategori listesi).
// ----------------------------------------------------------------------------

export type CreateCategoryState = { error: string | null };

export async function createProductCategoryAction(
  prevState: CreateCategoryState,
  formData: FormData
): Promise<CreateCategoryState> {
  const profile = await requireProfile();
  if (profile.role === "sales") return { error: "Bu işlem için yetkiniz yok." };
  if (!profile.company_id) return { error: "Hesabınıza bağlı bir firma yok." };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: "Kategori adı zorunludur." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("product_categories")
    .select("id")
    .eq("company_id", profile.company_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("product_categories").insert({
    company_id: profile.company_id,
    label,
    sort_order: existing ? undefined : 0,
  });

  if (error) {
    console.error("createProductCategoryAction error:", error.message);
    const message = error.code === "23505" ? "Bu isimde bir kategori zaten var." : `Eklenemedi: ${error.message}`;
    return { error: message };
  }

  revalidatePath("/settings");
  revalidatePath("/leads/new");
  return { error: null };
}

export type DeleteCategoryState = { error: string | null };

export async function deleteProductCategoryAction(
  categoryId: string,
  prevState: DeleteCategoryState
): Promise<DeleteCategoryState> {
  const profile = await requireProfile();
  if (profile.role === "sales") return { error: "Bu işlem için yetkiniz yok." };

  const supabase = await createClient();
  const { data: category, error: fetchError } = await supabase
    .from("product_categories")
    .select("id, company_id")
    .eq("id", categoryId)
    .single();

  if (fetchError || !category) return { error: "Kategori bulunamadı." };
  if (profile.role === "owner" && category.company_id !== profile.company_id) {
    return { error: "Bu kategoriyi kaldırma yetkiniz yok." };
  }

  const { error } = await supabase.from("product_categories").delete().eq("id", categoryId);

  if (error) {
    console.error("deleteProductCategoryAction error:", error.message);
    return { error: `Kaldırılamadı: ${error.message}` };
  }

  revalidatePath("/settings");
  revalidatePath("/leads/new");
  return { error: null };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
// Satis Personeli yonetimi: firma sahibi kendi firmasi icin dogrudan giris
// hesabi olusturabilir/kaldirabilir (spec: "orada duzenledigi kisi otomatik
// kayit olsun, kaldirdigi kisi sistemden silinsin"). Sadece "sales" rolu -
// owner/admin hesaplari buradan olusturulamaz/silinemez.
// ----------------------------------------------------------------------------

export type CreateSalespersonState = { error: string | null };

export async function createSalespersonAction(
  prevState: CreateSalespersonState,
  formData: FormData
): Promise<CreateSalespersonState> {
  const profile = await requireProfile();
  if (profile.role === "sales") return { error: "Bu işlem için yetkiniz yok." };
  if (!profile.company_id) return { error: "Hesabınıza bağlı bir firma yok." };

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!email || !password) return { error: "E-posta ve şifre zorunludur." };
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalıdır." };
  if (!fullName) return { error: "Ad soyad zorunludur." };

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role: "sales", company_id: profile.company_id },
  });

  if (error) {
    console.error("createSalespersonAction error:", error.message);
    return { error: `Kullanıcı oluşturulamadı: ${error.message}` };
  }

  revalidatePath("/settings");
  return { error: null };
}

export type DeleteSalespersonState = { error: string | null };

export async function deleteSalespersonAction(
  userId: string,
  prevState: DeleteSalespersonState
): Promise<DeleteSalespersonState> {
  const profile = await requireProfile();
  if (profile.role === "sales") return { error: "Bu işlem için yetkiniz yok." };

  const supabase = await createClient();
  const { data: target, error: fetchError } = await supabase
    .from("profiles")
    .select("id, role, company_id")
    .eq("id", userId)
    .single();

  if (fetchError || !target) return { error: "Kullanıcı bulunamadı." };
  if (target.role !== "sales") return { error: "Sadece satış personeli kaldırılabilir." };
  if (profile.role === "owner" && target.company_id !== profile.company_id) {
    return { error: "Bu kullanıcıyı kaldırma yetkiniz yok." };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient.auth.admin.deleteUser(userId);

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

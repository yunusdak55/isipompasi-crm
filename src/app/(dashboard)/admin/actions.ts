"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { IntegrationProvider, IntegrationStatus } from "@/lib/types/domain";

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    throw new Error("Bu işlem için yetkiniz yok.");
  }
  return profile;
}

// ----------------------------------------------------------------------------
// Firmalar: yeni musteri firma ekleme + giris hesabi TEK ADIMDA (spec: "ben
// bir kişi ile anlaştığımda kendi panelime girip firma ismi oluşturayım,
// giriş bilgileri belirleyeyim... sonra anlaştığım kişi bu bilgilerle girip
// içeriden kendi satış personeli kısmından oluştursun"). Eskiden "Firma
// Ekle" ve "Kullanıcı Ekle" ayrı iki adimdi (once firma olustur, sonra ayri
// bir sayfada dropdown'dan firmayi sec, kullanici olustur) - artik tek form.
// ----------------------------------------------------------------------------

export type CreateCompanyState = { error: string | null };

export async function createCompanyWithOwnerAction(
  prevState: CreateCompanyState,
  formData: FormData
): Promise<CreateCompanyState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();

  if (!name) return { error: "Firma adı zorunludur." };
  if (!email || !password) return { error: "E-posta ve şifre zorunludur." };
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalıdır." };

  const str = (field: string) => {
    const v = String(formData.get(field) ?? "").trim();
    return v.length > 0 ? v : null;
  };

  const supabase = await createClient();
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .insert({
      name,
      city: str("city"),
      contact_name: str("contact_name"),
      contact_email: str("contact_email"),
      contact_phone: str("contact_phone"),
    })
    .select("id")
    .single();

  if (companyError || !company) {
    console.error("createCompanyWithOwnerAction company error:", companyError?.message);
    return { error: `Firma oluşturulamadı: ${companyError?.message ?? "bilinmeyen hata"}` };
  }

  // DUZELTME (denetim bulgusu): yeni firmalar hicbir urun kategorisiyle
  // baslamiyordu - mevcut firmalar migration 0010'da bir kereye mahsus
  // tohumlanmisti ama YENI firma olusturma akisinda bu adim hic yoktu.
  // Sonuc: yeni musteri "Yeni Lead" formunu actiginda urun kategorisi
  // dropdown'u BOMBOS geliyordu. Ayni varsayilan 4 kategoriyi burada da
  // tohumluyoruz - firma sahibi Firma Ayarları'ndan istedigi gibi
  // duzenler/siler/ekler, sadece bos baslamasin diye.
  const { error: categoriesError } = await supabase.from("product_categories").insert([
    { company_id: company.id, label: "Isı Pompası", sort_order: 0 },
    { company_id: company.id, label: "Klima", sort_order: 1 },
    { company_id: company.id, label: "VRF/VRV Sistemi", sort_order: 2 },
    { company_id: company.id, label: "Diğer", sort_order: 3 },
  ]);
  if (categoriesError) {
    // Kritik degil - firma/hesap olusumu yine de devam eder, sadece loglariz.
    console.error("createCompanyWithOwnerAction categories error:", categoriesError.message);
  }

  const adminClient = createAdminClient();
  const { error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName || name, role: "owner", company_id: company.id },
  });

  if (userError) {
    console.error("createCompanyWithOwnerAction user error:", userError.message);
    // Firma zaten olustu - geri almiyoruz, admin firma listesinde firmayi
    // gorup "Kullanıcılar" sayfasından giriş hesabını tekrar deneyebilir.
    return {
      error: `Firma oluşturuldu ama giriş hesabı oluşturulamadı: ${userError.message}. "Kullanıcılar" sayfasından bu firma için tekrar deneyebilirsiniz.`,
    };
  }

  revalidatePath("/admin/companies");
  revalidatePath("/admin/users");
  return { error: null };
}

export type ToggleCompanyActiveState = { error: string | null };

export async function toggleCompanyActiveAction(
  companyId: string,
  nextActive: boolean,
  prevState: ToggleCompanyActiveState
): Promise<ToggleCompanyActiveState> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("companies").update({ is_active: nextActive }).eq("id", companyId);

  if (error) {
    console.error("toggleCompanyActiveAction error:", error.message);
    return { error: `Güncellenemedi: ${error.message}` };
  }

  revalidatePath("/admin/companies");
  return { error: null };
}

export type DeleteCompanyState = { error: string | null };

/**
 * Firmayi VE ona bagli gercek giris hesaplarini (owner/sales) kalici olarak
 * siler (spec: "istediğim firmayı pasif hale getirmenin yanı sıra
 * kaldırabileyim, silebiliyim yani"). Once auth.users hesaplarini kaldirir -
 * profiles satiri auth.users'a "on delete cascade" bagli oldugu icin otomatik
 * silinir. Sonra companies satiri silinir - leads/sales/followups/activities/
 * product_categories/salespeople hepsi "on delete cascade" ile otomatik gider.
 * GERI ALINAMAZ.
 *
 * DUZELTME (canli denetimde yakalanan gercek hata): gercekten kullanilmis
 * (en az bir lead/not/takip/satis girilmis) bir firmayi silmek eskiden HER
 * ZAMAN basarisiz oluyordu. Sebep: `leads.created_by/updated_by`,
 * `activities.created_by`, `followups.created_by`, `offers.created_by`,
 * `sales.salesperson/created_by`, `ai_reports.created_by` kolonlarinin
 * TAMAMI profiles'a ON DELETE CASCADE/SET NULL OLMADAN referans veriyor
 * (bkz. 0001_init_schema.sql) - bu yuzden "kim olusturdu/kim sattı" gibi
 * IZ BIRAKAN herhangi bir kayit varsa, o kaydi bırakan hesabi silmeye
 * calisinca veritabani "hala referans ediliyor" diye reddediyordu. Simdi
 * hesaplari silmeden ONCE bu firmaya ait TUM bu iz-birakan referanslari
 * temizliyoruz - satirlarin KENDISI birkac satir sonra companies
 * cascade'iyle zaten silinecek, sadece hesap silme sirasinda araya giren
 * kilitleri aciyoruz.
 */
export async function deleteCompanyAction(companyId: string, prevState: DeleteCompanyState): Promise<DeleteCompanyState> {
  await requireAdmin();

  const supabase = await createClient();

  // Not: eski "offers" tablosu (ozellik kaldirildi, bkz. spec: "teklif
  // ozelligini kaldir") database.types.ts'e hic eklenmemisti - yeni kod hic
  // yazmiyor, sadece cok eski/legacy bir satir varsa (dusuk ihtimal) o TEK
  // durumda silme yine de "hala referans ediliyor" hatasi verebilir.
  const clearLeads = await supabase.from("leads").update({ created_by: null, updated_by: null }).eq("company_id", companyId);
  const clearActivities = await supabase.from("activities").update({ created_by: null }).eq("company_id", companyId);
  const clearFollowups = await supabase.from("followups").update({ created_by: null }).eq("company_id", companyId);
  const clearSales = await supabase.from("sales").update({ salesperson: null, created_by: null }).eq("company_id", companyId);
  const clearAiReports = await supabase.from("ai_reports").update({ created_by: null }).eq("company_id", companyId);

  for (const step of [clearLeads, clearActivities, clearFollowups, clearSales, clearAiReports]) {
    if (step.error) {
      console.error("deleteCompanyAction clear reference error:", step.error.message);
      return { error: `Firma silinemedi: ${step.error.message}` };
    }
  }

  const { data: profiles } = await supabase.from("profiles").select("id").eq("company_id", companyId);

  const adminClient = createAdminClient();
  for (const p of profiles ?? []) {
    const { error: delUserError } = await adminClient.auth.admin.deleteUser(p.id);
    if (delUserError) {
      console.error("deleteCompanyAction deleteUser error:", delUserError.message);
      return { error: `Firma kullanıcıları silinirken hata oluştu: ${delUserError.message}` };
    }
  }

  const { error } = await supabase.from("companies").delete().eq("id", companyId);

  if (error) {
    console.error("deleteCompanyAction error:", error.message);
    return { error: `Firma silinemedi: ${error.message}` };
  }

  revalidatePath("/admin/companies");
  revalidatePath("/admin/users");
  return { error: null };
}

// ----------------------------------------------------------------------------
// Firmalar: isim (ve temel bilgi) duzenleme - eskiden sadece olusturma vardi,
// bir kere eklenen firmanin adi admin panelinden hic degistirilemiyordu
// (spec: "admin panelimden yeni firma eklediğimde onların isimlerini de
// düzenleyebileyim").
// ----------------------------------------------------------------------------

export type UpdateCompanyNameState = { error: string | null };

export async function updateCompanyNameAction(
  companyId: string,
  prevState: UpdateCompanyNameState,
  formData: FormData
): Promise<UpdateCompanyNameState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Firma adı zorunludur." };

  const supabase = await createClient();
  const { error } = await supabase.from("companies").update({ name }).eq("id", companyId);

  if (error) {
    console.error("updateCompanyNameAction error:", error.message);
    return { error: `Güncellenemedi: ${error.message}` };
  }

  revalidatePath("/admin/companies");
  revalidatePath("/admin/users");
  return { error: null };
}

// ----------------------------------------------------------------------------
// Kullanicilar: musteri firma icin yeni giris hesabi olusturma (spec: "ben
// ajansim, musterilerime kullanici adi sifre olusturup verecegim" - bu artik
// elle script yerine panelden yapilabiliyor). Gercek Supabase Auth kullanicisi
// olusturur; profiles kaydi handle_new_user() trigger'i ile otomatik olusur
// (raw_user_meta_data'dan role/company_id/full_name okuyor).
// ----------------------------------------------------------------------------

export type CreateUserState = { error: string | null };

export async function createCompanyUserAction(prevState: CreateUserState, formData: FormData): Promise<CreateUserState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "").trim();
  const role = String(formData.get("role") ?? "owner");

  if (!email || !password) return { error: "E-posta ve şifre zorunludur." };
  if (password.length < 8) return { error: "Şifre en az 8 karakter olmalıdır." };
  if (!fullName) return { error: "Ad soyad zorunludur." };
  if (!companyId) return { error: "Firma seçimi zorunludur." };
  if (role !== "owner" && role !== "sales") return { error: "Geçersiz rol." };

  const adminClient = createAdminClient();

  const { error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, company_id: companyId },
  });

  if (error) {
    console.error("createCompanyUserAction error:", error.message);
    return { error: `Kullanıcı oluşturulamadı: ${error.message}` };
  }

  revalidatePath("/admin/users");
  return { error: null };
}

export type ToggleUserActiveState = { error: string | null };

export async function toggleUserActiveAction(
  userId: string,
  nextActive: boolean,
  prevState: ToggleUserActiveState
): Promise<ToggleUserActiveState> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ is_active: nextActive }).eq("id", userId);

  if (error) {
    console.error("toggleUserActiveAction error:", error.message);
    return { error: `Güncellenemedi: ${error.message}` };
  }

  revalidatePath("/admin/users");
  return { error: null };
}

// ----------------------------------------------------------------------------
// Entegrasyonlar: firma x saglayici durum takibi. Gercek OAuth/webhook
// baglantisi bu uygulamanin disinda (n8n vb.) yapilir - burasi sadece "hangi
// musteride hangi entegrasyon hangi asamada" durumunu elle isaretlemek icin.
// Gizli anahtar/token BURADA TUTULMAZ (bkz. migration yorumu).
// ----------------------------------------------------------------------------

export type SetIntegrationStatusState = { error: string | null };

export async function setIntegrationStatusAction(
  companyId: string,
  provider: IntegrationProvider,
  status: IntegrationStatus,
  prevState: SetIntegrationStatusState
): Promise<SetIntegrationStatusState> {
  await requireAdmin();

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("integrations")
    .select("id")
    .eq("company_id", companyId)
    .eq("provider", provider)
    .maybeSingle();

  const connected_at = status === "connected" ? new Date().toISOString() : null;

  const { error } = existing
    ? await supabase.from("integrations").update({ status, connected_at }).eq("id", existing.id)
    : await supabase.from("integrations").insert({ company_id: companyId, provider, status, connected_at });

  if (error) {
    console.error("setIntegrationStatusAction error:", error.message);
    return { error: `Güncellenemedi: ${error.message}` };
  }

  revalidatePath("/admin/integrations");
  return { error: null };
}

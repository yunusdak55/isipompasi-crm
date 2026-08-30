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
// Firmalar: yeni musteri firma ekleme
// ----------------------------------------------------------------------------

export type CreateCompanyState = { error: string | null };

export async function createCompanyAction(prevState: CreateCompanyState, formData: FormData): Promise<CreateCompanyState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Firma adı zorunludur." };

  const str = (field: string) => {
    const v = String(formData.get(field) ?? "").trim();
    return v.length > 0 ? v : null;
  };

  const supabase = await createClient();
  const { error } = await supabase.from("companies").insert({
    name,
    city: str("city"),
    contact_name: str("contact_name"),
    contact_email: str("contact_email"),
    contact_phone: str("contact_phone"),
  });

  if (error) {
    console.error("createCompanyAction error:", error.message);
    return { error: `Firma oluşturulamadı: ${error.message}` };
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

"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ProspectStatus } from "@/lib/types/domain";

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    throw new Error("Bu işlem için yetkiniz yok.");
  }
  return profile;
}

function revalidateProspects() {
  revalidatePath("/admin/prospects");
  revalidatePath("/admin/prospects/calendar");
}

/**
 * "Kaç gün sonra aransın?" girdisini gerçek takip tarihine çevirir (spec:
 * "tarih eklemek yerine kaç gün sonra aransın diye sorsun, ben yazınca
 * otomatik kaydetsin"). `null` döner: gün sayısı geçersizse.
 */
function daysToFollowupDate(daysStr: string): Date | null {
  if (daysStr === "") return null;
  const days = Number(daysStr);
  if (!Number.isFinite(days) || days < 0 || !Number.isInteger(days)) return null;

  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  date.setHours(10, 0, 0, 0);
  return date;
}

// ----------------------------------------------------------------------------
// Yeni musteri adayi (ajansin aradigi firma) ekleme.
// ----------------------------------------------------------------------------

export type CreateProspectState = { error: string | null };

export async function createProspectAction(prevState: CreateProspectState, formData: FormData): Promise<CreateProspectState> {
  const profile = await requireAdmin();

  const companyName = String(formData.get("company_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!companyName) return { error: "Firma adı zorunludur." };

  const supabase = await createClient();
  const { error } = await supabase.from("agency_prospects").insert({
    company_name: companyName,
    contact_name: contactName,
    phone,
    notes,
    status: "new",
    created_by: profile.id,
  });

  if (error) {
    console.error("createProspectAction error:", error.message);
    return { error: `Eklenemedi: ${error.message}` };
  }

  revalidateProspects();
  return { error: null };
}

// ----------------------------------------------------------------------------
// Durum degistirme (ör. "Kayıp" olarak isaretleme). Durum degisikligi bir
// gorusmenin sonucunu yansittigi icin ayni anda last_contact_at = simdi
// olarak guncellenir - spec: "aradığım firmaların yaptığım görüşmeleri
// kayıt edebileceğim" (durumu degistirmek zaten bir temas kaydidir).
// ----------------------------------------------------------------------------

export type UpdateProspectStatusState = { error: string | null };

export async function updateProspectStatusAction(
  prospectId: string,
  nextStatus: ProspectStatus,
  prevState: UpdateProspectStatusState
): Promise<UpdateProspectStatusState> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase
    .from("agency_prospects")
    .update({ status: nextStatus, last_contact_at: new Date().toISOString() })
    .eq("id", prospectId);

  if (error) {
    console.error("updateProspectStatusAction error:", error.message);
    return { error: `Güncellenemedi: ${error.message}` };
  }

  revalidateProspects();
  return { error: null };
}

// ----------------------------------------------------------------------------
// Firma bilgisi / notlar duzenleme (telefon, iletisim kisisi, not). Kayit
// guncellendiginde son temas tarihi de tazelenir.
// ----------------------------------------------------------------------------

export type UpdateProspectState = { error: string | null };

export async function updateProspectAction(
  prospectId: string,
  prevState: UpdateProspectState,
  formData: FormData
): Promise<UpdateProspectState> {
  await requireAdmin();

  const companyName = String(formData.get("company_name") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!companyName) return { error: "Firma adı zorunludur." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agency_prospects")
    .update({
      company_name: companyName,
      contact_name: contactName,
      phone,
      notes,
      last_contact_at: new Date().toISOString(),
    })
    .eq("id", prospectId);

  if (error) {
    console.error("updateProspectAction error:", error.message);
    return { error: `Güncellenemedi: ${error.message}` };
  }

  revalidateProspects();
  return { error: null };
}

// ----------------------------------------------------------------------------
// Bir sonraki takip tarihi/notu - takvimden veya liste satirindan.
// ----------------------------------------------------------------------------

export type FollowupActionState = { error: string | null };

export async function upsertProspectFollowupAction(
  prospectId: string,
  prevState: FollowupActionState,
  formData: FormData
): Promise<FollowupActionState> {
  await requireAdmin();

  const daysStr = String(formData.get("followup_days") ?? "");
  const note = String(formData.get("followup_note") ?? "").trim() || null;

  const followupDate = daysToFollowupDate(daysStr);
  if (!followupDate) return { error: "Kaç gün sonra aranacağı zorunludur ve geçerli bir sayı olmalıdır." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("agency_prospects")
    .update({
      next_followup_at: followupDate.toISOString(),
      next_followup_note: note,
      status: "followup",
    })
    .eq("id", prospectId);

  if (error) {
    console.error("upsertProspectFollowupAction error:", error.message);
    return { error: `Kaydedilemedi: ${error.message}` };
  }

  revalidateProspects();
  return { error: null };
}

/** Takvimden dogrudan YENI bir musteri adayi + ilk takip tarihi birlikte olusturur. */
export async function createProspectWithFollowupAction(
  prevState: FollowupActionState,
  formData: FormData
): Promise<FollowupActionState> {
  const profile = await requireAdmin();

  const companyName = String(formData.get("new_company_name") ?? "").trim();
  const phone = String(formData.get("new_company_phone") ?? "").trim() || null;
  const daysStr = String(formData.get("followup_days") ?? "");
  const note = String(formData.get("followup_note") ?? "").trim() || null;

  if (!companyName) return { error: "Firma adı zorunludur." };

  const followupDate = daysToFollowupDate(daysStr);
  if (!followupDate) return { error: "Kaç gün sonra aranacağı zorunludur ve geçerli bir sayı olmalıdır." };

  const supabase = await createClient();
  const { error } = await supabase.from("agency_prospects").insert({
    company_name: companyName,
    phone,
    status: "followup",
    next_followup_at: followupDate.toISOString(),
    next_followup_note: note,
    created_by: profile.id,
  });

  if (error) {
    console.error("createProspectWithFollowupAction error:", error.message);
    return { error: `Eklenemedi: ${error.message}` };
  }

  revalidateProspects();
  return { error: null };
}

// ----------------------------------------------------------------------------
// Silme (yanlislikla eklenen kaydi temizlemek icin - GERI ALINAMAZ).
// ----------------------------------------------------------------------------

export type DeleteProspectState = { error: string | null };

export async function deleteProspectAction(prospectId: string, prevState: DeleteProspectState): Promise<DeleteProspectState> {
  await requireAdmin();

  const supabase = await createClient();
  const { error } = await supabase.from("agency_prospects").delete().eq("id", prospectId);

  if (error) {
    console.error("deleteProspectAction error:", error.message);
    return { error: `Silinemedi: ${error.message}` };
  }

  revalidateProspects();
  return { error: null };
}

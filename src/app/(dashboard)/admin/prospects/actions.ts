"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ProspectStatus } from "@/lib/types/domain";
import type { Database } from "@/lib/types/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type ProspectActivityType = Database["public"]["Tables"]["agency_prospect_activities"]["Row"]["type"];

async function requireAdmin() {
  const profile = await requireProfile();
  if (profile.role !== "admin") {
    throw new Error("Bu işlem için yetkiniz yok.");
  }
  return profile;
}

function revalidateProspects(prospectId?: string) {
  revalidatePath("/admin/prospects");
  revalidatePath("/admin/prospects/calendar");
  revalidatePath("/admin/prospects/followups");
  if (prospectId) revalidatePath(`/admin/prospects/${prospectId}`);
}

/**
 * Aday profilindeki zaman çizelgesine otomatik giriş ekler - leads/actions.ts
 * içindeki logActivity ile AYNI desen (spec: "bir zaman çizelgesi notlar
 * kısmı olsun... tarihi ve zamanıyla birlikte kendisi gözüksün"). Hata
 * olursa ana işlemi bozmaz, sadece loglanır.
 */
async function logProspectActivity(
  supabase: SupabaseServerClient,
  params: { prospectId: string; type: ProspectActivityType; description: string }
) {
  const { error } = await supabase.from("agency_prospect_activities").insert({
    prospect_id: params.prospectId,
    type: params.type,
    description: params.description,
  });

  if (error) {
    console.error("logProspectActivity error:", error.message);
  }
}

/**
 * "Kaç gün sonra aransın?" girdisini gerçek takip tarihine çevirir (spec:
 * "tarih eklemek yerine kaç gün sonra aransın diye sorsun, ben yazınca
 * otomatik kaydetsin"). DUZELTME (spec: "manuel saat girme falanı da
 * kaldır, kaç gün sonra takip edileceğini yazdığımda o kadar gün sonrasında
 * takvime atsın yeterli") - saat girdisi tamamen kaldırıldı, sabit 10:00'a
 * yazılıyor (leads/actions.ts'teki upsertFollowupAction ile aynı yaklaşım).
 * `null` döner: gün sayısı geçersizse.
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
  const { data, error } = await supabase
    .from("agency_prospects")
    .insert({
      company_name: companyName,
      contact_name: contactName,
      phone,
      notes,
      status: "new",
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createProspectAction error:", error?.message);
    return { error: `Eklenemedi: ${error?.message ?? "bilinmeyen hata"}` };
  }

  await logProspectActivity(supabase, { prospectId: data.id, type: "system", description: "Aday oluşturuldu." });

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

  await logProspectActivity(supabase, {
    prospectId,
    type: "status_change",
    description: `Durum "${PROSPECT_STATUS_TR[nextStatus]}" olarak güncellendi.`,
  });

  revalidateProspects(prospectId);
  return { error: null };
}

const PROSPECT_STATUS_TR: Record<ProspectStatus, string> = {
  new: "Aranacak",
  contacted: "Görüşüldü",
  followup: "Takipte",
  won: "Müşteri Oldu",
  lost: "Kayıp",
};

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

  revalidateProspects(prospectId);
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

  const dayLabel = followupDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  await logProspectActivity(supabase, {
    prospectId,
    type: "system",
    description: `Takip eklendi: ${dayLabel} tarihinde tekrar aranacak.${note ? ` Not: ${note}` : ""}`,
  });

  revalidateProspects(prospectId);
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
  const { data, error } = await supabase
    .from("agency_prospects")
    .insert({
      company_name: companyName,
      phone,
      status: "followup",
      next_followup_at: followupDate.toISOString(),
      next_followup_note: note,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createProspectWithFollowupAction error:", error?.message);
    return { error: `Eklenemedi: ${error?.message ?? "bilinmeyen hata"}` };
  }

  const dayLabel = followupDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  await logProspectActivity(supabase, {
    prospectId: data.id,
    type: "system",
    description: `Aday oluşturuldu, ${dayLabel} tarihinde aranacak.${note ? ` Not: ${note}` : ""}`,
  });

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

// ----------------------------------------------------------------------------
// Profil zaman çizelgesine serbest not ekleme (spec: "istediğim zaman NOT
// alabileyim ve aldığım not burada tarihi ve zamanıyla birlikte kendisi
// gözüksün"). Kaydedilir kaydedilmez created_at = şimdi damgalanır -
// gösterim formatDateTime ile yapılır (bkz. prospects/[id]/page.tsx).
// ----------------------------------------------------------------------------

export type AddProspectNoteState = { error: string | null };

export async function addProspectNoteAction(
  prospectId: string,
  prevState: AddProspectNoteState,
  formData: FormData
): Promise<AddProspectNoteState> {
  await requireAdmin();

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Not boş olamaz." };

  const supabase = await createClient();
  const { error } = await supabase.from("agency_prospect_activities").insert({
    prospect_id: prospectId,
    type: "note",
    description: body,
  });

  if (error) {
    console.error("addProspectNoteAction error:", error.message);
    return { error: `Not kaydedilemedi: ${error.message}` };
  }

  // Not almak da bir temas kaydidir - "Takipte" listesindeki "en son ne
  // zaman görüşüldü" bilgisinin de tazelenmesi icin last_contact_at guncellenir.
  await supabase.from("agency_prospects").update({ last_contact_at: new Date().toISOString() }).eq("id", prospectId);

  revalidateProspects(prospectId);
  return { error: null };
}

"use server";

import { revalidatePath } from "next/cache";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PROSPECT_STATUS_LABELS } from "@/lib/constants/prospects";
import type { ProspectStatus } from "@/lib/types/domain";
import type { Database } from "@/lib/types/database.types";
import { friendlyDbError } from "@/lib/errors";
import { TR_TZ, followupDateTR } from "@/lib/time";

/** Takip icin en fazla 10 yil sonrasi (gecersiz tarih/asiri deger koruması). */
const MAX_FOLLOWUP_DAYS = 3650;

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
  revalidatePath("/admin/prospects/overdue");
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
  // Ust sinir: cok buyuk sayi gecersiz tarih uretir (toISOString RangeError -> 500).
  if (!Number.isFinite(days) || days < 0 || days > MAX_FOLLOWUP_DAYS || !Number.isInteger(days)) return null;

  // Turkiye saatiyle bugunden `days` gun sonrasinin 10:00'i (sunucu UTC olsa da - bkz. lib/time.ts).
  return followupDateTR(days);
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
    return { error: `Eklenemedi: ${friendlyDbError(error)}` };
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
    return { error: `Güncellenemedi: ${friendlyDbError(error)}` };
  }

  await logProspectActivity(supabase, {
    prospectId,
    type: "status_change",
    description: `Durum "${PROSPECT_STATUS_LABELS[nextStatus]}" olarak güncellendi.`,
  });

  revalidateProspects(prospectId);
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
    return { error: `Güncellenemedi: ${friendlyDbError(error)}` };
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
    return { error: `Kaydedilemedi: ${friendlyDbError(error)}` };
  }

  const dayLabel = followupDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: TR_TZ });
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
    return { error: `Eklenemedi: ${friendlyDbError(error)}` };
  }

  const dayLabel = followupDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: TR_TZ });
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
    return { error: `Silinemedi: ${friendlyDbError(error)}` };
  }

  revalidateProspects();
  return { error: null };
}

// ----------------------------------------------------------------------------
// GORUSME SONUCU - tek adimda: ne konusuldu (not) + sonuc. Spec: "bir
// musteriyi aradim; ismi, numarasi, gorusmede ne oldu? Ondan sonra 3 farkli
// secenek: takibe alirim, kayip olarak isaretlerim ya da satis olarak
// isaretlerim". Not, tarih-saatiyle zaman cizelgesine (agency_prospect_
// activities) duser (created_at = simdi); bir sonraki giriste "su tarihte su
// demis" diye okunabilir. 4. secenek "note": sadece not, durum degismez.
// ----------------------------------------------------------------------------

export type ProspectOutcome = "followup" | "lost" | "won" | "note";
export type LogProspectOutcomeState = { error: string | null };

export async function logProspectOutcomeAction(
  prospectId: string,
  prevState: LogProspectOutcomeState,
  formData: FormData
): Promise<LogProspectOutcomeState> {
  await requireAdmin();

  const note = String(formData.get("note") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "") as ProspectOutcome;
  const daysStr = String(formData.get("followup_days") ?? "").trim();

  if (!["followup", "lost", "won", "note"].includes(outcome)) return { error: "Bir sonuç seçin." };
  if (!note) return { error: "Görüşmede ne olduğunu yazın." };

  let followupDate: Date | null = null;
  if (outcome === "followup") {
    followupDate = daysToFollowupDate(daysStr);
    if (!followupDate) return { error: "Takibe almak için kaç gün sonra aranacağını yazın." };
  }

  const supabase = await createClient();

  const { error: noteError } = await supabase.from("agency_prospect_activities").insert({
    prospect_id: prospectId,
    type: "note",
    description: note,
  });
  if (noteError) {
    console.error("logProspectOutcomeAction note error:", noteError.message);
    return { error: `Not kaydedilemedi: ${friendlyDbError(noteError)}` };
  }

  // Not almak da bir temastir - "en son ne zaman gorusuldu" tazelenir.
  const update: Database["public"]["Tables"]["agency_prospects"]["Update"] = {
    last_contact_at: new Date().toISOString(),
  };
  let systemLine: string | null = null;

  if (outcome === "followup" && followupDate) {
    update.status = "followup";
    update.next_followup_at = followupDate.toISOString();
    update.next_followup_note = null;
    const dayLabel = followupDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: TR_TZ });
    systemLine = `Takibe alındı: ${dayLabel} tarihinde tekrar aranacak.`;
  } else if (outcome === "won") {
    update.status = "won";
    update.next_followup_at = null;
    update.next_followup_note = null;
    systemLine = "Müşteri oldu.";
  } else if (outcome === "lost") {
    update.status = "lost";
    update.next_followup_at = null;
    update.next_followup_note = null;
    systemLine = "Kayıp olarak işaretlendi.";
  }

  const { error } = await supabase.from("agency_prospects").update(update).eq("id", prospectId);
  if (error) {
    console.error("logProspectOutcomeAction update error:", error.message);
    return { error: `Güncellenemedi: ${friendlyDbError(error)}` };
  }

  if (systemLine) {
    await logProspectActivity(supabase, { prospectId, type: "status_change", description: systemLine });
  }

  revalidateProspects(prospectId);
  return { error: null };
}

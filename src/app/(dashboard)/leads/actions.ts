"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { LEAD_STATUS_LABELS } from "@/lib/constants/lead";
import type { LeadStatus } from "@/lib/types/domain";
import type { Database } from "@/lib/types/database.types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Lead detay zaman cizelgesine (activities) otomatik giris ekler (spec 9).
 * from_status/to_status: sadece status_change tipinde doldurulur - ileride
 * funnel/donusum analizleri (AI/Raporlar) description metnini parse etmeden
 * bu iki yapilandirilmis alani okuyabilsin diye (spec: pipeline v2).
 */
async function logActivity(
  supabase: SupabaseServerClient,
  params: {
    leadId: string;
    companyId: string;
    type: Database["public"]["Tables"]["activities"]["Row"]["type"];
    description: string;
    fromStatus?: LeadStatus;
    toStatus?: LeadStatus;
  }
) {
  const { error } = await supabase.from("activities").insert({
    lead_id: params.leadId,
    company_id: params.companyId,
    type: params.type,
    description: params.description,
    from_status: params.fromStatus ?? null,
    to_status: params.toStatus ?? null,
  });
  if (error) {
    console.error("logActivity error:", error.message);
  }
}

function revalidateLead(leadId: string) {
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  revalidatePath("/leads/board");
  revalidatePath("/leads/calendar");
  revalidatePath("/leads/followups");
  revalidatePath("/leads/overdue");
  revalidatePath("/dashboard");
  revalidatePath("/sales");
  revalidatePath("/reports");
}

// ----------------------------------------------------------------------------
// Musteri bilgileri formu (olusturma + duzenleme ortak)
// ----------------------------------------------------------------------------

export type LeadFormState = { error: string | null };

type ParsedLeadForm = {
  first_name: string;
  last_name: string | null;
  city: string | null;
  district: string | null;
  phone: string;
  property_type: Database["public"]["Tables"]["leads"]["Row"]["property_type"];
  area_m2: number | null;
  building_status: Database["public"]["Tables"]["leads"]["Row"]["building_status"];
  heating_type: Database["public"]["Tables"]["leads"]["Row"]["heating_type"];
  underfloor_heating: boolean;
  radiator: boolean;
  product_category_id: string | null;
  purchase_timeline: Database["public"]["Tables"]["leads"]["Row"]["purchase_timeline"];
  offered_amount: number | null;
  notes: string | null;
};

/**
 * "Ahmet Yılmaz" -> { first_name: "Ahmet", last_name: "Yılmaz" }. Tek kelimeyse
 * (orn. "Ahmet") tamami first_name'e gider, last_name null kalir. Birden fazla
 * bosluk varsa (orn. "Ahmet Mehmet Yılmaz") son kelime disindaki her sey
 * first_name'e gider - Turkce isimlerde en yaygin/guvenli varsayim budur.
 */
function splitFullName(fullName: string): { first_name: string; last_name: string | null } {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  const lastSpace = normalized.lastIndexOf(" ");
  if (lastSpace === -1) return { first_name: normalized, last_name: null };
  return { first_name: normalized.slice(0, lastSpace), last_name: normalized.slice(lastSpace + 1) };
}

/** "Sakarya / Sapanca" -> { city: "Sakarya", district: "Sapanca" }. "/" yoksa tamami city'e gider. */
function splitLocation(location: string): { city: string | null; district: string | null } {
  const trimmed = location.trim();
  if (!trimmed) return { city: null, district: null };
  const parts = trimmed
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return { city: null, district: null };
  return { city: parts[0], district: parts.length > 1 ? parts.slice(1).join(" / ") : null };
}

function parseLeadForm(formData: FormData): { data: ParsedLeadForm } | { error: string } {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!fullName) return { error: "Ad Soyad zorunludur." };
  if (!phone) return { error: "Telefon zorunludur." };

  const str = (name: string) => {
    const v = String(formData.get(name) ?? "").trim();
    return v.length > 0 ? v : null;
  };
  const num = (name: string) => {
    const raw = formData.get(name);
    if (raw === null || String(raw).trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };

  const area_m2 = num("area_m2");
  if (area_m2 !== null && area_m2 <= 0) {
    return { error: "Alan (m²) pozitif bir sayı olmalıdır." };
  }

  const offered_amount = num("offered_amount");
  if (offered_amount !== null && offered_amount < 0) {
    return { error: "Teklif tutarı negatif olamaz." };
  }

  const { first_name, last_name } = splitFullName(fullName);
  const { city, district } = splitLocation(String(formData.get("location") ?? ""));

  return {
    data: {
      first_name,
      last_name,
      city,
      district,
      phone,
      property_type: str("property_type") as ParsedLeadForm["property_type"],
      area_m2,
      building_status: str("building_status") as ParsedLeadForm["building_status"],
      heating_type: str("heating_type") as ParsedLeadForm["heating_type"],
      underfloor_heating: formData.get("underfloor_heating") === "on",
      radiator: formData.get("radiator") === "on",
      product_category_id: str("product_category_id"),
      purchase_timeline: str("purchase_timeline") as ParsedLeadForm["purchase_timeline"],
      offered_amount,
      notes: str("notes"),
    },
  };
}

/**
 * Item 1: Lead olusturma. Formda satis personeli secimi yok (spec: sadelestirme) -
 * sales kendi uzerine otomatik atanir, owner/admin'in olusturdugu lead atanmamis
 * baslar ve detay sayfasindaki "Satış Personeli Ata" panelinden atanir.
 */
export async function createLeadAction(prevState: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const profile = await requireProfile();

  if (!profile.company_id) {
    return { error: "Hesabınıza bağlı bir firma yok, lead oluşturulamaz." };
  }

  const parsed = parseLeadForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const assignedSalesperson = profile.role === "sales" ? profile.id : null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .insert({
      company_id: profile.company_id,
      ...parsed.data,
      assigned_salesperson: assignedSalesperson,
    })
    .select("id, company_id")
    .single();

  if (error || !data) {
    console.error("createLeadAction error:", error?.message);
    return { error: `Lead oluşturulamadı: ${error?.message ?? "bilinmeyen hata"}` };
  }

  await logActivity(supabase, { leadId: data.id, companyId: data.company_id, type: "system", description: "Lead oluşturuldu." });

  revalidatePath("/leads");
  revalidatePath("/leads/board");
  revalidatePath("/dashboard");
  redirect(`/leads/${data.id}`);
}

/** Item 2: Lead musteri bilgilerini duzenleme (durum/atama/not bu action'a dahil degil). */
export async function updateLeadAction(leadId: string, prevState: LeadFormState, formData: FormData): Promise<LeadFormState> {
  const parsed = parseLeadForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .update(parsed.data)
    .eq("id", leadId)
    .select("company_id")
    .single();

  if (error || !data) {
    console.error("updateLeadAction error:", error?.message);
    return { error: `Kaydedilemedi: ${error?.message ?? "bilinmeyen hata"}` };
  }

  await logActivity(supabase, { leadId, companyId: data.company_id, type: "system", description: "Müşteri bilgileri güncellendi." });

  revalidateLead(leadId);
  redirect(`/leads/${leadId}`);
}

// ----------------------------------------------------------------------------
// Item 3: Durum / oncelik degisikligi
// ----------------------------------------------------------------------------

export type StatusActionState = { error: string | null };

type StatusPayload = {
  status: LeadStatus;
};

export async function updateLeadStatusAction(leadId: string, payload: StatusPayload): Promise<StatusActionState> {
  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("leads")
    .select("status, priority, company_id")
    .eq("id", leadId)
    .single();

  if (fetchError || !current) {
    return { error: "Lead bulunamadı." };
  }

  const updatePayload: Database["public"]["Tables"]["leads"]["Update"] = { status: payload.status };
  // Gercek durum gecisi = musteriyle temas/ilerleme (spec: "gecikmis lead" hesabi
  // icin kullanilan last_contact_at). Sadece oncelik degisikliginde dokunulmuyor -
  // bu tek basina "gorusme yapildi" anlamina gelmez.
  if (current.status !== payload.status) {
    updatePayload.last_contact_at = new Date().toISOString();
  }

  const { error } = await supabase.from("leads").update(updatePayload).eq("id", leadId);

  if (error) {
    console.error("updateLeadStatusAction error:", error.message);
    return { error: `Durum güncellenemedi: ${error.message}` };
  }

  if (current.status !== payload.status) {
    await logActivity(supabase, {
      leadId,
      companyId: current.company_id,
      type: "status_change",
      description: `Durum değişti: ${LEAD_STATUS_LABELS[current.status]} → ${LEAD_STATUS_LABELS[payload.status]}`,
      fromStatus: current.status,
      toStatus: payload.status,
    });
  }

  revalidateLead(leadId);
  return { error: null };
}

// ----------------------------------------------------------------------------
// Gorusme Sonucu: telefonla/yuz yuze gorusme sonrasi TEK adimda hem durum
// degistirilir hem not yazilir (spec: "görüşme sonucuna göre lead durumunu
// seçsin - işte görüştük, şöyle oldu böyle oldu diye"). Onceden ayri "Durum"
// kutusu ve ayri "Not ekle" formu vardi, iki ayri islem gerekiyordu - agent
// sadece WhatsApp uzerinden lead OLUSTURABILDIGI, telefon gorusmesine hic
// erisemedigi icin bu adim daima firma sahibi/satis personeli tarafindan
// elle yapilir. Ikisi de opsiyonel ama en az biri dolu olmali.
// ----------------------------------------------------------------------------

export type MeetingOutcomeState = { error: string | null };

export async function logMeetingOutcomeAction(
  leadId: string,
  prevState: MeetingOutcomeState,
  formData: FormData
): Promise<MeetingOutcomeState> {
  const statusRaw = String(formData.get("status") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!statusRaw && !note) {
    return { error: "Durum seçin veya bir not yazın." };
  }

  // "Satış" buradan yapilamaz - satis tutari kaydedilmeden durum "won" olursa
  // ciro/satis personeli performansi hic yansimaz (bkz. upsertSaleAction).
  // Tek dogru yol Kanban'daki tutar modalidir - burada bilerek engelliyoruz.
  if (statusRaw === "won") {
    return { error: "Satış tutarını girmek için Kanban'da \"Satış\" kolonuna taşıyın." };
  }

  const supabase = await createClient();

  const { data: current, error: fetchError } = await supabase
    .from("leads")
    .select("status, company_id")
    .eq("id", leadId)
    .single();

  if (fetchError || !current) return { error: "Lead bulunamadı." };

  const nextStatus = (statusRaw || null) as LeadStatus | null;
  const statusChanged = nextStatus !== null && nextStatus !== current.status;

  if (statusChanged) {
    const { error } = await supabase
      .from("leads")
      .update({ status: nextStatus, last_contact_at: new Date().toISOString() })
      .eq("id", leadId);
    if (error) {
      console.error("logMeetingOutcomeAction status update error:", error.message);
      return { error: `Durum güncellenemedi: ${error.message}` };
    }
    await logActivity(supabase, {
      leadId,
      companyId: current.company_id,
      type: "status_change",
      description: `Durum değişti: ${LEAD_STATUS_LABELS[current.status]} → ${LEAD_STATUS_LABELS[nextStatus]}`,
      fromStatus: current.status,
      toStatus: nextStatus,
    });
  } else if (note) {
    // Durum degismedi ama gercek bir temas var - not eklerken de last_contact_at
    // guncellenir (spec md.3: "gecikmis lead" hesabi bu alanı kullanır).
    await supabase.from("leads").update({ last_contact_at: new Date().toISOString() }).eq("id", leadId);
  }

  if (note) {
    const { error } = await supabase.from("activities").insert({
      lead_id: leadId,
      company_id: current.company_id,
      type: "note",
      description: note,
    });
    if (error) {
      console.error("logMeetingOutcomeAction note insert error:", error.message);
      return { error: `Not eklenemedi: ${error.message}` };
    }
  }

  revalidateLead(leadId);
  return { error: null };
}


// ----------------------------------------------------------------------------
// Item 6: Takip tarihi olusturma/duzenleme
// ----------------------------------------------------------------------------

export type FollowupActionState = { error: string | null };

export async function upsertFollowupAction(
  leadId: string,
  prevState: FollowupActionState,
  formData: FormData
): Promise<FollowupActionState> {
  const dateStr = String(formData.get("followup_date") ?? "");
  const note = String(formData.get("followup_note") ?? "").trim() || null;

  if (!dateStr) return { error: "Takip tarihi zorunludur." };

  const followupDate = new Date(dateStr);
  if (Number.isNaN(followupDate.getTime())) return { error: "Geçersiz tarih." };

  const supabase = await createClient();

  const { data: lead, error: leadFetchError } = await supabase
    .from("leads")
    .select("company_id")
    .eq("id", leadId)
    .single();

  if (leadFetchError || !lead) return { error: "Lead bulunamadı." };

  const { data: existing } = await supabase
    .from("followups")
    .select("id")
    .eq("lead_id", leadId)
    .eq("is_completed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isoDate = followupDate.toISOString();

  if (existing) {
    const { error } = await supabase.from("followups").update({ followup_date: isoDate, note }).eq("id", existing.id);
    if (error) {
      console.error("upsertFollowupAction update error:", error.message);
      return { error: `Takip güncellenemedi: ${error.message}` };
    }
  } else {
    const { error } = await supabase
      .from("followups")
      .insert({ lead_id: leadId, company_id: lead.company_id, followup_date: isoDate, note });
    if (error) {
      console.error("upsertFollowupAction insert error:", error.message);
      return { error: `Takip oluşturulamadı: ${error.message}` };
    }
  }

  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update({ next_followup_at: isoDate, next_followup_note: note })
    .eq("id", leadId);

  if (leadUpdateError) {
    console.error("upsertFollowupAction lead update error:", leadUpdateError.message);
    return { error: `Lead güncellenemedi: ${leadUpdateError.message}` };
  }

  await logActivity(supabase, {
    leadId,
    companyId: lead.company_id,
    type: "system",
    description: `Takip planlandı: ${followupDate.toLocaleDateString("tr-TR")}${note ? " — " + note : ""}`,
  });

  revalidateLead(leadId);
  return { error: null };
}

/**
 * Takvim sayfasindan dogrudan (lead detayina gitmeden) randevu/takip
 * olusturmak icin: leadId bound degil, formdan (lead_id) okunur. Ayni
 * upsertFollowupAction mantigini kullanir - tek kayit yerini korur.
 */
export async function createAppointmentAction(
  prevState: FollowupActionState,
  formData: FormData
): Promise<FollowupActionState> {
  let leadId = String(formData.get("lead_id") ?? "");

  if (!leadId) {
    // "Yeni Lead Ekle" modu: takvimden lead detayina gitmeden, minimal
    // bilgiyle (ad soyad + telefon) yeni bir lead olusturup randevuyu
    // dogrudan ona bagliyoruz.
    const newLeadName = String(formData.get("new_lead_name") ?? "").trim();
    const newLeadPhone = String(formData.get("new_lead_phone") ?? "").trim();
    if (!newLeadName || !newLeadPhone) {
      return { error: "Lead seçin ya da yeni lead için ad soyad ve telefon girin." };
    }

    const profile = await requireProfile();
    if (!profile.company_id) return { error: "Hesabınıza bağlı bir firma yok." };

    const { first_name, last_name } = splitFullName(newLeadName);
    const supabase = await createClient();
    const assignedSalesperson = profile.role === "sales" ? profile.id : null;

    const { data: newLead, error: leadError } = await supabase
      .from("leads")
      .insert({
        company_id: profile.company_id,
        first_name,
        last_name,
        phone: newLeadPhone,
        assigned_salesperson: assignedSalesperson,
      })
      .select("id, company_id")
      .single();

    if (leadError || !newLead) {
      console.error("createAppointmentAction lead insert error:", leadError?.message);
      return { error: `Lead oluşturulamadı: ${leadError?.message ?? "bilinmeyen hata"}` };
    }

    await logActivity(supabase, {
      leadId: newLead.id,
      companyId: newLead.company_id,
      type: "system",
      description: "Lead oluşturuldu (takvimden).",
    });

    leadId = newLead.id;
  }

  return upsertFollowupAction(leadId, prevState, formData);
}

// ----------------------------------------------------------------------------
// Item 8: Satis personeli atama (sadece owner/admin - RLS de sales'in baskasina
// atamasini zaten engeller, burada ayrica erken/anlasilir bir hata verilir)
// ----------------------------------------------------------------------------

export type AssignActionState = { error: string | null };

export async function assignSalespersonAction(
  leadId: string,
  prevState: AssignActionState,
  formData: FormData
): Promise<AssignActionState> {
  const profile = await requireProfile();
  if (profile.role === "sales") {
    return { error: "Bu işlem için yetkiniz yok." };
  }

  const raw = String(formData.get("assigned_salesperson") ?? "");
  const assignedSalesperson = raw === "" ? null : raw;

  const supabase = await createClient();

  const { data: lead, error: fetchError } = await supabase
    .from("leads")
    .select("company_id")
    .eq("id", leadId)
    .single();

  if (fetchError || !lead) return { error: "Lead bulunamadı." };

  const { error } = await supabase.from("leads").update({ assigned_salesperson: assignedSalesperson }).eq("id", leadId);

  if (error) {
    console.error("assignSalespersonAction error:", error.message);
    return { error: `Atama başarısız: ${error.message}` };
  }

  let salespersonName = "Atanmadı";
  if (assignedSalesperson) {
    const { data: p } = await supabase.from("profiles").select("full_name").eq("id", assignedSalesperson).single();
    salespersonName = p?.full_name ?? "Bilinmiyor";
  }

  await logActivity(supabase, {
    leadId,
    companyId: lead.company_id,
    type: "system",
    description: `Satış personeli atandı: ${salespersonName}`,
  });

  revalidateLead(leadId);
  return { error: null };
}

// ----------------------------------------------------------------------------
// Yapilan Satis: lead "Satis" oldugunda gercek satis tutarini `sales`
// tablosuna kaydeder (spec: "satis kaydini satislar kismina koy, yapilan
// teklif gibi bir alan yap"). RLS geregi sadece owner/admin bu tabloyu
// okuyup yazabilir ("ciro hassas veri") - UI tarafinda da ayni kisitlama
// uygulanir (bkz. lead detay sayfasinda canAssign kontrolu).
// ----------------------------------------------------------------------------

export type SaleActionState = { error: string | null };

export async function upsertSaleAction(
  leadId: string,
  prevState: SaleActionState,
  formData: FormData
): Promise<SaleActionState> {
  const profile = await requireProfile();
  if (profile.role === "sales") {
    return { error: "Bu işlem için yetkiniz yok." };
  }

  const amountRaw = String(formData.get("sale_amount") ?? "").trim().replace(",", ".");
  const amount = Number(amountRaw);
  if (!amountRaw || Number.isNaN(amount) || amount < 0) {
    return { error: "Geçerli bir satış tutarı girin." };
  }

  const supabase = await createClient();

  const { data: lead, error: leadFetchError } = await supabase
    .from("leads")
    .select("company_id, status, assigned_salesperson")
    .eq("id", leadId)
    .single();

  if (leadFetchError || !lead) return { error: "Lead bulunamadı." };

  const { data: existing } = await supabase.from("sales").select("id").eq("lead_id", leadId).limit(1).maybeSingle();

  // Ciro, formu dolduran (her zaman owner/admin) kisiye degil, leade atanmis
  // gercek satis personeline yazilir - aksi halde "Satis Personeli Performansi"
  // her zaman owner/admin'i gosterir (bug: satis rolu bu formu hic goremedigi
  // icin gercek satisci asla "salesperson" olamiyordu).
  if (existing) {
    const { error } = await supabase
      .from("sales")
      .update({ sale_amount: amount, salesperson: lead.assigned_salesperson })
      .eq("id", existing.id);
    if (error) {
      console.error("upsertSaleAction update error:", error.message);
      return { error: `Satış güncellenemedi: ${error.message}` };
    }
  } else {
    const { error } = await supabase
      .from("sales")
      .insert({ lead_id: leadId, company_id: lead.company_id, sale_amount: amount, salesperson: lead.assigned_salesperson });
    if (error) {
      console.error("upsertSaleAction insert error:", error.message);
      return { error: `Satış kaydedilemedi: ${error.message}` };
    }
  }

  await logActivity(supabase, {
    leadId,
    companyId: lead.company_id,
    type: "system",
    description: `Satış tutarı kaydedildi: ${formatCurrencyTR(amount)}`,
  });

  // Satis tutari girildiginde lead'in durumu da otomatik "Satis"a gecer -
  // aksi halde lead ayni anda hem "satis" (sales tablosunda) hem de eski
  // durumunda (orn. "Takip") gorunmeye devam ediyordu (bildirilen bug).
  if (lead.status !== "won") {
    const { error: statusError } = await supabase
      .from("leads")
      .update({ status: "won", last_contact_at: new Date().toISOString() })
      .eq("id", leadId);
    if (statusError) {
      console.error("upsertSaleAction status sync error:", statusError.message);
    } else {
      await logActivity(supabase, {
        leadId,
        companyId: lead.company_id,
        type: "status_change",
        description: `Durum değişti: ${LEAD_STATUS_LABELS[lead.status as LeadStatus]} → ${LEAD_STATUS_LABELS.won}`,
        fromStatus: lead.status as LeadStatus,
        toStatus: "won",
      });
    }
  }

  revalidateLead(leadId);
  return { error: null };
}

function formatCurrencyTR(value: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value);
}

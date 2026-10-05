"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireProfile } from "@/lib/auth/session";
import { LEAD_STATUS_LABELS } from "@/lib/constants/lead";
import { sanitizeSearchTerm } from "@/lib/data/leads";
import type { LeadStatus } from "@/lib/types/domain";
import type { Database } from "@/lib/types/database.types";
import { friendlyDbError } from "@/lib/errors";
import { TR_TZ, followupDateTR } from "@/lib/time";
import { MAX_FOLLOWUP_DAYS, formatFollowupDate, parseFollowupDays, resolveFollowupAt } from "@/lib/followup";

// ----------------------------------------------------------------------------
// Leadler sayfasi "Google gibi" canli oneri kutusu (spec: "S yazınca S ile
// başlayanlar arama kısmının ordan direkt otomatik gözüksün"). Client
// component (lead-filters.tsx) her tus vurusunda (debounce ile) bunu
// dogrudan cagirir - salt okuma oldugu icin "action" ismi biraz yanlis
// gelebilir ama Next.js'te client'tan cagrilabilen tek RPC mekanizmasi bu
// ("use server" fonksiyonu, form'a bagli olmadan da dogrudan cagrilabilir).
// ----------------------------------------------------------------------------

export type LeadSuggestion = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  status: LeadStatus;
};

export async function searchLeadSuggestionsAction(query: string): Promise<LeadSuggestion[]> {
  const term = sanitizeSearchTerm(query);
  if (term.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("id, first_name, last_name, phone, status")
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,phone.ilike.%${term}%`)
    .order("first_name")
    .limit(8);

  if (error) {
    console.error("searchLeadSuggestionsAction error:", error.message);
    return [];
  }

  return (data ?? []) as LeadSuggestion[];
}

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

/**
 * Lead ekleme/duzenleme hatasi. 23505 = firma basina telefon tekilligi
 * (migration 0033, uq_leads_company_phone_norm): ayni musteri 05.. / +90.. /
 * bosluklu yazilsa da ikinci kez acilamaz - genel "kayit zaten mevcut" yerine
 * kullaniciya ne yapacagini soyler.
 */
function leadDbError(err: { code?: string; message?: string } | null | undefined): string {
  if (err?.code === "23505") {
    return "Bu telefon numarası bu firmada zaten kayıtlı. Leadler sayfasında numarayı aratıp mevcut kaydı kullanın.";
  }
  return friendlyDbError(err);
}

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
    return { error: `Lead oluşturulamadı: ${leadDbError(error)}` };
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
    return { error: `Kaydedilemedi: ${leadDbError(error)}` };
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
  // GUVENLIK AGI (denetim bulgusu): Kanban tarafinda "won" kolonuna surukleme
  // client-side'da satis tutari modalini acar (bkz. kanban-board.tsx) - ama bu
  // sadece `canRecordSale` (role !== "sales") true iken calisir. Bir "sales"
  // rolu hesabi (ajans /admin panelinden acilabiliyor - bkz. 0016_salespeople_
  // roster.sql aciklamasi) karti dogrudan "Satış" kolonuna surukleseydi, bu
  // client-side kapi atlanip HICBIR satis kaydi/tutar OLMADAN status='won'
  // yazilabiliyordu - logMeetingOutcomeAction'da zaten engellenen TAM AYNI
  // ciro-atlama hatasinin Kanban'daki esdegeri. Sunucu tarafinda da kapatiyoruz.
  if (payload.status === "won") {
    return { error: "Satış tutarını girmek için Kanban'da \"Satış\" kolonuna taşıyın ve açılan tutar penceresini doldurun." };
  }

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
    return { error: `Durum güncellenemedi: ${friendlyDbError(error)}` };
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
// GORUSME SONUCU (firma paneli) - ajans admin panelindeki "Görüşme Sonucu"
// ile AYNI akis (spec 2026-10-02: "firma panelinde görüşmede ne oldu kısmı
// benim paneldeki gibi olsun, zaman çizelgesine de o şekil not eklenebilsin"):
// yazilan not HER ZAMAN zaman cizelgesine ("note") duser; sonuc butonu
// durumu/takibi tek adimda gunceller:
//   followup -> Takip durumu + takip tarihi (+ opsiyonel takip notu)
//   won      -> satis tutari kaydi (upsertSaleAction) + durum Satis
//   lost     -> durum Kayip, acik takip kapanir
//   note     -> yalnizca not (durum ve takip DEGISMEZ)
// Eski "MeetingOutcomeForm" (durum dropdown'u + opsiyonel not) ve ayri
// "Takip" karti bu akisa tasindi - tek giris noktasi.
// ----------------------------------------------------------------------------

export type LeadOutcomeState = { error: string | null };
type LeadOutcome = "followup" | "lost" | "won" | "note";

/** Lead'in acik (tamamlanmamis) son takip kaydinin id'si; yoksa null. */
async function findOpenFollowupId(supabase: SupabaseServerClient, leadId: string): Promise<string | null> {
  const { data } = await supabase
    .from("followups")
    .select("id")
    .eq("lead_id", leadId)
    .eq("is_completed", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Acik (tamamlanmamis) takip kaydini gunceller, yoksa olusturur. `existingId`
 * cagiran tarafindan onceden (baska sorgularla ayni ag turunda) bulunduysa
 * verilir: string = guncelle, null = yok/olustur; verilmezse burada aranir.
 */
async function upsertOpenFollowup(
  supabase: SupabaseServerClient,
  params: { leadId: string; companyId: string; followupAtIso: string; note: string | null; existingId?: string | null }
) {
  const existingId = params.existingId !== undefined ? params.existingId : await findOpenFollowupId(supabase, params.leadId);

  const result = existingId
    ? await supabase.from("followups").update({ followup_date: params.followupAtIso, note: params.note }).eq("id", existingId)
    : await supabase
        .from("followups")
        .insert({ lead_id: params.leadId, company_id: params.companyId, followup_date: params.followupAtIso, note: params.note });
  if (result.error) console.error("upsertOpenFollowup error:", result.error.message);
  return result.error;
}

/** Raporlar "Tamamlanan Takip" `followups.is_completed`'i sayar: acik takip gorevlerini kapatir. */
async function closeOpenFollowups(supabase: SupabaseServerClient, leadId: string, nowIso: string) {
  const { error } = await supabase
    .from("followups")
    .update({ is_completed: true, completed_at: nowIso })
    .eq("lead_id", leadId)
    .eq("is_completed", false);
  if (error) console.error("closeOpenFollowups error:", error.message);
}

export async function logLeadOutcomeAction(
  leadId: string,
  prevState: LeadOutcomeState,
  formData: FormData
): Promise<LeadOutcomeState> {
  const note = String(formData.get("note") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "") as LeadOutcome;

  if (!["followup", "lost", "won", "note"].includes(outcome)) return { error: "Bir sonuç seçin." };
  if (!note) return { error: "Görüşmede ne olduğunu yazın." };

  let followupAt: Date | null = null;
  if (outcome === "followup") {
    const days = parseFollowupDays(String(formData.get("followup_days") ?? ""));
    if (days === null) return { error: "Takibe almak için kaç gün sonra aranacağını yazın (0-3650)." };
    followupAt = resolveFollowupAt(days);
  }

  const supabase = await createClient();

  // PERF (olcum 2026-10-05): profil, lead ve (takip ise) acik takip kaydi ART ARDA
  // bekleniyordu - "Kaydet"e basinca bosuna 2 ag turu. Ucu de yalnizca OKUMA ve
  // birbirinden bagimsiz: ayni turda. Hicbir yazma, hepsi donup yetki/varlik
  // kontrolleri gecmeden baslamaz (requireProfile reddederse Promise.all da reddeder).
  const [profile, { data: current, error: fetchError }, openFollowupId] = await Promise.all([
    requireProfile(),
    supabase.from("leads").select("status, company_id, next_followup_at").eq("id", leadId).single(),
    outcome === "followup" ? findOpenFollowupId(supabase, leadId) : Promise.resolve(undefined),
  ]);

  if (outcome === "won" && profile.role === "sales") {
    return { error: "Satış kaydı için yetkiniz yok — firma sahibine bildirin." };
  }
  if (fetchError || !current) return { error: "Lead bulunamadı." };

  const nowIso = new Date().toISOString();

  // SATIS: tutar + sales kaydi + durum gecisi mevcut tek yolda (upsertSaleAction)
  // yapilir; basarisizsa HIC not yazilmaz (kullanicinin yazdigi form korunur).
  if (outcome === "won") {
    const saleForm = new FormData();
    saleForm.set("sale_amount", String(formData.get("sale_amount") ?? ""));
    const saleResult = await upsertSaleAction(leadId, { error: null }, saleForm);
    if (saleResult.error) return saleResult;
  }

  const leadUpdate: Database["public"]["Tables"]["leads"]["Update"] = { last_contact_at: nowIso };
  let t0 = Date.now();
  if (outcome === "won") {
    // upsertSaleAction satirlari VERITABANI saatiyle yazdi, buradaki satirlar
    // uygulama saatiyle - saat farki yuzunden not satis satirlarinin ALTINA
    // dusebiliyordu. Not, o satirlarin hemen ustune oturtulur.
    const { data: latest } = await supabase
      .from("activities")
      .select("created_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latest) t0 = Math.max(t0, new Date(latest.created_at).getTime() + 1);
  }
  const rows: Database["public"]["Tables"]["activities"]["Insert"][] = [
    { lead_id: leadId, company_id: current.company_id, type: "note", description: note, created_at: new Date(t0).toISOString() },
  ];

  if (outcome === "followup" && followupAt) {
    leadUpdate.status = "followup";
    leadUpdate.next_followup_at = followupAt.toISOString();
    leadUpdate.next_followup_note = null;
    if (current.status !== "followup") {
      rows.push({
        lead_id: leadId,
        company_id: current.company_id,
        type: "status_change",
        description: `Durum değişti: ${LEAD_STATUS_LABELS[current.status]} → ${LEAD_STATUS_LABELS.followup}`,
        from_status: current.status,
        to_status: "followup",
        created_at: new Date(t0 + 1).toISOString(),
      });
    }
    rows.push({
      lead_id: leadId,
      company_id: current.company_id,
      type: "system",
      description: `Takip planlandı: ${formatFollowupDate(followupAt)}`,
      created_at: new Date(t0 + 2).toISOString(),
    });
  } else if (outcome === "lost") {
    leadUpdate.status = "lost";
    leadUpdate.next_followup_at = null;
    leadUpdate.next_followup_note = null;
    if (current.status !== "lost") {
      rows.push({
        lead_id: leadId,
        company_id: current.company_id,
        type: "status_change",
        description: `Durum değişti: ${LEAD_STATUS_LABELS[current.status]} → ${LEAD_STATUS_LABELS.lost}`,
        from_status: current.status,
        to_status: "lost",
        created_at: new Date(t0 + 1).toISOString(),
      });
    }
  } else if (outcome === "won") {
    // Durum + satis aktivitesi upsertSaleAction'da yazildi; takip artik gecersiz.
    leadUpdate.next_followup_at = null;
    leadUpdate.next_followup_note = null;
  }

  const { error: leadUpdateError } = await supabase.from("leads").update(leadUpdate).eq("id", leadId);
  if (leadUpdateError) {
    console.error("logLeadOutcomeAction lead update error:", leadUpdateError.message);
    return { error: `Güncellenemedi: ${friendlyDbError(leadUpdateError)}` };
  }

  const [activityResult] = await Promise.all([
    supabase.from("activities").insert(rows),
    outcome === "followup" && followupAt
      ? upsertOpenFollowup(supabase, {
          leadId,
          companyId: current.company_id,
          followupAtIso: followupAt.toISOString(),
          note: null,
          existingId: openFollowupId,
        })
      : outcome === "lost" || outcome === "won"
        ? closeOpenFollowups(supabase, leadId, nowIso)
        : Promise.resolve(null),
  ]);

  if (activityResult.error) {
    console.error("logLeadOutcomeAction activity insert error:", activityResult.error.message);
    return { error: `Not kaydedilemedi: ${friendlyDbError(activityResult.error)}` };
  }

  revalidateLead(leadId);
  return { error: null };
}

// ----------------------------------------------------------------------------
// Takibi ERTELE / KALDIR - eskiden takibi degistirmenin tek yolu yeni bir
// gorusme sonucu girmekti (iki panelde de eksikti, spec 2026-10-02: "takip
// kismini cok daha gelismis yap"). Ertele: yeni tarih BUGUNDEN itibaren
// hesaplanir; her ikisi de zaman cizelgesine sistem satiri yazar.
// ----------------------------------------------------------------------------

export async function snoozeLeadFollowupAction(leadId: string, days: number): Promise<LeadOutcomeState> {
  if (!Number.isInteger(days) || days < 1 || days > MAX_FOLLOWUP_DAYS) return { error: "Geçersiz gün sayısı." };

  const supabase = await createClient();
  // PERF: oturum, lead ve acik takip kaydi ayni ag turunda (bkz. logLeadOutcomeAction).
  const [, { data: current, error: fetchError }, openFollowupId] = await Promise.all([
    requireProfile(),
    supabase.from("leads").select("status, company_id, next_followup_at, next_followup_note").eq("id", leadId).single(),
    findOpenFollowupId(supabase, leadId),
  ]);
  if (fetchError || !current) return { error: "Lead bulunamadı." };
  if (!current.next_followup_at) return { error: "Ertelenecek bir takip yok." };
  if (current.status === "won" || current.status === "lost") return { error: "Kapanmış lead'in takibi ertelenemez." };

  const next = resolveFollowupAt(days);
  const { error } = await supabase.from("leads").update({ next_followup_at: next.toISOString() }).eq("id", leadId);
  if (error) return { error: `Ertelenemedi: ${friendlyDbError(error)}` };

  await Promise.all([
    upsertOpenFollowup(supabase, {
      leadId,
      companyId: current.company_id,
      followupAtIso: next.toISOString(),
      note: current.next_followup_note,
      existingId: openFollowupId,
    }),
    logActivity(supabase, {
      leadId,
      companyId: current.company_id,
      type: "system",
      description: `Takip ertelendi: ${formatFollowupDate(current.next_followup_at)} → ${formatFollowupDate(next)}`,
    }),
  ]);

  revalidateLead(leadId);
  return { error: null };
}

export async function clearLeadFollowupAction(leadId: string): Promise<LeadOutcomeState> {
  const supabase = await createClient();
  // PERF: oturum ile lead ayni ag turunda (bkz. logLeadOutcomeAction).
  const [, { data: current, error: fetchError }] = await Promise.all([
    requireProfile(),
    supabase.from("leads").select("company_id, next_followup_at").eq("id", leadId).single(),
  ]);
  if (fetchError || !current) return { error: "Lead bulunamadı." };
  if (!current.next_followup_at) return { error: null };

  const { error } = await supabase.from("leads").update({ next_followup_at: null, next_followup_note: null }).eq("id", leadId);
  if (error) return { error: `Kaldırılamadı: ${friendlyDbError(error)}` };

  await Promise.all([
    closeOpenFollowups(supabase, leadId, new Date().toISOString()),
    logActivity(supabase, {
      leadId,
      companyId: current.company_id,
      type: "system",
      description: `Takip kaldırıldı (planlanan: ${formatFollowupDate(current.next_followup_at)})`,
    }),
  ]);

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
  // DUZELTME (spec: "tarih eklemek yerine kaç gün sonra aransın diye
  // sorsun, ben yazınca otomatik kaydetsin") - kullanicidan artik takvimden
  // tarih secmesi degil, sadece bir gun sayisi girmesi isteniyor; gercek
  // tarih buradan hesaplaniyor. Boylece "3 gun sonra ara" gibi dogal bir
  // giris, elle tarih hesaplamaya gerek kalmadan doğru takip tarihine
  // donusuyor.
  const daysStr = String(formData.get("followup_days") ?? "");
  const note = String(formData.get("followup_note") ?? "").trim() || null;

  if (daysStr === "") return { error: "Kaç gün sonra aranacağı zorunludur." };
  const days = Number(daysStr);
  // Ust sinir: cok buyuk sayi gecersiz tarih uretir (toISOString RangeError -> 500).
  if (!Number.isFinite(days) || days < 0 || days > 3650 || !Number.isInteger(days)) return { error: "Geçersiz gün sayısı." };

  // Turkiye saatiyle bugunden `days` gun sonrasinin 10:00'i (sunucu UTC olsa da - bkz. lib/time.ts).
  const followupDate = followupDateTR(days);

  const supabase = await createClient();

  // PERF (jet hizi): lead + acik takip sorgulari birbirine bagimli degil
  // (paralel); sonraki 3 yazma (takip kaydi, lead ozeti, zaman cizelgesi) da
  // birbirinden bagimsiz (paralel) - eskiden 5 sirali ag turuydu, simdi 2.
  const [leadRes, existingRes] = await Promise.all([
    supabase.from("leads").select("company_id").eq("id", leadId).single(),
    supabase
      .from("followups")
      .select("id")
      .eq("lead_id", leadId)
      .eq("is_completed", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const lead = leadRes.data;
  if (leadRes.error || !lead) return { error: "Lead bulunamadı." };
  const existing = existingRes.data;

  const isoDate = followupDate.toISOString();

  const [followupResult, leadUpdateResult, activityResult] = await Promise.all([
    existing
      ? supabase.from("followups").update({ followup_date: isoDate, note }).eq("id", existing.id)
      : supabase.from("followups").insert({ lead_id: leadId, company_id: lead.company_id, followup_date: isoDate, note }),
    supabase.from("leads").update({ next_followup_at: isoDate, next_followup_note: note }).eq("id", leadId),
    supabase.from("activities").insert({
      lead_id: leadId,
      company_id: lead.company_id,
      type: "system",
      description: `Takip planlandı: ${followupDate.toLocaleDateString("tr-TR", { timeZone: TR_TZ })}${note ? " — " + note : ""}`,
    }),
  ]);

  if (followupResult.error) {
    console.error("upsertFollowupAction followup error:", followupResult.error.message);
    return { error: `Takip kaydedilemedi: ${friendlyDbError(followupResult.error)}` };
  }
  if (leadUpdateResult.error) {
    console.error("upsertFollowupAction lead update error:", leadUpdateResult.error.message);
    return { error: `Lead güncellenemedi: ${friendlyDbError(leadUpdateResult.error)}` };
  }
  if (activityResult.error) {
    console.error("upsertFollowupAction activity error:", activityResult.error.message);
  }

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
      return { error: `Lead oluşturulamadı: ${leadDbError(leadError)}` };
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
// GORUSEN KISI - TEK kavram (spec 2026-10-02: "Görüşen Kişi/Satış Personeli
// iki kısım var, teke indir, Görüşen Kişi olsun sadece"). Secenekler iki
// kaynaktan gelir ama kullaniciya TEK liste olarak sunulur:
//   "s:<id>" -> isim-bazli kayit (salespeople)  => contacted_by
//   "p:<id>" -> giris hesabi (profiles)         => assigned_salesperson
// ONEMLI (bkz. 0016_salespeople_roster.sql): assigned_salesperson, "sales"
// rolundeki gercek hesabin RLS ile SADECE kendi leadlerini gormesini saglar;
// kolon silinmedi/birlestirilmedi - sadece ayni anda en fazla BIRI dolu tutulur.
// ----------------------------------------------------------------------------

export type ContactPersonState = { error: string | null };

export async function setContactPersonAction(
  leadId: string,
  prevState: ContactPersonState,
  formData: FormData
): Promise<ContactPersonState> {
  const raw = String(formData.get("person") ?? "");
  let update: { contacted_by: string | null; assigned_salesperson: string | null };
  if (raw === "") {
    update = { contacted_by: null, assigned_salesperson: null };
  } else if (raw.startsWith("s:")) {
    update = { contacted_by: raw.slice(2), assigned_salesperson: null };
  } else if (raw.startsWith("p:")) {
    update = { contacted_by: null, assigned_salesperson: raw.slice(2) };
  } else {
    return { error: "Geçersiz seçim." };
  }

  const supabase = await createClient();

  // PERF (olcum 2026-10-05): oturum, lead ve secilen kisinin adi ART ARDA (3 ayri
  // ag turu) okunuyordu; ucu de yalnizca okuma ve birbirinden bagimsiz - ayni turda.
  const [profile, { data: lead, error: fetchError }, pickedName] = await Promise.all([
    requireProfile(),
    supabase.from("leads").select("company_id").eq("id", leadId).single(),
    update.contacted_by
      ? supabase.from("salespeople").select("full_name").eq("id", update.contacted_by).single().then(({ data }) => data?.full_name ?? "Bilinmiyor")
      : update.assigned_salesperson
        ? supabase.from("profiles").select("full_name").eq("id", update.assigned_salesperson).single().then(({ data }) => data?.full_name ?? "Bilinmiyor")
        : Promise.resolve("Belirtilmedi"),
  ]);
  if (profile.role === "sales") {
    return { error: "Bu işlem için yetkiniz yok." };
  }
  if (fetchError || !lead) return { error: "Lead bulunamadı." };

  // Cross-tenant korumasi veritabani tetikleyicisinde (0026) - baska firmanin
  // kisisi secilirse update reddedilir.
  const { error } = await supabase.from("leads").update(update).eq("id", leadId);
  if (error) {
    console.error("setContactPersonAction error:", error.message);
    return { error: `Kaydedilemedi: ${friendlyDbError(error)}` };
  }

  await logActivity(supabase, { leadId, companyId: lead.company_id, type: "system", description: `Görüşen kişi: ${pickedName}` });

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
  const amountRaw = String(formData.get("sale_amount") ?? "").trim().replace(",", ".");
  const amount = Number(amountRaw);

  const supabase = await createClient();

  // PERF (olcum 2026-10-05): oturum, lead ve mevcut satis kaydi ART ARDA (3 ag turu)
  // okunuyordu; ucu de yalnizca okuma - ayni turda. Yazmalar bunlar donmeden baslamaz.
  const [profile, { data: lead, error: leadFetchError }, { data: existing }] = await Promise.all([
    requireProfile(),
    supabase.from("leads").select("company_id, status, assigned_salesperson").eq("id", leadId).single(),
    supabase.from("sales").select("id").eq("lead_id", leadId).limit(1).maybeSingle(),
  ]);
  if (profile.role === "sales") {
    return { error: "Bu işlem için yetkiniz yok." };
  }
  if (!amountRaw || Number.isNaN(amount) || amount < 0) {
    return { error: "Geçerli bir satış tutarı girin." };
  }

  if (leadFetchError || !lead) return { error: "Lead bulunamadı." };

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
      return { error: `Satış güncellenemedi: ${friendlyDbError(error)}` };
    }
  } else {
    const { error } = await supabase
      .from("sales")
      .insert({ lead_id: leadId, company_id: lead.company_id, sale_amount: amount, salesperson: lead.assigned_salesperson });
    if (error) {
      console.error("upsertSaleAction insert error:", error.message);
      return { error: `Satış kaydedilemedi: ${friendlyDbError(error)}` };
    }
  }

  // Satis tutari girildiginde lead'in durumu da otomatik "Satis"a gecer -
  // aksi halde lead ayni anda hem "satis" (sales tablosunda) hem de eski
  // durumunda (orn. "Takip") gorunmeye devam ediyordu (bildirilen bug).
  // PERF: zaman cizelgesi satiri ile durum guncellemesi birbirinden bagimsiz - ayni turda.
  const [, statusResult] = await Promise.all([
    logActivity(supabase, {
      leadId,
      companyId: lead.company_id,
      type: "system",
      description: `Satış tutarı kaydedildi: ${formatCurrencyTR(amount)}`,
    }),
    lead.status !== "won"
      ? supabase.from("leads").update({ status: "won", last_contact_at: new Date().toISOString() }).eq("id", leadId)
      : Promise.resolve(null),
  ]);

  if (statusResult) {
    const statusError = statusResult.error;
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

// ----------------------------------------------------------------------------
// Ajan Gorusu: lead detay sayfasinda DOGRUDAN gorunen, tek-alanli hizli
// duzenleme (spec: "AI görüşü kısmı direkt gözüksün, düzenlemeye basmadan
// görmeyelim - hem ajanın doldurabileceği hem benim zorlanmadan
// yapabileceğim bir yer olsun"). Ayni `leads.notes` kolonunu kullanir - tam
// "Lead'i Düzenle" formundan ayri, sadece bu tek alanı kaydeden hafif bir
// action.
// ----------------------------------------------------------------------------

export type AgentNoteState = { error: string | null };

export async function updateAgentNoteAction(
  leadId: string,
  prevState: AgentNoteState,
  formData: FormData
): Promise<AgentNoteState> {
  const notes = String(formData.get("notes") ?? "").trim();

  const supabase = await createClient();

  // PERF: firma kimligini okumak ile notu yazmak birbirinden bagimsiz - ayni ag
  // turunda. Lead yoksa/gorunmuyorsa (RLS) guncelleme zaten hicbir satiri etkilemez.
  const [{ data: lead, error: fetchError }, { error }] = await Promise.all([
    supabase.from("leads").select("company_id").eq("id", leadId).single(),
    supabase.from("leads").update({ notes: notes || null }).eq("id", leadId),
  ]);

  if (fetchError || !lead) return { error: "Lead bulunamadı." };

  if (error) {
    console.error("updateAgentNoteAction error:", error.message);
    return { error: `Kaydedilemedi: ${friendlyDbError(error)}` };
  }

  await logActivity(supabase, { leadId, companyId: lead.company_id, type: "system", description: "Ajan görüşü güncellendi." });

  revalidateLead(leadId);
  return { error: null };
}

function formatCurrencyTR(value: number) {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(value);
}

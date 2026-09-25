"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DiscoveryVisitActionState = { error: string | null };

/**
 * Kesif ziyareti kaydi (spec: "Keşifler" sayfasi). Bilerek AYRI bir tablo/
 * action - leads.status'a ("Keşif/Teklif") DOKUNMAZ, sadece ziyaretin
 * kendisini (kim, ne zaman, nerede, nasil gecti) gunluk olarak kaydeder;
 * durum degisikligi hala satis personelinin ayri, bilincli karari olarak
 * kalir (bkz. actions.ts:updateLeadStatusAction aciklamasi).
 */
export async function createDiscoveryVisitAction(
  prevState: DiscoveryVisitActionState,
  formData: FormData
): Promise<DiscoveryVisitActionState> {
  const leadId = String(formData.get("lead_id") ?? "");
  const visitDate = String(formData.get("visit_date") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const outcomeNote = String(formData.get("outcome_note") ?? "").trim() || null;

  if (!leadId) return { error: "Lead seçin." };
  if (!visitDate) return { error: "Ziyaret tarihi zorunludur." };

  const supabase = await createClient();

  const { data: lead, error: leadFetchError } = await supabase
    .from("leads")
    .select("company_id")
    .eq("id", leadId)
    .single();

  if (leadFetchError || !lead) return { error: "Lead bulunamadı." };

  const { error } = await supabase.from("discovery_visits").insert({
    lead_id: leadId,
    company_id: lead.company_id,
    visit_date: visitDate,
    location,
    outcome_note: outcomeNote,
  });

  if (error) {
    console.error("createDiscoveryVisitAction error:", error.message);
    return { error: `Kaydedilemedi: ${error.message}` };
  }

  // Lead detayindaki zaman cizelgesinde de gorunsun (spec: "burada olan her
  // şeyi... zaman çizelgesindeki herhangi bir not bile durum değişikliği
  // sayılır" - bu satir ayrica last_activity_at'i de gunceller, bkz.
  // trg_activities_touch_lead trigger'i).
  const { error: activityError } = await supabase.from("activities").insert({
    lead_id: leadId,
    company_id: lead.company_id,
    type: "note",
    description: `Keşif ziyareti kaydedildi${location ? " — " + location : ""}${outcomeNote ? ": " + outcomeNote : ""}`,
  });
  if (activityError) {
    console.error("createDiscoveryVisitAction activity error:", activityError.message);
  }

  revalidatePath("/leads/discoveries");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads/overdue");
  return { error: null };
}

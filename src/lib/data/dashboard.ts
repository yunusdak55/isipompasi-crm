import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUS_ORDER } from "@/lib/constants/lead";
import type { DashboardStats, LeadStatus } from "@/lib/types/domain";

/**
 * Dashboard sayaclarini GERCEK veritabanindan okur (spec md.30: basit
 * sayimlar icin AI degil, direkt sorgu kullanilmali). RLS sayesinde
 * sadece kullanicinin gorebilecegi leadler sayilir - firma/rol ayrimi
 * burada AYRICA kod yazmaya gerek kalmadan otomatik saglanir.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const { data, error } = await supabase.from("leads").select("status, offered_amount");

  if (error || !data) {
    if (error) console.error("getDashboardStats error:", error.message);
    return { totalLeads: 0, byStatus: [], pipelineValue: 0, leadChangePct: null, offerChangePct: null, saleChangePct: null };
  }

  const byStatusMap = new Map<LeadStatus, number>();
  let pipelineValue = 0;

  // Pipeline degeri artik gercekten kullanilan "Yapilan Teklif" (offered_amount)
  // alanindan hesaplaniyor - eskiden formdan kaldirilmis olan estimated_budget
  // kullaniliyordu, bu rakam hic guncellenmiyordu (spec: "yapılan tekliflerin
  // tutarı leadlere giriliyor, orayı bağlayalım"). Kapanmis (satis/kayip)
  // leadler artik "acik" pipeline sayilmiyor - Satislar sayfasindaki
  // pipelineValue hesabiyla ayni mantik (bkz. lib/data/sales.ts).
  for (const row of data) {
    const status = row.status as LeadStatus;
    byStatusMap.set(status, (byStatusMap.get(status) ?? 0) + 1);
    if (status !== "won" && status !== "lost" && row.offered_amount) {
      pipelineValue += Number(row.offered_amount);
    }
  }

  const byStatus = LEAD_STATUS_ORDER.map((status) => ({
    status,
    count: byStatusMap.get(status) ?? 0,
  }));

  return {
    totalLeads: data.length,
    byStatus,
    pipelineValue,
    // V1: onceki aya gore degisim yuzdesi, ikinci asamada gercek tarih
    // araligi sorgusuyla eklenecek. Simdilik gosterilmiyor (null = "veri yok").
    leadChangePct: null,
    offerChangePct: null,
    saleChangePct: null,
  };
}

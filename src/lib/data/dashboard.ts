import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUS_ORDER } from "@/lib/constants/lead";
import type { DashboardStats } from "@/lib/types/domain";

/**
 * Dashboard sayaclarini GERCEK veritabanindan okur (spec md.30: basit
 * sayimlar icin AI degil, direkt sorgu kullanilmali). RLS sayesinde
 * sadece kullanicinin gorebilecegi leadler sayilir - firma/rol ayrimi
 * burada AYRICA kod yazmaya gerek kalmadan otomatik saglanir.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  // PERF (jet hizi): eskiden TUM lead satirlari (status + offered_amount) cekilip
  // JS'te sayiliyordu - lead sayisi buyudukce dogrusal yavaslardi. Simdi
  // veritabani tek satirlik ozet dondurur (bkz. migration 0024 dashboard_stats,
  // SECURITY INVOKER: RLS aynen gecerli, baska firmanin verisi sayilmaz).
  const { data, error } = await supabase.rpc("dashboard_stats");

  if (error || !data) {
    if (error) console.error("getDashboardStats error:", error.message);
    return { totalLeads: 0, byStatus: [], pipelineValue: 0, leadChangePct: null, offerChangePct: null, saleChangePct: null };
  }

  const stats = data as { total: number; pipeline_value: number; by_status: Record<string, number> };

  const byStatus = LEAD_STATUS_ORDER.map((status) => ({
    status,
    count: stats.by_status[status] ?? 0,
  }));

  return {
    totalLeads: Number(stats.total),
    byStatus,
    // Kapanmis (satis/kayip) leadler "acik" pipeline sayilmaz - Satislar
    // sayfasindaki pipelineValue ile ayni mantik (bkz. lib/data/sales.ts).
    pipelineValue: Number(stats.pipeline_value),
    // V1: onceki aya gore degisim yuzdesi, ikinci asamada gercek tarih
    // araligi sorgusuyla eklenecek. Simdilik gosterilmiyor (null = "veri yok").
    leadChangePct: null,
    offerChangePct: null,
    saleChangePct: null,
  };
}

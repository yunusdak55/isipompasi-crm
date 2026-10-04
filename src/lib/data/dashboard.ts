import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUS_ORDER } from "@/lib/constants/lead";
import { DAY_MS, partsTR, shiftMonth, startOfDayTR } from "@/lib/time";
import { FOLLOWUP_OVERDUE_HOURS, NEW_LEAD_HOURS } from "@/lib/utils";
import type { DashboardStats } from "@/lib/types/domain";

type RawStats = { total: number; pipeline_value: number; by_status: Record<string, number> };

const EMPTY_STATS: DashboardStats = {
  totalLeads: 0,
  byStatus: [],
  pipelineValue: 0,
  leadChangePct: null,
  offerChangePct: null,
  saleChangePct: null,
};

function toDashboardStats(stats: RawStats): DashboardStats {
  return {
    totalLeads: Number(stats.total),
    byStatus: LEAD_STATUS_ORDER.map((status) => ({ status, count: stats.by_status[status] ?? 0 })),
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
    return EMPTY_STATS;
  }

  return toDashboardStats(data as RawStats);
}

/** "Bugun" ekranindaki tek bir musteri satiri (dashboard_today RPC ciktisi). */
export type TodayLead = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  city: string | null;
  status: string;
  offered_amount: number | null;
  next_followup_at: string | null;
  created_at: string;
};

export type DashboardToday = {
  /** false: RPC hata verdi - sayfa "0 is var" demek yerine hatayi gostermeli. */
  ok: boolean;
  /**
   * due: bugunku takip (dunku, 24 saati dolmamis olanlar DAHIL) - dueCarry: due'nun icinden "dunden kalan"
   * kismi - overdue: 24 saati asmis - fresh: son 24 saatte gelen.
   */
  counts: { overdue: number; due: number; dueCarry: number; fresh: number };
  /** 7 eleman: [bugun (= counts.due), yarin, +2 gun ... +6 gun] takip sayisi. */
  week: number[];
  /** Bu ayin (Turkiye takvimi) satis adedi ve cirosu. */
  month: { salesCount: number; revenue: number };
  overdue: TodayLead[];
  due: TodayLead[];
  fresh: TodayLead[];
  stats: DashboardStats;
};

const EMPTY_TODAY: DashboardToday = {
  ok: false,
  counts: { overdue: 0, due: 0, dueCarry: 0, fresh: 0 },
  week: [0, 0, 0, 0, 0, 0, 0],
  month: { salesCount: 0, revenue: 0 },
  overdue: [],
  due: [],
  fresh: [],
  stats: EMPTY_STATS,
};

/**
 * Dashboard "Bugun" ekrani: bugunku takip / geciken / yeni sayilari + her
 * birinin ilk kayitlari + haftalik takip yogunlugu + bu ayin satisi + satis
 * hatti sayaclari, TEK veritabani turunda (migration 0032 dashboard_today).
 * SECURITY INVOKER: RLS aynen gecerli.
 *
 * Zaman sinirlari BURADAN gider (Turkiye gunu/ayi: lib/time.ts) - veritabani
 * saat dilimine ya da saat sapmasina bagli sonuc olusmaz. Esikler
 * FOLLOWUP_OVERDUE_HOURS / NEW_LEAD_HOURS'tan gelir (SQL kurali ile utils.ts'in
 * sapmadigi scripts/verify-dashboard-today.mts ile dogrulanir).
 */
async function rpcDashboardToday(dueLimit: number, otherLimit: number) {
  const supabase = await createClient();
  const now = new Date();
  const dayStart = startOfDayTR(now);
  const dayEnd = new Date(dayStart.getTime() + DAY_MS);
  const { year, month } = partsTR(now);
  const next = shiftMonth(year, month, 1);
  const monthDate = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, "0")}-01`;

  return supabase.rpc("dashboard_today", {
    p_now: now.toISOString(),
    p_day_start: dayStart.toISOString(),
    p_day_end: dayEnd.toISOString(),
    p_month_start: monthDate(year, month),
    p_month_end: monthDate(next.year, next.month),
    p_overdue_hours: FOLLOWUP_OVERDUE_HOURS,
    p_new_hours: NEW_LEAD_HOURS,
    p_due_limit: dueLimit,
    p_other_limit: otherLimit,
  });
}

/**
 * "Gecikmis takip" sayisinin TEK kaynagi (Dashboard, Gecikenler ve Raporlar ayni
 * sayiyi gostersin diye): dashboard_today'in `overdue` sayaci. Liste istenmez
 * (limit 0) - tek, hafif bir RPC. Okunamazsa null (cagiran uydurma bir 0
 * gostermemeli).
 */
export async function getOverdueLeadCount(): Promise<number | null> {
  // Ajan sayfasi ayni istekte getOverdueSummary(8) de cagirir: cache() sayesinde TEK RPC.
  const summary = await getOverdueSummary(8);
  return summary ? summary.count : null;
}

/**
 * Dijital Ajan'in "gecikmis takip" ozeti: toplam sayi + en az geciken ilk `limit`
 * kayit - TEK hafif RPC. Eskiden Ajan sayfasi tum gecikmis leadleri (yuzlerce
 * satir + joinler) cekip JS'te suzuyordu; kural AYNI (isLeadOverdue == SQL,
 * scripts/verify-dashboard-today.mts ile dogrulanir). Okunamazsa null.
 */
export const getOverdueSummary = cache(async (limit: number): Promise<{ count: number; leads: TodayLead[] } | null> => {
  const { data, error } = await rpcDashboardToday(0, limit);
  if (error || !data) {
    if (error) console.error("getOverdueSummary error:", error.message);
    return null;
  }
  const raw = data as { counts: { overdue: number }; overdue: TodayLead[] };
  return { count: Number(raw.counts.overdue), leads: raw.overdue };
});

export async function getDashboardToday(): Promise<DashboardToday> {
  const { data, error } = await rpcDashboardToday(8, 5);

  if (error || !data) {
    if (error) console.error("getDashboardToday error:", error.message);
    return EMPTY_TODAY;
  }

  const raw = data as {
    counts: { overdue: number; due: number; due_carry: number; new: number };
    week: Record<string, number>;
    month: { sales_count: number; revenue: number };
    overdue: TodayLead[];
    due: TodayLead[];
    new: TodayLead[];
    stats: RawStats;
  };

  const due = Number(raw.counts.due);
  return {
    ok: true,
    counts: { overdue: Number(raw.counts.overdue), due, dueCarry: Number(raw.counts.due_carry), fresh: Number(raw.counts.new) },
    week: [due, ...Array.from({ length: 6 }, (_, i) => Number(raw.week[String(i)] ?? 0))],
    month: { salesCount: Number(raw.month.sales_count), revenue: Number(raw.month.revenue) },
    overdue: raw.overdue,
    due: raw.due,
    fresh: raw.new,
    stats: toDashboardStats(raw.stats),
  };
}
